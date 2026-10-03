import {AUTO,battleGame,battleResult,completeBattle} from './autochess.js?v=96';
import {createAutoplayEngine} from './autochess-engine.js?v=96';
export const createBattleController = ({getRun,save,onChange,onError,engineFactory=createAutoplayEngine,clock=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}) => {
 let position=null,engine=null,generation=0,active=false,base=0,started=0,deadline=null,next=null;
 const elapsed=()=>Math.min(AUTO.duration,base+(active?Math.max(0,clock()-started):0));
 const halt=(retain=false)=>{active=false;generation++;cancel(deadline);cancel(next);if(retain&&engine?.release)engine.release();else engine?.terminate();engine=null;position=null;};
 const commit=run=>{if(!save(run))throw Error('Не удалось сохранить бой. Освободите место и повторите.');onChange();};
 const fail=error=>{const spent=active?elapsed():getRun().battle.elapsed;halt();const run=getRun();if(run?.battle&&run.phase!=='result')save({...run,phase:'paused',battle:{...run.battle,elapsed:spent}});onChange();onError(/out of memory|memory access|allocation/i.test(error.message)?'Не хватает памяти для движка. Бой сохранён. Закройте другие вкладки и продолжите.':error.message);};
 const finish=result=>{
  const run=getRun(),spent=elapsed();halt(true);
  try{commit(completeBattle({...run,battle:{...run.battle,elapsed:spent}},result));}catch(error){onError(error.message);}
 };
 const step=async token=>{
  if(!active||token!==generation)return;
  if(elapsed()>=AUTO.duration){finish({winner:null,reason:'Время боя закончилось'});return;}
  const requestStarted=clock(),run=getRun();
  try{
   const move=await engine.search(run.battle.initialFen,run.battle.moves);
   if(!active||token!==generation)return;
   const spent=elapsed();if(spent>=AUTO.duration){finish({winner:null,reason:'Время боя закончилось'});return;}
   const game=position;game.move({from:move.slice(0,2),to:move.slice(2,4),...(move[4]?{promotion:move[4]}:{})});
   const updated={...run,battle:{...run.battle,moves:[...run.battle.moves,move],elapsed:spent}};
   const result=battleResult(game,updated.battle.moves.length,spent);
   if(result){halt(true);commit(completeBattle(updated,result));return;}
   commit(updated);next=schedule(()=>void step(token),Math.max(0,AUTO.pace-(clock()-requestStarted)));
  }catch(error){if(token===generation)fail(error);}
 };
 return {
  elapsed,isActive:()=>active,
  start:async()=>{
   if(engine||active)return;
   const run=getRun();if(!run?.battle||run.phase==='result')return;
   const token=++generation;
   try{
    position=battleGame(run);base=run.battle.elapsed;
    const initialResult=battleResult(position,run.battle.moves.length,base);
    if(initialResult){finish(initialResult);return;}
    engine=engineFactory();onChange();
    await engine.ready;if(token!==generation)return;
    started=clock();active=true;
    const result=battleResult(position,run.battle.moves.length,base);
    if(result){finish(result);return;}
    deadline=schedule(()=>{if(token===generation)finish({winner:null,reason:'Время боя закончилось'});},AUTO.duration-base);
    onChange();void step(token);
   }catch(error){if(token===generation)fail(error);}
  },
  pause:()=>{
   if(!engine)return true;
   const run=getRun(),spent=active?elapsed():run.battle.elapsed;halt();
   try{commit({...run,phase:'paused',battle:{...run.battle,elapsed:spent}});return true;}catch(error){onError(error.message);return false;}
  },
  dispose:()=>halt(),isPreparing:()=>!!engine&&!active,
 };
};
