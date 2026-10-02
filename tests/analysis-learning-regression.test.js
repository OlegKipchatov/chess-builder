import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {recommendationEvidence} from '../dist/analysis/analysis-reasons.js';
import {prepareMateExercise,createMateExercise} from '../dist/analysis/analysis-training.js';
import {selectEvents,isImportantInsight} from '../dist/analysis/analysis-events.js';
import {analysisInsight,visibleVariation} from '../dist/ui/components/analysis-insight.js';
import {explanationFor} from '../dist/analysis/analysis-explanations.js';
import {analyzeGame} from '../dist/analysis/analysis-service.js';
import {createStockfishClient} from '../dist/stockfish-client.js';
import {spawnStockfish} from '../scripts/stockfish-process.mjs';

const pgn=readFileSync(new URL('./fixtures/reina-oct2.pgn',import.meta.url),'utf8').trim();
const game=new Chess();game.loadPgn(pgn);
const history=game.history({verbose:true});
test('Real Stockfish pipeline groups opening advice and generates a factual explanation for move 8',{timeout:60000},async()=>{
 const analysis=await analyzeGame({id:'reina-oct2',pgn,mode:'bot',playerColor:'w',finishedAt:'2026-10-02'},{createClient:()=>createStockfishClient(spawnStockfish)});
 assert.equal(analysis.status,'complete');assert.deepEqual(analysis.moves[2].relatedPlies,[3,5,7]);
 const move=analysis.moves[14];assert.equal(move.recommendationEvidence.coverage,'verified_line');
 assert.equal(move.recommendationEvidence.kind,'target_escape');
 assert.match(explanationFor(move),/пешка нападает на коня/);
 assert.doesNotMatch(explanationFor(move),/заметно ухудшил/);
 assert.ok(move.recommendationEvidence.facts.length);
 assert.ok(analysis.moves.every(row=>!row.bestLine||row.bestLine.pv.length<=(row.bestLine.score.type==='mate'?8:4)));
});
const mateMove=async index=>{
 const move={ply:index+1,actor:'player',status:'complete',quality:'good',reason:'mate_opportunity',fenBefore:history[index].before,shortMate:{verified:true,moves:1}};
 move.exercise=await prepareMateExercise(move);return move;
};

test('Reported opening: d4 is protected, with a legal explanatory capture and recapture',()=>{
 const move={fenBefore:history[2].before,playedMove:'f2f3',playedLine:{pv:['f2f3']},bestLine:{move:'d2d4',pv:['d2d4']}};
 const evidence=recommendationEvidence(move,'w');
 assert.deepEqual(evidence.pv,['d2d4','c6d4','d1d4']);
 assert.match(evidence.text,/конём/);
 const board=new Chess(move.fenBefore);evidence.pv.forEach(token=>board.move({from:token.slice(0,2),to:token.slice(2,4)}));
 assert.equal(board.get('d4').type,'q');
 assert.deepEqual(visibleVariation({...move,recommendationEvidence:evidence},true).pv,evidence.pv);
 assert.equal(recommendationEvidence({...move,playedMove:'d2d4'},'w'),null);
});

test('A knight taking a queen is explained even when the knight is recaptured',()=>{
 const evidence=recommendationEvidence({fenBefore:'4k3/8/4p3/3q4/5N2/8/8/4K3 w - - 0 1',playedMove:'e1f1',playedLine:{pv:['e1f1']},bestLine:{move:'f4d5',pv:['f4d5','e6d5']}},'w');
 assert.match(evidence.text,/ферзя/);assert.match(evidence.text,/коня/);assert.equal(evidence.pv.length,2);
});

test('Screenshot: explain the forcing bishop exchange before d5, not a fictitious material win',()=>{
 const move={actor:'player',status:'complete',quality:'blunder',reason:'generic',playedSan:'d5',fenBefore:history[14].before,playedMove:'d4d5',bestLine:{move:'b5d6',pv:['b5d6','c7d6','d4d5','c6e5']},playedLine:{pv:['d4d5','d6b4','c1d2','c6e5']}};
 move.recommendationEvidence=recommendationEvidence(move,'w');
 assert.equal(move.recommendationEvidence.kind,'target_escape');
 assert.deepEqual(visibleVariation(move,true).pv,['b5d6','c7d6','d4d5']);
 assert.match(explanationFor(move),/разменять коня на слона с шахом/);
 assert.match(analysisInsight(move),/увести слона с шахом/);
 assert.doesNotMatch(analysisInsight(move),/заметно ухудшил|выиграть материал/);
 assert.notEqual(recommendationEvidence({...move,playedLine:{pv:['d4d5','c6e5']}},'w')?.kind,'target_escape','Do not claim an escape without supporting evidence');
});

