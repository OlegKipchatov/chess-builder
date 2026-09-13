import {readFileSync,writeFileSync} from 'node:fs';
import {DIFFICULTY} from '../../dist/difficulty-config.js';
import {simulate} from './simulate.mjs';
export const previousConfiguration={...DIFFICULTY,noviceErrors:{...DIFFICULTY.noviceErrors,maxBonus:0},temperature:{min:.5,gain:2.5,power:1},guard:{...DIFFICULTY.guard,noviceWeight:.15,noviceRescue:.60}};
export const compareSelection=(positions,elo,iterations=3000,seed=20260912)=>{
 const measure=config=>positions.map(position=>simulate({position,botElo:elo,iterations,seed,config}));
 const summarize=rows=>{
  const cpRows=rows.filter((row,index)=>positions[index].candidates.every(c=>c.mate===null)&&positions[index].reference.candidates.every(c=>c.mate===null));
  return {loss:rows.reduce((sum,r)=>sum+r.referenceLoss,0)/rows.length,cpLoss:cpRows.reduce((sum,r)=>sum+r.referenceLoss,0)/cpRows.length,guardedRate:rows.reduce((sum,r)=>sum+r.guarded,0)/rows.length,bestGood:rows.reduce((sum,r)=>sum+r.counts.best+r.counts.good,0)/(iterations*rows.length)};
 };
 return {elo,before:summarize(measure(previousConfiguration)),after:summarize(measure(DIFFICULTY))};
};
if(process.argv[1]?.endsWith('/novice-selection.mjs')){
 const positions=JSON.parse(readFileSync('docs/ai/results/candidates.json')).positions;
 const rows=[400,600,800,1000,1200,1400,1600].map(elo=>compareSelection(positions,elo));
 writeFileSync('docs/ai/results/novice-selection.json',JSON.stringify({seed:20260912,choicesPerEloPerModel:positions.length*3000,beforeConfig:previousConfiguration,afterConfig:DIFFICULTY,rows},null,2));
 console.table(rows.map(r=>({elo:r.elo,cpBefore:r.before.cpLoss,cpAfter:r.after.cpLoss,goodBefore:r.before.bestGood,goodAfter:r.after.bestGood,guarded:r.after.guardedRate})));
}
