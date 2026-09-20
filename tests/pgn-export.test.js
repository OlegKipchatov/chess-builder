import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {exportPgn,sharePgn} from '../dist/pgn-export.js';
test('Системная передача содержит полный PGN и в файле, и в тексте',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');let payload;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{canShare:()=>true,share:async data=>{payload=data;}}});
 try{
  const pgn=exportPgn(new Chess());await sharePgn(pgn,new Date(2026,8,13,14,32,5));assert.equal(payload.text,pgn);assert.equal(await payload.files[0].text(),pgn);assert.equal(payload.files[0].name,'GachaChess_2026-09-13_14-32-05.pgn');
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('Экспорт текущей партии сохраняет все ходы, FEN, рейтинг и seed без изменения игры',()=>{
 const game=new Chess();['e4','e5','Nf3'].forEach(move=>game.move(move));const before=game.pgn();
 const pgn=exportPgn(game,{playerColor:'b',rating:{before:586,opponent:486},engineProfile:{id:'cognitive-v2',mode:'cognitive',targetElo:486,effectiveElo:474,seed:123,profile:'solid',calibrationVersion:9}},{message:'Cognitive worker failed',fen:game.fen()});
 const restored=new Chess();restored.loadPgn(pgn);assert.equal(restored.fen(),game.fen());assert.deepEqual(restored.history(),game.history());assert.equal(game.pgn(),before);
 assert.equal(restored.getHeaders().BlackElo,'586');assert.equal(restored.getHeaders().BotSeed,'123');assert.equal(restored.getHeaders().BotCalibration,'9');assert.equal(restored.getHeaders().BotMode,'cognitive');assert.equal(restored.getHeaders().Result,'*');assert.equal(restored.getHeaders().LastEngineError,'Cognitive worker failed');
});
test('Архивная сдача, ничья и нестандартная начальная позиция экспортируются корректно',()=>{
 const game=new Chess('4k1nr/p6p/5p2/3p3p/5P1b/4p3/1K2q3/8 w - - 0 34');game.move('Kb1');
 const restored=new Chess();restored.loadPgn(exportPgn(game,{playerColor:'b',result:'Поражение'}));assert.equal(restored.fen(),game.fen());assert.equal(restored.getHeaders().Result,'1-0');
 restored.loadPgn(exportPgn(new Chess(),{result:'Ничья'}));assert.equal(restored.getHeaders().Result,'1/2-1/2');
});
