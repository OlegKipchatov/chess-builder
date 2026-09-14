import {readFileSync,writeFileSync} from 'node:fs';
import {Chess} from '../../dist/chess.js';
import {candidateFeatures,applyPlayStyle,styleScore} from '../../dist/play-style.js';
import {selectCandidate,seededRandom,positionSeed} from '../../dist/difficulty-model.js';
const positions=JSON.parse(readFileSync('docs/ai/results/search-budget.json'))[1].positions,examples=[];
for(const [profile,key] of [['aggressive','attack'],['solid','safety'],['positional','position'],['tricky','complexity']]){
 outer:for(const p of positions.filter(p=>p.context.phase!=='opening')){
  const game=new Chess(p.fen),features=candidateFeatures(game,p.candidates);
  for(let seed=20260913;seed<20261413;seed++){
   const baseline=selectCandidate(p.candidates,1000,p.context,seededRandom(positionSeed(seed,p.fen))),selected=applyPlayStyle({game:{fen:()=>p.fen},candidates:p.candidates,baseline,profile,seed,features});
   const b=features.get(baseline.move),s=features.get(selected.move);
   if(s[key]-b[key]<.03||styleScore(s,profile)<=styleScore(b,profile))continue;
   const san=c=>{const copy=new Chess(p.fen);return copy.move({from:c.move.slice(0,2),to:c.move.slice(2,4),...(c.move[4]?{promotion:c.move[4]}:{})}).san;};
   examples.push({profile,position:p.id,fen:p.fen,elo:1000,seed,baseline:{move:baseline.move,san:san(baseline),loss:baseline.evaluationLoss,features:b},selected:{move:selected.move,san:san(selected),loss:selected.evaluationLoss,features:s},primaryFeature:key});break outer;
  }
 }
}
writeFileSync('docs/ai/results/play-styles/examples.json',JSON.stringify({note:'Illustrative first non-opening examples with positive primary-feature delta, not random samples',examples},null,2));
console.log(examples.map(e=>({profile:e.profile,position:e.position,baseline:e.baseline.san,selected:e.selected.san,loss:e.selected.loss,key:e.primaryFeature,change:e.selected.features[e.primaryFeature]-e.baseline.features[e.primaryFeature]})));
