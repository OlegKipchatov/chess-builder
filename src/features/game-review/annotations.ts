import type { MoveAnalysis } from "../../domain/analysis/types.js";
import { qualityLabel } from "../../domain/analysis/analysis-explanations.js";

export interface MoveAnnotation {
  ply: number;
  quality: string;
  symbol: string;
  label: string;
}

// Preserve v132 semantics: excellent overrides quality; repeated opportunities
// remain coloured in the move list, but never get another board badge.
export const moveAnnotation = (move: MoveAnalysis): MoveAnnotation => ({
  ply: move.ply,
  quality: move.highlight || move.quality || "",
  symbol: move.highlight
    ? "!"
    : (
        { blunder: "??", mistake: "?", inaccuracy: "?!" } as Record<
          string,
          string
        >
      )[move.quality || ""] || "",
  label: move.highlight
    ? "Отличный ход"
    : (move.quality ? qualityLabel[move.quality] : null) || "Важный момент",
});

export const boardAnnotation = (move?: MoveAnalysis | null) => {
  if (!move || move.status !== "complete" || move.repeatedOpportunity)
    return null;
  const annotation = moveAnnotation(move);
  return annotation.symbol
    ? { ...annotation, square: move.playedMove.slice(2, 4) }
    : null;
};
