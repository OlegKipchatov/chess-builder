export const isImportantInsight = move => move?.actor==='player'&&move.status==='complete'&&!move.forced&&(
 ['inaccuracy','mistake','blunder'].includes(move.quality)||move.highlight==='excellent'||['mate_opportunity','missed_mate','allowed_mate'].includes(move.reason)
);
export const eventFor = move => {
 if(move.status!=='complete'||move.forced)return {primaryEvent:null,eventPriority:0,autoPause:false};
 const primaryEvent=['allowed_mate','missed_mate','mate_opportunity'].includes(move.reason)?move.reason:move.highlight||move.quality;
 const eventPriority=({allowed_mate:100,missed_mate:95,mate_opportunity:60,blunder:90,mistake:70,excellent:60,inaccuracy:40,best:10,good:0})[primaryEvent];
 return {primaryEvent,eventPriority,autoPause:false};
};
export const selectEvents = moves => {
 moves.forEach(move=>Object.assign(move,eventFor(move)));
 // A visible useful card and an autoplay stop share exactly the same predicate.
 const selected=moves.filter(isImportantInsight);
 selected.forEach(move=>move.autoPause=true);
 return selected.map(move=>move.ply).sort((a,b)=>a-b);
};
