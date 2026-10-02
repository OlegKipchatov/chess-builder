// Frozen launch parameters; calibration requires a new reward version.
export const REWARD_CONFIG = Object.freeze({version:'game-economy-v2',completion:5,win:18,draw:10,loss:5,qualityMax:10,minResignMoves:10,lambda:8,priorWeight:4,prior:.5});
export const ECONOMY_PROFILE = Object.freeze({version:'economy-sf19-v1',nodes:50000,hashMb:16});
export {expectedScore} from './stockfish-evaluation.js?v=92';
export const classifyDecision = loss => loss<=.005?'best':loss<=.025?'good':loss<=.060?'inaccuracy':loss<=.150?'mistake':'blunder';
export const summarizeQuality = decisions => {
 const rows=decisions.filter(row=>!row.forced),n=rows.length;
 const counts={best:0,good:0,inaccuracy:0,mistake:0,blunder:0};
 if(!n)return {status:'complete',total:0,accuracy:0,stability:0,best:0,counts,eligibleMoves:0,profile:ECONOMY_PROFILE.version};
 let quality=0,error=0;
 for(const row of rows){
  if(!Number.isFinite(row.loss)||row.loss<0||row.loss>1)throw Error('Invalid quality loss');
  const kind=classifyDecision(row.loss);counts[kind]++;
  quality+=Math.exp(-REWARD_CONFIG.lambda*row.loss);
  error+=({best:0,good:0,inaccuracy:.25,mistake:.6,blunder:1})[kind];
 }
 // No invented population percentiles: the launch window is explicitly [0,1].
 const a=(quality+REWARD_CONFIG.priorWeight*REWARD_CONFIG.prior)/(n+REWARD_CONFIG.priorWeight);
 const values=[5*a,3*(1-error/n),2*counts.best/n];
 const total=Math.round(values.reduce((a,b)=>a+b,0)),parts=values.map(Math.floor);
 const order=values.map((value,index)=>({index,fraction:value-parts[index]})).sort((a,b)=>b.fraction-a.fraction);
 const remainder=total-parts.reduce((a,b)=>a+b,0);
 for(let i=0;i<remainder;i++)parts[order[i].index]++;
 return {status:'complete',total,accuracy:parts[0],stability:parts[1],best:parts[2],counts,eligibleMoves:n,profile:ECONOMY_PROFILE.version};
};
export const applyQualityReward = (state,id,quality) => {
 const entry=state.archive.find(entry=>entry.id===id);
 if(!['pending','unavailable'].includes(entry?.rewardBreakdown?.qualityStatus))return state;
 const valid=quality?.status==='complete'&&Number.isSafeInteger(quality.total)&&quality.total>=0&&quality.total<=10;
 const bonus=valid?quality.total:5;
 const rewardBreakdown={...entry.rewardBreakdown,quality:bonus,qualityStatus:valid?'complete':'fallback',qualityDetails:valid?quality:null,qualityDiagnostics:quality?.diagnostics?.slice(-9)||[],total:entry.rewardBreakdown.total+bonus};
 return {...state,coins:state.coins+bonus,archive:state.archive.map(row=>row.id===id?{...row,rewardBreakdown}:row)};
};
