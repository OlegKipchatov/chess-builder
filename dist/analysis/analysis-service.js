import {Chess} from '../chess.js?v=73';
import {createStockfishClient} from '../stockfish-client.js?v=73';
import {engineLine} from '../stockfish-evaluation.js?v=73';
import {ANALYSIS_VERSION,PROFILE,ENGINE} from './analysis-config.js?v=73';
import {classifyMove,needsRefinement} from './analysis-classifier.js?v=73';
import {uci,describeLine,detectReason,verifyShortMate} from './analysis-reasons.js?v=73';
import {selectEvents} from './analysis-events.js?v=73';
import {eligibleEntry} from './analysis-storage.js?v=73';
import {prepareMateExercise} from './analysis-training.js?v=73';
const abortError = () => new DOMException('Analysis cancelled','AbortError');
export const analyzeGame = async (entry,{onProgress=()=>{},signal,createClient=createStockfishClient,profile=PROFILE}={}) => {
 if(!eligibleEntry(entry))throw Error('This archive entry cannot be analyzed');
 const jobId=crypto.randomUUID(),game=new Chess();game.loadPgn(entry.pgn);
 const history=game.history({verbose:true}),position=new Chess(history[0].before),prefixes=[];
 const moves=[];
 for(let index=0;index<history.length;index++){
  if(signal?.aborted)throw abortError();
  if(index%8===0)await new Promise(resolve=>setTimeout(resolve,0));
  const move=history[index];prefixes.push(position.pgn());position.move(move);
  moves.push({ply:index+1,actor:move.color===entry.playerColor?'player':'opponent',fenBefore:move.before,fenAfter:move.after,playedMove:uci(move),playedSan:move.san,status:move.color===entry.playerColor?'unavailable':'not_analyzed',alternatives:[],autoPause:false});
 }
 let client=null,requestId=0,rejectPending=null,cancelled=false,pipelineFailed=false;
 const timings=[];
 const cancel=()=>{cancelled=true;client?.terminate();client=null;rejectPending?.(abortError());};
 const check=()=>{if(cancelled||signal?.aborted)throw abortError();};
 signal?.addEventListener('abort',cancel,{once:true});
 const search = (move,nodes,searchMove) => new Promise((resolve,reject)=>{
  check();client ||= createClient();const owned=client,id=++requestId,start=performance.now();rejectPending=reject;
  owned.onmessage=({data})=>{
   if(cancelled||owned!==client||data.id!==id||data.requestId!==id||data.jobId!==jobId||data.moveIndex!==move.ply)return;
   rejectPending=null;
   if(data.recovered||!Array.isArray(data.lines)||!data.lines.length){reject(Error('Incomplete search'));return;}
   timings.push({ply:move.ply,nodes,restricted:!!searchMove,ms:performance.now()-start});resolve(data.lines);
  };
  owned.onerror=error=>{if(owned!==client||cancelled)return;rejectPending=null;reject(error);};
  owned.postMessage({id,requestId:id,jobId,moveIndex:move.ply,pgn:prefixes[move.ply-1],fen:move.fenBefore,analysisOnly:true,searchMove,analysis:{mode:'nodes',nodes,multiPv:profile.multiPv}});
 });
 const evaluate = async (move,nodes) => {
  const board=new Chess(move.fenBefore),forced=board.moves().length===1;
  const raw=await search(move,nodes);check();
  const expected=Math.min(profile.multiPv,board.moves().length);
  if(raw.length!==expected)throw Error('Incomplete MultiPV');
  const lines=raw.map(row=>engineLine(row,board.turn(),entry.playerColor));
  let playedLine=lines.find(line=>line.move===move.playedMove);
  if(!playedLine){const [row]=await search(move,nodes,move.playedMove);if(row?.move!==move.playedMove)throw Error('Wrong restricted result');playedLine=engineLine(row,board.turn(),entry.playerColor);}
  check();
  // Separate searches may improve the actual line. Never recommend a weaker line.
  const bestLine=[...lines,playedLine].sort((a,b)=>b.expectedScorePlayer-a.expectedScorePlayer)[0];
  const result={...move,shortMate:null,exercise:null,status:'complete',bestLine,playedLine,...classifyMove({bestLine,playedLine,lines,forced})};
  const decorate=line=>{const evidence=describeLine(move.fenBefore,line,entry.playerColor);if(!evidence.valid)throw Error('Illegal engine PV');line.san=evidence.san[0];line.pvSan=evidence.san;return evidence;};
  result.bestEvidence=decorate(bestLine);result.playedEvidence=decorate(playedLine);lines.forEach(decorate);
  result.reason=detectReason(result);result.explanationKey=result.reason||result.quality;
  if(result.mateTransition==='missed_mate')result.shortMate=await verifyShortMate(move.fenBefore,bestLine,check);
  result.alternatives=lines.filter(line=>line.move!==move.playedMove&&(line.move===bestLine.move||(bestLine.expectedScorePlayer-line.expectedScorePlayer<=PROFILE.bestCluster&&(bestLine.score.type!=='mate'||bestLine.score.value<=0||line.score.type==='mate'&&line.score.value>0)))).slice(0,2);
  result.recommendationRequired=['mistake','blunder'].includes(result.quality)||result.mateTransition==='missed_mate';
  delete result.bestEvidence;delete result.playedEvidence;
  return result;
 };
 const run = async (targets,stage,nodes) => {
  let done=0;onProgress({stage,done,total:targets.length});
  for(const index of targets){check();try {moves[index]=await evaluate(moves[index],nodes);}catch(error){
    check();pipelineFailed=true;client?.terminate();client=null;
    // Stop on an engine failure; never restart the same broken Worker for every remaining move.
    for(const pending of targets.slice(done))moves[pending]={...moves[pending],status:'unavailable',quality:undefined,highlight:null,reason:null,autoPause:false};
    onProgress({stage,done,total:targets.length});break;
   }
   check();
   if(stage==='deep'&&moves[index].shortMate?.verified)moves[index].exercise=await prepareMateExercise(moves[index],check);
   check();onProgress({stage,done:++done,total:targets.length});
  }
 };
 try {
  check();await run(moves.map((move,i)=>move.actor==='player'?i:-1).filter(i=>i>=0),'quick',profile.quickNodes);
  if(!pipelineFailed)await run(moves.map((move,i)=>needsRefinement(move)?i:-1).filter(i=>i>=0),'deep',profile.deepNodes);check();
  const summary={best:0,good:0,inaccuracy:0,mistake:0,blunder:0,excellent:0};
  moves.filter(move=>move.status==='complete').forEach(move=>{summary[move.quality]++;if(move.highlight)summary.excellent++;});
  const analyzedPlayerMoves=moves.filter(move=>move.actor==='player'&&move.status==='complete').length,total=history.filter(move=>move.color===entry.playerColor).length;
  return {analysisVersion:ANALYSIS_VERSION,profileVersion:profile.version,engine:{...ENGINE},gameId:entry.id,sourcePgn:entry.pgn,playerColor:entry.playerColor,createdAt:new Date().toISOString(),status:analyzedPlayerMoves===total?'complete':analyzedPlayerMoves?'partial':'failed',totalPlies:moves.length,analyzedPlayerMoves,moves,focusEvents:selectEvents(moves),summary,diagnostics:{searches:timings}};
 }finally{signal?.removeEventListener('abort',cancel);client?.terminate();rejectPending=null;}
};
