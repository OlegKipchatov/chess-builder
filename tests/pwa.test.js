import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {pieceSVG} from '../dist/pieces.js';
import {TYPES,STYLES} from '../dist/catalog.js';
import vm from 'node:vm';
const read = file => readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');
test('Весь граф runtime-модулей согласован с v40 и доступен офлайн',()=>{
 const sw=read('sw.js');
 for(const file of readdirSync(new URL('../dist/',import.meta.url)).filter(name=>name.endsWith('.js')&&name!=='sw.js')){
  assert.ok(sw.includes(`'./${file}'`),file);
  for(const match of read(file).matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)){
   const [name,query]=match[1].split('?');assert.ok(existsSync(new URL('../dist/'+name,import.meta.url)),`${file}: ${name}`);
   assert.ok(sw.includes(`'./${name}'`),name);if(!name.startsWith('vendor/'))assert.equal(query,'v=40',`${file}: ${name}`);
  }
 }
 for(const name of ['difficulty-model.js','difficulty-config.js','play-style.js'])assert.equal(existsSync(new URL('../dist/'+name,import.meta.url)),false,name);
});
test('Stockfish 19 получает изоляцию для сетевых и офлайн-ответов',async()=>{
 const handlers={};
 const cached=new Response('<html>offline</html>');
 vm.runInNewContext(read('sw.js'),{self:{location:{origin:'https://example.test'},addEventListener:(name,handler)=>{handlers[name]=handler;}},URL,Headers,Response,Request:class {constructor(request){Object.assign(this,request);}},caches:{open:async()=>({match:async request=>request==='./index.html'?cached.clone():undefined})},fetch:async request=>{if(request.mode==='navigate')throw Error('offline');return new Response('worker');}});
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
test('Все локальные зависимости HTML и модулей существуют и покрыты офлайн-кэшем',()=>{const sw=read('sw.js');const modules=['app.js','session.js','catalog.js','economy.js','state.js','pieces.js','board.js','collection.js','engine.js','bot-worker.js'];for(const file of modules){assert.ok(sw.includes(`'./${file}'`),file);for(const match of read(file).matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)){const name=match[1].split('?')[0];assert.ok(existsSync(new URL('../dist/'+name,import.meta.url)),name);assert.ok(sw.includes(`'./${name}'`),name);}}const html=read('index.html');assert.ok(html.includes('./app.js?v=40'));assert.ok(html.includes('./style.css?v=40'));assert.ok(sw.includes("path+'?v=40'"));});
test('Сервис-воркер обновляет оболочку целиком и сохраняет область установки',()=>{const sw=read('sw.js');assert.ok(sw.includes('ACTIVATE_UPDATE'));assert.ok(sw.includes("cache.match('./index.html')"));const manifest=JSON.parse(read('manifest.webmanifest'));assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');});
test('Поставка v40 содержит v2, но не содержит удалённый алгоритм и SF18',()=>{const sw=read('sw.js');for(const name of ['cognitive-config.js','cognitive-model.js','cognitive-search.js','cognitive-profile.js','bot-client.js','stockfish-config.js','stockfish-client.js','strength.js','engine-info.html']){assert.ok(sw.includes(`'./${name}'`));assert.ok(existsSync(new URL('../dist/'+name,import.meta.url)));}for(const name of ['difficulty-model.js','difficulty-config.js','play-style.js','stockfish-18-lite-single'])assert.ok(!sw.includes(name));assert.match(read('engine-info.html'),/Cognitive v2/);});

test('Таблица стилей содержит оформление приложения, а не JavaScript',()=>{
 const css=read('style.css')+readdirSync(new URL('../dist/ui/styles/',import.meta.url)).filter(name=>name.endsWith('.css')).map(name=>read('ui/styles/'+name)).join('\n');
 assert.doesNotMatch(css,/^\s*(?:import\s|export\s|const\s|let\s)/m);
 for(const selector of [':root','body','.board','.piece-icon','.collection-row'])assert.ok(css.includes(selector+'{'),selector);
 assert.match(css,/grid-template-columns:repeat\(8,1fr\)/);
 assert.match(css,/@media\s*\(max-width:/);
});

test('Переход v36 → v40 загружает ресурсы без HTTP-кэша и удаляет только старые кэши приложения',async()=>{
 const handlers={},removed=[],stored=[];let claimed=false;
 vm.runInNewContext(read('sw.js'),{
  self:{addEventListener:(name,handler)=>{handlers[name]=handler;},skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}}},
  Request:class {constructor(url,options){this.url=url;this.cache=options.cache;}},
  caches:{open:async name=>{assert.equal(name,'chess-vault-v40');return {addAll:async requests=>stored.push(...requests)};},keys:async()=>['chess-vault-v36','chess-vault-v40','another-app'],delete:async name=>removed.push(name)}
 });
 let pending;handlers.install({waitUntil:promise=>{pending=promise;}});await pending;
 assert.ok(stored.every(request=>request.cache==='reload'));
 for(const url of ['./app.js?v=40','./ui/dialog.js?v=40','./ui/styles/dialog.css?v=40','./engine.js?v=40'])assert.ok(stored.some(request=>request.url===url),url);
 handlers.activate({waitUntil:promise=>{pending=promise;}});await pending;
 assert.deepEqual(removed,['chess-vault-v36']);assert.equal(claimed,true);
});

const workerHarness = ({online=true,networkStatus=200}={}) => {
 const handlers={},requests=[],removed=[],entries=new Map([['./index.html','<html>cached-37</html>'],['./app.js?v=40','app-37']]);
 let activated=false;
 const cache={match:async key=>entries.has(typeof key==='string'?key:key.url)?new Response(entries.get(typeof key==='string'?key:key.url)):undefined,addAll:async requests=>{for(const request of requests)assert.equal(request.cache,'reload');}};
 vm.runInNewContext(read('sw.js'),{
  self:{location:{origin:'https://example.test'},addEventListener:(name,handler)=>{handlers[name]=handler;},skipWaiting:async()=>{activated=true;},clients:{claim:async()=>{}}},URL,Headers,Response,
  Request:class {constructor(request,options){if(typeof request==='string')this.url=request;else Object.assign(this,request);Object.assign(this,options);}},
  caches:{open:async name=>{assert.equal(name,'chess-vault-v40');return cache;},keys:async()=>['chess-vault-v34','chess-vault-v35','chess-vault-v40','other-app'],delete:async key=>removed.push(key)},
  fetch:async request=>{requests.push(request);if(!online)throw Error('offline');return new Response('<html>network-latest</html>',{status:networkStatus});}
 });
 const run = async name=>{let promise;handlers[name]({waitUntil:value=>{promise=value;}});await promise;};
 const navigate = async()=>{let response;handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://example.test/',cache:'default'},respondWith:value=>{response=value;}});return (await response).text();};
 return {run,navigate,requests,removed,isActivated:()=>activated};
};
test('Онлайн-переход возвращает свежий HTML, даже когда старый HTML уже закэширован',async()=>{
 const worker=workerHarness();assert.equal(await worker.navigate(),'<html>network-latest</html>');assert.equal(worker.requests[0].cache,'no-store');
});
test('Офлайн и ошибка сервера используют сохранённую оболочку текущей версии',async()=>{
 for(const options of [{online:false},{networkStatus:503}])assert.equal(await workerHarness(options).navigate(),'<html>cached-37</html>');
});
test('Новый worker активируется без кнопки; v34/v35 удаляются, чужой кэш сохраняется',async()=>{
 const worker=workerHarness();await worker.run('install');assert.equal(worker.isActivated(),true);await worker.run('activate');assert.deepEqual(worker.removed,['chess-vault-v34','chess-vault-v35']);
});

test('Обновление откладывает перезагрузку до конца партии и всех post-game сообщений',async()=>{
 const app=read('app.js');
 const block=app.slice(app.indexOf('let refreshPending='),app.indexOf("$('.brand>span:first-child')"));
 const listeners={},modal=new EventTarget();modal.open=false;let reloads=0;
 const context=vm.createContext({navigator:{serviceWorker:{controller:{},addEventListener:(name,handler)=>{listeners[name]=handler;},register:async()=>({waiting:null,addEventListener:()=>{},update:async()=>{}})}},
  document:{hidden:false,addEventListener:()=>{}},window:{addEventListener:()=>{}},location:{reload:()=>reloads++},active:()=>context.matchActive,pendingResult:false,animating:false,matchActive:true,$:()=>modal,queueMicrotask,toast:()=>{}});
 vm.runInContext(block,context);listeners.controllerchange();assert.equal(reloads,0);
 context.matchActive=false;context.pendingResult=true;vm.runInContext('applyPendingUpdate()',context);assert.equal(reloads,0);
 context.pendingResult=false;modal.open=true;vm.runInContext('applyPendingUpdate()',context);assert.equal(reloads,0);
 modal.open=false;vm.runInContext('applyPendingUpdate();applyPendingUpdate()',context);assert.equal(reloads,1);
});
