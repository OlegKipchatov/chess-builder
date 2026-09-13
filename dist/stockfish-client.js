import {DIFFICULTY as C} from './difficulty-config.js?v=21';
import {parseInfo,completeCandidates,prepareCandidates,attachPerception} from './candidate-analysis.js?v=21';
import {selectCandidate,seededRandom,positionSeed} from './difficulty-model.js?v=21';
import {Chess} from './chess.js?v=21';
import {stockfishProfile,validEngineProfile} from './strength.js?v=21';
export const uciPosition = data => {
 const game=new Chess();
 if(data.pgn)game.loadPgn(data.pgn);else if(data.fen)game.load(data.fen);
 if(data.fen&&game.fen()!==data.fen)throw Error('Position/history mismatch');
 const history=game.history({verbose:true});
 const moves=history.map(move=>move.from+move.to+(move.promotion||'')).join(' ');
 return {game,command:`position fen ${history[0]?.before||game.fen()}${moves?' moves '+moves:''}`};
};
export const createStockfishClient = (spawn=()=>new Worker('./vendor/stockfish-18-lite-single.js')) => {
 const client={onmessage:null,onerror:null};
 let worker=null,ready=false,dead=false,current=null,timer=null,stopTimer=null;
 const clearTimers=()=>{clearTimeout(timer);clearTimeout(stopTimer);};
 const disposeWorker=()=>{const previous=worker;worker=null;ready=false;previous?.terminate();};
 const fail=message=>{if(dead)return;dead=true;clearTimers();disposeWorker();client.onerror?.(new Error(message));};
 const send=command=>worker.postMessage(command);
 const finish=(token,recover=false)=>{
  const request=current;if(!request)return;
  try{
   let analysis=null;
   if(request.humanized){
    let rows=completeCandidates(request.info,request.expected);
    if(recover&&!rows.length)rows=completeCandidates(request.info.filter(row=>row.index===1),1);
    analysis=attachPerception(prepareCandidates(request.position,rows),completeCandidates(request.info.filter(row=>row.depth<=C.perception.depth),request.expected));
    if(analysis.candidates.length)token=selectCandidate(analysis.candidates,request.profile.effectiveElo,analysis.context,seededRandom(positionSeed(request.profile.seed,request.position.fen()))).move;
   }
   if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token||''))throw Error(recover?'Stockfish search timeout: no evaluated legal move':'Missing bestmove');
   const move={from:token.slice(0,2),to:token.slice(2,4),...(token[4]?{promotion:token[4]}:{})};
   request.position.move(move);clearTimers();current=null;
   // The abandoned engine must be gone before exposing its recovered move or accepting a new request.
   if(recover)disposeWorker();
   client.onmessage?.({data:{id:request.id,move,...(request.analysisOnly?{analysis,durationMs:performance.now()-request.startedAt,recovered:recover}: {})}});
  }catch(error){fail(error.message);}
 };
 const watchdog=(ms,stage)=>{clearTimeout(timer);timer=setTimeout(()=>stage==='search'&&current?.humanized?finish(null,true):fail(`Stockfish ${stage} timeout`),ms);};
 const search=()=>{
  if(!ready||!current||dead)return;
  try{
   const {game,command}=uciPosition(current),profile=current.engineProfile||stockfishProfile(current.rating);
   if(!validEngineProfile(profile))throw Error('Invalid engine profile');
   if(game.isGameOver()){const id=current.id;current=null;client.onmessage?.({data:{id,move:null}});return;}
   current.position=game;current.info=[];current.startedAt=performance.now();current.humanized=profile.id==='humanized19-v1';current.profile=profile;
   send(`setoption name Hash value ${C.hashMb}`);send('setoption name Threads value 1');send('setoption name UCI_LimitStrength value false');
   send(`setoption name Skill Level value ${current.humanized?20:profile.skill}`);
   current.expected=Math.min(current.analysis?.multiPv||C.multiPv,game.moves().length);
   send(`setoption name MultiPV value ${current.humanized?current.expected:1}`);send('ucinewgame');send(command);
   const milliseconds=current.analysis?.milliseconds??(current.analysisOnly?null:C.moveTimeMs);
   watchdog(current.analysisOnly?C.analysisWatchdogMs:C.watchdogMs,'search');
   if(!current.analysisOnly)stopTimer=setTimeout(()=>{if(current&&!dead){try{send('stop');}catch(error){fail(error.message);}}},C.stopAfterMs);
   send(current.humanized?`go depth ${current.analysis?.depth||C.analysisDepth} nodes ${current.analysis?.nodes||C.analysisNodes}${milliseconds?` movetime ${milliseconds}`:''}`:`go nodes ${profile.nodes} movetime ${profile.milliseconds}`);
  }catch(error){fail(error.message);}
 };
 const initialize=()=>{
  worker=spawn();const owned=worker;
  owned.onmessage=event=>{
   for(const line of String(event.data).split('\n')){
    if(dead||owned!==worker)return;
    if(line.trim()==='uciok'){send('isready');continue;}
    if(line.trim()==='readyok'){if(!ready){ready=true;clearTimeout(timer);search();}continue;}
    if(current?.humanized){const info=parseInfo(line);if(info)current.info.push(info);}
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

export const createStockfish19Client = () => createStockfishClient(()=>new Worker('./stockfish19-worker.js?v=21',{type:'module'}));
