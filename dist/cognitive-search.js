import {Chess} from './chess.js?v=23';
import {CONFIG} from './cognitive-config.js?v=23';
import {capabilitiesFor,factsFor,perceive,positionSeed,random,clamp} from './cognitive-model.js?v=23';
import {profileAdjustment} from './cognitive-profile.js?v=23';

const value=CONFIG.pieceValue,files='abcdefgh';
const uci = move => move.from+move.to+(move.promotion||'');
const center = square => 7-Math.abs(files.indexOf(square[0])-3.5)-Math.abs(Number(square[1])-4.5);
const homeRank = color => color==='w'?'1':'8';
const promotionValue = move => move.promotion?value[move.promotion]-value.p:0;

const positionalValue = (piece,caps) => {
  const square=piece.square,rank=Number(square[1]),progress=piece.color==='w'?rank-2:7-rank;
  let score=0;
  if(['n','b'].includes(piece.type))score+=center(square)*5*caps.positionalAwareness;
  if(piece.type==='p')score+=progress*(4+caps.conversionSkill*7)+Math.max(0,center(square))*caps.positionalAwareness*2;
  if(piece.type==='k')score-=Math.max(0,center(square))*8*(1-caps.positionalAwareness*.5);
  return score;
};

export const leafValue = (game,rootSide,view,caps,seed,key) => {
  if(game.isCheckmate())return game.turn()===rootSide?-100000:100000;
  if(game.isDraw())return 0;
  let score=0,bishops={w:0,b:0};
  for(const piece of game.board().flat().filter(Boolean)){
    const sign=piece.color===rootSide?1:-1;
    score+=sign*(value[piece.type]+positionalValue(piece,caps));
    if(piece.type==='b')bishops[piece.color]++;
  }
  score+=(bishops[rootSide]>=2?CONFIG.evaluation.bishopPair:0)-(bishops[rootSide==='w'?'b':'w']>=2?CONFIG.evaluation.bishopPair:0);
  const accuracy=caps.evaluationAccuracy,noise=CONFIG.evaluation.noiseAt1400+(CONFIG.evaluation.noiseAt100-CONFIG.evaluation.noiseAt1400)*(1-accuracy);
  return score+(random(seed,`${key}:eval`)*2-1)*noise*(1+view.load*.75)+(game.turn()===rootSide?CONFIG.evaluation.tempo:-CONFIG.evaluation.tempo);
};

