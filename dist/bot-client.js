import {decisionModeFor} from './cognitive-model.js?v=40';
import {validEngineProfile} from './strength.js?v=40';
import {createStockfishClient} from './stockfish-client.js?v=40';
import {Chess} from './chess.js?v=40';
export const COGNITIVE_TIMEOUT_MS=12000;
/** One client per session; native boundary uses TARGET, never per-move variance. */
export const createBotClient = (profile,{spawn=()=>new Worker('./bot-worker.js?v=40',{type:'module'}),native=()=>createStockfishClient()}={}) => {
 if(!validEngineProfile(profile))throw Error('Invalid engine profile');
 if(decisionModeFor(profile.targetElo)==='native-stockfish')return native();
 const worker=spawn(),client={onmessage:null,onerror:null};let dead=false,current=null,timer=null;
 const stop=()=>{clearTimeout(timer);current=null;dead=true;worker.terminate();};
 const fail=error=>{if(dead)return;stop();client.onerror?.(error instanceof Error?error:new Error(error?.message||'Cognitive worker failed'));};
 worker.onmessage=({data})=>{
  if(dead||!current||data.id!==current.id)return;
  try{
   if(data.error)throw Error(data.error);
   const game=new Chess();if(current.pgn)game.loadPgn(current.pgn);else game.load(current.fen);
   if(current.fen&&game.fen()!==current.fen)throw Error('Position/history mismatch');
   if(data.move)game.move(data.move);else if(!game.isGameOver())throw Error('Missing cognitive move');
   clearTimeout(timer);current=null;client.onmessage?.({data});
  }catch(error){fail(error);}
 };
 worker.onerror=fail;
 client.postMessage=data=>{
  if(dead)throw Error('Cognitive worker terminated');if(current)throw Error('Search already running');
  if(JSON.stringify(data.engineProfile)!==JSON.stringify(profile))throw Error('Session profile changed');
  current=data;timer=setTimeout(()=>fail(Error('Cognitive search timeout')),COGNITIVE_TIMEOUT_MS);
  try{worker.postMessage(data);}catch(error){fail(error);}
 };
 client.terminate=stop;return client;
};
