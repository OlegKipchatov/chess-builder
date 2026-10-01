import {createStockfishClient} from '../stockfish-client.js?v=80';
import {Chess} from '../chess.js?v=80';
const tokenOf = move => move.from+move.to+(move.promotion||'');
const play = (game,token) => game.move({from:token.slice(0,2),to:token.slice(2,4),promotion:token[4]});
// Calculation only: enumerate every solution to mate in one/two, not just top-1.
export const prepareMateExercise = async (move,check=()=>{}) => {
 check();
 if(!move.shortMate?.verified||![1,2,3,4].includes(move.shortMate.moves))return null;
 if(move.shortMate.moves>=3)return {type:'engine',fen:move.fenBefore,mateIn:move.shortMate.moves};
 const game=new Chess(move.fenBefore),solutions=[];
 const yieldTask=async()=>{await new Promise(resolve=>setTimeout(resolve,0));check();};
 for(const first of game.moves({verbose:true})){
  await yieldTask();game.move(first);
  if(game.isCheckmate()){solutions.push({move:tokenOf(first),replies:[]});game.undo();continue;}
  if(move.shortMate.moves===1||game.isGameOver()){game.undo();continue;}
  const replies=[];let verified=true;
  for(const reply of game.moves({verbose:true})){
   await yieldTask();game.move(reply);const finishes=[];
   if(!game.isGameOver())for(const finish of game.moves({verbose:true})){
    game.move(finish);if(game.isCheckmate())finishes.push(tokenOf(finish));game.undo();
   }
   game.undo();if(!finishes.length){verified=false;break;}
   replies.push({move:tokenOf(reply),finishes});
  }
  game.undo();if(verified)solutions.push({move:tokenOf(first),replies});
 }
 return solutions.length?{fen:move.fenBefore,mateIn:move.shortMate.moves,solutions}:null;
};
// Playback uses the saved proof tree. Every move waits for an explicit action.
export const createMateExercise = (exercise,options={}) => {
 if(exercise.type==='engine')return createEngineMateExercise(exercise,options);
 const game=new Chess(exercise.fen);let state='awaitMove',solution=null,reply=null;
 const snapshot=()=>({fen:game.fen(),state,mateIn:exercise.mateIn,turn:game.turn()});
 return {
  game,getSnapshot:snapshot,
  submit:token=>{
   if(state!=='awaitMove')return snapshot();
   try {play(game,token);}catch{return snapshot();}
   const accepted=reply?reply.finishes.includes(token):!!exercise.solutions.find(row=>row.move===token);
   if(!accepted){state='wrong';return snapshot();}
   if(!reply)solution=exercise.solutions.find(row=>row.move===token);
   state=game.isCheckmate()?'success':'correct';return snapshot();
  },
  continue:()=>{
   if(state==='wrong'){game.undo();state='awaitMove';}
   else if(state==='correct'){
    reply=[...solution.replies].sort((a,b)=>b.finishes.length-a.finishes.length||a.move.localeCompare(b.move))[0];
    play(game,reply.move);state='opponent';
   }else if(state==='opponent')state='awaitMove';
   return snapshot();
  }
 };
};

// New positions created by a player's attempt are evaluated only in practice mode.
// Passive review continues to use saved analysis and sends no engine commands.
export const createEngineMateExercise = (exercise,{createClient=createStockfishClient,nodes=300000}={}) => {
 const game=new Chess(exercise.fen);let state='awaitMove',client=null,request=0,reply=null,disposed=false,rejectPending=null;
 const snapshot=()=>({fen:game.fen(),state,mateIn:exercise.mateIn,turn:game.turn()});
 const search=()=>new Promise((resolve,reject)=>{
  client ||= createClient();const owned=client,id=++request;rejectPending=reject;
  owned.onmessage=({data})=>{
   if(disposed||client!==owned||data.id!==id)return;
   rejectPending=null;
   if(data.recovered||!data.lines?.length){reject(Error('Incomplete search'));return;}
   resolve(data.lines[0]);
  };
  owned.onerror=error=>{rejectPending=null;reject(error);};
  owned.postMessage({id,requestId:id,jobId:'mate-practice',moveIndex:game.history().length,fen:game.fen(),pgn:game.pgn(),analysisOnly:true,analysis:{mode:'nodes',nodes,multiPv:1}});
 });
 return {
  game,getSnapshot:snapshot,
  submit:async token=>{
   if(disposed||state!=='awaitMove')return snapshot();
   try{play(game,token);}catch{return snapshot();}
   const remaining=exercise.mateIn-Math.ceil(game.history().length/2);
   if(game.isCheckmate()){state='success';return snapshot();}
   if(game.isGameOver()||remaining<=0){state='wrong';return snapshot();}
   state='checking';
   try{
    const line=await search();if(disposed)return snapshot();
    // Root is now the defending side: a negative mate proves the user's continuation.
    if(line.scoreType!=='mate')state='unverified';
    else if(line.scoreValue>=0||Math.abs(line.scoreValue)>remaining)state='wrong';
    else {reply=line.move;state='correct';}
   }catch{if(!disposed){state='unverified';client?.terminate();client=null;}}
   return snapshot();
  },
  continue:()=>{
   if(['wrong','unverified'].includes(state)){game.undo();state='awaitMove';}
   else if(state==='correct'){
    try{play(game,reply);state='opponent';}catch{game.undo();state='awaitMove';}
   }else if(state==='opponent')state='awaitMove';
   return snapshot();
  },
  dispose:()=>{disposed=true;request++;client?.terminate();client=null;rejectPending?.(new DOMException('Cancelled','AbortError'));rejectPending=null;}
 };
};
