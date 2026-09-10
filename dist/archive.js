import {newGame} from './state.js?v=7';
import {settleRating} from './rating.js?v=7';
import {rewardFor} from './engine.js?v=7';
export const capturePoints = (game,color) => game.history({verbose:true}).reduce((sum,move)=>sum+(move.color===color?({p:1,n:3,b:3,r:5,q:9}[move.captured]||0):0),0);
export const completedMatch = (state,game,{id,finishedAt}) => {
  if(!state.game.started||(!state.game.resigned&&!game.isGameOver()))return null;
  const rating=settleRating(state,game);
  const reward=state.game.settled?0:rewardFor(game,state.game.resigned,state.game.mode,state.game.playerColor);
  const winner=state.game.resigned?(game.turn()==='w'?'b':'w'):game.isDraw()?null:game.turn()==='w'?'b':'w';
  const result=state.game.mode==='bot'?(state.game.resigned?'Поражение':winner===null?'Ничья':winner===state.game.playerColor?'Победа':'Поражение'):winner===null?'Ничья':winner==='w'?'Победа белых':'Победа чёрных';
  const entry={id,finishedAt,pgn:game.pgn(),mode:state.game.mode,playerColor:state.game.playerColor,equipped:structuredClone(state.game.equipped),result,points:capturePoints(game,state.game.playerColor),playerRating:state.game.rating?.before??state.rating.value,opponentRating:state.game.rating?.opponent??null,ratingDelta:rating?.lastDelta??null};
  return {entry,reward,rating,state:{...state,rating:rating||state.rating,coins:state.coins+reward,played:state.played+(state.game.settled?0:1),archive:[entry,...state.archive],game:newGame(state.settings.mode)}};
};
