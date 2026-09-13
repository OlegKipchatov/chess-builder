import {createStockfishClient} from '../../dist/stockfish-client.js';
import {spawnStockfish} from '../stockfish-process.mjs';
import {stockfishProfile} from '../../dist/strength.js';
import {Chess} from '../../dist/chess.js';
import {writeFile} from 'node:fs/promises';
const measure = async engineProfile => {
 const start=performance.now(),client=createStockfishClient(()=>spawnStockfish(19)),times=[];
 const ask=()=>new Promise((resolve,reject)=>{client.onmessage=resolve;client.onerror=reject;client.postMessage({id:1,fen:new Chess().fen(),engineProfile});});
 try {await ask();const coldMs=performance.now()-start;for(let i=0;i<5;i++){const t=performance.now();await ask();times.push(performance.now()-t);}return {coldMs,warmMs:times};}finally{client.terminate();}
};
const result={environment:'Node '+process.version+' '+process.platform+' '+process.arch,old:await measure(stockfishProfile(1000)),new:await measure({id:'humanized19-v1',targetElo:1000,effectiveElo:1000,seed:42})};
await writeFile('docs/ai/results/performance.json',JSON.stringify(result,null,2));console.log(result);
