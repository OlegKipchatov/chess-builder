import test from 'node:test';
import assert from 'node:assert/strict';
import {skillFor,targetFor,createDifficultyProfile,probabilitiesFor,qualityFor,selectCandidate,seededRandom,mateProbability} from '../dist/difficulty-model.js';
import {normalizeScore,parseInfo,completeCandidates,prepareCandidates} from '../dist/candidate-analysis.js';
import {Chess} from '../dist/chess.js';
import {DIFFICULTY} from '../dist/difficulty-config.js';
test('Облегчение повышает вероятность ошибок и пропуска мата на 15%, сохраняя пределы',()=>{
 const previous={...DIFFICULTY,errorMultiplier:1};
 for(const elo of [600,800,1000,1200,1400]){
  const before=probabilitiesFor(elo,{},previous),after=probabilitiesFor(elo);
  for(const quality of ['inaccuracy','mistake','blunder'])assert.ok(Math.abs(after[quality]/before[quality]-1.15)<1e-12);
  for(const distance of [1,2])assert.ok(Math.abs((1-mateProbability(distance,elo))/(1-mateProbability(distance,elo,previous))-1.15)<1e-10);
 }
 for(const elo of [400,1600]){
  const p=probabilitiesFor(elo,{complexity:1.5,phase:'endgame',bestEvaluation:5});
  assert.ok(Object.values(p).every(value=>value>=0&&value<=1));
  assert.ok(Math.abs(Object.values(p).reduce((a,b)=>a+b,0)-1)<1e-12);
 }
});
const candidates=[0,.2,.5,1.2,2.2].map((evaluationLoss,i)=>({move:String(i),evaluationLoss,evaluation:-evaluationLoss}));
test('Непрерывный skill, clamp, target и фиксируемая variance',()=>{
 assert.equal(skillFor(100),0);assert.equal(skillFor(2000),1);assert.equal(targetFor(1000),900);
 let previous=-1;for(let elo=400;elo<=1600;elo++){assert.ok(skillFor(elo)>=previous);previous=skillFor(elo);}
 assert.deepEqual(createDifficultyProfile(1000,seededRandom(1)),createDifficultyProfile(1000,seededRandom(1)));
});
test('Вероятности нормализованы и монотонны при фиксированном контексте',()=>{
 let previous=probabilitiesFor(400);
 for(let elo=401;elo<=1600;elo++){
  const p=probabilitiesFor(elo);assert.ok(Math.abs(Object.values(p).reduce((a,b)=>a+b,0)-1)<1e-12);
  assert.ok(p.blunder<=previous.blunder);assert.ok(p.mistake<=previous.mistake);assert.ok(p.best+p.good>=previous.best+previous.good-1e-12);previous=p;
 }
});
test('CP и mate приводятся к перспективе бота, включая чёрных',()=>{
 assert.equal(normalizeScore('cp',40,'w','w'),.4);assert.equal(normalizeScore('cp',40,'b','b'),.4);
 assert.equal(normalizeScore('cp',-40,'b','b'),-.4);assert.equal(normalizeScore('cp',40,'w','b'),-.4);
 assert.ok(normalizeScore('mate',2,'b','b')>50);assert.ok(normalizeScore('mate',-2,'b','b')< -50);
 assert.ok(normalizeScore('mate',1,'w','w')>normalizeScore('mate',2,'w','w'));
 assert.ok(normalizeScore('mate',-5,'w','w')>normalizeScore('mate',-1,'w','w'));
});
test('Категории имеют точные границы',()=>{
 assert.deepEqual([0,.149,.15,.399,.4,.899,.9,1.799,1.8].map(x=>qualityFor(x)),['best','best','good','good','inaccuracy','inaccuracy','mistake','mistake','blunder']);
});
test('Seed воспроизводим, fallback только к более сильному оценённому ходу',()=>{
 const first=seededRandom(5),second=seededRandom(5);
 for(let i=0;i<100;i++)assert.deepEqual(selectCandidate(candidates,600,{},first),selectCandidate(candidates,600,{},second));
 assert.equal(selectCandidate(candidates.slice(0,2),400,{},()=>.999).move,'1');
 assert.throws(()=>selectCandidate([],400));
});
test('Modifiers усиливают ошибки в сложной позиции и эндшпиле, преимущество не делает бота идеальным',()=>{
 const base=probabilitiesFor(600),opening=probabilitiesFor(600,{phase:'opening'}),ending=probabilitiesFor(600,{phase:'endgame'});
 assert.ok(opening.mistake<base.mistake);assert.ok(ending.mistake>base.mistake);
 assert.ok(probabilitiesFor(600,{complexity:1.5}).blunder>base.blunder);
 assert.ok(probabilitiesFor(600,{bestEvaluation:5}).blunder>base.blunder);
});
test('Parser отвергает bounds и берёт только полный общий depth',()=>{
 assert.equal(parseInfo('info depth 4 score cp 10 lowerbound pv e2e4'),null);
 const rows=['info depth 4 multipv 1 score cp 20 pv e2e4','info depth 4 multipv 2 score cp 10 pv d2d4','info depth 5 multipv 1 score cp 30 pv e2e4'].map(parseInfo);
 assert.equal(completeCandidates(rows,2)[0].depth,4);
 const prepared=prepareCandidates(new Chess(),[...rows,{move:'e2e5',scoreType:'cp',scoreValue:999,depth:4}]);
 assert.ok(prepared.candidates.every(c=>c.move!=='e2e5'));
});
test('Один легальный ход всегда выбран; частота распознавания мата растёт',()=>{
 assert.equal(selectCandidate([candidates[0]],400).move,'0');
 for(const distance of [1,2])assert.ok(mateProbability(distance,1400)>mateProbability(distance,600));
});
test('Защита от пустой категории не заставляет отдавать ферзя',()=>{
 const pool=[{move:'safe',evaluationLoss:0,guardWeight:1},{move:'queen-drop',evaluationLoss:7,guardWeight:.15}];
 const rng=seededRandom(9);let drops=0;
 for(let i=0;i<10000;i++)drops+=selectCandidate(pool,400,{},rng).move==='queen-drop'?1:0;
 assert.ok(drops<400);assert.ok(drops>0);
});
test('Смешанные повторные PV одной глубины не образуют ложный комплект',()=>{
 const row=(index,move)=>({depth:5,index,move});
 const result=completeCandidates([row(1,'e2e4'),row(2,'d2d4'),row(1,'d2d4'),row(2,'d2d4')],2);
 assert.deepEqual(result.map(r=>r.move),['e2e4','d2d4']);
});
