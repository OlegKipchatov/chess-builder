import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMateExercise,createMateExercise} from '../dist/analysis/analysis-training.js';
import {explanationFor} from '../dist/analysis/analysis-explanations.js';
const fen='7k/8/5K2/8/8/8/8/3Q4 w - - 0 1';
const fakeClient = rows => () => {
 const client={terminate:()=>{},postMessage:data=>queueMicrotask(()=>client.onmessage({data:{...data,lines:[rows.shift()]}}))};return client;
};
for(const mateIn of [3,4])test(`Mate in ${mateIn}: arbitrary legal alternatives, best defence, wrong and uncertain attempts`,async()=>{
 const data=await prepareMateExercise({fenBefore:fen,shortMate:{verified:true,moves:mateIn}});
 assert.equal(data.type,'engine');assert.equal(data.mateIn,mateIn);
 const exercise=createMateExercise(data,{createClient:fakeClient([{move:'h8h7',scoreType:'mate',scoreValue:-(mateIn-1)},{move:'h7h8',scoreType:'cp',scoreValue:-800},{move:'h7h8',scoreType:'mate',scoreValue:-6}])});
 const pending=exercise.submit('d1d2');assert.equal(exercise.getSnapshot().state,'checking');assert.equal((await pending).state,'correct');
 assert.equal(exercise.continue().state,'opponent');assert.equal(exercise.game.turn(),'w');exercise.continue();
 const before=exercise.game.fen();assert.equal((await exercise.submit('d2d1')).state,'unverified');assert.equal(exercise.continue().fen,before);
 assert.equal((await exercise.submit('d2d1')).state,'wrong');assert.equal(exercise.continue().fen,before);exercise.dispose();
 assert.match(explanationFor({reason:'missed_mate',shortMate:{verified:true,moves:mateIn}}),mateIn===3?/три хода/:/четыре хода/);
});
test('Leaving a long-mate task cancels its pending worker and ignores late replies',async()=>{
 let terminated=false;
 const exercise=createMateExercise({type:'engine',fen,mateIn:4},{createClient:()=>({postMessage:()=>{},terminate:()=>{terminated=true;}})});
 const pending=exercise.submit('d1d2');exercise.dispose();await pending;assert.equal(terminated,true);
});
