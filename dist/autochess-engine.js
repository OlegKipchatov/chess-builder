import {STOCKFISH as C} from './stockfish-config.js?v=112';
import {AUTO} from './autochess.js?v=112';
import {createEngineWorker,recordStockfishRestart} from './stockfish-lifecycle.js?v=112';
// One sequential worker per active battle; no rating or difficulty model.
export const createAutoplayEngine = (spawn=createEngineWorker) => {
 const worker=spawn();let pending=null,dead=false,initialized=false,readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 const send=command=>worker.postMessage(command);
 let watchdog;
 const fail=error=>{if(dead)return;dead=true;clearTimeout(watchdog);worker.terminate();initialized=false;worker.onmessage=null;worker.onerror=null;readyReject?.(error);readyResolve=null;readyReject=null;pending?.reject(error);pending=null;};
 watchdog=setTimeout(()=>fail(Error('Не удалось подготовить движок')),C.initializationMs);
 worker.onerror=event=>fail(Error(event.message||'Движок остановился'));
 worker.onmessage=event=>{
  if(dead)return;
  for(const line of String(event.data).split('\n')){
   if(/Unsupported position|Invalid FEN/i.test(line)){fail(Object.assign(Error('Состав или расстановка не поддерживаются движком. Вернитесь к подготовке и исправьте состав.'),{code:'UNSUPPORTED_POSITION'}));return;}
   if(line.trim()==='uciok'){
    ['setoption name Threads value 1','setoption name Hash value 4','setoption name Skill Level value 20','setoption name UCI_LimitStrength value false','setoption name MultiPV value 1','ucinewgame','isready'].forEach(send);
   }else if(line.trim()==='readyok'){clearTimeout(watchdog);initialized=true;readyResolve?.();readyResolve=null;readyReject=null;}
   else if(line.startsWith('bestmove ')&&pending){
    const request=pending;pending=null;clearTimeout(watchdog);
    const token=line.split(/\s+/)[1];
    if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token))request.reject(Error('Движок не вернул ход'));else request.resolve(token);
   }
  }
 };
 send('uci');
 return {ready,isIdle:()=>!dead&&initialized&&!pending,newGame:()=>{
  if(dead||pending)return Promise.reject(Error('Движок недоступен'));
  initialized=false;const prepared=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  watchdog=setTimeout(()=>fail(Error('Не удалось подготовить движок')),C.initializationMs);send('ucinewgame');send('isready');return prepared;
 },search:(initialFen,moves)=>{
  if(dead||pending)return Promise.reject(Error('Движок недоступен'));
  return new Promise((resolve,reject)=>{
   pending={resolve,reject};watchdog=setTimeout(()=>{recordStockfishRestart('Autochess search watchdog');fail(Error('Движок не ответил'));},4000);
   send(`position fen ${initialFen}${moves.length?' moves '+moves.join(' '):''}`);send(`go movetime ${AUTO.movetime}`);
  });
 },terminate:()=>fail(Object.assign(Error('Бой приостановлен'),{name:'AbortError'}))};
};
// Each battle owns a fresh worker tree. Completion, pause and exit release it.
export const createAutoplaySession = (factory=createAutoplayEngine) => {
 let client=null;
 const dispose=()=>{client?.terminate();client=null;};
 return {dispose,create:()=>{
  dispose();const owned=factory();client=owned;
  const release=()=>{owned.terminate();if(client===owned)client=null;};
  return {ready:owned.ready,search:(...args)=>owned.search(...args),release,terminate:release};
 }};
};
