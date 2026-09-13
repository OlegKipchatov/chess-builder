/** @typedef {{move:string,evaluation:number,evaluationLoss:number,mate:number|null,depth:number,guardWeight:number}} EvaluatedCandidate */
import {Chess} from './chess.js?v=17';
import {DIFFICULTY as C} from './difficulty-config.js?v=17';
import {clamp} from './difficulty-model.js?v=17';
/** UCI scores are relative to the ROOT side to move. At a bot turn rootSide === botSide, including Black. */
export const normalizeScore = (type,value,rootSide,botSide,config=C) => {
  const sign=rootSide===botSide?1:-1;
  if(type==='cp')return sign*clamp(value/100,-config.mate.cpBound,config.mate.cpBound);
  if(type!=='mate')throw Error('Unknown score type');
  return sign*(value>0?1:-1)*(config.mate.base-Math.min(Math.abs(value),config.mate.maxDistance)*config.mate.distance);
};
export const parseInfo = line => {
  if(!line.startsWith('info ')||/\b(lowerbound|upperbound)\b/.test(line))return null;
  const depth=line.match(/\bdepth (\d+)/),pv=line.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?)(?:\s|$)/),score=line.match(/\bscore (cp|mate) (-?\d+)/),index=line.match(/\bmultipv (\d+)/);
  if(!depth||!pv||!score)return null;
  return {depth:Number(depth[1]),index:Number(index?.[1]||1),move:pv[1],scoreType:score[1],scoreValue:Number(score[2])};
};
export const completeCandidates = (lines,expected) => {
  const batches=new Map();let complete=[];
  for(const row of lines){
    if(row.index===1||!batches.has(row.depth))batches.set(row.depth,new Map());
    const batch=batches.get(row.depth);batch.set(row.index,row);
    if(row.index===expected&&batch.size===expected&&new Set([...batch.values()].map(item=>item.move)).size===expected&&(!complete.length||row.depth>=complete[0].depth))complete=[...batch.values()];
  }
  return complete;
};
export const uciMove = move => move.from+move.to+(move.promotion||'');
export const prepareCandidates = (game,rows,config=C) => {
  const legal=game.moves({verbose:true}),byUci=new Map(legal.map(m=>[uciMove(m),m]));
  const candidates=rows.filter(row=>byUci.has(row.move)).map(row=>({move:row.move,evaluation:normalizeScore(row.scoreType,row.scoreValue,game.turn(),game.turn(),config),mate:row.scoreType==='mate'?row.scoreValue:null,depth:row.depth}));
  if(!candidates.length)return {candidates:[],context:{}};
  const best=Math.max(...candidates.map(c=>c.evaluation));
  for(const candidate of candidates){
    candidate.evaluationLoss=Math.max(0,best-candidate.evaluation);candidate.guardWeight=1;
    const move=byUci.get(candidate.move);
    if(candidate.evaluationLoss>=config.guard.lossThreshold&&config.pieceValue[move.piece]>=config.guard.majorValue){
      const after=new Chess(game.fen());after.move(move);const hanging=after.moves({verbose:true}).some(reply=>reply.to===move.to&&reply.captured);
      if(hanging&&!move.captured&&!move.san.includes('+')&&!move.san.includes('#'))candidate.guardWeight=config.guard.weight;
    }
  }
  const material=game.board().flat().filter(Boolean).reduce((sum,p)=>sum+config.pieceValue[p.type],0),ply=(Number(game.fen().split(' ')[5])-1)*2+(game.turn()==='b'?1:0);
  const phase=material<=config.phase.endgameMaterial?'endgame':ply<config.phase.openingPlies?'opening':'middlegame';
  const t=config.complexity;
  const complexity=clamp(1+(legal.length>=t.manyMoves?t.manyBonus:0)+(candidates.filter(c=>c.evaluationLoss<t.equalLoss).length>=t.equalCount?t.equalBonus:0)+(legal.filter(m=>m.captured||/[+#]/.test(m.san)).length>=t.tactics?t.tacticalBonus:0)-(legal.length<=t.forcedMoves?t.forcedDiscount:0),t.min,t.max);
  return {candidates,context:{phase,complexity,bestEvaluation:best,inCheck:game.isCheck(),legalCount:legal.length}};
};
