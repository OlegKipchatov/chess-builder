import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPve,maxHp,damage,evolveUnit,normalizePve} from '../dist/pve-model.js';
import {isInCheck,isSquareAttacked,movesFor,allMoves,resolveAction,adjudicateBattle,resumePveBattle,beginPveBattle,pveBoardAdapter} from '../dist/pve-battle.js';
import {choosePveMove} from '../dist/pve-ai.js';
const unit = (id,type,color,square,hp=maxHp({type,level:1})) => ({id,type,color,square,level:1,hp,moved:false});
const position = (units,turn='w') => ({id:'test',rulesVersion:2,phase:'playing',turn,ply:0,units,xp:{},positions:{},result:null});
test('A knight gives check regardless of king HP; AI cannot ignore it or capture a king',()=>{
 const battle=position([unit('wk','k','w','h1'),unit('n','n','w','b6'),unit('bk','k','b','a8'),unit('r','r','b','h8')],'b');
 assert.ok(isInCheck(battle));assert.ok(pveBoardAdapter(battle).isCheck());
 assert.ok(!movesFor(battle,battle.units[1]).some(move=>move.to==='a8'));
 const move=choosePveMove(battle);assert.ok(move);
 const next=resolveAction(battle,move);assert.ok(!isInCheck(next,'b'));
 assert.ok(next.units.filter(row=>row.type==='k').every(row=>row.hp>0));
 for(const action of allMoves(battle))assert.ok(!isInCheck(resolveAction(battle,action),'b'));
});
test('King cannot enter pawn control, adjacent king control, or capture a defended pawn',()=>{
 const battle=position([unit('wk','k','w','e4'),unit('bk','k','b','e6'),unit('p','p','b','d5'),unit('r','r','b','d8')]);
 assert.ok(isSquareAttacked(battle,'c4','b'));
 for(const to of ['d5','e5','f5'])assert.ok(!movesFor(battle,battle.units[0]).some(move=>move.to===to),to);
 assert.equal(resolveAction(battle,{from:'e4',to:'d5'}),battle);
});
test('Pins and nonlethal hits cannot expose or leave a king in check',()=>{
 const pinned=position([unit('wk','k','w','e1'),unit('r','r','w','e2'),unit('bk','k','b','h8'),unit('br','r','b','e8')]);
 assert.equal(resolveAction(pinned,{from:'e2',to:'f2'}),pinned);
 const checked=position([unit('wk','k','w','e1'),unit('n','n','w','c6'),unit('bk','k','b','h8'),unit('r','r','b','e7')]);
 assert.ok(isInCheck(checked));assert.equal(resolveAction(checked,{from:'c6',to:'e7'}),checked);
 const lethal=structuredClone(checked);lethal.units[3].hp=damage(lethal.units[1]);
 const next=resolveAction(lethal,{from:'c6',to:'e7'});assert.notEqual(next,lethal);assert.ok(!isInCheck(next,'w'));
});
test('Double check requires king safety; blocking a line is a legal evasion',()=>{
 const battle=position([unit('wk','k','w','e1'),unit('r','r','w','a2'),unit('bk','k','b','h8'),unit('br','r','b','e8')]);
 assert.ok(movesFor(battle,battle.units[1]).some(move=>move.to==='e2'));
 battle.units.push(unit('b','b','b','b4'));
 assert.ok(allMoves(battle).every(move=>move.from==='e1'));
});
test('Checkmate ends before the move limit, including AI search; kings remain on board',()=>{
 const battle=position([unit('wk','k','w','c6'),unit('q','q','w','b6'),unit('bk','k','b','a8')]);
 const next=resolveAction({...battle,ply:239},{from:'b6',to:'b7'});
 assert.deepEqual(next.result,{outcome:'win',reason:'checkmate'});
 assert.ok(next.units.every(row=>row.hp>0));
 const ai=resolveAction(battle,choosePveMove(battle));assert.equal(ai.result?.reason,'checkmate');
 const mirrored=position(battle.units.map(row=>({...row,color:row.color==='w'?'b':'w',square:row.square[0]+(9-Number(row.square[1]))})),'b');
 assert.equal(resolveAction(mirrored,{from:'b3',to:'b2'}).result.outcome,'loss');
});
test('Stalemate draws; resuming a saved terminal position does not stall the bot',()=>{
 const battle=position([unit('wk','k','w','c6'),unit('q','q','w','b6'),unit('bk','k','b','a8')],'b');
 assert.ok(!isInCheck(battle));assert.equal(allMoves(battle).length,0);
 assert.deepEqual(adjudicateBattle(battle).result,{outcome:'draw',reason:'no-moves'});
 const profile={...initialPve(),battle};assert.equal(resumePveBattle(profile).battle.phase,'result');
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
