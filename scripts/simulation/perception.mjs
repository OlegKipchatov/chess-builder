import {readFileSync,writeFileSync} from 'node:fs';
import {selectCandidate as previousSelector} from './fixtures/selector-v18.mjs';
import {selectCandidate,hiddenCandidates} from '../../dist/difficulty-model.js';
import {DIFFICULTY} from '../../dist/difficulty-config.js';
import {simulate} from './simulate.mjs';
export const comparePerception=(positions,elo,iterations=3000,seed=20260912)=>{
 const measure=selector=>positions.map(position=>simulate({position,botElo:elo,iterations,seed,selector}));
 const summarize=rows=>{
  const cp=rows.filter((r,i)=>positions[i].candidates.every(c=>c.mate===null)&&positions[i].reference.candidates.every(c=>c.mate===null));
  return {loss:rows.reduce((n,r)=>n+r.referenceLoss,0)/rows.length,cpLoss:cp.reduce((n,r)=>n+r.referenceLoss,0)/cp.length,bestGood:rows.reduce((n,r)=>n+r.counts.best+r.counts.good,0)/(rows.length*iterations),guarded:rows.reduce((n,r)=>n+r.guarded,0)/rows.length};
 };
 const before=measure(previousSelector),after=measure(selectCandidate);
 return {elo,before:summarize(before),after:summarize(after),details:positions.map((p,i)=>({id:p.id,hidden:hiddenCandidates(p.candidates).map(c=>({move:c.move,shallowLoss:c.shallowLoss,deepLoss:c.evaluationLoss,before:before[i].moves[c.move]||0,after:after[i].moves[c.move]||0})),before:before[i],after:after[i]}))};
};
if(process.argv[1]?.endsWith('/perception.mjs')){
 const positions=JSON.parse(readFileSync('docs/ai/results/candidates.json')).positions;
 const rows=[400,474,600,800,1000,1200,1400,1600].map(elo=>comparePerception(positions,elo));
 writeFileSync('docs/ai/results/perception.json',JSON.stringify({seed:20260912,iterationsPerPosition:3000,configuration:DIFFICULTY,rows},null,2));
 console.table(rows.map(({elo,before,after})=>({elo,cpBefore:before.cpLoss,cpAfter:after.cpLoss,goodBefore:before.bestGood,goodAfter:after.bestGood,guarded:after.guarded})));
}
