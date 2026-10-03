import assert from 'node:assert/strict';
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
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&crossOriginIsolated);
 const seed=async(count=0,overflow=false)=>{
  await page.evaluate(async({count,overflow})=>{
   const {createAutoRun,arrangeOpponent}=await import('./autochess.js?v=100');const run=createAutoRun('compact-fixture');
   run.color='w';run.level=3;run.round=21;run.purchases=7;run.nextId=8;run.reserve=27;
   run.results=Array.from({length:20},(_,i)=>({outcome:'draw',shopLevel:1,battleId:run.id+':'+(i+1)}));
   run.opponent=arrangeOpponent(run.opponent,'b');
   run.army=[['k','e1'],['r','h1'],['b','c1'],['n','b1'],['p','a2'],['p','b2'],['p','c2'],['p','d2']].map(([type,square],i)=>({id:i?'piece-'+i:'king',type,square:i&&i<=count?null:square,...(i?{paid:i}:{}),...(i&&i<=count?{reserveSlot:i-1,benched:true}:{})}));
   if(overflow)delete run.reserveRule;
   localStorage.setItem('gachachess-autochess-v1',JSON.stringify(run));history.replaceState(null,'','#play');
  },{count,overflow});
  await page.reload();await page.locator('[data-tab="minigames"]').click();await page.locator('#autochess-open').click();await page.locator('#auto-board .square').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('#auto-board').style.width);
 };
 const geometry=()=>page.evaluate(()=>{const ids=['#auto-board','.auto-reserve-row','.auto-shop-meta','.auto-shop-actions','#auto-action'];return ids.map(id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height};});});
 for(const [width,height] of [[360,740],[390,844],[430,932],[360,640],[1280,900]]){
  await page.setViewportSize({width,height});let baseline;
  for(const count of [0,1,4]){
   await seed(count);assert.equal(await page.locator('.auto-reserve>button').count(),4);assert.equal(await page.locator('#auto-board .square').count(),64);
   const current=await geometry();if(!baseline)baseline=current;else assert.deepEqual(current,baseline,'reserve occupancy changed geometry');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'mobile preparation must fit');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(count===4){assert.equal(await page.locator('[data-auto-random]').isDisabled(),true);assert.match(await page.locator('[data-auto-random]').textContent(),/Резерв заполнен/);}
  }
  await seed(0);await page.screenshot({path:`/tmp/autochess99-before-${width}x${height}.png`,fullPage:true});
  const before=await geometry();await page.locator('#auto-start').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')).battle?.moves.length>=1,{},{timeout:25000});
  assert.deepEqual(await geometry(),before,'battle changes board/panel geometry');
  assert.match(await page.locator('#auto-status').textContent(),/Ход/);assert.equal(await page.locator('#auto-resource').count(),0);
  await page.screenshot({path:`/tmp/autochess99-battle-${width}x${height}.png`,fullPage:true});
  await page.locator('#hunt-exit').click();await page.locator('[data-auto-exit="save"]').click();
 }
 await page.setViewportSize({width:390,height:844});await seed(4);const before=await geometry();
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')));
 const original=await stored();await page.locator('#auto-board [data-square="b2"]').dblclick();assert.deepEqual(await stored(),original);await page.getByText('Резерв заполнен',{exact:true}).last().waitFor();
 await page.locator('[data-auto-piece="piece-1"]').click();await page.locator('#auto-board [data-square="e1"]').click();
 let run=await stored();assert.equal(run.army.find(p=>p.id==='king').square,null);assert.equal(run.army.find(p=>p.id==='piece-1').square,'e1');assert.equal(run.army.filter(p=>!p.square).length,4);
 await page.locator('[data-auto-piece="king"]').click();await page.locator('#auto-board [data-square="e1"]').click();assert.equal((await stored()).army.find(p=>p.id==='king').square,'e1');
 assert.deepEqual(await geometry(),before);
 const saleStyle=()=>page.locator('.auto-sale').evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color,s.opacity];});
 const quietSale=await saleStyle();await page.locator('[data-auto-piece="piece-1"]').click();assert.deepEqual(await saleStyle(),quietSale);await page.waitForTimeout(360);await page.locator('[data-auto-sell]').click();assert.equal((await stored()).reserve,28);assert.deepEqual(await geometry(),before);
 await page.waitForTimeout(360);await page.evaluate(()=>{document.querySelector('[data-auto-random]').click();document.querySelector('[data-auto-random]').click();});run=await stored();assert.equal(run.purchases,8);assert.equal(run.reserve,20);assert.equal(run.army.filter(p=>!p.square).length,4);
 // All old reserve figures remain visible in an explicit migration dialog.
 await seed(7,true);await page.getByText('Резерв старого забега',{exact:true}).waitFor();assert.equal(await page.locator('[data-auto-overflow-piece]').count(),7);
 await page.locator('[data-auto-overflow-piece="piece-7"]').click();await page.locator('#auto-board [data-square="d2"]').click();assert.equal((await stored()).army.length,8);assert.equal((await stored()).army.filter(p=>!p.square).length,6);
 await seed(1);await page.locator('#auto-board [data-square="b2"]').tap();await page.locator('#auto-board [data-square="b2"]').tap();assert.equal((await stored()).army.filter(p=>!p.square).length,2);
 // Enlarge text: scrolling is allowed, clipping and horizontal overflow are not.
 await seed(0);await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('[data-auto-random]').isVisible(),true);
 await page.evaluate(()=>document.documentElement.style.fontSize='');await context.setOffline(true);await seed(0);const resultGeometry=await geometry();await page.locator('#auto-start').click();
 await page.locator('[data-auto-next]').waitFor({timeout:45000});assert.deepEqual(await geometry(),resultGeometry,'result changes geometry');assert.equal(await page.locator('#modal').isVisible(),false);assert.equal(await page.locator('#auto-board .square').count(),64);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS compact autochess: four slots, swaps, migration, responsive stable board, offline battle/result');
}finally{await browser.close();await new Promise(done=>server.close(done));}
