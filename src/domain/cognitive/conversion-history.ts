import type { Color } from "chess.js";
import { Chess } from "chess.js";
import { clamp } from "./cognitive-model.js";
import { CONVERSION as V } from "./conversion-config.js";
import { conversionFeatures, conversionSignature } from "./conversion-model.js";
import type { ConversionProgress } from "./types.js";
export const positionKey = (game: Chess) =>
  game.fen().split(" ").slice(0, 4).join(" ");
export const advanceProgress = (
  state: ConversionProgress | null,
  progress: number,
  signature: string,
): ConversionProgress => {
  if (!state || state.signature !== signature)
    return { signature, bestProgress: progress, stagnantMoves: 0 };
  return progress >= state.bestProgress + V.progressEpsilon
    ? { signature, bestProgress: progress, stagnantMoves: 0 }
    : { ...state, stagnantMoves: state.stagnantMoves + 1 };
};
export const stagnationPenalty = (
  state: ConversionProgress | null,
  clock: number,
) =>
  Math.min(
    V.stagnationCap,
    40 *
      Math.max(0, (state?.stagnantMoves || 0) - 1) ** 1.4 *
      (1 + 1.5 * clamp((clock - 60) / 40, 0, 1)),
  );
export const conversionHistory = (
  game: Chess,
  side: Color,
  pgn: string | null,
) => {
  const counts = new Map<string, number>();
  let state: ConversionProgress | null = null,
    complete = false;
  if (pgn) {
    const copy = new Chess();
    copy.loadPgn(pgn);
    const moves = copy.history({ verbose: true });
    while (copy.undo());
    complete = moves.length >= Number(game.fen().split(" ")[4]);
    const record = () =>
      counts.set(positionKey(copy), (counts.get(positionKey(copy)) || 0) + 1);
    record();
    for (const move of moves) {
      copy.move({ from: move.from, to: move.to, promotion: move.promotion });
      record();
      if (move.color === side) {
        const mode = conversionSignature(copy, side);
        state = mode.active
          ? advanceProgress(
              state,
              conversionFeatures(copy, side).progress,
              mode.signature,
            )
          : null;
      }
    }
  } else counts.set(positionKey(game), 1);
  const mode = conversionSignature(game, side);
  state ??= advanceProgress(
    null,
    conversionFeatures(game, side).progress,
    mode.signature,
  );
  return { counts, state, complete };
};
