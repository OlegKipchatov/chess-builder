import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {initialState} from '../src/services/persistence/state.ts';
import {createStartedGame,boardAvailability} from '../src/domain/chess/session.ts';

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

// Toast lifecycle: tests/react/overlay.test.tsx.
