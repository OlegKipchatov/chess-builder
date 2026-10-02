import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {buildRecommendation,traceContinuation,compareContinuations,MAX_EVIDENCE_PLIES} from '../dist/analysis/analysis-recommendations.js';

const decision=(fen,best,played)=>({fenBefore:fen,playedMove:played[0],bestLine:{move:best[0],pv:best},playedLine:{move:played[0],pv:played},expectedScoreLoss:.2});
const mirrorSquare=square=>'hgfedcba'['abcdefgh'.indexOf(square[0])]+(9-Number(square[1]));
const mirrorToken=token=>mirrorSquare(token.slice(0,2))+mirrorSquare(token.slice(2,4))+token.slice(4);
const mirrorFen=fen=>{
 const game=new Chess(fen),board=game.board().flat().reverse(),rows=[];
 for(let rank=0;rank<8;rank++){
  let row='',empty=0;
  for(const piece of board.slice(rank*8,rank*8+8)){
   if(!piece){empty++;continue;}if(empty){row+=empty;empty=0;}row+=piece.color==='w'?piece.type:piece.type.toUpperCase();
  }
  if(empty)row+=empty;rows.push(row);
 }
 return rows.join('/')+' b - - 0 1';
};

for(const [piece,fen,best,played] of [
 ['knight','4k3/8/4p3/3q4/5N2/8/8/4K3 w - - 0 1',['f4d5','e6d5'],['e1f1']],
 ['rook','k7/6qr/8/8/8/8/8/1K4R1 w - - 0 1',['g1g7','h7g7'],['b1c1']]
])test(`Material comparison works for ${piece}, either color and different squares`,()=>{
 for(const black of [false,true]){
  const input=decision(black?mirrorFen(fen):fen,black?best.map(mirrorToken):best,black?played.map(mirrorToken):played);
  const result=buildRecommendation(input,black?'b':'w');
  assert.equal(result.kind,'material');assert.equal(result.coverage,'verified_line');assert.ok(result.comparison.bestDelta>0);
  assert.match(result.text,/материальная выгода/);assert.equal(result.pv.length,2);
 }
});

test('An unfinished recapture is not described as winning material',()=>{
 const fen='4k3/8/4p3/3q4/5N2/8/8/4K3 w - - 0 1';
 const input=decision(fen,['f4d5'],['e1f1']);
 const trace=traceContinuation(fen,input.bestLine,'w');assert.equal(trace.settled,false);
 assert.notEqual(buildRecommendation(input,'w').kind,'material');
});

test('Pinned pieces do not create fictitious threats; promotion awaiting a capture is unsettled',()=>{
 const pinned=traceContinuation('4r1k1/8/8/8/8/3r4/P3R3/4K3 w - - 0 1',{move:'e2e3',pv:['e2e3']},'w');
 assert.ok(pinned);assert.ok(!pinned.steps[0].threats.some(target=>target.square==='d3'));
 const promoted=traceContinuation('1r5k/P7/8/8/8/8/8/7K w - - 0 1',{move:'a7a8q',pv:['a7a8q']},'w');
 assert.equal(promoted.settled,false);
});

test('A double attack is explained as a threat, never guaranteed material',()=>{
 const input=decision('6k1/2r5/5q2/8/8/2N5/8/6K1 w - - 0 1',['c3d5','f6g5'],['g1h1']);
 const result=buildRecommendation(input,'w');
 assert.equal(result.kind,'threat');assert.match(result.text,/одновременное нападение/);
 assert.equal(result.facts[0].step.threats.length,2);assert.match(result.text,/не гарантирует/);
});

test('Quiet positions use an explicit evidence limit instead of invented strategic prose',()=>{
 const result=buildRecommendation(decision(new Chess().fen(),['d2d4','d7d5'],['e2e4','e7e5']),'w');
 assert.equal(result.coverage,'evaluation_only');assert.deepEqual(result.facts,[]);
 assert.match(result.text,/не позволяет надёжно объяснить/);
 assert.doesNotMatch(result.text,/контроль центра|короля|выигры/);
});

test('Equal alternatives, forced moves, mate transitions and malformed PVs do not get an unrelated explanation',()=>{
 const input=decision(new Chess().fen(),['d2d4'],['e2e4']);
 for(const patch of [{expectedScoreLoss:.004},{forced:true},{mateTransition:'allowed_mate'},{bestLine:{move:'d2d4',pv:['d2d5']}}])assert.equal(buildRecommendation({...input,...patch},'w'),null);
 assert.equal(buildRecommendation(input,'b'),null);
});

test('Replay handles promotion, castling, en passant and bounded cyclic lines',()=>{
 const promote=traceContinuation('7k/P7/8/8/8/8/8/7K w - - 0 1',{move:'a7a8q',pv:['a7a8q']},'w');
 assert.equal(promote.steps[0].promotion,'q');assert.equal(promote.delta,8);
 const castle=traceContinuation('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',{move:'e1g1',pv:['e1g1']},'w');assert.ok(castle);assert.equal(castle.delta,0);
 const ep=traceContinuation('7k/8/8/3pP3/8/8/8/7K w - d6 0 1',{move:'e5d6',pv:['e5d6']},'w');assert.equal(ep.delta,1);assert.equal(ep.steps[0].captured,'p');
 const pv=Array.from({length:10},()=>['g1f3','g8f6','f3g1','f6g8']).flat();
 assert.ok(traceContinuation(new Chess().fen(),{move:pv[0],pv},'w').pv.length<=MAX_EVIDENCE_PLIES);
});

test('Material lost in actual line is compared against the alternative',()=>{
 const fen='4k3/8/8/8/8/8/q7/R3K3 w - - 0 1';
 const input=decision(fen,['a1a2','e8d7'],['e1f1','a2a1']);
 const result=buildRecommendation(input,'w');assert.equal(result.kind,'material');assert.equal(result.reason,'lost_material');
 assert.deepEqual(result.playedPv,['e1f1','a2a1']);
 assert.equal(compareContinuations(null,null).length,0);
});
