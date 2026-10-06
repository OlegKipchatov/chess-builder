import {Chess} from '../chess.js?v=112';
export const uci = move => move.from+move.to+(move.promotion||'');
// Verify a short mate against every legal defence, not only the principal variation.
// Yield between replies so closing/cancelling remains responsive.
export const verifyShortMate = async (fen,line,check=()=>{}) => {
 if(line?.score.type!=='mate'||![1,2,3,4].includes(line.score.value))return null;
 if(line.score.value>=3){
  check();const proof=new Chess(fen);try{for(const token of line.pv||[])proof.move({from:token.slice(0,2),to:token.slice(2,4),promotion:token[4]});}catch{return null;}
  return proof.isCheckmate()&&proof.history().length<=2*line.score.value-1?{moves:line.score.value,verified:true}:null;
 }
 const game=new Chess(fen),token=line.move;
 try {game.move({from:token.slice(0,2),to:token.slice(2,4),promotion:token[4]});} catch {return null;}
 if(game.isCheckmate())return {moves:1,verified:true};
 if(line.score.value!==2||game.isGameOver())return null;
 for(const reply of game.moves()){
  await new Promise(resolve=>setTimeout(resolve,0));check();game.move(reply);
  let mate=false;
  if(!game.isGameOver())for(const finish of game.moves()){
   game.move(finish);mate=game.isCheckmate();game.undo();if(mate)break;
  }
  game.undo();if(!mate)return null;
 }
 return {moves:2,verified:true};
};
export const material = (game,color) => game.board().flat().filter(Boolean).reduce((sum,piece)=>sum+({p:1,n:3,b:3,r:5,q:9,k:0}[piece.type])*(piece.color===color?1:-1),0);
export const describeLine = (fen,line,color) => {
 const game=new Chess(fen),before=material(game,color),san=[],moves=[];let first=null;
 try {for(const token of line.pv.slice(0,12)){const move=game.move({from:token.slice(0,2),to:token.slice(2,4),...(token[4]?{promotion:token[4]}:{})});first ||= move;moves.push(move);san.push(move.san);}}
 catch {return {valid:false,san:[],delta:0,first:null};}
 return {valid:!!san.length,san,delta:material(game,color)-before,first,moves};
};
export const detectReason = move => {
 if(move.forced)return null;
 if(move.mateTransition==='allowed_mate')return 'allowed_mate';
 if(move.mateTransition==='missed_mate')return move.expectedScoreLoss<=.025?'mate_opportunity':'missed_mate';
 if(move.highlight)return move.playedLine.score.type==='mate'&&move.playedLine.score.value>0?'found_mate':'only_move';
 if(move.recommendationEvidence?.reason)return move.recommendationEvidence.reason;
 if(move.playedEvidence?.first?.promotion&&['best','good'].includes(move.quality))return 'promotion';
 return 'generic';
};

export {buildRecommendation as recommendationEvidence} from "./analysis-recommendations.js?v=112";
