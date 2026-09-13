import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {initialState,migrateState} from '../dist/state.js';
import {createStartedGame} from '../dist/session.js';
import {abortFailedMatch,canAbortFailedMatch} from '../dist/archive.js';
import {exportPgn} from '../dist/pgn-export.js';
import {readFileSync} from 'node:fs';
const setup=()=>{
 const state=initialState(),game=new Chess();state.game=createStartedGame(state,()=>.7);
 ['e4','e5','Nf3'].forEach(move=>game.move(move));state.game.pgn=game.pgn();state.game.engineFailure={fen:game.fen(),message:'Stockfish timeout'};
 return {state,game};
};
test('Сбой можно завершить без рейтинга, наград, статистики и закрытия календарного дня',()=>{
 const {state,game}=setup();const before=structuredClone(state);
 const next=abortFailedMatch(state,game,{id:'failed',finishedAt:'2026-09-13T12:00:00Z'});
 for(const key of ['rating','coins','shards','played','activity','opened','owned'])assert.deepEqual(next[key],before[key]);
 assert.deepEqual(state,before);assert.equal(next.game.started,false);assert.equal(next.game.pgn,'');
 const entry=next.archive[0];assert.equal(entry.counted,false);assert.equal(entry.ratingDelta,null);assert.equal(entry.pgn,game.pgn());
 assert.deepEqual(migrateState(next).archive,next.archive);assert.equal(abortFailedMatch(next,game,{id:'again'}),null);
 const replay=new Chess();replay.loadPgn(exportPgn(game,entry));assert.equal(replay.getHeaders().Result,'*');assert.equal(replay.getHeaders().Termination,'abandoned');assert.equal(replay.getHeaders().LastEngineError,'Stockfish timeout');
});
test('Право отмены переживает перезагрузку, но не применяется к другой позиции или завершённой партии',()=>{
 const {state,game}=setup();assert.equal(canAbortFailedMatch(migrateState(state),game),true);
 const replay=new Chess();assert.equal(canAbortFailedMatch(state,replay),false);
 state.game.engineFailure=null;assert.equal(canAbortFailedMatch(state,game),false);
 state.game.engineFailure={fen:game.fen(),message:'error'};state.game.resigned=true;assert.equal(canAbortFailedMatch(state,game),false);
});
test('Прерванная партия исключена из процента побед; отмена доступна за пределами модального окна',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.ok(app.includes("entry.mode==='bot'&&entry.counted!==false"));assert.ok(html.includes('id="abort-failed"'));assert.ok(app.includes("$('#abort-failed').onclick=abortAfterFailure"));
 assert.ok(app.includes('data-download-pgn'));assert.ok(app.includes('data-copy-pgn'));
});
