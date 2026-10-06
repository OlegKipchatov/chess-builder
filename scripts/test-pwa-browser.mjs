import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {testLongMateEngine} from './test-mate-long-engine.mjs';
import {testPgnViewer} from './test-pgn-viewer.mjs';
import {testAnalysisLearning} from './test-analysis-learning.mjs';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const version=(await readFile(resolve(root,'sw.js'),'utf8')).match(/chess-vault-v(\d+)/)[1];
assert.equal(version,'116','Update the previous-release fixture and upgrade scenario when bumping the release');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.png':'image/png'};
let release='116',rejectAsset=false;
const previousFiles=new Map();
// Upgrade from the previous published release (v115).
const previousRef='6292985d98a332f8647f24e3d4091bd8d6fec996';
assert.ok(previousRef,'Fetch repository history to test the real previous release');
const previousSource = path => {
 const name=path.slice(root.length);
 if(!previousFiles.has(name))previousFiles.set(name,execFileSync('git',['show',`${previousRef}:dist/${name}`],{cwd:resolve(root,'..')}));
 return previousFiles.get(name);
};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/chess-builder\//,'/');
  if(pathname==='/upgrade-observer'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end('<!doctype html><title>Upgrade observer</title>');return;}
  const path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root))throw Error('Invalid path');
  if(rejectAsset&&pathname==='/ui/styles/base.css'){res.writeHead(503);res.end();return;}
  let content=await readFile(path);
  if(release==='115'&&['.js','.css','.html'].includes(extname(path))&&!path.includes('/vendor/'))content=previousSource(path);
  if(release==='117'&&pathname==='/sw.js')content=Buffer.from(content.toString().replace('chess-vault-v116','chess-vault-v117'));
  if(process.env.PWA_NO_ISOLATION&&pathname==='/sw.js')content=Buffer.from(content.toString().replace('const isolated = response => {','const isolated = response => { return response;'));
  // Deliberately no COOP/COEP or HTTP cache: the worker must provide both isolation and offline files.
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER_EXECUTABLE?{executablePath:process.env.PWA_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-gpu']});
const origin=`http://127.0.0.1:${server.address().port}`;
const controlled=async page=>page.waitForFunction(()=>!!navigator.serviceWorker.controller);
const isolated=async page=>page.waitForFunction(expected=>crossOriginIsolated===expected,!process.env.PWA_NO_ISOLATION);
const ready=async page=>page.locator('#start-game').waitFor({state:'visible'});
const engines=async page=>page.evaluate(async()=>{
 const v='116';
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
 const {createAutoplayEngine}=await import(`./autochess-engine.js?v=${v}`);
 const auto=createAutoplayEngine();
 try{
  await auto.ready;
  const board=new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
  const move=await auto.search(board.fen(),[]);
  board.move({from:move.slice(0,2),to:move.slice(2,4)});
  if(!board.isCheckmate())throw Error('Offline Autochess failed to finish');
 }finally{auto.terminate();}
 return results;
});
try{
 for(const base of process.env.PWA_UPGRADE_ONLY?[]:['/','/chess-builder/']){
  release='116';
  const context=await browser.newContext({serviceWorkers:'allow'});
  if(process.env.PWA_DEBUG){context.on('console',m=>console.log('BROWSER',m.type(),m.text()));context.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()));}
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
   const {Chess}=await import('./chess.js?v=116');
   const {completedMatch}=await import('./archive.js?v=116');
   const {initialState}=await import('./state.js?v=116');
   const {createStartedGame}=await import('./session.js?v=116');
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
  await page.locator('#archive-analysis').scrollIntoViewIfNeeded();
  const loadingBefore=await page.evaluate(()=>{window.reviewBoard=document.querySelector('#board');return {y:scrollY,top:window.reviewBoard.getBoundingClientRect().top};});
  await page.locator('#archive-analysis').evaluate(button=>button.click());
  assert.equal(await page.locator('#analysis-progress').isVisible(),false,'Fast actions do not flash a loader');
  await page.locator('#analysis-progress').waitFor({state:'visible'});
  assert.equal(await page.locator('#board').isVisible(),true);
  assert.equal(await page.locator('#match-title').innerText(),'История партии');
  const loadingAfter=await page.evaluate(()=>({y:scrollY,top:document.querySelector('#board').getBoundingClientRect().top}));
  assert.ok(Math.abs(loadingBefore.y-loadingAfter.y)<=1&&Math.abs(loadingBefore.top-loadingAfter.top)<=1,'Inline loading preserves scroll and board position');
  await page.locator('#match-surface.analysis-active').waitFor({state:'visible',timeout:60000});
  assert.equal(await page.evaluate(()=>window.reviewBoard===document.querySelector('#board')),true,'Review keeps the existing board element');
  assert.equal(await page.locator('#history-position').innerText(),'0 / 4');
  const analyzed=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).archive[0].analysis);
  assert.equal(analyzed.status,'complete');
  await page.locator('#history-forward').click();
  assert.equal(await page.locator('#history-position').innerText(),'1 / 4');
  await page.locator('#archive-return').click();
  await page.close();page=await context.newPage();await page.goto(origin+base+'#archive');
  // Any Worker during cached entry/playback is a regression.
  await page.evaluate(()=>{window.analysisWorkerCount=0;const Original=window.Worker;window.Worker=class extends Original {constructor(...args){super(...args);window.analysisWorkerCount++;}};});
  await page.locator('[data-archive="offline-reward"]').click();await page.locator('#archive-analysis').click();
  await page.locator('#match-surface.analysis-active').waitFor({state:'visible'});
  await page.locator('#history-forward').click();
  await page.locator('#history-forward').click();
  assert.equal(await page.locator('[data-analysis-line]').count(),0);
  assert.equal(await page.locator('#analysis-insight').innerText(),'');
  await page.locator('#history-forward').click();
  assert.equal(await page.locator('#history-position').innerText(),'3 / 4');
  await page.locator('#replay-start').click();
  await page.waitForFunction(()=>document.querySelector('#match-surface').dataset.playback!=='playing');
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
  await page.locator('#archive-return').click();
  if(base==='/'){
   await testAnalysisLearning(page,origin+base);
   await page.setViewportSize({width:390,height:844});
   await page.evaluate(async()=>{
    const {initialState}=await import('./state.js?v=116');
    const {createStartedGame}=await import('./session.js?v=116');
    const state=initialState();state.game={...createStartedGame(state,()=>.9),pgn:'1. f3 e5 2. g4 Qh4#'};
    localStorage.setItem('chess-vault-v3',JSON.stringify(state));
   });
   await page.reload();
   await page.waitForFunction(()=>document.querySelector('#modal-content')?.textContent.includes('Точность'));
   assert.match(await page.locator('#modal-content').innerText(),/Лучшие решения/);
   assert.doesNotMatch(await page.locator('#modal-content').innerText(),/Лучшие решения:|Неточности:/);
   assert.equal(await page.locator('#modal').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
   const rewarded=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));
   assert.equal(rewarded.coins,100+rewarded.archive[0].rewardBreakdown.total);
   // Analysis is the final step, after reward and activity, within the same dialog.
   while(!await page.locator('[data-post-analysis]').count()){
    const previous=await page.locator('#modal-content').textContent();
    await page.locator('#close-modal').click();
    await page.waitForFunction(text=>!document.querySelector('#modal').open||document.querySelector('#modal-content').textContent!==text,previous);
   }
   for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.locator('[data-post-analysis]').evaluate(button=>Math.abs(button.getBoundingClientRect().width-button.parentElement.getBoundingClientRect().width)<1),true,'Primary modal action fills the content width');
   }
   await page.setViewportSize({width:390,height:844});
   await page.locator('[data-post-analysis]').click();
   await page.locator('#match-surface.analysis-active').waitFor({state:'visible',timeout:60000});
   assert.equal(await page.locator('#modal').evaluate(node=>node.open),false);
   await page.locator('#archive-return').click();
   await ready(page);
   assert.equal(await page.locator('#archive').isVisible(),false,'Post-game review returns to the game start screen');
   await page.goto(origin+base+'#archive');
   await page.locator('[data-archive]').first().click();
   await page.locator('#archive-analysis').click();
   await page.locator('#match-surface.analysis-active').waitFor({state:'visible',timeout:60000});
   assert.equal(await page.locator('#history-position').innerText(),'0 / 4');
   // Invalidate cache and cancel immediately: no late persistence from old job.
   await page.locator('#archive-return').click();
   await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('chess-vault-v3'));delete state.archive[0].analysis;localStorage.setItem('chess-vault-v3',JSON.stringify(state));});
   await page.reload();
   await page.evaluate(()=>{window.cancelTestWorkers=0;const Original=window.Worker;window.Worker=class extends Original {constructor(...args){super(...args);window.cancelTestWorkers++;}};});
   await page.locator('[data-archive]').first().click();await page.locator('#archive-analysis').click();
   await page.waitForFunction(()=>window.cancelTestWorkers>0);
   await page.locator('#analysis-cancel').click();
   assert.equal(await page.locator('#archive-analysis').isVisible(),true);
   assert.equal(await page.locator('#board').isVisible(),true);
   await page.locator('#archive-return').click();
   await page.waitForFunction(()=>document.querySelector('#archive').hidden===false);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).archive[0].analysis),undefined);

  }
  await testPgnViewer(page,origin+base);
  if(base==='/')await testLongMateEngine(page);
  assert.deepEqual(errors,[]);
  await context.close();console.log(`PASS ${base}: cold offline launch, both engines, sections, persisted game`);
 }
 // Upgrade with an interrupted install must keep the working release intact.
 release='115';const context=await browser.newContext();let page=await context.newPage();
 await page.goto(origin+'/chess-builder/');await controlled(page);await isolated(page);await ready(page);
 await page.evaluate(async()=>{await caches.open('unrelated-app');await caches.open('chess-vault-v59');});
 await page.evaluate(()=>{Math.random=()=>.25;});await page.locator('#start-game').click();
 const before=await page.evaluate(()=>localStorage.getItem('chess-vault-v3'));
 release='116';rejectAsset=true;
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
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
 assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller===window.pwaOldController),true,'A v115 update stays waiting during an active game');
 assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),before);
 // Finish the empty game through the UI, then accept the update from Profile.
 // This tests the actual user flow without retaining cross-renderer Worker objects.
 await page.locator('#resign').click();await page.locator('[data-confirm-resign]').click();
 await page.getByText('Партия отменена',{exact:false}).waitFor();await page.locator('#close-modal').click();await ready(page);
 const preserved=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));
 await page.locator('#profile-avatar').click();await page.locator('#profile-update-app').waitFor({state:'visible'});
 await page.locator('#profile-update-app').click();
 await page.waitForFunction(()=>document.querySelector('meta[name="gachachess-build"]')?.content==='116');await isolated(page);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));
 for(const key of ['coins','shards','owned','equipped','archive','activity','rating','hunt'])assert.deepEqual(after[key],preserved[key],key);
 await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('chess-vault-v116')&&keys.includes('chess-vault-v115')&&!keys.includes('chess-vault-v59');});
 assert.equal(await page.evaluate(async()=>(await caches.keys()).includes('unrelated-app')),true);
 await context.setOffline(true);
 assert.equal(await page.evaluate(async()=>(await fetch('./bot-worker.js?v=115')).ok),true);
 await page.reload();await isolated(page);await page.locator('#profile:not([hidden])').waitFor();
 assert.deepEqual(await engines(page),[{elo:600,moves:2},{elo:1500,moves:2}]);
 const offline=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));
 for(const key of ['coins','shards','owned','archive','activity','rating','hunt'])assert.deepEqual(offline[key],preserved[key],key);
 await context.close();console.log('PASS v115 → v116: failed install, active game held, real profile consent, saved progress, old URLs and cold offline reopen');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
