import {detectStockfishCapabilities} from './stockfish-capabilities.js?v=116';
import {STOCKFISH as C} from './stockfish-config.js?v=116';
// Shared across all clients, including Autochess. Never allocate a replacement
// heap before the previous tree acknowledges shutdown (or is forcibly stopped).
let retirement=Promise.resolve(),threadedFailure=null,restartReason=null;
const diagnostic = (event,details) => console.debug('[Stockfish]',event,details);
const retire = worker => {
 const shutdown=new Promise(resolve=>{
  let timer,finished=false;
  const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);worker.onmessage=null;worker.onerror=null;worker.terminate();resolve();};
  worker.onmessage=event=>{if(event.data?.type==='ENGINE_STOPPED')finish();};
  worker.onerror=finish;
  timer=setTimeout(finish,C.retirementMs);
  try{worker.postMessage({type:'STOP_ENGINE'});}catch{finish();}
 });
 retirement=Promise.all([retirement,shutdown]).then(()=>undefined);
 return retirement;
};
const environmentFailure = error => /WebAssembly|\bwasm\b|SharedArrayBuffer|shared memory|cross.origin|Atomics|pthread|module.*worker|worker.*module|out of memory|allocation failed/i.test(error?.message||'')&&!/ReferenceError|SyntaxError/.test(error?.message||'');
export const createEngineWorker = () => {
 const capability=detectStockfishCapabilities();
 let variant=capability.threaded&&!threadedFailure?'threaded':'single';
 let worker=null,closed=false,initialized=false,timer=null;
 const queued=[];
 const dispose=()=>{clearTimeout(timer);const old=worker;worker=null;return old?retire(old):retirement;};
 const fail=error=>{
  if(closed)return;
  const handler=proxy.onerror;
  proxy.terminate();handler?.({message:error.message||'Stockfish worker failed',error});
 };
 const initializationFailed=(error,recoverable)=>{
  if(closed)return;
  diagnostic('initialization failure',{variant,message:error.message});
  if(variant!=='threaded'||!recoverable){fail(error);return;}
  threadedFailure=error.message;variant='single';
  diagnostic('fallback',{variant,reason:threadedFailure});
  void dispose().then(start);
 };
 const proxy={onmessage:null,onerror:null,get variant(){return variant;},postMessage:data=>{
  if(closed)return;
  if(initialized&&worker)worker.postMessage(data);else queued.push(data);
 },terminate:()=>{
  if(closed)return;closed=true;queued.length=0;proxy.onmessage=null;proxy.onerror=null;void dispose();
 }};
 const start=()=>{
  if(closed)return;
  if(!capability.wasm){fail(Error('WebAssembly unavailable'));return;}
  try{
   const url=variant==='threaded'?'./stockfish19-worker.js?v=116':'./stockfish19-single-worker.js?v=116';
   const owned=new Worker(url,variant==='threaded'?{type:'module'}:undefined);worker=owned;
   timer=setTimeout(()=>initializationFailed(Error('Stockfish initialization timeout'),true),C.variantInitializationMs);
   owned.onmessage=event=>{
    if(closed||worker!==owned)return;
    if(event.data?.type==='ENGINE_INIT_ERROR'){initializationFailed(Error(event.data.message),event.data.recoverable===true);return;}
    if(!initialized){
     for(const line of String(event.data).split('\n')){
      if(line.trim()==='uciok')owned.postMessage('isready');
      if(line.trim()==='readyok'){
       initialized=true;clearTimeout(timer);
       diagnostic('ready',{variant,threadedCapability:capability.threaded});
       queued.splice(0).forEach(data=>owned.postMessage(data));return;
      }
     }
     return;
    }
    proxy.onmessage?.(event);
   };
   owned.onerror=event=>{
    if(closed||worker!==owned)return;
    if(!initialized){initializationFailed(event,environmentFailure(event));return;}
    restartReason=event.message||'worker crashed';
    diagnostic('runtime failure',{variant,reason:restartReason});fail(event);
   };
   owned.postMessage('uci');
  }catch(error){initializationFailed(error,environmentFailure(error));}
 };
 diagnostic('selection',{variant,threadedCapability:capability.threaded,reason:capability.reason||threadedFailure});
 if(restartReason){diagnostic('runtime restart',{variant,reason:restartReason});restartReason=null;}
 void retirement.then(start);
 return proxy;
};
export const recordStockfishRestart = reason => {restartReason=reason;diagnostic('runtime restart requested',{reason});};
