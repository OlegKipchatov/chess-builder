import assert from 'node:assert/strict';
import {savedMateRun} from './fixtures/autochess.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{const pathname=new URL(req.url,'http://localhost').pathname,path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!path.startsWith(root))throw Error();const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
const origin=`http://127.0.0.1:${server.address().port}`,key='gachachess-autochess-v1';
try{
 const context=await browser.newContext();
 await context.addInitScript(()=>{
  const NativeWorker=window.Worker;
  window.engineProbe={created:0,live:0,peak:0,drops:2,queries:[]};
  window.Worker=class extends NativeWorker{
   constructor(url,options){super(url,options);this.tracked=/\/(threaded|single)-/.test(String(url));this.stopped=false;if(this.tracked){const p=window.engineProbe;p.created++;p.live++;p.peak=Math.max(p.peak,p.live);}}
   postMessage(message,...args){
    if(this.tracked&&typeof message==='string'){
     const p=window.engineProbe;if(message.startsWith('position fen'))p.queries.push(message);
     if(message.startsWith('go ')&&p.drops>0){p.drops--;return;}
    }
    return super.postMessage(message,...args);
   }
   terminate(){if(this.tracked&&!this.stopped){this.stopped=true;window.engineProbe.live--;}return super.terminate();}
  };
 });
 const page=await context.newPage();await page.goto(origin);await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&crossOriginIsolated);
 const battle=async(drops)=>{
  const run=savedMateRun('retry-'+Date.now());
  await page.evaluate(run=>localStorage.setItem('gachachess-autochess-v1',JSON.stringify(run)),run);
  await page.goto(origin+'/?fixture='+Date.now()+'#/autochess');
  await page.getByRole('button',{name:'Продолжить бой'}).waitFor();
  await page.evaluate(drops=>window.engineProbe.drops=drops,drops);
  await page.getByRole('button',{name:'Продолжить бой'}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')).phase==='result'||document.querySelector('[role="alert"]'),null,{timeout:90000});
  await page.waitForFunction(()=>window.engineProbe.live===0);
  return page.evaluate(()=>{const run=JSON.parse(localStorage.getItem('gachachess-autochess-v1')),probe=window.engineProbe;return {phase:run.phase,moves:run.battle.moves.slice(6),results:run.results.length-12,errors:[...document.querySelectorAll('[role="alert"]')].map(node=>node.textContent),created:probe.created,live:probe.live,peak:probe.peak,queries:probe.queries};});
 };
 const recovered=await battle(2);assert.equal(recovered.phase,'result');assert.equal(recovered.created,3);assert.equal(recovered.moves.length,1);assert.deepEqual(recovered.errors,[]);assert.equal(recovered.live,0);assert.equal(recovered.peak,1);assert.equal(new Set(recovered.queries).size,1);
 await context.setOffline(true);
 for(let i=0;i<5;i++){const next=await battle(0);assert.equal(next.created,1);assert.equal(next.live,0);assert.equal(next.peak,1);assert.equal(next.phase,'result');}
 const failed=await battle(3);assert.equal(failed.created,3);assert.equal(failed.phase,'paused');assert.deepEqual(failed.moves,[]);assert.equal(failed.results,0);assert.equal(failed.errors.length,1);assert.match(failed.errors[0],/3 попыток/);assert.equal(failed.live,0);assert.equal(failed.peak,1);
 await context.close();console.log('PASS real Stockfish: two forced timeouts recover, three fail once without moves/reward, five offline battles release workers, peak one worker');
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/autochess-retry-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();await new Promise(done=>server.close(done));}
