import {DIFFICULTY} from '../../dist/difficulty-config.js';
import {writeFile,mkdir} from 'node:fs/promises';
import {createStockfishClient} from '../../dist/stockfish-client.js';
import {spawnStockfish} from '../stockfish-process.mjs';
import {POSITIONS} from './positions.mjs';
import {stockfishProfile} from '../../dist/strength.js';
const client=createStockfishClient(()=>spawnStockfish(19));
const ask = data => new Promise((resolve,reject)=>{client.onmessage=({data})=>resolve(data);client.onerror=reject;client.postMessage({id:1,...data});});
const output=[];
try{
 for(const position of POSITIONS){
  const data=await ask({fen:position.fen,engineProfile:{id:'humanized19-v1',targetElo:1000,effectiveElo:1000,seed:42},analysisOnly:true});
  const old=[];
  for(const elo of [600,800,1000,1200])for(let trial=0;trial<8;trial++){
   const start=performance.now();const reply=await ask({fen:position.fen,engineProfile:stockfishProfile(elo)});
   old.push({elo,move:reply.move.from+reply.move.to+(reply.move.promotion||''),durationMs:performance.now()-start});
  }
  // Independent deeper all-root MultiPV: one reference search, never one search per candidate.
  const reference=await ask({fen:position.fen,engineProfile:{id:'humanized19-v1',targetElo:1000,effectiveElo:1000,seed:42},analysisOnly:true,analysis:{multiPv:256,depth:14,nodes:1600000,milliseconds:8000}});
  output.push({...position,...data.analysis,durationMs:data.durationMs,old,reference:reference.analysis,referenceDurationMs:reference.durationMs});
  console.log(position.id,Math.round(data.durationMs)+'ms',data.analysis.candidates.map(c=>`${c.move}:${c.evaluationLoss.toFixed(2)}${c.mate!==null?' M'+c.mate:''}`).join(' '));
 }
 await mkdir('docs/ai/results',{recursive:true});await writeFile('docs/ai/results/candidates.json',JSON.stringify({engine:'Stockfish 19 smallnet',configuration:DIFFICULTY,capturedAt:new Date().toISOString(),positions:output},null,2));
}finally{client.terminate();}
