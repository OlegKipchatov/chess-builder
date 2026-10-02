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
 const context=await browser.newContext({viewport:{width:390,height:844}});let page=await context.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&crossOriginIsolated);await page.locator('#start-game').waitFor();
 const original=await page.evaluate(()=>localStorage.getItem('chess-vault-v3'));
 await context.setOffline(true);
 await page.evaluate(async()=>{const {createAutoRun}=await import('./autochess.js?v=94');localStorage.setItem('gachachess-autochess-v1',JSON.stringify({...createAutoRun('legacy-browser','fixture'),version:3}));});
 await page.locator('[data-tab="minigames"]').click();await page.locator('#autochess-open').click();await page.locator('[data-auto-buy="n"]').waitFor();
 assert.equal(await page.locator('#hunt-exit').isVisible(),true);
 assert.equal(await page.locator('#app-nav').isVisible(),false);
 await page.locator('[data-auto-buy="n"]').click();assert.equal(await page.locator('#auto-start').isDisabled(),true);
 const square=await page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')).color==='w'?'d1':'d8');
 await page.locator(`#auto-board [data-square="${square}"]`).click();assert.equal(await page.locator('#auto-start').isEnabled(),true);
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`/tmp/autochess-setup-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 const boardBefore=await page.locator('#auto-board').boundingBox(),scrollBefore=await page.evaluate(()=>scrollY);await page.locator('#auto-start').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')).battle.moves.length>=3,null,{timeout:25000}).catch(async error=>{console.error(await page.locator('#auto-status').textContent(),errors);throw error;});
 assert.equal(await page.locator('#auto-board .last').count(),0);
 const boardAfter=await page.locator('#auto-board').boundingBox();assert.equal(boardBefore.width,boardAfter.width);assert.equal(boardBefore.y+scrollBefore,boardAfter.y+await page.evaluate(()=>scrollY));
 await page.locator('#hunt-exit').click();await page.locator('[data-auto-exit="save"]').click();
 const paused=await page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')));assert.ok(paused.battle.elapsed>0&&paused.battle.elapsed<30000);
 await page.close();page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);await page.locator('#start-game').waitFor();
 await page.locator('[data-tab="minigames"]').click();await page.locator('#autochess-open').click();await page.locator('#auto-start').waitFor();
 assert.equal(await page.locator('#auto-start').textContent(),'Продолжить бой');
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')));assert.deepEqual(restored,paused);
 const other=await context.newPage();await other.goto(origin);await other.locator('#start-game').waitFor();await other.locator('[data-tab="minigames"]').click();await other.locator('#autochess-open').click();
 await other.getByText('Серия открыта в другом окне.',{exact:false}).waitFor();await other.close();
 await page.evaluate(()=>{
  const original=Storage.prototype.setItem;let fail=true;
  Storage.prototype.setItem=function(key,value){if(key==='chess-vault-v3'&&fail){fail=false;throw Error('Test storage failure');}return original.call(this,key,value);};
 });
 await page.locator('#auto-start').click();await page.locator('[data-auto-retry]').waitFor({timeout:40000});
 assert.equal(await page.locator('[data-auto-next]').isDisabled(),true);assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),original);
 await page.locator('[data-auto-retry]').click();await page.waitForFunction(()=>!document.querySelector('[data-auto-next]').disabled);
 const finished=await page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')));
 assert.equal(finished.phase,'result');assert.equal(finished.results.length,1);assert.ok(finished.battle.elapsed<=30000&&finished.battle.moves.length<=120);
 const once=await page.evaluate(()=>localStorage.getItem('chess-vault-v3'));
 assert.equal(await page.locator('#modal').isVisible(),false);
 await page.locator('#hunt-exit').click();await page.locator('[data-auto-exit="save"]').click();await page.locator('#autochess-open').click();await page.locator('[data-auto-next]').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),once);
 assert.equal(await page.locator('#modal').isVisible(),false);
 const button=await page.locator('[data-auto-next]').boundingBox(),content=await page.locator('#auto-action').boundingBox();assert.ok(button.width>=content.width-2);
 await page.screenshot({path:'/tmp/autochess-result.png',fullPage:true});
 await page.locator('[data-auto-next]').click();await page.locator('[data-auto-buy="n"]').waitFor();
 const next=await page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')));assert.equal(next.round,2);assert.equal(next.reserve,3);assert.equal(next.army.length,2);
 const wallet=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3'))),beforeWallet=JSON.parse(original);
 const receipt=wallet.autochessAwards[finished.battle.id];assert.ok(receipt);assert.equal(wallet.coins,beforeWallet.coins+receipt.coins);
 const {coins:afterCoins,autochessAwards,...afterRest}=wallet,{coins:beforeCoins,autochessAwards:beforeAwards,...beforeRest}=beforeWallet;assert.deepEqual(afterRest,beforeRest);
 await page.locator('#hunt-exit').click();await page.locator('[data-auto-exit="save"]').click();
 await page.evaluate(async()=>{
  const {completeBattle,nextRound,seriesFinished,setupFen}=await import('./autochess.js?v=94');
  let run=JSON.parse(localStorage.getItem('gachachess-autochess-v1'));
  while(!seriesFinished(run)){run={...run,phase:'paused',battle:{id:run.id+':'+run.round,initialFen:setupFen(run),moves:[],elapsed:0,result:null}};run=completeBattle(run,{winner:run.color==='w'?'b':'w',reason:'Тест итогов серии'});if(seriesFinished(run))break;run=nextRound(run);}
  localStorage.setItem('gachachess-autochess-v1',JSON.stringify(run));
 });
 await page.locator('#autochess-open').click();await page.locator('#auto-result').waitFor();
 assert.equal(await page.locator('#modal').isVisible(),true);await page.getByText('Серия завершена',{exact:true}).waitFor();
 assert.equal(await page.locator('#auto-result .stat-card').count(),3);
 assert.equal(await page.locator('#modal').getByText('Монеты',{exact:true}).count(),0);
 const finalWallet=await page.evaluate(()=>localStorage.getItem('chess-vault-v3'));
 await page.screenshot({path:'/tmp/autochess-score94.png',fullPage:true});
 await page.locator('#close-modal').click();await page.locator('#auto-reward').waitFor();
 assert.equal(await page.locator('#auto-result').count(),0);assert.equal(await page.locator('#auto-reward .stat-card').count(),1);
 const total=await page.evaluate(async()=>{const {autoSeriesCoins}=await import('./autochess-rewards.js?v=94');return autoSeriesCoins(JSON.parse(localStorage.getItem('chess-vault-v3')),JSON.parse(localStorage.getItem('gachachess-autochess-v1')));});
 assert.equal(await page.locator('#auto-reward .stat-card strong').textContent(),String(total));
 assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),finalWallet);
 await page.screenshot({path:'/tmp/autochess-coins94.png',fullPage:true});
 const finalButton=await page.locator('#modal [data-auto-next]').boundingBox(),finalContent=await page.locator('#modal-content').boundingBox();assert.ok(finalButton.width>=finalContent.width-2);
 await page.locator('#modal [data-auto-next]').click();await page.locator('#autochess-open').waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('gachachess-autochess-v1')),null);
 await page.evaluate(async()=>{
  const {createAutoRun,buyPiece,placePiece}=await import('./autochess.js?v=94');
  for(let seed=0;seed<10000;seed++){
   let run={...createAutoRun('bishop-check',String(seed)),version:3};
   if(run.color!=='w'||run.opponent.length!==2||run.opponent[1].type!=='b'||run.opponent[1].square!=='h8')continue;
   run=buyPiece(run,'b');run=placePiece(run,run.army.at(-1).id,'a1');localStorage.setItem('gachachess-autochess-v1',JSON.stringify(run));return;
  }
  throw Error('Bishop fixture not found');
 });
 await page.locator('#autochess-open').click();await page.locator('#auto-start').waitFor();
 await page.locator('#auto-board [data-square="a1"]').click();
 assert.equal(await page.locator('#auto-board .occupied').count(),2);
 assert.equal(await page.locator('#auto-board [data-square="h8"]').getAttribute('aria-label'),'h8, пусто');
 assert.equal(await page.locator('[data-auto-sell]').evaluate(button=>button.classList.contains('primary')),true);
 assert.equal(await page.locator('#auto-start').isEnabled(),true);
 await page.locator('#auto-start').click();await page.locator('#auto-action [data-auto-next]').waitFor({timeout:25000});
 const bishopResult=await page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')));
 assert.equal(bishopResult.results[0].outcome,'draw');assert.equal(bishopResult.battle.moves.length,0);
 assert.equal(await page.locator('#auto-board .occupied').count(),4);
 assert.equal(await page.locator('#modal').isVisible(),false);
 await page.locator('#hunt-exit').click();await page.locator('[data-auto-exit="discard"]').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('gachachess-autochess-v1')),null);
 await page.locator('#autochess-open').click();await page.locator('[data-auto-random]').waitFor();
 assert.equal(await page.locator('#auto-action').evaluate(node=>node.previousElementSibling.id),'auto-board');
 await page.locator('[data-auto-random]').click();
 let modern=await page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')));
 assert.equal(modern.purchases,1);assert.equal(modern.reserve,2);
 await page.locator('[data-auto-sell]').click();
 await page.locator('[data-auto-level]').click();
 modern=await page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1')));
 assert.equal(modern.level,2);assert.equal(modern.reserve,0);assert.equal(modern.purchases,1);
 await page.locator('#hunt-exit').click();await page.locator('[data-auto-exit="save"]').click();
 await page.locator('#autochess-open').click();await page.locator('[data-auto-random]').waitFor();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('gachachess-autochess-v1'))),modern);
 assert.deepEqual(errors,[]);
 await context.close();console.log('PASS Autochess: mobile/desktop, real Stockfish offline battle, board stability, pause, cold resume, tab lock, next round, isolated progress');
}finally{await browser.close();await new Promise(done=>server.close(done));}
