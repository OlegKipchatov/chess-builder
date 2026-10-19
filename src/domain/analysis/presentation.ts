import type { MoveAnalysis } from "./types.js";
import { isImportantInsight } from "./analysis-events.js";
export const visibleVariation = (
  move: MoveAnalysis | undefined | null,
  expanded = false,
) => {
  const line = move?.bestLine;
  if (expanded && move?.outcome?.reason === "missed_draw")
    return { pv: move.outcome.pv, san: [] };
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
export const humanMove = (san: string, token?: string): string => {
  if (!san) return "";
  if (san.startsWith("O-O-O")) return "Длинная рокировка";
  if (san.startsWith("O-O")) return "Короткая рокировка";
  const names: Record<string, string> = {
    K: "Король",
    Q: "Ферзь",
    R: "Ладья",
    B: "Слон",
    N: "Конь",
  };
  return (
    (names[san[0]!] || "Пешка") +
    (token && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token)
      ? ` ${token.slice(0, 2)}–${token.slice(2, 4)}`
      : "") +
    (san.includes("x") ? " — взятие" : "") +
    (san.includes("=") ? " — превращение" : "") +
    (san.endsWith("#") ? " · мат" : san.endsWith("+") ? " · шах" : "")
  );
};

export const reviewCompletion = (
  analysis?: import("./types.js").GameAnalysis,
) => {
  if (analysis?.status !== "complete") return "Просмотр завершён.";
  const serious = analysis.moves.some(
    (move) =>
      move.actor === "player" &&
      move.status === "complete" &&
      (["mistake", "blunder"].includes(move.quality || "") ||
        [
          "allowed_stalemate",
          "lost_win",
          "missed_draw",
          "allowed_mate",
        ].includes(move.reason || "")),
  );
  return serious ? "Разбор завершён." : "Серьёзных ошибок не найдено.";
};
