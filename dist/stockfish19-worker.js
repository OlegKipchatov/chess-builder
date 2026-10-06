import createStockfish from './vendor/sf19/sf_19_smallnet.js?v=112';
let engine=null,closed=false;
const queue=[];
// Emscripten can create nested pthread workers even with Threads=1.
const children=new Set(),NativeWorker=self.Worker;
self.Worker=class extends NativeWorker {
 constructor(...args){super(...args);children.add(this);}
 terminate(){children.delete(this);super.terminate();}
};
self.onmessage=event=>{
 if(event.data?.type==='STOP_ENGINE'){
  closed=true;for(const child of children)child.terminate();
  queue.length=0;engine=null;self.postMessage({type:'ENGINE_STOPPED'});self.close();return;
 }
 if(engine)engine.uci(event.data);else queue.push(event.data);
};
const initialize=async()=>{
 if(!self.crossOriginIsolated||typeof SharedArrayBuffer==='undefined')throw Object.assign(Error('Stockfish shared memory requires isolation'),{recoverable:true});
 // The bundled default reserves a shared memory maximum of 2 GiB per worker.
 // 64 MiB is the import minimum; runtime allocations require growth beyond it.
 let instance;
 try{
  const wasmMemory=new WebAssembly.Memory({initial:1024,maximum:2048,shared:true});
  instance=await createStockfish({wasmMemory,mainScriptUrlOrBlob:new URL('./vendor/sf19/sf_19_smallnet.js?v=112',import.meta.url).href,locateFile:path=>new URL('./vendor/sf19/'+path+'?v=112',import.meta.url).href});
 }catch(error){if(!(error instanceof ReferenceError)&&!(error instanceof SyntaxError)&&(error instanceof WebAssembly.CompileError||error instanceof WebAssembly.LinkError||error instanceof WebAssembly.RuntimeError||error instanceof RangeError||/wasm|memory|pthread|Atomics/i.test(error.message)))error.recoverable=true;throw error;}
 if(closed)return;
 instance.listen=data=>self.postMessage(data);
 instance.onError=message=>{throw Error(message);};
 const response=await fetch('./vendor/sf19/nn-61e7af4bb97d.nnue?v=112');
 if(!response.ok)throw Error('Stockfish 19 network unavailable');
 instance.setNnueBuffer(new Uint8Array(await response.arrayBuffer()),0);
 if(closed)return;
 engine=instance;queue.splice(0).forEach(command=>engine.uci(command));
};
initialize().catch(error=>{if(!closed)self.postMessage({type:'ENGINE_INIT_ERROR',message:error.message,recoverable:error.recoverable===true});});
