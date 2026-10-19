import test from 'node:test';
import assert from 'node:assert/strict';
import {positionEvaluation} from '../src/domain/analysis/position-evaluation.ts';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MoveNavigation} from '../src/features/game-review/MoveNavigation.tsx';
const row=(best,played)=>({status:'complete',bestLine:{score:best},playedLine:{score:played}});
const cp=value=>({type:'cp',value});
test('Evaluation uses player-normalized scores and compares the same decision',()=>{
 for(const playerColor of ['w','b']){
  const result=positionEvaluation({playerColor,moves:[row(cp(170),cp(120))]},1);
  assert.equal(result.value,'+1,2');assert.equal(result.change,'−0,5');
 }
 const result=positionEvaluation({moves:[row(cp(-70),cp(-120))]},1);
 assert.equal(result.value,'−1,2');assert.equal(result.change,'−0,5');
});
test('Initial and opponent positions do not reuse an unrelated delta',()=>{
 const analysis={moves:[{status:'skipped'},row(cp(170),cp(120))]};
 assert.equal(positionEvaluation(analysis,1).value,'+1,7');
 assert.equal(positionEvaluation(analysis,1).change,'—');
 assert.equal(positionEvaluation({moves:[row(cp(0),cp(-2))]},0).value,'0,0');
 assert.equal(positionEvaluation(undefined,1).value,'—');
 assert.equal(positionEvaluation({moves:[row(cp(NaN),cp(Infinity))]},1).change,'—');
});
test('Mate never gets subtracted from a pawn evaluation',()=>{
 for(const value of [-3,4]){
  const result=positionEvaluation({moves:[row(cp(900),{type:'mate',value})]},1);
  assert.equal(result.value,value<0?'−M3':'+M3');assert.equal(result.change,'—');
 }
});
test('Navigation renders evaluation beside the count only when provided',()=>{
 const props={cursor:3,total:127,onSeek:()=>{}};
 const evaluation=positionEvaluation({moves:[row(cp(170),cp(120))]},1);
 const html=renderToStaticMarkup(createElement(MoveNavigation,{...props,evaluation}));
 assert.doesNotMatch(html,/>Перевес|Δ /);assert.match(html,/>−0,5</);assert.match(html,/\+1,2/);
 assert.match(html,/3\/127/);
 assert.doesNotMatch(renderToStaticMarkup(createElement(MoveNavigation,props)),/Перевес/);
});

test('Opponent gain and rounded totals have matching changes',()=>{
 const analysis={moves:[row(cp(170),cp(120)),{status:'skipped'},row(cp(230),cp(230))]};
 assert.equal(positionEvaluation(analysis,2).value,'+2,3');
 assert.equal(positionEvaluation(analysis,2).change,'+1,1');
 assert.equal(positionEvaluation(analysis,3).change,'0,0');
 const rounded={moves:[row(cp(124),cp(126))]};
 assert.equal(positionEvaluation(rounded,1).change,'+0,1');
 assert.equal(positionEvaluation(rounded,0).change,'—');
});
