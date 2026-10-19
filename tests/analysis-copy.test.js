import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisInsight} from './helpers/react-markup.js';
import {insightLines,visibleVariation} from '../src/domain/analysis/presentation.ts';
import {isImportantInsight} from '../src/domain/analysis/analysis-events.ts';
import {selectEvents} from '../src/domain/analysis/analysis-events.ts';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MoveNavigation} from '../src/features/game-review/MoveNavigation.tsx';
import {variationArrowPoints} from '../src/features/chessboard/model.ts';
import {explanationFor} from '../src/domain/analysis/analysis-explanations.ts';
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
 assert.deepEqual(visibleVariation({...move,bestLine,reason:'mate_opportunity'},true).pv,['a','b','c']);
 assert.deepEqual(visibleVariation({...move,bestLine:{...bestLine,pvSan:['a','b','c','d']},reason:'missed_tactic'}).pv,['a']);
});
test('History slider covers initial and final position with accessible progress',()=>{
 const render=(cursor,total)=>renderToStaticMarkup(createElement(MoveNavigation,{cursor,total,onSeek:()=>{}}));
 assert.match(render(117,117),/value="117"/);assert.match(render(117,117),/--history-progress:100%/);
 assert.match(render(0,0),/disabled=""/);assert.match(render(0,0),/aria-valuetext="0 из 0"/);

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
test('Long mates are not proposed; four-move opportunities remain',()=>{
 for(const distance of [5,11,21,22]){
  const explanation=explanationFor({...move,reason:'mate_opportunity',bestLine:{...line,score:{type:'mate',value:distance}}});
  assert.doesNotMatch(explanation,/мат|при любой защите/);
 }
 const explanation=explanationFor({...move,reason:'mate_opportunity',bestLine:{...line,score:{type:'mate',value:4}}});
 assert.match(explanation,/Вы могли поставить мат в четыре хода/);
});
test('Missing or adverse mate scores never invent a distance or a retained advantage',()=>{
 for(const score of [undefined,{type:'cp',value:500},{type:'mate',value:-3},{type:'mate',value:0}]){
  const explanation=explanationFor({...move,reason:'missed_mate',bestLine:{...line,score}});
  assert.doesNotMatch(explanation,/мат при любой защите|упустили|снизили свои шансы/);
  assert.doesNotMatch(explanation,/мат в |сохранил преимущество|undefined/);
 }
});
test('Meaningful positives remain without redundant played-move alternatives',()=>{
 assert.match(analysisInsight({...move,highlight:'excellent',reason:'only_move'}),/Отличный ход/);
 assert.deepEqual(insightLines({...move,highlight:'excellent'}),[]);
});
test('Variation controls are next to board, not inside insight; orientation and promotion preserved',()=>{
 // Control placement is covered in tests/react/review.test.tsx against the mounted React tree.
 assert.deepEqual(variationArrowPoints('e2e4','w'),[4.5,6.5,4.5,4.5]);
 assert.deepEqual(variationArrowPoints('e2e4','b'),[3.5,1.5,3.5,3.5]);
 assert.deepEqual(variationArrowPoints('e7e8q','w'),[4.5,1.5,4.5,.5]);
 assert.equal(variationArrowPoints('<bad>'),null);
});

test('Five-move mate does not create a challenge or a positive-only stop',async()=>{
 const {detectReason}=await import('../src/domain/analysis/analysis-reasons.ts');
 const {prepareMateExercise}=await import('../src/services/analysis/analysis-training.ts');
 for(const distance of [4,5]){
  const row={...move,mateTransition:'missed_mate',bestLine:{...line,score:{type:'mate',value:distance}},shortMate:{verified:true,moves:distance}};
  row.reason=detectReason(row);
  assert.equal(row.reason,distance===4?'mate_opportunity':'generic');
  assert.equal(isImportantInsight(row),distance===4);
  if(distance===5){
   assert.equal(await prepareMateExercise(row),null);
   const mistake={...row,quality:'blunder'};
   assert.equal(isImportantInsight(mistake),true);
   assert.doesNotMatch(explanationFor(mistake),/мат/);
  }
 }
});
