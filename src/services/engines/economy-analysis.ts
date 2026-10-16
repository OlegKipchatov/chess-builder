import { Chess } from "chess.js";
import type { ArchiveEntry } from "../../domain/chess/types.js";
import {
  expectedScore,
  summarizeQuality,
} from "../../domain/economy/reward-quality.js";
import type {
  QualityDecision,
  QualitySummary,
} from "../../domain/economy/types.js";
import { aborted, asError } from "../../shared/lib/errors.js";
import { createStockfishClient } from "./stockfish-client.js";
import { STOCKFISH as C } from "./stockfish-config.js";
import { recordStockfishRestart } from "./stockfish-lifecycle.js";
import type {
  EngineClient,
  RawEngineLine,
  SearchDiagnostic,
} from "../../shared/types/engine.js";
// A separate full-strength fixed-node profile, never the adaptive opponent.
export const analyzeReward = async (
  entry: ArchiveEntry,
  {
    onProgress = () => {},
    onRetry = () => {},
    createClient = createStockfishClient,
    requestTimeoutMs = C.economyRequestMs,
    signal,
  }: {
    onProgress?: (done: number, total: number) => void;
    onRetry?: (state: { done: number; total: number; attempt: number }) => void;
    createClient?: () => EngineClient;
    requestTimeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<QualitySummary> => {
  const final = new Chess();
  final.loadPgn(entry.pgn);
  const history = final.history({ verbose: true }),
    position = new Chess(history[0]?.before || final.fen());
  const decisions: QualityDecision[] = [],
    diagnostics: SearchDiagnostic[] = [];
  let client: EngineClient | null = null,
    id = 0,
    done = 0;
  const total = history.filter(
    (move) => move.color === entry.playerColor,
  ).length;
  const search = async (searchMove?: string): Promise<RawEngineLine> => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (signal?.aborted) throw aborted();
        client ||= createClient();
        const owned = client,
          requestId = ++id;
        return await new Promise<RawEngineLine>((resolve, reject) => {
          let settled = false;
          const finish = (error: unknown, value?: RawEngineLine) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener("abort", cancel);
            owned.onmessage = null;
            owned.onerror = null;
            if (error) reject(error);
            else resolve(value!);
          };
          const cancel = () => {
            owned.terminate();
            finish(aborted());
          };
          const timer = setTimeout(
            () => finish(Error("Economy request timeout")),
            requestTimeoutMs,
          );
          signal?.addEventListener("abort", cancel, { once: true });
          owned.onmessage = ({ data }) => {
            if (owned !== client || data.id !== requestId) return;
            try {
              if (!data.evaluation || data.recovered)
                throw Error("Incomplete economy evaluation");
              if (searchMove && data.evaluation.move !== searchMove)
                throw Error("Wrong restricted move");
              expectedScore(data.evaluation);
              finish(null, data.evaluation);
            } catch (error) {
              finish(error);
            }
          };
          owned.onerror = (error) => {
            if (owned === client) finish(error);
          };
          try {
            owned.postMessage({
              id: requestId,
              pgn: position.pgn(),
              fen: position.fen(),
              economy: true,
              searchMove,
            });
          } catch (error) {
            finish(error);
          }
        });
      } catch (error) {
        client?.terminate();
        client = null;
        if (signal?.aborted) throw aborted();
        diagnostics.push({
          ply: position.history().length + 1,
          stage: searchMove ? "played" : "best",
          attempt,
          message: String(asError(error).message).slice(0, 180),
        });
        if (attempt === 3) {
          const failure = Error("Economy evaluation failed after 3 attempts");
          Object.assign(failure, { diagnostics: diagnostics.slice(-9) });
          throw failure;
        }
        recordStockfishRestart("economy: " + String(asError(error).message));
        onRetry({ done, total, attempt: attempt + 1 });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    throw new Error("Search exhausted");
  };
  try {
    for (const move of history) {
      const token = move.from + move.to + (move.promotion || "");
      if (move.color === entry.playerColor) {
        if (position.moves().length <= 1) decisions.push({ forced: true });
        else {
          const best = await search();
          const played = best.move === token ? best : await search(token);
          decisions.push({
            loss: Math.max(0, expectedScore(best) - expectedScore(played)),
          });
        }
        onProgress(++done, total);
      }
      position.move(move);
    }
    return {
      ...summarizeQuality(decisions),
      ...(diagnostics.length ? { diagnostics: diagnostics.slice(-9) } : {}),
    };
  } finally {
    (client as EngineClient | null)?.terminate();
  }
};
