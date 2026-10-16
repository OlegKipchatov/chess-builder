import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAction,movesFor,unitAt,positionKey,beginPveBattle} from '../src/domain/pve/pve-battle.ts';
import {initialPve,normalizePve,maxHp} from '../src/domain/pve/pve-model.ts';
const unit=(id,type,color,square,hp=100)=>({id,type,color,square,hp,level:1,moved:false});
const setup=(color,hp=100)=>{
 const other=color==='w'?'b':'w',from=color==='w'?'d7':'d2',adjacent=color==='w'?'e5':'e4',to=color==='w'?'d5':'d4';
 const battle={id:'ep',rulesVersion:2,phase:'playing',turn:other,ply:0,units:[unit('a','p',color,adjacent),unit('t','p',other,from,hp),unit('wk','k','w','a1',140),unit('bk','k','b','h8',140)],xp:{},positions:{},lastEvent:null};
 return resolveAction(battle,{from,to});
};
for(const color of ['w','b'])for(const hp of [70,100])test(`en passant ${color}: ${hp<=80?'lethal':'surviving'} pawn`,()=>{
 const before=setup(color,hp),from=color==='w'?'e5':'e4',to=color==='w'?'d6':'d3',target=color==='w'?'d5':'d4';
 assert.ok(movesFor(before,unitAt(before,from)).some(move=>move.to===to));
 const next=resolveAction(before,{from,to});
 assert.equal(next.lastEvent.enPassant,true);assert.equal(next.lastEvent.targetSquare,target);assert.equal(next.lastEvent.damage,Math.min(80,hp));
 assert.equal(next.units.find(unit=>unit.id==='t').hp,Math.max(0,hp-80));
 assert.equal(next.units.find(unit=>unit.id==='a').square,hp<=80?to:from);
 assert.equal(next.turn,color==='w'?'b':'w');assert.equal(next.ply,before.ply+1);
 assert.equal(next.units.find(unit=>unit.id==='a').hp,100);
 assert.equal(!!next.xp.a,color==='w'&&hp<=80);
 assert.equal(before.units.find(unit=>unit.id==='t').hp,hp);
 const replay=JSON.parse(JSON.stringify(before));assert.deepEqual(resolveAction(replay,{from,to}),next);
});
test('right expires after another action and distinguishes repetition positions',()=>{
 const before=setup('w'),pawn=unitAt(before,'e5'),without={...before,lastEvent:null};
 assert.notEqual(positionKey(before),positionKey(without));
 assert.ok(!movesFor(without,pawn).some(move=>move.to==='d6'));
 let next=resolveAction(before,{from:'a1',to:'a2'});next=resolveAction(next,{from:'h8',to:'h7'});
 assert.ok(!movesFor(next,unitAt(next,'e5')).some(move=>move.to==='d6'));
});
test('requires an actual enemy double pawn move, empty landing and matching pawn identity',()=>{
 const before=setup('w'),pawn=unitAt(before,'e5');
 for(const lastEvent of [{...before.lastEvent,from:'d6'},{...before.lastEvent,attackerId:'other'},{...before.lastEvent,moved:false},{...before.lastEvent,damage:1}])assert.ok(!movesFor({...before,lastEvent},pawn).some(move=>move.to==='d6'));
 const blocked={...before,units:[...before.units,unit('block','n','w','d6')]};
 assert.equal(resolveAction(blocked,{from:'e5',to:'d6'}),blocked);
 assert.ok(!movesFor({...before,turn:'b'},pawn).some(move=>move.to==='d6'));
});
test('normalized saved campaign retains the immediate en passant right',()=>{
 const profile=beginPveBattle(initialPve(),'trail',()=>0);
 const white=profile.battle.units.find(unit=>unit.color==='w'&&unit.type==='p');
 const black=profile.battle.units.find(unit=>unit.color==='b'&&unit.type==='p');
 // Free these squares in a full valid 16-unit campaign fixture.
 const occupied=new Set(profile.battle.units.filter(unit=>unit!==white&&unit!==black).map(unit=>unit.square));
 const file='abcdefgh'.split('').find(file=>!occupied.has(file+'7')&&!occupied.has(file+'5')&&file!=='h');
 white.square=String.fromCharCode(file.charCodeAt(0)+1)+'5';black.square=file+'7';profile.battle.turn='b';
 profile.battle=resolveAction(profile.battle,{from:black.square,to:file+'5'});
 const restored=normalizePve(JSON.parse(JSON.stringify(profile)));
 assert.ok(restored.battle);assert.equal(restored.battle.lastEvent.attackerId,black.id);
 assert.ok(movesFor(restored.battle,unitAt(restored.battle,white.square)).some(move=>move.to===file+'6'));
});
test('AI considers en passant as a damaging capture',async()=>{
 const {choosePveMove}=await import('../src/domain/pve/pve-ai.ts');
 const battle=setup('b',70);
 assert.deepEqual(choosePveMove(battle),{from:'e4',to:'d3'});
});
