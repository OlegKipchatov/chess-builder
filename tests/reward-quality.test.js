import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedScore,summarizeQuality,applyQualityReward,classifyDecision} from '../dist/reward-quality.js';
import {parseInfo} from '../dist/candidate-analysis.js';
import {initialState,migrateState} from '../dist/state.js';
import {analyzeReward} from '../dist/economy-analysis.js';
test('WDL expected score and mate share root-side perspective',()=>{
 assert.equal(expectedScore({wdl:[200,600,200]}),.5);
 assert.equal(expectedScore({wdl:[600,200,200]}),.7);
 assert.equal(expectedScore({scoreType:'mate',scoreValue:2}),1);
 assert.equal(expectedScore({scoreType:'mate',scoreValue:-2}),0);
 assert.throws(()=>expectedScore({wdl:[1,2,3]}));
 assert.deepEqual(parseInfo('info depth 12 score cp 42 wdl 300 600 100 pv e2e4').wdl,[300,600,100]);
 assert.equal(parseInfo('info depth 12 score cp 42 lowerbound wdl 300 600 100 pv e2e4'),null);
});
test('Quality is bounded, forced moves excluded and rounded breakdown sums exactly',()=>{
 for(let n=1;n<=80;n++)for(const loss of [0,.005,.025,.06,.15,.4,1]){
  const decisions=Array.from({length:n},()=>({loss})),q=summarizeQuality(decisions);
  assert.ok(q.total>=0&&q.total<=10);assert.equal(q.total,q.accuracy+q.stability+q.best);
  assert.deepEqual(summarizeQuality([...decisions,{forced:true}]),q);
 }
 assert.equal(summarizeQuality([{forced:true}]).total,0);
 assert.equal(classifyDecision(.15),'mistake');assert.equal(classifyDecision(.151),'blunder');
 assert.ok(summarizeQuality(Array(15).fill({loss:0})).total>summarizeQuality(Array(60).fill({loss:.15})).total);
});
test('Bonus persists across restart, pays only once, never recalculates legacy games',()=>{
 const entry={id:'one',pgn:'1. e4',rewardBreakdown:{rewardVersion:'game-economy-v2',qualityStatus:'pending',total:23}};
 const initial={...initialState(),coins:123,archive:[entry]};
 const saved=migrateState(initial),q=summarizeQuality([{loss:0}]);
 const paid=applyQualityReward(saved,'one',q);
 assert.equal(paid.coins,123+q.total);
 assert.equal(applyQualityReward(paid,'one',q),paid);
 assert.equal(applyQualityReward(migrateState(paid),'one',q).coins,paid.coins);
 const failed=applyQualityReward(saved,'one',{status:'unavailable'});
 assert.equal(failed.coins,128);assert.equal(failed.archive[0].rewardBreakdown.qualityStatus,'fallback');
 assert.equal(applyQualityReward(migrateState(failed),'one',q).coins,128);
 assert.equal(applyQualityReward({...initial,archive:[{id:'old',pgn:''}]},'old',q).coins,123);
});
test('Analysis uses actual player moves and restricted search from the same root, both colors',async()=>{
 for(const playerColor of ['w','b']){
  const calls=[];let terminated=false;
  const createClient=()=>{
   const client={terminate:()=>{terminated=true;},postMessage:data=>{
    calls.push(data);queueMicrotask(()=>client.onmessage({data:{id:data.id,evaluation:{move:data.searchMove||(playerColor==='w'?'d2d4':'e7e5'),wdl:data.searchMove?[200,600,200]:[400,400,200]}}}));
   }};return client;
  };
  const q=await analyzeReward({pgn:'1. e4 e5',playerColor},{createClient});
  assert.equal(q.eligibleMoves,1);assert.equal(terminated,true);
  if(playerColor==='w'){assert.equal(calls[1].searchMove,'e2e4');assert.equal(calls[0].fen,calls[1].fen);}else assert.equal(calls.length,1);
 }
});
test('Stockfish 19 computes actual WDL rewards for a short mate, both sides',{timeout:30000},async()=>{
 const {createStockfishClient}=await import('../dist/stockfish-client.js');
 const {spawnStockfish}=await import('../scripts/stockfish-process.mjs');
 for(const playerColor of ['w','b']){
  const quality=await analyzeReward({pgn:'1. f3 e5 2. g4 Qh4#',playerColor},{createClient:()=>createStockfishClient(()=>spawnStockfish(19))});
  assert.equal(quality.status,'complete');assert.equal(quality.eligibleMoves,2);
  assert.ok(quality.total>=0&&quality.total<=10);
 }
});
test('Reward retries failed searches with fresh clients, ignores stale replies, retains diagnostics',async()=>{
 let created=0,terminated=0;
 const quality=await analyzeReward({pgn:'1. e4',playerColor:'w'},{createClient:()=>{
  const attempt=++created,client={terminate:()=>terminated++,postMessage:request=>queueMicrotask(()=>{
   if(attempt===1){client.onerror(Error('Worker failed'));return;}
   client.onmessage({data:{id:request.id-1,evaluation:{move:'e2e4',wdl:[0,0,1000]}}});
   client.onmessage({data:{id:request.id,evaluation:{move:'e2e4',wdl:attempt===2?[1,2,3]:[300,400,300]}}});
  })};return client;
 }});
 assert.equal(created,3);assert.equal(terminated,3);assert.equal(quality.status,'complete');
 assert.equal(quality.diagnostics.length,2);assert.equal(quality.counts.best,1);
});
test('Reward failure stops after three attempts and old unavailable bonus is compensated only once',async()=>{
 let created=0;
 await assert.rejects(analyzeReward({pgn:'1. e4',playerColor:'w'},{createClient:()=>{
  created++;const client={terminate:()=>{},postMessage:()=>queueMicrotask(()=>client.onerror(Error('No engine')))};return client;
 }}),error=>error.diagnostics.length===3&&error.diagnostics[2].attempt===3);
 assert.equal(created,3);
 const initial={...initialState(),coins:100,archive:[{id:'old-failure',rewardBreakdown:{qualityStatus:'unavailable',quality:0,total:10}}]};
 const paid=applyQualityReward(initial,'old-failure',{status:'unavailable'});
 assert.equal(paid.coins,105);assert.equal(paid.archive[0].rewardBreakdown.total,15);
 assert.equal(applyQualityReward(paid,'old-failure',{status:'unavailable'}),paid);
});
test('Silent reward worker restarts the current search without losing completed moves',async()=>{
 let created=0,terminated=0;const progress=[],retries=[],requests=[];
 const quality=await analyzeReward({pgn:'1. e4 e5 2. Nf3',playerColor:'w'},{requestTimeoutMs:15,onProgress:(done,total)=>progress.push([done,total]),onRetry:event=>retries.push(event),createClient:()=>{
  const attempt=++created,client={terminate:()=>terminated++,postMessage:request=>{
   requests.push({attempt,fen:request.fen});
   const second=!request.fen.includes('PPPPPPPP');
   if(attempt===1&&second)return;
   queueMicrotask(()=>client.onmessage?.({data:{id:request.id,evaluation:{move:second?'g1f3':'e2e4',wdl:[300,400,300]}}}));
  }};return client;
 }});
 assert.equal(quality.status,'complete');assert.equal(created,2);assert.equal(terminated,2);
 assert.deepEqual(progress,[[1,2],[2,2]]);assert.deepEqual(retries,[{done:1,total:2,attempt:2}]);
 assert.equal(requests[1].fen,requests[2].fen);assert.equal(quality.diagnostics[0].message,'Economy request timeout');
});
test('Completely silent reward workers stop after a bounded number of restarts',async()=>{
 let terminated=0;
 await assert.rejects(analyzeReward({pgn:'1. e4',playerColor:'w'},{requestTimeoutMs:5,createClient:()=>({postMessage:()=>{},terminate:()=>terminated++})}),error=>error.diagnostics.length===3);
 assert.equal(terminated,3);
});
