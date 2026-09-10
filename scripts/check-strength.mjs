import {writeFile} from 'node:fs/promises';
import {Chess} from '../dist/chess.js';
import {createStockfishClient} from '../dist/stockfish-client.js';
import {stockfishProfile} from '../dist/strength.js';
import {spawnStockfish} from './stockfish-process.mjs';
const clients=[createStockfishClient(spawnStockfish),createStockfishClient(spawnStockfish)];
const ask=(client,game,rating)=>new Promise((resolve,reject)=>{client.onmessage=event=>resolve(event.data.move);client.onerror=reject;client.postMessage({id:1,fen:game.fen(),pgn:game.pgn(),engineProfile:stockfishProfile(rating)});});
const results=[];
try {
 for(const [lower,higher] of [[400,1000],[1000,1600],[400,1600]])for(const opening of [['e4','e5','Nf3','Nc6'],['d4','d5','c4','e6']])for(const highColor of ['w','b']){
  const game=new Chess();opening.forEach(move=>game.move(move));const started=performance.now();
  while(!game.isGameOver()&&game.history().length<160){const color=game.turn();game.move(await ask(clients[color==='w'?0:1],game,color===highColor?higher:lower));}
  const score=game.isCheckmate()?(game.turn()!==highColor?1:0):game.isDraw()?0.5:null;
  results.push({lower,higher,highColor,opening:opening.join(' '),plies:game.history().length,higherScore:score,status:score===null?'move-cap':game.isCheckmate()?'checkmate':'draw',seconds:Math.round((performance.now()-started)/1000)});
  console.log(JSON.stringify(results.at(-1)));
 }
}finally{clients.forEach(client=>client.terminate());}
await writeFile(new URL('../strength-report.json',import.meta.url),JSON.stringify({engine:'Stockfish.js 18.0.0 lite single',profile:'stockfish18-v1',note:'Small paired smoke tournament, not human Elo calibration. Capped games are not adjudicated.',results},null,2)+'\n');
