// Classic worker: the pinned Stockfish.js build owns its UCI message handler.
// Its NNUE is embedded in WASM. Do not use URL fragments: a cached Worker
// response can discard them when setting WorkerLocation. The pinned build
// substitutes only its default WASM locator with this explicit release URL.
self.STOCKFISH_WASM_URL=new URL('./vendor/sf19-single/stockfish-19-lite-single.wasm?v=104',self.location.href).href;
importScripts('./vendor/sf19-single/stockfish-19-lite-single.js?v=104');
const uciHandler=self.onmessage;
self.onmessage=event=>{
 if(event.data?.type==='STOP_ENGINE'){
  self.onmessage=null;self.postMessage({type:'ENGINE_STOPPED'});self.close();return;
 }
 uciHandler(event);
};
