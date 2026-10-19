import { Chess } from "chess.js";
import type { ArchiveEntry, VaultState } from "../chess/types.js";
import { ANALYSIS_VERSION, ENGINE, PROFILE } from "./analysis-config.js";
import type { GameAnalysis } from "./types.js";
export const eligibleEntry = (
  entry: ArchiveEntry | undefined | null,
): entry is ArchiveEntry => {
  if (
    !entry ||
    typeof entry.id !== "string" ||
    !entry.id ||
    typeof entry.pgn !== "string" ||
    !entry.pgn.trim() ||
    entry.engineFailure ||
    (!entry.imported &&
      (entry.counted === false || entry.mode !== "bot" || !entry.finishedAt)) ||
    !["w", "b"].includes(entry.playerColor)
  )
    return false;
  try {
    const game = new Chess();
    game.loadPgn(entry.pgn);
    return game
      .history({ verbose: true })
      .some((move) => move.color === entry.playerColor);
  } catch {
    return false;
  }
};
export const isCompatible = (
  analysis: GameAnalysis | undefined,
  entry: ArchiveEntry,
): analysis is GameAnalysis =>
  analysis?.status === "complete" &&
  analysis.analysisVersion === ANALYSIS_VERSION &&
  analysis.profileVersion === PROFILE.version &&
  analysis.engine?.version === ENGINE.version &&
  analysis.engine?.nnue === ENGINE.nnue &&
  analysis.gameId === entry.id &&
  analysis.playerColor === entry.playerColor &&
  analysis.sourcePgn === entry.pgn &&
  Array.isArray(analysis.moves) &&
  analysis.moves.length === analysis.totalPlies;
export const attachAnalysis = (
  state: VaultState,
  id: string,
  analysis: GameAnalysis,
): VaultState => ({
  ...state,
  archive: state.archive.map((entry) =>
    entry.id === id &&
    analysis.gameId === id &&
    entry.pgn === analysis.sourcePgn
      ? { ...entry, analysis: { ...analysis, diagnostics: undefined } }
      : entry,
  ),
});
// Preserve old versions for display of the archive; compatibility gates reuse.
export const restoreAnalysis = (
  value: GameAnalysis | undefined,
  entry: ArchiveEntry,
): GameAnalysis | undefined =>
  value &&
  value.gameId === entry.id &&
  Array.isArray(value.moves) &&
  Array.isArray(value.focusEvents) &&
  value.moves.length <= 2000 &&
  ["complete", "partial", "failed"].includes(value.status)
    ? structuredClone(value)
    : undefined;
