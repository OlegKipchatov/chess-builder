import {Chess} from './chess.js?v=87';
import {newGame} from './state.js?v=87';
import {settleRating} from './rating.js?v=87';
import {rewardBreakdownFor} from './engine.js?v=87';
export const capturePoints = (game,color) => game.history({verbose:true}).reduce((sum,move)=>sum+(move.color===color?({p:1,n:3,b:3,r:5,q:9}[move.captured]||0):0),0);
export const completedMatch = (state,game,{id,finishedAt}) => {
  if(!state.game.started||(!state.game.resigned&&!game.isGameOver()))return null;
  if(state.game.resigned&&!game.history({verbose:true}).some(move=>move.color===(state.game.playerColor||'w')))return {cancelled:true,entry:null,reward:0,rating:null,state:{...state,game:newGame(state.settings.mode)}};
  const rating=settleRating(state,game);
  const rewardBreakdown=rewardBreakdownFor(game,state.game.resigned,state.game.mode,state.game.playerColor);
  const reward=state.game.settled?0:rewardBreakdown.total;
  const winner=state.game.resigned?(game.turn()==='w'?'b':'w'):game.isDraw()?null:game.turn()==='w'?'b':'w';
  const result=state.game.mode==='bot'?(state.game.resigned?'Поражение':winner===null?'Ничья':winner===state.game.playerColor?'Победа':'Поражение'):winner===null?'Ничья':winner==='w'?'Победа белых':'Победа чёрных';
  const entry={id,finishedAt,startedAt:state.game.startedAt,rewardBreakdown:state.game.settled?null:rewardBreakdown,engineProfile:state.game.engineProfile?structuredClone(state.game.engineProfile):null,pgn:game.pgn(),mode:state.game.mode,playerColor:state.game.playerColor,equipped:structuredClone(state.game.equipped),result,points:capturePoints(game,state.game.playerColor),playerRating:state.game.rating?.before??state.rating.value,opponentRating:state.game.rating?.opponent??null,ratingDelta:rating?.lastDelta??null};
  return {entry,reward,rewardBreakdown,rating,state:{...state,rating:rating||state.rating,coins:state.coins+reward,played:state.played+(state.game.settled?0:1),archive:[entry,...state.archive],game:newGame(state.settings.mode)}};
};

export const materialBalance = (game,color) => game.board().flat().filter(Boolean).reduce((sum,piece)=>sum+(piece.color===color?1:-1)*({p:1,n:3,b:3,r:5,q:9,k:0}[piece.type]||0),0);

export const canAbortFailedMatch = (state,game) => state.game.started&&state.game.mode==='bot'&&!state.game.resigned&&!state.game.settled&&!game.isGameOver()&&state.game.engineFailure?.fen===game.fen();
export const abortFailedMatch = (state,game,{id,finishedAt}) => {
 if(!canAbortFailedMatch(state,game))return null;
 const entry={id,finishedAt,startedAt:state.game.startedAt,pgn:game.pgn(),mode:'bot',playerColor:state.game.playerColor,equipped:structuredClone(state.game.equipped),engineProfile:structuredClone(state.game.engineProfile||null),engineFailure:{...state.game.engineFailure},counted:false,result:'Прервана из-за ошибки',points:capturePoints(game,state.game.playerColor),playerRating:state.game.rating?.before??state.rating.value,opponentRating:state.game.rating?.opponent??null,ratingDelta:null};
 return {...state,archive:[entry,...state.archive],game:newGame(state.settings.mode)};
};

// Cache replay-derived metrics without changing existing saved history.
const historyMetricsCache = new WeakMap();
export const historyMetrics = entry => {
 const cached=historyMetricsCache.get(entry);
 if(cached?.pgn===entry.pgn&&cached.color===entry.playerColor)return cached.metrics;
 let metrics={moves:null,balance:null};
 try {
  if(typeof entry.pgn!=='string')throw new Error('Missing PGN');
  const game=new Chess();game.loadPgn(entry.pgn);
  metrics={moves:Math.ceil(game.history().length/2),balance:materialBalance(game,entry.playerColor||'w')};
 } catch {}
 historyMetricsCache.set(entry,{pgn:entry.pgn,color:entry.playerColor,metrics});
 return metrics;
};

// Capture the termination reason before the active game is reset. Result stays entry.result.
export const matchEndReason = (game, resigned = false) => {
 if(resigned)return 'Сдача';
 if(game.isCheckmate())return 'Мат';
 if(game.isStalemate())return 'Пат';
 if(game.isThreefoldRepetition())return 'Троекратное повторение';
 if(game.isInsufficientMaterial())return 'Недостаточно материала';
 if(game.isDrawByFiftyMoves())return 'Правило 50 ходов';
 return '';
};
