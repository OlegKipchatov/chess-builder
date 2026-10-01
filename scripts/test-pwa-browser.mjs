import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {testAnalysisLearning} from './test-analysis-learning.mjs';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const version=(await readFile(resolve(root,'sw.js'),'utf8')).match(/chess-vault-v(\d+)/)[1];
assert.equal(version,'73','Update the previous-release fixture and upgrade scenario when bumping the release');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.png':'image/png'};
let release='73',rejectAsset=false;
const previousFiles=new Map();
// Upgrade from the last published archive-only analysis release.
const previousRef='1d6e81a';
assert.ok(previousRef,'Fetch repository history to test the real previous release');
const previousSource = path => {
 const name=path.slice(root.length);
 if(!previousFiles.has(name))previousFiles.set(name,execFileSync('git',['show',`${previousRef}:dist/${name}`],{cwd:resolve(root,'..')}));
 return previousFiles.get(name);
};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/chess-builder\//,'/');
  const path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root))throw Error('Invalid path');
  if(rejectAsset&&pathname==='/ui/styles/base.css'){res.writeHead(503);res.end();return;}
  let content=await readFile(path);
  if(release==='72'&&['.js','.css','.html'].includes(extname(path))&&!path.includes('/vendor/'))content=previousSource(path);
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
 const v='73';
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
  release='73';
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
  // A completed game resumes its pending quality bonus offline exactly once.
  await page.evaluate(async()=>{
   const {Chess}=await import('./chess.js?v=73');
   const {completedMatch}=await import('./archive.js?v=73');
   const {initialState}=await import('./state.js?v=73');
   const {createStartedGame}=await import('./session.js?v=73');
   const game=new Chess();['f3','e5','g4','Qh4#'].forEach(move=>game.move(move));
   const state=initialState();state.game=createStartedGame(state,()=>.9);
   const settled=completedMatch(state,game,{id:'offline-reward',finishedAt:new Date().toISOString()});
   localStorage.setItem('chess-vault-v3',JSON.stringify(settled.state));
  });
  await page.reload();await ready(page);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).archive[0].rewardBreakdown.qualityStatus==='complete');
  const paid=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));
  assert.equal(paid.coins,100+paid.archive[0].rewardBreakdown.total);
  assert.ok(paid.archive[0].rewardBreakdown.quality>0);
  await page.reload();await ready(page);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).coins),paid.coins);
  // Analyze an archived game offline through the real UI and real Worker.
  await page.goto(origin+base+'#archive');
  await page.locator('[data-archive="offline-reward"]').click();
  await page.locator('#archive-analysis').click();
  await page.locator('#analysis-content').waitFor({state:'visible',timeout:60000});
  assert.equal(await page.locator('#analysis-history-position').innerText(),'0 / 4');
  const analyzed=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).archive[0].analysis);
  assert.equal(analyzed.status,'complete');
  await page.locator('#analysis-history-forward').click();
  assert.equal(await page.locator('#analysis-history-position').innerText(),'1 / 4');
  await page.locator('#analysis-close').click();
  await page.close();page=await context.newPage();await page.goto(origin+base+'#archive');
  // Any Worker during cached entry/playback is a regression.
  await page.evaluate(()=>{window.analysisWorkerCount=0;const Original=window.Worker;window.Worker=class extends Original {constructor(...args){super(...args);window.analysisWorkerCount++;}};});
  await page.locator('[data-archive="offline-reward"]').click();await page.locator('#archive-analysis').click();
  await page.locator('#analysis-content').waitFor({state:'visible'});
  await page.locator('#analysis-history-forward').click();
  await page.locator('#analysis-history-forward').click();
  assert.equal(await page.locator('[data-analysis-line]').count(),0);
  assert.equal(await page.locator('#analysis-insight').innerText(),'');
  await page.locator('#analysis-history-forward').click();
  assert.equal(await page.locator('#analysis-history-position').innerText(),'3 / 4');
  await page.locator('#analysis-replay-start').click();
  await page.waitForFunction(()=>document.querySelector('#analysis-content').dataset.playback!=='playing');
  assert.equal(await page.locator('[data-analysis-line]').count(),0,'Never offer the actual mating move as an alternative');
  assert.equal(await page.evaluate(()=>window.analysisWorkerCount),0);
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`analysis overflow at ${width}`);
   await page.screenshot({path:`/tmp/gachachess-analysis-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'analysis supports 200% text');
  await page.evaluate(()=>document.documentElement.style.fontSize='');
  await page.locator('#analysis-close').click();
  if(base==='/'){
   await testAnalysisLearning(page,origin+base);
   await page.setViewportSize({width:390,height:844});
   await page.evaluate(async()=>{
    const {initialState}=await import('./state.js?v=73');
    const {createStartedGame}=await import('./session.js?v=73');
    const state=initialState();state.game={...createStartedGame(state,()=>.9),pgn:'1. f3 e5 2. g4 Qh4#'};
    localStorage.setItem('chess-vault-v3',JSON.stringify(state));
   });
   await page.reload();
   await page.waitForFunction(()=>document.querySelector('#modal-content')?.textContent.includes('Точность'));
   assert.match(await page.locator('#modal-content').innerText(),/Лучшие решения/);
   assert.equal(await page.locator('#modal').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
   const rewarded=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));
   assert.equal(rewarded.coins,100+rewarded.archive[0].rewardBreakdown.total);
   // Post-game offers no analysis; it remains available only in archive playback.
   while(await page.locator('#modal').evaluate(node=>node.open)){
    assert.equal(await page.locator('[data-post-analysis]').count(),0);
    const previous=await page.locator('#modal-content').textContent();
    await page.locator('#close-modal').click();
    await page.waitForFunction(text=>!document.querySelector('#modal').open||document.querySelector('#modal-content').textContent!==text,previous);
   }
   await page.goto(origin+base+'#archive');
   await page.locator('[data-archive]').first().click();
   await page.locator('#archive-analysis').click();
   await page.locator('#analysis-content').waitFor({state:'visible',timeout:60000});
   assert.equal(await page.locator('#analysis-history-position').innerText(),'0 / 4');
   // Invalidate cache and cancel immediately: no late persistence from old job.
   await page.locator('#analysis-close').click();
   await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('chess-vault-v3'));delete state.archive[0].analysis;localStorage.setItem('chess-vault-v3',JSON.stringify(state));});
   await page.reload();
   await page.evaluate(()=>{window.cancelTestWorkers=0;const Original=window.Worker;window.Worker=class extends Original {constructor(...args){super(...args);window.cancelTestWorkers++;}};});
   await page.locator('[data-archive]').first().click();await page.locator('#archive-analysis').click();
   await page.waitForFunction(()=>window.cancelTestWorkers>0);
   await page.locator('#analysis-close').click();
   await page.waitForFunction(()=>document.querySelector('#archive').hidden===false);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).archive[0].analysis),undefined);

  }
  assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS ${base}: cold offline launch, both engines, sections, persisted game`);
 }
 // Upgrade with an interrupted install must keep the working release intact.
 release='72';const context=await browser.newContext();let page=await context.newPage();
 await page.goto(origin+'/chess-builder/');await controlled(page);await isolated(page);await ready(page);
 await page.evaluate(async()=>{await caches.open('unrelated-app');await caches.open('chess-vault-v59');});
 await page.evaluate(()=>{Math.random=()=>.25;});await page.locator('#start-game').click();
 const before=await page.evaluate(()=>localStorage.getItem('chess-vault-v3'));
 release='73';rejectAsset=true;
 const failed=await page.evaluate(async()=>{
  const registration=await navigator.serviceWorker.getRegistration();
  const done=new Promise((resolve,reject)=>{setTimeout(()=>reject(Error('Expected failed update did not complete')),30000);registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(worker.state==='redundant')resolve(true);});},{once:true});});
  await registration.update();return done;
 });assert.equal(failed,true);
 await context.setOffline(true);await page.reload();await page.locator('#board [data-square]').first().waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),before);
 await page.evaluate(()=>{window.pwaOldController=navigator.serviceWorker.controller;});
 rejectAsset=false;await context.setOffline(false);
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==window.pwaOldController);
 await page.waitForFunction(async()=>{const cache=await caches.open('chess-vault-v73');return !!(await cache.match(new URL('./bot-client.js?v=73',location.href)));});
 await page.waitForFunction(async()=>!(await caches.keys()).includes('chess-vault-v59'));
 assert.equal(await page.evaluate(async()=>(await caches.keys()).includes('chess-vault-v59')),false);
 await context.setOffline(true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),before);
 assert.equal(await page.evaluate(async()=>(await fetch('./bot-worker.js?v=72')).ok),true);
 assert.equal(await page.evaluate(async()=>(await caches.keys()).includes('unrelated-app')),true);
 await page.close();page=await context.newPage();await page.goto(origin+'/chess-builder/');await isolated(page);
 await page.locator('#board [data-square]').first().waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),before);
 assert.deepEqual(await engines(page),[{elo:600,moves:2},{elo:1500,moves:2}]);
 await context.close();console.log('PASS v72 → v73: failed install, active game, old URLs, saved progress, offline reopen');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
