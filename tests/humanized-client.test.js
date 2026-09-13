import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {createStockfishClient} from '../dist/stockfish-client.js';
import {spawnStockfish} from '../scripts/stockfish-process.mjs';
import {initialState,migrateState} from '../dist/state.js';
import {createStartedGame} from '../dist/session.js';
import {seededRandom} from '../dist/difficulty-model.js';
const profile={id:'humanized19-v1',targetElo:800,effectiveElo:800,seed:5};
const ask=(client,fen)=>new Promise((resolve,reject)=>{client.onmessage=({data})=>resolve(data);client.onerror=reject;client.postMessage({id:1,fen,engineProfile:profile,analysisOnly:true});});
test('Реальный SF19: воспроизводимые кандидаты, ход и перспективы обеих сторон', {timeout:30000},async()=>{
 const client=createStockfishClient(()=>spawnStockfish(19));
 try{
  const game=new Chess(),a=await ask(client,game.fen()),b=await ask(client,game.fen());
  assert.deepEqual(a.analysis.candidates,b.analysis.candidates);assert.deepEqual(a.move,b.move);
  assert.ok(a.analysis.candidates.length>=12);game.move(a.move);assert.ok(game.move((await ask(client,game.fen())).move));
  assert.ok(a.analysis.candidates.some(c=>c.shallowDepth===2));
 }finally{client.terminate();}
});
test('Позиция со скриншота: движок возвращает легальный ответ на шах', {timeout:30000},async()=>{
 const client=createStockfishClient(()=>spawnStockfish(19));
 try{const game=new Chess('4k1nr/p6p/5p2/3p3p/5P1b/4p3/1K2q3/8 w - - 0 34');assert.equal(game.moves().length,6);assert.ok(game.move((await ask(client,game.fen())).move));}finally{client.terminate();}
});
test('Неполный MultiPV: принимается проверенный bestmove вместо остановки партии',()=>{
 const worker={postMessage:()=>{},terminate:()=>{}};const client=createStockfishClient(()=>worker);let result;
 client.onmessage=({data})=>{result=data;};client.onerror=error=>{throw error;};
 client.postMessage({id:1,fen:new Chess().fen(),engineProfile:profile});worker.onmessage({data:'uciok\nreadyok\nbestmove e2e4'});
 assert.equal(result.move.from,'e2');assert.equal(result.move.to,'e4');client.terminate();
});
test('Неполный MultiPV не разрешает нелегальный bestmove',()=>{
 const worker={postMessage:()=>{},terminate:()=>{}};const client=createStockfishClient(()=>worker);let error,reply;
 client.onerror=value=>{error=value;};client.onmessage=value=>{reply=value;};
 client.postMessage({id:1,fen:new Chess().fen(),engineProfile:profile});worker.onmessage({data:'uciok\nreadyok\nbestmove e2e5'});
 assert.ok(error);assert.equal(reply,undefined);client.terminate();
});
test('Новый профиль переживает миграцию, variance не меняется от текущего рейтинга',()=>{
 const state=initialState();state.game=createStartedGame(state,seededRandom(1));
 const profile={...state.game.engineProfile};state.rating.value=1600;
 assert.deepEqual(migrateState(state).game.engineProfile,profile);assert.equal(profile.targetElo,900);
 const old={id:'stockfish19-v1',skill:4,nodes:4000,milliseconds:1500};state.game.engineProfile=old;
 assert.deepEqual(migrateState(state).game.engineProfile,old);
});
test('Humanized отправляет один поиск, MultiPV и максимальный Skill без native weakening',async()=>{
 const commands=[];const worker={postMessage:command=>commands.push(command),terminate:()=>{}};
 const client=createStockfishClient(()=>worker);client.onerror=()=>{};
 client.postMessage({id:1,fen:new Chess().fen(),engineProfile:profile});worker.onmessage({data:'uciok\nreadyok'});
 assert.ok(commands.includes('setoption name Skill Level value 20'));assert.ok(commands.includes('setoption name UCI_LimitStrength value false'));
 assert.ok(commands.includes('setoption name MultiPV value 20'));assert.equal(commands.filter(c=>c.startsWith('go ')).length,1);
 assert.ok(!commands.some(c=>c.includes('UCI_Elo')));assert.ok(commands.find(c=>c.startsWith('go ')).includes('movetime 2500'));client.terminate();
});
