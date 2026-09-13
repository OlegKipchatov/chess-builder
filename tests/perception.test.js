import test from 'node:test';
import assert from 'node:assert/strict';
import {attachPerception} from '../dist/candidate-analysis.js';
import {selectCandidate,hiddenCandidates,seededRandom} from '../dist/difficulty-model.js';
import {DIFFICULTY} from '../dist/difficulty-config.js';
import {readFileSync} from 'node:fs';
import {comparePerception} from '../scripts/simulation/perception.mjs';
test('Реальные ранние оценки увеличивают пропуски скрытых продолжений, матовый fallback не доминирует',()=>{
 const positions=JSON.parse(readFileSync(new URL('../docs/ai/results/candidates.json',import.meta.url))).positions;
 for(const seed of [20260912,7,91]){
  const result=comparePerception(positions,474,3000,seed);
  for(const id of ['several-good','pinned-defender']){
   const detail=result.details.find(p=>p.id===id);
   assert.ok(detail.hidden.length>0);assert.ok(detail.hidden.reduce((n,c)=>n+c.after,0)>detail.hidden.reduce((n,c)=>n+c.before,0));
  }
  const mate=result.details.find(p=>p.id==='black-tactical');
  assert.ok((mate.after.moves.h7h5||0)<(mate.before.moves.h7h5||0)*.3);
  assert.ok(result.after.guarded<.03);
 }
});
test('Ранний CP-снимок сравнивается только с более глубокими совпадающими ходами',()=>{
 const analysis={candidates:[{move:'a',mate:null,depth:10},{move:'b',mate:null,depth:10},{move:'c',mate:2,depth:10}]};
 attachPerception(analysis,[{move:'a',scoreType:'cp',scoreValue:30,depth:2},{move:'b',scoreType:'cp',scoreValue:10,depth:2}]);
 assert.equal(analysis.candidates[0].shallowLoss,0);assert.ok(Math.abs(analysis.candidates[1].shallowLoss-.2)<1e-12);
 assert.equal(analysis.candidates[2].shallowLoss,undefined);
 const incomplete={candidates:[{move:'a',mate:null,depth:2}]};
 attachPerception(incomplete,[{move:'a',scoreType:'cp',scoreValue:30,depth:2}]);assert.equal(incomplete.candidates[0].shallowLoss,undefined);
});
test('Невидимая тактика: только внешне хорошие варианты, без прямой отдачи крупной фигуры',()=>{
 const base={move:'a',mate:null,evaluationLoss:1,shallowLoss:.1,guardWeight:1};
 const pool=[base,{...base,move:'obvious',shallowLoss:2},{...base,move:'queen',guardWeight:.15},{...base,move:'catastrophe',evaluationLoss:8}];
 assert.deepEqual(hiddenCandidates(pool),[base]);
 const config={...DIFFICULTY,perception:{...DIFFICULTY.perception,maxRate:1}};
 assert.equal(selectCandidate([{...base,move:'best',evaluationLoss:0},base],400,{},()=>0,config).move,'a');
});
test('После пропуска мата не включается автоматический выбор лучшего нематующего хода',()=>{
 const pool=[{move:'mate',evaluation:99.9,evaluationLoss:0,mate:1},{move:'best-alternative',evaluation:2,evaluationLoss:97.9,mate:null},{move:'plausible',evaluation:1.5,evaluationLoss:98.4,mate:null}];
 const config={...DIFFICULTY,mate:{...DIFFICULTY.mate,one:{min:0,power:1}},errorMultiplier:1};
 const tickets=[.99,.5,.5];
 const chosen=selectCandidate(pool,400,{},()=>tickets.shift()??.5,config);
 assert.equal(chosen.move,'plausible');assert.equal(chosen.evaluationLoss,98.4);
 assert.equal(pool[2].evaluationLoss,98.4);
});
test('Пропуски матов и тактики воспроизводимы; отсутствующий ранний снимок безопасен',()=>{
 const pool=[{move:'a',mate:null,evaluation:0,evaluationLoss:0},{move:'b',mate:null,evaluation:-1,evaluationLoss:1}];
 const a=seededRandom(17),b=seededRandom(17);
 for(let i=0;i<100;i++)assert.equal(selectCandidate(pool,474,{},a).move,selectCandidate(pool,474,{},b).move);
 assert.equal(hiddenCandidates(pool).length,0);
});
