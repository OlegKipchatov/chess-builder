import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPve,PVE,NODES,TYPE_WEIGHT,statScale,maxHp,damage,xpThreshold,earnXp,deathPenalty,useStone,toggleUnit,evolveUnit,frontier,isUnlocked,activeArmy,armyPower,encounter,normalizePve} from '../dist/pve-model.js';
import {pveRewards,formation,movesFor,allMoves,resolveAction,beginPveBattle,playPveAction,settlePve,resignPve,returnToMap,pveBoardAdapter} from '../dist/pve-battle.js';
import {choosePveMove} from '../dist/pve-ai.js';
import {initialState,migrateState,loadState,KEY} from '../dist/state.js';
const unit = (id,type,color,square,level=1,hp=maxHp({type,level})) => ({id,type,color,square,level,hp,moved:false});
const position = units => ({id:'test',rulesVersion:2,phase:'playing',turn:'w',ply:0,units,xp:{},positions:{},result:null,lastEvent:null});
const win = (profile,nodeId) => {
 const started=beginPveBattle(profile,nodeId,()=>0),battle=started.battle;
 assert.ok(battle);battle.units.find(unit=>unit.color==='b'&&unit.type==='k').hp=0;
 battle.phase='result';battle.result={outcome:'win',reason:'king'};
 return settlePve({coins:100,pve:started},'2026-10-06T08:00:00Z');
};
test('PvE migration preserves existing wallet, rating, archive, game and identity',()=>{
 const old=initialState();delete old.pve;old.coins=236;
 const migrated=migrateState(old);assert.equal(migrated.coins,236);assert.equal(migrated.pve.units.length,10);assert.equal(activeArmy(migrated.pve).length,8);
 const pve=useStone({...migrated.pve,stones:1},'pve-unit-5');
 const restored=migrateState({...migrated,pve});assert.deepEqual(restored.pve.units,pve.units);assert.equal(restored.pve.stones,0);
 assert.deepEqual(restored.archive,migrated.archive);assert.deepEqual(restored.rating,migrated.rating);
});
test('Piece roles differ and levels change concrete hit and survival thresholds',()=>{
 assert.equal(statScale(5),2.6);
 for(const type of Object.keys(TYPE_WEIGHT)){
  assert.equal(maxHp({type,level:2}),Math.round(maxHp({type,level:1})*1.4));
  assert.equal(damage({type,level:5}),Math.round(damage({type,level:1})*2.6));
 }
 assert.ok(damage({type:'n',level:1})>=maxHp({type:'p',level:1}));
 assert.ok(damage({type:'k',level:1})>=maxHp({type:'p',level:1}));
 assert.ok(damage({type:'p',level:1})<maxHp({type:'p',level:1}));
 assert.ok(damage({type:'p',level:2})>=maxHp({type:'p',level:1}));
 assert.ok(maxHp({type:'p',level:2})>damage({type:'n',level:1}));
 assert.ok(maxHp({type:'r',level:1})>maxHp({type:'b',level:1}));
 assert.ok(damage({type:'b',level:1})>damage({type:'n',level:1}));
});
test('Nonlethal attack spends a turn, leaves attacker in place and never counters',()=>{
 const battle=position([unit('p','p','w','c4'),unit('n','n','b','d5',2)]);
 const next=resolveAction(battle,{from:'c4',to:'d5'});
 assert.equal(next.units[0].square,'c4');assert.equal(next.units[0].hp,100);assert.equal(next.units[1].hp,88);assert.equal(next.turn,'b');assert.equal(next.ply,1);assert.deepEqual(next.xp,{});
 assert.equal(battle.units[1].hp,168,'input immutable');
});
test('Lethal attack enters the target square and awards only the attacking figure',()=>{
 const next=resolveAction(position([unit('p','p','w','c4',2),unit('n','p','b','d5')]),{from:'c4',to:'d5'});
 assert.equal(next.units[0].square,'d5');assert.equal(next.units[1].hp,0);assert.equal(next.xp.p,13);assert.ok(next.lastEvent.killed);
});
test('Geometry enforces blockers, board edges, own pieces and side to move',()=>{
 const battle=position([unit('r','r','w','a1'),unit('p','p','w','a3'),unit('b','b','b','c1')]);
 assert.deepEqual(movesFor(battle,battle.units[0]).map(move=>move.to).sort(),['a2','b1','c1']);
 assert.equal(resolveAction(battle,{from:'a1',to:'a4'}),battle);assert.equal(resolveAction(battle,{from:'c1',to:'d2'}),battle);
 assert.equal(movesFor(position([unit('n','n','w','a1')]),unit('n','n','w','a1')).length,2);
});
test('Pawns have forward/double moves, diagonal attacks, temporary promotion, no en passant',()=>{
 const battle=position([unit('p','p','w','a2'),unit('n','n','b','b3')]);
 assert.deepEqual(movesFor(battle,battle.units[0]).map(row=>row.to).sort(),['a3','a4','b3']);
 const blocked=position([unit('p','p','w','a2'),unit('n','n','b','a3')]);assert.equal(movesFor(blocked,blocked.units[0]).length,0);
 const promoted=resolveAction(position([unit('p','p','w','a7'),unit('k','k','b','h8')]),{from:'a7',to:'a8'});
 assert.equal(promoted.units[0].type,'q');assert.equal(promoted.lastEvent.promoted,true);
});
test('Draws stop repetition, no-move positions and 120 full moves without extra rewards',()=>{
 let battle=position([unit('w','k','w','a1'),unit('b','k','b','h8')]);
 const cycle=[['a1','a2'],['h8','h7'],['a2','a1'],['h7','h8']];
 for(let i=0;i<16&&battle.phase==='playing';i++){const [from,to]=cycle[i%4];battle=resolveAction(battle,{from,to});}
 assert.equal(battle.result.reason,'repetition');
 const limit=resolveAction({...position([unit('w','k','w','a1'),unit('b','k','b','h8')]),ply:239},{from:'a1',to:'a2'});assert.equal(limit.result.reason,'limit');
 const blocked=resolveAction(position([unit('w','k','w','h1'),unit('b','p','b','a1')]),{from:'h1',to:'h2'});assert.equal(blocked.result.reason,'no-moves');
});
test('Death penalties use final simulation rates, cannot lose more than one level or identity',()=>{
 for(const [type,rate] of Object.entries({p:.12,n:.16,b:.16,r:.2,q:.25,k:.16})){
  const original={id:'x',type,level:3,xp:0,deaths:2},next=deathPenalty(original);
  assert.equal(next.level,2);assert.equal(next.xp,xpThreshold(2)-Math.ceil(xpThreshold(3)*rate));assert.equal(next.id,'x');assert.equal(next.deaths,3);
 }
 assert.equal(deathPenalty({type:'p',level:1,xp:0,deaths:0}).level,1);
});
test('XP threshold, scaling stones and progression gate cannot overflow the cap',()=>{
 const unit={id:'u',type:'p',level:1,xp:58,deaths:0};assert.equal(earnXp(unit,6,3).level,2);
 const capped=earnXp(unit,1e8,3);assert.equal(capped.level,3);assert.equal(capped.xp,xpThreshold(3)-1);
 let p={...initialPve(),stones:1};const id=p.units[4].id;p=useStone(p,id);assert.equal(p.units[4].xp,6);assert.equal(p.stones,0);assert.equal(useStone(p,id),p);
});
test('Army requires eight units with a mandatory king; reserve swaps preserve progress',()=>{
 let p=initialPve();assert.equal(toggleUnit(p,p.units[0].id),p);assert.equal(toggleUnit(p,p.units[8].id),p);
 p=toggleUnit(p,p.units[1].id);assert.equal(activeArmy(p).length,7);assert.equal(beginPveBattle(p,'trail'),p);
 p=toggleUnit(p,p.units[8].id);assert.equal(activeArmy(p).length,8);assert.ok(beginPveBattle(p,'trail').battle);
});
test('Map gates allow either fork and earlier nodes, but block later fights',()=>{
 let p=initialPve();assert.equal(frontier(p),1);assert.equal(isUnlocked(p,NODES.at(-1)),false);assert.equal(beginPveBattle(p,'warden'),p);
 p=returnToMap(win(p,'trail').pve);p=returnToMap(win(p,'clearing').pve);assert.equal(frontier(p),3);
 p=returnToMap(win(p,'watch').pve);assert.equal(frontier(p),4);assert.equal(isUnlocked(p,NODES.find(row=>row.id==='riders')),true);assert.ok(isUnlocked(p,NODES[0]));
});
test('Encounter is deterministic, follows total power, preserves threat bands and level gap',()=>{
 for(let level=1;level<=5;level++)for(const node of NODES){
  const p=initialPve();p.units=p.units.map((row,i)=>({...row,level:i%2?level:1}));
  const a=encounter(p,node),b=encounter(p,node);assert.deepEqual(a,b);assert.equal(a.units.length,8);assert.equal(a.units.filter(row=>row.type==='k').length,1);
  assert.ok(Math.abs(a.power-a.target)<2.01,`${node.id} L${level}: ${a.power}/${a.target}`);assert.ok(Math.max(...a.units.map(row=>row.level))-Math.min(...a.units.map(row=>row.level))<=2);
 }
 const p=initialPve(),weak=encounter(p,NODES[0]);p.units[1].level=5;assert.ok(encounter(p,NODES[0]).target>=weak.target);
 assert.equal(armyPower([{type:'p',level:1,hp:50}]),.5);
});
test('Every encounter is legal to start, does not stack figures or mutate persistent units',()=>{
 const p=initialPve(),next=beginPveBattle(p,'trail');assert.equal(next.battle.units.length,16);assert.equal(new Set(next.battle.units.map(row=>row.square)).size,16);assert.equal(next.battle.turn,'w');assert.equal(p.battle,null);assert.ok(allMoves(next.battle).length>0);
 assert.equal(pveBoardAdapter(next.battle).board().flat().filter(Boolean).length,16);
 assert.deepEqual(normalizePve(next).battle,next.battle);
});
test('Settlement is idempotent and wallet, rewards, receipts are a single saved state',()=>{
 const result=win(initialPve(),'trail');assert.equal(result.coins,117);assert.equal(result.pve.stones,3);assert.equal(result.pve.stats.wins,1);assert.equal(settlePve(result),result);
 const storage=new Map();storage.set(KEY,JSON.stringify({...initialState(),...result}));const loaded=loadState({getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
 assert.equal(loaded.coins,117);assert.equal(loaded.pve.battle.settled,true);assert.equal(settlePve(loaded),loaded);
});
test('First boss raises cap; every boss victory gives one core; evolution keeps identity',()=>{
 let p=initialPve();for(const nodeId of ['trail','clearing','riders','bridge','gate','warden'])p=returnToMap(win(p,nodeId).pve);
 assert.equal(p.levelCap,5);assert.equal(p.cores,1);
 const original=p.units[4];const evolved=evolveUnit(p,original.id,'n');assert.equal(evolved.cores,0);assert.deepEqual(evolved.units[4],{...original,type:'n'});assert.equal(evolveUnit(evolved,original.id),evolved);
 const again=returnToMap(win(evolved,'warden').pve);assert.equal(again.cores,1);assert.equal(again.levelCap,5);assert.equal(again.lastResult.first,false);
});
test('Loss preserves kills/death penalties, restores HP next battle and never rewards unused reserves',()=>{
 const wallet=initialState();wallet.pve=beginPveBattle(wallet.pve,'trail');const p=wallet.pve;
 p.battle.units.find(row=>row.id==='pve-unit-5').hp=0;p.battle.xp['pve-unit-2']=20;
 wallet.pve=resignPve(p);const result=settlePve(wallet);assert.equal(result.coins,100);assert.equal(result.pve.units[4].deaths,1);assert.equal(result.pve.units[1].xp,20);assert.equal(result.pve.units[8].xp,0);
 const next=beginPveBattle(returnToMap(result.pve),'trail');assert.ok(next.battle.units.every(row=>row.hp===maxHp(row)));
});
test('PvE coins have no daily cap, including saves that already reached the old limit',()=>{
 let p={...initialPve(),coinDay:'2026-10-06',coinsToday:30},total=0;
 for(let i=0;i<50;i++){
  const wallet=win(p,'trail');const reward=wallet.pve.lastResult;
  assert.equal(reward.coins,i===0?17:12);
  assert.equal(reward.stones,i===0?3:2);
  total+=reward.coins;assert.equal(settlePve(wallet),wallet);
  p=returnToMap(normalizePve(wallet.pve));
 }
 assert.equal(total,605);assert.equal(Object.hasOwn(p,'coinDay'),false);assert.equal(Object.hasOwn(p,'coinsToday'),false);
});
test('Every completed battle grants a stone exactly once, including loss, draw and resignation',()=>{
 for(const [outcome,reason] of [['loss','king'],['draw','limit'],['loss','resigned']]){
  let wallet=initialState();wallet.pve=beginPveBattle(wallet.pve,'trail',()=>0);
  wallet.pve.battle.phase='result';wallet.pve.battle.result={outcome,reason};
  const settled=settlePve(wallet);assert.equal(settled.pve.stones,1);assert.equal(settled.coins,wallet.coins+(reason==='resigned'?0:outcome==='draw'?8:5));assert.equal(settlePve(settled),settled);
  for(const row of settled.pve.lastResult.changes){assert.ok(Number.isInteger(row.beforeXp));assert.ok(Number.isInteger(row.afterXp));}
 }
});
test('Removing a2 preserves all other home squares through reload, reinsertion and evolution',()=>{
 let p=initialPve();const before=formation(activeArmy(p),'w'),pawn=before.find(unit=>unit.square==='a2');
 p=normalizePve(toggleUnit(p,pawn.id));const after=formation(activeArmy(p),'w');
 assert.equal(after.some(unit=>unit.square==='a2'),false);
 for(const unit of after)assert.equal(unit.square,before.find(row=>row.id===unit.id).square);
 p=toggleUnit(p,pawn.id);p={...p,cleared:['warden'],cores:1,levelCap:5};p=evolveUnit(p,pawn.id,'b');
 const evolved=formation(activeArmy(normalizePve(p)),'w');assert.equal(evolved.find(unit=>unit.id===pawn.id).square,'a2');
 assert.equal(new Set(evolved.map(unit=>unit.square)).size,evolved.length);
});
test('Migration drops obsolete daily counters without touching progress or already settled rewards',()=>{
 const wallet=win(initialPve(),'trail');wallet.pve.coinDay='2026-10-06';wallet.pve.coinsToday=30;
 const migrated=migrateState({...initialState(),...wallet});
 assert.equal(migrated.coins,wallet.coins);assert.deepEqual(migrated.pve.units,wallet.pve.units);
 assert.deepEqual(migrated.pve.battle,wallet.pve.battle);assert.equal(settlePve(migrated),migrated);
 assert.equal(Object.hasOwn(migrated.pve,'coinsToday'),false);
});
test('Battle save resumes exact HP, turn, XP and position; malformed saves never become wins',()=>{
 const p=beginPveBattle(initialPve(),'trail');const next=playPveAction(p,{from:'c2',to:'c4'});assert.notEqual(p,next);assert.deepEqual(normalizePve(JSON.parse(JSON.stringify(next))).battle,next.battle);
 for(const field of ['units','positions','xp'])assert.equal(normalizePve({...p,battle:{...p.battle,[field]:null}}).battle,null);
 const invalid=structuredClone(p);invalid.battle.units[1].square=invalid.battle.units[0].square;assert.equal(normalizePve(invalid).battle,null);
});
test('Core loop survives multiple AI battles, reloads and deterministic rewards',()=>{
 let p=initialPve();for(let game=0;game<3;game++){
  p=beginPveBattle(p,'trail');
  while(p.battle.phase==='playing'){
   const move=choosePveMove(p.battle);assert.ok(move);p=playPveAction(p,move);
   if(p.battle.phase==='playing'&&p.battle.ply%8===0){const restored=normalizePve(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored.battle,p.battle);p=restored;}
  }
  const result=settlePve({coins:100,pve:p});assert.ok(result.pve.battle.settled);assert.ok(result.pve.units.every(row=>row.level>=1&&row.level<=3));p=returnToMap(result.pve);
 }
 assert.equal(p.stats.battles,3);
});
test('Malformed optional fields cannot reset the whole wallet or spoof a result',()=>{
 const wallet=migrateState({...initialState(),coins:800,pve:{...initialPve(),cleared:{},nodes:null,stats:null}});assert.equal(wallet.coins,800);assert.equal(wallet.pve.levelCap,3);
 const done=win(initialPve(),'trail');done.pve.battle.result.changes[0].id='<script>';assert.equal(normalizePve(done.pve).battle,null);
});
test('Persistent evolution is gated; temporary promoted type disappears after battle',()=>{
 let p=initialPve();p.units[4].type='r';assert.equal(normalizePve(p).units[4].type,'p');
 p=beginPveBattle(initialPve(),'trail');p.battle.units.find(row=>row.id==='pve-unit-5').type='q';p=resignPve(p);
 const result=settlePve({coins:100,pve:p});assert.equal(result.pve.units[4].type,'p');
});
test('A running battle freezes upgrades, evolution and lineup changes',()=>{
 const p=beginPveBattle({...initialPve(),stones:5,cores:1},'trail');
 assert.equal(useStone(p,'pve-unit-5'),p);assert.equal(toggleUnit(p,'pve-unit-5'),p);assert.equal(evolveUnit(p,'pve-unit-5'),p);
});
test('Player pawns start at level one; a new fight carries only their earned permanent level',()=>{
 const fresh=initialPve();
 for(let sequence=0;sequence<30;sequence++){
  const battle=beginPveBattle({...fresh,sequence},'trail').battle;
  assert.ok(battle.units.filter(unit=>unit.color==='w').every(unit=>unit.level===1));
 }
 const progressed={...fresh,units:fresh.units.map(unit=>unit.id==='pve-unit-5'?earnXp(unit,60,3):unit)};
 const restored=normalizePve(JSON.parse(JSON.stringify(progressed)));
 const battle=beginPveBattle(restored,'trail').battle;
 assert.equal(battle.units.find(unit=>unit.id==='pve-unit-5').level,2);
 assert.ok(battle.units.filter(unit=>unit.color==='w'&&unit.id!=='pve-unit-5').every(unit=>unit.level===1));
 assert.deepEqual(battle.units.filter(unit=>unit.color==='w').map(({id,level})=>({id,level})),activeArmy(restored).map(({id,level})=>({id,level})));
});

test('Reward ranges include both endpoints, retain first-clear bonuses, and distinguish early surrender',()=>{
 for(const boss of [false,true])for(const outcome of ['win','draw','loss'])for(const fraction of [0,.999999]){
  const node=NODES.find(node=>boss?node.boss:node.id==='trail');
  const battle={id:'bounds',nodeId:node.id,ply:20,result:{outcome,reason:'king'},rewardRoll:{coins:fraction,stones:fraction}};
  const reward=pveRewards(battle,node,false),edge=fraction===0?0:1;
  assert.equal(reward.coins,(boss?{win:[23,33],draw:[15,25],loss:[10,20]}:{win:[12,17],draw:[8,13],loss:[5,10]})[outcome][edge]);
  assert.equal(reward.stones,({win:[2,3],draw:[1,2],loss:[1,1]})[outcome][edge]);
  if(outcome==='win'){const first=pveRewards(battle,node,true);assert.equal(first.coins,reward.coins+(boss?10:5));assert.equal(first.stones,reward.stones+(boss?3:1));assert.equal(first.cores,boss?1:0);}
 }
 const node=NODES[0],battle={id:'resign',nodeId:node.id,ply:18,result:{outcome:'loss',reason:'resigned'},rewardRoll:{coins:0,stones:0}};
 assert.equal(pveRewards(battle,node,false).coins,0);
 battle.ply=19;assert.equal(pveRewards(battle,node,false).coins,5);
});
test('Persisted rolls and legacy fallback survive reload and failed settlement attempts',()=>{
 for(const legacy of [false,true]){
  let p=beginPveBattle(initialPve(),'trail',()=>.72);if(legacy)delete p.battle.rewardRoll;
  p=normalizePve(JSON.parse(JSON.stringify(p)));p.battle.phase='result';p.battle.result={outcome:'win',reason:'king'};
  p.battle.units.find(unit=>unit.color==='b'&&unit.type==='k').hp=0;
  const first=settlePve({coins:0,pve:p});
  const retry=settlePve({coins:0,pve:JSON.parse(JSON.stringify(p))});
  assert.equal(first.coins,retry.coins);assert.equal(first.pve.stones,retry.pve.stones);
  assert.equal(settlePve(first),first);assert.deepEqual(normalizePve(first.pve).battle,first.pve.battle);
 }
});
test('Maximum boss reward survives saved-result validation',()=>{
 const profile={...initialPve(),cleared:NODES.filter(node=>!node.boss).map(node=>node.id)};
 const p=beginPveBattle(profile,'warden',()=>.999999);p.battle.phase='result';p.battle.result={outcome:'win',reason:'king'};p.battle.units.find(unit=>unit.color==='b'&&unit.type==='k').hp=0;
 const wallet=settlePve({coins:0,pve:p});assert.equal(wallet.coins,43);assert.equal(wallet.pve.stones,6);assert.deepEqual(normalizePve(wallet.pve).battle,wallet.pve.battle);
});
