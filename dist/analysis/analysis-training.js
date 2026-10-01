import {Chess} from '../chess.js?v=76';
const tokenOf = move => move.from+move.to+(move.promotion||'');
const play = (game,token) => game.move({from:token.slice(0,2),to:token.slice(2,4),promotion:token[4]});
// Calculation only: enumerate every solution to mate in one/two, not just top-1.
export const prepareMateExercise = async (move,check=()=>{}) => {
 if(!move.shortMate?.verified||![1,2].includes(move.shortMate.moves))return null;
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
export const createMateExercise = exercise => {
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
