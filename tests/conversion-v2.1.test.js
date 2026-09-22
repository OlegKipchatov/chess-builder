import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess} from '../dist/chess.js';
import {decide} from '../dist/cognitive-search.js';
import {capabilitiesFor,uci} from '../dist/cognitive-model.js';
import {conversionSignature,conversionFeatures} from '../dist/conversion-model.js';
import {conversionMoves,withConversionMove} from '../dist/conversion-board.js';
import {conversionHistory,positionKey,advanceProgress,stagnationPenalty} from '../dist/conversion-history.js';
import {decideConversion} from '../dist/conversion-search.js';
const incident='8/6k1/5R2/5R2/3B4/3K4/8/8 w - - 8 63';
const args={fen:incident,elo:840,seed:2935870025,profile:'solid'};
const apply = (game,move) => game.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});

test('2.1 classifier is narrow and color symmetric',()=>{
 for(const fen of [incident,'8/4k3/8/8/8/8/4K3/R7 w - - 0 1','r7/4k3/8/8/8/8/4K3/8 b - - 0 1']){
  const game=new Chess(fen);assert.equal(conversionSignature(game,game.turn()).active,true);
  assert.equal(conversionSignature(game,game.turn()==='w'?'b':'w').active,false);
 }
 for(const fen of ['8/4k3/8/8/8/8/P3K3/R7 w - - 0 1','8/4k3/8/8/8/8/4K3/BN6 w - - 0 1','8/4k3/7p/8/8/8/4K3/R7 w - - 0 1'])assert.equal(conversionSignature(new Chess(fen),'w').active,false);
});
test('2.1 SAN-free adapter matches public moves and restores state on exceptions',()=>{
 const game=new Chess(incident),fen=game.fen(),hash=game.hash(),history=game.history();
 assert.deepEqual(conversionMoves(game).map(m=>m.uci).sort(),game.moves({verbose:true}).map(uci).sort());
 for(const move of conversionMoves(game)){
  assert.throws(()=>withConversionMove(game,move,()=>{const copy=new Chess(fen);apply(copy,move.uci);assert.equal(game.fen(),copy.fen());throw Error('budget');}),/budget/);
  assert.equal(game.fen(),fen);assert.equal(game.hash(),hash);assert.deepEqual(game.history(),history);
 }
});
test('2.1 virtual king mobility agrees with legal defenses, including captures and opened rays',()=>{
 const game=new Chess(incident);
 for(const move of game.moves({verbose:true})){
  game.move(move);const f=conversionFeatures(game,'w');
  assert.equal(f.mobilityCount,game.moves({verbose:true}).filter(m=>m.piece==='k').length,game.fen());
  for(const key of ['confinement','edgePressure','kingProximity','coverage','progress'])assert.ok(f[key]>=0&&f[key]<=1,key);
  game.undo();
 }
});
test('2.1 always chooses available mate, even at low Elo and tiny search budget',()=>{
 for(const elo of [100,400,840,1399])for(const seed of [1,7,91]){
  const game=new Chess('7k/8/5KQ1/8/8/8/8/8 w - - 99 1');
  const result=decide({fen:game.fen(),elo,seed,maxNodes:1});apply(game,result.move);
  assert.equal(game.isCheckmate(),true);assert.equal(result.trace.immediateMate,true);
 }
});
test('2.1 avoids immediate stalemate and loss of the last major piece',()=>{
 for(const fen of ['7k/8/5K2/6Q1/8/8/8/8 w - - 0 1','8/8/4k3/8/R7/8/4K3/8 w - - 0 1'])for(const seed of [1,7,91]){
  const game=new Chess(fen),result=decide({fen,elo:100,seed});apply(game,result.move);
  assert.equal(game.isStalemate(),false);
  if(!game.isCheckmate())for(const m of game.moves({verbose:true})){
   game.move(m);assert.equal(game.isInsufficientMaterial(),false);game.undo();
  }
 }
});
test('2.1 repetition history includes initial position once and recognizes limited FEN history',()=>{
 const game=new Chess('7k/8/8/8/8/8/4K3/R7 w - - 0 1');
 for(const m of ['Ra2','Kg8','Ra1','Kh8'])game.move(m);
 const h=conversionHistory(game,'w',game.pgn());assert.equal(h.counts.get(positionKey(game)),2);assert.equal(h.complete,true);
 assert.equal(conversionHistory(new Chess(game.fen()),'w',null).complete,false);
 const r=decide({fen:game.fen(),pgn:game.pgn(),elo:840,seed:1});assert.equal(r.trace.historyComplete,true);
});
test('2.1 refuses a third occurrence when a non-draw move is available',()=>{
 const game=new Chess('7k/8/8/8/8/8/8/R3K3 b - - 0 1');
 for(const move of ['Kh7','Ra2','Kh8','Ra1','Kh7','Ra2','Kh8'])game.move(move);
 const copy=new Chess();copy.loadPgn(game.pgn());copy.move('Ra1');assert.equal(copy.isThreefoldRepetition(),true);
 for(const seed of [1,7,91]){
  const result=decide({fen:game.fen(),pgn:game.pgn(),elo:100,seed});
  assert.notEqual(result.move,'a2a1');
  assert.equal(result.trace.noImmediateLossFound,true);
 }
});
test('2.1 all immediate draws still return a legal move, not a search error',()=>{
 const game=new Chess('8/4k3/8/8/8/8/4K3/R7 w - - 99 1');
 const result=decide({fen:game.fen(),elo:840,seed:1});
 assert.ok(apply(game,result.move));assert.equal(game.isDraw(),true);
});
test('2.1 features are color/reflection symmetric on supported positions',()=>{
 const game=new Chess(incident),mirrored=new Chess();mirrored.clear();
 for(const p of game.board().flat().filter(Boolean))mirrored.put({type:p.type,color:p.color==='w'?'b':'w'},String.fromCharCode(104-(p.square.charCodeAt(0)-97))+(9-Number(p.square[1])));
 const a=conversionFeatures(game,'w'),b=conversionFeatures(mirrored,'b');
 for(const key of Object.keys(a))assert.ok(Math.abs(a[key]-b[key])<1e-12,key);
});
test('2.1 stagnation cannot reset by returning to a previous peak',()=>{
 let s=advanceProgress(null,.8,'kr:k');s=advanceProgress(s,.6,'kr:k');s=advanceProgress(s,.8,'kr:k');
 assert.equal(s.stagnantMoves,2);assert.ok(stagnationPenalty(s,90)>stagnationPenalty(s,0));
 assert.equal(advanceProgress(s,.83,'kr:k').stagnantMoves,0);
});
test('2.1 budget/depth limits and interrupted search preserve board and history',()=>{
 const game=new Chess(incident),before=game.fen(),pgn=game.pgn();
 const result=decideConversion({game,caps:capabilitiesFor(840),seed:1,profile:'solid',maxNodes:1,maxDepth:4});
 assert.ok(result.trace.nodes<=1);assert.equal(result.trace.completedDepth,0);assert.equal(result.trace.cut,true);
 assert.equal(game.fen(),before);assert.equal(game.pgn(),pgn);
 assert.equal(decide({...args,maxDepth:0}).trace.completedDepth,0);
 const full=decide(args);assert.ok(full.trace.nodes<=3000);assert.equal(full.trace.completedDepth,4);
 assert.deepEqual(decide(args),full);
 assert.ok(full.trace.candidates.filter(c=>!c.isCheck).length>=3);
});
test('2.1 ordinary decisions match the frozen v2 baseline, including trace',()=>{
 const corpus=JSON.parse(readFileSync(new URL('./fixtures/cognitive-v2.0-decisions.json',import.meta.url),'utf8'));
 for(const {input,expected} of corpus){const actual=decide(input);delete actual.trace.version;assert.deepEqual(actual,expected);}
});
test('2.1 disabling conversion uses the ordinary cognitive path',()=>{
 assert.equal(decide({...args,conversionEnabled:false}).trace.conversionMode,undefined);
});
test('2.1 production conversion has no Stockfish or tablebase imports',()=>{
 for(const name of ['config','board','model','history','search'])assert.doesNotMatch(readFileSync(new URL(`../dist/conversion-${name}.js`,import.meta.url),'utf8'),/from .*?(stockfish|syzygy|tablebase|candidate-analysis)/i);
});
test('2.1 every style remains legal and deterministic in conversion',()=>{
 for(const profile of ['default','solid','aggressive','positional','tricky']){
  const first=decide({...args,profile});assert.deepEqual(decide({...args,profile}),first);
  const game=new Chess(args.fen);assert.ok(apply(game,first.move));assert.equal(game.isDraw(),false);
 }
});
test('2.1 urgency increases only the requested search, respecting caller limits',()=>{
 const result=decide({fen:'8/4k3/8/8/8/8/4K3/R7 w - - 80 1',elo:840,seed:1,maxNodes:1,maxDepth:2});
 assert.equal(result.trace.rescue,true);assert.equal(result.trace.depth,2);
 assert.ok(result.trace.nodes<=1);assert.equal(result.trace.completedDepth,0);
});
