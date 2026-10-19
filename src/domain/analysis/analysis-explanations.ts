import { evaluationExplanation } from "./analysis-evaluation-copy.js";
import type { MoveAnalysis } from "./types.js";
const mateDistanceLabel = (moves: number) => {
  const words = ["", "один ход", "два хода", "три хода", "четыре хода"];
  if (words[moves]) return words[moves];
  const last = moves % 10,
    lastTwo = moves % 100;
  const unit =
    lastTwo >= 11 && lastTwo <= 14
      ? "ходов"
      : last === 1
        ? "ход"
        : last >= 2 && last <= 4
          ? "хода"
          : "ходов";
  return `${moves} ${unit}`;
};
export const qualityLabel = {
  best: "Ваш ход",
  good: "Ваш ход",
  inaccuracy: "Неточность",
  mistake: "Ошибка",
  blunder: "Грубая ошибка",
};
export const explanationFor = (move: MoveAnalysis) => {
  if (move.outcome) return move.outcome.text;
  if (move.forced) return "В этой позиции был только один допустимый ход.";
  if (move.mateTransition === "already_lost")
    return "Форсированный мат уже существовал до этого хода. Этот ход не изменил исход.";
  if (move.reason === "allowed_mate") {
    const distance =
      move.playedLine?.score?.type === "mate"
        ? -move.playedLine.score.value
        : 0;
    return Number.isSafeInteger(distance) && distance > 0
      ? `После этого хода соперник может поставить мат в ${mateDistanceLabel(distance)}.`
      : "После этого хода соперник может поставить мат.";
  }
  if (["missed_mate", "mate_opportunity"].includes(move.reason || "")) {
    const distance = move.shortMate?.verified
      ? move.shortMate.moves
      : move.bestLine?.score?.type === "mate"
        ? move.bestLine.score.value
        : 0;
    if (distance > 4) return evaluationExplanation(move);
    if (!Number.isSafeInteger(distance) || distance <= 0)
      return evaluationExplanation(move);
    const opportunity = `Вы могли поставить мат в ${mateDistanceLabel(distance)}${move.shortMate?.proof === "exhaustive" ? " при любой защите соперника" : ""}.`;
    return (
      opportunity +
      (move.reason === "missed_mate"
        ? " После вашего хода мат уже угрожает вам."
        : " После вашего хода мат пока не подтверждён.")
    );
  }
  if (move.reason === "found_mate")
    return "Вы нашли продолжение, ведущее к мату.";
  if (move.reason === "only_move") return "Вы нашли точное решение.";
  if (move.recommendationEvidence?.primary)
    return move.recommendationEvidence.text;
  if (move.reason === "hung_piece")
    return "После этого хода соперник может взять вашу фигуру и выиграть материал.";
  if (move.reason === "lost_material")
    return "Этот ход позволяет сопернику выиграть материал.";
  if (move.reason === "missed_capture")
    return "Здесь можно было выиграть материал взятием.";
  if (move.reason === "missed_tactic")
    return "Короткая тактическая последовательность позволяла получить больше материала.";
  if (move.reason === "promotion")
    return "Пешка превратилась в новую фигуру с сохранением сильной позиции.";
  if (move.mateTransition === "preserves_mate")
    return "Ход сохраняет форсированный мат.";
  if (move.quality === "best")
    return move.alternatives?.length
      ? "Здесь есть несколько равноценных продолжений."
      : "";
  if (move.quality === "good") return "";
  if (move.mateTransition === "missed_mate") return evaluationExplanation(move);
  if (move.quality === "inaccuracy")
    return "Вы могли найти чуть более сильное продолжение.";
  return "Вы могли сыграть сильнее. После вашего хода позиция стала заметно хуже.";
};

export const insightLabel = (move: MoveAnalysis): string => {
  if (move.reason === "allowed_mate") return "Допущен мат";
  if (move.outcome)
    return {
      allowed_stalemate: "Допущен пат",
      lost_win: "Упущена победа",
      missed_draw: "Упущена ничья",
      saved_draw: "Найдена защита",
    }[move.outcome.reason];
  if (move.reason === "mate_opportunity") return "Можно было поставить мат";
  if (move.reason === "missed_mate") return "Упущен мат";
  if (move.highlight) return "Отличный ход";
  return move.quality ? qualityLabel[move.quality] : "Ваш ход";
};
