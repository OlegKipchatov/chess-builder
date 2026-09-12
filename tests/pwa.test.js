import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {pieceSVG} from '../dist/pieces.js';
import {TYPES,STYLES} from '../dist/catalog.js';
import vm from 'node:vm';
const read = file => readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');
test('Stockfish 19 получает изоляцию для сетевых и офлайн-ответов',async()=>{
 const handlers={};
 const cached=new Response('<html>offline</html>');
 vm.runInNewContext(read('sw.js'),{self:{location:{origin:'https://example.test'},addEventListener:(name,handler)=>{handlers[name]=handler;}},URL,Headers,Response,caches:{match:async request=>request==='./index.html'?cached.clone():undefined},fetch:async()=>new Response('worker')});
 for(const mode of ['navigate','same-origin']){
  let result;
  handlers.fetch({request:{method:'GET',url:'https://example.test/chess-builder/stockfish19-worker.js',mode},respondWith:promise=>{result=promise;}});
  const response=await result;
  assert.equal(response.headers.get('Cross-Origin-Opener-Policy'),'same-origin');
  assert.equal(response.headers.get('Cross-Origin-Embedder-Policy'),'require-corp');
  assert.equal(await response.text(),mode==='navigate'?'<html>offline</html>':'worker');
 }
 for(const name of ['stockfish19-worker.js','stockfish19-license.txt','vendor/sf19/sf_19_smallnet.js','vendor/sf19/sf_19_smallnet.wasm','vendor/sf19/nn-61e7af4bb97d.nnue']){
  assert.ok(read('sw.js').includes(`'./${name}'`),name);
  assert.ok(existsSync(new URL('../dist/'+name,import.meta.url)),name);
 }
});
test('Белые и чёрные SVG используют разные явные заливки, а не шрифтовые символы',()=>{for(const type of TYPES)for(const style of STYLES){assert.match(pieceSVG(type,'w',style.id),/fill="#faf8ef"/);assert.match(pieceSVG(type,'b',style.id),/fill="#202933"/);assert.doesNotMatch(pieceSVG(type,'w',style.id),/[♔-♟]/);}});
test('Все локальные зависимости HTML и модулей существуют и покрыты офлайн-кэшем',()=>{const sw=read('sw.js');const modules=['app.js','session.js','catalog.js','economy.js','state.js','pieces.js','board.js','collection.js','engine.js','bot-worker.js'];for(const file of modules){assert.ok(sw.includes(`'./${file}'`),file);for(const match of read(file).matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)){const name=match[1].split('?')[0];assert.ok(existsSync(new URL('../dist/'+name,import.meta.url)),name);assert.ok(sw.includes(`'./${name}'`),name);}}const html=read('index.html');assert.ok(html.includes('./app.js?v=13'));assert.ok(html.includes('./style.css?v=13'));assert.ok(sw.includes("path+'?v=13'"));});
test('Сервис-воркер обновляет оболочку целиком и сохраняет область установки',()=>{const sw=read('sw.js');assert.ok(sw.includes('ACTIVATE_UPDATE'));assert.ok(sw.includes("caches.match('./index.html')"));const manifest=JSON.parse(read('manifest.webmanifest'));assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');});
test('Stockfish WASM, лицензия и браузерный клиент включены в офлайн-поставку',()=>{const sw=read('sw.js');for(const name of ['vendor/stockfish-18-lite-single.js','vendor/stockfish-18-lite-single.wasm','stockfish-client.js','strength.js','engine-info.html','stockfish-license.txt']){assert.ok(sw.includes(`'./${name}'`));assert.ok(existsSync(new URL('../dist/'+name,import.meta.url)));}assert.match(read('engine-info.html'),/31a98753a5d932511693f44775da908377c24513/);});

test('Таблица стилей содержит оформление приложения, а не JavaScript',()=>{
 const css=read('style.css');
 assert.doesNotMatch(css,/^\s*(?:import\s|export\s|const\s|let\s)/m);
 for(const selector of [':root','body','.board','.piece-icon','.collection-row'])assert.ok(css.includes(selector+'{'),selector);
 assert.match(css,/grid-template-columns:repeat\(8,1fr\)/);
 assert.match(css,/@media\s*\(max-width:/);
});
