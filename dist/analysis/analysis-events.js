import {PROFILE} from './analysis-config.js?v=71';
export const eventFor = move => {
 if(move.status!=='complete'||move.forced)return {primaryEvent:null,eventPriority:0,autoPause:false};
 const primaryEvent=['allowed_mate','missed_mate'].includes(move.reason)?move.reason:move.highlight||move.quality;
 const eventPriority=({allowed_mate:100,missed_mate:95,blunder:90,mistake:70,excellent:60,inaccuracy:40,best:10,good:0})[primaryEvent];
 return {primaryEvent,eventPriority,autoPause:false};
};
export const selectEvents = moves => {
 moves.forEach(move=>Object.assign(move,eventFor(move)));
 const ranked=moves.filter(move=>move.eventPriority>=60).sort((a,b)=>b.eventPriority-a.eventPriority||(b.expectedScoreLoss||0)-(a.expectedScoreLoss||0)||a.ply-b.ply);
 // Severe events take precedence. Positive moments occupy spare slots, never displace mate events.
 let positive=0;
 const selected=ranked.filter(move=>move.highlight!=='excellent'||++positive<=PROFILE.maxPositive).slice(0,PROFILE.maxEvents);
 selected.forEach(move=>move.autoPause=true);
 return selected.map(move=>move.ply).sort((a,b)=>a-b);
};
