import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {createStockfishClient,uciPosition} from '../dist/stockfish-client.js';
import {stockfishProfile} from '../dist/strength.js';
import {spawnStockfish} from '../scripts/stockfish-process.mjs';
import {initialState,migrateState} from '../dist/state.js';
import {createStartedGame} from '../dist/session.js';
const ask = (client,game,rating=1000) => new Promise((resolve,reject)=>{client.onmessage=event=>resolve(event.data.move);client.onerror=reject;client.postMessage({id:1,fen:game.fen(),pgn:game.pgn(),engineProfile:stockfishProfile(rating)});});
test('Настоящий WASM Stockfish отвечает легальными ходами за обе стороны и находит вынужденный мат', {timeout:30000},async()=>{
 const client=createStockfishClient(spawnStockfish);
 try {
  const game=new Chess();for(let ply=0;ply<4;ply++){const move=await ask(client,game,400);assert.ok(game.move(move));}
  const mate=new Chess('7k/5K2/6Q1/8/8/8/8/8 w - - 0 1');mate.move(await ask(client,mate,1600));assert.equal(mate.isCheckmate(),true);
 }finally{client.terminate();}
});
test('UCI получает историю, включая повторения, а не только последнюю позицию',()=>{const game=new Chess();['Nf3','Nf6','Ng1','Ng8'].forEach(move=>game.move(move));const result=uciPosition({fen:game.fen(),pgn:game.pgn()});assert.match(result.command,/moves g1f3 g8f6 f3g1 f6g8$/);assert.throws(()=>uciPosition({fen:new Chess().fen(),pgn:game.pgn()}));});
test('Новые партии фиксируют профиль Stockfish, старые продолжают прежний движок',()=>{const state=initialState();state.game=createStartedGame(state,()=>0);const profile={...state.game.engineProfile};state.rating.value=1600;assert.deepEqual(migrateState(state).game.engineProfile,profile);delete state.game.engineProfile;assert.equal(migrateState(state).game.engineProfile,null);});
test('Отмена во время загрузки не пропускает поздние ответы',()=>{const sent=[];const worker={postMessage:line=>sent.push(line),terminate:()=>{}};const client=createStockfishClient(()=>worker);let called=false;client.onmessage=()=>{called=true;};client.postMessage({id:1,fen:new Chess().fen()});client.terminate();worker.onmessage({data:'uciok\nreadyok\nbestmove e2e4'});assert.equal(called,false);assert.deepEqual(sent,['uci']);});

test('Браузерная ветка Stockfish загружает WASM из офлайн-кэша без CDN и SharedArrayBuffer', {timeout:15000},async()=>{
 const {readFile}=await import('node:fs/promises');const {createContext,runInContext}=await import('node:vm');
 const source=await readFile(new URL('../dist/vendor/stockfish-18-lite-single.js',import.meta.url),'utf8');
 const wasm=await readFile(new URL('../dist/vendor/stockfish-18-lite-single.wasm',import.meta.url));
 let context;const timers=new Set(),requests=[];
 const worker={onmessage:null,onerror:null,postMessage:data=>timeout(()=>context.onmessage({data}),0),terminate:()=>timers.forEach(clearTimeout)};
 const timeout=(callback,ms)=>{const id=setTimeout(()=>{timers.delete(id);callback();},ms);timers.add(id);return id;};
 context=createContext({onmessage:null,location:{hash:'',origin:'https://example.test',pathname:'/chess-builder/vendor/stockfish-18-lite-single.js',href:'https://example.test/chess-builder/vendor/stockfish-18-lite-single.js'},importScripts:()=>{throw Error('Unexpected external script');},postMessage:data=>timeout(()=>worker.onmessage?.({data}),0),setTimeout:timeout,clearTimeout,console,performance,WebAssembly,URL,Request,Response,TextDecoder,TextEncoder,fetch:async url=>{requests.push(String(url));assert.equal(String(url),'https://example.test/chess-builder/vendor/stockfish-18-lite-single.wasm');return new Response(wasm,{headers:{'Content-Type':'application/wasm'}});}});
 context.self=context;runInContext(source,context);
 const client=createStockfishClient(()=>worker);
 try{const game=new Chess();const move=await Promise.race([ask(client,game,1000),new Promise((_,reject)=>timeout(()=>reject(Error('No reply; fetches: '+requests.join(','))),5000))]);assert.ok(game.move(move));assert.equal(requests.length,1);}finally{client.terminate();}
});
test('Stockfish 19 smallnet реально запускается и делает легальные ходы', {timeout:20000},async()=>{
 const client=createStockfishClient(()=>spawnStockfish(19));
 try{const game=new Chess();for(let ply=0;ply<4;ply++){assert.ok(game.move(await ask(client,game,1000)));}}finally{client.terminate();}
});