const moveReasons = (game,move,view,caps) => {
  const reasons=[],ownThreat=view.noticed.find(threat=>threat.color===game.turn()&&threat.square===move.from);
  if(game.isCheck())reasons.push('escape-check');
  if(move.captured)reasons.push('capture');
  if(/[+#]/.test(move.san))reasons.push(move.san.includes('#')?'mate':'check');
  if(move.flags.includes('k')||move.flags.includes('q'))reasons.push('castle');
  if(ownThreat)reasons.push('save-threatened-piece');
  if(['n','b'].includes(move.piece)&&move.from[1]===homeRank(move.color))reasons.push('develop');
  if(move.piece==='p'&&['d','e'].includes(move.to[0]))reasons.push('center');
  if(move.piece==='p'){
    const direction=move.color==='w'?1:-1,rank=Number(move.to[1])+direction,file=files.indexOf(move.to[0]);
    for(const next of [file-1,file+1])if(next>=0&&next<8){const target=game.get(files[next]+rank);if(target&&target.color!==move.color&&target.type==='p'&&['d','e'].includes(files[next]))reasons.push('challenge-center');}
  }
  if(move.piece!=='p'&&center(move.to)>center(move.from)+.5&&caps.positionalAwareness>.05)reasons.push('improve');
  if(move.promotion)reasons.push('promote');
  return reasons;
};

const naturalnessFor = (game,move,reasons,caps,pgn='') => {
  let score=12+reasons.length*18+(move.captured?Math.max(0,value[move.captured]-value[move.piece]*.18):0)+promotionValue(move);
  if(reasons.includes('mate'))score+=3000;
  else if(reasons.includes('check'))score+=120*caps.tacticalAwareness;
  if(reasons.includes('develop')||reasons.includes('center')||reasons.includes('castle'))score+=55*caps.openingDiscipline;
  if(reasons.includes('challenge-center'))score+=48*(.45+caps.positionalAwareness);
  if(reasons.includes('save-threatened-piece'))score+=70*caps.threatAwareness;
  const opening=Number(game.fen().split(' ')[5])<=8;
  if(opening){
    if(move.piece==='p'&&['d','e'].includes(move.from[0]))score+=(Math.abs(Number(move.to[1])-Number(move.from[1]))===2?28:14)*caps.openingDiscipline;
    if(move.piece==='p'&&['f','g','h'].includes(move.from[0]))score-=42*caps.openingDiscipline;
    if(move.piece==='n'&&['a','h'].includes(move.to[0]))score-=32*caps.openingDiscipline;
    if(move.piece==='q')score-=38*caps.openingDiscipline;
  }
  const history=(pgn.match(new RegExp(`\\b${move.from.replace(/[1-8]/,'')}[^ ]*`,'g'))||[]).length;
  if(history>1&&!move.captured&&!reasons.includes('save-threatened-piece'))score-=18*(1-caps.openingDiscipline);
  return score+center(move.to)*caps.positionalAwareness*3;
};

const surfaceRisk = (game,move,caps) => {
  game.move(move);
  try{
    if(game.isCheckmate())return 0;
    const moved=game.get(move.to),captures=game.moves({verbose:true}).filter(reply=>reply.to===move.to&&reply.captured),defended=game.attackers(move.to,move.color).length>0;
    if(!moved||!captures.length)return 0;
    return Math.max(...captures.map(reply=>Math.max(0,value[moved.type]-value[reply.piece]*(defended?1:.35))))*caps.threatAwareness;
  } finally {game.undo();}
};

export const candidateIdeas = (game,facts,view,caps,rootSide,seed,key,last=null,pgn='') => {
  const legal=game.moves({verbose:true});
  return legal.map(move=>{
    const reasons=moveReasons(game,move,view,caps),risk=surfaceRisk(game,move,caps),naturalness=naturalnessFor(game,move,reasons,caps,pgn)-risk;
    return {move,uci:uci(move),reasons,naturalness,risk,tie:random(seed,`${key}:idea:${uci(move)}`)};
  }).sort((a,b)=>b.naturalness-a.naturalness||a.tie-b.tie||a.uci.localeCompare(b.uci)).slice(0,CONFIG.rootIdeaLimit);
};

const replyIdeas = (game,caps,seed,key,rootSide,lastMove) => {
  const facts=factsFor(game),view=perceive(facts,caps,seed,key,caps.elo||1000),legal=game.moves({verbose:true});
  const tactical=legal.map(move=>{
    let salience=(move.captured?value[move.captured]/900:.05)+(move.san.includes('#')?3:move.san.includes('+')?.75:0);
    if(move.to===lastMove?.to&&move.captured)salience+=.7;
    const seen=random(seed,`${key}:reply:${uci(move)}`)<clamp(caps.tacticalAwareness+salience*.28-view.load*.18,.02,.999);
    return {move,seen,salience,naturalness:naturalnessFor(game,move,moveReasons(game,move,view,caps),caps,'')};
  });
  const visible=tactical.filter(row=>row.seen||game.isCheck()).sort((a,b)=>(b.salience*80+b.naturalness)-(a.salience*80+a.naturalness));
  const fallback=tactical.sort((a,b)=>b.naturalness-a.naturalness);
  const width=Math.max(1,Math.ceil(caps.calculationWidth));
  return (visible.length?visible:fallback).slice(0,width).map(row=>row.move);
};

const quiescence = (game,rootSide,caps,seed,key,view,depth,context) => {
  const stand=leafValue(game,rootSide,view,caps,seed,`${key}:stand`);
  if(depth<=0||game.isGameOver()||context.nodes>=context.maxNodes)return stand;
  const maximizing=game.turn()===rootSide;
  const tactical=game.moves({verbose:true}).filter(move=>move.captured||move.san.includes('#')).map(move=>({move,score:(move.san.includes('#')?100000:0)+(value[move.captured]||0)*10-value[move.piece]})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.ceil(caps.calculationWidth)));
  if(!tactical.length)return stand;
  let best=stand;
  for(const {move} of tactical){
    const token=uci(move);
    if(random(seed,`${key}:tactical:${token}`)>clamp(caps.tacticalAwareness+(move.san.includes('#')?.5:move.captured==='q'?.3:0),.02,1))continue;
    game.move(move);context.nodes++;
    let score;
    try{score=quiescence(game,rootSide,caps,seed,`${key}:${token}`,view,depth-1,context);}finally{game.undo();}
    best=maximizing?Math.max(best,score):Math.min(best,score);
    if(context.nodes>=context.maxNodes)break;
  }
  return best;
};

const evaluateCandidate = (game,candidate,rootSide,caps,seed,key,view,depth,context) => {
  game.move(candidate.move);context.nodes++;
  try{
    if(game.isGameOver()||depth<=0)return leafValue(game,rootSide,view,caps,seed,`${key}:${candidate.uci}`);
    const replies=replyIdeas(game,caps,seed,`${key}:${candidate.uci}`,rootSide,candidate.move);
    if(!replies.length)return leafValue(game,rootSide,view,caps,seed,`${key}:${candidate.uci}:none`);
    let worst=Infinity;
    for(const reply of replies){
      if(context.nodes>=context.maxNodes)break;
      game.move(reply);context.nodes++;
      try{
        const score=depth>1?quiescence(game,rootSide,caps,seed,`${key}:${candidate.uci}:${uci(reply)}`,view,2,context):leafValue(game,rootSide,view,caps,seed,`${key}:${candidate.uci}:${uci(reply)}`);
        worst=Math.min(worst,score);
      } finally {game.undo();}
    }
    return worst===Infinity?leafValue(game,rootSide,view,caps,seed,`${key}:${candidate.uci}:cut`):worst;
  } finally {game.undo();}
};

const weightedChoice = (items,weight,ticket) => {const weights=items.map(item=>Math.max(CONFIG.selection.minimumWeight,weight(item))),total=weights.reduce((a,b)=>a+b,0);let cursor=ticket*total;return items.find((_,index)=>(cursor-=weights[index])<=0)||items.at(-1);};

export const decide = ({fen,pgn='',elo=1000,seed=0,profile='default',maxNodes=CONFIG.maxNodes}={}) => {
  const game=new Chess(fen);
  if(game.isGameOver())return {move:null,trace:{nodes:0,completedDepth:0,rootCandidates:0,searchRoot:0}};
  const legal=game.moves({verbose:true});
  if(!legal.length)return {move:null,trace:{nodes:0,completedDepth:0,rootCandidates:0,searchRoot:0}};
  const rootSide=game.turn(),caps={...capabilitiesFor(elo),elo},facts=factsFor(game),key=game.fen(),view=perceive(facts,caps,positionSeed(seed,pgn||key),key,elo);
  const ideas=candidateIdeas(game,facts,view,caps,rootSide,seed,key,null,pgn);
  const fractional=caps.calculationDepth-Math.floor(caps.calculationDepth),abstractDepth=Math.floor(caps.calculationDepth)+(random(seed,`${key}:depth`)<fractional?1:0);
  const depth=Math.min(CONFIG.technicalDepthCap,Math.max(0,abstractDepth)),context={nodes:0,maxNodes},staticValues=new Map();
  for(const candidate of ideas){game.move(candidate.move);try{staticValues.set(candidate.uci,leafValue(game,rootSide,view,caps,seed,`${key}:${candidate.uci}:static`));}finally{game.undo();}}
  const searchRoot=[...ideas].sort((a,b)=>(staticValues.get(b.uci)+b.naturalness*.4)-(staticValues.get(a.uci)+a.naturalness*.4)).slice(0,CONFIG.searchRootLimit);
  const evaluated=ideas.map(candidate=>{
    const shouldSearch=searchRoot.includes(candidate)&&context.nodes<maxNodes,perceivedValue=shouldSearch?evaluateCandidate(game,candidate,rootSide,caps,seed,key,view,depth,context):staticValues.get(candidate.uci);
    const styleAdjustment=profileAdjustment(game,candidate,profile),naturalnessBonus=candidate.naturalness*(.22+(1-caps.evaluationAccuracy)*.18),forcingBonus=candidate.reasons.includes('check')?180*caps.tacticalAwareness:0;
    return {...candidate,perceivedValue:perceivedValue+styleAdjustment+naturalnessBonus+forcingBonus,styleAdjustment};
  });
  const temperature=CONFIG.selection.highTemperature+(CONFIG.selection.lowTemperature-CONFIG.selection.highTemperature)*(1-caps.evaluationAccuracy)**2*(1+view.load*.5);
  const best=Math.max(...evaluated.map(candidate=>candidate.perceivedValue));
  const chosen=weightedChoice(evaluated,candidate=>Math.exp((candidate.perceivedValue-best)/temperature),random(seed,`${key}:select:${profile}`));
  return {move:chosen.uci,trace:{elo,complexity:view.complexity,load:view.load,noticed:view.noticed.length,missed:view.missed.length,nodes:context.nodes,depth:abstractDepth,completedDepth:depth,rootCandidates:ideas.length,searchRoot:searchRoot.length,candidates:evaluated.map(candidate=>({move:candidate.uci,perceivedValue:candidate.perceivedValue,naturalness:candidate.naturalness,reasons:candidate.reasons,styleAdjustment:candidate.styleAdjustment})),selected:chosen.uci}};
};
