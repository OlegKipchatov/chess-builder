const CACHE='chess-vault-v27';
const ASSETS=['./','./index.html','./style.css','./app.js','./catalog.js','./economy.js','./state.js','./session.js','./rating.js','./archive.js','./pgn-export.js','./activity.js','./play-style-config.js','./cognitive-config.js','./cognitive-model.js','./cognitive-search.js','./cognitive-profile.js','./bot-client.js','./candidate-analysis.js','./stockfish-config.js','./stockfish-client.js','./strength.js','./stockfish19-worker.js','./stockfish19-license.txt','./vendor/sf19/sf_19_smallnet.js','./vendor/sf19/sf_19_smallnet.wasm','./vendor/sf19/nn-61e7af4bb97d.nnue','./engine-info.html','./pieces.js','./board.js','./collection.js','./engine.js','./chess.js','./bot-worker.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable.png','./activity-model.js','./collection-model.js','./ui/components/activity-calendar.js','./ui/components/app-header.js','./ui/components/archive-list.js','./ui/components/bottom-navigation.js','./ui/components/chest-card.js','./ui/components/collection-view.js','./ui/components/equipment.js','./ui/components/match-header.js','./ui/components/match-status-panel.js','./ui/components/move-list.js','./ui/components/move-navigation.js','./ui/components/wallet-balance.js','./ui/dialog-content.js','./ui/dialog.js','./ui/pages/archive.js','./ui/pages/calendar.js','./ui/pages/chests.js','./ui/pages/collection.js','./ui/pages/faq.js','./ui/pages/play.js','./ui/pages/profile.js','./ui/pages/statistics.js','./ui/primitives.js','./ui/shell.js','./ui/styles/base.css','./ui/styles/board.css','./ui/styles/collection.css','./ui/styles/content.css','./ui/styles/dialog.css','./ui/styles/game.css','./ui/styles/shell.css','./ui/styles/tokens.css'];
const VERSIONED=ASSETS.filter(path=>path.endsWith('.js')||path.endsWith('.css')).map(path=>path+'?v=27');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...ASSETS,...VERSIONED].map(path=>new Request(path,{cache:'reload'}))))));
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
