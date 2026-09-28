import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {completedMatch,matchEndReason} from '../dist/archive.js';
import {initialState} from '../dist/state.js';
import {createStartedGame} from '../dist/session.js';
import {matchResultDialog} from '../dist/ui/dialog-content.js';
const finish = (game,color,resigned=false) => {
 const state=initialState();state.game={...createStartedGame(state,()=>.9),playerColor:color,resigned};
 return completedMatch(state,game,{id:'test',finishedAt:'2026-09-28T04:00:00Z'});
};
test('Мат: заголовок совпадает с историей для победы и поражения за оба цвета',()=>{
 for(const moves of [['f3','e5','g4','Qh4#'],['e4','e5','Bc4','Nc6','Qh5','Nf6','Qxf7#']]){
  const game=new Chess();moves.forEach(move=>game.move(move));
  for(const color of ['w','b']){
   const {entry,reward,rewardBreakdown}=finish(game,color),reason=matchEndReason(game);
   assert.equal(entry.result,game.turn()===color?'Поражение':'Победа');assert.equal(reason,'Мат');
   const html=matchResultDialog('неверный fallback',reward,entry,rewardBreakdown,reason);
   assert.ok(html.startsWith(`<h2>${entry.result}</h2><p class="match-end-reason">Мат</p>`));
  }
 }
});
test('Ничья: пат, недостаток материала, 50 ходов и повторение имеют отдельную причину',()=>{
 const repeated=new Chess();['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8'].forEach(move=>repeated.move(move));
 for(const [game,reason] of [[new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'),'Пат'],[new Chess('7k/8/6K1/8/8/8/8/8 w - - 0 1'),'Недостаточно материала'],[new Chess('7k/8/6K1/8/8/8/8/R7 w - - 100 51'),'Правило 50 ходов'],[repeated,'Троекратное повторение']]){
  assert.equal(matchEndReason(game),reason);
  for(const color of ['w','b'])assert.equal(finish(game,color).entry.result,'Ничья');
 }
});
test('Сдача после своего хода — поражение, до своего хода — отмена',()=>{
 for(const color of ['w','b']){
  const game=new Chess();if(color==='b')game.move('e4');
  assert.equal(finish(game,color,true).cancelled,true);
  game.move(color==='w'?'e4':'e5');
  assert.equal(finish(game,color,true).entry.result,'Поражение');
  assert.equal(matchEndReason(game,true),'Сдача');
 }
 assert.equal(matchEndReason(new Chess()),'');
});
