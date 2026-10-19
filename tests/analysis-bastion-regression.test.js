import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess} from 'chess.js';
import {buildRecommendation} from '../src/domain/analysis/analysis-recommendations.ts';
import {evaluationExplanation} from '../src/domain/analysis/analysis-evaluation-copy.ts';
import {analyzeGame} from '../src/services/analysis/analysis-service.ts';
import {createStockfishClient} from '../src/services/engines/stockfish-client.ts';
import {spawnStockfish} from '../scripts/stockfish-process.mjs';

const pgn=readFileSync(new URL('./fixtures/player-bastion-2026-10-17.pgn',import.meta.url),'utf8');
const game=new Chess();game.loadPgn(pgn);
const history=game.history({verbose:true});
const explain=(ply,best,played)=>buildRecommendation({fenBefore:history[ply-1].before,playedMove:played[0],bestLine:{move:best[0],pv:best},playedLine:{move:played[0],pv:played},expectedScoreLoss:.2},'w');

test('Bastion: explain the queen-for-rook exchange before unrelated threats',()=>{
 const result=explain(41,['f1h3','e8f8','h3e6','d7e6'],['h7g8','e6g8','a3c5','a8c8']);
 assert.equal(result.kind,'exchange');
 assert.match(result.text,/забираете ладью/);assert.match(result.text,/взять ферзя в ответ/);
 assert.match(result.text,/Ферзь ценнее ладьи/);
 assert.deepEqual(result.playedPv,['h7g8','e6g8']);
});
test('Bastion: missed knight capture is not obscured by a later pawn attack',()=>{
 const result=explain(13,['d1d4','d7d6','e5c4','e7e5'],['c2c3','d4e6','f4f5','d7d6']);
 assert.equal(result.kind,'target_escape');assert.match(result.text,/сразу забрать коня/);
 assert.match(result.text,/увести коня/);assert.doesNotMatch(result.text,/нападает на пешку/);
 assert.deepEqual(result.pv,['d1d4']);
});
test('Bastion: a direct attack includes the observed retreat in its evidence',()=>{
 const result=explain(9,['d4d5','e4c3','b2c3','c6a5'],['c3e4','f5e4','f3e5','e7e6']);
 assert.equal(result.kind,'threat');assert.match(result.text,/Пешка нападает на коня/);
 assert.match(result.text,/уводит коня/);assert.equal(result.pv.at(-1),'c6a5');
});
test('Quiet explanations describe measured outcomes without invented tactics',()=>{
 const copy=(before,after)=>evaluationExplanation({bestLine:{expectedScorePlayer:before},playedLine:{expectedScorePlayer:after}});
 assert.match(copy(.556,.512),/уравнять позицию/);
 assert.match(copy(.7,.3),/преимущество перешло к сопернику/);
 assert.match(copy(.04,0),/уже были в тяжёлой/);
 assert.match(copy(.8,.6),/могли сохранить больший перевес/);
 assert.match(copy(.5,.5),/могли сыграть чуть точнее/);
 assert.match(copy(NaN,.5),/Вы могли выбрать более сильное продолжение/);
});
test('Full imported Bastion PGN analyzes both sides with legal explanatory lines',{timeout:120000},async()=>{
 for(const playerColor of ['w','b']){
  const result=await analyzeGame({id:'bastion-regression',pgn,mode:'local',imported:true,playerColor},{createClient:()=>createStockfishClient(spawnStockfish)});
  assert.equal(result.status,'complete');assert.equal(result.analyzedPlayerMoves,63);
  for(const move of result.moves){
   const evidence=move.recommendationEvidence;if(!evidence)continue;
   assert.doesNotMatch(evidence.text,/само по себе ещё не гарантирует|Это создаёт угрозу/);
   for(const line of [evidence.pv,evidence.playedPv]){
    const board=new Chess(move.fenBefore);
    for(const token of line||[])assert.ok(board.move({from:token.slice(0,2),to:token.slice(2,4),promotion:token[4]}));
   }
  }
  if(playerColor==='w'){
   assert.equal(result.moves[40].recommendationEvidence.kind,'exchange');
   assert.match(result.moves[40].recommendationEvidence.text,/Ферзь ценнее ладьи/);
   assert.equal(result.moves[2].recommendationEvidence.kind,'evaluation');
  }
 }
});
