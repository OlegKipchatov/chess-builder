import type { MatchMode,SavedGame } from "./types.js";
export const newGame = (
  mode: MatchMode = "bot",
  difficulty: SavedGame["difficulty"] = "adaptive",
): SavedGame => ({
  pgn: "",
  mode,
  difficulty,
  playerColor: "w",
  started: false,
  settled: false,
  resigned: false,
});
