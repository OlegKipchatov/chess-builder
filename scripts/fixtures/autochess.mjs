import {createAutoRun,restoreAutoRun,setupFen} from '../../src/domain/autochess/autochess.ts';
// A valid saved series, six legal plies from a permitted initial placement.
// The next turn has mate in one. Validate the fixture through the real loader.
export const savedMateRun=(id)=>{
 const run=createAutoRun(id);run.color='w';run.level=6;run.round=13;run.purchases=1;run.nextId=2;run.reserve=3;
 run.results=Array.from({length:12},(_,i)=>({outcome:'draw',incomeRule:2,shopLevel:1,battleId:id+':'+(i+1)}));
 run.army=[{id:'king',type:'k',square:'g4'},{id:'piece-1',type:'q',square:'f4',paid:1}];
 run.opponent=[{id:'king',type:'k',square:'g8',paid:0}];
 run.opponentProgress={strategy:1,reserve:3,purchases:0,level:1,sales:0,income:0,openingBalance:3};
 run.phase='paused';run.battle={id:id+':13',initialFen:setupFen(run),moves:['g4g5','g8h8','g5g6','h8g8','f4f7','g8h8'],elapsed:1200,profile:'stockfish19',result:null};
 return restoreAutoRun(JSON.stringify(run));
};
