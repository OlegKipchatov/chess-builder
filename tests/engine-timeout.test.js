import test from 'node:test';
import assert from 'node:assert/strict';
import {createStockfishClient} from '../dist/stockfish-client.js';
import {spawnStockfish} from '../scripts/stockfish-process.mjs';
import {Chess} from '../dist/chess.js';
import {STOCKFISH as C} from '../dist/stockfish-config.js';
const profile={id:'cognitive-v2',targetElo:1400,effectiveElo:1400,seed:219237029};
const setup=t=>{
 t.mock.timers.enable({apis:['setTimeout']});const commands=[],errors=[],replies=[];let terminated=false;
 const worker={postMessage:command=>commands.push(command),terminate:()=>{terminated=true;}};
 const client=createStockfishClient(()=>worker);client.onerror=e=>errors.push(e.message);client.onmessage=({data})=>replies.push(data);
 client.postMessage({id:1,fen:new Chess().fen(),engineProfile:profile});
 return {client,worker,commands,errors,replies,terminated:()=>terminated};
};
test('Медленный поиск сначала получает stop, затем принимает последний легальный ответ',t=>{
 const x=setup(t);x.worker.onmessage({data:'uciok\nreadyok'});
 assert.ok(x.commands.find(c=>c.startsWith('go ')).includes(`movetime ${C.milliseconds}`));
 assert.ok(x.commands.includes('setoption name UCI_LimitStrength value true'));
 assert.ok(x.commands.includes('setoption name UCI_Elo value 1400'));
 t.mock.timers.tick(C.stopAfterMs);assert.equal(x.commands.at(-1),'stop');assert.equal(x.terminated(),false);
 x.worker.onmessage({data:'bestmove e2e4'});assert.equal(x.replies.length,1);
 t.mock.timers.tick(C.watchdogMs);assert.deepEqual(x.errors,[]);assert.equal(x.terminated(),false);x.client.terminate();
});
test('Зависший Worker ограничен тайм-аутом поиска, поздний ответ игнорируется',t=>{
 const x=setup(t);x.worker.onmessage({data:'uciok\nreadyok'});t.mock.timers.tick(C.watchdogMs);
 assert.deepEqual(x.errors,['Stockfish search timeout: no evaluated legal move']);assert.equal(x.terminated(),true);
 x.worker.onmessage({data:'bestmove e2e4'});assert.equal(x.replies.length,0);
});
test('Промежуточный PV спасает ход; старый Worker уничтожен и не влияет на следующий запрос',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const workers=[],replies=[],errors=[];
 const client=createStockfishClient(()=>{const worker={postMessage:()=>{},terminated:false,terminate:()=>{worker.terminated=true;}};workers.push(worker);return worker;});
 client.onmessage=({data})=>{assert.equal(workers[0].terminated,true);replies.push(data);};client.onerror=e=>errors.push(e.message);
 client.postMessage({id:1,fen:new Chess().fen(),engineProfile:profile});const first=workers[0];
 first.onmessage({data:'uciok\nreadyok\ninfo depth 2 multipv 1 score cp 20 pv e2e4'});
 t.mock.timers.tick(C.watchdogMs);assert.equal(replies.length,1);assert.equal(replies[0].move.to,'e4');
 const game=new Chess();game.move(replies[0].move);client.postMessage({id:2,fen:game.fen(),engineProfile:profile});assert.equal(workers.length,2);
 first.onmessage({data:'readyok\nbestmove a2a4'});first.onerror({message:'late failure'});assert.equal(replies.length,1);assert.deepEqual(errors,[]);
 workers[1].onmessage({data:'uciok\nreadyok\nbestmove e7e5'});assert.equal(replies.length,2);assert.equal(replies[1].id,2);assert.equal(replies[1].move.to,'e5');client.terminate();
});
test('Нелегальный промежуточный PV не используется для спасения хода',t=>{
 const x=setup(t);x.worker.onmessage({data:'uciok\nreadyok\ninfo depth 2 multipv 1 score cp 20 pv e2e5'});t.mock.timers.tick(C.watchdogMs);assert.equal(x.replies.length,0);assert.equal(x.errors.length,1);
});
test('Нативный режим восстанавливает проверенный PV после тайм-аута',t=>{
 const x=setup(t);x.worker.onmessage({data:'uciok\nreadyok'});
 const moves=new Chess().moves({verbose:true});
 const lines=moves.map((m,i)=>`info depth 2 multipv ${i+1} score cp ${50-i*10} pv ${m.from}${m.to}`).join('\n');
 x.worker.onmessage({data:lines});t.mock.timers.tick(C.watchdogMs);
 assert.equal(x.replies.length,1);assert.ok(new Chess().move(x.replies[0].move));assert.deepEqual(x.errors,[]);assert.equal(x.terminated(),true);
});
test('Последовательность PGN и 20 следующих полуходов работают через один реальный экземпляр', {timeout:30000},async()=>{
 const game=new Chess(),client=createStockfishClient(()=>spawnStockfish(19));
 const ask=()=>new Promise((resolve,reject)=>{client.onmessage=({data})=>resolve(data);client.onerror=reject;client.postMessage({id:game.history().length+1,fen:game.fen(),pgn:game.pgn(),engineProfile:profile});});
 try{
  for(const san of ['g4','e5','g5','f6','b3','fxg5']){const reply=await ask();assert.ok(new Chess(game.fen()).move(reply.move));game.move(san);}
  for(let i=0;i<20&&!game.isGameOver();i++)assert.ok(game.move((await ask()).move));
 }finally{client.terminate();}
});
test('Ошибка загрузки отличается от тайм-аута расчёта; отмена снимает оба таймера',t=>{
 const x=setup(t);t.mock.timers.tick(C.initializationMs);assert.deepEqual(x.errors,['Stockfish initialization timeout']);
 t.mock.timers.reset();const y=setup(t);y.worker.onmessage({data:'uciok\nreadyok'});y.client.terminate();t.mock.timers.tick(C.watchdogMs);
 assert.deepEqual(y.errors,[]);assert.ok(!y.commands.includes('stop'));
});
test('PGN пользователя рассчитывается реальным SF19 в верхнем диапазоне', {timeout:30000},async()=>{
 const pgn='1. g4 e5 2. g5 f6 3. b3 fxg5 *',game=new Chess();game.loadPgn(pgn);
 const client=createStockfishClient(()=>spawnStockfish(19));
 try{const reply=await new Promise((resolve,reject)=>{client.onmessage=({data})=>resolve(data);client.onerror=reject;client.postMessage({id:1,fen:game.fen(),pgn,engineProfile:profile});});assert.ok(game.move(reply.move));}finally{client.terminate();}
});
