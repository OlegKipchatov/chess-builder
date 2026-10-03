// Wait for the previous worker tree to stop before allocating another WASM heap.
let retirement=Promise.resolve();
export const createEngineWorker = () => {
 let worker=null,closed=false;
 const queued=[];
 const proxy={onmessage:null,onerror:null,postMessage:data=>{if(closed)return;if(worker)worker.postMessage(data);else queued.push(data);},terminate:()=>{
  if(closed)return;closed=true;queued.length=0;proxy.onmessage=null;proxy.onerror=null;
  const previous=worker;worker=null;if(!previous)return;
  const shutdown=new Promise(resolve=>{
   let timer,finished=false;
   const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);previous.onmessage=null;previous.onerror=null;previous.terminate();resolve();};
   previous.onmessage=event=>{if(event.data?.type==='ENGINE_STOPPED')finish();};
   previous.onerror=finish;
   timer=setTimeout(finish,750);
   try{previous.postMessage({type:'STOP_ENGINE'});}catch{finish();}
  });
  retirement=Promise.all([retirement,shutdown]).then(()=>undefined);
 }};
 void retirement.then(()=>{
  if(closed)return;
  try{
   worker=new Worker('./stockfish19-worker.js?v=103',{type:'module'});
   worker.onmessage=event=>proxy.onmessage?.(event);
   worker.onerror=event=>proxy.onerror?.(event);
   queued.splice(0).forEach(data=>worker.postMessage(data));
  }catch(error){proxy.onerror?.({message:error.message});}
 });
 return proxy;
};
