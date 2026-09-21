import {Chess} from './chess.js?v=29';
import {CONFIG as C} from './cognitive-config.js?v=29';
import {capabilitiesFor,factsFor,threatsFor,perceive,random,uci,boardPieces} from './cognitive-model.js?v=29';
import {profileAdjustment} from './cognitive-profile.js?v=29';
import {validPlayStyle} from './play-style-config.js?v=29';
const center = square => 7-Math.abs(square.charCodeAt(0)-97-3.5)-Math.abs(Number(square[1])-1-3.5);
const material = (pieces,side) => pieces.reduce((s,p)=>s+(p.color===side?1:-1)*C.values[p.type],0);
const fractional = (n,seed,key) => Math.floor(n)+(random(seed,key)<n%1?1:0);
export const leafValue = (game,side,view,caps,seed,key) => {
 const pieces=boardPieces(game);let score=pieces.reduce((sum,p)=>sum+(p.color===side?1:-1)*C.values[p.type]*(1+(random(seed,key+':value:'+p.type)*2-1)*C.valueUncertainty*(1-caps.evaluationAccuracy)),0);
 // `view` is produced for this exact FEN by the caller. Re-sampling here
 // made one position appear to both notice and miss the same attack depending
 // on which root candidate reached the leaf.
 const observed=Array.isArray(view.noticed)?view:perceive({threats:threatsFor(game,pieces),complexity:view.complexity},caps,seed,key),risks=new Map();
 for(const threat of observed.noticed){
  const defended=game.isAttacked(threat.to,threat.color),attacker=C.values[game.get(threat.from).type];
  const loss=Math.max(0,C.values[threat.type]-(defended?attacker:0))*(game.turn()===threat.color?C.escapeDiscount:1);
  const previous=risks.get(threat.to);if(!previous||loss>previous.loss)risks.set(threat.to,{loss,color:threat.color});
 }
 for(const risk of risks.values())score+=(risk.color===side?-1:1)*risk.loss*C.threatWeight;
 if(view.tactics&&game.turn()!==side&&game.isCheck())score+=C.checkEvaluationBonus;
 if(view.position)score+=pieces.reduce((s,p)=>s+(p.color===side?1:-1)*center(p.square)*C.positionWeight,0);
 // Shared subjective piece values; no independent re-rolling of the same material between lines.
 if(view.position&&material(pieces,side)>C.winningMaterial){
  const enemyMaterial=pieces.filter(p=>p.color!==side).reduce((sum,p)=>sum+C.values[p.type],0);
  score-=caps.conversionSkill*enemyMaterial*C.conversionExchange/1000;
 }
 return score;
};
export const candidateIdeas = (game,facts,view,caps,rootSide,seed,key,last=null) => {
 const enemyTurn=game.turn()!==rootSide;
 return facts.legal.flatMap(move=>{
  const reasons=[];let value=0;
  const noticedCapture=view.noticed.some(t=>t.from===move.from&&t.to===move.to);
  if(move.captured&&(!enemyTurn||noticedCapture)){reasons.push('capture');value+=C.values[move.captured];}
  if(enemyTurn&&move.captured&&!noticedCapture&&!game.isCheck())return [];
  if(view.tactics&&/[+#]/.test(move.san)){reasons.push('check');value+=C.checkBonus;}
  if(view.noticed.some(t=>t.to===move.from)){reasons.push('escape-threat');value+=C.values[move.piece]*.25;}
  if(['n','b'].includes(move.piece)&&['1','8'].includes(move.from[1])){reasons.push('development');value+=view.opening?C.development:5;}
  if(center(move.to)>center(move.from)){reasons.push('centralize');value+=(center(move.to)-center(move.from))*(view.position?C.positionWeight:3);}
  if(move.promotion){reasons.push('promotion');value+=C.values[move.promotion]-100;}
  if(/[kq]/.test(move.flags)){reasons.push('castle');value+=view.opening?C.castleBonus:5;}
  if(game.isCheck())reasons.push('legal-check-response');
  if(facts.legal.length===1)reasons.push('only-legal-move');
  if(move.piece==='k'&&facts.legal.every(candidate=>candidate.piece==='k'))reasons.push('forced-king-manoeuvre');
  if(move.piece==='p'&&!move.captured){reasons.push('pawn-space');value+=2;}
  if(move.piece==='r'&&!facts.pieces.some(p=>p.type==='p'&&p.color===game.turn()&&p.square[0]===move.to[0]))reasons.push('open-file');
  if(move.piece==='k'&&facts.phase==='endgame')reasons.push('king-activity');
  if(!reasons.length)return [];
  if(view.opening&&last?.to===move.from&&!move.captured)value-=C.repeatPenalty;
  if(view.opening&&facts.phase==='opening'&&move.piece==='q'&&!move.captured)value-=C.earlyQueenPenalty;
  return [{move,reasons,naturalness:value}];
 }).sort((a,b)=>b.naturalness-a.naturalness||uci(a.move).localeCompare(uci(b.move)));
};
/** Decision API: no reference evaluations or SF candidates are accepted. */
export const decide = ({fen,pgn,elo,seed,maxNodes=C.maxNodes,maxDepth=C.technicalDepthCap,profile='default'}) => {
 if(!validPlayStyle(profile))throw RangeError('Unknown play style');
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isSafeInteger(maxNodes)||maxNodes<1||!(maxDepth===Infinity||(Number.isSafeInteger(maxDepth)&&maxDepth>=0)))throw RangeError('Invalid decision input');
 const caps=capabilitiesFor(elo),game=new Chess();if(pgn)game.loadPgn(pgn);else game.load(fen);
 if(fen&&game.fen()!==fen)throw Error('Position/history mismatch');
 if(game.isGameOver())return {move:null,trace:{terminal:true}};
 const side=game.turn(),key=game.fen();
 // Facts are geometric and safe to memoize by FEN. Perception is also stable
 // for a given position/seed, so this removes duplicate chess.js work and
 // prevents accidental re-rolls at equivalent nodes.
 const factsCache=new Map(),viewCache=new Map();
 const factsAt=state=>{const stateKey=state.fen();let value=factsCache.get(stateKey);if(!value){value=factsFor(state);factsCache.set(stateKey,value);}return value;};
 const facts=factsAt(game);
 // Attention load belongs to this decision. Imagined leaves need observed
 // attacks, but not another full legal-move/SAN generation just to evaluate them.
 const viewAt=state=>{const stateKey=state.fen();let value=viewCache.get(stateKey);if(!value){value=perceive({threats:factsCache.get(stateKey)?.threats||threatsFor(state),complexity:facts.complexity},caps,seed,stateKey);viewCache.set(stateKey,value);}return value;};
 const view=viewAt(game);
 const history=game.history({verbose:true}),lastMoves={w:history.filter(m=>m.color==='w').at(-1),b:history.filter(m=>m.color==='b').at(-1)};
 const withMove=(move,run)=>{const color=game.turn(),previous=lastMoves[color];game.move(move);lastMoves[color]=move;try{return run();}finally{game.undo();lastMoves[color]=previous;}};
 const width=Math.max(1,fractional(caps.calculationWidth,seed,key+':width'));
 const requestedDepth=fractional(caps.calculationDepth,seed,key+':depth'),depth=Math.min(requestedDepth,maxDepth);
 const ideas=candidateIdeas(game,facts,view,caps,side,seed,key,lastMoves[side]).slice(0,C.maxRoot);
 if(!ideas.length)throw Error('No explainable candidate');
 // Complete each depth for the entire selectable pool. Mixing shallow and
 // searched values rewards candidates whose adverse replies were not visited.
 let nodes=0,cut=false;const limit=Symbol('budget');
 const search=(remaining,ply)=>{
  if(++nodes>maxNodes)throw limit;
  if(!remaining){
   if(game.isCheckmate())return (game.turn()===side?-1:1)*(C.terminalValue-ply);
   if(game.isDraw())return 0;
   return leafValue(game,side,viewAt(game),caps,seed,game.fen());
  }
  const nodeKey=game.fen(),nodeFacts=factsAt(game),nodeView=viewAt(game);
  // Mate is known only when this reply node has actually been visited.
  if(!nodeFacts.legal.length)return game.isCheck()?(game.turn()===side?-1:1)*(C.terminalValue-ply):0;
  if(game.isDraw())return 0;
  // Alternatives receive less attention further along an imagined line; avoid width^depth explosion.
  const movingSide=game.turn();
  const replies=candidateIdeas(game,nodeFacts,nodeView,caps,side,seed,nodeKey,lastMoves[movingSide]).map(candidate=>{
   if(++nodes>maxNodes)throw limit;
   const perceived=withMove(candidate.move,()=>leafValue(game,movingSide,viewAt(game),caps,seed,game.fen()));
   return {...candidate,priority:perceived+candidate.naturalness*.15};
  }).sort((a,b)=>b.priority-a.priority||uci(a.move).localeCompare(uci(b.move))).slice(0,Math.max(1,Math.ceil(width/ply)));
  if(!replies.length)return leafValue(game,side,nodeView,caps,seed,nodeKey);
  const scores=replies.map(candidate=>withMove(candidate.move,()=>search(remaining-1,ply+1)));
  return game.turn()===side?Math.max(...scores):Math.min(...scores);
 };
 const rootLimit=Math.min(ideas.length,Math.ceil(C.rootBase+C.rootWidth*caps.calculationWidth),C.searchRootMax);
 let scored=ideas.map(c=>withMove(c.move,()=>({...c,perceivedValue:leafValue(game,side,viewAt(game),caps,seed,game.fen())})))
  .sort((a,b)=>(b.perceivedValue+b.naturalness*.15)-(a.perceivedValue+a.naturalness*.15)||uci(a.move).localeCompare(uci(b.move))).slice(0,rootLimit),completedDepth=0;
 const searchIdeas=scored;
 for(let level=1;level<=depth;level++){
  try{
   const next=searchIdeas.map(c=>withMove(c.move,()=>({...c,perceivedValue:search(level,1)})));
   scored=next;completedDepth=level;
  }catch(error){if(error!==limit)throw error;cut=true;break;}
 }
 const temperature=C.temperature.high+(C.temperature.low-C.temperature.high)*(1-caps.evaluationAccuracy);
 const styleAdjustments=scored.map(c=>profileAdjustment(game,c,profile,C.profileStrength));
 const utilities=scored.map((c,index)=>c.perceivedValue+c.naturalness*.15+styleAdjustments[index]),best=Math.max(...utilities);
 const weights=utilities.map(u=>Math.exp((u-best)/(temperature*(1+C.temperature.load*view.load)))),total=weights.reduce((a,b)=>a+b,0);
 let ticket=random(seed,key+':selection')*total;const selected=scored.find((c,i)=>(ticket-=weights[i])<0)||scored.at(-1);
 return {move:uci(selected.move),trace:{version:C.version,elo:caps.elo,profile,requestedDepth,depth,completedDepth,width,nodes,cut,complexity:facts.complexity,load:view.load,tactics:view.tactics,position:view.position,opening:view.opening,generatedCandidates:ideas.length,rootCandidates:scored.length,searchRoot:searchIdeas.length,
  noticed:view.noticed.map(t=>t.id),missed:view.missed.map(t=>t.id),oversight:view.oversight,
  candidates:scored.map((c,index)=>({move:uci(c.move),reasons:c.reasons,perceivedValue:c.perceivedValue,naturalness:c.naturalness,styleAdjustment:styleAdjustments[index]}))}};
};
