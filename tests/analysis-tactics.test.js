import test from 'node:test';
import assert from 'node:assert/strict';
import {traceContinuation,buildRecommendation} from '../src/domain/analysis/analysis-recommendations.ts';
import {tacticalEvidence} from '../src/domain/analysis/analysis-tactics.ts';
const trace=(fen,pv)=>traceContinuation(fen,{move:pv[0],pv},'w');
const cases=[
 ['fork','6k1/2r5/5q2/8/8/2N5/8/6K1 w - - 0 1',['c3d5','f6h6','d5c7'],['g1h1']],
 ['pin','4k3/4r2p/2N5/8/8/8/8/4R1K1 w - - 0 1',['e1e2','h7h6','c6e7'],['g1h1']],
 ['discovered_attack','4q2k/8/8/8/8/8/4B3/4R1K1 w - - 0 1',['e2b5','h8g7','e1e8'],['g1f1']],
 ['deflection','3r2k1/8/8/3q4/5N2/8/8/4R1K1 w - - 0 1',['e1e8','d8e8','f4d5'],['g1f1']],
];
const flipSquare=square=>'hgfedcba'['abcdefgh'.indexOf(square[0])]+(9-Number(square[1]));
const flipToken=token=>flipSquare(token.slice(0,2))+flipSquare(token.slice(2,4))+token.slice(4);
const flipFen=fen=>fen.split(' ')[0].split('/').reverse().map(row=>row.split('').reverse().map(char=>/[a-z]/.test(char)?char.toUpperCase():char.toLowerCase()).join('')).join('/')+' b - - 0 1';
for(const [kind,fen,pv,actual] of cases)test(`Black-side ${kind} uses the same legal evidence`,()=>{
 const mirrored=flipFen(fen),bestTokens=pv.map(flipToken),playedTokens=actual.map(flipToken);
 const best=traceContinuation(mirrored,{move:bestTokens[0],pv:bestTokens},'b');
 const played=traceContinuation(mirrored,{move:playedTokens[0],pv:playedTokens},'b');
 assert.ok(best&&played);assert.equal(tacticalEvidence(mirrored,best,played,'b')?.kind,kind);
});
for(const [kind,fen,pv,actual] of cases)test(`Confirmed ${kind} has both a legal motif and material consequence`,()=>{
 const best=trace(fen,pv),played=trace(fen,actual);
 assert.ok(best&&played);assert.ok(best.settled);assert.ok(best.delta>played.delta);
 const tactic=tacticalEvidence(fen,best,played,'w');assert.equal(tactic?.kind,kind);
 const result=buildRecommendation({fenBefore:fen,bestLine:{move:pv[0],pv},playedLine:{move:actual[0],pv:actual},playedMove:actual[0],expectedScoreLoss:.2},'w');
 assert.equal(result.tactic,kind);assert.ok(result.pv.length>=tactic.end);assert.match(result.text,/показанном варианте/);
 assert.equal(tacticalEvidence(fen,{...best,settled:false},played,'w'),null);
});
test('A fork shape or a check alone never proves material gain',()=>{
 const [,fen,pv,actual]=cases[0];
 assert.equal(tacticalEvidence(fen,trace(fen,pv.slice(0,2)),trace(fen,actual),'w'),null);
 const quiet=buildRecommendation({fenBefore:fen,bestLine:{move:pv[0],pv:pv.slice(0,2),expectedScorePlayer:.8},playedLine:{move:actual[0],pv:actual,expectedScorePlayer:.6},playedMove:actual[0],expectedScoreLoss:.2},'w');
 assert.equal(quiet.tactic,undefined);assert.match(quiet.text,/перевес/);assert.doesNotMatch(quiet.text,/выигрываете/);
});
