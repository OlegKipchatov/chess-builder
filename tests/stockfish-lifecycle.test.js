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
