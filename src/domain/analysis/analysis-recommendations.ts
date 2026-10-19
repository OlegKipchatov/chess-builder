import { tacticalEvidence } from "./analysis-tactics.js";
import type { Color, Move, PieceSymbol, Square } from "chess.js";
import { Chess } from "chess.js";
import { evaluationExplanation } from "./analysis-evaluation-copy.js";
import type { EngineLine } from "../../shared/types/engine.js";
import type {
  ComparisonFact,
  Continuation,
  MoveAnalysis,
  Recommendation,
  TraceStep,
} from "./types.js";

export const RECOMMENDATION_VERSION = "consequences-v3";
export const MAX_EVIDENCE_PLIES = 12;
const value = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const name = {
  p: "пешку",
  n: "коня",
  b: "слона",
  r: "ладью",
  q: "ферзя",
  k: "короля",
};
const actorName = {
  p: "Пешка",
  n: "Конь",
  b: "Слон",
  r: "Ладья",
  q: "Ферзь",
  k: "Король",
};
const genitiveName = {
  p: "пешки",
  n: "коня",
  b: "слона",
  r: "ладьи",
  q: "ферзя",
  k: "короля",
};
const pluralName = {
  p: ["пешки", "пешек"],
  n: ["коня", "коней"],
  b: ["слона", "слонов"],
  r: ["ладьи", "ладей"],
  q: ["ферзя", "ферзей"],
  k: ["короля", "королей"],
};
const joinPieces = (items: string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(", ")} и ${items.at(-1)}`
    : items[0] || "";
const materialDescription = (steps: TraceStep[]) => {
  const counts: Record<PieceSymbol, number> = {
    p: 0,
    n: 0,
    b: 0,
    r: 0,
    q: 0,
    k: 0,
  };
  for (const step of steps) {
    const sign = step.actor === "player" ? 1 : -1;
    if (step.captured) counts[step.captured] += sign;
    if (step.promotion) {
      counts[step.promotion] += sign;
      counts.p -= sign;
    }
  }
  const pieces = (sign: number) =>
    joinPieces(
      (["q", "r", "b", "n", "p"] as const)
        .filter((piece) => counts[piece] * sign > 0)
        .map((piece) => {
          const count = Math.abs(counts[piece]);
          const quantity =
            count === 2
              ? piece === "p" || piece === "r"
                ? "две"
                : "два"
              : [
                  "",
                  "",
                  "",
                  "три",
                  "четыре",
                  "пять",
                  "шесть",
                  "семь",
                  "восемь",
                ][count] || String(count);
          return count === 1
            ? name[piece]
            : `${quantity} ${pluralName[piece][count >= 2 && count <= 4 ? 0 : 1]}`;
        }),
    );
  return { gained: pieces(1), lost: pieces(-1) };
};
const materialOutcome = (trace: Continuation) => {
  const { gained, lost } = materialDescription(trace.steps);
  if (lost && gained) return `вы отдаёте ${lost}, получая взамен ${gained}`;
  if (lost) return `вы теряете ${lost}`;
  if (gained) return `вы выигрываете ${gained}`;
  return "равноценные взятия не меняют соотношение материала";
};
const tokenOf = (move: Move) => move.from + move.to + (move.promotion || "");
const play = (game: Chess, token: string) =>
  game.move({
    from: token.slice(0, 2),
    to: token.slice(2, 4),
    promotion: token[4],
  });
const balance = (game: Chess, color: Color) =>
  game
    .board()
    .flat()
    .filter((piece) => piece !== null)
    .reduce((sum, p) => sum + value[p.type] * (p.color === color ? 1 : -1), 0);
const materialEnd = (trace: Continuation) =>
  Math.max(
    1,
    ...trace.steps
      .filter((step) => step.captured || step.promotion)
      .map((step) => step.ply),
  );
// A distant hypothetical threat should not displace a direct explanation.
// Confirmed material outcomes retain their priority even after a long exchange.
const rank = (fact: ComparisonFact) =>
  fact.priority - (fact.kind === "material" ? 0 : (fact.end - 1) * 3);
const orderFacts = (a: ComparisonFact, b: ComparisonFact) =>
  rank(b) - rank(a) || a.end - b.end;
// A threat is a legal capture if the opponent does not address it. It is not a
// promise that material can be won: pinned pieces are excluded by legal moves.
const capturesFor = (game: Chess, color: Color) => {
  const parts = game.fen().split(" ");
  parts[1] = color;
  parts[3] = "-";
  const view = new Chess(parts.join(" "));
  return view
    .moves({ verbose: true })
    .filter((move) => move.captured && move.captured !== "k");
};

// The same trace is used for any position, side and move sequence. No opening,
// game ID, square pattern or particular sequence is part of the detector.
export const traceContinuation = (
  fen: string,
  line: EngineLine | undefined,
  color: Color,
): Continuation | null => {
  const game = new Chess(fen),
    start = balance(game, color),
    steps: TraceStep[] = [];
  const pv = (line?.pv || []).slice(0, MAX_EVIDENCE_PLIES);
  if (!line || !pv.length || (line.move && pv[0] !== line.move)) return null;
  try {
    for (const token of pv) {
      const moving = game.get(token.slice(0, 2) as Square);
      const before =
        moving?.color === color
          ? capturesFor(game, color)
              .filter((row) => row.from === token.slice(0, 2))
              .map((row) => row.to)
          : [];
      const move = play(game, token),
        player = move.color === color;
      const threats = player
        ? capturesFor(game, color)
            .filter((row) => row.from === move.to && !before.includes(row.to))
            .map((row) => ({ square: row.to, piece: row.captured! }))
        : [];
      steps.push({
        ply: steps.length + 1,
        token,
        actor: player ? "player" : "opponent",
        piece: move.piece,
        from: move.from,
        to: move.to,
        captured: move.captured || null,
        promotion: move.promotion || null,
        check: game.isCheck(),
        mate: game.isCheckmate(),
        delta: balance(game, color) - start,
        threats,
      });
      if (game.isGameOver()) break;
    }
  } catch {
    return null;
  }
  const last = steps.at(-1)!;
  const recapturePending =
    !!(last.captured || last.promotion) &&
    game
      .moves({ verbose: true })
      .some((row) => row.captured && row.to === last.to);
  return {
    steps,
    pv: steps.map((row) => row.token),
    delta: last.delta,
    settled: !recapturePending,
    terminal: game.isGameOver(),
  };
};

// Explain why an attacked destination can still be usable. Enumerate captures
// and recaptures for any piece; this is a conditional branch, never "best defence".
const protectionEvidence = (
  fen: string,
  line: EngineLine,
  _color: Color,
): Omit<
  Extract<ComparisonFact, { kind: "protection" }>,
  "priority" | "end"
> | null => {
  const game = new Chess(fen);
  let first;
  try {
    first = play(game, line.move);
  } catch {
    return null;
  }
  for (const capture of game
    .moves({ verbose: true })
    .filter((row) => row.captured && row.to === first.to)) {
    game.move(capture);
    for (const reply of game
      .moves({ verbose: true })
      .filter((row) => row.captured && row.to === capture.to)) {
      game.move(reply);
      const gain = value[capture.piece] - value[first.piece];
      const unsafe = game
        .moves({ verbose: true })
        .some(
          (row) =>
            row.captured && row.to === reply.to && value[row.captured!] > gain,
        );
      game.undo();
      if (gain > 0 && !unsafe) {
        game.undo();
        return {
          kind: "protection",
          actor: first.piece,
          capturedBy: capture.piece,
          defender: reply.piece,
          pv: [tokenOf(first), tokenOf(capture), tokenOf(reply)],
        };
      }
    }
    game.undo();
  }
  return null;
};

const describeAction = (step: TraceStep): string | null => {
  if (step.promotion)
    return `${actorName[step.piece]} превращается в ${name[step.promotion]}.`;
  if (step.mate) return `${actorName[step.piece]} ставит мат.`;
  if (step.captured)
    return `${actorName[step.piece]} забирает ${name[step.captured]}${step.check ? " с шахом" : ""}.`;
  if (step.threats.length)
    return `${actorName[step.piece]} ${step.threats.length > 1 ? "создаёт одновременное нападение на" : "нападает на"} ${step.threats.map((target) => name[target.piece]).join(" и ")}${step.check ? " с шахом" : ""}.`;
  if (step.check) return `${actorName[step.piece]} даёт шах.`;
  return null;
};

// Compare facts, then rank the differences. Text rendering consumes the selected
// facts; it does not recognize moves or infer strategic causes from a score.
export const compareContinuations = (
  best: Continuation | null,
  actual: Continuation | null,
): ComparisonFact[] => {
  const candidates: ComparisonFact[] = [];
  if (!best || !actual) return candidates;
  const materialGap = best.delta - actual.delta;
  if (
    best.settled &&
    actual.settled &&
    materialGap >= 1 &&
    (best.delta > 0 || actual.delta < 0)
  ) {
    const immediateLoss =
      actual.steps[1]?.captured && actual.steps[1].to === actual.steps[0].to;
    candidates.push({
      kind: "material",
      priority: 90,
      end: materialEnd(best),
      bestDelta: best.delta,
      actualDelta: actual.delta,
      reason:
        actual.delta < 0
          ? immediateLoss
            ? "hung_piece"
            : "lost_material"
          : best.steps[0].captured
            ? "missed_capture"
            : "missed_tactic",
    });
  }
  const promotion = best.steps.find(
    (step) => step.actor === "player" && step.promotion,
  );
  if (
    promotion &&
    !(
      best.steps[promotion.ply]?.captured &&
      best.steps[promotion.ply]?.to === promotion.to
    ) &&
    !actual.steps.some((step) => step.actor === "player" && step.promotion)
  )
    candidates.push({
      kind: "promotion",
      priority: 85,
      end: promotion.ply,
      step: promotion,
    });
  const first = best.steps[0];
  // An equal exchange is not called a gain. Compare what happens to its target
  // in the actual line, regardless of the later move, piece types or squares.
  if (first.captured) {
    const escape = actual.steps.find(
      (step, index) =>
        step.actor === "opponent" &&
        step.from === first.to &&
        !actual.steps
          .slice(0, index)
          .some((previous) => previous.to === first.to),
    );
    const recapture =
      best.steps[1]?.captured && best.steps[1].to === first.to
        ? best.steps[1]
        : null;
    if (escape)
      candidates.push({
        kind: "target_escape",
        priority:
          !recapture &&
          (escape.captured || (escape.ply === 2 && value[first.captured] >= 3))
            ? 105
            : 70,
        end: recapture ? Math.min(best.steps.length, 3) : 1,
        first,
        escape,
        recapture,
        followup: best.steps.find(
          (step) => step.actor === "player" && step.ply > 1,
        ),
        reason:
          escape.captured && actual.settled && actual.delta < 0
            ? "lost_material"
            : !recapture &&
                best.settled &&
                best.delta > 0 &&
                best.delta > actual.delta
              ? "missed_capture"
              : undefined,
      });
  }
  for (const step of best.steps.filter(
    (row) => row.actor === "player" && row.ply <= 3,
  )) {
    // A piece immediately recaptured cannot carry out its apparent threats.
    const reply = best.steps[step.ply];
    if (reply?.captured && reply.to === step.to) continue;
    const distinct = step.threats.filter(
      (target) =>
        value[target.piece] >= 3 &&
        !actual.steps
          .slice(0, step.ply)
          .some(
            (other) =>
              other.actor === "player" &&
              other.threats.some(
                (t) => t.square === target.square && t.piece === target.piece,
              ),
          ),
    );
    if (distinct.length) {
      const response = best.steps
        .slice(step.ply, step.ply + 3)
        .find(
          (reply) =>
            reply.actor === "opponent" &&
            distinct.some(
              (target) =>
                target.square === reply.from && target.piece === reply.piece,
            ) &&
            !best.steps
              .slice(step.ply, reply.ply - 1)
              .some(
                (previous) =>
                  previous.from === reply.from || previous.to === reply.from,
              ),
        );
      candidates.push({
        kind: "threat",
        priority:
          distinct.filter((target) => value[target.piece] >= 3).length > 1
            ? 65
            : 50,
        end: response?.ply ?? step.ply,
        step: { ...step, threats: distinct },
        response,
      });
    }
  }
  const checkFollowup = best.steps.find(
    (step) => step.actor === "player" && step.ply > 1,
  );
  if (
    first.check &&
    !actual.steps[0].check &&
    checkFollowup &&
    (checkFollowup.captured ||
      checkFollowup.promotion ||
      checkFollowup.threats.some((target) => value[target.piece] >= 3))
  )
    candidates.push({
      kind: "check",
      priority: 30,
      end: Math.min(best.steps.length, 3),
      step: first,
      followup: best.steps.find(
        (step) => step.actor === "player" && step.ply > 1,
      ),
    });
  return candidates.sort(orderFacts);
};

const renderComparison = (
  fact: Exclude<ComparisonFact, { kind: "protection" }>,
  best: Continuation,
  actual: Continuation,
): string => {
  if (fact.kind === "exchange") {
    const [first, reply] = fact.steps;
    if (
      fact.steps.length === 2 &&
      first.captured &&
      value[first.piece] > value[first.captured]
    )
      return `Вы забираете ${name[first.captured]}, но ${actorName[reply.piece].toLowerCase()} соперника может взять ${name[first.piece]} в ответ. ${actorName[first.piece]} ценнее ${genitiveName[first.captured]}, поэтому такой размен невыгоден.`;
    const { gained, lost } = materialDescription(fact.steps);
    if (gained)
      return `Вы отдаёте ${lost} за ${gained}. По материалу такой размен невыгоден; предложенный ход не требует этой отдачи.`;
    return `После вашего хода соперник забирает ${lost} без ответного взятия. Предложенный ход позволяет избежать этой потери в показанном варианте.`;
  }
  if (fact.kind === "material") {
    const first = best.steps[0],
      reply = best.steps[1];
    if (
      first.captured &&
      reply?.captured &&
      reply.to === first.to &&
      value[first.captured] > value[first.piece] &&
      best.delta > 0
    )
      return `Можно забрать ${name[first.captured!]}, отдав взамен ${name[first.piece]}. В показанном размене вы получаете более ценную фигуру.`;
    if (fact.actualDelta < 0 && fact.bestDelta >= 0)
      return `После вашего хода в показанном варианте ${materialOutcome(actual)}. Предложенное продолжение ${fact.bestDelta > 0 ? `выгоднее: ${materialOutcome(best)}` : "сохраняет материал"}.`;
    if (fact.actualDelta < 0)
      return `После вашего хода в показанном варианте ${materialOutcome(actual)}. Предложенный вариант уменьшает потери: ${materialOutcome(best)}.`;
    return `В предложенном варианте ${materialOutcome(best)}. После вашего хода ${materialOutcome(actual)} — поэтому материальная выгода меньше.`;
  }
  if (fact.kind === "target_escape") {
    const { first, escape, recapture, followup } = fact;
    const opening = recapture
      ? `Сначала можно разменять ${name[first.piece]} на ${name[first.captured!]}${first.check ? " с шахом" : ""}.`
      : `Можно сразу забрать ${name[first.captured!]}${first.check ? " с шахом" : ""}.`;
    if (!recapture && escape.captured)
      return `${opening} После вашего хода ${actorName[escape.piece].toLowerCase()} соперника в показанном варианте забирает ${name[escape.captured]}.`;
    const next = recapture && followup ? describeAction(followup) : null;
    return `${opening}${next ? " Затем " + next[0].toLowerCase() + next.slice(1) : ""} После сыгранного хода соперник может увести ${name[first.captured!]}${escape.check ? " с шахом" : ""} и избежать этого взятия.`;
  }
  if (fact.kind === "promotion")
    return `В показанном продолжении ${describeAction(fact.step)!.toLowerCase()}`;
  if (fact.kind === "threat") {
    const targets = joinPieces(
      fact.step.threats.map((target) => name[target.piece]),
    );
    const action = `${actorName[fact.step.promotion || fact.step.piece]} ${fact.step.threats.length > 1 ? "создаёт одновременное нападение на" : "нападает на"} ${targets}${fact.step.check ? " с шахом" : ""}.`;
    const response = fact.response;
    const consequence = response
      ? `В показанном варианте соперник ${response.captured ? `забирает ${name[response.captured]} атакованной фигурой` : `уводит ${name[response.piece]}`}.`
      : `Если соперник не устранит угрозу, можно будет взять ${fact.step.threats.length > 1 ? "одну из атакованных фигур" : targets}.`;
    return `${fact.step.ply > 1 ? "В показанном продолжении " + action[0].toLowerCase() + action.slice(1) : action} ${consequence}`;
  }
  const next =
    "followup" in fact && fact.followup ? describeAction(fact.followup) : null;
  return `${describeAction("step" in fact ? fact.step : best.steps[0])} Соперник должен ответить на шах.${next ? " Затем " + next[0].toLowerCase() + next.slice(1) : ""}`;
};

const renderMaterialConsequence = (best: Continuation, actual: Continuation) =>
  `В этом варианте ${materialOutcome(best)}; после сыгранного хода ${materialOutcome(actual)}.`;

export const buildRecommendation = (
  move: MoveAnalysis,
  color: Color,
): Recommendation | null => {
  if (
    move.forced ||
    move.outcome ||
    !move.bestLine ||
    move.bestLine.move === move.playedMove ||
    move.mateTransition ||
    move.highlight ||
    (Number.isFinite(move.expectedScoreLoss) &&
      (move.expectedScoreLoss ?? Infinity) <= 0.005)
  )
    return null;
  if (new Chess(move.fenBefore).turn() !== color) return null;
  const best = traceContinuation(move.fenBefore, move.bestLine, color);
  const actual = traceContinuation(move.fenBefore, move.playedLine, color);
  if (!best || !actual) return null;
  const candidates = compareContinuations(best, actual);
  // Preserve an immediate losing exchange even when a distant PV tail ends
  // mid-recapture. Only complete, legally replayed exchanges are explanatory.
  let exchangeEnd = 1;
  while (
    actual.steps[exchangeEnd]?.captured &&
    actual.steps[exchangeEnd].to === actual.steps[0].to
  )
    exchangeEnd++;
  if (exchangeEnd > 1) {
    const exchange = traceContinuation(
      move.fenBefore,
      { ...move.playedLine!, pv: actual.pv.slice(0, exchangeEnd) },
      color,
    );
    if (
      exchange?.settled &&
      exchange.delta < 0 &&
      actual.delta < 0 &&
      best.delta >= 0 &&
      best.settled
    )
      candidates.push({
        kind: "exchange",
        priority: 110,
        end: 1,
        actualEnd: exchangeEnd,
        steps: exchange.steps,
        reason: actual.steps[0].captured ? "lost_material" : "hung_piece",
      });
  }
  const protection = protectionEvidence(move.fenBefore, move.bestLine, color);
  if (protection) candidates.push({ ...protection, priority: 60, end: 3 });
  candidates.sort(orderFacts);
  const fact = candidates[0];
  if (!fact)
    return {
      version: RECOMMENDATION_VERSION,
      kind: "evaluation",
      primary: true,
      coverage: "evaluation_only",
      text: evaluationExplanation(move),
      pv: best.pv.slice(0, 1),
      facts: [],
    };
  const tactic = tacticalEvidence(move.fenBefore, best, actual, color);
  const end = Math.max(fact.end, tactic?.end ?? 0);
  const pv =
    fact.kind === "protection" && !tactic ? fact.pv : best.pv.slice(0, end);
  const description =
    fact.kind === "protection"
      ? `Если соперник заберёт ${name[fact.actor]} ${fact.capturedBy === "n" ? "конём" : "своей фигурой"}, вы сможете в ответ забрать ${name[fact.capturedBy]}. ${actorName[fact.defender]} защищает ${name[fact.actor]}; в таком размене соперник отдаст более ценную фигуру.`
      : renderComparison(fact, best, actual);
  // Describe an observed action without pretending it explains the evaluation.
  const incompleteCause =
    ["check", "threat", "promotion", "protection"].includes(fact.kind) &&
    !tactic;
  const text = tactic
    ? `${tactic.text} ${renderMaterialConsequence(best, actual)}`
    : incompleteCause
      ? `${description} ${evaluationExplanation(move)}`
      : description;
  const signature =
    fact.kind === "protection"
      ? fact.pv
      : fact.kind === "threat"
        ? fact.step.threats.map((target) => target.piece + target.square).sort()
        : fact.kind === "target_escape"
          ? [fact.first.captured, fact.first.check, fact.escape.check]
          : [];
  return {
    version: RECOMMENDATION_VERSION,
    kind: fact.kind,
    primary: true,
    coverage: "verified_line",
    reason: fact.reason || null,
    text,
    pv,
    themeKey: !["material", "exchange"].includes(fact.kind)
      ? `${fact.kind}:${move.bestLine.move}:${signature.join(":")}`
      : null,
    facts: [{ ...fact, pv: undefined }, ...(tactic ? [tactic] : [])],
    tactic: tactic?.kind,
    playedPv: actual.pv.slice(
      0,
      fact.kind === "exchange"
        ? fact.actualEnd
        : fact.kind === "target_escape"
          ? fact.escape.ply
          : fact.kind === "material"
            ? materialEnd(actual)
            : Math.min(actual.pv.length, 3),
    ),
    comparison: {
      bestDelta: best.delta,
      playedDelta: actual.delta,
      bestPlies: best.pv.length,
      playedPlies: actual.pv.length,
    },
  };
};
