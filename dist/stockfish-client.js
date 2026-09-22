import {STOCKFISH as C} from './stockfish-config.js?v=32';
import {parseInfo,completeCandidates,prepareCandidates} from './candidate-analysis.js?v=32';
import {Chess} from './chess.js?v=32';
import {validEngineProfile} from './strength.js?v=32';
import {decisionModeFor} from './cognitive-model.js?v=32';
export const uciPosition = data => {
 const game=new Chess();
 if(data.pgn)game.loadPgn(data.pgn);else if(data.fen)game.load(data.fen);
 if(data.fen&&game.fen()!==data.fen)throw Error('Position/history mismatch');
 const history=game.history({verbose:true}),moves=history.map(move=>move.from+move.to+(move.promotion||'')).join(' ');
 return {game,command:`position fen ${history[0]?.before||game.fen()}${moves?' moves '+moves:''}`};
};
export const createStockfishClient = (spawn=()=>new Worker('./stockfish19-worker.js?v=32',{type:'module'})) => {
 const client={onmessage:null,onerror:null};
 let worker=null,ready=false,dead=false,current=null,timer=null,stopTimer=null;
 const clearTimers=()=>{clearTimeout(timer);clearTimeout(stopTimer);};
 const disposeWorker=()=>{const previous=worker;worker=null;ready=false;previous?.terminate();};
 const fail=message=>{if(dead)return;dead=true;current=null;clearTimers();disposeWorker();client.onerror?.(new Error(message));};
 const send=command=>worker.postMessage(command);
 const finish=(token,recover=false)=>{
  const request=current;if(!request)return;
  try{
   const rows=completeCandidates(request.info,request.analysisOnly?request.expected:1);
   if(recover)token=rows[0]?.move;
   if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token||''))throw Error(recover?'Stockfish search timeout: no evaluated legal move':'Missing bestmove');
   const move={from:token.slice(0,2),to:token.slice(2,4),...(token[4]?{promotion:token[4]}:{})};
   const analysis=request.analysisOnly?prepareCandidates(request.position,rows):null;
   request.position.move(move);clearTimers();current=null;
   if(recover)disposeWorker();
   client.onmessage?.({data:{id:request.id,move,...(request.analysisOnly?{analysis,durationMs:performance.now()-request.startedAt,recovered:recover}:{})}});
  }catch(error){fail(error.message);}
 };
 const watchdog=(ms,stage)=>{clearTimeout(timer);timer=setTimeout(()=>stage==='search'?finish(null,true):fail(`Stockfish ${stage} timeout`),ms);};
 const search=()=>{
  if(!ready||!current||dead)return;
  try{
   const {game,command}=uciPosition(current),profile=current.engineProfile;
   if(!current.analysisOnly&&(!validEngineProfile(profile)||decisionModeFor(profile.targetElo)!=='native-stockfish'))throw Error('Native Stockfish requires a high-range v2 profile');
   if(game.isGameOver()){const id=current.id;current=null;client.onmessage?.({data:{id,move:null}});return;}
   current.position=game;current.info=[];current.startedAt=performance.now();
   current.expected=current.analysisOnly?Math.min(current.analysis?.multiPv||8,game.moves().length):1;
   send(`setoption name Hash value ${C.hashMb}`);send('setoption name Threads value 1');
   send('setoption name Skill Level value 20');
   send(`setoption name UCI_LimitStrength value ${!current.analysisOnly}`);
   if(!current.analysisOnly)send(`setoption name UCI_Elo value ${Math.round(Math.max(C.minElo,Math.min(C.maxElo,profile.effectiveElo)))}`);
   send(`setoption name MultiPV value ${current.expected}`);send('ucinewgame');send(command);
   watchdog(current.analysisOnly?C.analysisWatchdogMs:C.watchdogMs,'search');
   if(!current.analysisOnly)stopTimer=setTimeout(()=>{if(current&&!dead){try{send('stop');}catch(error){fail(error.message);}}},C.stopAfterMs);
   send(current.analysisOnly?`go depth ${current.analysis?.depth||12} nodes ${current.analysis?.nodes||1600000} movetime ${current.analysis?.milliseconds||8000}`:`go nodes ${C.nodes} movetime ${C.milliseconds}`);
  }catch(error){fail(error.message);}
 };
 const initialize=()=>{
  worker=spawn();const owned=worker;
  owned.onmessage=event=>{
   for(const line of String(event.data).split('\n')){
    if(dead||owned!==worker)return;
    if(line.trim()==='uciok'){send('isready');continue;}
    if(line.trim()==='readyok'){if(!ready){ready=true;clearTimeout(timer);search();}continue;}
    if(current?.info){const info=parseInfo(line);if(info)current.info.push(info);}
    if(line.startsWith('bestmove ')&&current)finish(line.split(/\s+/)[1]);
   }
  };
  owned.onerror=error=>{if(!dead&&owned===worker)fail(error?.message||'Stockfish worker failed');};
  watchdog(C.initializationMs,'initialization');send('uci');
 };
 client.postMessage=data=>{if(dead)throw Error('Stockfish terminated');if(current)throw Error('Search already running');current={...data};if(!worker)initialize();else search();};
 client.terminate=()=>{dead=true;current=null;clearTimers();disposeWorker();};
 initialize();return client;
};
