import test from 'node:test';
import assert from 'node:assert/strict';
import {huntConfig,materialValues,createHunt,startHunt,canMove,playerMoves,opponentCaptures,placePiece,resolvePlayerMove,releaseHuntInput,skipExpiredSpawn,tickHunt,remainingTime,recoverLife,finishHunt,calculateMiniGameCoins,awardHunt,huntBoardAdapter} from '../dist/hunt.js';
import {initialState,migrateState} from '../dist/state.js';
const piece=(type,color='w')=>({type,color});
const run=(pieces,extra={})=>({...startHunt(createHunt({mode:'endless',runId:'test',runSeed:42}),100),pieces,...extra});
const resolve=(state,from,to,options={})=>resolvePlayerMove(state,{from,to},{now:101,...options});

test('Movement: knight, sliders, blocking, friendly squares, no kings',()=>{
  for(const [type,target,invalid] of [['n','b3','b2'],['b','d4','a4'],['r','a4','b2'],['q','d4','b3']]){
    const pieces={a1:piece(type)};assert.ok(canMove(pieces,'a1',target),type);assert.equal(canMove(pieces,'a1',invalid),false,type);
    pieces[target]=piece('n');assert.equal(canMove(pieces,'a1',target),false);
  }
  assert.equal(canMove({a1:piece('q'),b2:piece('p','b')},'a1','c3'),false);
  assert.equal(canMove({a1:piece('r'),a2:piece('n')},'a1','a3'),false);
  assert.ok(canMove({a1:piece('n'),b2:piece('q')},'a1','c2'));
  assert.ok(canMove({a1:piece('b'),d4:piece('p','b')},'a1','d4'));
});
test('Black pawn captures toward decreasing rank only',()=>{
  const pieces={d4:piece('p','b'),c3:piece('q'),e3:piece('n'),c5:piece('r')};
  assert.ok(canMove(pieces,'d4','c3'));assert.ok(canMove(pieces,'d4','e3'));
  assert.equal(canMove(pieces,'d4','c5'),false);assert.equal(canMove(pieces,'d4','d3'),true);
  assert.equal(canMove({...pieces,d3:piece('n')},'d4','d3'),false);
});
test('Initial positions across seeds are safe, reproducible and have two pieces per side',()=>{
  for(let seed=0;seed<300;seed++){
    const input={mode:'timed',runId:'same',runSeed:seed},state=createHunt(input);
    assert.deepEqual(state,createHunt(input));
    for(const color of ['w','b'])assert.equal(Object.values(state.pieces).filter(p=>p.color===color).length,2);
    assert.ok(Object.values(state.pieces).every(p=>p.type!=='k'&&(p.color!=='w'||p.type!=='p')));
    assert.equal(opponentCaptures(state.pieces).length,0);assert.ok(playerMoves(state).length);
  }
});
test('Placement uses bounded fallback even with zero permitted attempts',()=>{
  const state=createHunt({mode:'endless',runId:'fallback',runSeed:1},{...huntConfig,placementAttemptLimit:0});
  assert.deepEqual(Object.keys(state.pieces),['b1','g1','a7','h7']);assert.equal(opponentCaptures(state.pieces).length,0);
});
test('Opponent responds once, highest material first and stable tie ordering',()=>{
  const state=run({a1:piece('r','b'),a3:piece('q'),h1:piece('r','b'),h3:piece('n'),d4:piece('b')});
  assert.deepEqual(opponentCaptures(state.pieces)[0],{from:'a1',to:'a3'});
  const result=resolve(state,'d4','e5');
  assert.equal(result.events.filter(e=>e.type==='opponentCaptured').length,1);
  assert.equal(result.state.lives,4);assert.equal(result.events.find(e=>e.type==='opponentCaptured').captured,'q');
  assert.deepEqual(opponentCaptures({...state.pieces,h3:piece('q')})[0],{from:'a1',to:'a3'});
});
test('Opponent makes one ordinary reply when no capture exists, without life or score penalties',()=>{
  const state=run({b1:piece('n'),g1:piece('n'),a7:piece('p','b'),h7:piece('p','b')});
  const result=resolve(state,'b1','c3'),replies=result.events.filter(e=>e.type.startsWith('opponent'));
  assert.equal(replies.length,1);assert.equal(replies[0].type,'opponentMoved');
  assert.ok(canMove(result.events[0].pieces,replies[0].from,replies[0].to));
  assert.equal(result.state.lives,5);assert.equal(result.state.score,0);
  assert.deepEqual(result,resolve(state,'b1','c3'));
});
test('Black pawn promotes on the last rank, including a non-capturing reply',()=>{
  const result=resolve(run({h8:piece('n'),a2:piece('p','b')}),'h8','f7');
  assert.equal(result.state.pieces.a1.type,'q');assert.equal(result.state.pieces.a1.color,'b');
  assert.equal(result.events[1].type,'opponentMoved');
});
test('Non-capturing moves have no direct penalty; spawn follows moves 2 and 4',()=>{
  let state=run({b1:piece('n'),g1:piece('n'),a7:piece('p','b'),h7:piece('p','b')});
  for(let turn=1;turn<=4;turn++){
    const result=resolve(state,turn%2?'b1':'c3',turn%2?'c3':'b1');
    assert.equal(result.events.filter(e=>e.type==='opponentSpawned').length,turn%2===0?1:0);
    assert.equal(result.state.playerMoveCount,turn);assert.equal(result.state.score,0);assert.equal(result.state.lives,5);
    assert.equal(resolve(result.state,'g1','f3').state,result.state,'resolving ignores repeated input');
    state=releaseHuntInput(result.state,101);
  }
});
test('Player capture precedes opponent capture, respawn and scheduled spawning',()=>{
  const state=run({a1:piece('r'),h2:piece('q'),a3:piece('p','b'),h8:piece('r','b')},{playerMoveCount:1});
  const result=resolve(state,'a1','a3');
  assert.deepEqual(result.events.map(e=>e.type),['playerMoved','opponentCaptured','playerRespawned','opponentSpawned']);
  assert.equal(result.state.score,1);assert.equal(result.state.capturedMaterial,1);
  assert.equal(result.state.lives,4);
  assert.equal(result.events.at(-1).type,'opponentSpawned','new spawn has no capture event this cycle');
});
test('Timed replacement contains no pawn and keeps exactly two player pieces',()=>{
  const state=run({a1:piece('r'),h2:piece('q'),a3:piece('p','b'),h8:piece('r','b')},{mode:'timed',targetEndAtMs:1000});
  const result=resolve(state,'a1','a3').state;
  const players=Object.values(result.pieces).filter(p=>p.color==='w');assert.equal(players.length,2);assert.ok(players.every(p=>p.type!=='p'));
});
test('Timer starts at interactivity, remains wall-clock based, and rejects late moves',()=>{
  const idle=createHunt({mode:'timed',runId:'timer',runSeed:1});assert.equal(idle.targetEndAtMs,undefined);
  const state=startHunt(idle,1000);assert.equal(state.targetEndAtMs,61000);assert.equal(remainingTime(state,31000),30000);
  assert.equal(tickHunt(state,70000).finishReason,'timer');
  const late=resolvePlayerMove(state,playerMoves(state)[0],{now:61000});assert.equal(late.state.playerMoveCount,0);assert.equal(late.state.finishReason,'timer');
});
test('Accepted move finishes through expiration, response retained but spawn skipped',()=>{
  const state=run({a1:piece('r'),h2:piece('q'),a3:piece('p','b'),h8:piece('r','b')},{mode:'timed',targetEndAtMs:102,playerMoveCount:1});
  const result=resolve(state,'a1','a3',{clock:()=>103});assert.equal(result.state.score,1);assert.equal(result.state.finishReason,'timer');
  assert.equal(result.events.some(e=>e.type==='opponentCaptured'),true);assert.equal(result.events.some(e=>e.type==='opponentSpawned'),false);
});
test('Endless final life stops replacement and spawning, increments move count once',()=>{
  const result=resolve(run({a1:piece('n'),h2:piece('q'),h8:piece('r','b')},{lives:1,playerMoveCount:1}),'a1','b3');
  assert.equal(result.state.finishReason,'lives');assert.equal(result.state.lives,0);assert.equal(result.state.playerMoveCount,2);
  assert.deepEqual(result.events.map(e=>e.type),['playerMoved','opponentCaptured']);
});
test('Expiration during presentation drops only the pending spawn, preserving accepted move',()=>{
  const state=run({b1:piece('n'),g1:piece('n'),a7:piece('p','b'),h7:piece('p','b')},{mode:'timed',targetEndAtMs:102,playerMoveCount:1});
  const result=resolve(state,'b1','c3'),event=result.events.find(e=>e.type==='opponentSpawned');assert.ok(event);
  assert.equal(skipExpiredSpawn(result.state,event,101),result.state);
  const expired=skipExpiredSpawn(result.state,event,103);assert.equal(expired.finishReason,'timer');assert.equal(expired.pieces[event.square],undefined);assert.equal(expired.pieces.c3.type,'n');assert.equal(expired.playerMoveCount,2);
});
test('Extra lives start at five, preserve overflow without a cap and use material not score',()=>{
  assert.deepEqual([recoverLife({lives:1,lifeRecoveryMaterial:18},9).lives,recoverLife({lives:1,lifeRecoveryMaterial:18},9).lifeRecoveryMaterial],[2,7]);
  assert.equal(createHunt({mode:'endless',runId:'five',runSeed:1}).lives,5);
  assert.deepEqual(recoverLife({lives:5,lifeRecoveryMaterial:18},9),{lives:6,lifeRecoveryMaterial:7});
  assert.deepEqual(recoverLife({lives:8,lifeRecoveryMaterial:19},60),{lives:11,lifeRecoveryMaterial:19});
  assert.deepEqual(recoverLife({lives:5,lifeRecoveryMaterial:19},1),{lives:6,lifeRecoveryMaterial:0});
  const state=run({a1:piece('r'),a3:piece('q','b')},{lives:1,lifeRecoveryMaterial:18,score:999,capturedMaterial:18});
  const result=resolve(state,'a1','a3').state;assert.equal(result.score,27);assert.equal(result.lives,2);assert.equal(result.lifeRecoveryMaterial,7);
});
test('Full board skips opponent spawn; unsafe replacement has deterministic empty fallback',()=>{
  const full=Object.fromEntries(Array.from({length:64},(_,i)=>['abcdefgh'[i%8]+(1+Math.floor(i/8)),piece('q','b')]));
  const state=run(full);assert.equal(placePiece(state,'b'),null);assert.equal(placePiece(state,'w'),null);
  delete state.pieces.d4;assert.equal(placePiece(state,'w').square,'d4');assert.equal(Object.keys(state.pieces).length,64);
  const pawn=run(Object.fromEntries(Object.entries(full).filter(([s])=>s!=='a1')));
  assert.equal(placePiece(pawn,'b',{...huntConfig,opponentWeights:{p:1}}),null);
});
test('No-space replacement is a completed terminal state',()=>{
  // The capturing enemy vacates a square, so a full board cannot normally occur
  // after a capture. The terminal reason is nevertheless safe to settle.
  const state=finishHunt(run({}),'no-space',200);
  const wallet=awardHunt(initialState(),{...state,score:25});assert.equal(wallet.coins,105);
});
test('Same seed and command sequence reproduce generated pieces and events',()=>{
  let a=startHunt(createHunt({mode:'endless',runId:'same',runSeed:72}),0),b=structuredClone(a);
  for(let i=0;i<30&&a.phase!=='finished';i++){
    const move=playerMoves(a)[0];if(!move)break;
    const x=resolvePlayerMove(a,move,{now:i}),y=resolvePlayerMove(b,move,{now:i});assert.deepEqual(x,y);
    a=releaseHuntInput(x.state,i);b=releaseHuntInput(y.state,i);
  }
});
test('Reward is finite, nonnegative and sublinear at all supported scores',()=>{
  assert.deepEqual(materialValues,{p:1,n:3,b:3,r:5,q:9});
  for(const [score,coins] of [[0,0],[1,1],[10,3],[25,5],[50,7],[100,11],[200,15],[400,22],[800,31]])assert.equal(calculateMiniGameCoins({score}),coins);
  for(const score of [Number.MAX_VALUE,Number.MAX_SAFE_INTEGER,NaN,Infinity,-5]){const coins=calculateMiniGameCoins({score});assert.ok(Number.isSafeInteger(coins)&&coins>=0);}
});
test('Wallet, award ledger and separate records survive reload and prevent duplicate payout',()=>{
  const state={...finishHunt(run({}),'lives',200),score:50};
  let wallet=awardHunt(initialState(),state);assert.equal(wallet.coins,107);assert.equal(wallet.hunt.records.endless.bestScore,50);assert.equal(wallet.hunt.records.timed.bestScore,0);
  wallet=migrateState(JSON.parse(JSON.stringify(wallet)));assert.equal(awardHunt(wallet,state),wallet);
  wallet=awardHunt(wallet,{...state,mode:'timed',runId:'timed',score:100});assert.equal(wallet.coins,118);assert.equal(wallet.hunt.records.timed.bestScore,100);assert.equal(wallet.hunt.records.endless.bestScore,50);
  assert.equal(awardHunt(wallet,{...state,runId:'abandon',finishReason:'abandoned',score:10000}),wallet);
});
test('Existing board adapter renders 64 cells with legal Hunt moves without kings',()=>{
  const state=run({b1:piece('n')}),adapter=huntBoardAdapter(state);
  assert.equal(adapter.board().flat().length,64);assert.equal(adapter.isCheck(),false);assert.ok(adapter.moves({square:'b1'}).some(move=>move.to==='c3'));
});
