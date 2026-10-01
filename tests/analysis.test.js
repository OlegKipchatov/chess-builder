import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWdl,expectedScore} from '../dist/stockfish-evaluation.js';
import {classifyMove} from '../dist/analysis/analysis-classifier.js';
import {selectEvents} from '../dist/analysis/analysis-events.js';
import {analyzeGame} from '../dist/analysis/analysis-service.js';
import {isCompatible,attachAnalysis,eligibleEntry} from '../dist/analysis/analysis-storage.js';
import {createAnalysisPlayback} from '../dist/analysis/analysis-playback.js';
import {initialState,migrateState} from '../dist/state.js';
import {createStockfishClient} from '../dist/stockfish-client.js';
import {STOCKFISH} from '../dist/stockfish-config.js';
import {Chess} from '../dist/chess.js';
import {uci,detectReason,verifyShortMate} from '../dist/analysis/analysis-reasons.js';
import {spawnStockfish} from '../scripts/stockfish-process.mjs';
const line=(score,move='e2e4',mate=null)=>({move,expectedScorePlayer:score,score:{type:mate===null?'cp':'mate',value:mate??0},pv:[move]});
const entry=(pgn='1. e4 e5 2. Nf3 Nc6',color='w')=>({id:'test-game',mode:'bot',playerColor:color,pgn,finishedAt:'2026-10-01',result:'Поражение'});
const suppliedPgn='1. Nc3 c6 2. Nf3 d5 3. d4 f6 4. Nxd5 cxd5 5. a4 e5 6. Nxe5 fxe5 7. Bf4 exf4 8. Kd2 g5 9. h4 Bg7 10. Rh3 Bxd4 11. Rh2 Bxb2 12. Ra2 Qb6 13. hxg5 h6 14. Rh4 Qb4+ 15. c3 Qxc3# 0-1';
test('reported game: both mate-in-two opportunities verified, no invented mistakes, one episode stop',{timeout:60000},async()=>{
 const result=await analyzeGame(entry(suppliedPgn,'b'),{createClient:()=>createStockfishClient(spawnStockfish)});
 assert.equal(result.status,'complete');
 for(const ply of [24,26]){
  const move=result.moves[ply-1];assert.equal(move.reason,'mate_opportunity');assert.equal(move.quality,'best');
  assert.deepEqual(move.shortMate,{moves:2,verified:true});assert.equal(move.recommendationRequired,true);
  assert.ok(move.exercise.solutions.some(solution=>solution.move===move.bestLine.move));
  const board=new Chess(move.fenBefore);move.bestLine.pv.forEach(token=>board.move({from:token.slice(0,2),to:token.slice(2,4),promotion:token[4]}));assert.ok(board.isCheckmate());
 }
 assert.ok(result.focusEvents.includes(24));assert.ok(result.focusEvents.includes(26));
});
test('short mate validation rejects unsupported claims and observes cancellation',async()=>{
 assert.equal(await verifyShortMate(new Chess().fen(),line(1,'e2e4',2)),null);
 const game=new Chess();game.loadPgn(suppliedPgn);const fen=game.history({verbose:true})[23].before;
 await assert.rejects(verifyShortMate(fen,line(1,'d8a5',2),()=>{throw new DOMException('Cancelled','AbortError');}),{name:'AbortError'});
 assert.equal(await verifyShortMate(fen,line(1,'d8a5',3)),null);
});
test('every visible useful card pauses, including repeated opportunities',()=>{
 const rows=Array.from({length:10},(_,i)=>({ply:i+1,actor:i%2?'opponent':'player',status:i%2?'not_analyzed':'complete',quality:'best',reason:i%2?null:'mate_opportunity'}));
 assert.deepEqual(selectEvents(rows),[1,3,5,7,9]);assert.equal(rows[8].reason,'mate_opportunity');
 rows.push({ply:11,actor:'player',status:'complete',quality:'good'}, {ply:13,actor:'player',status:'complete',quality:'best',reason:'mate_opportunity'}, {ply:15,actor:'player',status:'complete',quality:'blunder',reason:'missed_mate',expectedScoreLoss:.5});
 assert.deepEqual(selectEvents(rows),[1,3,5,7,9,13,15]);
 assert.equal(detectReason({mateTransition:'missed_mate',expectedScoreLoss:.5}),'missed_mate');
});
const fakeFactory=(requests,{outside=false,stale=false}={})=>()=>{
 const client={terminate:()=>{client.dead=true;},postMessage:data=>{
  requests.push(data);const game=new Chess(data.fen),legal=game.moves({verbose:true}).map(uci);
  const selected=data.searchMove?[data.searchMove]:outside?legal.filter(move=>!['e2e4','g1f3'].includes(move)).slice(0,3):legal.slice(0,Math.min(3,legal.length));
  const lines=selected.map((move,i)=>({move,scoreType:'cp',scoreValue:0,wdl:[250,500,250],pv:[move],depth:8,index:i+1}));
  queueMicrotask(()=>{if(stale)client.onmessage({data:{...data,id:data.id-1,lines}});client.onmessage({data:{...data,lines}});});
 }};return client;
};
test('WDL is normalized once for white, black and opposite root; malformed data rejected',()=>{
 assert.deepEqual(normalizeWdl([600,300,100],'w','w'),{win:.6,draw:.3,loss:.1});
 assert.deepEqual(normalizeWdl([600,300,100],'b','b'),{win:.6,draw:.3,loss:.1});
 assert.deepEqual(normalizeWdl([600,300,100],'w','b'),{win:.1,draw:.3,loss:.6});
 assert.equal(expectedScore({wdl:[600,300,100]},'b','b'),.75);
 assert.throws(()=>normalizeWdl([1,2,3]));
});
for(const [loss,quality] of [[0,'best'],[.004,'best'],[.02,'good'],[.05,'inaccuracy'],[.1,'mistake'],[.2,'blunder']])test(`decision loss ${loss}: ${quality}`,()=>assert.equal(classifyMove({bestLine:line(.8),playedLine:line(.8-loss)}).quality,quality));
test('excellent needs measured significance and excludes forced decisions',()=>{
 const best=line(.8),second=line(.7,'d2d4');
 assert.equal(classifyMove({bestLine:best,playedLine:best,lines:[best,second]}).highlight,'excellent');
 assert.equal(classifyMove({bestLine:best,playedLine:best,lines:[best,line(.798,'d2d4')]}).highlight,null);
 const forced=classifyMove({bestLine:best,playedLine:best,lines:[best,second],forced:true});assert.equal(forced.highlight,null);assert.equal(forced.quality,'best');
});
test('mate transitions are separate from numeric loss',()=>{
 const allowed=classifyMove({bestLine:line(.02),playedLine:line(0,'e2e4',-3)});assert.equal(allowed.quality,'blunder');assert.equal(allowed.mateTransition,'allowed_mate');
 const missed=classifyMove({bestLine:line(1,'d2d4',4),playedLine:line(.999)});assert.equal(missed.quality,'best');assert.equal(missed.mateTransition,'missed_mate');
 assert.equal(classifyMove({bestLine:line(1,'d2d4',4),playedLine:line(1,'e2e4',6)}).quality,'best');
 assert.equal(classifyMove({bestLine:line(0,'d2d4',-10),playedLine:line(0,'e2e4',-1)}).quality,'best');
});
test('event selection never caps errors, prioritizes mates and does not invent positive events',()=>{
 const rows=Array.from({length:20},(_,i)=>({ply:i+1,actor:'player',status:'complete',quality:i===0?'inaccuracy':'blunder',expectedScoreLoss:i/100,reason:i===1?'allowed_mate':'generic'}));
 const events=selectEvents(rows);assert.equal(events.length,20);assert.ok(events.includes(2));assert.equal(rows[0].autoPause,true);assert.equal(rows[1].primaryEvent,'allowed_mate');
 assert.deepEqual(selectEvents([{ply:1,status:'complete',quality:'best',forced:true,highlight:'excellent'}]),[]);
});
test('PGN pipeline analyzes player decisions, searches actual outside MultiPV, ignores stale replies and persists reloadable cache',async()=>{
 const calls=[],e=entry(),analysis=await analyzeGame(e,{createClient:fakeFactory(calls,{outside:true,stale:true})});
 assert.equal(analysis.status,'complete');assert.equal(analysis.analyzedPlayerMoves,2);
 assert.equal(analysis.moves[1].status,'not_analyzed');assert.ok(calls.some(call=>call.searchMove==='e2e4'));
 assert.ok(calls.every(call=>new Chess(call.fen).turn()==='w'&&call.analysis.mode==='nodes'));
 assert.ok(analysis.moves.filter(row=>row.actor==='player').every(row=>row.quality==='best'&&!row.autoPause));
 assert.ok(isCompatible(analysis,e));assert.equal(isCompatible({...analysis,analysisVersion:'old'},e),false);
 assert.equal(isCompatible({...analysis,profileVersion:'old'},e),false);assert.equal(isCompatible({...analysis,engine:{...analysis.engine,version:'old'}},e),false);
 const saved=attachAnalysis({...initialState(),archive:[e]},e.id,analysis);assert.ok(isCompatible(migrateState(JSON.parse(JSON.stringify(saved))).archive[0].analysis,e));
});
test('cancellation terminates worker, rejects pending search, ignores late completion',async()=>{
 const controller=new AbortController();let client,terminated=false,request;
 const pending=analyzeGame(entry(),{signal:controller.signal,createClient:()=>client={postMessage:data=>{request=data;},terminate:()=>{terminated=true;}}});
 while(!request)await new Promise(resolve=>setTimeout(resolve,0));
 controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.ok(terminated);
 client.onmessage({data:{...request,lines:[]}});
});
test('bounded client does not recover timeout or accept incomplete MultiPV',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const commands=[],errors=[],replies=[];
 const worker={postMessage:command=>commands.push(command),terminate:()=>{}};
 const client=createStockfishClient(()=>worker);client.onerror=error=>errors.push(error.message);client.onmessage=event=>replies.push(event);
 client.postMessage({id:1,fen:new Chess().fen(),analysisOnly:true,analysis:{mode:'nodes',nodes:75000,multiPv:3}});
 worker.onmessage({data:'uciok\nreadyok\ninfo depth 4 multipv 1 score cp 20 wdl 300 500 200 pv e2e4 e7e5'});
 assert.equal(commands.at(-1),'go nodes 75000');assert.ok(commands.includes('setoption name UCI_ShowWDL value true'));
 t.mock.timers.tick(STOCKFISH.analysisWatchdogMs);assert.match(errors[0],/timed out/);assert.equal(replies.length,0);
});
test('playback pauses after animation, resumes, and manual navigation invalidates pending autoplay',async()=>{
 let tick,resolveAnimation;const states=[];
 const player=createAnalysisPlayback({analysis:{totalPlies:3,focusEvents:[1]},schedule:cb=>{tick=cb;return 1;},unschedule:()=>{},showPly:(_,animate)=>animate?new Promise(resolve=>{resolveAnimation=resolve;}):Promise.resolve(),onChange:value=>states.push(value)});
 await player.play();const running=tick();assert.equal(player.getSnapshot().state,'playing');resolveAnimation();await running;assert.equal(player.getSnapshot().state,'pausedForInsight');
 await player.play();const late=tick();await player.seek(0);resolveAnimation();await late;assert.deepEqual(player.getSnapshot(),{ply:0,state:'pausedByUser'});player.dispose();
});
test('eligibility excludes technical failures, local games and zero player decisions',()=>{
 assert.equal(eligibleEntry({...entry(),counted:false}),false);assert.equal(eligibleEntry(entry('1. e4','b')),false);assert.equal(eligibleEntry({...entry(),mode:'local'}),false);assert.ok(eligibleEntry(entry()));
});
test('mate game with real SF19: both colors, bounded passes, legal short PV', {timeout:60000},async()=>{
 for(const color of ['w','b']){
  const result=await analyzeGame(entry('1. f3 e5 2. g4 Qh4#',color),{createClient:()=>createStockfishClient(()=>spawnStockfish(19))});
  assert.equal(result.status,'complete');assert.equal(result.analyzedPlayerMoves,2);
  if(color==='w'){assert.equal(result.moves[2].reason,'allowed_mate');assert.equal(result.moves[2].quality,'blunder');}
  assert.ok(result.moves.filter(row=>row.status==='complete').every(row=>row.bestLine.pv.length<=4&&row.bestLine.pvSan.length));
 }
});
const fromFen=(fen,sans,color='w')=>{const game=new Chess(fen);sans.forEach(san=>game.move(san));return entry(game.pgn(),color);};
for(const [name,e] of [
 ['promotion',fromFen('7k/P7/8/8/8/8/8/7K w - - 0 1',['a8=Q+'])],
 ['castling',fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',['O-O'])],
 ['en passant',entry('1. e4 a6 2. e5 d5 3. exd6')],
 ['stalemate',fromFen('7k/5K2/8/6Q1/8/8/8/8 w - - 0 1',['Qg6'])],
 ['insufficient material',fromFen('7k/8/8/8/8/8/1n6/K4B2 w - - 0 1',['Kxb2'])],
 ['50-move draw',fromFen('7k/8/8/8/8/8/8/R6K w - - 99 1',['Ra2'])],
 ['threefold repetition',entry('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8')],
 ['forced move',fromFen('7k/8/5K2/8/8/8/8/7R b - - 0 1',['Kg8'],'b')]
])test(`replay edge case: ${name}`,async()=>{
 const calls=[],result=await analyzeGame(e,{createClient:fakeFactory(calls)});
 assert.equal(result.status,'complete');assert.ok(calls.every(call=>!new Chess(call.fen).isGameOver()));
 const actual=new Chess();actual.loadPgn(e.pgn);assert.equal(result.moves.at(-1).fenAfter,actual.fen());
 if(name==='promotion')assert.equal(result.moves[0].playedMove,'a7a8q');
 if(name==='forced move'){assert.equal(result.moves[0].quality,'best');assert.equal(result.moves[0].reason,null);assert.equal(result.moves[0].highlight,null);assert.equal(result.moves[0].autoPause,false);}
});
test('incomplete quick/deep search never produces a complete cached result',async()=>{
 const result=await analyzeGame(entry(),{createClient:()=>{const client={terminate:()=>{},postMessage:data=>queueMicrotask(()=>client.onmessage({data:{...data,lines:[],recovered:true}}))};return client;}});
 assert.equal(result.status,'failed');assert.equal(result.analyzedPlayerMoves,0);assert.equal(isCompatible(result,entry()),false);
});
test('reason detector remains generic without evidence and confirms material loss with legal PV evidence',()=>{
 assert.equal(detectReason({quality:'blunder'}),'generic');
 assert.equal(detectReason({quality:'blunder',bestEvidence:{valid:true,delta:0},playedEvidence:{valid:true,delta:-3}}),'lost_material');
});
test('deep refinement replaces preliminary mistake rather than retaining its event',async()=>{
 const e=entry('1. e4'),calls=[];
 const factory=()=>{
  const client={terminate:()=>{},postMessage:data=>{
   calls.push(data);const moves=data.searchMove?[data.searchMove]:['d2d4','e2e4','c2c4'];
   const lines=moves.map((move,i)=>({move,scoreType:'cp',scoreValue:0,wdl:data.analysis.nodes===75000&&move==='e2e4'?[100,500,400]:[400,400,200],pv:[move],depth:8,index:i+1}));
   queueMicrotask(()=>client.onmessage({data:{...data,lines}}));
  }};return client;
 };
 const result=await analyzeGame(e,{createClient:factory});
 assert.ok(calls.some(call=>call.analysis.nodes===300000));assert.equal(result.moves[0].quality,'best');assert.deepEqual(result.focusEvents,[]);
});
test('unique forced mate is meaningful even when WDL is saturated',()=>{
 const actual=line(1,'e2e4',2),second=line(1,'d2d4');
 assert.equal(classifyMove({bestLine:actual,playedLine:actual,lines:[actual,second]}).highlight,'excellent');
});
test('engine failure terminates the job instead of spawning a broken worker for every move',async()=>{
 let spawned=0,terminated=0;
 const result=await analyzeGame(entry(),{createClient:()=>{
  spawned++;const client={postMessage:()=>queueMicrotask(()=>client.onerror(Error('Worker failed'))),terminate:()=>{terminated++;}};return client;
 }});
 assert.equal(result.status,'failed');assert.equal(spawned,1);assert.equal(terminated,1);
});
