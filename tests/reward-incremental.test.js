import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { analyzeReward } from '../src/services/engines/economy-analysis.ts';
import { initialState, migrateState } from '../src/services/persistence/state.ts';
import { completedMatch } from '../src/domain/chess/archive.ts';
import { applyQualityReward } from '../src/domain/economy/reward-quality.ts';
import { matchingRewardCheckpoint, restoreRewardCheckpoint } from '../src/domain/economy/reward-checkpoint.ts';

const engine = (requests) => () => {
  const client = {
    terminate: () => {},
    postMessage: (request) => {
      requests.push(request);
      const board = new Chess(request.fen);
      const move = board.moves({verbose:true})[0];
      queueMicrotask(() => client.onmessage?.({data:{id:request.id,evaluation:{
        move:request.searchMove || move.from+move.to+(move.promotion||''),
        wdl:request.searchMove ? [200,600,200] : [400,400,200],
      }}}));
    },
  };
  return client;
};

test('incremental reward matches full analysis for both sides and searches only missing moves', async () => {
  for (const playerColor of ['w','b']) {
    let checkpoint;
    const calls=[];
    await analyzeReward({pgn:'1. e4 e5',playerColor},{createClient:engine(calls),onCheckpoint:(value)=>{checkpoint=value;}});
    const oldCalls=calls.length;
    const entry={pgn:'1. e4 e5 2. Nf3 Nc6',playerColor,rewardCheckpoint:JSON.parse(JSON.stringify(checkpoint))};
    const resumed=await analyzeReward(entry,{createClient:engine(calls),onCheckpoint:(value)=>{checkpoint=value;}});
    const fullCalls=[];
    const full=await analyzeReward({...entry,rewardCheckpoint:undefined},{createClient:engine(fullCalls)});
    assert.deepEqual(resumed,full);
    assert.equal(calls.length,fullCalls.length);
    assert.ok(calls.length>oldCalls);
    const cached=await analyzeReward({...entry,rewardCheckpoint:checkpoint},{createClient:()=>{throw Error('Must not start worker');}});
    assert.deepEqual(cached,full);
  }
});

test('interruption retains completed decisions; late search results cannot complete a cancelled job',async()=>{
  let checkpoint,late,terminated=0;
  const controller=new AbortController();
  await assert.rejects(analyzeReward({pgn:'1. e4 e5 2. Nf3',playerColor:'w'}, {
    signal:controller.signal,
    onCheckpoint:(value)=>{checkpoint=value;},
    createClient:()=>{
      const client={terminate:()=>terminated++,postMessage:(request)=>{
        if(request.fen===new Chess().fen()) queueMicrotask(()=>client.onmessage?.({data:{id:request.id,evaluation:{move:'e2e4',wdl:[300,400,300]}}}));
        else {late=client.onmessage;controller.abort();}
      }};
      return client;
    },
  }),{name:'AbortError'});
  assert.equal(checkpoint.decisions.length,1);
  assert.ok(terminated>0);
  late({data:{id:2,evaluation:{move:'g1f3',wdl:[300,400,300]}}});
  assert.equal(checkpoint.decisions.length,1);
  const calls=[];
  await analyzeReward({pgn:'1. e4 e5 2. Nf3',playerColor:'w',rewardCheckpoint:checkpoint},{createClient:engine(calls)});
  assert.ok(calls.every((request)=>request.fen!==new Chess().fen()));
});

test('checkpoints survive reload and settlement, are fenced by history, color and profile, then removed after payment',async()=>{
  let checkpoint;
  await analyzeReward({pgn:'1. f3 e5',playerColor:'w'},{createClient:engine([]),onCheckpoint:(value)=>{checkpoint=value;}});
  const state=initialState();
  state.game={...state.game,started:true,pgn:'1. f3 e5 2. g4 Qh4#',rewardCheckpoint:checkpoint};
  const restored=migrateState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.game.rewardCheckpoint,checkpoint);
  const board=new Chess();board.loadPgn(restored.game.pgn);
  const completed=completedMatch(restored,board,{id:'finished',finishedAt:new Date().toISOString()});
  const archived=migrateState(completed.state);
  assert.deepEqual(archived.archive[0].rewardCheckpoint,checkpoint);
  const calls=[];
  const quality=await analyzeReward(archived.archive[0],{createClient:engine(calls)});
  const paid=applyQualityReward(archived,'finished',quality);
  assert.equal(paid.coins,archived.coins+quality.total);
  assert.equal(paid.archive[0].rewardCheckpoint,undefined);
  assert.equal(applyQualityReward(paid,'finished',quality),paid);
  const history=board.history({verbose:true});
  assert.ok(matchingRewardCheckpoint(checkpoint,history,'w'));
  assert.equal(matchingRewardCheckpoint(checkpoint,history,'b'),undefined);
  assert.equal(matchingRewardCheckpoint({...checkpoint,moves:['e2e4']},history,'w'),undefined);
  assert.equal(matchingRewardCheckpoint({...checkpoint,initialFen:'other'},history,'w'),undefined);
  assert.equal(restoreRewardCheckpoint({...checkpoint,profile:'old'}),undefined);
  assert.equal(restoreRewardCheckpoint({...checkpoint,decisions:[{loss:NaN}]}),undefined);
});

test('real Stockfish gives the same reward when analysis is split across turns', {timeout:30000}, async()=>{
  const {createStockfishClient}=await import('../src/services/engines/stockfish-client.ts');
  const {spawnStockfish}=await import('../scripts/stockfish-process.mjs');
  const createClient=()=>createStockfishClient(()=>spawnStockfish(19));
  for(const playerColor of ['w','b']){
    let rewardCheckpoint;
    await analyzeReward({pgn:'1. f3 e5',playerColor},{createClient,onCheckpoint:(value)=>{rewardCheckpoint=value;}});
    const entry={pgn:'1. f3 e5 2. g4 Qh4#',playerColor};
    const resumed=await analyzeReward({...entry,rewardCheckpoint},{createClient});
    const full=await analyzeReward(entry,{createClient});
    assert.deepEqual(resumed,full);
  }
});
