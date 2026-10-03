import test from 'node:test';
import assert from 'node:assert/strict';
import {awardAutochess,autoSeriesCoins} from '../dist/autochess-rewards.js';
import {initialState,migrateState} from '../dist/state.js';
const runFor=(outcome,id='battle-1')=>({phase:'result',battle:{id,result:{winner:outcome==='draw'?null:outcome==='win'?'w':'b'}},results:[{battleId:id,outcome,reason:'test'}]});
test('series caps draws at five and total at thirty including partial last credit',()=>{
 let wallet=initialState();const results=[];
 for(const [i,outcome] of [...Array(12).fill('draw'),...Array(15).fill('win')].entries()){
  const run=runFor(outcome,'capped-'+i);results.push(run.results[0]);run.results=[...results];
  wallet=awardAutochess(wallet,run);assert.ok(wallet.coins<=130);
  assert.equal(awardAutochess(wallet,run),wallet);
 }
 assert.equal(autoSeriesCoins(wallet,{results}),30);assert.equal(wallet.coins,130);
 assert.equal(wallet.autochessAwards['capped-20'].coins,1);
 const restored=migrateState(JSON.parse(JSON.stringify(wallet)));assert.equal(restored.coins,130);
});
test('autochess pays 3/1/0 and persists each receipt through state migration',()=>{
 for(const [outcome,coins] of [['win',3],['draw',1],['loss',0]]){
  const wallet=initialState(),run=runFor(outcome),next=awardAutochess(wallet,run);
  assert.equal(next.coins,wallet.coins+coins);assert.equal(next.played,wallet.played);assert.deepEqual(next.rating,wallet.rating);assert.deepEqual(next.activity,wallet.activity);
  assert.equal(awardAutochess(next,run),next);
  const restored=migrateState(JSON.parse(JSON.stringify(next)));assert.equal(awardAutochess(restored,run),restored);
 }
});
test('paused, incomplete and technical runs do not receive rewards',()=>{
 const wallet=initialState();for(const phase of ['preparation','paused','failed'])assert.equal(awardAutochess(wallet,{...runFor('draw'),phase}),wallet);
 assert.equal(awardAutochess(wallet,{...runFor('draw'),battle:{id:'different',result:{}}}),wallet);
});
test('five wins pay fifteen total and summary is read-only',()=>{
 let wallet=initialState();const results=[];
 for(let i=0;i<5;i++){const run=runFor('win','battle-'+i);results.push(run.results[0]);wallet=awardAutochess(wallet,run);}
 assert.equal(wallet.coins,115);assert.equal(autoSeriesCoins(wallet,{results}),15);assert.equal(autoSeriesCoins(wallet,{results}),15);
});
