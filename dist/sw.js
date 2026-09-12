const CACHE='chess-vault-v14';
const ASSETS=['./','./index.html','./style.css','./app.js','./catalog.js','./economy.js','./state.js','./session.js','./rating.js','./archive.js','./activity.js','./stockfish-client.js','./strength.js','./stockfish19-worker.js','./stockfish19-license.txt','./vendor/sf19/sf_19_smallnet.js','./vendor/sf19/sf_19_smallnet.wasm','./vendor/sf19/nn-61e7af4bb97d.nnue','./vendor/stockfish-18-lite-single.js','./vendor/stockfish-18-lite-single.wasm','./engine-info.html','./stockfish-license.txt','./pieces.js','./board.js','./collection.js','./engine.js','./chess.js','./bot-worker.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable.png'];
const VERSIONED=ASSETS.filter(path=>path.endsWith('.js')||path.endsWith('.css')).map(path=>path+'?v=14');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...ASSETS,...VERSIONED]))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('chess-vault-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
const isolated = response => {
  if(!response||response.status===0)return response;
  const headers=new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy','same-origin');
  headers.set('Cross-Origin-Embedder-Policy','require-corp');
  headers.set('Cross-Origin-Resource-Policy','same-origin');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
};
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.cache==='only-if-cached'&&event.request.mode!=='same-origin')return;
  const cached=event.request.mode==='navigate'?caches.match('./index.html'):caches.match(event.request);
  event.respondWith(cached.then(response=>response||fetch(event.request)).then(isolated));
});
