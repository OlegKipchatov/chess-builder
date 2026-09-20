import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {CONFIG} from '../dist/cognitive-config.js';
import {capabilitiesFor,createSession,detectionProbability,factsFor,perceive,seededRandom,targetFor,validCognitiveProfile} from '../dist/cognitive-model.js';
import {decide} from '../dist/cognitive-search.js';
import {profileAdjustment} from '../dist/cognitive-profile.js';

const playDecision=(fen,options={})=>{const result=decide({fen,seed:42,...options}),game=new Chess(fen);if(result.move)assert.ok(game.move({from:result.move.slice(0,2),to:result.move.slice(2,4),promotion:result.move[4]}));return result;};

test('Контрольные Elo интерполируются непрерывно и сохраняют заданные границы',()=>{
 assert.equal(capabilitiesFor(100).threatAwareness,.05);assert.equal(capabilitiesFor(1400).calculationDepth,5.2);
 assert.ok(capabilitiesFor(750).threatAwareness>capabilitiesFor(700).threatAwareness);assert.ok(capabilitiesFor(750).threatAwareness<capabilitiesFor(800).threatAwareness);
 assert.throws(()=>capabilitiesFor(NaN),RangeError);
});
test('Сессия фиксирует seed, variance, персонажа и native-границу',()=>{
 const a=createSession(1000,seededRandom(7),'tricky'),b=createSession(1000,seededRandom(7),'tricky');assert.deepEqual(a,b);assert.equal(a.targetElo,900);assert.equal(a.mode,'cognitive');assert.ok(validCognitiveProfile(a));
 const native=createSession(1500,5,'solid',{disableVariance:true});assert.equal(native.targetElo,1400);assert.equal(native.effectiveElo,1400);assert.equal(native.mode,'native');assert.ok(validCognitiveProfile(native));
 assert.equal(targetFor(100),100);assert.equal(targetFor(2400),1400);
});
test('Очевидность и Elo повышают вероятность заметить угрозу, перегрузка снижает её',()=>{
 assert.ok(detectionProbability(.4,600,.9,0)>detectionProbability(.4,600,.2,0));
 assert.ok(detectionProbability(.96,1400,.9,0)>detectionProbability(.4,600,.9,0));
 assert.ok(detectionProbability(.75,900,.5,.8)<detectionProbability(.75,900,.5,0));
});
test('Восприятие угроз воспроизводимо для позиции и seed',()=>{
 const game=new Chess('4k3/8/8/3r4/3Q4/8/8/4K3 b - - 0 1'),facts=factsFor(game),caps=capabilitiesFor(600);
 assert.deepEqual(perceive(facts,caps,12,game.fen(),600),perceive(facts,caps,12,game.fen(),600));assert.ok(facts.threats.some(row=>row.square==='d4'));
});
test('Решение воспроизводимо, законно за обе стороны и не принимает objective evaluation',()=>{
 for(const fen of [new Chess().fen(),'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2']){
  const a=playDecision(fen,{elo:800,profile:'aggressive'}),b=decide({fen,elo:800,seed:42,profile:'aggressive',objectiveEvaluation:999,referenceCandidates:[{move:'a1a8'}]});assert.equal(a.move,b.move);
 }
});
test('Мат в один выбирается как понятная идея на всей шкале',()=>{
 const fen='7k/5K2/6Q1/8/8/8/8/8 w - - 0 1';for(const elo of [100,600,1000,1399]){const result=playDecision(fen,{elo});const game=new Chess(fen);game.move({from:result.move.slice(0,2),to:result.move.slice(2,4)});assert.equal(game.isCheckmate(),true,`${elo}: ${result.move}`);}
});
test('Технический поиск ограничен шестью корнями, 16 идеями и двумя полуходами',()=>{
 const result=playDecision(new Chess().fen(),{elo:1399});assert.ok(result.trace.rootCandidates<=CONFIG.rootIdeaLimit);assert.ok(result.trace.searchRoot<=CONFIG.searchRootLimit);assert.ok(result.trace.completedDepth<=CONFIG.technicalDepthCap);assert.ok(result.trace.nodes<=CONFIG.maxNodes);
});
test('После конца партии решения нет',()=>{assert.equal(decide({fen:'8/8/8/8/8/4k3/8/4K3 b - - 0 1',elo:800,seed:1}).move,null);});
test('Личность меняет только ограниченную субъективную поправку',()=>{
 const game=new Chess(),candidate={move:game.moves({verbose:true})[0]};for(const profile of ['aggressive','solid','positional','tricky'])assert.ok(Math.abs(profileAdjustment(game,candidate,profile))<=CONFIG.profile.maximumAdjustment);assert.equal(profileAdjustment(game,candidate,'default'),0);
});
test('Интерактивный расчёт остаётся в локальном бюджете',()=>{
 const started=performance.now();for(let seed=0;seed<8;seed++)playDecision(new Chess().fen(),{elo:1399,seed});assert.ok(performance.now()-started<3000);
});
