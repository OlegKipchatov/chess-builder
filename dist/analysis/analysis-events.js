export const isImportantInsight = move => !move?.repeatedOpportunity&&move?.actor==='player'&&move.status==='complete'&&!move.forced&&(
 ['inaccuracy','mistake','blunder'].includes(move.quality)||move.highlight==='excellent'||['mate_opportunity','missed_mate','allowed_mate'].includes(move.reason)
);
export const eventFor = move => {
 if(move.status!=='complete'||move.forced)return {primaryEvent:null,eventPriority:0,autoPause:false};
 const primaryEvent=['allowed_mate','missed_mate','mate_opportunity'].includes(move.reason)?move.reason:move.highlight||move.quality;
 const eventPriority=({allowed_mate:100,missed_mate:95,mate_opportunity:60,blunder:90,mistake:70,excellent:60,inaccuracy:40,best:10,good:0})[primaryEvent];
 return {primaryEvent,eventPriority,autoPause:false};
};
export const selectEvents = moves => {
 let previous=null;
 moves.forEach(move=>{
  delete move.repeatedOpportunity;
  if(move.actor!=='player')return;
  const opportunity=['mate_opportunity','missed_mate'].includes(move.reason)&&move.shortMate?.verified;
  const solutions=move.exercise?.solutions?.map(row=>row.move)||[];
  // Require a shared verified solution in consecutive player decisions, not just a mate label.
  if(opportunity&&previous&&solutions.some(token=>previous.solutions.includes(token))&&move.shortMate.moves===previous.distance&&move.quality!=='blunder'&&move.quality!=='mistake')move.repeatedOpportunity=true;
  previous=opportunity?{solutions,distance:move.shortMate.moves}:null;
 });
 moves.forEach(move=>Object.assign(move,eventFor(move)));
 // A visible useful card and an autoplay stop share exactly the same predicate.
 const selected=moves.filter(isImportantInsight);
 selected.forEach(move=>move.autoPause=true);
 return selected.map(move=>move.ply).sort((a,b)=>a-b);
};
