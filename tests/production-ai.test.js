import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {Chess} from '../dist/chess.js';
import {createBotClient,COGNITIVE_TIMEOUT_MS} from '../dist/bot-client.js';
import {createSession} from '../dist/cognitive-model.js';
import {initialState,migrateState,loadState,KEY} from '../dist/state.js';
import {createStartedGame} from '../dist/session.js';
import {validEngineProfile} from '../dist/strength.js';
import {exportPgn} from '../dist/pgn-export.js';
import {uciPosition,createStockfishClient} from '../dist/stockfish-client.js';
import {spawnStockfish} from '../scripts/stockfish-process.mjs';
import {normalizeScore} from '../dist/candidate-analysis.js';
const spawnCognitive = () => {
 const thread=new Worker(new URL('./helpers/cognitive-worker.mjs',import.meta.url));
 const worker={onmessage:null,onerror:null,postMessage:data=>thread.postMessage(data),terminate:()=>thread.terminate()};
 thread.on('message',data=>worker.onmessage?.({data}));thread.on('error',error=>worker.onerror?.(error));return worker;
};
const ask=(client,game,profile,id=1)=>new Promise((resolve,reject)=>{client.onmessage=({data})=>resolve(data);client.onerror=reject;client.postMessage({id,fen:game.fen(),pgn:game.pgn(),engineProfile:profile});});
test('Production: new games use seeded v2; all four names survive save and PGN',()=>{
 for(const style of ['aggressive','solid','positional','tricky']){
  const state=initialState();state.game=createStartedGame(state,()=>.4,{profile:style});
  assert.equal(state.game.engineProfile.id,'cognitive-v2');assert.equal(state.game.engineProfile.profile,style);
  assert.deepEqual(migrateState(state).game.engineProfile,state.game.engineProfile);
  const game=new Chess();game.move('e4');const pgn=exportPgn(game,state.game);
  assert.match(pgn,/BotModel "cognitive-v2"/);assert.match(pgn,/GachaChessVersion "0.3-v28"/);assert.ok(pgn.includes(`BotPlayStyle "${style}"`));
 }
});
test('Production: old running sessions migrate once, preserving position, progression, seed and style',()=>{
 const state=initialState(),game=new Chess();game.move('e4');state.game=createStartedGame(state,()=>.7);
 state.game.pgn=game.pgn();state.game.engineProfile={id:'humanized19-v1',targetElo:446,effectiveElo:460.48,seed:219237029,profile:'tricky'};
 state.game.rating={before:546,opponent:446,k:32};state.game.engineFailure={message:'Stockfish timeout',fen:game.fen()};
 const before=structuredClone(state),next=migrateState(state);
 assert.equal(next.game.engineProfile.id,'cognitive-v2');assert.equal(next.game.engineProfile.seed,219237029);assert.equal(next.game.engineProfile.targetElo,446);assert.equal(next.game.engineProfile.profile,'tricky');
 for(const key of ['pgn','rating','engineFailure','playerColor'])assert.deepEqual(next.game[key],before.game[key]);
 for(const key of ['rating','activity','archive','coins','shards','owned','played'])assert.deepEqual(next[key],before[key]);
 assert.deepEqual(migrateState(next),next);assert.deepEqual(state,before);
 const data=new Map([[KEY,JSON.stringify(state)]]),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 const loaded=loadState(storage);assert.deepEqual(loadState(storage),loaded);assert.equal(JSON.parse(data.get(KEY)).game.engineProfile.id,'cognitive-v2');
 delete state.game.engineProfile;assert.deepEqual(migrateState(state).game.engineProfile,migrateState(state).game.engineProfile);
});
test('Production: completed history retains old model metadata without enabling the old engine',()=>{
 const state=initialState(),old={id:'stockfish18-v1',skill:4,nodes:4000,milliseconds:1500};
 state.archive=[{id:'old',pgn:'1. e4 *',engineProfile:old}];state.game={...state.game,started:true,settled:true,engineProfile:old};
 const next=migrateState(state);assert.deepEqual(next.archive[0].engineProfile,old);assert.deepEqual(next.game.engineProfile,old);assert.equal(validEngineProfile(old),false);assert.throws(()=>createBotClient(old));
});
test('Production: mode is fixed by target, not session variance; low Elo never spawns WASM',()=>{
 let cognitive=0,native=0;
 const options={spawn:()=>{cognitive++;return {terminate:()=>{}};},native:()=>{native++;return {terminate:()=>{}};}};
 createBotClient({...createSession(1499,42),effectiveElo:1400},options).terminate();
 createBotClient({...createSession(1500,42),effectiveElo:1340},options).terminate();
 assert.equal(cognitive,1);assert.equal(native,1);
});
test('Production: hung cognitive worker is terminated; stale replies never apply',t=>{
 t.mock.timers.enable({apis:['setTimeout']});let terminated=0,called=0,error;
 const worker={postMessage:()=>{},terminate:()=>terminated++},profile=createSession(546,42),client=createBotClient(profile,{spawn:()=>worker});
 client.onmessage=()=>called++;client.onerror=e=>{error=e;};client.postMessage({id:4,fen:new Chess().fen(),engineProfile:profile});
 worker.onmessage({data:{id:3,move:{from:'e2',to:'e4'}}});assert.equal(called,0);
 t.mock.timers.tick(COGNITIVE_TIMEOUT_MS);assert.match(error.message,/timeout/);assert.equal(terminated,1);
 worker.onmessage({data:{id:4,move:{from:'e2',to:'e4'}}});assert.equal(called,0);
});
test('Production: illegal replies and mismatched PGN are surfaced as recoverable engine errors',()=>{
 for(const broken of ['illegal','mismatch']){
  let error=null,replies=0,terminated=false;
  const profile=createSession(546,42),worker={postMessage:()=>{},terminate:()=>{terminated=true;}},client=createBotClient(profile,{spawn:()=>worker});
  client.onerror=e=>{error=e;};client.onmessage=()=>replies++;
  client.postMessage({id:1,fen:new Chess().fen(),...(broken==='mismatch'?{pgn:'1. e4 *'}:{}),engineProfile:profile});
  worker.onmessage({data:{id:1,move:{from:'e2',to:broken==='illegal'?'e5':'e4'}}});
  assert.ok(error);assert.equal(replies,0);assert.equal(terminated,true);
 }
});
test('Production: explicit cancellation ignores callbacks and clears the watchdog',t=>{
 t.mock.timers.enable({apis:['setTimeout']});let called=0;
 const profile=createSession(546,42),worker={postMessage:()=>{},terminate:()=>{}},client=createBotClient(profile,{spawn:()=>worker});
 client.onerror=()=>called++;client.onmessage=()=>called++;client.postMessage({id:1,fen:new Chess().fen(),engineProfile:profile});client.terminate();
 worker.onmessage({data:{id:1,move:{from:'e2',to:'e4'}}});worker.onerror(Error('late'));t.mock.timers.tick(COGNITIVE_TIMEOUT_MS);assert.equal(called,0);
});
test('Production: real v2 Worker calculates reported PGN and sequential moves without WASM',{timeout:60000},async()=>{
 const profile=createSession(546,219237029,'tricky'),client=createBotClient(profile,{spawn:spawnCognitive}),game=new Chess();
 try{
  const moves=['g4','e5','g5','f6','b3','fxg5'];
  for(const san of moves){assert.ok(new Chess(game.fen()).move((await ask(client,game,profile)).move));game.move(san);}
  const first=await ask(client,game,profile),second=await ask(client,game,profile);assert.deepEqual(first.move,second.move);
  for(let i=0;i<24&&!game.isGameOver();i++)assert.ok(game.move((await ask(client,game,profile,i+2)).move));
  const check=new Chess('6k1/5ppp/8/8/8/8/7P/5r1K w - - 0 1');assert.ok(check.move((await ask(client,check,profile,99)).move));
 }finally{client.terminate();}
});
test('Production: native SF19 plays both colors and offline reference analysis remains separate',{timeout:30000},async()=>{
 const profile=createSession(1500,42),client=createBotClient(profile,{native:()=>createStockfishClient(()=>spawnStockfish(19))}),game=new Chess();
 try{
  for(let ply=0;ply<4;ply++)assert.ok(game.move((await ask(client,game,profile,ply)).move));
  const data=await new Promise((resolve,reject)=>{client.onmessage=({data})=>resolve(data);client.onerror=reject;client.postMessage({id:99,fen:new Chess().fen(),analysisOnly:true,analysis:{multiPv:8,depth:5,nodes:20000,milliseconds:500}});});
  assert.equal(data.analysis.candidates.length,8);assert.ok(data.analysis.candidates.every(c=>Number.isFinite(c.evaluationLoss)));
 }finally{client.terminate();}
});
test('Production: reference score orientation, mates, UCI repetition and mismatch checks',()=>{
 for(const side of ['w','b']){assert.equal(normalizeScore('cp',50,side,side),.5);assert.equal(normalizeScore('cp',-50,side,side),-.5);assert.ok(normalizeScore('mate',2,side,side)>900);assert.ok(normalizeScore('mate',-2,side,side)<-900);}
 assert.equal(normalizeScore('cp',50,'w','b'),-.5);
 const game=new Chess();for(const move of ['Nf3','Nf6','Ng1','Ng8'])game.move(move);
 assert.match(uciPosition({fen:game.fen(),pgn:game.pgn()}).command,/moves g1f3 g8f6 f3g1 f6g8$/);assert.throws(()=>uciPosition({fen:new Chess().fen(),pgn:game.pgn()}));
});
