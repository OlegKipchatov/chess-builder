import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,extname,join} from 'node:path';
import {chromium} from 'playwright';
import {Chess} from 'chess.js';
import {testPgnViewer} from './test-pgn-viewer.mjs';
import {testAnalysisLearning} from './test-analysis-learning.mjs';
import {initialState} from '../src/services/persistence/state.ts';
import {createStartedGame} from '../src/domain/chess/session.ts';
import {createSession} from '../src/domain/cognitive/cognitive-model.ts';
import {completedMatch} from '../src/domain/chess/archive.ts';
import {normalizeActivity} from '../src/domain/activity/activity-model.ts';
import {savedMateRun} from './fixtures/autochess.mjs';

const root=resolve('dist'),previousRoot=await mkdtemp(join(tmpdir(),'gachachess-v132-'));
// Real production predecessor, not a synthetic replacement service worker.
const previousRef='ee7df974635bf7dd514c24e4d4a6b04bce3af8c6';
execFileSync('tar',['-xf','-','-C',previousRoot],{input:execFileSync('git',['archive',previousRef,'dist'],{maxBuffer:20*1024*1024})});
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.png':'image/png'};
let release='react',rejectAsset=false;
const css=(await readdir(join(root,'assets'))).find(name=>name.endsWith('.css'));
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/chess-builder\//,'/');
  const directory=release==='legacy'&&!pathname.startsWith('/vendor/')?join(previousRoot,'dist'):root;
  const path=resolve(directory,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  assert.ok(path.startsWith(directory+'/'));
  if(rejectAsset&&pathname===`/assets/${css}`){res.writeHead(503);res.end();return;}
  let content=await readFile(path);
  if(process.env.PWA_NO_ISOLATION&&pathname==='/sw.js')content=Buffer.from(content.toString().replaceAll('Cross-Origin-Opener-Policy','X-Test-COOP').replaceAll('Cross-Origin-Embedder-Policy','X-Test-COEP'));
  // The worker itself must provide isolation. The hosting server does not.
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
const origin=`http://127.0.0.1:${server.address().port}`;
const ready=page=>page.locator('#start-game').waitFor();
const isolated=page=>page.waitForFunction(expected=>!!navigator.serviceWorker.controller&&crossOriginIsolated===expected,!process.env.PWA_NO_ISOLATION);
const setState=(page,state)=>page.evaluate(value=>localStorage.setItem('chess-vault-v3',JSON.stringify(value)),state);
const finishDialogs=async page=>{for(let step=0;step<6&&await page.locator('dialog').evaluate(node=>node.open);step++){await page.locator('dialog').evaluate(async node=>Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{}))));const next=page.locator('dialog').getByRole('button',{name:/^(Продолжить|Готово)$/}).first();if(await next.count())await next.click();else await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.waitForTimeout(220);}};
const offlineEngines=async(page,url)=>{
 for(const elo of [600,1500]){
  const state=initialState();state.game={...createStartedGame(state,()=>0),playerColor:'w',engineProfile:createSession(elo,42)};
  await setState(page,state);await page.goto(url+'?fixture='+Date.now()+'#/play');
  await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();
  await page.waitForFunction(()=>/1\. e4 [a-hNBRQKO]/.test(JSON.parse(localStorage.getItem('chess-vault-v3')).game.pgn),null,{timeout:45000});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).game.pgn);
  const board=new Chess();board.loadPgn(saved);assert.equal(board.history().length,2);
  await page.reload();await page.locator('#board').waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).game.pgn),saved);
 }
 const state=initialState(),run=savedMateRun('offline-mate');
 await setState(page,state);await page.evaluate(value=>localStorage.setItem('gachachess-autochess-v1',JSON.stringify(value)),run);await page.goto(url+'?fixture='+Date.now()+'#/autochess');
 await page.getByRole('button',{name:'Продолжить бой'}).click();await page.getByRole('button',{name:'Следующий раунд'}).waitFor({timeout:45000});
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')).results.at(-1).outcome),'win');
 await page.getByRole('button',{name:'Выйти',exact:true}).click();await page.getByRole('button',{name:'Сохранить и выйти'}).click();await ready(page);
};
try{
 for(const base of process.env.PWA_UPGRADE_ONLY?[]:['/','/chess-builder/']){
  release='react';const url=origin+base,context=await browser.newContext({serviceWorkers:'allow'});let page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await isolated(page);await ready(page);await page.evaluate(()=>localStorage.setItem('pwa-progress-sentinel','keep'));
  await context.setOffline(true);await page.close();page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(url);await ready(page);await isolated(page);assert.equal(await page.evaluate(()=>localStorage.getItem('pwa-progress-sentinel')),'keep');
  for(const [route,title] of [['collection','Коллекция'],['chests','Сундуки'],['profile','Профиль'],['history','История партий'],['statistics','Статистика'],['calendar','Календарь активности'],['faq','Вопросы и ответы']]){await page.goto(url+'#/'+route);await page.getByRole('heading',{name:title,exact:true}).waitFor();}
  await offlineEngines(page,url);
  const game=new Chess();['f3','e5','g4','Qh4#'].forEach(move=>game.move(move));const state=initialState();state.game={...createStartedGame(state,()=>.9),playerColor:'b'};const settled=completedMatch(state,game,{id:'offline-reward',finishedAt:new Date().toISOString()});
  await setState(page,settled.state);await page.goto(url+'?fixture='+Date.now()+'#/play');await ready(page);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).archive[0].rewardBreakdown.qualityStatus==='complete',null,{timeout:60000});
  const paid=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));assert.equal(paid.coins,100+paid.archive[0].rewardBreakdown.total);assert.ok(paid.archive[0].rewardBreakdown.quality>0);
  await page.reload();await ready(page);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).coins),paid.coins);
  await page.goto(url+'#/history');await page.locator('[data-archive="offline-reward"]').click();const analyze=page.getByRole('button',{name:'Разобрать партию'});await analyze.scrollIntoViewIfNeeded();
  const before=await page.evaluate(()=>{window.reviewBoard=document.querySelector('#board');return {y:scrollY,top:window.reviewBoard.getBoundingClientRect().top};});await analyze.evaluate(button=>button.click());
  assert.equal(await page.locator('progress').isVisible(),false,'Fast actions do not flash a loader');await page.locator('progress').waitFor();assert.equal(await page.locator('#board').isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>({y:scrollY,top:document.querySelector('#board').getBoundingClientRect().top})),before,'Inline loading preserves scroll and board position');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).archive[0].analysis?.status==='complete',null,{timeout:60000});assert.equal(await page.evaluate(()=>window.reviewBoard===document.querySelector('#board')),true);
  await page.getByRole('button',{name:'Следующая позиция',exact:true}).click();assert.equal(await page.getByRole('slider').getAttribute('aria-valuetext'),'1 из 4');await page.getByLabel('Назад',{exact:true}).click();
  await page.close();page=await context.newPage();await page.goto(url+'#/history');await page.evaluate(()=>{window.analysisWorkerCount=0;const Original=Worker;window.Worker=class extends Original{constructor(...args){super(...args);window.analysisWorkerCount++;}};});
  await page.locator('[data-archive="offline-reward"]').click();await page.getByRole('button',{name:'Разобрать партию'}).click();await page.getByRole('slider').press('End');assert.equal(await page.locator('[data-analysis-line]').count(),0,'Never offer the actual mating move as an alternative');assert.equal(await page.evaluate(()=>window.analysisWorkerCount),0);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`analysis overflow ${width}`);await page.screenshot({path:`/tmp/gachachess-react-analysis-${width}.png`,fullPage:true});}
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.evaluate(()=>document.documentElement.style.fontSize='');
  await page.getByLabel('Назад',{exact:true}).click();await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('chess-vault-v3'));delete state.archive[0].analysis;localStorage.setItem('chess-vault-v3',JSON.stringify(state));});await page.reload();
  await page.locator('[data-archive="offline-reward"]').click();await page.getByRole('button',{name:'Разобрать партию'}).click();await page.getByRole('button',{name:'Отменить',exact:true}).click();await page.getByRole('button',{name:'Разобрать партию'}).waitFor();await page.getByLabel('Назад',{exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).archive[0].analysis),undefined);
  if(base==='/')await testAnalysisLearning(page,url);
  await testPgnViewer(page,url);
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${base}: cold offline, both AI engines, Autochess, lazy routes, restoration, exactly-once quality, real analysis, cache and cancellation`);
 }
 release='legacy';const context=await browser.newContext();const page=await context.newPage();await page.goto(origin+'/chess-builder/');await isolated(page);await ready(page);
 await page.evaluate(async()=>{await caches.open('unrelated-app');const cache=await caches.open('chess-vault-v59');await cache.put(new URL('obsolete.js',location.href),new Response('old'));Math.random=()=>.25;});await page.locator('#start-game').click();const before=await page.evaluate(()=>localStorage.getItem('chess-vault-v3'));
 release='react';rejectAsset=true;
 assert.equal(await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();const done=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Failed update timeout')),30000);registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(worker.state==='redundant'){clearTimeout(timer);resolve(true);}});},{once:true});});await registration.update();return done;}),true);
 await context.setOffline(true);await page.reload();await page.locator('#board [data-square]').first().waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),before);
 await page.evaluate(()=>window.pwaOldController=navigator.serviceWorker.controller);rejectAsset=false;await context.setOffline(false);await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
 assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller===window.pwaOldController),true);assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),before);
 await page.locator('#resign').click();await page.locator('[data-confirm-resign]').click();await page.getByText('Партия отменена',{exact:false}).waitFor();await page.locator('#close-modal').click();await ready(page);
 const preserved=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));await page.locator('#profile-avatar').click();await page.locator('#profile-update-app').click();await page.getByRole('heading',{name:'Профиль',exact:true}).waitFor();await page.waitForFunction(()=>!!document.querySelector('script[type="module"][src*="assets/"]'));await isolated(page);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));for(const key of ['coins','shards','owned','equipped','archive','activity','rating','hunt'])assert.deepEqual(after[key],key==='activity'?normalizeActivity(preserved[key]):preserved[key],key);
 await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.some(key=>key.startsWith('gachachess-react:/chess-builder/:'))&&keys.includes('chess-vault-v132')&&!keys.includes('chess-vault-v59');});assert.equal(await page.evaluate(async()=>(await caches.keys()).includes('unrelated-app')),true);
 await context.setOffline(true);assert.equal(await page.evaluate(async()=>(await fetch('./bot-worker.js?v=132')).ok),true);await page.reload();await isolated(page);await page.getByRole('heading',{name:'Профиль',exact:true}).waitFor();const offline=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));for(const key of ['coins','shards','owned','archive','activity','rating','hunt'])assert.deepEqual(offline[key],key==='activity'?normalizeActivity(preserved[key]):preserved[key],key);
 await offlineEngines(page,origin+'/chess-builder/');await context.close();console.log('PASS installed v132 → React: failed install, active game, explicit old UI consent, progress, prior URLs, unrelated caches, cold offline reopen');
}catch(error){for(const [index,context] of browser.contexts().entries())for(const [tab,page]of context.pages().entries())await page.screenshot({path:`/tmp/gachachess-failure-${index}-${tab}.png`,fullPage:true,timeout:3000}).catch(()=>{});throw error;}finally{await browser.close();await new Promise(done=>server.close(done));await rm(previousRoot,{recursive:true,force:true});}
