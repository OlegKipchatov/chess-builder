import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.js':'text/javascript','.wasm':'application/wasm','.html':'text/html'};
let isolation=false,broken=false;
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const headers={'Content-Type':mime[extname(pathname)]||'application/octet-stream'};
  if(isolation){headers['Cross-Origin-Opener-Policy']='same-origin';headers['Cross-Origin-Embedder-Policy']='require-corp';}
  if(pathname==='/probe.html'){res.writeHead(200,headers);res.end('<!doctype html><title>Stockfish probe</title>');return;}
  const path=resolve(root,'.'+pathname);if(!path.startsWith(root))throw Error();
  const bytes=broken&&pathname.endsWith('/sf_19_smallnet.wasm')?Buffer.from('invalid wasm'):await readFile(path);
  res.writeHead(200,headers);res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
try{
 for(const mode of ['threaded','single','init-fallback']){
  isolation=mode!=='single';broken=mode==='init-fallback';
  const context=await browser.newContext();const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/probe.html`);
  const result=await page.evaluate(async()=>{
   const NativeWorker=Worker;let live=0,peak=0;const variants=[];
   window.Worker=class extends NativeWorker{
    constructor(url,options){super(url,options);this.dead=false;live++;peak=Math.max(peak,live);variants.push(String(url).includes('single-worker')?'single':'threaded');}
    terminate(){if(!this.dead){this.dead=true;live--;}super.terminate();}
   };
   const {createStockfishClient}=await import('./stockfish-client.js?v=104');
   const {createAutoplayEngine}=await import('./autochess-engine.js?v=104');
   const {createSession}=await import('./cognitive-model.js?v=104');
   const {Chess}=await import('./chess.js?v=104');
   const {analyzeReward}=await import('./economy-analysis.js?v=104');
   const {analyzeGame}=await import('./analysis/analysis-service.js?v=104');
   const wait=async()=>{for(let i=0;i<100&&live;i++)await new Promise(r=>setTimeout(r,20));if(live)throw Error('Orphan workers');};
   for(let i=0;i<3;i++){
    const client=createStockfishClient();
    try{const response=await new Promise((resolve,reject)=>{client.onmessage=({data})=>resolve(data);client.onerror=reject;client.postMessage({id:1,fen:new Chess().fen(),engineProfile:createSession(1500,42)});});if(!new Chess().move(response.move))throw Error('Illegal move');}
    finally{client.terminate();}await wait();
   }
   const entry={id:'probe',mode:'bot',pgn:'1. f3 e5 2. g4 Qh4#',playerColor:'w',result:'loss',finishedAt:new Date().toISOString()};
   const reward=await analyzeReward(entry);await wait();
   const analysis=await analyzeGame(entry);await wait();if(analysis.status!=='complete')throw Error('Analysis failed');
   const engine=createAutoplayEngine();await engine.ready;
   const board=new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
   const move=await engine.search(board.fen(),[]);board.move({from:move.slice(0,2),to:move.slice(2,4)});if(!board.isCheckmate())throw Error('Autochess did not finish');engine.terminate();await wait();
   // Cancel initialization, then a live Autochess search, then post-game analysis.
   const early=createStockfishClient();early.terminate();await wait();
   const active=createAutoplayEngine();await active.ready;const rejected=active.search(new Chess().fen(),[]).catch(e=>e.name);active.terminate();if(await rejected!=='AbortError')throw Error('Cancellation failed');await wait();
   const controller=new AbortController(),pending=analyzeGame(entry,{signal:controller.signal}).catch(e=>e.name);setTimeout(()=>controller.abort(),10);if(await pending!=='AbortError')throw Error('Analysis cancellation failed');await wait();
   return {isolated:crossOriginIsolated,sab:typeof SharedArrayBuffer,variants,live,peak,analysis:analysis.status,reward:!!reward};
  });
  assert.equal(result.live,0);assert.equal(result.peak,1);
  if(mode==='threaded')assert.ok(result.variants.every(v=>v==='threaded'));
  if(mode==='single'){assert.equal(result.sab,'undefined');assert.ok(result.variants.every(v=>v==='single'));}
  if(mode==='init-fallback'){assert.equal(result.variants[0],'threaded');assert.ok(result.variants.slice(1).every(v=>v==='single'));}
  console.log('PASS',mode,JSON.stringify(result));await context.close();
 }
}finally{await browser.close();await new Promise(done=>server.close(done));}
