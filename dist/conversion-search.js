import {CONFIG as C} from './cognitive-config.js?v=35';
import {CONVERSION as V} from './conversion-config.js?v=35';
import {random,clamp} from './cognitive-model.js?v=35';
import {profileAdjustment} from './cognitive-profile.js?v=35';
import {conversionFeatures,conversionSignature,conversionValue} from './conversion-model.js?v=35';
import {conversionHistory,positionKey,advanceProgress,stagnationPenalty} from './conversion-history.js?v=35';
import {conversionMoves,withConversionMove,halfmoveClock} from './conversion-board.js?v=35';

const compare = (a,b) => b.order-a.order||(a.move.uci<b.move.uci?-1:a.move.uci>b.move.uci?1:0);
export const conversionRootPool = candidates => {
 const ordered=[...candidates].sort(compare),pool=[];
 const add = list => {for(const item of list)if(pool.length<V.rootCap&&!pool.includes(item))pool.push(item);};
 add(ordered.filter(c=>!c.check).sort((a,b)=>Number(b.delta>0)-Number(a.delta>0)||compare(a,b)).slice(0,3));
 add(ordered.filter(c=>c.kingApproach&&!pool.includes(c)).slice(0,2));
 add(ordered.filter(c=>c.delta>0&&!pool.includes(c)).slice(0,Math.max(0,4-pool.filter(c=>c.delta>0).length)));
 add(ordered.filter(c=>c.check&&(c.delta>0||c.mobilityReduced)&&!pool.includes(c)).slice(0,2));
 add(ordered);
 return pool.sort(compare);
};

