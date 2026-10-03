import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleController} from '../dist/autochess-battle.js';
import {createAutoplayEngine,createAutoplaySession} from '../dist/autochess-engine.js';
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
const harness=factory=>{
 let run={color:'w',phase:'paused',results:[],battle:{id:'retry:1',initialFen:'4k3/7p/8/8/8/8/P7/4K3 w - - 0 1',moves:[],elapsed:0}},saves=0;
 const errors=[],timers=[];
 const controller=createBattleController({getRun:()=>run,save:next=>{run=next;saves++;return true;},onChange:()=>{},onError:error=>errors.push(error),engineFactory:factory,schedule:fn=>{timers.push(fn);return fn;},cancel:fn=>{const i=timers.indexOf(fn);if(i>=0)timers.splice(i,1);}});
 return {controller,get:()=>run,errors,timers,saves:()=>saves};
};
test('two failed calculations restart fresh engines on the exact saved position, then commit once',async()=>{
 let created=0,live=0,maxLive=0;const queries=[],stopped=[];
 const h=harness(()=>{
  const id=++created;live++;maxLive=Math.max(maxLive,live);let dead=false;
  return {ready:Promise.resolve(),search:async(fen,moves)=>{queries.push([fen,moves]);if(id<3)throw Error('Движок не ответил');return 'a2a3';},terminate:()=>{if(!dead){dead=true;live--;stopped.push(id);}}};
 });
 await h.controller.start();await flush();
 assert.equal(created,3);assert.equal(maxLive,1);assert.deepEqual(stopped,[1,2]);assert.equal(h.saves(),1);assert.deepEqual(h.get().battle.moves,['a2a3']);assert.deepEqual(h.errors,[]);
 assert.deepEqual(queries,[queries[0],queries[0],queries[0]]);assert.equal(h.controller.retryAttempt(),1);h.controller.dispose();assert.equal(live,0);
});
test('readiness failures and search failures share three attempts for the same move',async()=>{
 let created=0,stopped=0;
 const h=harness(()=>{const id=++created;return {ready:id===1?Promise.reject(Error('startup')):Promise.resolve(),search:async()=>{throw Error('Движок не ответил');},terminate:()=>{stopped++;}};});
 await h.controller.start();await flush();
 assert.equal(created,3);assert.equal(stopped,3);assert.equal(h.errors.length,1);assert.match(h.errors[0],/3 попыток/);assert.deepEqual(h.get().battle.moves,[]);assert.equal(h.get().phase,'paused');assert.equal(h.controller.isPreparing(),false);assert.equal(h.controller.isActive(),false);
});
test('a successful move resets retry allowance for the next position',async()=>{
 let created=0,calls=0;const queried=[];
 const h=harness(()=>{const id=++created;return {ready:Promise.resolve(),search:async(fen,moves)=>{calls++;queried.push(moves);if(id===1||id===3||(id===2&&moves.length))throw Error('timeout');return moves.length?'h7h6':'a2a3';},terminate:()=>{}};});
 await h.controller.start();await flush();h.timers.shift()();await flush();
 assert.equal(created,4);assert.deepEqual(h.get().battle.moves,['a2a3','h7h6']);assert.deepEqual(queried.slice(2),[['a2a3'],['a2a3'],['a2a3']]);assert.deepEqual(h.errors,[]);h.controller.dispose();
});
test('pause while restarting suppresses late readiness, retries and error UI',async()=>{
 let created=0,resolveReady,stopped=0;
 const h=harness(()=>{const id=++created;return {ready:id===1?Promise.resolve():new Promise(resolve=>{resolveReady=resolve;}),search:async()=>{throw Error('timeout');},terminate:()=>{stopped++;}};});
 await h.controller.start();await flush();assert.equal(created,2);h.controller.pause();resolveReady();await flush();
 assert.equal(created,2);assert.equal(stopped,2);assert.deepEqual(h.errors,[]);assert.deepEqual(h.get().battle.moves,[]);assert.equal(h.controller.isPreparing(),false);
});
test('late search response after pause cannot save a move',async()=>{
 let resolveMove;
 const h=harness(()=>({ready:Promise.resolve(),search:()=>new Promise(resolve=>{resolveMove=resolve;}),terminate:()=>{}}));
 await h.controller.start();await flush();h.controller.pause();const saves=h.saves();resolveMove('a2a3');await flush();
 assert.equal(h.saves(),saves);assert.deepEqual(h.get().battle.moves,[]);assert.deepEqual(h.errors,[]);
});
test('unsupported positions are not retried and save errors do not replay engine work',async()=>{
 let created=0;
 const h=harness(()=>{created++;return {ready:Promise.resolve(),search:async()=>{throw Object.assign(Error('unsupported'),{code:'UNSUPPORTED_POSITION'});},terminate:()=>{}};});
 await h.controller.start();await flush();assert.equal(created,1);assert.equal(h.errors.length,1);
 let calls=0,error='';const run={...h.get(),battle:{...h.get().battle,moves:[]}};
 const c=createBattleController({getRun:()=>run,save:()=>false,onChange:()=>{},onError:e=>{error=e;},engineFactory:()=>({ready:Promise.resolve(),search:async()=>{calls++;return 'a2a3';},terminate:()=>{}})});
 await c.start();await flush();assert.equal(calls,1);assert.match(error,/сохранить/);c.dispose();
});
test('session releases every completed worker and never reuses a previous heap',async()=>{
 let created=0,stopped=0;
 const session=createAutoplaySession(()=>{created++;let dead=false;return {ready:Promise.resolve(),search:async()=>'',terminate:()=>{if(!dead){dead=true;stopped++;}}};});
 for(let i=0;i<20;i++){const engine=session.create();await engine.ready;engine.release();assert.equal(stopped,created);}
 assert.equal(created,20);session.dispose();assert.equal(stopped,20);
});
test('checkmate completion terminates the engine even if it offers a retained release',async()=>{
 let stopped=0,released=0;
 const run={color:'w',phase:'paused',results:[],battle:{id:'mate:1',initialFen:'7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',moves:[],elapsed:0}};
 let state=run;
 const c=createBattleController({getRun:()=>state,save:next=>{state=next;return true;},onChange:()=>{},onError:e=>assert.fail(e),engineFactory:()=>({ready:Promise.resolve(),search:async()=> 'f7g7',terminate:()=>{stopped++;},release:()=>{released++;}})});
 await c.start();await flush();assert.equal(state.phase,'result');assert.equal(stopped,1);assert.equal(released,0);assert.equal(state.results.length,1);c.dispose();assert.equal(stopped,1);
});
test('autoplay timeout terminates worker and clears callbacks before rejection',async()=>{
 const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout,timers=new Map();let serial=0,terminated=0;
 globalThis.setTimeout=fn=>{timers.set(++serial,fn);return serial;};globalThis.clearTimeout=id=>timers.delete(id);
 try{
  const worker={postMessage:()=>{},terminate:()=>{terminated++;}};
  const engine=createAutoplayEngine(()=>worker);worker.onmessage({data:'readyok'});await engine.ready;
  const request=engine.search('test',[]),rejected=assert.rejects(request,/не ответил/);[...timers.values()][0]();await rejected;
  assert.equal(terminated,1);assert.equal(worker.onmessage,null);assert.equal(worker.onerror,null);assert.equal(timers.size,0);engine.terminate();assert.equal(terminated,1);
 }finally{globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
});
