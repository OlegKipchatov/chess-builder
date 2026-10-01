import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const version=(await readFile(resolve(root,'sw.js'),'utf8')).match(/chess-vault-v(\d+)/)[1];
assert.equal(version,'65','Update the previous-release fixture and upgrade scenario when bumping the release');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.png':'image/png'};
let release='65',rejectAsset=false;
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/chess-builder\//,'/');
  const path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root))throw Error('Invalid path');
  if(rejectAsset&&pathname==='/ui/styles/base.css'){res.writeHead(503);res.end();return;}
  let content=await readFile(path);
  if(release==='60'&&path.endsWith('/sw.js'))content=await readFile(new URL('../tests/fixtures/sw-v60.js',import.meta.url));
  else if(release==='60'&&['.js','.css','.html'].includes(extname(path))&&!path.includes('/vendor/'))content=Buffer.from(content.toString().replaceAll('?v=65','?v=60'));
  // Deliberately no COOP/COEP or HTTP cache: the worker must provide both isolation and offline files.
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER_EXECUTABLE?{executablePath:process.env.PWA_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-gpu']});
const origin=`http://127.0.0.1:${server.address().port}`;
const controlled=async page=>page.waitForFunction(()=>!!navigator.serviceWorker.controller);
const isolated=async page=>page.waitForFunction(()=>crossOriginIsolated);
const ready=async page=>page.locator('#start-game').waitFor({state:'visible'});
const engines=async page=>page.evaluate(async()=>{
 const v='65';
 const {createBotClient}=await import(`./bot-client.js?v=${v}`);
 const {createSession}=await import(`./cognitive-model.js?v=${v}`);
 const {Chess}=await import(`./chess.js?v=${v}`);
 const results=[];
 for(const elo of [600,1500]){
  const profile=createSession(elo,42),game=new Chess(),client=createBotClient(profile);
  try{
   for(let id=1;id<=2;id++){
    const data=await new Promise((resolve,reject)=>{client.onmessage=({data})=>resolve(data);client.onerror=reject;client.postMessage({id,fen:game.fen(),pgn:game.pgn(),engineProfile:profile});});
    if(!data.move||!game.move(data.move))throw Error(`Illegal offline move at ${elo}`);
   }
   results.push({elo,moves:game.history().length});
  }finally{client.terminate();}
 }
 return results;
});
try{
 for(const base of ['/','/chess-builder/']){
  release='65';
  const context=await browser.newContext({serviceWorkers:'allow'});
  let page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+base);await controlled(page);await isolated(page);await ready(page);
  await page.evaluate(()=>localStorage.setItem('pwa-progress-sentinel','keep'));
  await context.setOffline(true);
  await page.close();page=await context.newPage();
  await page.goto(origin+base);await ready(page);await isolated(page);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pwa-progress-sentinel')),'keep');
  assert.deepEqual(await engines(page),[{elo:600,moves:2},{elo:1500,moves:2}]);
  for(const tab of ['collection','chests','profile','archive','statistics','calendar','faq']){
   await page.goto(origin+base+'#'+tab);await page.locator('#app .brand').waitFor();
  }
  // Use the UI to make and persist a real game, then reopen it offline.
  await page.goto(origin+base);await ready(page);
  await page.evaluate(()=>{Math.random=()=>.25;});
  await page.locator('#start-game').click();
  await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();
  await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('chess-vault-v3'));return s.game.pgn.includes('e4')&&/1\. e4 \S+/.test(s.game.pgn);});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));
  await page.close();page=await context.newPage();await page.goto(origin+base);await page.locator('#board [data-square]').first().waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).game.pgn),saved.game.pgn);
  assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS ${base}: cold offline launch, both engines, sections, persisted game`);
 }
 // Upgrade with an interrupted install must keep the working release intact.
 release='60';const context=await browser.newContext();let page=await context.newPage();
 await page.goto(origin+'/chess-builder/');await controlled(page);await page.reload();await ready(page);
 await page.evaluate(async()=>{await caches.open('unrelated-app');await caches.open('chess-vault-v59');});
 await page.evaluate(()=>{Math.random=()=>.25;});await page.locator('#start-game').click();
 const before=await page.evaluate(()=>localStorage.getItem('chess-vault-v3'));
 release='65';rejectAsset=true;
 const failed=await page.evaluate(async()=>{
  const registration=await navigator.serviceWorker.getRegistration();
  const done=new Promise(resolve=>registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(worker.state==='redundant')resolve(true);});},{once:true}));
  await registration.update();return done;
 });assert.equal(failed,true);
 await context.setOffline(true);await page.reload();await page.locator('#board [data-square]').first().waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),before);
 await page.evaluate(()=>{window.pwaOldController=navigator.serviceWorker.controller;});
 rejectAsset=false;await context.setOffline(false);
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==window.pwaOldController);
 await page.waitForFunction(async()=>{const cache=await caches.open('chess-vault-v65');return !!(await cache.match(new URL('./bot-client.js?v=65',location.href)));});
 await page.waitForFunction(async()=>!(await caches.keys()).includes('chess-vault-v59'));
 assert.equal(await page.evaluate(async()=>(await caches.keys()).includes('chess-vault-v59')),false);
 await context.setOffline(true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),before);
 assert.equal(await page.evaluate(async()=>(await fetch('./bot-worker.js?v=60')).ok),true);
 assert.equal(await page.evaluate(async()=>(await caches.keys()).includes('unrelated-app')),true);
 await page.close();page=await context.newPage();await page.goto(origin+'/chess-builder/');await isolated(page);
 await page.locator('#board [data-square]').first().waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),before);
 assert.deepEqual(await engines(page),[{elo:600,moves:2},{elo:1500,moves:2}]);
 await context.close();console.log('PASS v60 → v65: failed install, active game, old URLs, saved progress, offline reopen');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
