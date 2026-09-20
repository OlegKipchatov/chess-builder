// Reference analysis only; these objective scores never enter Cognitive v2.
export const normalizeScore = (type,value,rootSide,botSide) => {
 const sign=rootSide===botSide?1:-1;
 if(type==='cp')return sign*Math.max(-100,Math.min(100,value/100));
 if(type!=='mate')throw Error('Unknown score type');
 return sign*(value>0?1:-1)*(1000-Math.min(Math.abs(value),100));
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
export const prepareCandidates = (game,rows) => {
 const legal=new Set(game.moves({verbose:true}).map(move=>move.from+move.to+(move.promotion||'')));
 const candidates=rows.filter(row=>legal.has(row.move)).map(row=>({move:row.move,evaluation:normalizeScore(row.scoreType,row.scoreValue,game.turn(),game.turn()),mate:row.scoreType==='mate'?row.scoreValue:null,depth:row.depth}));
 const best=Math.max(...candidates.map(candidate=>candidate.evaluation));
 return {candidates:candidates.map(candidate=>({...candidate,evaluationLoss:Math.max(0,best-candidate.evaluation)}))};
};
