import {recordStockfishRestart} from './stockfish-lifecycle.js?v=116';
import {STOCKFISH as C} from './stockfish-config.js?v=116';
import {Chess} from './chess.js?v=116';
import {createStockfishClient} from './stockfish-client.js?v=116';
import {expectedScore,summarizeQuality} from './reward-quality.js?v=116';
// A separate full-strength fixed-node profile, never the adaptive opponent.
export const analyzeReward = async (entry,{onProgress=()=>{},onRetry=()=>{},createClient=createStockfishClient,requestTimeoutMs=C.economyRequestMs}={}) => {
 const final=new Chess();final.loadPgn(entry.pgn);
 const history=final.history({verbose:true}),position=new Chess(history[0]?.before||final.fen());
 const decisions=[],diagnostics=[];let client=null,id=0,done=0;
 const total=history.filter(move=>move.color===entry.playerColor).length;
 const search = async searchMove => {
  for(let attempt=1;attempt<=3;attempt++){
   try {
    client ||= createClient();const owned=client,requestId=++id;
    return await new Promise((resolve,reject)=>{
     let settled=false;
     const finish=(error,value)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      owned.onmessage=null;owned.onerror=null;
      if(error)reject(error);else resolve(value);
     };
     const timer=setTimeout(()=>finish(Error('Economy request timeout')),requestTimeoutMs);
     owned.onmessage=({data})=>{
      if(owned!==client||data.id!==requestId)return;
      try {
       if(!data.evaluation||data.recovered)throw Error('Incomplete economy evaluation');
       if(searchMove&&data.evaluation.move!==searchMove)throw Error('Wrong restricted move');
       expectedScore(data.evaluation);finish(null,data.evaluation);
      }catch(error){finish(error);}
     };
     owned.onerror=error=>{if(owned===client)finish(error);};
     try {owned.postMessage({id:requestId,pgn:position.pgn(),fen:position.fen(),economy:true,searchMove});}catch(error){finish(error);}
    });
   }catch(error){
    client?.terminate();client=null;
    diagnostics.push({ply:position.history().length+1,stage:searchMove?'played':'best',attempt,message:String(error.message||error).slice(0,180)});
    if(attempt===3){const failure=Error('Economy evaluation failed after 3 attempts');failure.diagnostics=diagnostics.slice(-9);throw failure;}
    recordStockfishRestart('economy: '+String(error.message||error));
    onRetry({done,total,attempt:attempt+1});
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
 };
 try{
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
  return {...summarizeQuality(decisions),...(diagnostics.length?{diagnostics:diagnostics.slice(-9)}:{})};
 }finally{client?.terminate();}
};
