import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {AUTO,PRICES,opponentFor,createAutoRun,buyPiece,sellPiece,placePiece,setupError,setupFen,beginBattle,battleGame,battleResult,completeBattle,nextRound,restoreAutoRun} from '../dist/autochess.js';
import {createBattleController} from '../dist/autochess-battle.js';
import {createAutoplayEngine} from '../dist/autochess-engine.js';
const prepared=()=>{
 let run=buyPiece(createAutoRun('test','fixture'),'n');
 run=placePiece(run,run.army.at(-1).id,run.color==='w'?'d1':'d8');return run;
};
test('shop conserves budget, enforces capacity and cannot sell king',()=>{
 let run={...createAutoRun('one'),version:1,reserve:12};const original=run;
 run=buyPiece(run,'q');assert.equal(run.reserve,3);assert.equal(buyPiece(run,'q'),run);
 run=sellPiece(run,run.army.at(-1).id);assert.equal(run.reserve,12);assert.equal(sellPiece(run,'king'),run);
 for(let i=0;i<20;i++)run=buyPiece(run,'p');assert.equal(run.army.length,8);assert.equal(run.reserve,5);assert.equal(original.army.length,1);
});
test('opponents spend equal budget and every round restores bought army',()=>{
 for(let seed=0;seed<100;seed++){
  let run=prepared();run=buyPiece(createAutoRun(String(seed)),'p');run=placePiece(run,run.army.at(-1).id,run.color==='w'?'d2':'d7');
  for(let round=1;round<=5;round++){
   assert.equal(run.opponent.reduce((n,p)=>n+PRICES[p.type],0),3+(round-1)*3);
   assert.ok(run.opponent.length<=8);assert.equal(new Set(run.opponent.map(p=>p.square)).size,run.opponent.length);
   assert.equal(setupError(run),'');
   run=beginBattle(run);const army=run.army;
   run=completeBattle(run,{winner:null,reason:'test'});assert.deepEqual(run.army,army);
   if(round<5)run=nextRound(run);
  }
 }
});
test('placement validates ranks, pending purchases and castling rights',()=>{
 let run=buyPiece({...createAutoRun('one'),version:1,reserve:12},'p');assert.equal(setupError(run),'Расставьте купленные фигуры');
 const id=run.army.at(-1).id;assert.equal(placePiece(run,id,'a4'),run);
 run=placePiece(run,id,run.color==='w'?'a2':'a7');assert.equal(setupError(run),'');
 run=buyPiece(run,'r');run=placePiece(run,run.army.at(-1).id,run.color==='w'?'h1':'h8');
 assert.ok(setupFen(run).split(' ')[2].includes(run.color==='w'?'K':'k'));
 run=placePiece(run,'king',run.color==='w'?'d1':'d8');assert.ok(!setupFen(run).split(' ')[2].includes(run.color==='w'?'K':'k'));
});
test('limits preserve actual mate on last ply and ordinary draws',()=>{
 const mate=new Chess('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');
 for(const ply of [119,120])assert.equal(battleResult(mate,ply,29999).winner,'w');
 assert.equal(battleResult(new Chess(),120,0).reason,'Достигнут лимит ходов');
 assert.equal(battleResult(new Chess(),2,30000).reason,'Время боя закончилось');
 assert.equal(battleResult(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'),1,0).reason,'Пат');
 const repeat=new Chess();for(let i=0;i<2;i++)for(const m of ['Nf3','Nf6','Ng1','Ng8'])repeat.move(m);
 assert.equal(battleResult(repeat,8,0).reason,'Троекратное повторение');
 assert.equal(battleResult(new Chess('7k/8/6K1/8/8/8/8/R7 w - - 100 60'),0,0).winner,null);
});
test('saved run round trips and corrupted budget or moves fail closed',()=>{
 const run=beginBattle(prepared());assert.deepEqual(restoreAutoRun(JSON.stringify(run)),run);
 assert.throws(()=>restoreAutoRun(JSON.stringify({...run,reserve:999})));
 assert.throws(()=>restoreAutoRun(JSON.stringify({...run,battle:{...run.battle,moves:['e1e8']}})));
});
const harness=()=>{
 let run=beginBattle(prepared()),now=0,resolveMove,terminated=0;const timers=new Map();let timerId=0;
 const errors=[];
 const controller=createBattleController({getRun:()=>run,save:next=>{run=next;return true;},onChange:()=>{},onError:message=>errors.push(message),clock:()=>now,schedule:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},cancel:id=>timers.delete(id),engineFactory:()=>({ready:Promise.resolve(),search:()=>new Promise(resolve=>{resolveMove=resolve;}),terminate:()=>{terminated++;}})});
 return {controller,get:()=>run,setTime:value=>{now=value;},move:()=>{const m=battleGame(run).moves({verbose:true})[0];resolveMove(m.from+m.to+(m.promotion||''));},timers,errors,terminated:()=>terminated};
};
test('late engine answer at deadline is discarded',async()=>{
 const h=harness();await h.controller.start();h.setTime(30000);h.move();await Promise.resolve();
 assert.equal(h.get().phase,'result');assert.equal(h.get().battle.moves.length,0);assert.equal(h.get().battle.elapsed,30000);assert.equal(h.terminated(),1);
});
test('pause preserves elapsed time, rejects old answer and resumes remaining time',async()=>{
 const h=harness();await h.controller.start();h.setTime(4321);h.controller.pause();h.move();await Promise.resolve();
 assert.equal(h.get().battle.elapsed,4321);assert.equal(h.get().battle.moves.length,0);
 h.setTime(20000);await h.controller.start();assert.ok([...h.timers.values()].some(timer=>timer.ms===25679));h.controller.dispose();
});
test('accepted move persists actual history and duplicate completion is inert',async()=>{
 const h=harness();await h.controller.start();h.setTime(100);h.move();await Promise.resolve();
 assert.equal(h.get().battle.moves.length,1);assert.equal(h.get().battle.elapsed,100);
 const finished=completeBattle(h.get(),{winner:null,reason:'test'});assert.equal(completeBattle(finished,{winner:'w',reason:'test'}),finished);h.controller.dispose();
});
test('autoplay config is symmetric and sends newgame only once',async()=>{
 const commands=[];const worker={postMessage:command=>commands.push(command),terminate:()=>{}};
 const client=createAutoplayEngine(()=>worker);worker.onmessage({data:'uciok'});worker.onmessage({data:'readyok'});await client.ready;
 const first=client.search(new Chess().fen(),[]);worker.onmessage({data:'bestmove e2e4'});assert.equal(await first,'e2e4');
 const second=client.search(new Chess().fen(),['e2e4']);worker.onmessage({data:'bestmove e7e5'});await second;
 assert.equal(commands.filter(command=>command==='ucinewgame').length,1);
 assert.ok(commands.includes('setoption name UCI_LimitStrength value false'));assert.ok(!commands.some(command=>command.includes('UCI_Elo')));
 assert.equal(commands.filter(command=>command==='go movetime 100').length,2);client.terminate();
});

test('new series starts with three coins; previous series keep their budget',()=>{
 const fresh=createAutoRun('new');assert.equal(fresh.reserve,3);assert.equal(buyPiece(fresh,'q'),fresh);assert.equal(buyPiece(fresh,'n').reserve,0);
 const old={...createAutoRun('legacy'),version:1,reserve:12};old.opponent=opponentFor(old.seed,1,old.color==='w'?'b':'w',12);
 assert.deepEqual(restoreAutoRun(JSON.stringify(old)),old);
 const advanced=nextRound(completeBattle(beginBattle(old),{winner:null,reason:'test'}));assert.equal(advanced.reserve,15);assert.deepEqual(restoreAutoRun(JSON.stringify(advanced)),advanced);
});


test('memory failure during engine creation or readiness preserves paused battle',async()=>{
 for(const asynchronous of [false,true]){
  let run=beginBattle(prepared());run={...run,battle:{...run.battle,elapsed:4321}};
  const before=structuredClone(run.battle),errors=[];let terminated=0;
  const controller=createBattleController({getRun:()=>run,save:next=>{run=next;return true;},onChange:()=>{},onError:message=>errors.push(message),engineFactory:()=>{
   if(!asynchronous)throw new RangeError('Out of memory');
   return {ready:Promise.reject(new RangeError('Out of memory')),terminate:()=>terminated++};
  }});
  await controller.start();assert.equal(run.phase,'paused');assert.deepEqual(run.battle,before);
  assert.equal(controller.isActive(),false);assert.equal(controller.isPreparing(),false);
  assert.match(errors[0],/Не хватает памяти/);assert.equal(terminated,Number(asynchronous));controller.dispose();
 }
});
