import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate} from '../scripts/simulation/simulate.mjs';
import {DIFFICULTY as C} from '../dist/difficulty-config.js';
test('Уменьшенный бюджет сохраняет варианты и порядок силы по независимым оценкам',()=>{
 const data=JSON.parse(readFileSync(new URL('../docs/ai/results/search-budget.json',import.meta.url)));
 const selected=data.find(r=>r.budget.nodes===C.analysisNodes&&r.budget.depth===C.analysisDepth);
 assert.ok(selected);assert.equal(selected.budget.multiPv,C.multiPv);
 for(const p of selected.positions)assert.equal(p.candidates.length,Math.min(C.multiPv,p.context.legalCount));
 for(const seed of [20260912,7,91]){
  let previous=Infinity;
  for(const elo of [400,474,600,800,1000,1200,1400,1600]){
   const rows=selected.positions.map(position=>simulate({position,botElo:elo,seed,iterations:1000}));
   const loss=rows.reduce((n,r)=>n+r.referenceLoss,0)/rows.length;
   assert.ok(loss<previous-.001,`Elo ${elo}, seed ${seed}`);previous=loss;
  }
 }
});
