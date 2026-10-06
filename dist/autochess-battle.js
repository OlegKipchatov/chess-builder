import {AUTO,positionCompositionError,battleGame,battleResult,completeBattle} from './autochess.js?v=111';
import {createAutoplayEngine} from './autochess-engine.js?v=111';
export const createBattleController = ({getRun,save,onChange,onError,engineFactory=createAutoplayEngine,clock=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}) => {
 let position=null,engine=null,generation=0,active=false,base=0,started=0,next=null,preparing=false,attempt=1;
 const elapsed=()=>base+(active?Math.max(0,clock()-started):0);
 const halt=()=>{active=false;preparing=false;generation++;cancel(next);next=null;engine?.terminate();engine=null;position=null;};
 const commit=run=>{if(!save(run))throw Error('Не удалось сохранить бой. Освободите место и повторите.');onChange();};
 const fail=error=>{const spent=active?elapsed():getRun().battle.elapsed;halt();const run=getRun();if(run?.battle&&run.phase!=='result')save({...run,phase:'paused',battle:{...run.battle,elapsed:spent}});onChange();onError(/out of memory|memory access|allocation/i.test(error.message)?'Не хватает памяти для движка после 3 попыток. Бой сохранён. Закройте другие вкладки и продолжите.':error.message);};
 const finish=result=>{
  const run=getRun(),spent=elapsed();halt();
  try{commit(completeBattle({...run,battle:{...run.battle,elapsed:spent}},result));}catch(error){onError(error.message);}
 };
 const current=token=>token===generation;
 const recover=(error,token)=>{
  engine?.terminate();engine=null;
  if(!current(token))throw Object.assign(Error('Бой приостановлен'),{name:'AbortError'});
  if(error.name==='AbortError'||error.code==='UNSUPPORTED_POSITION')throw error;
  if(attempt>=3)throw Error(`Не удалось запустить расчёт после 3 попыток. Бой сохранён. ${error.message}`);
  attempt++;preparing=true;onChange();
 };
 const prepare=async token=>{
  while(current(token)&&!engine){
   try{
    preparing=true;engine=engineFactory();onChange();
    await engine.ready;
    if(!current(token))throw Object.assign(Error('Бой приостановлен'),{name:'AbortError'});
    preparing=false;onChange();
   }catch(error){if(!current(token))throw error;recover(error,token);}
  }
 };
 const search=async(run,token)=>{
  while(current(token)){
   await prepare(token);
   if(!current(token))throw Object.assign(Error('Бой приостановлен'),{name:'AbortError'});
   try{return await engine.search(run.battle.initialFen,[...run.battle.moves]);}
   catch(error){if(!current(token))throw error;recover(error,token);}
  }
  throw Object.assign(Error('Бой приостановлен'),{name:'AbortError'});
 };
 const step=async token=>{
  if(!active||token!==generation)return;
  const requestStarted=clock(),run=getRun();
  try{
   const move=await search(run,token);
   if(!active||token!==generation)return;
   attempt=1;
   const spent=elapsed();
   const game=position;game.move({from:move.slice(0,2),to:move.slice(2,4),...(move[4]?{promotion:move[4]}:{})});
   const updated={...run,battle:{...run.battle,moves:[...run.battle.moves,move],elapsed:spent}};
   const result=battleResult(game,updated.battle.moves.length,spent);
   if(result){halt();commit(completeBattle(updated,result));return;}
   commit(updated);next=schedule(()=>void step(token),Math.max(0,AUTO.pace-(clock()-requestStarted)));
  }catch(error){if(token===generation)fail(error);}
 };
 return {
  elapsed,isActive:()=>active,
  start:async()=>{
   if(engine||active||preparing)return;
   const run=getRun();if(!run?.battle||run.phase==='result')return;
   const token=++generation;attempt=1;
   try{
    const issue=positionCompositionError(run.battle.initialFen);if(issue)throw Error(issue);
    position=battleGame(run);base=run.battle.elapsed;
    const initialResult=battleResult(position,run.battle.moves.length,base);
    if(initialResult){finish(initialResult);return;}
    await prepare(token);if(token!==generation)return;
    started=clock();active=true;
    const result=battleResult(position,run.battle.moves.length,base);
    if(result){finish(result);return;}
    onChange();void step(token);
   }catch(error){if(token===generation)fail(error);}
  },
  pause:()=>{
   if(!engine&&!active&&!preparing)return true;
   const run=getRun(),spent=active?elapsed():run.battle.elapsed;halt();
   try{commit({...run,phase:'paused',battle:{...run.battle,elapsed:spent}});return true;}catch(error){onError(error.message);return false;}
  },
  dispose:()=>halt(),isPreparing:()=>preparing,retryAttempt:()=>attempt,
 };
};
