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
const browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER_EXECUTABLE?{executablePath:process.env.PWA_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-gpu']});
const origin=`http://127.0.0.1:${server.address().port}`;
try {
  for(const [width,motion] of [[320,'reduce'],[390,'reduce'],[1280,'reduce'],[390,'no-preference']]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:motion}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&crossOriginIsolated);
    assert.equal(await page.locator('#play #hunt-entry').count(),0);
    await page.locator('[data-tab="minigames"]').click();
    await page.locator('[data-hunt-mode="timed"]').waitFor();
    const title=await page.locator('#minigames-title').boundingBox(),header=await page.locator('#minigames .page-header').boundingBox();
    assert.ok(Math.abs(title.x-header.x)<1,'Root title has no reserved back-button gap');
    assert.equal(await page.locator('[data-hunt-mode="endless"]').textContent(),'На жизни');
    await page.screenshot({path:`/tmp/gachachess-hunt-entry-${width}.png`,fullPage:true});
    await page.clock.install();
    await page.locator('[data-hunt-mode="timed"]').click();
    assert.equal(await page.locator('#hunt-board [data-square]').count(),64);
    assert.equal(await page.locator('#hunt-board .occupied').count(),4);
    assert.equal(await page.locator('#app-nav').isVisible(),false);
    assert.equal(await page.locator('#minigames .page-header #hunt-exit').count(),1);
    assert.equal(await page.locator('#hunt-root .hunt-toolbar').count(),0);
    assert.equal(await page.locator('#hunt-root').getByText('Соперник',{exact:true}).count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`/tmp/gachachess-hunt-game-${width}.png`,fullPage:true});
    // Exercise real clicks against geometry reconstructed from accessible labels.
    for(let i=0;i<18;i++){
      const move=await page.evaluate(async()=>{
        const {PIECE_NAMES}=await import('./catalog.js?v=101'),{playerMoves,resolvePlayerMove,materialValues}=await import('./hunt.js?v=101');
        const pieces=Object.fromEntries([...document.querySelectorAll('#hunt-board .occupied')].map(cell=>{
          const label=cell.getAttribute('aria-label');return [cell.dataset.square,{type:Object.entries(PIECE_NAMES).find(([,name])=>label.includes(': '+name))[0],color:label.includes('белые')?'w':'b'}];
        }));
        const state={pieces,phase:'awaitingPlayer',mode:'timed',targetEndAtMs:Date.now()+60000,score:0,capturedMaterial:0,playerMoveCount:0,rngState:1};
        return playerMoves(state).map(move=>{const next=resolvePlayerMove(state,move);return {move,value:(materialValues[pieces[move.to]?.type]||0)*10+playerMoves(next.state).reduce((best,m)=>Math.max(best,materialValues[next.state.pieces[m.to]?.type]||0),0)};}).sort((a,b)=>b.value-a.value)[0]?.move;
      });
      if(!move)break;
      await page.locator(`#hunt-board [data-square="${move.from}"]`).click();await page.locator(`#hunt-board [data-square="${move.to}"]`).click();
      await page.waitForFunction(()=>document.querySelector('#hunt-board').getAttribute('aria-disabled')==='false');
    }
    assert.ok(Number(await page.locator('#hunt-score').textContent())>0);
    await context.setOffline(true);
    const boardBefore=await page.locator('#hunt-board').boundingBox();
    await page.clock.fastForward(61000);
    await page.locator('#modal #hunt-result').waitFor();
    assert.match(await page.locator('#hunt-result').textContent(),/рекорд/i);
    assert.doesNotMatch(await page.locator('#hunt-result').textContent(),/Взятый материал/);
    await page.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    assert.equal(await page.locator('#hunt-root #hunt-result').count(),0);
    const boardAfter=await page.locator('#hunt-board').boundingBox();
    assert.equal(boardAfter.width,boardBefore.width);assert.equal(boardAfter.y,boardBefore.y);
    await page.screenshot({path:`/tmp/gachachess-hunt-result-${width}.png`,fullPage:true});
    await page.locator('#close-modal').click();
    await page.locator('#hunt-reward').waitFor();
    assert.doesNotMatch(await page.locator('#hunt-reward').textContent(),/рекорд|Взятый материал|Очки/i);
    await page.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    await page.screenshot({path:`/tmp/gachachess-hunt-reward-${width}.png`,fullPage:true});
    const action=await page.locator('#hunt-again').boundingBox(),reward=await page.locator('#hunt-reward').boundingBox();assert.ok(Math.abs(action.width-reward.width)<2);
    const paid=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));
    assert.ok(paid.coins>100);assert.equal(Object.keys(paid.hunt.awards).length,1);
    await page.locator('#close-modal').click();await page.reload();await page.locator('[data-hunt-mode="endless"]').waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).coins),paid.coins);
    assert.doesNotMatch(await page.locator('#hunt-entry').textContent(),/рекорд/i);
    await page.locator('[data-hunt-mode="endless"]').click();await page.locator('#hunt-exit').click();
    const exit=await page.locator('[data-hunt-abandon]').boundingBox(),content=await page.locator('#modal-content').boundingBox();
    assert.ok(Math.abs(exit.width-content.width)<2,'Exit action fills modal content width');
    await page.locator('[data-hunt-abandon]').click();await page.locator('[data-hunt-mode="timed"]').waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')).coins),paid.coins);
    if(width===390&&motion==='reduce'){
      await page.locator('[data-hunt-mode="endless"]').click();
      for(let turn=0;turn<100&&!await page.locator('#modal #hunt-result').count();turn++){
        const move=await page.evaluate(async()=>{
          const {PIECE_NAMES}=await import('./catalog.js?v=101'),{playerMoves,resolvePlayerMove}=await import('./hunt.js?v=101');
          const pieces=Object.fromEntries([...document.querySelectorAll('#hunt-board .occupied')].map(cell=>{const label=cell.getAttribute('aria-label');return [cell.dataset.square,{type:Object.entries(PIECE_NAMES).find(([,name])=>label.includes(': '+name))[0],color:label.includes('белые')?'w':'b'}];}));
          const state={pieces,phase:'awaitingPlayer',mode:'endless',lives:5,lifeRecoveryMaterial:0,score:0,capturedMaterial:0,playerMoveCount:0,rngState:1};
          return playerMoves(state).map(move=>{
            const result=resolvePlayerMove(state,move),loss=result.events.some(e=>e.type==='opponentCaptured');
            const distance=Math.min(...Object.entries(pieces).filter(([,p])=>p.color==='b').map(([square])=>Math.abs(square.charCodeAt(0)-move.to.charCodeAt(0))+Math.abs(Number(square[1])-Number(move.to[1]))));
            return {move,value:(loss?1000:0)-(pieces[move.to]?20:0)-distance};
          }).sort((a,b)=>b.value-a.value)[0]?.move;
        });
        assert.ok(move);await page.locator(`#hunt-board [data-square="${move.from}"]`).click();await page.locator(`#hunt-board [data-square="${move.to}"]`).click();
      }
      await page.locator('#modal #hunt-result').waitFor();
      assert.equal(await page.locator('#hunt-resource').textContent(),'0');
      const ended=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-v3')));assert.equal(Object.keys(ended.hunt.awards).length,2);
      await page.locator('#close-modal').click();await page.locator('#hunt-reward').waitFor();
      await page.locator('#hunt-again').click();await page.waitForFunction(()=>!document.querySelector('#modal').open&&document.querySelector('#hunt-resource').textContent==='5');
      await page.locator('#hunt-exit').click();await page.locator('[data-hunt-abandon]').click();
      console.log('PASS Endless: repeated losses, replacements, zero lives, completed result, idempotent wallet');
    }
    assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}px ${motion}: play, score, timed completion offline, reward, reload deduplication, abandon`);
  }
} finally {await browser.close();await new Promise(done=>server.close(done));}
