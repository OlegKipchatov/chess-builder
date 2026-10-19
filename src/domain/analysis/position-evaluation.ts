import type { GameAnalysis } from "./types.js";
import type { EngineScore } from "../../shared/types/engine.js";

const signed = (cp: number) => {
  const value = Math.round(cp / 10) / 10;
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1).replace(".", ",")}`;
};
const valid = (score: EngineScore | undefined) =>
  score && Number.isFinite(score.value) ? score : undefined;
const label = (score: EngineScore | undefined) =>
  !score
    ? "—"
    : score.type === "mate" && score.value === 0
      ? "Мат"
      : score.type === "mate"
        ? `${score.value < 0 ? "−" : "+"}M${Math.abs(score.value)}`
        : signed(score.value);

// Read the exact displayed position, including opponent moves via the next
// analyzed decision. Never carry an old score across a missing position.
const scoreAt = (analysis: GameAnalysis | undefined, cursor: number) => {
  if (cursor < 0) return undefined;
  const move = analysis?.moves[cursor - 1];
  const next = analysis?.moves[cursor];
  const actual =
    move?.status === "complete" ? valid(move.playedLine?.score) : undefined;
  return (
    (actual?.type === "mate" && actual.value > 0
      ? { ...actual, value: actual.value - 1 }
      : actual) ??
    (next?.status === "complete" ? valid(next.bestLine?.score) : undefined)
  );
};
export const positionEvaluation = (
  analysis: GameAnalysis | undefined,
  cursor: number,
) => {
  const score = scoreAt(analysis, cursor);
  const previous = scoreAt(analysis, cursor - 1);
  // Subtract rounded displayed values, so the visible totals and delta agree.
  const delta =
    score?.type === "cp" && previous?.type === "cp"
      ? (Math.round(score.value / 10) - Math.round(previous.value / 10)) * 10
      : undefined;
  return {
    value: label(score),
    change: delta === undefined ? "—" : signed(delta),
    direction:
      delta === undefined || Math.round(delta / 10) === 0
        ? "neutral"
        : delta < 0
          ? "negative"
          : "positive",
    description:
      score?.type === "mate" && score.value === 0
        ? "Мат поставлен. Числовое изменение не рассчитывается."
        : score?.type === "mate"
          ? `${score.value < 0 ? "Соперник ставит вам" : "Вы ставите сопернику"} мат: ${Math.abs(score.value)}. Числовое изменение при мате не рассчитывается.`
          : "Оценка в единицах пешки: плюс в вашу пользу, минус в пользу соперника. Изменение — относительно предыдущей позиции. Прочерк — нет сохранённой оценки.",
  };
};
