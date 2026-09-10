import {Chess} from './chess.js?v=7';
import {stockfishProfile,validEngineProfile} from './strength.js?v=7';
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
   current.position=game;
   send('setoption name Hash value 16');send('setoption name UCI_LimitStrength value false');
   send(`setoption name Skill Level value ${profile.skill}`);send('ucinewgame');send(command);
   watchdog(15000);send(`go nodes ${profile.nodes} movetime ${profile.milliseconds}`);
  } catch(error){fail(error.message);}
 };
 worker.onmessage=event=>{
  if(dead)return;
  for(const line of String(event.data).split('\n')){
   if(line.trim()==='uciok'){send('isready');continue;}
   if(line.trim()==='readyok'){ready=true;clearTimeout(timer);search();continue;}
   if(!line.startsWith('bestmove ')||!current)continue;
   const token=line.split(/\s+/)[1],id=current.id;
   try {
    if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token))throw Error('Missing bestmove');
    const move={from:token.slice(0,2),to:token.slice(2,4),...(token[4]?{promotion:token[4]}:{})};
    current.position.move(move);clearTimeout(timer);current=null;
    client.onmessage?.({data:{id,move}});
   }catch(error){fail(error.message);}
  }
 };
 worker.onerror=()=>fail('Stockfish worker failed');
 client.postMessage=data=>{if(dead)throw Error('Stockfish terminated');if(current)throw Error('Search already running');current={...data};search();};
 client.terminate=()=>{dead=true;current=null;clearTimeout(timer);worker.terminate();};
 watchdog(60000);send('uci');return client;
};
