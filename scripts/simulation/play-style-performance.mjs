import {readFileSync,writeFileSync} from 'node:fs';
import {Chess} from '../../dist/chess.js';
import {selectCandidate,seededRandom,positionSeed} from '../../dist/difficulty-model.js';
import {applyPlayStyle} from '../../dist/play-style.js';
const ps=JSON.parse(readFileSync('docs/ai/results/search-budget.json'))[1].positions,rows=[];
for(const profile of ['default','aggressive','solid','positional','tricky']){
 const times=[];let changed=0;
 for(const p of ps){const game=new Chess(p.fen);
  for(let seed=0;seed<100;seed++){
   const baseline=selectCandidate(p.candidates,1000,p.context,seededRandom(positionSeed(seed,p.fen))),start=performance.now();
   const selected=applyPlayStyle({game,candidates:p.candidates,baseline,seed,profile});times.push(performance.now()-start);changed+=selected!==baseline;
  }
 }
 times.sort((a,b)=>a-b);rows.push({profile,n:times.length,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:times[Math.floor(times.length*.95)],maxMs:times.at(-1),changed:changed/times.length});
}
writeFileSync('docs/ai/results/play-styles/performance.json',JSON.stringify({note:'Node on same machine as four concurrent tournament engine processes; profile step only, real on-demand features',rows},null,2));console.table(rows);
