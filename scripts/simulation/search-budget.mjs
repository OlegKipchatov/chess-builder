import {readFileSync,writeFileSync} from 'node:fs';
import {createStockfishClient} from '../../dist/stockfish-client.js';
import {spawnStockfish} from '../stockfish-process.mjs';
import {simulate} from './simulate.mjs';
const source=JSON.parse(readFileSync('docs/ai/results/candidates.json'));
const client=createStockfishClient(()=>spawnStockfish(19));
const ask=data=>new Promise((resolve,reject)=>{client.onmessage=({data})=>resolve(data);client.onerror=reject;client.postMessage(data);});
const budgets=[{depth:10,nodes:500000,multiPv:32},{depth:9,nodes:150000,multiPv:32},{depth:8,nodes:80000,multiPv:32}];
const results=[];
try{
 for(const budget of budgets){
  const positions=[];
  for(const p of source.positions){
   const reply=await ask({id:1,fen:p.fen,analysisOnly:true,analysis:budget,engineProfile:{id:'humanized19-v1',targetElo:600,effectiveElo:600,seed:42}});
   positions.push({...p,...reply.analysis,durationMs:reply.durationMs});
  }
  const rows=[400,474,600,800,1000,1200,1400,1600].map(elo=>{
   const choices=positions.map(position=>simulate({position,botElo:elo,iterations:1000}));
   return {elo,loss:choices.reduce((n,r)=>n+r.referenceLoss,0)/choices.length,bestGood:choices.reduce((n,r)=>n+r.referenceCounts.best+r.referenceCounts.good,0)/(1000*choices.length)};
  });
  const summary={budget,averageMs:positions.reduce((n,p)=>n+p.durationMs,0)/positions.length,maxMs:Math.max(...positions.map(p=>p.durationMs)),meanCandidates:positions.reduce((n,p)=>n+p.candidates.length,0)/positions.length,rows};
  console.log(JSON.stringify(summary));results.push({...summary,positions});
 }
 writeFileSync('docs/ai/results/search-budget.json',JSON.stringify(results,null,2));
}finally{client.terminate();}
