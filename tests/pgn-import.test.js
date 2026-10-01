import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {importPgn,MAX_PGN_BYTES} from '../dist/pgn-import.js';
import {exportPgn} from '../dist/pgn-export.js';
import {initialState,migrateState} from '../dist/state.js';
import {createStartedGame} from '../dist/session.js';
import {completedMatch} from '../dist/archive.js';

test('Export/import roundtrip retains moves, position, headers, result and date',()=>{
 const game=new Chess();['f3','e5','g4','Qh4#'].forEach(move=>game.move(move));
 const pgn=exportPgn(game,{playerColor:'w',result:'Поражение',startedAt:'2026-10-01T12:00:00Z',finishedAt:'2026-10-02T13:00:00Z'});
 const imported=importPgn('\uFEFF'+pgn);
 assert.deepEqual(imported.game.history(),game.history());assert.equal(imported.game.fen(),game.fen());
 assert.equal(imported.game.getHeaders().Date,'2026.10.01');assert.equal(imported.config.result,'0-1');assert.equal(imported.config.white,'Player');assert.equal(imported.config.counted,false);
 assert.equal(imported.game.pgn(),pgn);
});
test('Invalid, empty, oversized and multiple games are rejected',()=>{
 const game=new Chess();game.move('e4');const pgn=exportPgn(game);
 for(const text of ['', 'invalid', '[Event "Empty"]',pgn+'\n\n'+pgn,'1. e4 e5 1-0 1. d4 d5 0-1','a'.repeat(MAX_PGN_BYTES+1)])assert.throws(()=>importPgn(text));
});
test('A custom initial position and promotion roundtrip without changing the game',()=>{
 const game=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');game.move('a8=Q+');
 assert.equal(importPgn(exportPgn(game)).game.fen(),game.fen());
});
test('Start date persists through active save, completion and archived save; old entries use completion',()=>{
 const state=initialState();state.game=createStartedGame(state,()=>.9);state.game.startedAt='2026-09-30T12:00:00Z';
 assert.equal(migrateState(state).game.startedAt,state.game.startedAt);
 const game=new Chess();['f3','e5','g4','Qh4#'].forEach(move=>game.move(move));
 const {entry,state:finished}=completedMatch(state,game,{id:'date',finishedAt:'2026-10-01T12:00:00Z'});
 assert.equal(migrateState(finished).archive[0].startedAt,state.game.startedAt);
 assert.match(exportPgn(game,entry),/\[Date "2026.09.30"\]/);
 assert.match(exportPgn(game,{finishedAt:entry.finishedAt}),/\[Date "2026.10.01"\]/);
 assert.match(exportPgn(game),/\[Date "\?\?\?\?.\?\?.\?\?"\]/);
});
test('Fresh players start at 700 while established ratings are retained',()=>{
 const state=initialState();assert.equal(state.rating.value,700);assert.equal(createStartedGame(state).rating.opponent,600);
 state.rating={value:1180,games:12,lastDelta:8};assert.deepEqual(migrateState(state).rating,state.rating);
});
