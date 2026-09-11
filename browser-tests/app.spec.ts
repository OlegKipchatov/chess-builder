import {test,expect} from '@playwright/test';
const ready=async(page:import('@playwright/test').Page)=>{await page.goto('/');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await expect(page.getByRole('button',{name:'Начать партию',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'Начать партию',exact:true})).toBeVisible();};
test('Мобильные экраны имеют стили и не выходят за ширину',async({page})=>{
 await ready(page);
 for(const route of ['/','/collection','/craft','/chests','/profile','/faq']){
  await page.goto(route);await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 }
 await page.goto('/collection');await expect(page.locator('.collection-row')).toHaveCount(8);
 await page.screenshot({path:test.info().outputPath('collection-mobile.png'),fullPage:true});
});
test('Stockfish, блокировки, итоговый диалог и архив с нулевого хода',async({page})=>{
 await ready(page);expect(await page.evaluate(()=>crossOriginIsolated)).toBe(true);
 await page.getByRole('button',{name:'Начать партию',exact:true}).click();
 await expect(page.locator('[data-square]')).toHaveCount(64);await expect(page.locator('#app-nav')).toHaveCount(0);
 const color=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-preprod-v3')!).game.playerColor);
 if(color==='w'){await page.locator('[data-square="e2"]').click();await page.waitForTimeout(450);await page.locator('[data-square="e4"]').click();}
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('chess-vault-preprod-v3')!).game.pgn),{timeout:30000}).toMatch(color==='w'?/1\. e4 \S+/:/1\. \S+/);
 await page.screenshot({path:test.info().outputPath('game-mobile.png'),fullPage:true});
 await page.goto('/profile');await expect(page).toHaveURL(/\/$/);await expect(page.getByRole('button',{name:'Сдаться',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Сдаться',exact:true}).click();await page.getByRole('button',{name:'Подтвердить сдачу'}).click();
 await expect(page.getByRole('dialog')).toContainText('Поражение');await expect(page.locator('[data-square]')).toHaveCount(64);
 await page.getByRole('button',{name:'Продолжить',exact:true}).click();await expect(page.locator('[data-square]')).toHaveCount(0);
 await page.goto('/profile');await page.locator('.archive-entry').first().click();await expect(page.getByText(/Позиция 0 из/)).toBeVisible();
 await page.getByRole('button',{name:'Начать воспроизведение',exact:true}).click();await expect(page.getByText(/Позиция 1 из/)).toBeVisible();
 const pause=page.getByRole('button',{name:'Приостановить воспроизведение'});if(await pause.isVisible())await pause.click();
 await page.getByRole('link',{name:'К истории партий'}).click();await expect(page).toHaveURL(/\/profile$/);
});
test('Офлайн-кэш содержит маршруты и стили',async({page,request})=>{
 await ready(page);
 await page.waitForFunction(async()=>!!await caches.match('/index.html'));
 // Disconnect the HTTP origin rather than relying on browser-specific offline emulation.
 await request.post('/__test/network/off');
 try{
  await page.goto('/collection');
  await expect(page.locator('.collection-row')).toHaveCount(8);
  expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await page.evaluate(async()=>{try{await fetch('/uncached-offline-probe');return false;}catch{return true;}})).toBe(true);
 }finally{await request.post('/__test/network/on');}
});
