import {Chess} from '../../dist/chess.js';
import {decide} from '../../dist/cognitive-search.js';

const positions=[
  new Chess().fen(),
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
  '4k3/8/8/3r4/3Q4/8/8/4K3 b - - 0 1',
  '7k/5K2/6Q1/8/8/8/8/8 w - - 0 1'
];
const rows=[];
for(const elo of [100,400,600,800,1000,1200,1399]){
  const started=performance.now(),moves=[];
  for(let index=0;index<positions.length;index++)for(let seed=0;seed<25;seed++){
    const result=decide({fen:positions[index],elo,seed:20260920+seed,profile:'default'});
    const game=new Chess(positions[index]);
    if(result.move&&!game.move({from:result.move.slice(0,2),to:result.move.slice(2,4),promotion:result.move[4]}))throw Error(`Illegal move ${result.move}`);
    moves.push(result.move);
  }
  rows.push({elo,decisions:moves.length,uniqueMoves:new Set(moves).size,meanMs:(performance.now()-started)/moves.length});
}
console.table(rows);
