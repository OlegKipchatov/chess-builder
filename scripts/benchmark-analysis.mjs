// Diagnostic benchmark, not a substitute for physical Apple Silicon / iPhone runs.
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {cpus,platform,arch} from 'node:os';
import {Chess} from '../dist/chess.js';
import {analyzeGame} from '../dist/analysis/analysis-service.js';
import {createStockfishClient} from '../dist/stockfish-client.js';
const fixture = count => {
 const game=new Chess();let seed=177+count;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let ply=0;ply<count*2;ply++){
  const candidates=game.moves({verbose:true}).sort((a,b)=>(a.from+a.to).localeCompare(b.from+b.to));
  const start=Math.floor(random()*candidates.length);let accepted=false;
  for(let i=0;i<candidates.length;i++){
   game.move(candidates[(start+i)%candidates.length]);
   if(!game.isGameOver()){accepted=true;break;}game.undo();
  }
  if(!accepted)throw Error('Fixture ended early');
 }
 return {id:`benchmark-${count}`,mode:'bot',playerColor:'w',finishedAt:'2026-10-01',pgn:game.pgn(),result:'Поражение'};
};
const percentile=(rows,p)=>rows[Math.max(0,Math.ceil(rows.length*p)-1)]||0;
const results=[];
for(const count of [20,40,80]){
 const gameEntry=fixture(count);
 let peakRss=0,child=null,maxEventLoopDelay=0,last=performance.now();
 const interval=setInterval(()=>{const now=performance.now();maxEventLoopDelay=Math.max(maxEventLoopDelay,now-last-25);last=now;
  if(child)try {peakRss=Math.max(peakRss,Number(readFileSync(`/proc/${child.pid}/status`,'utf8').match(/VmRSS:\s+(\d+)/)?.[1]||0));} catch {}
 },25);
 const spawnWorker=()=>{
  child=spawn(process.execPath,[new URL('./stockfish19-cli.mjs',import.meta.url).pathname],{stdio:['pipe','pipe','pipe']});const owned=child;
  const worker={postMessage:command=>owned.stdin.write(command+'\n'),terminate:()=>{owned.kill();}};
  let buffer='';owned.stdout.on('data',chunk=>{buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop();lines.forEach(line=>worker.onmessage?.({data:line}));});
  owned.on('error',error=>worker.onerror?.(error));owned.stdin.on('error',error=>worker.onerror?.(error));return worker;
 };
 const start=performance.now();
 try {
  const result=await analyzeGame(gameEntry,{createClient:()=>createStockfishClient(spawnWorker)});
  const searchTimes=result.diagnostics.searches.map(row=>row.ms).sort((a,b)=>a-b),positionTimes=new Map();
  result.diagnostics.searches.forEach(row=>positionTimes.set(row.ply,(positionTimes.get(row.ply)||0)+row.ms));
  const positions=[...positionTimes.values()].sort((a,b)=>a-b);
  const output={fullMoves:count,playerDecisions:count,status:result.status,totalMs:Math.round(performance.now()-start),searches:searchTimes.length,averagePositionMs:Math.round(positions.reduce((a,b)=>a+b,0)/positions.length),p95PositionMs:Math.round(percentile(positions,.95)),maximumPositionMs:Math.round(positions.at(-1)),engineProcessPeakRssMiB:(peakRss?Math.round(peakRss/1024):null),maxNodeEventLoopDelayMs:Math.round(maxEventLoopDelay),resultBytes:Buffer.byteLength(JSON.stringify(result)),pgn:result.sourcePgn};
  results.push(output);console.log(JSON.stringify({...output,pgn:undefined}));
 }finally{clearInterval(interval);child?.kill();}
}
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify({environment:{platform:platform(),arch:arch(),cpu:cpus()[0]?.model,node:process.version,measurement:'Node client + separate Stockfish WASM process; synthetic legal games; not browser/device results'},results},null,2)+'\n');
