import {Chess} from 'chess.js';
import {ANALYSIS_VERSION,ENGINE,PROFILE} from '../src/domain/analysis/analysis-config.ts';
import assert from 'node:assert/strict';
import {initialState} from '../src/services/persistence/state.ts';
import {ITEMS} from '../src/domain/catalog/catalog.ts';
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
 {
  const state=initialState();state.owned.push(ITEMS.find(item=>item.kind==='board'&&!state.owned.includes(item.id)).id);
  state.sets=[{id:'saved',name:'Мой набор',...state.equipped}];
  const entry={id:'old',pgn:'1. e4 e5 2. Nf3',mode:'bot',playerColor:'w',finishedAt:'2025-01-01T12:00:00Z',result:'Поражение',equipped:state.equipped};
  state.archive=[entry,{...entry,id:'unavailable',finishedAt:''}];await page.evaluate(state=>localStorage.setItem('chess-vault-v3',JSON.stringify(state)),state);
 }
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:844});await page.goto(url+'?fixture='+Date.now()+'#/collection');
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
  assert.equal(await page.locator('[data-delete-set]').evaluate(node=>getComputedStyle(node).backgroundColor),await page.evaluate(()=>{const node=document.createElement('span');node.style.backgroundColor='var(--control)';document.body.append(node);const value=getComputedStyle(node).backgroundColor;node.remove();return value;}));
  await page.locator('.equipment-slot').last().click();await page.locator('[data-equip]:not(:disabled)').click();
  await page.locator('[data-collection-view="saved"]').click();assert.equal(await page.locator('[data-load-set]').innerText(),'Выбрать');
  await page.locator('[data-load-set]').click();await page.locator('[data-load-set]:disabled').waitFor();assert.equal(await page.locator('[data-load-set]').isDisabled(),true);
  await page.reload();await page.locator('[data-collection-view="saved"]').click();assert.equal(await page.locator('[data-load-set]').innerText(),'Выбрано');
  await page.screenshot({path:`/tmp/gacha-collection-review-${width}.png`,fullPage:true});
  await page.goto(url+'#/history');await page.locator('#history .page-header-start button').waitFor();
  const backAppearance=async()=>page.locator('.page-header-start button').evaluate(button=>{const style=getComputedStyle(button),rect=button.getBoundingClientRect(),svg=button.querySelector('svg').getBoundingClientRect();return {width:rect.width,height:rect.height,x:rect.x,background:style.backgroundColor,radius:style.borderRadius,iconWidth:svg.width,iconHeight:svg.height,gap:getComputedStyle(button.closest('.page-header')).columnGap};});
  const listBack=await backAppearance();assert.equal(listBack.width,44);assert.equal(listBack.height,44);assert.notEqual(listBack.background,'rgba(0, 0, 0, 0)');
  await page.locator('[data-archive="unavailable"]').click();await page.locator('#board').waitFor();assert.equal(await page.locator('#archive-review-actions').isVisible(),false);
  await page.getByLabel('Назад',{exact:true}).click();await page.locator('[data-archive="old"]').click();await page.locator('#archive-analysis').waitFor();assert.equal(await page.locator('#archive-analysis').isVisible(),true,'Old games with complete data remain eligible');
  assert.equal(await page.locator('#analysis h1').innerText(),'История партии');
  assert.deepEqual(await backAppearance(),listBack,'List and detail share the same back control and header gutter');
  if(width>=390){
    const heading=await page.locator('#analysis h1').evaluate(node=>{const style=getComputedStyle(node),rect=node.getBoundingClientRect(),header=node.closest('.page-header');return {height:rect.height,width:rect.width,lineHeight:style.lineHeight,font:style.font,columns:getComputedStyle(header).gridTemplateColumns,gap:getComputedStyle(header).columnGap,viewport:innerWidth};});
    await page.screenshot({path:`/tmp/gacha-history-heading-${width}.png`,fullPage:true});
    assert.ok(heading.height<=parseFloat(heading.lineHeight)+1,`History heading fits one line: ${JSON.stringify(heading)}`);
  }
  assert.equal(await page.locator('#archive-heading-actions #export-pgn svg').count(),1);
  assert.equal(await page.locator('#archive-heading-actions #export-pgn').innerText(),'');
  assert.equal(await page.locator('#match-points').innerText(),'0 очков');
  assert.match(await page.locator('.match-versus').innerText(),/ИИ/);
  assert.doesNotMatch(await page.locator('.match-versus').innerText(),/ИИ · ИИ/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#archive-analysis').scrollIntoViewIfNeeded();
  const original=await page.locator('#archive-analysis').boundingBox();
  await page.evaluate(()=>{window.Worker=class{postMessage(){queueMicrotask(()=>this.onerror?.(Error('Test worker failure')));}terminate(){}};});
  await page.locator('#archive-analysis').evaluate(button=>button.click());await page.locator('#analysis-retry').waitFor();
  const retry=await page.locator('#analysis-retry').boundingBox();assert.deepEqual(retry,original,'Retry preserves original button rectangle');
 }
 // The v132 annotations must survive React rendering and the CSS cascade.
 const state=initialState(),game=new Chess();game.loadPgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4');
 const entry={id:'annotations',pgn:game.pgn(),mode:'bot',playerColor:'w',finishedAt:'2026-10-17T09:00:00Z',result:'Поражение',equipped:state.equipped};
 const qualities=['inaccuracy','best','mistake','best','blunder','best','best'];
 entry.analysis={analysisVersion:ANALYSIS_VERSION,profileVersion:PROFILE.version,engine:ENGINE,gameId:entry.id,sourcePgn:entry.pgn,playerColor:'w',createdAt:'2026-10-17',status:'complete',totalPlies:7,analyzedPlayerMoves:4,focusEvents:[1,3,5,7],summary:{best:1,good:0,inaccuracy:1,mistake:1,blunder:1,excellent:1},moves:game.history({verbose:true}).map((m,i)=>({ply:i+1,actor:i%2?'opponent':'player',fenBefore:m.before,fenAfter:m.after,playedMove:m.from+m.to,playedSan:m.san,status:'complete',quality:qualities[i],highlight:i===6?'excellent':null,expectedScoreLoss:i%2?0:.2,alternatives:[],autoPause:i%2===0}))};
 state.archive=[entry];
 for(const width of [390,1280])for(const theme of ['dark','light']){
  await page.evaluate(({state,theme})=>{localStorage.setItem('chess-vault-v3',JSON.stringify(state));localStorage.setItem('gachachess-theme',theme);},{state,theme});
  await page.setViewportSize({width,height:844});await page.goto(url+'?annotations='+width+theme+'#/history/annotations?analyze=true');
  await page.locator('.history-marker').first().waitFor();
  assert.equal(await page.locator('.history-marker').count(),4);
  for(const [ply,quality,symbol,token] of [[1,'inaccuracy','?!','--muted'],[3,'mistake','?','--negative'],[5,'blunder','??','--negative'],[7,'excellent','!','--accent']]){
   const marker=page.locator(`[data-insight-ply="${ply}"]`);await marker.click();
   await page.locator('.analysis-badge').waitFor();
   assert.equal(await marker.getAttribute('data-quality'),quality);
   assert.equal(await marker.getAttribute('aria-current'),'true');
   assert.equal(await page.locator('.analysis-badge').innerText(),symbol);
   const expected=await page.evaluate(token=>{const probe=document.createElement('span');probe.style.color=`var(${token})`;document.body.append(probe);const value=getComputedStyle(probe).color;probe.remove();return value;},token);
   assert.equal(await marker.evaluate(node=>getComputedStyle(node,'::after').backgroundColor),expected);
   assert.equal(await page.locator('.analysis-badge').evaluate(node=>getComputedStyle(node).color),expected);
   if(width>760)assert.equal(await page.locator('.history-move[aria-current]').evaluate(node=>getComputedStyle(node).color),expected);
  }
  await page.screenshot({path:`/tmp/gacha-analysis-annotations-${width}-${theme}.png`,fullPage:true});
 }
 await context.close();console.log('PASS collection and analysis layout at 320, 390, 1280: filter, sticky gap, set title, legacy availability, retry geometry');
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/gacha-collection-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
