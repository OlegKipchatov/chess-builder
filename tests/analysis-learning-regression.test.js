import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {recommendationEvidence} from '../dist/analysis/analysis-reasons.js';
import {prepareMateExercise,createMateExercise} from '../dist/analysis/analysis-training.js';
import {selectEvents,isImportantInsight} from '../dist/analysis/analysis-events.js';
import {analysisInsight,visibleVariation} from '../dist/ui/components/analysis-insight.js';

const pgn='1. e4 Nc6 2. f3 a5 3. Nc3 Nf6 4. Nb5 b6 5. c3 e5 6. d4 exd4 7. cxd4 Bd6 8. d5 Bxh2 9. Rxh2 Nxe4 10. fxe4 Ne5 11. b3 h5 12. Bb2 f5 13. Bxe5 Bb7 14. Bxg7 Rh6 15. Bxh6 fxe4 16. g4 Bxd5 17. Bg2 Ra6 18. Rc1 Ke7 19. Ne2 c5 20. Rxh5 Bf7 21. Rf5 c4 22. bxc4 d5 23. cxd5 Bxd5 24. Rxd5 Qxd5 25. Qxd5 e3 26. Qb7+ Ke6 27. Qxa6 a4 28. Qxb6+ Ke5 29. Rc4 a3 30. Qxe3+ Kf6 31. Rf4+ Kg6 32. Qe6+ Kh7 33. Bf8 Kh8 34. g5 Kh7 35. Rh4#';
const game=new Chess();game.loadPgn(pgn);
const history=game.history({verbose:true});
const mateMove=async index=>{
 const move={ply:index+1,actor:'player',status:'complete',quality:'good',reason:'mate_opportunity',fenBefore:history[index].before,shortMate:{verified:true,moves:1}};
 move.exercise=await prepareMateExercise(move);return move;
};

test('Reported opening: d4 is protected, with a legal explanatory capture and recapture',()=>{
 const move={fenBefore:history[2].before,playedMove:'f2f3',bestLine:{move:'d2d4',pv:['d2d4']}};
 const evidence=recommendationEvidence(move,'w');
 assert.deepEqual(evidence.pv,['d2d4','c6d4','d1d4']);
 assert.match(evidence.text,/конём/);
 const board=new Chess(move.fenBefore);evidence.pv.forEach(token=>board.move({from:token.slice(0,2),to:token.slice(2,4)}));
 assert.equal(board.get('d4').type,'q');
 assert.deepEqual(visibleVariation({...move,recommendationEvidence:evidence},true).pv,evidence.pv);
 assert.equal(recommendationEvidence({...move,playedMove:'d2d4'},'w'),null);
});

test('A knight taking a queen is explained even when the knight is recaptured',()=>{
 const evidence=recommendationEvidence({fenBefore:'4k3/8/4p3/3q4/5N2/8/8/4K3 w - - 0 1',playedMove:'e1d1',bestLine:{move:'f4d5',pv:['f4d5','e6d5']}},'w');
 assert.match(evidence.text,/ферзя/);assert.match(evidence.text,/коня/);assert.equal(evidence.pv.length,2);
});

test('Reported moves 29 and 30 share three mates: one card and one autoplay event',async()=>{
 const first=await mateMove(56),second=await mateMove(58);
 for(const token of ['h6f4','b6d6','c1c5'])assert.ok(first.exercise.solutions.some(row=>row.move===token));
 assert.deepEqual(selectEvents([first,{actor:'opponent'},second]),[57]);
 assert.equal(isImportantInsight(second),false);assert.equal(analysisInsight(second),'');
 second.quality='blunder';assert.deepEqual(selectEvents([first,second]),[57,59]);
 second.quality='good';assert.deepEqual(selectEvents([first,{actor:'player',status:'unavailable'},second]),[57,59]);
});

test('Hint unlocks after five legal failures, survives re-entry, and accepts all actual mating moves',async()=>{
 const {exercise:data}=await mateMove(56),attempts=new Map();let exercise=createMateExercise(data,{attempts});
 assert.equal(await exercise.getHint(),null);
 exercise.submit('a1a8');assert.equal(exercise.getSnapshot().failedAttempts,0);
 for(let i=0;i<5;i++){
  assert.equal(exercise.submit('c1c4').state,'wrong');
  exercise.submit('c1c4');exercise.continue();
  assert.equal(exercise.getSnapshot().failedAttempts,i+1);
  assert.equal(exercise.getSnapshot().canHint,i===4);
 }
 exercise=createMateExercise(data,{attempts});
 const hint=await exercise.getHint();assert.ok(data.solutions.some(row=>row.move===hint));
 for(const solution of data.solutions)assert.equal(createMateExercise(data).submit(solution.move).state,'success');
});

test('Unverified engine attempts never unlock hints; hint search is bounded and cancellable',async()=>{
 const fen='7k/8/5K2/8/8/8/8/3Q4 w - - 0 1';
 let mode='uncertain',request,terminated=false;
 const client={terminate:()=>{terminated=true;},postMessage:data=>{
  request=data;
  if(mode==='pending')return;
  queueMicrotask(()=>client.onmessage({data:{...data,lines:[{move:'h8h7',scoreType:'cp',scoreValue:-900}]}}));
 }};
 const attempts=new Map(),exercise=createMateExercise({type:'engine',fen,mateIn:3},{attempts,createClient:()=>client});
 for(let i=0;i<5;i++){
  assert.equal((await exercise.submit('d1d2')).state,'unverified');exercise.continue();
 }
 assert.equal(exercise.getSnapshot().canHint,false);
 attempts.set(fen.split(' ').slice(0,4).join(' '),5);mode='pending';
 const hint=exercise.getHint();assert.equal(request.analysis.mode,'nodes');assert.equal(request.analysis.nodes,300000);
 exercise.dispose();assert.equal(await hint,null);assert.equal(terminated,true);
});
