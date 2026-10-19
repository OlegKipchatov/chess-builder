import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {detectOutcome,traceOutcome} from '../src/domain/analysis/analysis-outcomes.ts';
import {reviewCompletion,humanMove} from '../src/domain/analysis/presentation.ts';
import {explanationFor} from '../src/domain/analysis/analysis-explanations.ts';
import {detectReason} from '../src/domain/analysis/analysis-reasons.ts';
import {selectEvents} from '../src/domain/analysis/analysis-events.ts';
const line=(pv,score,draw=0)=>({move:pv[0],pv,score:{type:'cp',value:0},expectedScorePlayer:score,wdl:{win:(1-draw)*score,draw,loss:0}});
const decision=(fen,best,actual)=>({fenBefore:fen,playedMove:actual.move,bestLine:best,playedLine:actual,actor:'player',status:'complete',quality:'blunder',ply:1});
test('Actual stalemate is distinct from a drawn engine evaluation',()=>{
 const fen='7k/5K2/8/6Q1/8/8/8/8 w - - 0 1';
 const row=decision(fen,line(['g5h6'],1),line(['g5g6'],.5,1));
 const result=detectOutcome(row);
 assert.equal(result.reason,'allowed_stalemate');assert.equal(result.immediate,true);
 assert.match(result.text,/нет легальных ходов/);assert.equal(detectReason({...row,outcome:result}),'allowed_stalemate');
 const uncertain=decision(fen,line(['g5h6'],1),line(['g5g4'],.5,.2));
 assert.equal(detectOutcome(uncertain),null,'Balanced win/loss chances are not proof of a draw');
});
test('Missed draw and saving defence compare alternatives without declaring a lost position rescued',()=>{
 const fen='7k/8/8/8/8/8/1n6/K4B2 w - - 0 1';
 const drawing=line(['a1b2'],.5,1),lost=line(['a1b1'],0);
 const missed=detectOutcome(decision(fen,drawing,lost));
 assert.equal(missed.reason,'missed_draw');assert.equal(missed.mechanism,'insufficient');
 const saved=detectOutcome({...decision(fen,drawing,drawing),highlight:'excellent'},[drawing,lost]);
 assert.equal(saved.reason,'saved_draw');assert.match(saved.text,/Вы нашли путь к ничьей/);
 assert.equal(detectOutcome({...decision(fen,drawing,drawing),highlight:'excellent'},[drawing]),null);
});
test('Repetition evidence needs the actual history prefix; fifty-move evidence retains FEN counter',()=>{
 const board=new Chess();board.loadPgn('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1');
 const move={fenBefore:board.fen()},last=line(['f6g8'],.5,1);
 assert.equal(traceOutcome(move,last)?.mechanism,undefined);
 assert.equal(traceOutcome(move,last,board.pgn()).mechanism,'repetition');
 assert.equal(traceOutcome({fenBefore:'7k/8/8/8/8/8/8/R6K w - - 99 1'},line(['a1a2'],.5,1)).mechanism,'fifty_moves');
 assert.equal(traceOutcome(move,{...last,pv:['f6f8']}),null);
});
test('Mate to CP is an unconfirmed mate, not a proven missed one',()=>{
 const row={mateTransition:'missed_mate',expectedScoreLoss:.8,bestLine:{...line(['e2e4'],1),score:{type:'mate',value:3}},playedLine:line(['d2d4'],.2)};
 assert.equal(detectReason(row),'mate_opportunity');
 const text=explanationFor({...row,reason:detectReason(row)});
 assert.match(text,/мат пока не подтверждён/);assert.doesNotMatch(text,/упустили|при любой защите/);
 assert.match(explanationFor({...row,reason:'mate_opportunity',shortMate:{verified:true,proof:'exhaustive',moves:2}}),/при любой защите/);
});
test('Completion is honest for complete, partial, routine and significant analyses; moves identify squares',()=>{
 assert.equal(reviewCompletion({status:'complete',moves:[]}), 'Серьёзных ошибок не найдено.');
 assert.equal(reviewCompletion({status:'partial',moves:[]}), 'Просмотр завершён.');
 assert.equal(reviewCompletion({status:'complete',moves:[{actor:'player',status:'complete',quality:'mistake'}]}),'Разбор завершён.');
 assert.match(humanMove('Nf3','g1f3'),/Конь g1–f3/);
 const row={ply:1,actor:'player',status:'complete',quality:'best',outcome:{reason:'saved_draw'}};
 assert.deepEqual(selectEvents([row]),[1]);
});
test('Repeated checks are named only after a real third repetition',()=>{
 const board=new Chess('6k1/R7/8/8/8/8/8/K7 w - - 0 1');
 for(const san of ['Ra8+','Kh7','Ra7+','Kg8','Ra8+','Kh7'])board.move(san);
 const move={fenBefore:board.fen()},continuation=line(['a8a7','h7g8'],.5,1);
 assert.equal(traceOutcome(move,continuation,board.pgn()).mechanism,'perpetual_check');
 assert.equal(traceOutcome(move,continuation),null);
});
test('Stalemate wording identifies the side with no legal moves',()=>{
 const move={fenBefore:'8/8/8/8/8/5k2/5q2/6K1 w - - 0 1'};
 const proof=traceOutcome(move,line(['g1h1','f2g3'],.5,1));
 assert.equal(proof.mechanism,'stalemate');assert.equal(proof.stalledPlayer,true);
});
