import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPve,maxHp,damage,evolveUnit,normalizePve} from '../dist/pve-model.js';
import {isKingThreatened,isSquareAttacked,movesFor,allMoves,resolveAction,adjudicateBattle,resumePveBattle,beginPveBattle,pveBoardAdapter} from '../dist/pve-battle.js';
import {choosePveMove} from '../dist/pve-ai.js';
const unit = (id,type,color,square,hp=maxHp({type,level:1})) => ({id,type,color,square,level:1,hp,moved:false});
const position = (units,turn='w') => ({id:'test',rulesVersion:2,phase:'playing',turn,ply:0,units,xp:{},positions:{},result:null});
test('A king can survive a knight hit and is captured only when HP reaches zero',()=>{
 let battle=position([unit('wk','k','w','h1'),unit('n','n','w','b6'),unit('bk','k','b','a8'),unit('p','p','b','h7')]);
 assert.ok(movesFor(battle,battle.units[1]).some(move=>move.to==='a8'));
 battle=resolveAction(battle,{from:'b6',to:'a8'});
 assert.equal(battle.units[2].hp,15);assert.equal(battle.units[1].square,'b6');assert.equal(battle.phase,'playing');
 assert.ok(isKingThreatened(battle));assert.ok(pveBoardAdapter(battle).isCheck());
 battle=resolveAction(battle,{from:'h7',to:'h6'});
 battle=resolveAction(battle,{from:'b6',to:'a8'});
 assert.equal(battle.units[2].hp,0);assert.equal(battle.units[1].square,'a8');assert.deepEqual(battle.result,{outcome:'win',reason:'king'});
});
test('Threats, adjacent kings and pinned pieces do not forbid geometric actions',()=>{
 const battle=position([unit('wk','k','w','e4'),unit('bk','k','b','e6'),unit('p','p','b','d5'),unit('r','r','b','d8')]);
 assert.ok(isSquareAttacked(battle,'c4','b'));
 for(const to of ['d5','e5','f5'])assert.ok(movesFor(battle,battle.units[0]).some(move=>move.to===to),to);
 const next=resolveAction(battle,{from:'e4',to:'d5'});assert.notEqual(next,battle);assert.ok(isKingThreatened(next,'w'));
 const pinned=position([unit('wk','k','w','e1'),unit('r','r','w','e2'),unit('bk','k','b','h8'),unit('br','r','b','e8')]);
 assert.notEqual(resolveAction(pinned,{from:'e2',to:'f2'}),pinned);
});
test('An orthodox mate or stalemate remains playable while both kings live',()=>{
 for(const square of ['b6','b7']){
  const battle=position([unit('wk','k','w','c6'),unit('q','q','w',square),unit('bk','k','b','a8')],'b');
  assert.ok(allMoves(battle).length);assert.equal(adjudicateBattle(battle),battle);
  const profile={...initialPve(),battle};assert.equal(resumePveBattle(profile),profile);
 }
});
test('AI avoids a lethal knight reply when a safe escape exists',()=>{
 const battle=position([unit('wk','k','w','a1',50),unit('p','p','w','h2'),unit('bk','k','b','h8'),unit('n','n','b','c2')]);
 const move=choosePveMove(battle),next=resolveAction(battle,move);assert.equal(move.from,'a1');
 for(const reply of allMoves(next))assert.notEqual(resolveAction(next,reply).result?.outcome,'loss');
});
test('A threatened king takes a winning king capture instead of fleeing, even at low HP',()=>{
 const battle=position([unit('wk','k','w','e4',30),unit('bk','k','b','e5',110),unit('r','r','b','e8')]);
 assert.ok(isKingThreatened(battle));const move=choosePveMove(battle);assert.deepEqual(move,{from:'e4',to:'e5'});
 const next=resolveAction({...battle,ply:239},move);assert.deepEqual(next.result,{outcome:'win',reason:'king'});
 const mirrored=position(battle.units.map(row=>({...row,color:row.color==='w'?'b':'w',square:row.square[0]+(9-Number(row.square[1]))})),'b');
 assert.equal(resolveAction(mirrored,choosePveMove(mirrored)).result.outcome,'loss');
});
test('King may trade a survivable hit for a winning counterattack on its next turn',()=>{
 let battle=position([unit('wk','k','w','e4'),unit('bk','k','b','e5')]);
 const move=choosePveMove(battle);assert.deepEqual(move,{from:'e4',to:'e5'});
 battle=resolveAction(battle,move);assert.equal(battle.units[1].hp,30);assert.equal(battle.phase,'playing');
 battle=resolveAction(battle,{from:'e5',to:'e4'});assert.equal(battle.units[0].hp,30);assert.equal(battle.phase,'playing');
 battle=resolveAction(battle,choosePveMove(battle));assert.deepEqual(battle.result,{outcome:'win',reason:'king'});
});
test('Evolution requires an explicit branch, cannot skip a step, and survives reload',()=>{
 for(const branch of ['n','b']){
  let profile={...initialPve(),cleared:['warden'],levelCap:5,cores:4};
  const original=profile.units[4];
  assert.equal(evolveUnit(profile,original.id,'r'),profile);
  assert.equal(evolveUnit(profile,original.id),profile);
  for(const type of [branch,'r','q']){
   profile=normalizePve(evolveUnit(profile,original.id,type));
   assert.deepEqual(profile.units[4],{...original,type});
  }
  assert.equal(profile.cores,1);assert.equal(evolveUnit(profile,original.id,'r'),profile);
  assert.equal(evolveUnit(profile,profile.units[0].id,'q'),profile);
 }
 const legacy={...initialPve(),cleared:['warden'],cores:3};legacy.units[4].type='r';
 assert.equal(normalizePve(legacy).units[4].type,'r');assert.equal(normalizePve(legacy).cores,3);
});
test('Legacy battles retain damage ratio and progression; HP migration runs exactly once',()=>{
 const profile=beginPveBattle(initialPve(),'trail');delete profile.battle.rulesVersion;
 for(const row of profile.battle.units)row.hp=50*(1+.25*(row.level-1));
 // Legacy HP is integer. Keep a whole-level fixture for exact old validation.
 for(const row of profile.battle.units){row.level=1;row.hp=50;}
 const migrated=normalizePve(profile);
 assert.ok(migrated.battle);assert.equal(migrated.battle.rulesVersion,2);
 for(const row of migrated.battle.units)assert.equal(row.hp,Math.round(maxHp(row)/2));
 assert.deepEqual(normalizePve(migrated),migrated);assert.deepEqual(migrated.units,profile.units);
});
test('Temporary promotion rescales remaining HP to the new type and keeps damage fraction',()=>{
 const battle=position([unit('wk','k','w','h1'),unit('p','p','w','a7',50),unit('bk','k','b','h7')]);
 const next=resolveAction(battle,{from:'a7',to:'a8'}),promoted=next.units[1];
 assert.equal(promoted.type,'q');assert.equal(promoted.hp,75);
});
test('AI rejects a poisoned pawn when the reply would win its queen',()=>{
 const battle=position([unit('wk','k','w','h1'),unit('q','q','w','d1'),unit('bk','k','b','h8'),unit('p','p','b','d5'),unit('r','r','b','d8')]);
 const move=choosePveMove(battle);assert.ok(move);
 assert.notDeepEqual(move,{from:'d1',to:'d5'});
});
