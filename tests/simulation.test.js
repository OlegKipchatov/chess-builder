import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate} from '../scripts/simulation/simulate.mjs';
const fixtures=JSON.parse(readFileSync(new URL('../docs/ai/results/candidates.json',import.meta.url))).positions;
test('Реальные MultiPV fixtures: loss и серьёзные ошибки снижаются на всей шкале для трёх seed',()=>{
 for(const seed of [20260912,7,91]){
  let previous=null;
  for(const botElo of [400,600,800,1000,1200,1400,1600]){
   const rows=fixtures.map(position=>simulate({position,botElo,iterations:1000,seed}));
   const loss=rows.reduce((n,r)=>n+r.averageEvaluationLoss,0)/rows.length,reference=rows.reduce((n,r)=>n+r.referenceLoss,0)/rows.length;
   const rate=quality=>rows.reduce((n,r)=>n+r.counts[quality],0)/(1000*rows.length);
   const cpRows=rows.filter(row=>{const p=fixtures.find(p=>p.id===row.position);return p.candidates.every(c=>c.mate===null)&&p.reference.candidates.every(c=>c.mate===null);});
   const cpLoss=cpRows.reduce((n,r)=>n+r.referenceLoss,0)/cpRows.length;
   const good=rate('best')+rate('good'),mistake=rate('mistake'),blunder=rate('blunder');
   if(previous){assert.ok(cpLoss<previous.cpLoss-.001);assert.ok(loss<previous.loss-.001);assert.ok(reference<previous.reference-.001);assert.ok(good>=previous.good-.003);assert.ok(mistake<=previous.mistake+.003);assert.ok(blunder<=previous.blunder+.0015);}
   if(botElo===600)assert.ok(good<.75,'Слабый бот слишком близок к идеальному');
   previous={loss,reference,good,mistake,blunder,cpLoss};
  }
 }
});
