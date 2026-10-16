import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {initialState,migrateState} from '../src/services/persistence/state.ts';
import {createStartedGame,updatePreferences} from '../src/domain/chess/session.ts';
import {settleRating} from '../src/domain/rating/rating.ts';
import {rewardFor} from '../src/domain/economy/engine.ts';
const play = moves => {const game=new Chess();moves.forEach(move=>game.move(move));return game;};
test('Сторона случайна и сохраняется; настройки сложности всегда адаптивные',()=>{const state=initialState();state.settings.difficulty='hard';assert.equal(createStartedGame(state,()=>0.49).playerColor,'w');state.game=createStartedGame(state,()=>0.5);assert.equal(state.game.playerColor,'b');assert.equal(state.game.difficulty,'adaptive');assert.equal(migrateState(state).game.playerColor,'b');assert.equal(updatePreferences(initialState(),new Chess(),{mode:'bot',difficulty:'easy'}).settings.difficulty,'adaptive');});
test('Старые сохранения сохраняют белую сторону и переходят на адаптацию',()=>{const state=initialState();state.game={started:true,mode:'bot',difficulty:'hard'};const restored=migrateState(state);assert.equal(restored.game.playerColor,'w');assert.equal(restored.game.difficulty,'adaptive');assert.equal(restored.game.rating.opponent,600);assert.equal(restored.game.engineProfile.id,'cognitive-v2');});
test('Победа чёрными повышает рейтинг и даёт награду победителя',()=>{const state=initialState();state.game=createStartedGame(state,()=>0.9);const game=play(['f3','e5','g4','Qh4#']);assert.equal(rewardFor(game,false,'bot','b'),23);assert.equal(settleRating(state,game).value,723);state.game.playerColor='w';assert.equal(rewardFor(game,false,'bot','w'),10);assert.equal(settleRating(state,game).value,659);});

// UI contracts migrated to tests/react/board.test.tsx and routes.test.tsx.
