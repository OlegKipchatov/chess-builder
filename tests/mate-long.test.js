import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMateExercise,createMateExercise} from '../src/services/analysis/analysis-training.ts';
import {explanationFor} from '../src/domain/analysis/analysis-explanations.ts';
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
 assert.equal((await exercise.submit('d2d1')).state,'longer_mate');assert.equal(exercise.continue().fen,before);exercise.dispose();
 assert.match(explanationFor({reason:'missed_mate',shortMate:{verified:true,moves:mateIn}}),mateIn===3?/три хода/:/четыре хода/);
});
test('Leaving a long-mate task cancels its pending worker and ignores late replies',async()=>{
 let terminated=false;
 const exercise=createMateExercise({type:'engine',fen,mateIn:4},{createClient:()=>({postMessage:()=>{},terminate:()=>{terminated=true;}})});
 const pending=exercise.submit('d1d2');exercise.dispose();await pending;assert.equal(terminated,true);
});

test('Hint failures are visible, retryable, and do not cost an attempt; remaining moves track accepted plies',async()=>{
 const attempts=new Map([[fen.split(' ').slice(0,4).join(' '),5]]);
 const exercise=createMateExercise({type:'engine',fen,mateIn:3},{attempts,createClient:fakeClient([
  {move:'d1d2',scoreType:'cp',scoreValue:900},
  {move:'d1d2',scoreType:'mate',scoreValue:3},
  {move:'h8h7',scoreType:'mate',scoreValue:-2}
 ])});
 assert.equal(await exercise.getHint(),null);assert.equal(exercise.getSnapshot().hintUnavailable,true);
 assert.equal(exercise.getSnapshot().failedAttempts,5);
 assert.equal(await exercise.getHint(),'d1d2');assert.equal(exercise.getSnapshot().hintUnavailable,false);
 await exercise.submit('d1d2');assert.equal(exercise.getSnapshot().remainingMoves,2);
 exercise.continue();exercise.continue();assert.equal(exercise.getSnapshot().remainingMoves,2);exercise.dispose();
});
test('A failed hint worker is released and the next request starts a new worker',async()=>{
 let created=0,terminated=0;
 const attempts=new Map([[fen.split(' ').slice(0,4).join(' '),5]]);
 const exercise=createMateExercise({type:'engine',fen,mateIn:3},{attempts,createClient:()=>{
  const index=++created;
  const client={terminate:()=>terminated++,postMessage:data=>queueMicrotask(()=>{
   if(index===1)client.onerror(new Error('Worker failed'));
   else client.onmessage({data:{...data,lines:[{move:'d1d2',scoreType:'mate',scoreValue:3}]}});
  })};return client;
 }});
 assert.equal(await exercise.getHint(),null);assert.equal(terminated,1);
 assert.equal(await exercise.getHint(),'d1d2');assert.equal(created,2);exercise.dispose();
});
