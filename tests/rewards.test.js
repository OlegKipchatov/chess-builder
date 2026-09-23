import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {rewardBreakdownFor} from '../dist/engine.js';
import {matchResultDialog} from '../dist/ui/dialog-content.js';
const position = (count,{draw=false,winner='w',over=true}={}) => ({
 history:()=>Array.from({length:count*2},(_,i)=>({color:i%2?'b':'w'})),
 isGameOver:()=>over,isDraw:()=>draw,turn:()=>winner==='w'?'b':'w'
});
test('Награды по согласованным примерам и потолок за длину партии',()=>{
 for(const [count,win,draw,loss] of [[10,25,20,15],[20,30,25,20],[40,40,35,30],[80,40,35,30]]){
  assert.equal(rewardBreakdownFor(position(count)).total,win);
  assert.equal(rewardBreakdownFor(position(count,{draw:true})).total,draw);
  assert.equal(rewardBreakdownFor(position(count,{winner:'b'})).total,loss);
 }
});
test('Сдача на 9-м ходу не оплачивается, на 10-м — 15, на 11-м — 15',()=>{
 for(const color of ['w','b'])for(const [count,total] of [[0,0],[9,0],[10,15],[11,15],[40,30]]){
  const reward=rewardBreakdownFor(position(count),true,'bot',color);
  assert.equal(reward.total,total);assert.equal(reward.result,0);
  assert.equal(reward.reason,count<10?'early-resignation':null);
 }
});
test('Короткая игровая ничья оплачивается; незавершённая партия — нет',()=>{
 assert.equal(rewardBreakdownFor(position(2,{draw:true})).total,16);
 assert.equal(rewardBreakdownFor(position(40,{over:false})).total,0);
});
test('История считает сторону игрока, исключает отмену и не удваивает повторный ход',()=>{
 const game=new Chess();['e4','e5','Nf3'].forEach(move=>game.move(move));
 assert.equal(rewardBreakdownFor(game,false,'bot','w').cleanMoves,2);
 assert.equal(rewardBreakdownFor(game,false,'bot','b').cleanMoves,1);
 game.undo();assert.equal(rewardBreakdownFor(game).cleanMoves,1);
 game.move('Nf3');assert.equal(rewardBreakdownFor(game).cleanMoves,2);
});
test('Окно результата объясняет компоненты награды и раннюю сдачу',()=>{
 const normal=rewardBreakdownFor(position(20));
 const html=matchResultDialog('Победа',normal.total,{},normal);
 for(const text of ['+30 монет','За партию','Ваши ходы','Результат партии','Победа'])assert.ok(html.includes(text));
 const early=rewardBreakdownFor(position(9),true);
 assert.match(matchResultDialog('Вы сдались',0,{},early),/За эту партию монеты не начислены/);
});
