import {AUTO} from './autochess.js?v=92';
// One sequential worker per active battle; no rating or difficulty model.
export const createAutoplayEngine = (spawn=()=>new Worker('./stockfish19-worker.js?v=92',{type:'module'})) => {
 const worker=spawn();let pending=null,dead=false,readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 const send=command=>worker.postMessage(command);
 let watchdog;
 const fail=error=>{if(dead)return;dead=true;clearTimeout(watchdog);worker.terminate();readyReject(error);pending?.reject(error);pending=null;};
 watchdog=setTimeout(()=>fail(Error('Не удалось подготовить движок')),20000);
 worker.onerror=event=>fail(Error(event.message||'Движок остановился'));
 worker.onmessage=event=>{
  if(dead)return;
  for(const line of String(event.data).split('\n')){
   if(line.trim()==='uciok'){
    ['setoption name Threads value 1','setoption name Hash value 16','setoption name Skill Level value 20','setoption name UCI_LimitStrength value false','setoption name MultiPV value 1','ucinewgame','isready'].forEach(send);
   }else if(line.trim()==='readyok'){clearTimeout(watchdog);readyResolve();}
   else if(line.startsWith('bestmove ')&&pending){
    const request=pending;pending=null;clearTimeout(watchdog);
    const token=line.split(/\s+/)[1];
    if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token))request.reject(Error('Движок не вернул ход'));else request.resolve(token);
   }
  }
 };
 send('uci');
 return {ready,search:(initialFen,moves)=>{
  if(dead||pending)return Promise.reject(Error('Движок недоступен'));
  return new Promise((resolve,reject)=>{
   pending={resolve,reject};watchdog=setTimeout(()=>fail(Error('Движок не ответил')),4000);
   send(`position fen ${initialFen}${moves.length?' moves '+moves.join(' '):''}`);send(`go movetime ${AUTO.movetime}`);
  });
 },terminate:()=>fail(Object.assign(Error('Бой приостановлен'),{name:'AbortError'}))};
};
