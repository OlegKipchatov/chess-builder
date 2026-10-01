import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {prepareMateExercise,createMateExercise} from '../dist/analysis/analysis-training.js';
import {createAnalysisPlayback} from '../dist/analysis/analysis-playback.js';
const pgn='1. Nc3 c6 2. Nf3 d5 3. d4 f6 4. Nxd5 cxd5 5. a4 e5 6. Nxe5 fxe5 7. Bf4 exf4 8. Kd2 g5 9. h4 Bg7 10. Rh3 Bxd4 11. Rh2 Bxb2 12. Ra2 Qb6 13. hxg5 h6 14. Rh4 Qb4+ 15. c3 Qxc3#';
const game=new Chess();game.loadPgn(pgn);
const fen=game.history({verbose:true})[25].before;
const prepared=await prepareMateExercise({fenBefore:fen,shortMate:{verified:true,moves:2}});
test('All verified mate solutions and alternative final mates are accepted',()=>{
 assert.ok(prepared.solutions.some(row=>row.move==='b6b4'));
 const branch=prepared.solutions.find(row=>row.move==='b6b4').replies.find(row=>row.move==='d2d3');
 assert.ok(branch.finishes.includes('b4c3'));assert.ok(branch.finishes.includes('b4d4'));
 for(const solution of prepared.solutions)for(const reply of solution.replies)for(const finish of reply.finishes){
  const board=new Chess(fen);
  [solution.move,reply.move,finish].forEach(token=>board.move({from:token.slice(0,2),to:token.slice(2,4),promotion:token[4]}));assert.ok(board.isCheckmate());
 }
});
test('Wrong move persists until Retry; correct and opponent moves each require Continue',()=>{
 const exercise=createMateExercise(prepared);
 assert.equal(exercise.submit('h7h6').state,'wrong');assert.notEqual(exercise.getSnapshot().fen,fen);
 const wrong=exercise.getSnapshot();exercise.submit('b6b4');assert.deepEqual(exercise.getSnapshot(),wrong);
 assert.equal(exercise.continue().fen,fen);
 assert.equal(exercise.submit('b6b4').state,'correct');assert.equal(exercise.game.history().length,1);
 assert.equal(exercise.continue().state,'opponent');assert.equal(exercise.game.history().length,2);
 assert.equal(exercise.continue().state,'awaitMove');
 const before=exercise.getSnapshot().fen;
 assert.equal(exercise.submit('b4a4').state,'wrong');assert.equal(exercise.continue().fen,before);
 assert.equal(exercise.submit('b4d4').state,'success');assert.ok(exercise.game.isCheckmate());
});
test('Invalid input is inert; preparation is cancellable and unavailable for unverified or long mates',async()=>{
 const exercise=createMateExercise(prepared);assert.equal(exercise.submit('a1a8').fen,fen);
 assert.equal(await prepareMateExercise({fenBefore:fen}),null);
 await assert.rejects(prepareMateExercise({fenBefore:fen,shortMate:{verified:true,moves:2}},()=>{throw new DOMException('Cancelled','AbortError');}),{name:'AbortError'});
});
test('Mate-in-one promotion choices keep UCI suffixes and accept underpromotion mate',async()=>{
 const exercise=await prepareMateExercise({fenBefore:'7k/5P2/5K2/8/8/8/8/7R w - - 0 1',shortMate:{verified:true,moves:1}});
 assert.ok(exercise.solutions.some(row=>row.move==='f7f8q'));assert.ok(exercise.solutions.some(row=>row.move==='f7f8r'));
 assert.equal(createMateExercise(exercise).submit('f7f8r').state,'success');
});
test('Playback pauses on a mistake even when an old focus list omits it',async()=>{
 let tick;const playback=createAnalysisPlayback({analysis:{totalPlies:2,focusEvents:[],moves:[{status:'complete',quality:'mistake'}]},showPly:async()=>{},schedule:fn=>{tick=fn;},unschedule:()=>{}});
 await playback.play();await tick();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(playback.getSnapshot().state,'pausedForInsight');playback.dispose();
});
