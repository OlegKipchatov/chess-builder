import {DIFFICULTY as C} from './difficulty-config.js?v=19';
import {parseInfo,completeCandidates,prepareCandidates,attachPerception} from './candidate-analysis.js?v=19';
import {selectCandidate,seededRandom,positionSeed} from './difficulty-model.js?v=19';
import {Chess} from './chess.js?v=19';
import {stockfishProfile,validEngineProfile} from './strength.js?v=19';
export const uciPosition = data => {
 const game=new Chess();
 if(data.pgn)game.loadPgn(data.pgn);else if(data.fen)game.load(data.fen);
 if(data.fen&&game.fen()!==data.fen)throw Error('Position/history mismatch');
 const history=game.history({verbose:true});
 const moves=history.map(move=>move.from+move.to+(move.promotion||'')).join(' ');
 return {game,command:`position fen ${history[0]?.before||game.fen()}${moves?' moves '+moves:''}`};
};
export const createStockfishClient = (spawn=()=>new Worker('./vendor/stockfish-18-lite-single.js')) => {
 const worker=spawn(),client={onmessage:null,onerror:null};
 let ready=false,dead=false,current=null,timer=null;
 const fail=message=>{if(dead)return;dead=true;clearTimeout(timer);worker.terminate();client.onerror?.(new Error(message));};
 const watchdog=ms=>{clearTimeout(timer);timer=setTimeout(()=>fail('Stockfish timeout'),ms);};
 const send=command=>worker.postMessage(command);
 const search=()=>{
  if(!ready||!current||dead)return;
  try {
   const {game,command}=uciPosition(current),profile=current.engineProfile||stockfishProfile(current.rating);
   if(!validEngineProfile(profile))throw Error('Invalid engine profile');
   if(game.isGameOver()){const id=current.id;current=null;client.onmessage?.({data:{id,move:null}});return;}
   current.position=game;current.info=[];current.startedAt=performance.now();
   current.humanized=profile.id==='humanized19-v1';
   current.profile=profile;
   send(`setoption name Hash value ${C.hashMb}`);send('setoption name Threads value 1');send('setoption name UCI_LimitStrength value false');
   send(`setoption name Skill Level value ${current.humanized?20:profile.skill}`);
   current.expected=Math.min(current.analysis?.multiPv||C.multiPv,game.moves().length);
   send(`setoption name MultiPV value ${current.humanized?current.expected:1}`);send('ucinewgame');send(command);
   watchdog(C.watchdogMs);send(current.humanized?`go depth ${current.analysis?.depth||C.analysisDepth} nodes ${current.analysis?.nodes||C.analysisNodes}${current.analysis?.milliseconds?` movetime ${current.analysis.milliseconds}`:''}`:`go nodes ${profile.nodes} movetime ${profile.milliseconds}`);
  } catch(error){fail(error.message);}
 };
 worker.onmessage=event=>{
  if(dead)return;
  for(const line of String(event.data).split('\n')){
   if(line.trim()==='uciok'){send('isready');continue;}
   if(line.trim()==='readyok'){ready=true;clearTimeout(timer);search();continue;}
   if(current?.humanized){const info=parseInfo(line);if(info)current.info.push(info);}
   if(!line.startsWith('bestmove ')||!current)continue;
   let token=line.split(/\s+/)[1];const id=current.id;
   try {
    let analysis=null;
    if(current.humanized){
     const rows=completeCandidates(current.info,current.expected);
     analysis=attachPerception(prepareCandidates(current.position,rows),completeCandidates(current.info.filter(row=>row.depth<=C.perception.depth),current.expected));
     if(analysis.candidates.length)token=selectCandidate(analysis.candidates,current.profile.effectiveElo,analysis.context,seededRandom(positionSeed(current.profile.seed,current.position.fen()))).move;
    }
    const durationMs=performance.now()-current.startedAt,analysisOnly=current.analysisOnly;
    if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token))throw Error('Missing bestmove');
    const move={from:token.slice(0,2),to:token.slice(2,4),...(token[4]?{promotion:token[4]}:{})};
    current.position.move(move);clearTimeout(timer);current=null;
    client.onmessage?.({data:{id,move,...(analysisOnly?{analysis,durationMs}: {})}});
   }catch(error){fail(error.message);}
  }
 };
 worker.onerror=()=>fail('Stockfish worker failed');
 client.postMessage=data=>{if(dead)throw Error('Stockfish terminated');if(current)throw Error('Search already running');current={...data};search();};
 client.terminate=()=>{dead=true;current=null;clearTimeout(timer);worker.terminate();};
 watchdog(C.initializationMs);send('uci');return client;
};

export const createStockfish19Client = () => createStockfishClient(()=>new Worker('./stockfish19-worker.js?v=19',{type:'module'}));
