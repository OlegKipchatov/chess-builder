import {createContext,useContext,useEffect,useState,useSyncExternalStore,type ReactNode} from 'react';
import {createStore,createGame,type Store,STORAGE_KEY} from '../services/store';
import type {MoveInput} from '../domain/types';
const Context=createContext<Store|null>(null);
export const useStore=()=>{const store=useContext(Context);if(!store)throw Error('Store provider missing');return store;};
export const useSnapshot=()=>{const store=useStore();return useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);};
export const Provider=({children}:{children:ReactNode})=>{
 const [store]=useState(createStore);
 useEffect(()=>{store.initialize(localStorage);const refresh=(event:StorageEvent)=>{if(event.key===STORAGE_KEY)location.reload();};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[store]);
 return <Context.Provider value={store}><Engine/>{children}</Context.Provider>;
};
const Engine=()=>{
 const store=useStore(),{data,ready,error,result}=useSnapshot();
 const pgn=data.game.pgn,profile=data.game.engineProfile;
 useEffect(()=>{
  if(!ready||!data.game.started||result||error||data.game.mode!=='bot')return;
  const game=createGame(pgn);if(game.isGameOver()||game.turn()===data.game.playerColor)return;
  let cancelled=false;let client:{terminate:()=>void}|undefined;
  store.setBusy(true);
  const start=async()=>{
   try{
    const module=await import('../services/uci.js');if(cancelled)return;
    const spawn=()=>new Worker(profile?.id==='stockfish19-v1'?'/engine/stockfish19-worker.js':profile?'/engine/vendor/stockfish-18-lite-single.js':'/engine/bot-worker.js',profile?.id==='stockfish19-v1'||!profile?{type:'module'}:undefined);
    const worker=profile?module.createStockfishClient(spawn):spawn();client=worker;
    worker.onmessage=(event:MessageEvent<{move:MoveInput|null}>)=>{if(!cancelled&&event.data.move)store.play(event.data.move,true);};
    worker.onerror=()=>{if(!cancelled)store.setError('ИИ не смог выполнить ход. Повторите расчёт; партия сохранена.');};
    worker.postMessage({id:1,pgn,fen:game.fen(),rating:data.game.rating?.opponent||1000,difficulty:'adaptive',engineProfile:profile});
   }catch{if(!cancelled)store.setError('Не удалось запустить ИИ. Обновите приложение и повторите расчёт.');}
  };
  void start();return()=>{cancelled=true;client?.terminate();};
 },[store,pgn,ready,data.game.started,data.game.playerColor,data.game.mode,profile,data.game.rating,result,error]);
 return null;
};
