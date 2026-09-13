import {readFileSync,writeFileSync} from 'node:fs';
import {DIFFICULTY} from '../../dist/difficulty-config.js';
import {simulate} from './simulate.mjs';
const positions=JSON.parse(readFileSync('docs/ai/results/candidates.json')).positions;
const measure=(botElo,config)=>positions.map(position=>simulate({position,botElo,iterations:3000,config}));
const summarize=rows=>({
 loss:rows.reduce((sum,r)=>sum+r.referenceLoss,0)/rows.length,
 guardedRate:rows.reduce((sum,r)=>sum+r.guarded,0)/rows.length
});
const rows=[400,600,800,1000,1200,1400,1600].map(elo=>{
 const before=summarize(measure(elo,{...DIFFICULTY,errorMultiplier:1}));
 const after=summarize(measure(elo,DIFFICULTY));
 return {elo,before,after,lossIncreasePercent:100*(after.loss/before.loss-1)};
});
writeFileSync('docs/ai/results/softening.json',JSON.stringify({seed:20260912,choicesPerEloPerModel:positions.length*3000,errorMultiplier:DIFFICULTY.errorMultiplier,rows},null,2));
console.table(rows.map(r=>({elo:r.elo,before:r.before.loss,after:r.after.loss,increase:r.lossIncreasePercent})));
