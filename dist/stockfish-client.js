import {Chess} from './chess.js?v=23';
import {stockfishProfile,validEngineProfile} from './strength.js?v=23';

const INITIALIZATION_MS=60000,SEARCH_MS=5000,NATIVE_MIN_ELO=1320,NATIVE_MAX_ELO=3190;

export const uciPosition = data => {
  const game=new Chess();
  if(data.pgn)game.loadPgn(data.pgn);else if(data.fen)game.load(data.fen);
  if(data.fen&&game.fen()!==data.fen)throw Error('Position/history mismatch');
  const history=game.history({verbose:true}),moves=history.map(move=>move.from+move.to+(move.promotion||'')).join(' ');
  return {game,command:`position fen ${history[0]?.before||game.fen()}${moves?' moves '+moves:''}`};
};

export const createStockfishClient = (spawn=()=>new Worker('./stockfish19-worker.js?v=23',{type:'module'})) => {
  const client={onmessage:null,onerror:null};
  let worker=null,ready=false,dead=false,current=null,timer=null;
  const clearTimer=()=>{clearTimeout(timer);timer=null;};
  const dispose=()=>{const previous=worker;worker=null;ready=false;previous?.terminate();};
  const fail=message=>{if(dead)return;dead=true;clearTimer();dispose();client.onerror?.(new Error(message));};
  const send=command=>worker.postMessage(command);
  const watchdog=(ms,stage)=>{clearTimer();timer=setTimeout(()=>fail(`Stockfish ${stage} timeout`),ms);};
  const finish=token=>{
    const request=current;if(!request)return;
    try{
      if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token||''))throw Error('Missing bestmove');
      const move={from:token.slice(0,2),to:token.slice(2,4),...(token[4]?{promotion:token[4]}:{})};
      request.position.move(move);clearTimer();current=null;
      client.onmessage?.({data:{id:request.id,move}});
    } catch(error){fail(error.message);}
  };
  const search=()=>{
    if(!ready||!current||dead)return;
    try{
      const {game,command}=uciPosition(current),profile=current.engineProfile||stockfishProfile(current.rating);
      if(!validEngineProfile(profile))throw Error('Invalid engine profile');
      if(game.isGameOver()){const id=current.id;current=null;client.onmessage?.({data:{id,move:null}});return;}
      current.position=game;
      const native=profile.id==='cognitive-v2'&&profile.mode==='native';
      send('setoption name Hash value 16');send('setoption name Threads value 1');
      send(`setoption name UCI_LimitStrength value ${native?'true':'false'}`);
      if(native)send(`setoption name UCI_Elo value ${Math.max(NATIVE_MIN_ELO,Math.min(NATIVE_MAX_ELO,Math.round(profile.effectiveElo)))}`);
      else send(`setoption name Skill Level value ${profile.skill}`);
      send('setoption name MultiPV value 1');send('ucinewgame');send(command);
      watchdog(SEARCH_MS,'search');
      send(native?'go movetime 1500':`go nodes ${profile.nodes} movetime ${profile.milliseconds}`);
    } catch(error){fail(error.message);}
  };
  const initialize=()=>{
    worker=spawn();const owned=worker;
    owned.onmessage=event=>{
      for(const line of String(event.data).split('\n')){
        if(dead||owned!==worker)return;
        if(line.trim()==='uciok'){send('isready');continue;}
        if(line.trim()==='readyok'){if(!ready){ready=true;clearTimer();search();}continue;}
        if(line.startsWith('bestmove ')&&current)finish(line.split(/\s+/)[1]);
      }
    };
    owned.onerror=error=>{if(!dead&&owned===worker)fail(error?.message||'Stockfish worker failed');};
    watchdog(INITIALIZATION_MS,'initialization');send('uci');
  };
  client.postMessage=data=>{if(dead)throw Error('Stockfish terminated');if(current)throw Error('Search already running');current={...data};if(!worker)initialize();else search();};
  client.terminate=()=>{dead=true;current=null;clearTimer();dispose();};
  initialize();return client;
};

export const createStockfish19Client = () => createStockfishClient(()=>new Worker('./stockfish19-worker.js?v=23',{type:'module'}));
