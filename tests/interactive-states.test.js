import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {initialState} from '../dist/state.js';
import {createStartedGame,boardAvailability} from '../dist/session.js';
import {createToast} from '../dist/ui/dialog.js';

test('Доступность доски следует очереди хода, анимации и режиму просмотра для обеих сторон',()=>{
  for(const color of ['w','b']){
    const state=initialState(),game=new Chess();
    assert.equal(boardAvailability(state,game,null).disabled,true);
    state.game={...createStartedGame(state),playerColor:color};
    if(color==='b')game.move('e4');
    assert.deepEqual(boardAvailability(state,game,null),{disabled:false,busy:false});
    for(const flags of [{busy:true},{animating:true}]){
      assert.deepEqual(boardAvailability(state,game,null,flags),{disabled:true,busy:true});
    }
    assert.deepEqual(boardAvailability(state,game,null,{readOnly:true}),{disabled:true,busy:false});
    assert.deepEqual(boardAvailability(state,game,0),{disabled:true,busy:false});
    game.move(color==='w'?'e4':'e5');
    assert.deepEqual(boardAvailability(state,game,null),{disabled:true,busy:false});
    game.move(color==='w'?'e5':'Nf3');
    assert.deepEqual(boardAvailability(state,game,null),{disabled:false,busy:false});
    state.game.resigned=true;
    assert.equal(boardAvailability(state,game,null).disabled,true);
  }
});

test('Обычное уведомление после ошибки сбрасывает акцент и отсчёт закрытия',context=>{
  context.mock.timers.enable({apis:['setTimeout']});
  const root={dataset:{},hidden:true},toast=createToast(root);
  toast('Ошибка сохранения',{error:true});
  assert.equal(root.dataset.tone,'error');
  context.mock.timers.tick(4000);
  toast('Предмет выбран');
  assert.equal(root.dataset.tone,'neutral');
  assert.equal(root.textContent,'Предмет выбран');
  context.mock.timers.tick(1000);
  assert.equal(root.hidden,false);
  context.mock.timers.tick(4000);
  assert.equal(root.hidden,true);
});
