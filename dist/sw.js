const CACHE='chess-vault-v3';
const ASSETS=['./','./index.html','./style.css','./app.js','./catalog.js','./economy.js','./state.js','./session.js','./pieces.js','./board.js','./collection.js','./engine.js','./chess.js','./bot-worker.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable.png'];
const VERSIONED=ASSETS.filter(path=>path.endsWith('.js')||path.endsWith('.css')).map(path=>path+'?v=3');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...ASSETS,...VERSIONED]))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('chess-vault-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  // Serve a coherent app shell: don't mix new HTML with old cached modules.
  if(event.request.mode==='navigate'){event.respondWith(caches.match('./index.html').then(cached=>cached||fetch(event.request)));return;}
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
