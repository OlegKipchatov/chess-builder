import test from 'node:test';
import assert from 'node:assert/strict';
import {compositionIssue,compositionError,placementError,placePiece,benchPiece,buyRandomPiece,beginBattle,createAutoRun,arrangeOpponent,restoreAutoRun,planOpponent,positionCompositionError,repairOpponentComposition} from '../dist/autochess.js';
import {createBattleController} from '../dist/autochess-battle.js';
import {createAutoplayEngine} from '../dist/autochess-engine.js';
const army=types=>types.map((type,i)=>({id:String(i),type,square:'abcdefgh'[i%8]+(1+Math.floor(i/8)),paid:i+1}));
const fixture=()=>({...createAutoRun('composition'),color:'w',level:10,reserve:100,army:[{id:'king',type:'k',square:'e1'},...Array.from({length:8},(_,i)=>({id:'p'+i,type:'p',square:'abcdefgh'[i]+'2',paid:1})),{id:'n1',type:'n',square:'b1',paid:2},{id:'n2',type:'n',square:'g1',paid:2},{id:'new',type:'n',square:null,reserveSlot:0,paid:3}]});
test('promotion budget covers every piece type and excludes reserve',()=>{
 assert.equal(compositionIssue(army(['k',...Array(8).fill('p'),'n','n','b','b','r','r','q'])).excess,0);
 for(const [type,normal] of [['n',2],['b',2],['r',2],['q',1]]){
  const pieces=army(['k',...Array(8).fill('p'),...Array(normal+1).fill(type)]);
  assert.equal(compositionIssue(pieces).excess,1);
  pieces.find(p=>p.type==='p').square=null;assert.equal(compositionIssue(pieces).excess,0);
 }
 assert.match(compositionError(army(['k',...Array(9).fill('p')])),/8 пешек/);
});
test('placement rejects without mutation; full-reserve exchange evaluates final composition',()=>{
 let run=fixture(),snapshot=structuredClone(run);
 assert.match(placementError(run,'new','c3'),/одну пешку/);
 assert.equal(placePiece(run,'new','c3'),run);assert.deepEqual(run,snapshot);
 run.army.push(...['b','r','q'].map((type,i)=>({id:'reserve'+i,type,paid:1,square:null,reserveSlot:i+1})));
 assert.equal(benchPiece(run,'p0'),run);
 const next=placePiece(run,'new','a2');
 assert.notEqual(next,run);assert.equal(compositionIssue(next.army).excess,0);
 assert.equal(next.army.find(p=>p.id==='p0').reserveSlot,0);
 assert.equal(next.army.filter(p=>!p.square).length,4);
 assert.equal(new Set(next.army.map(p=>p.id)).size,run.army.length);
});
test('buying does not apply deployment restriction or bypass reserve limits',()=>{
 let run=fixture();run.purchases=0;
 const next=buyRandomPiece(run);assert.equal(next.reserve,99);assert.equal(next.army.at(-1).square,null);
 run=next;while(run.army.filter(p=>!p.square).length<4)run=buyRandomPiece(run);
 assert.equal(buyRandomPiece(run),run);
});
test('old incompatible inventory survives loading and repairs incrementally',()=>{
 let run=createAutoRun('legacy-composition');run.level=10;run.round=51;run.purchases=15;run.nextId=16;run.reserve=384;
 run.results=Array.from({length:50},(_,i)=>({outcome:'draw',incomeRule:2,shopLevel:10,battleId:run.id+':'+(i+1)}));
 run.army=[{id:'king',type:'k',square:run.color==='w'?'e1':'e8'},...Array.from({length:15},(_,i)=>({id:'piece-'+(i+1),type:'p',paid:i+1,square:'abcdefgh'[i%8]+(run.color==='w'?2+Math.floor(i/8):7-Math.floor(i/8))}))];
 const restored=restoreAutoRun(JSON.stringify(run));assert.deepEqual(restored,run);assert.equal(beginBattle(restored),restored);
 const benched=benchPiece(restored,'piece-1');assert.equal(benched.army.length,16);assert.equal(compositionIssue(benched.army).excess,6);
});
test('all four previously rejected FENs are diagnosed before creating the engine',async()=>{
 const fens=['1nnnk1b1/ppb2bpp/2bp1n2/8/8/3PNNB1/PPNB2PP/2NNK1R1','nnbn1n2/1bbkppbp/4n3/8/8/3BPN2/BPPN2PP/RRNNNK1R','1nbrk1n1/bppq2pp/r3rnb1/8/8/1N1N1N2/PBBB2PB/NBBRK1N1','2brkrn1/pnpb2pp/1r1rqnb1/8/8/3NPNB1/PBR2BPP/NBB1KRB1'];
 for(const field of fens){
  const fen=field+' w - - 0 1';assert.ok(positionCompositionError(fen));
  let run={...fixture(),phase:'paused',battle:{initialFen:fen,moves:[],elapsed:0}},error='';
  const controller=createBattleController({getRun:()=>run,save:next=>{run=next;return true;},onChange:()=>{},onError:text=>{error=text;},engineFactory:()=>assert.fail('must not allocate worker')});
  await controller.start();assert.ok(error);assert.equal(run.phase,'paused');assert.equal(run.battle.initialFen,fen);controller.dispose();
 }
});
test('bot repairs legacy composition with accounted refunds and keeps developing',()=>{
 const pieces=army(['k',...Array(15).fill('p')]);
 const progress={strategy:1,reserve:60,level:10,purchases:15,sales:0,income:0,openingBalance:279};
 const repaired=repairOpponentComposition({...fixture(),opponent:pieces,opponentProgress:progress});
 assert.equal(compositionIssue(repaired.opponent).excess,0);
 assert.equal(repaired.opponentProgress.reserve,progress.reserve+repaired.opponentProgress.sales);
 const next=planOpponent(pieces,progress,'composition-bot','b');
 assert.equal(compositionIssue(next.army).excess,0);assert.ok(next.army.every(p=>p.square));
 assert.ok(next.progress.purchases>15);assert.ok(next.army.some(p=>!['k','p'].includes(p.type)));
 assert.equal(next.progress.reserve,279+next.progress.sales-next.progress.purchases*(next.progress.purchases+1)/2-99);
});
test('engine unsupported-position response rejects immediately with composition message',async()=>{
 const worker={postMessage:()=>{},terminate:()=>{}};
 const engine=createAutoplayEngine(()=>worker);worker.onmessage({data:'readyok'});await engine.ready;
 const search=engine.search('fen',[]);worker.onmessage({data:'info string CRITICAL ERROR: Unsupported position. Too many pieces for WHITE.'});
 await assert.rejects(search,/Состав или расстановка/);
});
