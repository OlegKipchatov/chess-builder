import assert from 'node:assert/strict';
export const testPgnViewer = async (page,url) => {
 await page.goto(url+'#profile');await page.locator('#open-pgn').waitFor();
 const before=await page.evaluate(()=>localStorage.getItem('chess-vault-v3'));
 const pgn=await page.evaluate(async()=>{
  const {Chess}=await import('./chess.js?v=87'),{exportPgn}=await import('./pgn-export.js?v=87');
  const game=new Chess();['e4','e5','Nf3','Nc6'].forEach(move=>game.move(move));
  return exportPgn(game,{startedAt:'2026-10-01T12:00:00Z',playerColor:'b'});
 });
 await page.locator('#open-pgn').click();
 assert.equal(await page.locator('#dialog-title').evaluate(node=>getComputedStyle(node).outlineStyle),'none');
 await page.keyboard.press('Tab');assert.equal(await page.locator('[data-pgn-paste]').evaluate(node=>getComputedStyle(node).outlineStyle),'solid');
 await page.locator('[data-pgn-paste]').click();
 await page.locator('#import-pgn-text').fill('wrong PGN');await page.locator('#import-pgn-form [type=submit]').click();
 await page.locator('#pgn-import-error').filter({hasText:'Не удалось прочитать'}).waitFor();
 await page.locator('#import-pgn-text').fill(pgn);await page.locator('#import-pgn-form [type=submit]').click();
 await page.locator('#modal').waitFor({state:'hidden'});
 assert.equal(await page.locator('#history-position').innerText(),'0 / 4');assert.equal(await page.locator('#archive-analysis').isVisible(),false);
 assert.equal(await page.locator('#player-name').innerText(),'AI');assert.equal(await page.locator('#opponent').innerText(),'Player');
 await page.locator('#history-slider').press('End');await page.waitForFunction(()=>document.querySelector('#history-position').textContent==='4 / 4');
 await page.locator('#export-pgn').click();await page.locator('#pgn-text').waitFor();
 assert.equal(await page.locator('#pgn-text').inputValue(),pgn);
 assert.notEqual(await page.evaluate(()=>document.activeElement.id),'pgn-text');
 assert.equal(await page.locator('#dialog-title').evaluate(node=>getComputedStyle(node).outlineStyle),'none');
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:844});
  await page.locator('#modal').evaluate(async node=>{await Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
  assert.ok(await page.locator('#pgn-text').evaluate(node=>parseFloat(getComputedStyle(node).fontSize)>=16));
  const boxes=await page.locator('.pgn-actions button').evaluateAll(nodes=>nodes.map(node=>({top:node.getBoundingClientRect().top,width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));
  assert.ok(boxes.every(box=>Math.abs(box.top-boxes[0].top)<.5&&box.width>=43.9&&box.height>=43.9));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 // Clipboard is controlled here because headless permission prompts are not part of the product.
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedPgn=text;}}}));
 await page.locator('[data-copy-pgn]').click();await page.locator('#pgn-feedback').filter({hasText:'PGN скопирован'}).waitFor();
 assert.equal(await page.evaluate(()=>window.copiedPgn),pgn);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}}));
 await page.locator('[data-copy-pgn]').click();await page.locator('#pgn-feedback').filter({hasText:'Не удалось скопировать'}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.locator('#modal').evaluate(async node=>{await Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
 assert.equal(await page.locator('#close-modal').evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight),true);
 await page.screenshot({path:'/tmp/gacha-export-v79.png',fullPage:true});
 await page.locator('#close-modal').click();await page.locator('#archive-return').click();await page.locator('#open-pgn').waitFor();
 await page.locator('#open-pgn').click();await page.locator('#pgn-file').setInputFiles({name:'GachaChess.pgn',mimeType:'application/x-chess-pgn',buffer:Buffer.from(pgn)});
 await page.locator('#modal').waitFor({state:'hidden'});assert.equal(await page.locator('#history-position').innerText(),'0 / 4');
 assert.equal(await page.evaluate(()=>localStorage.getItem('chess-vault-v3')),before,'Import and export never change progress');
 await page.locator('#archive-return').click();await page.locator('#open-pgn').waitFor();
 console.log('PASS single PGN file/text import, export, copy feedback, mobile layout and unchanged progress');
};
