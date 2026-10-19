import type { MoveAnalysis } from "./types.js";
export const isImportantInsight = (move: MoveAnalysis | undefined | null) =>
  !move?.repeatedOpportunity &&
  move?.actor === "player" &&
  move.status === "complete" &&
  !move.forced &&
  (["inaccuracy", "mistake", "blunder"].includes(move.quality || "") ||
    move.highlight === "excellent" ||
    !!move.outcome ||
    ["mate_opportunity", "missed_mate", "allowed_mate"].includes(
      move.reason || "",
    ));
export const eventFor = (move: MoveAnalysis) => {
  if (move.status !== "complete" || move.forced)
    return { primaryEvent: null, eventPriority: 0, autoPause: false };
  const primaryEvent =
    (move.reason === "allowed_mate" ? "allowed_mate" : move.outcome?.reason) ||
    (["allowed_mate", "missed_mate", "mate_opportunity"].includes(
      move.reason || "",
    )
      ? move.reason
      : move.highlight || move.quality);
  const eventPriority = {
    allowed_stalemate: 100,
    lost_win: 90,
    missed_draw: 90,
    saved_draw: 60,
    allowed_mate: 100,
    missed_mate: 95,
    mate_opportunity: 60,
    blunder: 90,
    mistake: 70,
    excellent: 60,
    inaccuracy: 40,
    best: 10,
    good: 0,
  }[
    primaryEvent as
      | "allowed_stalemate"
      | "lost_win"
      | "missed_draw"
      | "saved_draw"
      | "allowed_mate"
      | "missed_mate"
      | "mate_opportunity"
      | "blunder"
      | "mistake"
      | "excellent"
      | "inaccuracy"
      | "best"
      | "good"
  ];
  return { primaryEvent, eventPriority, autoPause: false };
};
export const selectEvents = (moves: MoveAnalysis[]) => {
  let previous: {
      solutions: string[];
      distance: number;
      owner: MoveAnalysis;
    } | null = null,
    theme: { key: string; outcome: string; owner: MoveAnalysis } | null = null;
  moves.forEach((move) => {
    delete move.repeatedOpportunity;
    delete move.relatedPlies;
    delete move.repeatedFromPly;
    if (move.actor !== "player") return;
    const themeKey =
      move.status === "complete" &&
      !move.forced &&
      !move.highlight &&
      !move.mateTransition &&
      move.reason === "generic" &&
      ["inaccuracy", "mistake", "blunder"].includes(move.quality || "")
        ? move.recommendationEvidence?.themeKey
        : null;
    // Group consecutive advice with the same concrete proof, retaining raw quality.
    // A new material/mate reason or a new outcome breaks the episode.
    const outcome =
      (move.playedLine?.expectedScorePlayer ?? 0.5) <= 0.1
        ? "lost"
        : (move.playedLine?.expectedScorePlayer ?? 0.5) >= 0.9
          ? "winning"
          : "contested";
    if (themeKey && theme?.key === themeKey && theme.outcome === outcome) {
      move.repeatedOpportunity = true;
      move.repeatedFromPly = theme.owner.ply;
      theme.owner.relatedPlies!.push(move.ply);
    } else theme = themeKey ? { key: themeKey, outcome, owner: move } : null;
    if (theme?.owner === move) move.relatedPlies = [move.ply];
    const opportunity =
      ["mate_opportunity", "missed_mate"].includes(move.reason || "") &&
      move.shortMate?.verified;
    const solutions = move.exercise?.solutions?.map((row) => row.move) || [];
    // Require a shared verified solution in consecutive player decisions, not just a mate label.
    if (
      opportunity &&
      previous &&
      solutions.some((token) => previous!.solutions.includes(token)) &&
      move.shortMate!.moves === previous.distance &&
      move.quality !== "blunder" &&
      move.quality !== "mistake"
    ) {
      move.repeatedOpportunity = true;
      move.repeatedFromPly = previous.owner.ply;
      previous.owner.relatedPlies ??= [previous.owner.ply];
      previous.owner.relatedPlies.push(move.ply);
    }
    previous = opportunity
      ? {
          solutions,
          distance: move.shortMate!.moves,
          owner: move.repeatedOpportunity && previous ? previous.owner : move,
        }
      : null;
  });
  moves.forEach((move) => Object.assign(move, eventFor(move)));
  // A visible useful card and an autoplay stop share exactly the same predicate.
  const selected = moves.filter(isImportantInsight);
  selected.forEach((move) => (move.autoPause = true));
  return selected.map((move) => move.ply).sort((a, b) => a - b);
};
