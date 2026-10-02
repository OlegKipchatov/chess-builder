import createStockfish from './vendor/sf19/sf_19_smallnet.js';
let engine=null;
const queue=[];
// Emscripten can create nested pthread workers even with Threads=1.
const children=new Set(),NativeWorker=self.Worker;
self.Worker=class extends NativeWorker {
 constructor(...args){super(...args);children.add(this);}
 terminate(){children.delete(this);super.terminate();}
};
self.onmessage=event=>{
 if(event.data?.type==='STOP_ENGINE'){
  for(const child of children)child.terminate();
  queue.length=0;engine=null;self.postMessage({type:'ENGINE_STOPPED'});self.close();return;
 }
 if(engine)engine.uci(event.data);else queue.push(event.data);
};
const initialize=async()=>{
 if(!self.crossOriginIsolated||typeof SharedArrayBuffer==='undefined')throw Error('Stockfish 19 requires an isolated page. Reload after the offline update.');
 // The bundled default reserves a shared memory maximum of 2 GiB per worker.
 // 64 MiB is the import minimum; runtime allocations require growth beyond it.
 const wasmMemory=new WebAssembly.Memory({initial:1024,maximum:2048,shared:true});
 const instance=await createStockfish({wasmMemory});
 instance.listen=data=>self.postMessage(data);
 instance.onError=message=>{throw Error(message);};
 const response=await fetch('./vendor/sf19/nn-61e7af4bb97d.nnue');
 if(!response.ok)throw Error('Stockfish 19 network unavailable');
 instance.setNnueBuffer(new Uint8Array(await response.arrayBuffer()),0);
 engine=instance;queue.splice(0).forEach(command=>engine.uci(command));
};
initialize().catch(error=>{setTimeout(()=>{throw error;},0);});
