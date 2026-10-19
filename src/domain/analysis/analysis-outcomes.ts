import { Chess, type Color } from "chess.js";
import type { EngineLine } from "../../shared/types/engine.js";
import type { DrawMechanism, MoveAnalysis, OutcomeEvidence } from "./types.js";

const drawMechanism = (game: Chess): DrawMechanism | undefined =>
  game.isStalemate()
    ? "stalemate"
    : game.isThreefoldRepetition()
      ? "repetition"
      : game.isInsufficientMaterial()
        ? "insufficient"
        : game.isDrawByFiftyMoves()
          ? "fifty_moves"
          : undefined;

// Replay the actual game prefix as well as the variation: FEN alone cannot
// establish repetition. A terminal line is evidence for that line, not all replies.
export const traceOutcome = (
  move: MoveAnalysis,
  line: EngineLine | undefined,
  prefix?: string,
) => {
  if (!line?.pv.length || line.pv[0] !== line.move) return null;
  const game = new Chess(move.fenBefore);
  try {
    if (prefix) {
      game.loadPgn(prefix);
      if (game.fen() !== move.fenBefore) return null;
    }
    const pv: string[] = [];
    for (const token of line.pv.slice(0, 12)) {
      if (game.isGameOver()) break;
      game.move({
        from: token.slice(0, 2),
        to: token.slice(2, 4),
        promotion: token[4],
      });
      pv.push(token);
      let mechanism = drawMechanism(game);
      if (mechanism === "repetition") {
        const player: Color = move.fenBefore.split(" ")[1] === "b" ? "b" : "w";
        const lastChecks = game
          .history({ verbose: true })
          .slice(-6)
          .filter((row) => row.color === player);
        if (
          lastChecks.length >= 2 &&
          lastChecks.every((row) => row.san.endsWith("+"))
        )
          mechanism = "perpetual_check";
      }
      if (mechanism)
        return {
          mechanism,
          pv,
          immediate: pv.length === 1,
          stalledPlayer: game.turn() === move.fenBefore.split(" ")[1],
        };
    }
  } catch {
    return null;
  }
  return null;
};

const drawing = (line: EngineLine | undefined) =>
  !!line &&
  line.score.type !== "mate" &&
  (line.wdl?.draw ?? 0) >= 0.9 &&
  Math.abs(line.expectedScorePlayer - 0.5) <= 0.03;
const winning = (line: EngineLine | undefined) =>
  (line?.expectedScorePlayer ?? 0.5) >= 0.9;
const losing = (line: EngineLine | undefined) =>
  (line?.expectedScorePlayer ?? 0.5) <= 0.1;
const mechanismCopy = {
  stalemate:
    "возникает пат: у соперника нет легальных ходов, но его король не под шахом",
  repetition: "позиция повторяется в третий раз",
  perpetual_check: "повторяющиеся шахи приводят к третьему повторению позиции",
  insufficient: "остаётся недостаточно материала для мата",
  fifty_moves: "проходит 50 ходов каждой стороны без взятий и ходов пешками",
};
const drawLine = (proof: ReturnType<typeof traceOutcome>) =>
  proof
    ? `${proof.immediate ? "После этого хода" : "В показанном продолжении"} ${proof.mechanism === "stalemate" && proof.stalledPlayer ? "возникает пат: у вас нет легальных ходов, но король не под шахом" : mechanismCopy[proof.mechanism]}.`
    : "";
export const detectOutcome = (
  move: MoveAnalysis,
  lines: EngineLine[] = [],
  prefix?: string,
): OutcomeEvidence | null => {
  if (move.forced || !move.bestLine || !move.playedLine) return null;
  const best = traceOutcome(move, move.bestLine, prefix),
    actual = traceOutcome(move, move.playedLine, prefix);
  const bestDraw = !!best || drawing(move.bestLine),
    actualDraw = !!actual || drawing(move.playedLine);
  const evidence = (
    reason: OutcomeEvidence["reason"],
    proof: typeof best,
    line: EngineLine,
    text: string,
  ): OutcomeEvidence => ({
    reason,
    mechanism: proof?.mechanism,
    immediate: proof?.immediate ?? false,
    pv: proof?.pv ?? line.pv.slice(0, 4),
    text,
  });
  if (
    winning(move.bestLine) &&
    actualDraw &&
    move.bestLine.move !== move.playedMove
  )
    return evidence(
      actual?.mechanism === "stalemate" && actual.immediate
        ? "allowed_stalemate"
        : "lost_win",
      actual,
      move.playedLine,
      [
        "Вы могли сохранить выигрышную позицию, но позволили сопернику добиться ничьей.",
        drawLine(actual),
      ]
        .filter(Boolean)
        .join(" "),
    );
  if (bestDraw && losing(move.playedLine))
    return evidence(
      "missed_draw",
      best,
      move.bestLine,
      [
        move.mateTransition === "allowed_mate"
          ? "Вы могли удержать ничью, но теперь вам грозит мат."
          : "Вы могли удержать ничью, но после вашего хода оказались в проигранной позиции.",
        drawLine(best),
      ]
        .filter(Boolean)
        .join(" "),
    );
  const others = lines.filter((line) => line.move !== move.playedMove);
  if (actualDraw && move.highlight && others.length && others.every(losing))
    return evidence(
      "saved_draw",
      actual,
      move.playedLine,
      ["Вы нашли путь к ничьей.", drawLine(actual)].filter(Boolean).join(" "),
    );
  return null;
};
