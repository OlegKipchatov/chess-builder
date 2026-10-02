const CACHE='chess-vault-v82';
const ASSETS=['./analysis/analysis-service.js','./analysis/analysis-storage.js','./analysis/analysis-explanations.js','./analysis/analysis-reasons.js','./analysis/analysis-classifier.js','./analysis/analysis-config.js','./analysis/analysis-playback.js','./analysis/analysis-events.js','./stockfish-evaluation.js','./ui/pages/analysis.js','./ui/components/analysis-insight.js','./ui/styles/analysis.css','./','./index.html','./style.css','./app.js','./catalog.js','./economy.js','./reward-quality.js','./economy-analysis.js','./state.js','./session.js','./rating.js','./archive.js','./pgn-export.js','./activity.js','./play-style-config.js','./cognitive-config.js','./cognitive-model.js','./cognitive-search.js','./conversion-config.js','./conversion-board.js','./conversion-model.js','./conversion-history.js','./conversion-search.js','./cognitive-profile.js','./bot-client.js','./candidate-analysis.js','./stockfish-config.js','./stockfish-client.js','./strength.js','./stockfish19-worker.js','./stockfish19-license.txt','./vendor/sf19/sf_19_smallnet.js','./vendor/sf19/sf_19_smallnet.wasm','./vendor/sf19/nn-61e7af4bb97d.nnue','./engine-info.html','./pieces.js','./board.js','./collection.js','./engine.js','./chess.js','./bot-worker.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable.png','./activity-model.js','./collection-model.js','./ui/components/activity-calendar.js','./ui/components/app-header.js','./ui/components/archive-list.js','./ui/components/bottom-navigation.js','./ui/components/chest-card.js','./ui/components/collection-view.js','./ui/components/equipment.js','./ui/components/match-header.js','./ui/components/match-status-panel.js','./ui/components/move-list.js','./ui/components/move-navigation.js','./ui/components/wallet-balance.js','./ui/dialog-content.js','./ui/dialog.js','./ui/motion.js','./ui/styles/motion.css','./ui/pages/archive.js','./ui/pages/calendar.js','./ui/pages/chests.js','./ui/pages/collection.js','./ui/pages/faq.js','./ui/pages/play.js','./ui/pages/profile.js','./ui/pages/statistics.js','./ui/primitives.js','./ui/shell.js','./ui/styles/base.css','./ui/styles/board.css','./ui/styles/collection.css','./ui/styles/content.css','./ui/styles/dialog.css','./ui/styles/game.css','./ui/styles/shell.css','./ui/styles/tokens.css'];
ASSETS.push('./analysis/analysis-training.js','./pgn-import.js');
const VERSIONED=ASSETS.filter(path=>path.endsWith('.js')||path.endsWith('.css')).map(path=>path+'?v=82');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...ASSETS,...VERSIONED].map(path=>new Request(path,{cache:'reload'}))))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
// Retain the newest actually installed predecessor, including skipped releases.
const previousCaches = async () => (await caches.keys())
  .filter(key=>/^chess-vault-v\d+$/.test(key)&&Number(key.slice(13))<Number(CACHE.slice(13)))
  .sort((a,b)=>Number(b.slice(13))-Number(a.slice(13)));
self.addEventListener('activate',event=>event.waitUntil(previousCaches()
  .then(keys=>Promise.all(keys.slice(1).map(key=>caches.delete(key))))
  .then(()=>self.clients.claim())));
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
  // Serve the HTML and dependency graph atomically from the installed release.
  // An online navigation must not mix tomorrow's HTML with today's precache.
  const response=caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(event.request.mode==='navigate'?'./index.html':event.request);
    if(cached)return cached;
    // A running game may still use the previous release until its safe reload.
    // Match exact URLs: never substitute another version with ignoreSearch.
    const [previousName]=await previousCaches();
    if(previousName){
      const compatible=await caches.match(event.request,{cacheName:previousName});
      if(compatible)return compatible;
    }
    const fresh=await fetch(event.request);
    // Repair an evicted entry without requiring another Service Worker release.
    // Only cache known release URLs, never arbitrary pages or error responses.
    const known=[...ASSETS,...VERSIONED].some(path=>new URL(path,self.registration.scope).href===event.request.url);
    if(fresh.ok&&known){
      try {await cache.put(event.request,fresh.clone());} catch { /* A full cache must not block a successful online response. */ }
    }
    return fresh;
  });
  event.respondWith(response.then(isolated));
});
