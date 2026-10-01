import {Chess} from '../chess.js?v=73';
export const uci = move => move.from+move.to+(move.promotion||'');
// Verify a short mate against every legal defence, not only the principal variation.
// Yield between replies so closing/cancelling remains responsive.
export const verifyShortMate = async (fen,line,check=()=>{}) => {
 if(line?.score.type!=='mate'||![1,2].includes(line.score.value))return null;
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
 try {for(const token of line.pv.slice(0,4)){const move=game.move({from:token.slice(0,2),to:token.slice(2,4),...(token[4]?{promotion:token[4]}:{})});first ||= move;moves.push(move);san.push(move.san);}}
 catch {return {valid:false,san:[],delta:0,first:null};}
 return {valid:!!san.length,san,delta:material(game,color)-before,first,moves};
};
export const detectReason = move => {
 if(move.forced)return null;
 if(move.mateTransition==='allowed_mate')return 'allowed_mate';
 if(move.mateTransition==='missed_mate')return move.expectedScoreLoss<=.025?'mate_opportunity':'missed_mate';
 if(move.highlight)return move.playedLine.score.type==='mate'&&move.playedLine.score.value>0?'found_mate':'only_move';
 const best=move.bestEvidence,actual=move.playedEvidence;
 if(!best?.valid||!actual?.valid)return 'generic';
 if(['mistake','blunder','inaccuracy'].includes(move.quality)){
  if(best.delta>=0&&actual.delta<=-3){
   if(actual.moves?.[1]?.captured&&actual.moves[1].to===actual.first?.to)return 'hung_piece';
   return 'lost_material';
  }
  if(best.first?.captured&&best.delta>=1&&best.delta>actual.delta&&move.expectedScoreLoss>=.025)return 'missed_capture';
  if(best.delta-actual.delta>=3&&best.san.length>=3&&move.expectedScoreLoss>=.06)return 'missed_tactic';
 }
 if(actual.first?.promotion&&['best','good'].includes(move.quality))return 'promotion';
 return 'generic';
};
