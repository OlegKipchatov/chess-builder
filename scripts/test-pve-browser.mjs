import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {initialState} from '../src/services/persistence/state.ts';
import {NODES} from '../src/domain/pve/pve-model.ts';
import {beginPveBattle,allMoves} from '../src/domain/pve/pve-battle.ts';
const root=resolve('dist'),mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));assert.ok(path.startsWith(root+'/'));const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-gpu']}),url=`http://127.0.0.1:${server.address().port}/`;
try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(()=>{const Native=Worker;window.pveWorkers={live:0,peak:0,requests:0,hold:false};window.Worker=class extends Native{constructor(...args){super(...args);this.dead=false;window.pveWorkers.live++;window.pveWorkers.peak=Math.max(window.pveWorkers.peak,window.pveWorkers.live);}postMessage(message,...args){if(message?.battle){window.pveWorkers.requests++;if(window.pveWorkers.hold)return;}return super.postMessage(message,...args);}terminate(){if(!this.dead){this.dead=true;window.pveWorkers.live--;}super.terminate();}};});
  await page.goto(url);await page.waitForFunction(()=>navigator.serviceWorker.controller&&crossOriginIsolated);await page.locator('#start-game').waitFor();await context.setOffline(true);
  const state=initialState();state.pve.stones=12;state.pve.cores=1;state.pve.cleared=NODES.map(node=>node.id);state.pve.levelCap=5;
  const seed=async(state,view)=>{await page.evaluate(state=>localStorage.setItem('chess-vault-v3',JSON.stringify(state)),state);await page.goto(url+'?fixture='+Date.now()+'#/pve?view='+view);await page.getByRole('heading',{level:1}).waitFor();};
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));
  await seed(state,'army');await page.locator('#pve-army-board [data-square]').first().waitFor();assert.equal(await page.locator('#pve-army-board [data-square]').count(),32);
  const board=await page.locator('#pve-army-board').boundingBox();assert.ok(Math.abs(board.width-2*board.height)<=10,'Army keeps the four-rank geometry');
  const pawn=state.pve.units.find(unit=>unit.type==='p'&&unit.active);await page.locator(`[data-pve-unit="${pawn.id}"]`).click();await page.locator('[data-pve-stone]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).pve.stones===11);
  const trained=(await saved()).pve.units.find(unit=>unit.id===pawn.id);assert.ok(trained.xp>pawn.xp);
  await page.locator('[data-pve-evolve]').click();await page.locator('dialog').getByRole('button',{name:/^Конь · HP/}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).pve.cores===0);
  const evolved=(await saved()).pve.units.find(unit=>unit.id===pawn.id);assert.equal(evolved.type,'n');assert.equal(evolved.xp,trained.xp);assert.equal(evolved.level,trained.level);
  await page.locator('[data-pve-toggle]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).pve.units.filter(u=>u.active).length===7);await page.locator('[data-pve-toggle]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).pve.units.filter(u=>u.active).length===8);
  await page.getByRole('button',{name:'Рюкзак',exact:true}).click();await page.getByRole('heading',{name:'Камни опыта · 11'}).waitFor();await page.goBack();await page.locator('#pve-army-board').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`/tmp/gachachess-pve-army-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Карта',exact:true}).click();await page.locator('[data-pve-node="trail"]').click();
  await page.evaluate(()=>{
   window.pveStartFrames=[];window.samplePveStart=true;
   const sample=()=>{if(!window.samplePveStart)return;const dialog=document.querySelector('dialog'),board=document.querySelector('#pve-board'),rect=board?.getBoundingClientRect();window.pveStartFrames.push({title:document.querySelector('#pve h1')?.textContent,board:!!board,open:dialog.open,closing:dialog.classList.contains('is-closing'),y:rect?.y,width:rect?.width,backdrop:dialog.open?Number(getComputedStyle(dialog,'::backdrop').opacity):0,dialogY:dialog.open?dialog.getBoundingClientRect().y:null});requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  await page.locator('dialog').getByRole('button',{name:'Начать бой'}).click();await page.locator('#pve-board').waitFor();await page.locator('dialog').waitFor({state:'hidden'});await page.waitForTimeout(100);
  const frames=await page.evaluate(()=>{window.samplePveStart=false;return window.pveStartFrames;});
  assert.ok(frames.filter(frame=>frame.title==='Бой · PvE').every(frame=>frame.board),'Battle never renders without its board');
  const closing=frames.filter(frame=>frame.closing&&frame.open);
  if(width<760){
   assert.ok(closing.length>1,'Mobile sheet exit is sampled');
   assert.ok(closing.every(frame=>frame.board),'Battle is ready before preview dismisses');
   for(let i=1;i<closing.length;i++){
    assert.ok(closing[i].dialogY>=closing[i-1].dialogY-1,'Closing sheet never flashes back to its starting position');
    assert.ok(closing[i].backdrop<=closing[i-1].backdrop+.01,'Backdrop fades out without reappearing');
   }
  }
  const exposed=frames.filter(frame=>frame.board&&!frame.open);
  assert.ok(exposed.length>1);
  assert.ok(exposed.every(frame=>Math.abs(frame.y-exposed[0].y)<1&&Math.abs(frame.width-exposed[0].width)<1),'Exposed battle board stays in place');
  console.log(`PASS PvE entry ${width}: no blank battle, stable board, continuous sheet/backdrop exit`);
  const before=(await saved()).pve.battle,move=allMoves(before)[0];await page.locator(`#pve-board [data-square="${move.from}"]`).click();assert.match(await page.locator('#pve-inspect').innerText(),/HP.*Урон/);await page.locator(`#pve-board [data-square="${move.to}"]`).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).pve.battle.ply===2);await page.waitForFunction(()=>document.querySelector('#pve-board').getAttribute('aria-busy')==='false');
  const position=(await saved()).pve.battle;await page.getByRole('button',{name:'К карте',exact:true}).click();await page.waitForFunction(()=>window.pveWorkers.live===0);await page.reload();await page.getByRole('button',{name:'Продолжить бой',exact:true}).click();await page.locator('#pve-board').waitFor();assert.deepEqual((await saved()).pve.battle,position);
  const wallet=await saved();await page.getByRole('button',{name:'Сдаться',exact:true}).click();await page.locator('dialog').getByRole('button',{name:'Сдаться',exact:true}).click();await page.locator('#pve-battle-result').waitFor();await page.locator('dialog').getByRole('button',{name:'Далее'}).click();await page.locator('#pve-reward').waitFor();await page.locator('dialog').getByRole('button',{name:'Далее'}).click();await page.locator('#pve-experience').waitFor();assert.equal(await page.locator('.pve-experience-row').count(),8);await page.locator('dialog').getByRole('button',{name:'К карте'}).click();await page.locator('.pve-map').waitFor();await page.reload();await page.locator('.pve-map').waitFor();assert.equal((await saved()).coins,wallet.coins);assert.equal((await saved()).pve.stones,wallet.pve.stones+1);assert.equal((await saved()).pve.battle,null);
  if(width===390){
   for(const killed of [false,true]){
    const combat=initialState();combat.pve=beginPveBattle(combat.pve,'trail',()=>0);const battle=combat.pve.battle,pawn=battle.units.find(u=>u.type==='p'&&u.color==='w'),victim=battle.units.find(u=>u.type==='p'&&u.color==='b');battle.units.forEach(u=>{if(u.type==='k')u.square=u.color==='w'?'a1':'h8';else u.hp=0;});pawn.square='c4';pawn.hp=100;victim.square='d5';victim.type='n';victim.hp=killed?1:120;
    await seed(combat,'battle');await page.locator('#pve-board').waitFor();await page.evaluate(()=>{window.pveWorkers.hold=true;window.pveMoves=[];const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.classList.contains('moving-piece'))window.pveMoves.push({id:this.dataset.pieceId,duration:options.duration,time:performance.now()});return animate.call(this,frames,options);};});
    await page.locator('#pve-board [data-square="c4"]').click();const start=await page.evaluate(()=>performance.now());await page.locator('#pve-board [data-square="d5"]').click();await page.locator('.pve-damage-number').waitFor();
    assert.ok(await page.evaluate(start=>performance.now()-start>=400,start));assert.equal((await saved()).pve.battle.ply,1);assert.equal(await page.evaluate(()=>window.pveWorkers.requests),0,'AI waits for presentation');
    const hp=page.locator(`[data-piece-id="${victim.id}"] .pve-hp i`);assert.equal(await hp.count(),1,'Victim remains until visible contact');await page.waitForFunction(({id,killed})=>Math.abs(parseFloat(document.querySelector(`[data-piece-id="${id}"] .pve-hp i`).style.width)-(killed?0:100/3))<.001,{id:victim.id,killed});
    await page.waitForFunction(()=>window.pveWorkers.requests===1);assert.ok(await page.evaluate(({start,killed})=>performance.now()-start>=(killed?800:1200),{start,killed}));const motions=await page.evaluate(()=>window.pveMoves);assert.ok(motions.filter(row=>row.id===pawn.id).every(row=>row.duration===420));
    assert.equal((await saved()).pve.battle.units.find(u=>u.id===pawn.id).square,killed?'d5':'c4');await page.screenshot({path:`/tmp/gachachess-pve-impact-${killed}.png`,fullPage:true});await page.getByRole('button',{name:'К карте',exact:true}).click();await page.waitForFunction(()=>window.pveWorkers.live===0);
   }
  }
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS PvE ${width}: army, inventory, evolution, map, offline Worker, pause/reload, settlement and combat timing`);
 }
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/gachachess-pve-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();await new Promise(done=>server.close(done));}
