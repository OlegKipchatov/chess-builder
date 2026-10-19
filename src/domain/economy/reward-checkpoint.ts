import type { Move } from "chess.js";
import { ECONOMY_PROFILE } from "./reward-quality.js";
import type { RewardCheckpoint } from "./types.js";

export const rewardMoveToken = (move: Move) =>
  move.from + move.to + (move.promotion || "");

// Stored progress is optional. Old or malformed progress is safely recalculated.
export const restoreRewardCheckpoint = (
  value: unknown,
): RewardCheckpoint | undefined => {
  if (!value || typeof value !== "object") return;
  const row = value as RewardCheckpoint;
  if (
    row.profile !== ECONOMY_PROFILE.version ||
    !["w", "b"].includes(row.playerColor) ||
    typeof row.initialFen !== "string" ||
    row.initialFen.length > 120 ||
    !Array.isArray(row.moves) ||
    row.moves.length > 10000 ||
    !row.moves.every(
      (move) =>
        typeof move === "string" && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move),
    ) ||
    !Array.isArray(row.decisions) ||
    row.decisions.length > row.moves.length ||
    !row.decisions.every(
      (decision) =>
        decision &&
        (decision.forced === true ||
          ((decision.forced === undefined || decision.forced === false) &&
            Number.isFinite(decision.loss) &&
            decision.loss >= 0 &&
            decision.loss <= 1)),
    )
  )
    return;
  return {
    profile: row.profile,
    playerColor: row.playerColor,
    initialFen: row.initialFen,
    moves: [...row.moves],
    decisions: row.decisions.map((decision) =>
      decision.forced ? { forced: true } : { loss: decision.loss },
    ),
  };
};

export const matchingRewardCheckpoint = (
  value: unknown,
  history: Move[],
  playerColor: "w" | "b",
): RewardCheckpoint | undefined => {
  const checkpoint = restoreRewardCheckpoint(value);
  if (
    !checkpoint ||
    checkpoint.playerColor !== playerColor ||
    checkpoint.initialFen !== history[0]?.before ||
    checkpoint.moves.length > history.length ||
    !checkpoint.moves.every(
      (move, index) => move === rewardMoveToken(history[index]),
    ) ||
    history
      .slice(0, checkpoint.moves.length)
      .filter((move) => move.color === playerColor).length !==
      checkpoint.decisions.length
  )
    return;
  return checkpoint;
};
