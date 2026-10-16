import { Chess } from "chess.js";
import { createSession } from "../cognitive/cognitive-model.js";
import type { PlayStyle } from "../cognitive/types.js";
import { ratingSnapshot } from "../rating/rating.js";
import { newGame } from "./new-game.js";
import type { SavedGame, VaultState } from "./types.js";
export const isMatchActive = (state: VaultState, game: Chess) =>
  state.game.started && !state.game.resigned && !game.isGameOver();
export const createStartedGame = (
  state: VaultState,
  rng = Math.random,
  options: { profile?: PlayStyle } = {},
): SavedGame => {
  const playerColor = rng() < 0.5 ? "w" : "b",
    engineProfile = createSession(
      state.rating.value,
      Math.floor(rng() * 0x100000000) >>> 0,
      options.profile,
    );
  return {
    ...newGame("bot", "adaptive"),
    started: true,
    startedAt: new Date().toISOString(),
    engineProfile,
    playerColor,
    rating: {
      ...ratingSnapshot(state.rating),
      opponent: engineProfile.targetElo,
    },
    equipped: structuredClone(state.equipped),
  };
};
export const updatePreferences = (
  state: VaultState,
  game: Chess,
  settings: VaultState["settings"],
): VaultState | null => {
  if (isMatchActive(state, game)) return null;
  const mode = settings.mode === "local" ? "local" : "bot";
  const difficulty = "adaptive";
  return { ...state, settings: { mode, difficulty } };
};
export const positionAt = (liveGame: Chess, cursor: number | null) => {
  if (cursor === null) return liveGame;
  const replay = new Chess();
  replay.loadPgn(liveGame.pgn());
  let remaining = liveGame.history().length;
  const target = Math.max(0, Math.min(remaining, Math.trunc(cursor)));
  while (remaining-- > target) replay.undo();
  return replay;
};
export const historyCursor = (
  cursor: number | null,
  direction: number,
  total: number,
) => {
  const next = Math.max(0, Math.min(total, (cursor ?? total) + direction));
  return next === total ? null : next;
};
export const canPlayPosition = (
  state: VaultState,
  game: Chess,
  cursor: number | null,
) => isMatchActive(state, game) && cursor === null;

// One contract for pointer/keyboard activation and the board's accessibility state.
export const boardAvailability = (
  state: VaultState,
  game: Chess,
  cursor: number | null,
  { readOnly = false, busy = false, animating = false } = {},
) => ({
  disabled:
    readOnly ||
    !canPlayPosition(state, game, cursor) ||
    busy ||
    animating ||
    (state.game.mode === "bot" && game.turn() !== state.game.playerColor),
  busy: busy || animating,
});
