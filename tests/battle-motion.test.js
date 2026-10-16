import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleController} from '../src/services/engines/autochess-battle.ts';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('autochess prefetch waits for both pacing and presentation; pause drops pending move',async()=>{
 let run={color:'w',phase:'paused',results:[],battle:{id:'timing',initialFen:'4k3/7p/8/8/8/8/P7/4K3 w - - 0 1',moves:[],elapsed:0}},now=0,release;
 const timers=[],commits=[];let searches=0;
 const presentation=new Promise(resolve=>{release=resolve;});
 const c=createBattleController({getRun:()=>run,save:next=>{run=next;commits.push(now);return true;},onChange:()=>run.battle.moves.length===1?presentation:undefined,onError:error=>assert.fail(error),clock:()=>now,schedule:(fn,delay)=>{timers.push({fn,delay});return fn;},cancel:()=>{},engineFactory:()=>({ready:Promise.resolve(),search:async()=>{searches++;return searches===1?'a2a3':'h7h6';},terminate:()=>{}})});
 await c.start();await flush();assert.equal(searches,2);assert.equal(run.battle.moves.length,1);assert.equal(timers[0].delay,200);
 now=200;timers.shift().fn();await flush();assert.equal(run.battle.moves.length,1);
 now=260;release();await flush();assert.equal(run.battle.moves.length,2);assert.deepEqual(commits,[0,260]);
 c.pause();await flush();assert.equal(run.battle.moves.length,2);c.dispose();
});
// PvE animation phases, cancellation, en passant and reduced motion: tests/react/pve.test.tsx.
