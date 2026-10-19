import type { MoveAnalysis } from "./types.js";

// Describe the measured change, not an unverified positional cause or a human
// win probability. Scores are already normalized to the selected player's side.
export const evaluationExplanation = (move: MoveAnalysis): string => {
  const before = move.bestLine?.expectedScorePlayer,
    after = move.playedLine?.expectedScorePlayer;
  if (
    before === undefined ||
    after === undefined ||
    !Number.isFinite(before) ||
    !Number.isFinite(after)
  )
    return "Вы могли выбрать более сильное продолжение.";
  if (before <= 0.1)
    return "Вы уже были в тяжёлой позиции, но здесь было более сильное продолжение.";
  if (before > 0.53 && after >= 0.47 && after <= 0.53)
    return `Вы могли сохранить ${before < 0.65 ? "небольшое " : ""}преимущество, но позволили сопернику уравнять позицию.`;
  if (before >= 0.47 && after < 0.47)
    return `Вы могли ${before > 0.53 ? "сохранить свой перевес" : "удержать равную позицию"}, но после вашего хода преимущество перешло к сопернику.`;
  if (after < 0.47)
    return "Вы могли защититься лучше и сдержать преимущество соперника. После вашего хода его перевес вырос.";
  if (after > 0.53)
    return "Вы по-прежнему впереди, но могли сохранить больший перевес. Попробуйте найти более сильный ход.";
  return "Вы сохранили примерно равную позицию, но могли сыграть чуть точнее.";
};
