import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('dist'),mime={'.js':'text/javascript','.css':'text/css','.html':'text/html'};
const server=createServer(async(req,res)=>{
 try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(root+'/'))throw Error();const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),url=`http://127.0.0.1:${server.address().port}/`;
 await page.goto(url);await page.locator('#start-game').waitFor();
 await page.evaluate(async()=>{
  const {initialState}=await import('./state.js?v=88');const state=initialState();
  const {ITEMS}=await import('./catalog.js?v=88');state.owned.push(ITEMS.find(item=>item.kind==='board'&&!state.owned.includes(item.id)).id);
  state.sets=[{id:'saved',name:'Мой набор',...state.equipped}];
  const entry={id:'old',pgn:'1. e4 e5 2. Nf3',mode:'bot',playerColor:'w',finishedAt:'2025-01-01T12:00:00Z',result:'Поражение',equipped:state.equipped};
  state.archive=[entry,{...entry,id:'unavailable',finishedAt:''}];localStorage.setItem('chess-vault-v3',JSON.stringify(state));
 });
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:844});await page.goto(url+'#collection');await page.reload();
  await page.locator('.equipment-slot').first().click();await page.locator('[data-owned-only]').click();
  await page.locator('.equipment-slot').nth(1).click();assert.equal(await page.locator('[data-owned-only]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.compact-item').count(),1);
  assert.doesNotMatch(await page.locator('.collection-toolbar>.muted').innerText(),/✧/);
  assert.equal(await page.locator('.compact-item>button').getAttribute('data-size-label'),null);
  await page.locator('[data-owned-only]').click();await page.evaluate(()=>scrollTo(0,500));
  const gap=await page.evaluate(()=>document.querySelector('.equipment-strip').getBoundingClientRect().top-document.querySelector('header').getBoundingClientRect().bottom);
  assert.ok(Math.abs(gap-12)<1,`Sticky gap ${gap} at ${width}`);
  await page.evaluate(()=>scrollTo(0,0));await page.locator('[data-collection-view="saved"]').click();
  const alignment=await page.locator('.collection-row').evaluate(row=>{const title=row.querySelector('h3').getBoundingClientRect(),button=row.querySelector('[data-load-set]').getBoundingClientRect();return Math.abs((title.top+title.bottom)/2-(button.top+button.bottom)/2);});
  assert.ok(alignment<1,'Saved title aligns to horizontal actions');
  const select=await page.locator('[data-load-set]').boundingBox(),remove=await page.locator('[data-delete-set]').boundingBox();
  assert.equal(select.y,remove.y);assert.ok(remove.x>=select.x+select.width);assert.equal(remove.width,44);assert.equal(remove.height,44);
  assert.doesNotMatch(await page.locator('.collection-row').innerText(),/Свой набор|Удалить/);
  assert.equal(await page.locator('[data-delete-set]').evaluate(node=>getComputedStyle(node).color),await page.evaluate(()=>{const probe=document.createElement('span');probe.style.color='var(--negative)';document.body.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color;}));
  await page.locator('[data-delete-set]').click();await page.locator('#modal').waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).sets.length),1,'Opening confirmation does not delete');
  await page.locator('#close-modal').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('[data-load-set]').innerText(),'Выбрано');assert.equal(await page.locator('[data-load-set]').isDisabled(),true);
  assert.equal(await page.locator('[data-delete-set]').isEnabled(),true);
  assert.equal(await page.locator('[data-delete-set]').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(57, 67, 75)');
  await page.locator('.equipment-slot').last().click();await page.locator('[data-equip]:not(:disabled)').click();
  await page.locator('[data-collection-view="saved"]').click();assert.equal(await page.locator('[data-load-set]').innerText(),'Выбрать');
  await page.locator('[data-load-set]').click();assert.equal(await page.locator('[data-load-set]').isDisabled(),true);
  await page.reload();await page.locator('[data-collection-view="saved"]').click();assert.equal(await page.locator('[data-load-set]').innerText(),'Выбрано');
  await page.screenshot({path:`/tmp/gacha-collection-review-${width}.png`,fullPage:true});
  await page.goto(url+'#archive');await page.locator('[data-archive="unavailable"]').click();assert.equal(await page.locator('#archive-review-actions').isVisible(),false);
  await page.locator('#archive-return').click();await page.locator('[data-archive="old"]').click();assert.equal(await page.locator('#archive-analysis').isVisible(),true,'Old games with complete data remain eligible');
  await page.locator('#archive-analysis').scrollIntoViewIfNeeded();
  const original=await page.locator('#archive-analysis').boundingBox();
  await page.evaluate(()=>{window.Worker=class{postMessage(){queueMicrotask(()=>this.onerror?.(Error('Test worker failure')));}terminate(){}};});
  await page.locator('#archive-analysis').evaluate(button=>button.click());await page.locator('#analysis-retry').waitFor();
  const retry=await page.locator('#analysis-retry').boundingBox();assert.deepEqual(retry,original,'Retry preserves original button rectangle');
 }
 await context.close();console.log('PASS collection and analysis layout at 320, 390, 1280: filter, sticky gap, set title, legacy availability, retry geometry');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
