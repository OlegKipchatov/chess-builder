import type { EngineLine } from "../../shared/types/engine.js";
import { PROFILE } from "./analysis-config.js";
import type { MoveAnalysis, MoveClassification } from "./types.js";
export const mateState = (line?: EngineLine) =>
  line?.score.type === "mate"
    ? line.score.value > 0
      ? "winning"
      : "losing"
    : "none";
export const classifyMove = ({
  bestLine,
  playedLine,
  lines = [],
  forced = false,
}: {
  bestLine: EngineLine;
  playedLine: EngineLine;
  lines?: EngineLine[];
  forced?: boolean;
}): MoveClassification => {
  const loss = Math.max(
    0,
    bestLine.expectedScorePlayer - playedLine.expectedScorePlayer,
  );
  let quality: MoveClassification["quality"] = ([
    "best",
    "good",
    "inaccuracy",
    "mistake",
  ][PROFILE.thresholds.findIndex((threshold) => loss <= threshold)] ||
    "blunder") as MoveClassification["quality"];
  const bestMate = mateState(bestLine),
    playedMate = mateState(playedLine);
  const mateTransition =
    bestMate !== "losing" && playedMate === "losing"
      ? "allowed_mate"
      : bestMate === "winning" && playedMate !== "winning"
        ? "missed_mate"
        : bestMate === "winning" && playedMate === "winning"
          ? "preserves_mate"
          : bestMate === "losing" && playedMate === "losing"
            ? "already_lost"
            : null;
  if (mateTransition === "allowed_mate") quality = "blunder";
  // A bounded search not finding mate is not proof that the played move loses it.
  // Keep decision quality tied to the measured loss, not a mate/CP format change.
  if (["preserves_mate", "already_lost"].includes(mateTransition || ""))
    quality = "best";
  // A meaningful positive requires a measured alternative, not missing MultiPV data.
  const other = lines.filter((line) => line.move !== playedLine.move);
  const bestVsSecondGap = other.length
    ? playedLine.expectedScorePlayer -
      Math.max(...other.map((line) => line.expectedScorePlayer))
    : 0;
  const uniqueMate =
    other.length > 0 &&
    playedMate === "winning" &&
    other.every((line) => mateState(line) !== "winning");
  const avoidsMate =
    other.length > 0 &&
    playedMate !== "losing" &&
    other.every((line) => mateState(line) === "losing");
  const significant =
    bestVsSecondGap >= PROFILE.significantGap || uniqueMate || avoidsMate;
  const highlight =
    !forced &&
    loss <= PROFILE.excellentLoss &&
    significant &&
    !["already_lost", "allowed_mate", "missed_mate"].includes(
      mateTransition || "",
    )
      ? "excellent"
      : null;
  const sorted = lines
    .map((line) => line.expectedScorePlayer)
    .sort((a, b) => b - a);
  const topGap = sorted.length > 1 ? sorted[0] - sorted[1] : 0;
  return {
    topGap,
    expectedScoreLoss: loss,
    quality: forced ? "best" : quality,
    highlight: forced ? null : highlight,
    mateTransition,
    bestVsSecondGap,
    forced,
  };
};
export const needsRefinement = (move: MoveAnalysis) =>
  move.status === "complete" &&
  !move.forced &&
  (move.quality === "mistake" ||
    move.quality === "blunder" ||
    ["allowed_mate", "missed_mate"].includes(move.mateTransition || "") ||
    move.highlight ||
    (move.topGap ?? 0) >= PROFILE.significantGap);
