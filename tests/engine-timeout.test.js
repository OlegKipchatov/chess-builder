import test from 'node:test';
import assert from 'node:assert/strict';
import {createStockfishClient} from '../dist/stockfish-client.js';
import {Chess} from '../dist/chess.js';
import {createSession} from '../dist/cognitive-model.js';
const profile=createSession(1500,5,'tricky',{disableVariance:true});
test('Native boundary включает UCI_LimitStrength и UCI_Elo',()=>{
 const commands=[],worker={postMessage:value=>commands.push(value),terminate:()=>{}};const client=createStockfishClient(()=>worker);client.onerror=error=>{throw error;};client.postMessage({id:1,fen:new Chess().fen(),engineProfile:profile});worker.onmessage({data:'uciok\nreadyok'});
 assert.ok(commands.includes('setoption name UCI_LimitStrength value true'));assert.ok(commands.includes('setoption name UCI_Elo value 1400'));assert.ok(commands.includes('setoption name MultiPV value 1'));assert.ok(commands.includes('go movetime 1500'));client.terminate();
});
test('Нелегальный bestmove завершает Worker ошибкой',()=>{
 const worker={postMessage:()=>{},terminate:()=>{}},client=createStockfishClient(()=>worker);let error;client.onerror=value=>{error=value;};client.postMessage({id:1,fen:new Chess().fen(),engineProfile:profile});worker.onmessage({data:'uciok\nreadyok\nbestmove e2e5'});assert.match(error.message,/Invalid move|Missing bestmove/);
});
test('Отмена игнорирует поздний ответ',()=>{
 const worker={postMessage:()=>{},terminate:()=>{}},client=createStockfishClient(()=>worker);let called=false;client.onmessage=()=>{called=true;};client.terminate();worker.onmessage({data:'uciok\nreadyok\nbestmove e2e4'});assert.equal(called,false);
});
