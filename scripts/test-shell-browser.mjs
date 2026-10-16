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
  await page.evaluate(()=>{location.hash='/calendar';});await page.getByRole('heading',{name:'Задачи на сегодня'}).waitFor();
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
  await page.getByRole('button',{name:'Статистика',exact:true}).click();await page.getByRole('heading',{name:'Статистика',exact:true}).waitFor();assert.match(await page.locator('.statistics-grid').innerText(),/Рейтинг/);await page.getByLabel('Назад',{exact:true}).click();await page.getByRole('button',{name:'Вопросы и ответы',exact:true}).click();await page.locator('details').first().locator('summary').click();assert.equal(await page.locator('details').first().evaluate(node=>node.open),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal((await saved()).opened,1);assert.equal((await saved()).coins,208);assert.deepEqual(errors,[]);await context.close();console.log(`PASS shell ${width}: offline reward transaction, equipment deep link, calendar claim/freeze, themes, modal focus, statistics, FAQ`);
 }
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/gachachess-shell-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();await new Promise(done=>server.close(done));}
