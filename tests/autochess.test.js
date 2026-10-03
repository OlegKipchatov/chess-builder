import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {AUTO,reservePieces,purchaseError,armyCapacity,PRICES,planOpponent,advanceOpponent,arrangeOpponent,placementSquares,opponentFor,createAutoRun as createModernRun,buyRandomPiece,upgradeShop,purchasePrice,levelPrice,shopOdds,salePrice,roundIncome,buyPiece,sellPiece,placePiece,setupError,setupFen,beginBattle,battleGame,battleResult,completeBattle,nextRound,restoreAutoRun,seriesFinished} from '../dist/autochess.js';
import {createBattleController} from '../dist/autochess-battle.js';
import {createAutoplayEngine} from '../dist/autochess-engine.js';
import {benchPiece} from '../dist/autochess.js';
test('army capacity grows from eight to sixteen with the shop level',()=>{
 assert.deepEqual(Array.from({length:10},(_,i)=>armyCapacity({version:4,level:i+1})),[8,9,10,11,12,13,14,15,16,16]);
 assert.equal(armyCapacity({version:3,level:10}),8);
 let run=createModernRun('capacity');run.round=21;
 run.results=Array.from({length:20},(_,i)=>({outcome:'draw',shopLevel:1,battleId:run.id+':'+(i+1)}));
 run.purchases=7;run.nextId=8;run.reserve=35;
 run.army.push(...Array.from({length:7},(_,i)=>({id:'piece-'+(i+1),type:'p',paid:i+1,square:placementSquares('p',run.color)[i]})));
 assert.deepEqual(restoreAutoRun(JSON.stringify(run)),run);
 assert.equal(buyRandomPiece(run),run);
 run=upgradeShop(run);assert.equal(armyCapacity(run),9);
 run=buyRandomPiece(run);assert.equal(run.army.length,9);assert.equal(run.reserve,24);
 assert.deepEqual(restoreAutoRun(JSON.stringify(run)),run);
 assert.equal(buyRandomPiece(run),run);
 assert.throws(()=>restoreAutoRun(JSON.stringify({...run,level:1})),/армия/);
});
test('sixteen owned pieces survive saving, placement and the level-ten cap',()=>{
 const run=createModernRun('sixteen');run.level=10;run.round=51;run.purchases=15;run.nextId=16;run.reserve=384;
 run.results=Array.from({length:50},(_,i)=>({outcome:'draw',shopLevel:10,battleId:run.id+':'+(i+1)}));
 run.army.push(...Array.from({length:15},(_,i)=>({id:'piece-'+(i+1),type:'p',paid:i+1,square:placementSquares('p',run.color)[i]})));
 assert.equal(run.army.length,16);assert.equal(setupError(run),'');
 assert.deepEqual(restoreAutoRun(JSON.stringify(run)),run);assert.equal(buyRandomPiece(run),run);assert.equal(upgradeShop(run),run);
 const sold=sellPiece(run,'piece-1');assert.equal(buyRandomPiece(sold).army.length,16);
 const enemy=planOpponent(run.army,{reserve:20,level:10,purchases:15,sales:0,income:0},'sixteen-enemy',run.color);
 assert.equal(enemy.army.length,16);assert.equal(new Set(enemy.army.map(piece=>piece.square)).size,16);
});
test('four reserve slots guard purchases and return; a full swap is atomic',()=>{
 let run={...createModernRun('reserve'),reserve:100};
 for(let i=0;i<8;i++)run=buyRandomPiece(run);
 assert.equal(reservePieces(run).length,4);assert.equal(run.purchases,4);assert.equal(run.reserve,90);
 assert.equal(purchaseError(run),'Резерв заполнен');assert.equal(benchPiece(run,'king'),run);
 const incoming=run.army[1],square=placementSquares(incoming.type,run.color).find(square=>!run.army.some(piece=>piece.square===square));
 run=placePiece(run,incoming.id,square);run=buyRandomPiece(run);assert.equal(reservePieces(run).length,4);
 const selected=reservePieces(run)[0],slot=selected.reserveSlot,before=structuredClone(run),ids=run.army.map(piece=>piece.id).sort();
 const swapped=placePiece(run,selected.id,square);
 if(!placementSquares(selected.type,run.color).includes(square)){assert.equal(swapped,run);return;}
 assert.deepEqual(run,before);assert.equal(swapped.army.find(piece=>piece.id===incoming.id).reserveSlot,slot);
 assert.equal(swapped.army.find(piece=>piece.id===selected.id).square,square);assert.equal(reservePieces(swapped).length,4);
 assert.deepEqual(swapped.army.map(piece=>piece.id).sort(),ids);assert.equal(swapped.reserve,run.reserve);
});
test('old overflow is preserved explicitly, resolved manually and cannot grow',()=>{
 let run=createModernRun('old-overflow');delete run.reserveRule;run.round=21;run.purchases=7;run.nextId=8;run.reserve=35;
 run.results=Array.from({length:20},(_,i)=>({outcome:'draw',shopLevel:1,battleId:run.id+':'+(i+1)}));
 run.army.push(...Array.from({length:7},(_,i)=>({id:'piece-'+(i+1),type:'p',paid:i+1,square:null,benched:true})));
 run=restoreAutoRun(JSON.stringify(run));assert.equal(run.legacyReserveOverflow,true);assert.equal(reservePieces(run).length,7);
 assert.equal(buyRandomPiece(run),run);assert.equal(benchPiece(run,'king'),run);assert.match(setupError(run),/резерв/);
 for(let i=0;i<3;i++)run=placePiece(run,'piece-'+(i+1),placementSquares('p',run.color)[i]);
 assert.equal(reservePieces(run).length,4);assert.equal(run.legacyReserveOverflow,undefined);
 assert.deepEqual(reservePieces(run).map(piece=>piece.reserveSlot).sort(),[0,1,2,3]);
 assert.deepEqual(restoreAutoRun(JSON.stringify(run)),run);
});
test('opponent budget is conserved through a long series and saves',()=>{
 let run=createModernRun('persistent-opponent');
 for(let i=0;i<40;i++){
  const before=structuredClone(run);
  const enemy=advanceOpponent(run,run.color==='w'?'b':'w');
  assert.deepEqual(run,before,'planner must not mutate its input');
  run={...run,phase:'paused',battle:{id:run.id+':'+run.round,initialFen:setupFen(run),moves:[],elapsed:0,result:null}};
  const next=nextRound(completeBattle(run,{winner:null,reason:'test'}));
  const p=next.opponentProgress;
  assert.equal(p.reserve,3+p.income+p.sales-p.purchases*(p.purchases+1)/2-(p.level-1)*(p.level+1));
  assert.ok(next.opponent.length<=armyCapacity({version:4,level:p.level}));assert.ok(p.level<=10);
  assert.deepEqual(restoreAutoRun(JSON.stringify(next)),next);run=next;
 }
 assert.ok(run.opponentProgress.level>1,'bot independently upgrades even when player stays at level one');
});
test('opponent starts with the same three coins and can make several purchases',()=>{
 const run=createModernRun('initial-economy'),p=run.opponentProgress;
 assert.equal(p.openingBalance,3);assert.equal(p.purchases,2);assert.equal(p.reserve,0);
 assert.deepEqual(run,createModernRun('initial-economy'));
 assert.deepEqual(restoreAutoRun(JSON.stringify(run)),run);
});
test('opponent decisions do not inspect player inventory, level or reserve',()=>{
 const run=createModernRun('blind');
 assert.deepEqual(advanceOpponent(run,'b'),advanceOpponent({...run,army:[],level:10,reserve:99999},'b'));
});
test('opponent sale uses half the paid price and purchases are not free replacements',()=>{
 const army=[{id:'king',type:'k',square:'e8',paid:0},...Array.from({length:15},(_,i)=>({id:'old-'+i,type:'p',paid:i+1,square:'abcdefgh'[i%8]+(i<8?'7':'6')}))];
 const p={reserve:16,level:10,purchases:15,sales:0,income:0};
 const result=planOpponent(army,p,'sale-test','b');
 assert.ok(result.progress.purchases>15);assert.ok(result.progress.sales>=3);
 assert.equal(result.progress.reserve,result.progress.openingBalance+result.progress.sales-result.progress.purchases*(result.progress.purchases+1)/2-99);
 assert.ok(result.army.some(piece=>piece.id.startsWith('old-')),'retains existing pieces');
 assert.ok(result.army.length<=16);
});
test('opponent can save money and never spends unaffordable coins',()=>{
 const run=createModernRun('save'),p={...run.opponentProgress,reserve:0};
 const result=planOpponent(run.opponent,p,run.seed,'b');
 assert.equal(result.progress.purchases,p.purchases);assert.equal(result.progress.reserve,0);
});
test('placement is deterministic, valid for either colour and independent of enemies',()=>{
 const types=['k','q','r','b','b','n','p','p'];
 for(const color of ['w','b']){
  const army=types.map((type,i)=>({id:String(i),type,square:null,paid:i}));
  const arranged=arrangeOpponent(army,color);
  assert.equal(new Set(arranged.map(piece=>piece.square)).size,8);
  assert.ok(arranged.every(piece=>placementSquares(piece.type,color).includes(piece.square)));
  assert.deepEqual(arrangeOpponent(army,color),arranged);
  assert.ok(army.every(piece=>piece.square===null));
  assert.equal(arranged[0].square[1],color==='w'?'1':'8');
 }
});
test('setup avoids the back-rank mate pattern with either colour',()=>{
 const enemy=[['k','d8'],['n','b7'],['b','c7'],['p','d7'],['p','e7'],['n','f7']];
 const player=[['k','d1'],['r','g1'],['r','h1'],['p','a4'],['p','b4'],['n','c3'],['n','d3'],['n','e3']];
 for(const color of ['w','b']){
  const pieces=rows=>rows.map(([type,square],i)=>({id:String(i),type,paid:i,square:color==='w'?square:'abcdefgh'[7-'abcdefgh'.indexOf(square[0])]+(9-Number(square[1]))}));
  const run={color,army:pieces(player),opponent:pieces(enemy)};
  const matingMoves=position=>{const game=new Chess(setupFen(position).replace(' w ',' '+color+' ')),mates=[];for(const move of game.moves()){game.move(move);if(game.isCheckmate())mates.push(move);game.undo();}return mates;};
  assert.ok(matingMoves(run).length>0,'fixture reproduces a first-move mate');
  const fixed={...run,opponent:arrangeOpponent(run.opponent,color==='w'?'b':'w')};
  assert.deepEqual(matingMoves(fixed),[],'same owned pieces must leave a defence');
  assert.equal(setupError(fixed),'');
 }
});
test('shelter leaves an escape off the king rank for varied full armies',()=>{
 for(const color of ['w','b'])for(const type of ['p','n','b','r','q']){
  const army=arrangeOpponent(['k',type,type,'p','p','n','b','r'].map((type,i)=>({id:String(i),type,square:null,paid:i})),color);
  const king=army.find(piece=>piece.type==='k'),x='abcdefgh'.indexOf(king.square[0]),y=Number(king.square[1]);
  const exits=[-1,1].flatMap(dy=>[-1,0,1].map(dx=>[x+dx,y+dy])).filter(([file,row])=>file>=0&&file<8&&row>=1&&row<=8).map(([file,row])=>'abcdefgh'[file]+row);
  assert.ok(exits.some(square=>!army.some(piece=>piece.square===square)));
 }
});
test('losing opponent invests early and still fields new troops before series end',()=>{
 let run=createModernRun('economy-check');
 for(let i=0;i<8;i++){
  run.results.push({outcome:'win'});
  const enemy=advanceOpponent(run,'b');run={...run,color:'w',opponent:enemy.army,opponentProgress:enemy.progress};
  if(i===1)assert.ok(run.opponentProgress.level>=2,'upgrade contributes income in later rounds');
 }
 assert.ok(run.opponentProgress.purchases>=6,'investment must not starve the army');
 assert.ok(run.opponentProgress.reserve>=0);
});
test('last-battle forecast spends on strength instead of buying future income',()=>{
 const army=[{id:'k',type:'k',paid:0,square:'e8'},{id:'p1',type:'p',paid:1,square:'d7'},{id:'p2',type:'p',paid:2,square:'e7'}];
 const result=planOpponent(army,{reserve:10,level:1,purchases:2,sales:0,income:0},'last-battle','b',2,1);
 assert.ok(result.progress.purchases>2,'any upgrade must still leave an immediate purchase');
 const noPurchase=planOpponent(army,{reserve:3,level:1,purchases:9,sales:0,income:0},'last-battle','b',2,1);
 assert.equal(noPurchase.progress.level,1,'no upgrade solely for income beyond final battle');
 assert.equal(noPurchase.progress.reserve,3);
});
test('legacy opponent migration keeps inventory and anchors existing economy',()=>{
 const run=createModernRun('migration');delete run.opponentProgress;
 run.opponent=opponentFor(run.seed,1,run.color==='w'?'b':'w');
 const result=advanceOpponent(run,'b');
 assert.ok(run.opponent.every(old=>result.army.some(piece=>piece.id===old.id&&piece.type===old.type)));
 assert.equal(result.progress.strategy,1);
});
test('bench preserves ownership and pending kings prevent battle start',()=>{
 let run=prepared(),id=run.army.at(-1).id;
 run=benchPiece(run,id);assert.equal(run.army.at(-1).square,null);assert.equal(run.army.at(-1).benched,true);assert.equal(setupError(run),'');
 run=placePiece(run,id,run.color==='w'?'d1':'d8');assert.equal(run.army.at(-1).benched,undefined);
 const withoutKing=benchPiece(run,'king');assert.match(setupError(withoutKing),/короля/);assert.equal(beginBattle(withoutKing),withoutKing);
});
test('colour changes preserve screen coordinates for every deployed piece',()=>{
 const index=(square,color)=>{const i=(8-Number(square[1]))*8+'abcdefgh'.indexOf(square[0]);return color==='w'?i:63-i;};
 let changed=0;
 for(let seed=0;seed<30;seed++){
  const run={...createAutoRun('flip-'+seed,String(seed)),phase:'result',results:[{outcome:'draw'}]};
  const next=nextRound(run);if(run.color!==next.color)changed++;
  assert.equal(index(run.army[0].square,run.color),index(next.army[0].square,next.color));
 }
 assert.ok(changed>0);
});
test('paid pawn sells for full price and income records the completed shop level',()=>{
 assert.equal(salePrice({type:'p',paid:7}),3);
 const run=upgradeShop(createModernRun('income'));
 const battle=beginBattle(run),finished=completeBattle(battle,{winner:null,reason:'test'}),next=nextRound(finished);
 assert.equal(finished.results[0].shopLevel,2);assert.equal(next.reserve,4);assert.deepEqual(restoreAutoRun(JSON.stringify(next)),next);
 assert.equal(roundIncome({outcome:'win',shopLevel:10}),14);
});
const createAutoRun=(...args)=>{const run=createModernRun(...args);delete run.opponentProgress;return {...run,version:3,opponent:opponentFor(run.seed,1,run.color==='w'?'b':'w')};};
test('random shop prices persist and probabilities cover all ten levels',()=>{
 const run=createModernRun('shop');assert.equal(purchasePrice(run),1);assert.equal(levelPrice(run),3);
 const bought=buyRandomPiece(run);assert.equal(bought.reserve,2);assert.equal(purchasePrice(bought),2);
 assert.deepEqual(buyRandomPiece(run),bought);assert.equal(salePrice(bought.army.at(-1)),1);
 const sold=sellPiece(bought,bought.army.at(-1).id);assert.equal(sold.reserve,3);assert.equal(purchasePrice(sold),2);
 assert.deepEqual(restoreAutoRun(JSON.stringify(sold)),sold);
 const level=upgradeShop(run);assert.equal(level.level,2);assert.equal(level.reserve,0);assert.equal(levelPrice(level),5);
 assert.deepEqual(restoreAutoRun(JSON.stringify(level)),level);
 for(let i=1;i<=10;i++){assert.equal(Object.values(shopOdds(i)).reduce((a,b)=>a+b),100);assert.ok(Object.values(shopOdds(i)).every(n=>n>=0));}
 assert.equal(upgradeShop({...run,level:10,reserve:100}).level,10);
});
test('round income depends on results without resetting shop counters',()=>{
 for(const outcome of ['win','draw','loss']){
  let run=buyRandomPiece(createModernRun(outcome));run={...run,phase:'result',results:[{battleId:run.id+':1',outcome}],battle:{result:{winner:null}}};
  const next=nextRound(run);assert.equal(next.reserve,run.reserve+roundIncome({outcome}));assert.equal(next.purchases,1);assert.equal(next.level,1);
  assert.equal(purchasePrice(next),2);assert.deepEqual(restoreAutoRun(JSON.stringify(next)),next);
 }
});
const prepared=()=>{
 let run=buyPiece(createAutoRun('test','fixture'),'n');
 run=placePiece(run,run.army.at(-1).id,run.color==='w'?'d1':'d8');return run;
};
test('terminal initial position completes without allocating an engine',async()=>{
 let run={...createModernRun('terminal'),phase:'paused',battle:{id:'terminal:1',initialFen:'4k3/8/8/8/8/8/8/4K3 w - - 0 1',moves:[],elapsed:0,result:null}};
 const controller=createBattleController({getRun:()=>run,save:next=>{run=next;return true;},onChange:()=>{},onError:message=>assert.fail(message),engineFactory:()=>assert.fail('Engine must not be allocated')});
 await controller.start();assert.equal(run.phase,'result');assert.equal(run.results[0].outcome,'draw');assert.equal(run.battle.elapsed,0);controller.dispose();
});
test('shop conserves budget, enforces capacity and cannot sell king',()=>{
 let run={...createAutoRun('one'),version:1,reserve:12};const original=run;
 run=buyPiece(run,'q');assert.equal(run.reserve,3);assert.equal(buyPiece(run,'q'),run);
 run=sellPiece(run,run.army.at(-1).id);assert.equal(run.reserve,7);assert.equal(sellPiece(run,'king'),run);
 for(let i=0;i<20;i++){const next=buyPiece(run,'p');if(next!==run)run=placePiece(next,next.army.at(-1).id,placementSquares('p',run.color).find(square=>!run.army.some(piece=>piece.square===square)));}assert.equal(run.army.length,8);assert.equal(run.reserve,0);assert.equal(original.army.length,1);
});
test('opponents spend equal budget and every round restores bought army',()=>{
 for(let seed=0;seed<100;seed++){
  let run=prepared();run=buyPiece(createAutoRun(String(seed)),'p');run=placePiece(run,run.army.at(-1).id,run.color==='w'?'d2':'d7');
  for(let round=1;round<=5;round++){
   assert.equal(run.opponent.reduce((n,p)=>n+PRICES[p.type],0),3+(round-1)*3);
   assert.ok(run.opponent.length<=8);assert.equal(new Set(run.opponent.map(p=>p.square)).size,run.opponent.length);
   assert.equal(setupError(run),'');
   run=beginBattle(run);const army=run.army;
   run=completeBattle(run,{winner:null,reason:'test'});assert.deepEqual(run.army,army);
   if(round<5)run=nextRound(run);
  }
 }
});
test('placement validates ranks, pending purchases and castling rights',()=>{
 let run=buyPiece({...createAutoRun('one'),version:1,reserve:12},'p');assert.equal(setupError(run),'');
 const id=run.army.at(-1).id;assert.equal(placePiece(run,id,run.color==='w'?'a5':'a4'),run);
 assert.notEqual(placePiece(run,id,run.color==='w'?'a4':'a5'),run);
 assert.equal(placePiece(run,id,run.color==='w'?'a1':'a8'),run);
 run=placePiece(run,id,run.color==='w'?'a2':'a7');assert.equal(setupError(run),'');
 run=buyPiece(run,'r');run=placePiece(run,run.army.at(-1).id,run.color==='w'?'h1':'h8');
 assert.ok(setupFen(run).split(' ')[2].includes(run.color==='w'?'K':'k'));
 run=placePiece(run,'king',run.color==='w'?'d1':'d8');assert.ok(!setupFen(run).split(' ')[2].includes(run.color==='w'?'K':'k'));
});
test('limits preserve actual mate on last ply and ordinary draws',()=>{
 const mate=new Chess('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');
 for(const ply of [119,120])assert.equal(battleResult(mate,ply,29999).winner,'w');
 assert.equal(battleResult(new Chess(),120,0).reason,'Достигнут лимит ходов');
 assert.equal(battleResult(new Chess(),2,300000),null);
 assert.equal(battleResult(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'),1,0).reason,'Пат');
 const repeat=new Chess();for(let i=0;i<2;i++)for(const m of ['Nf3','Nf6','Ng1','Ng8'])repeat.move(m);
 assert.equal(battleResult(repeat,8,0).reason,'Троекратное повторение');
 assert.equal(battleResult(new Chess('7k/8/6K1/8/8/8/8/R7 w - - 100 60'),0,0).winner,null);
});
test('saved run round trips and corrupted budget or moves fail closed',()=>{
 const run=beginBattle(prepared());assert.deepEqual(restoreAutoRun(JSON.stringify(run)),run);
 assert.throws(()=>restoreAutoRun(JSON.stringify({...run,reserve:999})));
 assert.throws(()=>restoreAutoRun(JSON.stringify({...run,battle:{...run.battle,moves:['e1e8']}})));
});
const harness=()=>{
 let run=beginBattle(prepared()),now=0,resolveMove,terminated=0;const timers=new Map();let timerId=0;
 const errors=[];
 const controller=createBattleController({getRun:()=>run,save:next=>{run=next;return true;},onChange:()=>{},onError:message=>errors.push(message),clock:()=>now,schedule:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},cancel:id=>timers.delete(id),engineFactory:()=>({ready:Promise.resolve(),search:()=>new Promise(resolve=>{resolveMove=resolve;}),terminate:()=>{terminated++;}})});
 return {controller,get:()=>run,setTime:value=>{now=value;},move:()=>{const m=battleGame(run).moves({verbose:true})[0];resolveMove(m.from+m.to+(m.promotion||''));},timers,errors,terminated:()=>terminated};
};
test('battle continues beyond the former time limit',async()=>{
 const h=harness();await h.controller.start();h.setTime(60000);h.move();await Promise.resolve();
 assert.notEqual(h.get().phase,'result');assert.equal(h.get().battle.moves.length,1);assert.equal(h.get().battle.elapsed,60000);assert.equal(h.terminated(),0);assert.deepEqual(restoreAutoRun(JSON.stringify(h.get())),h.get());h.controller.dispose();
});
test('pause preserves elapsed time, rejects old answer and resumes remaining time',async()=>{
 const h=harness();await h.controller.start();h.setTime(4321);h.controller.pause();h.move();await Promise.resolve();
 assert.equal(h.get().battle.elapsed,4321);assert.equal(h.get().battle.moves.length,0);
 h.setTime(20000);await h.controller.start();assert.equal(h.timers.size,0);h.controller.dispose();
});
test('accepted move persists actual history and duplicate completion is inert',async()=>{
 const h=harness();await h.controller.start();h.setTime(100);h.move();await Promise.resolve();
 assert.equal(h.get().battle.moves.length,1);assert.equal(h.get().battle.elapsed,100);
 const finished=completeBattle(h.get(),{winner:null,reason:'test'});assert.equal(completeBattle(finished,{winner:'w',reason:'test'}),finished);h.controller.dispose();
});
test('autoplay config is symmetric and sends newgame only once',async()=>{
 const commands=[];const worker={postMessage:command=>commands.push(command),terminate:()=>{}};
 const client=createAutoplayEngine(()=>worker);worker.onmessage({data:'uciok'});worker.onmessage({data:'readyok'});await client.ready;
 const first=client.search(new Chess().fen(),[]);worker.onmessage({data:'bestmove e2e4'});assert.equal(await first,'e2e4');
 const second=client.search(new Chess().fen(),['e2e4']);worker.onmessage({data:'bestmove e7e5'});await second;
 assert.equal(commands.filter(command=>command==='ucinewgame').length,1);
 assert.ok(commands.includes('setoption name UCI_LimitStrength value false'));assert.ok(!commands.some(command=>command.includes('UCI_Elo')));
 assert.equal(commands.filter(command=>command==='go movetime 100').length,2);client.terminate();
});

test('new series starts with three coins; previous series keep their budget',()=>{
 const fresh=createAutoRun('new');assert.equal(fresh.reserve,3);assert.equal(buyPiece(fresh,'q'),fresh);assert.equal(buyPiece(fresh,'n').reserve,0);
 const old={...createAutoRun('legacy'),version:1,reserve:12};old.opponent=opponentFor(old.seed,1,old.color==='w'?'b':'w',12);
 assert.deepEqual(restoreAutoRun(JSON.stringify(old)),old);
 const advanced=nextRound(completeBattle(beginBattle(old),{winner:null,reason:'test'}));assert.equal(advanced.reserve,15);assert.deepEqual(restoreAutoRun(JSON.stringify(advanced)),advanced);
});


test('memory failure during engine creation or readiness preserves paused battle',async()=>{
 for(const asynchronous of [false,true]){
  let run=beginBattle(prepared());run={...run,battle:{...run.battle,elapsed:4321}};
  const before=structuredClone(run.battle),errors=[];let terminated=0;
  const controller=createBattleController({getRun:()=>run,save:next=>{run=next;return true;},onChange:()=>{},onError:message=>errors.push(message),engineFactory:()=>{
   if(!asynchronous)throw new RangeError('Out of memory');
   return {ready:Promise.reject(new RangeError('Out of memory')),terminate:()=>terminated++};
  }});
  await controller.start();assert.equal(run.phase,'paused');assert.deepEqual(run.battle,before);
  assert.equal(controller.isActive(),false);assert.equal(controller.isPreparing(),false);
  assert.match(errors[0],/Не хватает памяти/);assert.equal(terminated,Number(asynchronous));controller.dispose();
 }
});


test('series ends at ten wins or three losses; draws allow rounds beyond five',()=>{
 for(const [outcome,count] of [['win',10],['loss',3],['draw',30]]){
  let run=prepared();
  for(let index=0;index<count;index++){
   // Use a legal fixture independent of generated opponent checks.
   run={...run,phase:'paused',battle:{id:run.id+':'+run.round,initialFen:setupFen(run),moves:[],elapsed:0,result:null}};
   run=completeBattle(run,{winner:outcome==='draw'?null:outcome==='win'?run.color:run.color==='w'?'b':'w',reason:'test'});
   assert.equal(seriesFinished(run),outcome!=='draw'&&index===count-1);
   if(seriesFinished(run))assert.equal(nextRound(run),run);
   else {run=nextRound(run);assert.ok(run.reserve+run.army.reduce((sum,p)=>sum+PRICES[p.type],0)<=24);assert.deepEqual(restoreAutoRun(JSON.stringify(run)),run);}
  }
 }
});
test('same-colour bishops may start and immediately draw; first-move capture is legal',()=>{
 let run={...createAutoRun('bishops'),color:'w',army:[{id:'king',type:'k',square:'e1'},{id:'bishop',type:'b',square:'a1'}],opponent:[{id:'enemy-king',type:'k',square:'e8'},{id:'enemy-bishop',type:'b',square:'h8'}]};
 assert.equal(setupError(run),'');run=beginBattle(run);assert.equal(run.phase,'paused');
 assert.equal(battleResult(battleGame(run),0,0).reason,'Недостаточно материала');
 const game=battleGame(run);assert.equal(game.move('Bxh8').captured,'b');
});

test('white always starts; bot repairs black check without changing player or economy',()=>{
 for(const color of ['w','b']){
  const run={...prepared(),color,army:[{id:'king',type:'k',square:color==='w'?'a1':'a8'},{id:'rook',type:'r',square:color==='w'?'h1':'h8'}],opponent:[{id:'enemy-king',type:'k',square:color==='w'?'h8':'h1'},{id:'enemy-rook',type:'r',square:color==='w'?'b8':'a1'}]};
  const snapshot=structuredClone(run),started=beginBattle(run),game=battleGame(started);
  assert.equal(game.turn(),'w');assert.equal(new Chess(game.fen().replace(' w ',' b ')).isCheck(),false);
  assert.deepEqual(run,snapshot);assert.deepEqual(started.army,run.army);assert.equal(started.reserve,run.reserve);
  assert.deepEqual(started.opponent.map(({square,...piece})=>piece),run.opponent.map(({square,...piece})=>piece));
 }
});
test('white can start in check without moving the opponent or changing turn',()=>{
 const run={...prepared(),color:'w',army:[{id:'king',type:'k',square:'a1'}],opponent:[{id:'enemy-king',type:'k',square:'h8'},{id:'enemy-rook',type:'r',square:'a8'}]};
 const started=beginBattle(run);assert.equal(battleGame(started).turn(),'w');assert.equal(battleGame(started).isCheck(),true);assert.deepEqual(started.opponent,run.opponent);
});
