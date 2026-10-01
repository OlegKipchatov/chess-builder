import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisInsight,insightLines} from '../dist/ui/components/analysis-insight.js';
import {variationArrowPoints,analysisPage} from '../dist/ui/pages/analysis.js';
const line={move:'g1f3',san:'Nf3',pvSan:['Nf3','Nc6'],expectedScorePlayer:.47};
const move={actor:'player',status:'complete',playedMove:'g1f3',playedSan:'Nf3',quality:'best',highlight:null,reason:'generic',expectedScoreLoss:0,bestLine:line,playedLine:line,alternatives:[]};
test('Routine and opponent moves have no insight or choices',()=>{
 for(const row of [null,move,{...move,quality:'good'},{...move,actor:'opponent'},{...move,forced:true,highlight:'excellent'}]){
  assert.equal(analysisInsight(row),'');assert.deepEqual(insightLines(row),[]);
 }
});
test('Only one useful alternative is offered, never the move already played',()=>{
 const best={...line,move:'d2d4',san:'d4'};
 const mistake={...move,quality:'mistake',expectedScoreLoss:.1,bestLine:best,alternatives:[best,{...line,move:'c2c4'}]};
 assert.deepEqual(insightLines(mistake),[best]);assert.equal((analysisInsight(mistake).match(/data-analysis-line=/g)||[]).length,1);
 assert.deepEqual(insightLines({...mistake,bestLine:line}),[]);
 assert.match(analysisInsight(mistake),/Ошибка/);assert.doesNotMatch(analysisInsight(mistake),/Ваш ход|Ход соперника|Также:|Ожидаемый результат/);
});
test('Mate challenge does not disclose the solution until requested',()=>{
 const best={move:'d8a5',san:'Qa5+',pvSan:['Qa5+','Kd3','Qc3#']};
 const html=analysisInsight({...move,reason:'mate_opportunity',shortMate:{moves:2,verified:true},exercise:{},bestLine:best});
 assert.match(html,/Найти мат самостоятельно/);assert.match(html,/Показать решение/);assert.match(html,/мат в два хода/);
 assert.doesNotMatch(html,/Qa5|Qc3|Ошибка/);
});
test('Meaningful positives remain without redundant played-move alternatives',()=>{
 assert.match(analysisInsight({...move,highlight:'excellent',reason:'only_move'}),/Отличный ход/);
 assert.deepEqual(insightLines({...move,highlight:'excellent'}),[]);
});
test('Variation controls are next to board, not inside insight; orientation and promotion preserved',()=>{
 const html=analysisPage();assert.ok(html.indexOf('data-variation-next')<html.indexOf('id="analysis-insight"'));
 assert.deepEqual(variationArrowPoints('e2e4','w'),[4.5,6.5,4.5,4.5]);
 assert.deepEqual(variationArrowPoints('e2e4','b'),[3.5,1.5,3.5,3.5]);
 assert.deepEqual(variationArrowPoints('e7e8q','w'),[4.5,1.5,4.5,.5]);
 assert.equal(variationArrowPoints('<bad>'),null);
});
