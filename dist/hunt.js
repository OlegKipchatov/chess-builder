// Hunt rules are independent of the regular chess engine and presentation.
export const huntConfig = Object.freeze({
  initialPlayerPieces:2, initialOpponentPieces:2, opponentSpawnEveryPlayerMoves:2,
  timedDurationMs:60_000, endlessStartingLives:5, materialPerRecoveredLife:20,
  rewardMultiplier:1.25, placementAttemptLimit:32,
  opponentMoveWeights:{threat:4,danger:6,distance:1,reversal:2},
  playerPool:['n','b','r','q'], opponentWeights:{p:6,n:3,b:3,r:2,q:1},
  playerSquares:['b2','d2','f2','g2'], opponentSquares:['a6','c6','e6','h6'],
  fallback:[['b1','n','w'],['g1','n','w'],['a7','p','b'],['h7','p','b']],
});
export const materialValues = Object.freeze({p:1,n:3,b:3,r:5,q:9});
export const huntSquares = Array.from({length:64},(_,i)=>'abcdefgh'[i%8]+(8-Math.floor(i/8)));
const stableSquares = [...huntSquares].sort();
const number = value => Number.isFinite(value)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(value))):0;
const add = (a,b) => Math.min(Number.MAX_SAFE_INTEGER,a+b);
export const seedNumber = seed => {
  let hash=2166136261;
  for(const char of String(seed))hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return hash>>>0;
};
const random = state => {
  state.rngState=(state.rngState+0x6d2b79f5)>>>0;
  let t=state.rngState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
};
const pick = (state,items) => items[Math.floor(random(state)*items.length)];
const generateType = (state,color,config) => {
  if(color==='w')return pick(state,config.playerPool);
  const entries=Object.entries(config.opponentWeights),total=entries.reduce((sum,[,weight])=>sum+weight,0);
  let roll=random(state)*total;
  for(const [type,weight] of entries){roll-=weight;if(roll<0)return type;}
  return entries.at(-1)[0];
};
export const canMove = (pieces,from,to) => {
  const piece=pieces[from];
  if(!piece||!huntSquares.includes(to)||from===to||pieces[to]?.color===piece.color)return false;
  const dx=to.charCodeAt(0)-from.charCodeAt(0),dy=Number(to[1])-Number(from[1]);
  if(piece.type==='n')return Math.abs(dx)*Math.abs(dy)===2;
  if(piece.type==='p')return piece.color==='b'&&dy===-1&&((Math.abs(dx)===1&&pieces[to]?.color==='w')||(dx===0&&!pieces[to]));
  const diagonal=Math.abs(dx)===Math.abs(dy),straight=dx===0||dy===0;
  if(!({b:diagonal,r:straight,q:diagonal||straight})[piece.type])return false;
  for(let step=1;step<Math.max(Math.abs(dx),Math.abs(dy));step++){
    const square=String.fromCharCode(from.charCodeAt(0)+Math.sign(dx)*step)+(Number(from[1])+Math.sign(dy)*step);
    if(pieces[square])return false;
  }
  return true;
};
export const playerMoves = state => Object.entries(state.pieces).filter(([,p])=>p.color==='w').flatMap(([from])=>huntSquares.filter(to=>canMove(state.pieces,from,to)).map(to=>({from,to})));
export const opponentCaptures = pieces => Object.entries(pieces).filter(([,p])=>p.color==='b').flatMap(([from])=>Object.entries(pieces).filter(([to,p])=>p.color==='w'&&canMove(pieces,from,to)).map(([to])=>({from,to}))).sort((a,b)=>materialValues[pieces[b.to].type]-materialValues[pieces[a.to].type]||a.from.localeCompare(b.from)||a.to.localeCompare(b.to));
const opponentPositionAfter = (pieces,move) => {
  const next={...pieces},piece=pieces[move.from];delete next[move.from];
  next[move.to]=piece.type==='p'&&move.to[1]==='1'?{...piece,type:'q'}:piece;
  return next;
};
export const chooseOpponentMove = (state,config=huntConfig) => {
  const capture=opponentCaptures(state.pieces)[0];if(capture)return capture;
  const players=Object.entries(state.pieces).filter(([,piece])=>piece.color==='w');
  if(!players.length)return null;
  const weights=config.opponentMoveWeights;
  const options=Object.entries(state.pieces).filter(([,piece])=>piece.color==='b').flatMap(([from])=>stableSquares.filter(to=>!state.pieces[to]&&canMove(state.pieces,from,to)).map(to=>{
    const move={from,to},pieces=opponentPositionAfter(state.pieces,move);
    const threat=players.reduce((value,[square,piece])=>Math.max(value,canMove(pieces,to,square)?materialValues[piece.type]:0),0);
    const danger=players.some(([square])=>canMove(pieces,square,to))?materialValues[pieces[to].type]:0;
    const distance=Math.min(...players.map(([square])=>Math.max(Math.abs(square.charCodeAt(0)-to.charCodeAt(0)),Math.abs(Number(square[1])-Number(to[1])))));
    const reversal=state.lastOpponentMove?.from===to&&state.lastOpponentMove?.to===from?1:0;
    return {move,value:threat*weights.threat-danger*weights.danger-distance*weights.distance-reversal*weights.reversal};
  }));
  options.sort((a,b)=>b.value-a.value||a.move.from.localeCompare(b.move.from)||a.move.to.localeCompare(b.move.to));
  return options[0]?.move||null;
};
export const placePiece = (state,color,config=huntConfig,{initial=false}={}) => {
  const type=generateType(state,color,config);
  const valid=square=>!state.pieces[square]&&!(type==='p'&&square[1]==='1');
  const empty=stableSquares.filter(valid);
  if(!empty.length)return null;
  const safe=square=>!opponentCaptures({...state.pieces,[square]:{type,color}}).some(move=>move.to===square);
  let candidates=initial?(color==='w'?config.playerSquares:config.opponentSquares).filter(valid):empty;
  if(color==='w'&&!initial){const safeEmpty=empty.filter(safe);candidates=safeEmpty.length?safeEmpty:[empty[0]];}
  const square=candidates.length?pick(state,candidates):empty[0];
  state.pieces[square]={type,color};return {square,type,color};
};
export const createHunt = ({mode,runId,runSeed},config=huntConfig) => {
  if(!['timed','endless'].includes(mode))throw new Error('Unknown Hunt mode');
  const state={runId,runSeed,mode,phase:'idle',pieces:{},rngState:seedNumber(runSeed),score:0,capturedMaterial:0,playerMoveCount:0,lives:config.endlessStartingLives,lifeRecoveryMaterial:0};
  for(let attempt=0;attempt<config.placementAttemptLimit;attempt++){
    state.pieces={};
    for(let i=0;i<config.initialPlayerPieces;i++)placePiece(state,'w',config,{initial:true});
    for(let i=0;i<config.initialOpponentPieces;i++)placePiece(state,'b',config,{initial:true});
    if(!opponentCaptures(state.pieces).length&&playerMoves(state).length)return state;
  }
  state.pieces=Object.fromEntries(config.fallback.map(([square,type,color])=>[square,{type,color}]));
  return state;
};
export const startHunt = (state,now,config=huntConfig) => state.phase==='idle'?{...state,phase:'awaitingPlayer',startedAtMs:now,...(state.mode==='timed'?{targetEndAtMs:now+config.timedDurationMs}:{})}:state;
export const remainingTime = (state,now) => Math.max(0,(state.targetEndAtMs??now)-now);
const expired = (state,now) => state.mode==='timed'&&state.targetEndAtMs!==undefined&&now>=state.targetEndAtMs;
export const finishHunt = (state,reason,now) => state.phase==='finished'?state:{...state,phase:'finished',finishReason:reason,finishedAtMs:now};
export const recoverLife = (state,material,config=huntConfig) => {
  let progress=state.lifeRecoveryMaterial+material,lives=state.lives;
  while(progress>=config.materialPerRecoveredLife){progress-=config.materialPerRecoveredLife;lives++;}
  return {...state,lives,lifeRecoveryMaterial:progress};
};
export const resolvePlayerMove = (input,move,{now=Date.now(),clock=()=>now,config=huntConfig}={}) => {
  if(input.phase!=='awaitingPlayer')return {state:input,events:[]};
  if(expired(input,now))return {state:finishHunt(input,'timer',now),events:[]};
  if(input.pieces[move.from]?.color!=='w'||!canMove(input.pieces,move.from,move.to))return {state:input,events:[]};
  let state={...input,pieces:structuredClone(input.pieces),phase:'resolving',lastMove:move};
  const events=[];
  const emit=(type,details={})=>events.push({...details,pieceType:details.type,type,pieces:structuredClone(state.pieces)});
  const captured=state.pieces[move.to];
  state.pieces[move.to]=state.pieces[move.from];delete state.pieces[move.from];
  if(captured){state.capturedMaterial=add(state.capturedMaterial,materialValues[captured.type]);state.score=state.capturedMaterial;if(state.mode==='endless')state=recoverLife(state,materialValues[captured.type],config);}
  emit('playerMoved',{...move,captured:captured?.type,color:'w'});
  const response=chooseOpponentMove(state,config);
  if(response){
    const lost=state.pieces[response.to];state.pieces=opponentPositionAfter(state.pieces,response);state.lastOpponentMove=response;
    emit(lost?'opponentCaptured':'opponentMoved',{...response,captured:lost?.type,color:'b'});
    if(lost){
      if(state.mode==='endless')state.lives--;
      if(state.mode==='endless'&&state.lives===0)state=finishHunt(state,'lives',clock());
      else {const replacement=placePiece(state,'w',config);if(replacement)emit('playerRespawned',replacement);else state=finishHunt(state,'no-space',clock());}
    }
  }
  state.playerMoveCount++;
  const endTime=clock();
  if(state.phase!=='finished'&&expired(state,endTime))state=finishHunt(state,'timer',endTime);
  if(state.phase!=='finished'&&state.playerMoveCount%config.opponentSpawnEveryPlayerMoves===0){const piece=placePiece(state,'b',config);if(piece)emit('opponentSpawned',piece);}
  return {state,events};
};
export const releaseHuntInput = (state,now) => state.phase==='finished'?state:expired(state,now)?finishHunt(state,'timer',now):{...state,phase:'awaitingPlayer'};
export const skipExpiredSpawn = (state,event,now) => {
  if(event.type!=='opponentSpawned'||!expired(state,now))return state;
  const pieces={...state.pieces};delete pieces[event.square];
  return finishHunt({...state,pieces},'timer',now);
};
export const tickHunt = (state,now) => state.phase==='awaitingPlayer'&&expired(state,now)?finishHunt(state,'timer',now):state;
export const calculateMiniGameCoins = ({score},config=huntConfig) => Math.floor(Math.sqrt(number(score))*Math.sqrt(config.rewardMultiplier));
export const initialHuntProgress = () => ({records:{timed:{bestScore:0},endless:{bestScore:0}},awards:{}});
export const normalizeHuntProgress = input => ({records:{timed:{bestScore:number(input?.records?.timed?.bestScore)},endless:{bestScore:number(input?.records?.endless?.bestScore)}},awards:Object.fromEntries(Object.entries(input?.awards||{}).filter(([id,value])=>id.length<=128&&Number.isSafeInteger(value)&&value>=0))});
// Wallet + ledger + record are persisted together via the existing single state write.
export const awardHunt = (wallet,run,config=huntConfig) => {
  const progress=normalizeHuntProgress(wallet.hunt);
  if(run.phase!=='finished'||!['timer','lives','no-space'].includes(run.finishReason)||Object.hasOwn(progress.awards,run.runId))return wallet;
  const coins=calculateMiniGameCoins(run,config);
  return {...wallet,coins:add(wallet.coins,coins),hunt:{records:{...progress.records,[run.mode]:{bestScore:Math.max(progress.records[run.mode].bestScore,run.score)}},awards:{...progress.awards,[run.runId]:coins}}};
};
// Adapter reuses the existing board and equipped visuals without king validation.
export const huntBoardAdapter = state => ({
  board:()=>Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>state.pieces['abcdefgh'[c]+(8-r)]||null)),
  moves:({square})=>playerMoves(state).filter(move=>move.from===square),
  history:()=>state.lastMove?[state.lastMove]:[],turn:()=>'w',isCheck:()=>false,
});
