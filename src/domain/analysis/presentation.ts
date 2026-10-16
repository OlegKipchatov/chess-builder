import type { MoveAnalysis } from "./types.js";
import { isImportantInsight } from "./analysis-events.js";
export const visibleVariation = (
  move: MoveAnalysis | undefined | null,
  expanded = false,
) => {
  const line = move?.bestLine;
  if (!line) return { pv: [], san: [] };
  if (expanded && move.recommendationEvidence?.pv)
    return { pv: move.recommendationEvidence.pv, san: [] };
  const mateEnd = line.pvSan?.findIndex((san) => san.endsWith("#")) ?? -1;
  const length = expanded
    ? mateEnd >= 0
      ? mateEnd + 1
      : Math.min(line.pv?.length || 1, 4)
    : 1;
  return {
    pv: (line.pv || [line.move]).slice(0, length),
    san: (line.pvSan || [line.san || line.move]).slice(0, length),
  };
};
export const insightLines = (move: MoveAnalysis | undefined | null) => {
  if (
    !isImportantInsight(move) ||
    !move?.bestLine ||
    move.bestLine.move === move.playedMove
  )
    return [];
  if (
    (move.expectedScoreLoss ?? 0) <= 0.005 &&
    !["mate_opportunity", "missed_mate", "allowed_mate"].includes(
      move.reason || "",
    )
  )
    return [];
  return [move.bestLine];
};
/** Plain-language move description used by insight cards, without revealing coordinates. */
export const humanMove = (san: string): string => {
  if (!san) return "";
  if (san.startsWith("O-O")) return "Рокировка";
  const names: Record<string, string> = {
    K: "Король",
    Q: "Ферзь",
    R: "Ладья",
    B: "Слон",
    N: "Конь",
  };
  return (
    (names[san[0]!] || "Пешка") +
    (san.includes("x") ? " — взятие" : "") +
    (san.includes("=") ? " — превращение" : "") +
    (san.endsWith("#") ? " · мат" : san.endsWith("+") ? " · шах" : "")
  );
};
