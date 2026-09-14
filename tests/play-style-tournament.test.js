import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess} from '../dist/chess.js';
const root='docs/ai/results/play-styles';
test('Tournament evidence: 96 legal PGNs, correct headers/results, all paired matchups and capped games',()=>{
 const tournament=JSON.parse(readFileSync(root+'/tournament.json')),groups=new Map();assert.equal(tournament.games.length,96);
 for(const g of tournament.games){
  const game=new Chess();game.loadPgn(readFileSync(`${root}/game-${g.id}.pgn`,'utf8'));
  assert.equal(game.history().length,g.plies);assert.equal(g.stats.w.moves+g.stats.b.moves,g.plies);
  const actual=game.isCheckmate()?(game.turn()==='w'?'0-1':'1-0'):game.isDraw()?'1/2-1/2':'*';assert.equal(g.result,actual);
  const headers=game.getHeaders();assert.equal(headers.Result,g.result);assert.equal(headers.White,g.white);assert.equal(headers.Black,g.black);assert.equal(headers.Seed,String(g.seed));
  const key=g.elo+'/'+[g.white,g.black].sort().join('/');groups.set(key,(groups.get(key)||0)+1);
  if(g.result==='*')assert.equal(g.plies,240);
 }
 assert.equal(groups.size,24);for(const count of groups.values())assert.equal(count,4);
});
