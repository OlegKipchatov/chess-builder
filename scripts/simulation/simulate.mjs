import {readFileSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {selectCandidate,seededRandom,positionSeed,qualityFor} from '../../dist/difficulty-model.js';
export const simulate = ({position,fen,botElo,iterations=1000,seed=20260912,config}) => {
 position??=JSON.parse(readFileSync(new URL('../../docs/ai/results/candidates.json',import.meta.url))).positions.find(item=>item.fen===fen);
 if(!position)throw Error('Collect this FEN before simulating');
 if(!Number.isSafeInteger(iterations)||iterations<1)throw RangeError('iterations must be a positive integer');
 const rng=seededRandom(positionSeed(seed,position.fen)),counts={best:0,good:0,inaccuracy:0,mistake:0,blunder:0};
 const referenceCounts={...counts};let loss=0,referenceLoss=0,guarded=0,mates=0;
 const moves={};
 for(let i=0;i<iterations;i++){
  const candidate=selectCandidate(position.candidates,botElo,position.context,rng,config),reference=position.reference.candidates.find(c=>c.move===candidate.move);
  if(!reference)throw Error('Missing reference move '+candidate.move+' '+position.id);
  counts[qualityFor(candidate.evaluationLoss)]++;referenceCounts[qualityFor(reference.evaluationLoss)]++;
  loss+=candidate.evaluationLoss;referenceLoss+=reference.evaluationLoss;guarded+=candidate.guardWeight<1?1:0;mates+=candidate.mate===1?1:0;
  moves[candidate.move]=(moves[candidate.move]||0)+1;
 }
 return {elo:botElo,position:position.id,iterations,counts,referenceCounts,averageEvaluationLoss:loss/iterations,referenceLoss:referenceLoss/iterations,guarded:guarded/iterations,mateOne:mates/iterations,moves};
};
export const runSimulation = async () => {
 const data=JSON.parse(await readFile('docs/ai/results/candidates.json','utf8')),rows=[],details=[];
 for(const elo of [400,600,800,1000,1200,1400,1600]){
  const results=data.positions.map(position=>simulate({position,botElo:elo}));details.push(...results);
  const total=results.reduce((n,r)=>n+r.iterations,0),counts=Object.fromEntries(['best','good','inaccuracy','mistake','blunder'].map(q=>[q,results.reduce((n,r)=>n+r.counts[q],0)/total*100]));
  const refs=Object.fromEntries(Object.keys(counts).map(q=>[q,results.reduce((n,r)=>n+r.referenceCounts[q],0)/total*100]));
  rows.push({elo,choices:total,...counts,bestGood:counts.best+counts.good,averageEvaluationLoss:results.reduce((n,r)=>n+r.averageEvaluationLoss*r.iterations,0)/total,reference:{...refs,bestGood:refs.best+refs.good,averageEvaluationLoss:results.reduce((n,r)=>n+r.referenceLoss*r.iterations,0)/total}});
 }
 const old=[600,800,1000,1200].map(elo=>{
  const samples=data.positions.flatMap(p=>p.old.filter(o=>o.elo===elo).map(o=>({...o,candidate:p.reference.candidates.find(c=>c.move===o.move)})));
  if(samples.some(s=>!s.candidate))throw Error('Missing old reference');
  return {elo,choices:samples.length,averageEvaluationLoss:samples.reduce((n,s)=>n+s.candidate.evaluationLoss,0)/samples.length,...Object.fromEntries(['best','good','inaccuracy','mistake','blunder'].map(q=>[q,samples.filter(s=>qualityFor(s.candidate.evaluationLoss)===q).length/samples.length*100])),averageMs:samples.reduce((n,s)=>n+s.durationMs,0)/samples.length};
 });
 const result={seed:20260912,rows,old,details,performance:{newAverageMs:data.positions.reduce((n,p)=>n+p.durationMs,0)/data.positions.length,newMaxMs:Math.max(...data.positions.map(p=>p.durationMs))}};
 await writeFile('docs/ai/results/simulation.json',JSON.stringify(result,null,2));
 await writeFile('docs/ai/results/simulation.csv','elo,bestGood,inaccuracy,mistake,blunder,avgLoss,referenceAvgLoss\n'+rows.map(r=>[r.elo,r.bestGood,r.inaccuracy,r.mistake,r.blunder,r.averageEvaluationLoss,r.reference.averageEvaluationLoss].join(',')).join('\n'));
 console.table(rows.map(({reference,...r})=>r));console.log('Independent deeper evaluation:');console.table(rows.map(r=>({elo:r.elo,...r.reference})));console.log('Old:');console.table(old);console.log(result.performance);
 return result;
};
if(process.argv[1]?.endsWith('/simulate.mjs'))await runSimulation();
