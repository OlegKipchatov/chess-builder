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
 }finally{client.terminate();}
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
 assert.ok(!commands.some(c=>c.includes('UCI_Elo')));assert.ok(!commands.find(c=>c.startsWith('go ')).includes('movetime'));client.terminate();
});