export const decideConversion = ({game,caps,seed,profile,maxNodes=Infinity,maxDepth=Infinity}) => {
 const side=game.turn(),rootFen=game.fen(),mode=conversionSignature(game,side);
 const history=conversionHistory(game,side,game.history().length?game.pgn():null),counts=history.counts;
 const featuresCache=new Map(),movesCache=new Map();
 const features = () => {
  const key=positionKey(game);let value=featuresCache.get(key);
  if(!value){value=conversionFeatures(game,side);featuresCache.set(key,value);}return value;
 };
 const legal = () => {
  const key=positionKey(game);let value=movesCache.get(key);
  if(!value){value=conversionMoves(game);movesCache.set(key,value);}return value;
 };
 const play = (move,run) => withConversionMove(game,move,()=>{
  const key=positionKey(game),previous=counts.get(key)||0;counts.set(key,previous+1);
  try{return run();}finally{if(previous)counts.set(key,previous);else counts.delete(key);}
 });
 const occurrence = () => counts.get(positionKey(game))||1;
 const terminal = (moves,ply) => {
  if(!moves.length)return game.isCheck()?(game.turn()===side?-1:1)*(C.terminalValue-ply):0;
  if(halfmoveClock(game)>=100||occurrence()>=3||game.isInsufficientMaterial())return 0;
  return null;
 };
 const nextState = state => advanceProgress(state,features().progress,conversionSignature(game,side).signature);
 const evaluate = (state,repeat) => conversionValue(game,side,caps,features())-stagnationPenalty(state,halfmoveClock(game))-repeat;
 const before=features();
 let safetyEvaluations=0,searchNodes=0,orderingEvaluations=0,cut=false,completedDepth=0;
 const candidates=legal().map(move=>play(move,()=>{
  safetyEvaluations++;
  const replies=legal(),end=terminal(replies,1),after=features(),state=nextState(history.state),repeat=occurrence()===2?V.repeatPenalty:0;
  const delta=after.progress-before.progress,check=game.isCheck(),mate=end!==null&&end>90000;
  let unsafe=end===0;
  if(end===null)for(const reply of replies){
   const danger=play(reply,()=>{
    safetyEvaluations++;
    const result=terminal(legal(),2);
    return result===0||!conversionSignature(game,side).active;
   });
   if(danger)unsafe=true;
  }
  const value=end??evaluate(state,repeat),usefulCheck=check&&(delta>0||after.mobilityCount<before.mobilityCount);
  return {move,check,mate,unsafe,delta,state,repeat,value,progressAfter:after.progress,
   kingApproach:move.piece==='k'&&after.kingProximity>before.kingProximity,
   mobilityReduced:after.mobilityCount<before.mobilityCount,
   order:value+V.orderingWeight*delta+(usefulCheck?3:0),
   reasons:[mate?'mate':move.piece==='k'?'king-approach':!check&&delta>0?'quiet-confinement':usefulCheck?'useful-check':'technical-manoeuvre']};
 }));
 const immediate=candidates.find(c=>c.mate);
 const rescue=history.state.stagnantMoves>=V.rescueAfter||halfmoveClock(game)>=70;
 const depth=Math.min(rescue?V.rescueDepth:V.depth,maxDepth),budget=Math.min(rescue?V.rescueNodes:V.maxNodes,maxNodes);
 const baseTrace = () => ({version:C.version,behaviorVersion:'2.1.0',conversionConfig:V.version,conversionMode:true,conversionKind:mode.kind,elo:caps.elo,profile,strongSide:side,
  historyComplete:history.complete,progressBefore:before.progress,features:before,rescue,depth,completedDepth,searchNodes,orderingEvaluations,nodes:searchNodes+orderingEvaluations,safetyEvaluations,cut,generatedCandidates:candidates.length});
 if(immediate)return {move:immediate.move.uci,trace:{...baseTrace(),immediateMate:true,rootCandidates:1,candidates:[{move:immediate.move.uci,reasons:['mate'],perceivedValue:immediate.value}]}};
 const safe=candidates.filter(c=>!c.unsafe),roots=conversionRootPool(safe.length?safe:candidates);
 let scored=roots.map(c=>({...c,perceivedValue:c.value}));
 const limit=Symbol('conversion budget');
 const spend = ordering => {
  if(searchNodes+orderingEvaluations>=budget)throw limit;
  if(ordering)orderingEvaluations++;else searchNodes++;
 };
 const search = (remaining,ply,state,repeat,alpha,beta) => {
  spend(false);
  const moves=legal(),end=terminal(moves,ply);if(end!==null)return end;
  const repetition=Math.max(repeat,occurrence()===2?V.repeatPenalty:0);
  if(remaining===0)return evaluate(state,repetition);
  const maximizing=game.turn()===side;
  // No perception/beam pruning of the defending king. All legal defenses count.
  let replies=moves;
  if(maximizing){
   const scoredMoves=moves.map(move=>play(move,()=>{
    spend(true);const result=terminal(legal(),ply+1);
    return {move,order:result??evaluate(nextState(state),Math.max(repetition,occurrence()===2?V.repeatPenalty:0))};
   })).sort(compare);
   replies=scoredMoves.slice(0,V.beam).map(c=>c.move);
  }
  let best=maximizing?-Infinity:Infinity;
  for(const move of replies){
   const score=play(move,()=>search(remaining-1,ply+1,maximizing?nextState(state):state,repetition,alpha,beta));
   best=maximizing?Math.max(best,score):Math.min(best,score);
   if(maximizing)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);
   if(beta<=alpha)break;
  }
  return best;
 };
 for(let level=1;level<=depth;level++){
  try{
   const next=roots.map(c=>play(c.move,()=>({...c,perceivedValue:search(level-1,1,c.state,c.repeat,-Infinity,Infinity)})));
   scored=next;completedDepth=level;
  }catch(error){if(error!==limit)throw error;cut=true;break;}
 }
 const mate=scored.filter(c=>c.perceivedValue>90000).sort((a,b)=>b.perceivedValue-a.perceivedValue||compare(a,b))[0];
 const urgency=clamp((halfmoveClock(game)-60)/40,0,1),temperature=(C.temperature.high+(C.temperature.low-C.temperature.high)*(1-caps.evaluationAccuracy))*V.temperatureScale*(1-.35*urgency);
 const maxLoss=Math.max(4,20*(1-.5*caps.conversionSkill)*(1-.5*urgency)/(1+.15*history.state.stagnantMoves));
 const best=Math.max(...scored.map(c=>c.perceivedValue));
 const selectable=scored.filter(c=>c.perceivedValue>=best-maxLoss).map(c=>({...c,styleAdjustment:clamp(profileAdjustment(game,{move:c.move},profile,C.profileStrength)*V.styleScale,-V.styleCap,V.styleCap)}));
 const top=Math.max(...selectable.map(c=>c.perceivedValue+c.styleAdjustment));
 const weights=selectable.map(c=>Math.exp((c.perceivedValue+c.styleAdjustment-top)/temperature));
 let ticket=random(seed,rootFen+':conversion-selection-v1')*weights.reduce((a,b)=>a+b,0);
 const urgent=history.state.stagnantMoves>=3||urgency>.5;
 const chosen=mate||(urgent?[...selectable].sort((a,b)=>b.perceivedValue-a.perceivedValue||compare(a,b))[0]:selectable.find((c,i)=>(ticket-=weights[i])<0))||selectable.at(-1);
 return {move:chosen.move.uci,trace:{...baseTrace(),immediateMate:false,provenMate:!!mate,noImmediateLossFound:!!safe.length,
  rootCandidates:roots.length,searchRoot:roots.length,progressAfter:chosen.progressAfter,stagnantMoves:history.state.stagnantMoves,temperature,
  fallbackReason:completedDepth===0?'static-budget-fallback':null,
  candidates:scored.map(c=>({move:c.move.uci,reasons:c.reasons,perceivedValue:c.perceivedValue,progressDelta:c.delta,isCheck:c.check,unsafe:c.unsafe}))}};
};