test('Repeated d4 advice at plies 3, 5, 7 produces one card and stop without changing quality',()=>{
 const moves=[2,4,6].map((index,i)=>{
  const move={ply:index+1,actor:'player',status:'complete',quality:i===1?'mistake':'blunder',reason:'generic',fenBefore:history[index].before,playedMove:history[index].from+history[index].to,bestLine:{move:'d2d4',pv:['d2d4']},playedLine:{expectedScorePlayer:.45,pv:[history[index].from+history[index].to]}};
  move.recommendationEvidence=recommendationEvidence(move,'w');return move;
 });
 assert.deepEqual(selectEvents(moves),[3]);assert.deepEqual(moves[0].relatedPlies,[3,5,7]);
 assert.equal(moves[2].quality,'blunder');assert.equal(analysisInsight(moves[2]),'');
 assert.match(analysisInsight(moves[0]),/Разберём её один раз/);
 moves[2].reason='lost_material';assert.deepEqual(selectEvents(moves),[3,7]);
 moves[2].reason='generic';moves[2].playedLine.expectedScorePlayer=.05;
 assert.deepEqual(selectEvents(moves),[3,7],'A new losing outcome remains visible');
 assert.deepEqual(selectEvents([moves[0],{actor:'player',status:'unavailable'},moves[1]]),[3,5],'Unavailable decisions break the episode');
});

test('Reported moves 29 and 30 share three mates: one card and one autoplay event',async()=>{
 const first=await mateMove(56),second=await mateMove(58);
 for(const token of ['h6f4','b6d6','c1c5'])assert.ok(first.exercise.solutions.some(row=>row.move===token));
 assert.deepEqual(selectEvents([first,{actor:'opponent'},second]),[57]);
 assert.equal(isImportantInsight(second),false);assert.equal(analysisInsight(second),'');
 second.quality='blunder';assert.deepEqual(selectEvents([first,second]),[57,59]);
 second.quality='good';assert.deepEqual(selectEvents([first,{actor:'player',status:'unavailable'},second]),[57,59]);
});

test('Hint unlocks after five legal failures, survives re-entry, and accepts all actual mating moves',async()=>{
 const {exercise:data}=await mateMove(56),attempts=new Map();let exercise=createMateExercise(data,{attempts});
 assert.equal(await exercise.getHint(),null);
 exercise.submit('a1a8');assert.equal(exercise.getSnapshot().failedAttempts,0);
 for(let i=0;i<5;i++){
  assert.equal(exercise.submit('c1c4').state,'wrong');
  exercise.submit('c1c4');exercise.continue();
  assert.equal(exercise.getSnapshot().failedAttempts,i+1);
  assert.equal(exercise.getSnapshot().canHint,i===4);
 }
 exercise=createMateExercise(data,{attempts});
 const hint=await exercise.getHint();assert.ok(data.solutions.some(row=>row.move===hint));
 for(const solution of data.solutions)assert.equal(createMateExercise(data).submit(solution.move).state,'success');
});

test('Unverified engine attempts never unlock hints; hint search is bounded and cancellable',async()=>{
 const fen='7k/8/5K2/8/8/8/8/3Q4 w - - 0 1';
 let mode='uncertain',request,terminated=false;
 const client={terminate:()=>{terminated=true;},postMessage:data=>{
  request=data;
  if(mode==='pending')return;
  queueMicrotask(()=>client.onmessage({data:{...data,lines:[{move:'h8h7',scoreType:'cp',scoreValue:-900}]}}));
 }};
 const attempts=new Map(),exercise=createMateExercise({type:'engine',fen,mateIn:3},{attempts,createClient:()=>client});
 for(let i=0;i<5;i++){
  assert.equal((await exercise.submit('d1d2')).state,'unverified');exercise.continue();
 }
 assert.equal(exercise.getSnapshot().canHint,false);
 attempts.set(fen.split(' ').slice(0,4).join(' '),5);mode='pending';
 const hint=exercise.getHint();assert.equal(request.analysis.mode,'nodes');assert.equal(request.analysis.nodes,300000);
 exercise.dispose();assert.equal(await hint,null);assert.equal(terminated,true);
});
