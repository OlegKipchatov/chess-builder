import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {initialState} from '../src/services/persistence/state.ts';
import {openChest} from '../src/domain/economy/economy.ts';
import {visibleCalendarRewards} from '../src/domain/activity/calendar-rewards.ts';
const root=resolve('dist'),mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));assert.ok(path.startsWith(root+'/'));const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-gpu']}),url=`http://127.0.0.1:${server.address().port}/`,now=new Date('2026-10-16T12:00:00Z');
try{
 // Delay a real lazy chunk past the router's former pending threshold.
 // Sample every painted frame, not just the eventual destination.
 for(const [width,colorScheme] of [[390,'dark'],[1280,'light']]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme,serviceWorkers:'block'}),page=await context.newPage();
  let release,requested;
  const gate=new Promise(resolve=>{release=resolve;}),requestSeen=new Promise(resolve=>{requested=resolve;});
  await page.route('**/assets/PvePage-*.js',async route=>{requested();await gate;await route.continue();});
  await page.goto(url);await page.locator('#start-game').waitFor();
  await page.evaluate(()=>{
   window.navigationFrames=[];window.navigationHeader=document.querySelector('header');
   window.sampleNavigation=true;
   const sample=()=>{if(!window.sampleNavigation)return;const screen=document.querySelector('main .tab');window.navigationFrames.push({title:screen?.querySelector('h1')?.textContent,visible:!!screen&&getComputedStyle(screen).display!=='none'&&screen.getBoundingClientRect().height>0,nav:!document.querySelector('#app-nav').hidden,pve:document.body.classList.contains('pve-active')});requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  await page.locator('[data-tab="pve"]').click();await requestSeen;
  await page.waitForTimeout(1400);
  assert.equal(await page.locator('#play h1').innerText(),'Игры');
  assert.equal(await page.locator('#app-nav').isVisible(),true);
  assert.equal(await page.locator('body').evaluate(node=>node.classList.contains('pve-active')),false);
  if(width===1280){
   await page.locator('[data-tab="collection"]').click();await page.locator('#collection h1').waitFor();
  }
  release();
  if(width===390)await page.locator('#pve h1').waitFor();
  await page.waitForTimeout(100);
  const frames=await page.evaluate(()=>{window.sampleNavigation=false;return window.navigationFrames;});
  assert.ok(frames.length>30);
  assert.ok(frames.every(frame=>frame.visible&&frame.title),'No blank frame during lazy navigation');
  assert.ok(frames.filter(frame=>frame.title==='Игры').every(frame=>frame.nav&&!frame.pve),'Shell stays with the displayed route');
  assert.equal(await page.evaluate(()=>document.querySelector('header')===window.navigationHeader),true,'Header never remounts');
  if(width===1280)assert.equal(await page.locator('#collection h1').innerText(),'Коллекция','Late chunk cannot replace a newer destination');
  await context.close();console.log(`PASS navigation ${width}: delayed chunk retains screen, shell and header without blank frames`);
 }
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:'light'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.clock.setFixedTime(now);
  await page.goto(url);await page.waitForFunction(()=>navigator.serviceWorker.controller&&crossOriginIsolated);await page.locator('#start-game').waitFor();await context.setOffline(true);
  const state=initialState();state.coins=300;state.shards=50;state.pity=9;
  state.activity={version:1,timeZone:'UTC',days:['2026-10-14'],frozen:[],claimed:[],daily:{'2026-10-16':{questVersion:2,games:100,wins:100,aiGames:100,aiMoves:100,aiCaptures:100,aiFinished:100,huntGames:100,huntScore:100,huntMoves:100,autoGames:100,miniGames:100}}};
  await page.evaluate(state=>localStorage.setItem('chess-vault-v3',JSON.stringify(state)),state);await page.goto(url+'?fixture='+width+'#/chests');await page.locator('#open-chest').waitFor();
  await page.evaluate(()=>{crypto.getRandomValues=values=>{values.fill(0);return values;};const button=document.querySelector('#open-chest');button.click();button.click();});
  await page.locator('dialog').getByRole('button',{name:'В коллекцию',exact:true}).waitFor();
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3'))),expected=openChest(state,()=>0);
  assert.equal((await saved()).coins,200);assert.equal((await saved()).opened,1);assert.ok((await saved()).owned.includes(expected.result.item.id));
  assert.equal(await page.evaluate(()=>document.activeElement.id),'modal-title');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),true);
  await page.screenshot({path:`/tmp/gachachess-reward-${width}.png`,fullPage:true});
  await page.locator('dialog').getByRole('button',{name:'В коллекцию',exact:true}).click();await page.locator('.navigation-target').waitFor();
  await page.locator(`[data-equip="${expected.result.item.id}"]`).click();await page.waitForFunction(id=>JSON.parse(localStorage.getItem('chess-vault-v3')).equipped.pieces.k===id,expected.result.item.id);
  const checkCalendarWidth = async () => {
   const geometry = await page.locator('.calendar-layout').evaluate(layout => {
    const rect = layout.getBoundingClientRect(), parent = layout.parentElement.getBoundingClientRect();
    return {width:rect.width,expected:Math.min(540,parent.width),center:rect.x+rect.width/2,parentCenter:parent.x+parent.width/2};
   });
   assert.ok(Math.abs(geometry.width-geometry.expected)<1,`Calendar must fill available width: ${JSON.stringify(geometry)}`);
   assert.ok(Math.abs(geometry.center-geometry.parentCenter)<1,'Calendar stays centered');
  };
  await page.evaluate(()=>{location.hash='/streak';});
  await page.getByRole('heading',{name:'Календарь активности',exact:true}).waitFor();
  for(const calendarWidth of [320,390,768,1024,1440]) {
   await page.setViewportSize({width:calendarWidth,height:900});
   await checkCalendarWidth();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:`/tmp/gachachess-streak-width-${width}-${calendarWidth}.png`,fullPage:true});
  }
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>{location.hash='/calendar';});await page.getByRole('heading',{name:'Задачи на сегодня'}).waitFor();
  await checkCalendarWidth();
  assert.equal(await page.locator('.calendar-rewards .calendar-reward').count(),6);
  const reward=visibleCalendarRewards(state.activity,now).find(row=>row.group==='daily'&&!row.id.endsWith(':all'));
  await page.getByRole('button',{name:'Забрать награду: '+reward.title,exact:true}).evaluate(button=>{button.click();button.click();});
  await page.getByRole('img',{name:'Награда получена: '+reward.title,exact:true}).waitFor();assert.equal((await saved()).coins,208);assert.equal((await saved()).activity.claimed.filter(id=>id===reward.id).length,1);
  await page.screenshot({path:`/tmp/gachachess-calendar-${width}.png`,fullPage:true});
  await page.evaluate(()=>{location.hash='/streak';});await page.getByRole('button',{name:/Заморозить ·/}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).activity.frozen.includes('2026-10-15'));assert.equal((await saved()).shards,40);
  await page.getByLabel('15 октября, заморожен, серия сохранена',{exact:true}).waitFor();
  await page.evaluate(()=>{location.hash='/profile';});await page.locator('#theme-preference').selectOption('dark');await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.reload();await page.locator('#theme-preference').waitFor();assert.equal(await page.locator('#theme-preference').inputValue(),'dark');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--coins').trim()),'#f8ea45');
  await page.getByRole('button',{name:'Установить приложение',exact:true}).click();await page.locator('dialog[open]').waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),'modal-title');await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'Установить приложение',exact:true}).evaluate(button=>button===document.activeElement),true);
  await page.locator('#theme-preference').selectOption('system');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await page.getByRole('button',{name:'Статистика',exact:true}).click();await page.getByRole('heading',{name:'Статистика',exact:true}).waitFor();assert.match(await page.locator('.statistics-grid').first().innerText(),/Рейтинг/);assert.match(await page.locator('.statistics-progress').innerText(),/Открыто сундуков/);await page.getByLabel('Назад',{exact:true}).click();await page.getByRole('button',{name:'Вопросы и ответы',exact:true}).click();await page.locator('details').first().locator('summary').click();assert.equal(await page.locator('details').first().evaluate(node=>node.open),true);
  for(const scheme of ['light','dark']) {
   await page.emulateMedia({colorScheme:scheme});
   const summary=page.locator('#faq details').first().locator('summary');
   await summary.evaluate(node=>{node.parentElement.open=false;node.focus({preventScroll:true});});
   const stableHeader=await summary.evaluate(async node=>{
    const read=()=>{const rect=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);const text=range.getBoundingClientRect(),style=getComputedStyle(node);return {height:rect.height,width:rect.width,textX:text.left-rect.left,textY:text.top-rect.top,color:style.color,filter:style.filter,opacity:style.opacity};};
    const before=read(),frames=[];let replacements=0;
    const observer=new MutationObserver(records=>{replacements+=records.filter(record=>record.type==='childList'||record.type==='characterData').length;});
    observer.observe(node,{childList:true,characterData:true,subtree:true});
    for(const open of [true,false]){
     node.click();
     for(let frame=0;frame<12;frame++){await new Promise(resolve=>requestAnimationFrame(resolve));frames.push({open:node.parentElement.open,expectedOpen:open,...read()});}
    }
    observer.disconnect();
    return {before,frames,replacements,sameNode:node===document.querySelector('#faq details summary'),focused:node===document.activeElement,tapHighlight:getComputedStyle(node).webkitTapHighlightColor};
   });
   assert.equal(stableHeader.replacements,0,'Disclosure preserves heading text nodes');
   assert.equal(stableHeader.sameNode,true);assert.equal(stableHeader.focused,true);
   assert.equal(stableHeader.tapHighlight,'rgba(0, 0, 0, 0)','Native touch overlay must not tint heading text');
   for(const {open,expectedOpen,...frame} of stableHeader.frames){assert.equal(open,expectedOpen);assert.deepEqual(frame,stableHeader.before,'Heading geometry and foreground stay stable across disclosure frames');}
   await summary.scrollIntoViewIfNeeded();
   const point=await summary.boundingBox();await page.mouse.move(point.x+point.width/2,point.y+point.height/2);await page.mouse.down();
   assert.equal(await summary.evaluate(node=>getComputedStyle(node).color),stableHeader.before.color,'Pressed feedback does not recolor text');await page.mouse.up();
   await page.locator('#faq details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
   assert.equal(await page.locator('#faq details').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).borderTopStyle==='solid'&&node.querySelector('.disclosure-content'))),true,'FAQ question and answer share a styled card');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:`/tmp/gachachess-faq-${width}-${scheme}.png`,fullPage:true});
  }
  await page.evaluate(()=>{location.hash='/profile';});await page.locator('#theme-preference').waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  assert.equal(await page.getByRole('button',{name:'Установить приложение',exact:true}).count(),0);
  assert.equal((await saved()).opened,1);assert.equal((await saved()).coins,208);assert.deepEqual(errors,[]);await context.close();console.log(`PASS shell ${width}: offline reward transaction, equipment deep link, calendar claim/freeze, themes, modal focus, statistics, FAQ`);
 }
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/gachachess-shell-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();await new Promise(done=>server.close(done));}
