/** Offline only: Stockfish is the defender, never an input to cognitive decisions. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Chess} from '../../dist/chess.js';
import {decide} from '../../dist/cognitive-search.js';
import {createStockfishClient} from '../../dist/stockfish-client.js';
import {spawnStockfish} from '../stockfish-process.mjs';
import {CONVERSION} from '../../dist/conversion-config.js';
const sourceFiles=['conversion-config','conversion-board','conversion-model','conversion-history','conversion-search','cognitive-search'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,createHash('sha256').update(await readFile(new URL(`../../dist/${name}.js`,import.meta.url))).digest('hex')])));
const client=createStockfishClient(()=>spawnStockfish(19));
let id=0;
const defend = game => new Promise((resolve,reject)=>{
 client.onmessage=({data})=>resolve(data.move);client.onerror=reject;
 client.postMessage({id:++id,fen:game.fen(),pgn:game.pgn(),analysisOnly:true,analysis:{multiPv:1,depth:12,nodes:80000,milliseconds:250}});
});
const fixtures=[
 ['incident','8/6k1/5R2/5R2/3B4/3K4/8/8 w - - 8 63'],
 ['krk','8/4k3/8/8/8/8/4K3/R7 w - - 0 1'],
 ['kqk','8/4k3/8/8/8/8/4K3/Q7 w - - 0 1'],
 ['krk-black','r7/4k3/8/8/8/8/4K3/8 b - - 0 1'],
 ['kqk-black','q7/4k3/8/8/8/8/4K3/8 b - - 0 1'],
];
const rows=[],timings=[];
if(process.argv.includes('--generated')){
 let value=20260922;
 const randomInt = n => {value=(Math.imul(value,1664525)+1013904223)>>>0;return Math.floor(value/4294967296*n);};
 const squares=Array.from({length:64},(_,i)=>String.fromCharCode(97+i%8)+(1+Math.floor(i/8)));
 for(let i=0;i<20;){
  const game=new Chess();game.clear();
  const own=squares[randomInt(64)],enemy=squares[randomInt(64)],major=squares[randomInt(64)];
  if(new Set([own,enemy,major]).size!==3)continue;
  game.put({type:'k',color:'w'},own);game.put({type:'k',color:'b'},enemy);game.put({type:i%2?'q':'r',color:'w'},major);
  if(game.isAttacked(enemy,'w')||game.isAttacked(own,'b')||game.isGameOver())continue;
  fixtures.push(['generated-'+i,game.fen()]);i++;
 }
}
const seeds=process.argv.includes('--wide')?[1,7,91,2935870025]:[2935870025];
const elos=process.argv.includes('--wide')?[100,840,1399]:[840];
try{
 for(const [name,fen] of fixtures.filter(([name])=>!process.argv.some(a=>a.startsWith('--case='))||name===process.argv.find(a=>a.startsWith('--case=')).slice(7)))for(const elo of elos)for(const seed of seeds){
  const game=new Chess(fen),side=game.turn();let plies=0,trace=null;
  while(!game.isGameOver()&&plies<100){
   if(game.turn()===side){
    const start=performance.now(),result=decide({fen:game.fen(),pgn:game.pgn(),elo,seed,profile:'solid'});timings.push(performance.now()-start);trace=result.trace;
    game.move({from:result.move.slice(0,2),to:result.move.slice(2,4),promotion:result.move[4]});
   }else game.move(await defend(game));
   plies++;
  }
  const row={name,fen,elo,seed,plies,mate:game.isCheckmate(),repetition:game.isThreefoldRepetition(),fiftyMoves:game.isDrawByFiftyMoves(),stalemate:game.isStalemate(),pgn:game.pgn(),trace};rows.push(row);
  console.log(JSON.stringify({name,elo,seed,plies,mate:row.mate,repetition:row.repetition,fiftyMoves:row.fiftyMoves}));
 }
}finally{client.terminate();}
const sorted=timings.sort((a,b)=>a-b),summary={games:rows.length,mates:rows.filter(r=>r.mate).length,decisions:timings.length,p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),defender:'Stockfish 19, depth 12 / nodes 80000 / 250ms, not tablebase oracle'};
await mkdir('docs/ai/results/conversion-v2.1',{recursive:true});
const reportName=process.argv.includes('--generated')?'generated':process.argv.includes('--wide')?'matrix':'report';
await writeFile(`docs/ai/results/conversion-v2.1/${reportName}.json`,JSON.stringify({summary,config:CONVERSION,sourceHashes,rows},null,2)+'\n');
console.log(summary);
if(rows.some(r=>!r.mate))process.exitCode=1;
