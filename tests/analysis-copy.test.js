import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisInsight,insightLines,visibleVariation,isImportantInsight} from '../dist/ui/components/analysis-insight.js';
import {selectEvents} from '../dist/analysis/analysis-events.js';
import {syncHistorySlider,moveNavigation} from '../dist/ui/components/move-navigation.js';
import {playPage as analysisPage} from '../dist/ui/pages/play.js';
import {variationArrowPoints} from '../dist/ui/pages/analysis.js';
const line={move:'g1f3',san:'Nf3',pvSan:['Nf3','Nc6'],expectedScorePlayer:.47};
const move={actor:'player',status:'complete',playedMove:'g1f3',playedSan:'Nf3',quality:'best',highlight:null,reason:'generic',expectedScoreLoss:0,bestLine:line,playedLine:line,alternatives:[]};
test('Cards and autoplay pauses share the same definition of importance',()=>{
 const rows=['best','good','inaccuracy','mistake','blunder'].map((quality,i)=>({...move,quality,ply:i+1}));
 rows.push({...move,highlight:'excellent',ply:6},{...move,reason:'mate_opportunity',ply:7});
 assert.deepEqual(selectEvents(rows),rows.filter(isImportantInsight).map(row=>row.ply));
 rows.forEach(row=>assert.equal(!!analysisInsight(row),row.autoPause));
});
test('Ordinary recommendations show one move; mate sequence stops at checkmate',()=>{
 const bestLine={...line,pv:['a','b','c','d'],pvSan:['Qa5+','Kd3','Qc3#','extra']};
 assert.deepEqual(visibleVariation({...move,bestLine}).pv,['a']);
 assert.deepEqual(visibleVariation({...move,bestLine,reason:'mate_opportunity'}).pv,['a','b','c']);
 assert.deepEqual(visibleVariation({...move,bestLine:{...bestLine,pvSan:['a','b','c','d']},reason:'missed_tactic'}).pv,['a','b','c','d']);
});
test('History slider covers initial and final position with accessible progress',()=>{
 const attrs={},slider={setAttribute:(key,value)=>attrs[key]=value,style:{setProperty:(key,value)=>attrs[key]=value}};
 syncHistorySlider(slider,117,117);assert.equal(slider.value,'117');assert.equal(attrs['--history-progress'],'100%');
 syncHistorySlider(slider,0,0);assert.equal(slider.disabled,true);assert.equal(attrs['aria-valuetext'],'0 из 0');
 assert.match(moveNavigation('analysis-'),/id="analysis-history-slider"/);
});
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
 assert.match(html,/Найти мат/);assert.doesNotMatch(html,/data-analysis-line|Показать решение/);assert.match(html,/мат в два хода/);
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
