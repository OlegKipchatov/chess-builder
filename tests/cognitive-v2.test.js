import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess} from '../dist/chess.js';
import {CONFIG} from '../dist/cognitive-config.js';
import {capabilitiesFor,createSession,decisionModeFor,detectionProbability,factsFor,threatsFor,perceive,random,errorQuality,classifyError} from '../dist/cognitive-model.js';
import {decide,leafValue} from '../dist/cognitive-search.js';
test('Cognitive v2: leaf check evaluation depends on the board, not replayed history',()=>{
 const game=new Chess();for(const san of ['e4','f6','Qh5+'])game.move(san);
 const restored=new Chess(game.fen()),caps=capabilitiesFor(1400),view={noticed:[],tactics:true,position:false};
 const score=leafValue(game,'w',view,caps,42,game.fen());
 assert.equal(leafValue(restored,'w',view,caps,42,game.fen()),score);
});
test('Cognitive v2: strong observer does not assume the opponent will choose suicidal checks',()=>{
 const fen='r1b1kbnr/pppp1ppp/8/4N1q1/2BnP3/8/PPPP1PPP/RNBQK2R w KQkq - 1 5';
 const result=decide({fen,elo:1400,seed:20260915});
 assert.equal(result.move,'c4f7');
 assert.equal(result.trace.completedDepth,2);
 assert.equal(result.trace.cut,false);
});
test('Cognitive v2: every selectable root is searched at the same completed depth',()=>{
 const args={fen:new Chess().fen(),elo:1200,seed:42};
 const full=decide(args),limited=decide({...args,maxNodes:1}),staticResult=decide({...args,maxDepth:0});
 assert.equal(full.trace.rootCandidates,full.trace.searchRoot);
 assert.ok(full.trace.completedDepth>0);
 assert.equal(limited.trace.completedDepth,0);
 assert.equal(limited.trace.cut,true);
 assert.deepEqual(limited.trace.candidates,staticResult.trace.candidates);
 assert.equal(limited.move,staticResult.move);
});
test('Cognitive v2: isolated king still has explainable moves against a large army',()=>{
 const fen='4k3/2Q5/p7/N5R1/1P1N2R1/8/3KP2P/5B2 b - - 0 33';
 for(const elo of [100,600,800,1400]){
  const result=decide({fen,elo,seed:20260915}),game=new Chess(fen);
  assert.ok(game.move({from:result.move.slice(0,2),to:result.move.slice(2,4)}));
  assert.ok(result.trace.candidates.every(candidate=>candidate.reasons.includes('forced-king-manoeuvre')));
 }
});
test('Cognitive v2: continuous capabilities, boundary clamp, fixed session variance',()=>{
 for(const key of Object.keys(capabilitiesFor(100)).filter(k=>k!=='elo')){
  let previous=-Infinity;for(let elo=100;elo<=1400;elo++){const value=capabilitiesFor(elo)[key];assert.ok(value>=previous);previous=value;}
  assert.ok(Math.abs(capabilitiesFor(750)[key]-(capabilitiesFor(700)[key]+capabilitiesFor(800)[key])/2)<1e-9);
 }
 assert.equal(capabilitiesFor(0).elo,100);assert.equal(capabilitiesFor(2000).elo,1400);assert.throws(()=>capabilitiesFor(NaN));
 assert.equal(decisionModeFor(1399),'cognitive-v2');assert.equal(decisionModeFor(1400),'native-stockfish');
 assert.deepEqual(createSession(637,42),createSession(637,42));const p=createSession(637,42);assert.equal(p.targetElo,537);assert.ok(Math.abs(p.effectiveElo-p.targetElo)<=60);
 assert.equal(createSession(637,42,'aggressive').profile,'aggressive');assert.throws(()=>createSession(637,42,'unknown'),/Unknown/);
});
test('Cognitive v2: load reduces detection, salience protects obvious queen at 1400',()=>{
 const c=capabilitiesFor(1400);assert.ok(detectionProbability(c.threatAwareness,1400,1)>.99);
 assert.ok(detectionProbability(.4,600,.5,0)>detectionProbability(.4,600,.5,.5));
 assert.ok(detectionProbability(.4,600,1)>detectionProbability(.4,600,.5));
});
test('Cognitive v2: no objective dependencies, oracle poison cannot affect the decision',()=>{
 for(const name of ['config','model','search','profile'])assert.doesNotMatch(readFileSync(`dist/cognitive-${name}.js`,'utf8'),/from .*?(stockfish|difficulty-model|candidate-analysis)/);
 const args={fen:new Chess().fen(),elo:600,seed:42},a=decide(args);
 const poison=new Proxy({},{get:()=>{throw Error('Objective information read');}});
 assert.deepEqual(decide({...args,objectiveEvaluation:poison,candidates:poison,reference:poison}),a);
 assert.equal(a.trace.version,CONFIG.version);
});
test('Cognitive v2: both colors, check, mate, promotion and constrained fallback are legal',()=>{
 for(const fen of [new Chess().fen(),'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1','6k1/5ppp/8/8/8/8/7P/5r1K w - - 0 1','4k3/P7/8/8/8/8/8/4K3 w - - 0 1']){
  const game=new Chess(fen),result=decide({fen,elo:1000,seed:51,maxNodes:30});
  assert.ok(game.moves({verbose:true}).some(m=>m.from+m.to+(m.promotion||'')===result.move));
  assert.ok(result.trace.candidates.every(c=>c.reasons.length));assert.equal(game.fen(),fen);
 }
 assert.equal(decide({fen:'7k/6Q1/6K1/8/8/8/8/8 b - - 0 1',elo:100,seed:1}).move,null);
});
test('Cognitive v2: identical threat observations are stable, not sampled per root candidate',()=>{
 const facts=factsFor(new Chess('4k3/8/8/8/3r4/8/3Q4/4K3 w - - 0 1'));
 const c=capabilitiesFor(600);assert.deepEqual(perceive(facts,c,5,'position'),perceive(facts,c,5,'position'));
 let count=0;for(let seed=0;seed<10000;seed++)count+=random(seed,'example')<.4;assert.ok(count>3700&&count<4300);
});
test('Cognitive v2: PGN repetition is retained and conflicting FEN rejected',()=>{
 const game=new Chess();for(const move of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8'])game.move(move);
 assert.equal(decide({fen:game.fen(),pgn:game.pgn(),elo:600,seed:1}).move,null);
 assert.throws(()=>decide({fen:new Chess().fen(),pgn:game.pgn(),elo:600,seed:1}),/mismatch/);
});
test('Cognitive v2: an observed hanging queen changes the leaf belief without a deep oracle',()=>{
 const game=new Chess('4k3/8/8/3r4/3Q4/8/8/4K3 b - - 0 1'),key=game.fen(),facts=factsFor(game);
 const weak=capabilitiesFor(100),strong=capabilitiesFor(1400);
 const a=leafValue(game,'w',perceive(facts,weak,42,key),weak,42,key);
 const b=leafValue(game,'w',perceive(facts,strong,42,key),strong,42,key);
 assert.ok(a>300,'Material advantage appears safe to this low-Elo attention sample');
 assert.ok(b<0,'Detected queen threat overrides the apparent material advantage');
});
test('Cognitive v2: a king cannot threaten to capture a protected piece',()=>{
 const game=new Chess('r1b1kbnr/pppp1Bpp/8/4N1q1/3nP3/8/PPPP1PPP/RNBQK2R b KQkq - 0 5');
 assert.ok(game.attackers('f7','b').includes('e8'),'Raw geometric attacks include the king');
 assert.equal(threatsFor(game).some(t=>t.from==='e8'&&t.to==='f7'),false);
});
test('Cognitive v2: profiles only adjust visible candidates and stay seeded/legal',()=>{
 const args={fen:new Chess().fen(),elo:900,seed:91};
 for(const profile of ['aggressive','solid','positional','tricky']){
  const result=decide({...args,profile});
  assert.ok(result.trace.candidates.some(candidate=>candidate.move===result.move));
  assert.equal(result.trace.profile,profile);
  assert.ok(result.trace.candidates.every(candidate=>Number.isFinite(candidate.styleAdjustment)));
  assert.deepEqual(decide({...args,profile}),result);
 }
 assert.deepEqual(decide(args),decide({...args,profile:'default'}));
});
test('Cognitive v2: reporting quality and error causes never select a move',()=>{
 assert.deepEqual(['best','good','inaccuracy','mistake','blunder'],[0,15,20,70,180].map(errorQuality));
 const trace={oversight:false,missed:['q:e4'],load:.4,completedDepth:1,depth:3,position:false};
 assert.equal(classifyError({evaluationLoss:5,trace}),'none');
 assert.equal(classifyError({evaluationLoss:200,trace}),'mixed');
 assert.equal(classifyError({evaluationLoss:200,trace:{...trace,missed:[],load:0,completedDepth:3,depth:3}}),'evaluation');
 const args={fen:new Chess().fen(),elo:800,seed:10};assert.deepEqual(decide(args),decide({...args,objectiveEvaluation:{loss:999}}));
});
