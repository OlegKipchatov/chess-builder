import {Chess} from './chess.js?v=74';
import {createStockfishClient} from './stockfish-client.js?v=74';
import {expectedScore,summarizeQuality} from './reward-quality.js?v=74';
// A separate full-strength fixed-node profile, never the adaptive opponent.
export const analyzeReward = async (entry,{onProgress=()=>{},createClient=createStockfishClient}={}) => {
 const final=new Chess();final.loadPgn(entry.pgn);
 const history=final.history({verbose:true}),position=new Chess(history[0]?.before||final.fen());
 const decisions=[],client=createClient();let id=0;
 const search = searchMove => new Promise((resolve,reject)=>{
  client.onmessage=({data})=>resolve(data.evaluation);client.onerror=reject;
  client.postMessage({id:++id,pgn:position.pgn(),fen:position.fen(),economy:true,searchMove});
 });
 try{
  const total=history.filter(move=>move.color===entry.playerColor).length;let done=0;
  for(const move of history){
   const token=move.from+move.to+(move.promotion||'');
   if(move.color===entry.playerColor){
    if(position.moves().length<=1)decisions.push({forced:true});
    else {
     const best=await search();
     const played=best.move===token?best:await search(token);
     decisions.push({loss:Math.max(0,expectedScore(best)-expectedScore(played))});
    }
    onProgress(++done,total);
   }
   position.move(move);
  }
  return summarizeQuality(decisions);
 }finally{client.terminate();}
};
