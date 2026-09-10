import {ratingSnapshot} from './rating.js?v=6';
import {Chess} from './chess.js?v=6';
import {newGame} from './state.js?v=6';
export const SCREENS = ['profile','collection','play','chests','craft'];
export const isMatchActive = (state, game) => state.game.started && !state.game.resigned && !game.isGameOver();
export const navigationTarget = (state, game, requested) => isMatchActive(state,game) ? 'play' : SCREENS.includes(requested) ? requested : 'play';
export const createStartedGame = (state,rng=Math.random) => ({...newGame(state.settings.mode,'adaptive'),started:true,playerColor:rng()<0.5?'w':'b',rating:state.settings.mode==='bot'?ratingSnapshot(state.rating):null,equipped:structuredClone(state.equipped)});
export const updatePreferences = (state, game, settings) => {
  if (isMatchActive(state,game)) return null;
  const mode = settings.mode === 'local' ? 'local' : 'bot';
  const difficulty = 'adaptive';
  return {...state,settings:{mode,difficulty}};
};
export const positionAt = (liveGame, cursor) => {
  if (cursor === null) return liveGame;
  const replay = new Chess();
  replay.loadPgn(liveGame.pgn());
  let remaining = liveGame.history().length;
  const target = Math.max(0,Math.min(remaining,Math.trunc(cursor)));
  while(remaining-- > target) replay.undo();
  return replay;
};
export const historyCursor = (cursor, direction, total) => {
  const next = Math.max(0,Math.min(total,(cursor ?? total)+direction));
  return next === total ? null : next;
};
export const canPlayPosition = (state,game,cursor) => isMatchActive(state,game) && cursor === null;
