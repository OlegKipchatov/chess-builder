import { Chess } from "chess.js";
import { createStockfishClient } from "../../services/engines/stockfish-client.js";
import { engineLine } from "../../services/engines/stockfish-evaluation.js";
import type {
EngineClient,
EngineLine,
RawEngineLine,
} from "../../services/engines/types.js";
import type { ArchiveEntry } from "../chess/types.js";
import { classifyMove,needsRefinement } from "./analysis-classifier.js";
import { ANALYSIS_VERSION,ENGINE,PROFILE } from "./analysis-config.js";
import { selectEvents } from "./analysis-events.js";
import {
describeLine,
detectReason,
recommendationEvidence,
uci,
verifyShortMate,
} from "./analysis-reasons.js";
import { eligibleEntry } from "./analysis-storage.js";
import { prepareMateExercise } from "./analysis-training.js";
import type {
AnalysisProfile,
AnalysisProgress,
GameAnalysis,
MoveAnalysis
} from "./types.js";
const abortError = () => new DOMException("Analysis cancelled", "AbortError");
export const analyzeGame = async (
  entry: ArchiveEntry,
  {
    onProgress = () => {},
    signal,
    createClient = createStockfishClient,
    profile = PROFILE,
  }: {
    onProgress?: (progress: AnalysisProgress) => void;
    signal?: AbortSignal;
    createClient?: () => EngineClient;
    profile?: AnalysisProfile;
  } = {},
): Promise<GameAnalysis> => {
  if (!eligibleEntry(entry))
    throw Error("This archive entry cannot be analyzed");
  const jobId = crypto.randomUUID(),
    game = new Chess();
  game.loadPgn(entry.pgn);
  const history = game.history({ verbose: true }),
    position = new Chess(history[0].before),
    prefixes: string[] = [];
  const moves: MoveAnalysis[] = [];
  for (let index = 0; index < history.length; index++) {
    if (signal?.aborted) throw abortError();
    if (index % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    const move = history[index];
    prefixes.push(position.pgn());
    position.move(move);
    moves.push({
      ply: index + 1,
      actor: move.color === entry.playerColor ? "player" : "opponent",
      fenBefore: move.before,
      fenAfter: move.after,
      playedMove: uci(move),
      playedSan: move.san,
      status: move.color === entry.playerColor ? "unavailable" : "not_analyzed",
      alternatives: [],
      autoPause: false,
    });
  }
  let client: EngineClient | null = null,
    requestId = 0,
    rejectPending: ((reason: Error) => void) | null = null,
    cancelled = false,
    pipelineFailed = false;
  const timings: {
    ply: number;
    nodes: number;
    restricted: boolean;
    ms: number;
  }[] = [];
  const cancel = () => {
    cancelled = true;
    client?.terminate();
    client = null;
    rejectPending?.(abortError());
  };
  const check = () => {
    if (cancelled || signal?.aborted) throw abortError();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const search = (move: MoveAnalysis, nodes: number, searchMove?: string) =>
    new Promise<RawEngineLine[]>((resolve, reject) => {
      check();
      client ||= createClient();
      const owned = client,
        id = ++requestId,
        start = performance.now();
      rejectPending = reject;
      owned.onmessage = ({ data }) => {
        if (
          cancelled ||
          owned !== client ||
          data.id !== id ||
          data.requestId !== id ||
          data.jobId !== jobId ||
          data.moveIndex !== move.ply
        )
          return;
        rejectPending = null;
        if (
          data.recovered ||
          !Array.isArray(data.lines) ||
          !data.lines.length
        ) {
          reject(Error("Incomplete search"));
          return;
        }
        timings.push({
          ply: move.ply,
          nodes,
          restricted: !!searchMove,
          ms: performance.now() - start,
        });
        resolve(data.lines);
      };
      owned.onerror = (error) => {
        if (owned !== client || cancelled) return;
        rejectPending = null;
        reject(error);
      };
      owned.postMessage({
        id,
        requestId: id,
        jobId,
        moveIndex: move.ply,
        pgn: prefixes[move.ply - 1],
        fen: move.fenBefore,
        analysisOnly: true,
        searchMove,
        analysis: { mode: "nodes", nodes, multiPv: profile.multiPv },
      });
    });
  const evaluate = async (
    move: MoveAnalysis,
    nodes: number,
  ): Promise<MoveAnalysis> => {
    const board = new Chess(move.fenBefore),
      forced = board.moves().length === 1;
    const raw = await search(move, nodes);
    check();
    const expected = Math.min(profile.multiPv, board.moves().length);
    if (raw.length !== expected) throw Error("Incomplete MultiPV");
    const lines = raw.map((row) =>
      engineLine(row, board.turn(), entry.playerColor, { pvLimit: 12 }),
    );
    let playedLine = lines.find((line) => line.move === move.playedMove);
    if (!playedLine) {
      const [row] = await search(move, nodes, move.playedMove);
      if (row?.move !== move.playedMove) throw Error("Wrong restricted result");
      playedLine = engineLine(row, board.turn(), entry.playerColor, {
        pvLimit: 12,
      });
    }
    check();
    // Separate searches may improve the actual line. Never recommend a weaker line.
    const bestLine = [...lines, playedLine].sort(
      (a, b) => b.expectedScorePlayer - a.expectedScorePlayer,
    )[0];
    const result: MoveAnalysis = {
      ...move,
      shortMate: null,
      exercise: null,
      status: "complete",
      bestLine,
      playedLine,
      ...classifyMove({ bestLine, playedLine, lines, forced }),
    };
    const decorate = (line: EngineLine) => {
      const evidence = describeLine(move.fenBefore, line, entry.playerColor);
      if (!evidence.valid) throw Error("Illegal engine PV");
      line.san = evidence.san[0];
      line.pvSan = evidence.san;
      return evidence;
    };
    result.bestEvidence = decorate(bestLine);
    result.playedEvidence = decorate(playedLine);
    lines.forEach(decorate);
    result.recommendationEvidence = recommendationEvidence(
      result,
      entry.playerColor,
    );
    result.reason = detectReason(result);
    result.explanationKey = result.reason || result.quality;
    if (result.mateTransition === "missed_mate")
      result.shortMate = await verifyShortMate(move.fenBefore, bestLine, check);
    result.alternatives = lines
      .filter(
        (line) =>
          line.move !== move.playedMove &&
          (line.move === bestLine.move ||
            (bestLine.expectedScorePlayer - line.expectedScorePlayer <=
              PROFILE.bestCluster &&
              (bestLine.score.type !== "mate" ||
                bestLine.score.value <= 0 ||
                (line.score.type === "mate" && line.score.value > 0)))),
      )
      .slice(0, 2);
    result.recommendationRequired =
      ["mistake", "blunder"].includes(result.quality || "") ||
      result.mateTransition === "missed_mate";
    // Keep only the chosen short proof separately; discard unused diagnostic PV tails.
    for (const line of new Set([...lines, playedLine, bestLine])) {
      const limit = line.score.type === "mate" ? 8 : 4;
      line.pv = line.pv.slice(0, limit);
      line.pvSan = line.pvSan!.slice(0, limit);
    }
    delete result.bestEvidence;
    delete result.playedEvidence;
    return result;
  };
  const run = async (
    targets: number[],
    stage: AnalysisProgress["stage"],
    nodes: number,
  ) => {
    let done = 0;
    onProgress({ stage, done, total: targets.length });
    for (const index of targets) {
      check();
      try {
        moves[index] = await evaluate(moves[index], nodes);
      } catch (error) {
        check();
        pipelineFailed = true;
        client?.terminate();
        client = null;
        // Stop on an engine failure; never restart the same broken Worker for every remaining move.
        for (const pending of targets.slice(done))
          moves[pending] = {
            ...moves[pending],
            status: "unavailable",
            quality: undefined,
            highlight: null,
            reason: null,
            autoPause: false,
          };
        onProgress({ stage, done, total: targets.length });
        break;
      }
      check();
      if (stage === "deep" && moves[index].shortMate?.verified)
        moves[index].exercise = await prepareMateExercise(moves[index], check);
      check();
      onProgress({ stage, done: ++done, total: targets.length });
    }
  };
  try {
    check();
    await run(
      moves
        .map((move, i) => (move.actor === "player" ? i : -1))
        .filter((i) => i >= 0),
      "quick",
      profile.quickNodes,
    );
    if (!pipelineFailed)
      await run(
        moves
          .map((move, i) => (needsRefinement(move) ? i : -1))
          .filter((i) => i >= 0),
        "deep",
        profile.deepNodes,
      );
    check();
    const summary = {
      best: 0,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      excellent: 0,
    };
    moves
      .filter((move) => move.status === "complete")
      .forEach((move) => {
        summary[move.quality!]++;
        if (move.highlight) summary.excellent++;
      });
    const analyzedPlayerMoves = moves.filter(
        (move) => move.actor === "player" && move.status === "complete",
      ).length,
      total = history.filter((move) => move.color === entry.playerColor).length;
    return {
      analysisVersion: ANALYSIS_VERSION,
      profileVersion: profile.version,
      engine: { ...ENGINE },
      gameId: entry.id,
      sourcePgn: entry.pgn,
      playerColor: entry.playerColor,
      createdAt: new Date().toISOString(),
      status:
        analyzedPlayerMoves === total
          ? "complete"
          : analyzedPlayerMoves
            ? "partial"
            : "failed",
      totalPlies: moves.length,
      analyzedPlayerMoves,
      moves,
      focusEvents: selectEvents(moves),
      summary,
      diagnostics: { searches: timings },
    };
  } finally {
    signal?.removeEventListener("abort", cancel);
    (client as EngineClient | null)?.terminate();
    rejectPending = null;
  }
};
