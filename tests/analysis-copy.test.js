import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisInsight,insightLines} from '../dist/ui/components/analysis-insight.js';
import {qualityLabel} from '../dist/analysis/analysis-explanations.js';
import {variationArrowPoints} from '../dist/ui/pages/analysis.js';

const line={move:'g1f3',san:'Nf3',pvSan:['Nf3','Nc6'],expectedScorePlayer:.47};
const move={actor:'player',status:'complete',playedSan:'Nf3',quality:'best',highlight:null,reason:'generic',expectedScoreLoss:0,bestLine:line,playedLine:line,alternatives:[],autoPause:false};
test('verified mate-in-two displays the recommended full line without calling retained win an error',()=>{
 const best={move:'d8a5',san:'Qa5+',pvSan:['Qa5+','Kd3','Qc3#']};
 const html=analysisInsight({...move,reason:'mate_opportunity',shortMate:{moves:2,verified:true},recommendationRequired:true,bestLine:best});
 assert.match(html,/Матовая возможность/);assert.match(html,/мат в два хода/);assert.match(html,/Qa5\+ Kd3 Qc3#/);
 assert.match(html,/data-analysis-line="d8a5"/);assert.match(html,/data-variation-next/);assert.doesNotMatch(html,/Ошибка|не сохраняет/);
});

test('Opponent insight contains only the move, without repeated scope instructions',()=>{
 const html=analysisInsight({...move,actor:'opponent'});
 assert.match(html,/Ход соперника/);
 assert.doesNotMatch(html,/В разборе оцениваются ваши решения/);
});

test('Ordinary best and good moves have neutral labels, including cached analyses',()=>{
 for(const quality of ['best','good']){
  const html=analysisInsight({...move,quality});
  assert.match(html,/Ваш ход/);
  assert.doesNotMatch(html,/Сильный ход|Отличный ход|Хороший ход|<p><\/p>/);
  assert.equal(qualityLabel[quality],'Ваш ход');
 }
});

test('Insight omits expected score percentages and engine attribution',()=>{
 const html=analysisInsight({...move,alternatives:[{...line,move:'d2d4',san:'d4'}]});
 assert.match(html,/Здесь есть несколько равноценных продолжений/);
 assert.doesNotMatch(html,/Ожидаемый результат|Вероятность победы|47%|движ[ок]/);
});

test('Significant excellent highlights and negative insights retain their meaning',()=>{
 assert.match(analysisInsight({...move,highlight:'excellent',reason:'only_move'}),/Отличный ход/);
 const mistake=analysisInsight({...move,quality:'mistake',expectedScoreLoss:.1,reason:'generic',recommendationRequired:true});
 assert.match(mistake,/Ошибка/);
 assert.match(mistake,/Вместо сыгранного хода/);
 assert.doesNotMatch(mistake,/Ожидаемый результат|Вероятность победы/);
});

test('Variation choices are selectable, deduplicated and unavailable for opponent moves',()=>{
 const selected={...move,alternatives:[line,{...line,move:'d2d4',san:'d4'}]};
 assert.deepEqual(insightLines(selected).map(row=>row.move),['g1f3','d2d4']);
 assert.match(analysisInsight(selected),/data-analysis-line="d2d4" aria-pressed="false"/);
 assert.match(analysisInsight(selected),/К сыгранному ходу/);
 assert.deepEqual(insightLines({...selected,actor:'opponent'}),[]);
 assert.deepEqual(insightLines({...selected,status:'unavailable'}),[]);
});

test('Recommended variation is first and arrow endpoints respect orientation and promotion',()=>{
 const best={...line,move:'d2d4',san:'d4'};
 assert.equal(insightLines({...move,quality:'mistake',recommendationRequired:true,bestLine:best,alternatives:[best]})[0],best);
 assert.deepEqual(variationArrowPoints('e2e4','w'),[4.5,6.5,4.5,4.5]);
 assert.deepEqual(variationArrowPoints('e2e4','b'),[3.5,1.5,3.5,3.5]);
 assert.deepEqual(variationArrowPoints('e7e8q','w'),[4.5,1.5,4.5,.5]);
 assert.deepEqual(variationArrowPoints('e1g1','w'),[4.5,7.5,6.5,7.5]);
 assert.equal(variationArrowPoints('<bad>'),null);
});
