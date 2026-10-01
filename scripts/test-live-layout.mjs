import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('dist');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));assert.ok(path.startsWith(root+'/'));res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
try{
 for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[760,800],[1280,900]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(()=>{Math.random=()=>.25;});await page.locator('#start-game').click();
  const before=await page.locator('#board').boundingBox();
  assert.equal(await page.locator('#match-points').isVisible(),true);
  assert.equal(await page.locator('#status').evaluate(node=>getComputedStyle(node).clipPath),'inset(50%)');
  assert.equal(await page.locator('#replay-start').isVisible(),false);
  assert.deepEqual(await page.locator('.history-buttons button').evaluateAll(nodes=>nodes.map(node=>node.id)),['history-back','replay-start','replay-pause','history-forward','history-live']);
  await page.locator('#match-points').evaluate(node=>{node.textContent='−39 очков';});
  assert.deepEqual(await page.locator('#board').boundingBox(),before);
  assert.equal(await page.locator('#hint').count(),0);
  const summary=await page.locator('.match-summary').boundingBox(),nav=await page.locator('.history-controls').boundingBox();
  assert.ok(summary.y+summary.height<=before.y);assert.ok(nav.y>=before.y+before.height);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width<=760){
   await page.screenshot({path:`/tmp/gacha-live-${width}.png`,fullPage:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),`Vertical overflow ${width}x${height}`);
  }
  await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();
  await page.waitForFunction(()=>document.querySelector('#history-position').textContent==='2 / 2');
  assert.equal(await page.locator('.square.last').count(),2);
  assert.match(await page.locator('.square.last').first().evaluate(node=>getComputedStyle(node).boxShadow),/4px/);
  await page.locator('#history-back').click();await page.waitForFunction(()=>document.querySelector('#history-position').textContent==='1 / 2');
  assert.deepEqual(await page.locator('#board').boundingBox(),before);
  assert.match(await page.locator('#status').textContent(),/чёрных/);
  assert.equal(await page.locator('#replay-start').isVisible(),false);
  await page.locator('#history-forward').click();await page.waitForFunction(()=>document.querySelector('#history-position').textContent==='2 / 2');
  assert.deepEqual(await page.locator('#board').boundingBox(),before);
  await page.screenshot({path:`/tmp/gacha-live-${width}.png`,fullPage:true});
  if(width===390){
   await page.locator('#resign').click();
   await page.locator('[data-confirm-resign]').click();
   for(let step=0;step<3&&await page.locator('#modal').evaluate(node=>node.open);step++)await page.locator('#close-modal').click();
   await page.evaluate(()=>{location.hash='archive';});
   await page.locator('[data-archive]').first().click();
   assert.equal(await page.locator('#replay-start').isVisible(),true);
   await page.locator('#replay-start').click();
   await page.waitForFunction(()=>document.querySelector('#history-position').textContent==='2 / 2');
   console.log('PASS archive: playback remains available after completing the live game');
  }
  assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height}: board ${before.width}px at y=${before.y}, move/review/replay stable`);await context.close();
 }
 // Compare embedded browser and standalone geometry, including simulated iOS safe areas.
 const layouts=[];
 for(const scenario of [
  {name:'embedded',width:402,height:700,top:0,bottom:0},
  {name:'standalone',width:402,height:874,top:59,bottom:34},
  {name:'compact-safe-area',width:375,height:667,top:44,bottom:34},
  {name:'tall-standalone',width:430,height:1100,top:59,bottom:34},
 ]){
  const {name,width,height,top,bottom}=scenario;
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'});
  // Chromium does not expose iOS safe-area insets: inject their CSS values explicitly.
  await context.route('**/*.css*',async route=>{
   const response=await route.fetch();
   const css=(await response.text()).replaceAll('env(safe-area-inset-top)',`${top}px`).replaceAll('env(safe-area-inset-bottom)',`${bottom}px`);
   await route.fulfill({response,body:css});
  });
  const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(()=>{Math.random=()=>.25;});await page.locator('#start-game').click();
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--app-header-height').trim()===`${document.querySelector('header').getBoundingClientRect().height}px`);
  const geometry=await page.evaluate(()=>{
   const box=selector=>document.querySelector(selector).getBoundingClientRect();
   return {headerBottom:box('header').bottom,summaryTop:box('.match-summary').top,boardWidth:box('#board').width,exportBottom:box('#export-pgn').bottom,height:innerHeight,scrollHeight:document.documentElement.scrollHeight};
  });
  const gap=geometry.summaryTop-geometry.headerBottom;
  assert.ok(gap>=19&&gap<=53,`${name}: header-to-game gap ${gap}px`);
  assert.ok(geometry.exportBottom<=height-bottom,`${name}: controls reach unsafe bottom area`);
  assert.ok(geometry.scrollHeight<=height+1,`${name}: vertical overflow`);
  layouts.push(geometry);
  await page.screenshot({path:`/tmp/gacha-${name}.png`,fullPage:true});
  console.log(`PASS ${name}: header gap ${gap}px, board ${geometry.boardWidth}px, controls inside safe area`);
  await context.close();
 }
 assert.equal(layouts[0].boardWidth,layouts[1].boardWidth,'Browser chrome must not shrink the board when height is sufficient');
 assert.ok(Math.abs((layouts[0].summaryTop-layouts[0].headerBottom)-(layouts[1].summaryTop-layouts[1].headerBottom))<=2,'Embedded and standalone tall screens keep comparable top spacing');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
