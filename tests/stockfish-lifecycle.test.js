import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngineWorker} from '../dist/stockfish-lifecycle.js';
test('successive engine starts wait for shutdown acknowledgement and release handlers',async()=>{
 const original=globalThis.Worker,instances=[];let alive=0,peak=0;
 globalThis.Worker=class {
  constructor(){this.messages=[];instances.push(this);alive++;peak=Math.max(peak,alive);}
  postMessage(data){this.messages.push(data);if(data?.type==='STOP_ENGINE')queueMicrotask(()=>this.onmessage?.({data:{type:'ENGINE_STOPPED'}}));}
  terminate(){alive--;}
 };
 try{
  for(let i=0;i<12;i++){
   const proxy=createEngineWorker();proxy.postMessage('uci');await new Promise(resolve=>setTimeout(resolve,0));
   assert.deepEqual(instances.at(-1).messages,['uci']);proxy.terminate();
   assert.equal(proxy.onmessage,null);assert.equal(proxy.onerror,null);
  }
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(alive,0);assert.equal(peak,1);assert.equal(instances.length,12);
  assert.ok(instances.every(worker=>worker.onmessage===null&&worker.onerror===null));
 }finally{globalThis.Worker=original;}
});
test('unresponsive worker is forcibly stopped before the replacement starts',async()=>{
 const OriginalWorker=globalThis.Worker,originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
 const timers=new Map();let serial=0,live=0,peak=0,created=0;
 globalThis.setTimeout=fn=>{timers.set(++serial,fn);return serial;};globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.Worker=class {constructor(){created++;live++;peak=Math.max(peak,live);}postMessage(){}terminate(){live--;}};
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 try{
  const first=createEngineWorker();await flush();first.terminate();
  const second=createEngineWorker();await flush();assert.equal(created,1);assert.equal(live,1);
  [...timers.values()][0]();await flush();assert.equal(created,2);assert.equal(live,1);assert.equal(peak,1);
  second.terminate();[...timers.values()][0]();await flush();assert.equal(live,0);assert.equal(timers.size,0);
 }finally{globalThis.Worker=OriginalWorker;globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
});
