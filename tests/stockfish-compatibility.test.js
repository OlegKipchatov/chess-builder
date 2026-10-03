import test from 'node:test';
import assert from 'node:assert/strict';
import {detectStockfishCapabilities} from '../dist/stockfish-capabilities.js';
import {createStockfishClient} from '../dist/stockfish-client.js';
import {createAutoplayEngine} from '../dist/autochess-engine.js';
import {analyzeReward} from '../dist/economy-analysis.js';
import {createSession} from '../dist/cognitive-model.js';
import {Chess} from '../dist/chess.js';
import {STOCKFISH as C} from '../dist/stockfish-config.js';
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const supported={crossOriginIsolated:true,SharedArrayBuffer,WebAssembly};
for(const [name,scope,expected] of [
 ['isolated shared WASM',supported,true],
 ['non-isolated',{...supported,crossOriginIsolated:false},false],
 ['no SAB',{...supported,SharedArrayBuffer:undefined},false],
 ['shared allocation fails',{...supported,WebAssembly:{Memory:class {constructor(){throw Error('blocked');}}}},false],
 ['no WASM',{...supported,WebAssembly:undefined},false]
])test(`capability: ${name}`,()=>assert.equal(detectStockfishCapabilities(scope).threaded,expected));
let serial=0;
const harness=async(t,{isolated=true,failThread=false,failSingle=false,hold=false,holdStop=false,crash=false}={})=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'crossOriginIsolated');
 Object.defineProperty(globalThis,'crossOriginIsolated',{configurable:true,value:isolated});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'crossOriginIsolated',original);else delete globalThis.crossOriginIsolated;});
 const instances=[];let live=0,peak=0;
 t.mock.method(console,'debug',()=>{});
 t.mock.property(globalThis,'Worker',class {
  constructor(url){this.variant=url.includes('single-worker')?'single':'threaded';this.commands=[];this.alive=true;instances.push(this);live++;peak=Math.max(peak,live);}
  emit(data){this.onmessage?.({data});}
  postMessage(data){
   this.commands.push(data);
   if(data?.type==='STOP_ENGINE'){if(!holdStop)queueMicrotask(()=>this.emit({type:'ENGINE_STOPPED'}));return;}
   if(hold)return;
   if(data==='uci')queueMicrotask(()=>{
    if(this.variant==='threaded'&&failThread||this.variant==='single'&&failSingle)this.emit({type:'ENGINE_INIT_ERROR',recoverable:failThread!=='programming',message:failThread==='programming'?'ReferenceError: typo':'WebAssembly initialization failed'});
    else this.emit('uciok');
   });
   if(data==='isready')queueMicrotask(()=>this.emit('readyok'));
   if(typeof data==='string'&&data.startsWith('go '))queueMicrotask(()=>{
    if(crash){this.onerror?.({message:'runtime crashed'});return;}
    const move=data.match(/searchmoves (\w+)/)?.[1]||'e2e4';
    this.emit(`info depth 12 multipv 1 score cp 0 wdl 100 800 100 nodes 50000 pv ${move}`);this.emit(`bestmove ${move}`);
   });
  }
  terminate(){assert.ok(this.alive);this.alive=false;live--;}
 });
 const module=await import(`../dist/stockfish-lifecycle.js?test=${serial++}`);
 return {...module,instances,live:()=>live,peak:()=>peak};
};
// Node's mock.property is not available in all supported Node releases.
const withWorker=async(t,options)=>{
 if(!('Worker' in globalThis)){globalThis.Worker=class {};t.after(()=>delete globalThis.Worker);}
 if(!t.mock.property)t.mock.property=(object,key,value)=>{const old=object[key];object[key]=value;t.after(()=>{object[key]=old;});};
 return harness(t,options);
};
test('threaded succeeds: never create fallback; queued request delivered once',async t=>{
 const h=await withWorker(t),worker=h.createEngineWorker(),lines=[];worker.onmessage=({data})=>lines.push(data);worker.postMessage('uci');await flush();
 assert.deepEqual(h.instances.map(x=>x.variant),['threaded']);assert.deepEqual(lines,['uciok']);worker.terminate();await flush();assert.equal(h.live(),0);
});
test('non-isolated immediately selects single',async t=>{
 const h=await withWorker(t,{isolated:false}),worker=h.createEngineWorker();await flush();assert.equal(worker.variant,'single');assert.equal(h.instances.length,1);worker.terminate();await flush();
});
test('initialization fallback waits for retirement, forwards request and remembers incompatibility',async t=>{
 const h=await withWorker(t,{failThread:true,holdStop:true}),worker=h.createEngineWorker(),lines=[];worker.onmessage=({data})=>lines.push(data);worker.postMessage('uci');await flush();
 assert.equal(h.instances.length,1);assert.ok(h.instances[0].commands.some(x=>x.type==='STOP_ENGINE'));
 h.instances[0].emit({type:'ENGINE_STOPPED'});await flush();assert.deepEqual(h.instances.map(x=>x.variant),['threaded','single']);assert.deepEqual(lines,['uciok']);assert.equal(h.peak(),1);
 worker.terminate();h.instances[1].emit({type:'ENGINE_STOPPED'});await flush();
 const next=h.createEngineWorker();await flush();assert.equal(next.variant,'single');next.terminate();h.instances[2].emit({type:'ENGINE_STOPPED'});await flush();assert.equal(h.live(),0);
});
test('both variants fail: one final error and no live workers',async t=>{
 const h=await withWorker(t,{failThread:true,failSingle:true}),worker=h.createEngineWorker(),errors=[];worker.onerror=e=>errors.push(e);await flush();assert.equal(errors.length,1);assert.equal(h.instances.length,2);assert.equal(h.live(),0);assert.equal(worker.onmessage,null);
});
test('programming errors do not trigger compatibility fallback',async t=>{
 const h=await withWorker(t,{failThread:'programming'}),worker=h.createEngineWorker(),errors=[];worker.onerror=e=>errors.push(e);await flush();assert.equal(errors.length,1);assert.equal(h.instances.length,1);assert.equal(h.live(),0);
});
test('termination during initialization and before allocation clears pending work',async t=>{
 const h=await withWorker(t,{hold:true});
 const cancelled=h.createEngineWorker();cancelled.postMessage('uci');cancelled.terminate();await flush();assert.equal(h.instances.length,0);
 const worker=h.createEngineWorker();worker.postMessage('uci');await flush();worker.terminate();await flush();assert.equal(h.live(),0);assert.equal(worker.onerror,null);
});
test('repeated games release all workers',async t=>{
 const h=await withWorker(t,{isolated:false});
 for(let i=0;i<15;i++){const worker=h.createEngineWorker();await flush();worker.terminate();}
 await flush();assert.equal(h.live(),0);assert.equal(h.peak(),1);
});
const ask=async(client,data)=>new Promise((resolve,reject)=>{client.onmessage=event=>resolve(event.data);client.onerror=reject;client.postMessage(data);});
for(const mode of ['move','analysis','economy'])test(`${mode} request survives threaded initialization failure without ordinary retry`,async t=>{
 const h=await withWorker(t,{failThread:true}),client=createStockfishClient(h.createEngineWorker);
 const result=await ask(client,{id:1,fen:new Chess().fen(),engineProfile:createSession(1500,42),...(mode==='analysis'?{analysisOnly:true,analysis:{mode:'nodes',nodes:50000,multiPv:1}}:{}),...(mode==='economy'?{economy:true}:{})});
 assert.ok(new Chess().move(result.move));if(mode==='analysis')assert.equal(result.lines.length,1);if(mode==='economy')assert.ok(result.evaluation);
 assert.equal(h.instances.length,2);assert.equal(h.peak(),1);client.terminate();await flush();assert.equal(h.live(),0);
});
test('reward pipeline does not consume runtime retries on compatibility fallback',async t=>{
 const h=await withWorker(t,{failThread:true});let retries=0,clients=0;
 const result=await analyzeReward({pgn:'1. e4',playerColor:'w'},{createClient:()=>{clients++;return createStockfishClient(h.createEngineWorker);},onRetry:()=>retries++});
 assert.ok(result);assert.equal(clients,1);assert.equal(retries,0);await flush();assert.equal(h.live(),0);
});
test('Autochess uses the same fallback and cleanup',async t=>{
 const h=await withWorker(t,{failThread:true}),engine=createAutoplayEngine(h.createEngineWorker);await engine.ready;assert.equal(await engine.search(new Chess().fen(),[]),'e2e4');engine.terminate();await flush();assert.equal(h.live(),0);assert.equal(h.peak(),1);
});
test('terminate during search prevents late result',async t=>{
 const h=await withWorker(t),client=createStockfishClient(h.createEngineWorker);await flush();let replies=0;client.onmessage=()=>replies++;
 client.postMessage({id:1,fen:new Chess().fen(),engineProfile:createSession(1500,42)});client.terminate();await flush();assert.equal(replies,0);assert.equal(h.live(),0);
});
test('runtime crash after readiness is propagated, never switches variant',async t=>{
 const h=await withWorker(t,{crash:true}),client=createStockfishClient(h.createEngineWorker);
 await assert.rejects(ask(client,{id:1,fen:new Chess().fen(),engineProfile:createSession(1500,42)}),/runtime crashed/);await flush();assert.equal(h.instances.length,1);assert.equal(h.live(),0);
});
test('Autochess runtime watchdog remains an ordinary restart after fallback',async t=>{
 const h=await withWorker(t,{failThread:true});t.mock.timers.enable({apis:['setTimeout']});
 const engine=createAutoplayEngine(h.createEngineWorker);await engine.ready;
 h.instances.at(-1).postMessage=()=>{};
 const rejected=assert.rejects(engine.search(new Chess().fen(),[]),/не ответил/);
 t.mock.timers.tick(4000);await rejected;t.mock.timers.tick(C.retirementMs);await flush();
 const next=createAutoplayEngine(h.createEngineWorker);await next.ready;assert.equal(h.instances.at(-1).variant,'single');assert.equal(h.instances.length,3);next.terminate();await flush();assert.equal(h.live(),0);
});
test('initialization timeout falls back once without overlapping heaps',async t=>{
 const h=await withWorker(t,{hold:true});t.mock.timers.enable({apis:['setTimeout']});const worker=h.createEngineWorker();await flush();
 t.mock.timers.tick(C.variantInitializationMs);await flush();assert.equal(h.instances.length,2);assert.equal(worker.variant,'single');assert.equal(h.peak(),1);worker.terminate();await flush();assert.equal(h.live(),0);
});
test('terminate while fallback is retiring never allocates the next heap',async t=>{
 const h=await withWorker(t,{failThread:true,holdStop:true}),worker=h.createEngineWorker();await flush();worker.terminate();h.instances[0].emit({type:'ENGINE_STOPPED'});await flush();assert.equal(h.instances.length,1);assert.equal(h.live(),0);
});
test('threaded wrapper terminates nested workers before acknowledging retirement',async()=>{
 const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');
 const code=(await readFile(new URL('../dist/stockfish19-worker.js',import.meta.url),'utf8')).replace(/^import .*;\n/,'').replaceAll('import.meta.url',"'https://example.test/stockfish19-worker.js?v=104'");
 let finishInitialization,stopped=0,closed=false;const messages=[];
 const self={crossOriginIsolated:true,Worker:class {terminate(){stopped++;}},postMessage:data=>messages.push(data),close:()=>{closed=true;}};
 runInNewContext(code,{self,SharedArrayBuffer,WebAssembly:{Memory:class {}},createStockfish:()=>new Promise(resolve=>{finishInitialization=resolve;}),URL,Uint8Array,fetch:()=>assert.fail('Initialization continued after shutdown')});
 new self.Worker();new self.Worker();self.onmessage({data:'uci'});self.onmessage({data:{type:'STOP_ENGINE'}});
 assert.equal(stopped,2);assert.equal(closed,true);assert.equal(messages[0].type,'ENGINE_STOPPED');finishInitialization({});await flush();assert.equal(messages.length,1);
});
