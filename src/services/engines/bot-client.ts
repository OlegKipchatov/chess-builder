import { Chess } from "chess.js";
import { decisionModeFor } from "../../domain/cognitive/cognitive-model.js";
import { validEngineProfile } from "../../domain/cognitive/strength.js";
import type { EngineProfile } from "../../domain/cognitive/types.js";
import { asError } from "../../shared/lib/errors.js";
import { createStockfishClient } from "./stockfish-client.js";
import type {
  EngineClient,
  EngineRequest,
  EngineResponse,
} from "../../shared/types/engine.js";
export const COGNITIVE_TIMEOUT_MS = 12000;
export const createBotClient = (
  profile: EngineProfile,
  {
    spawn = () =>
      new Worker(
        new URL("../../workers/cognitive/worker.ts", import.meta.url),
        { type: "module" },
      ),
    native = createStockfishClient,
  } = {},
): EngineClient => {
  if (!validEngineProfile(profile)) throw new Error("Invalid engine profile");
  if (decisionModeFor(profile.targetElo) === "native-stockfish")
    return native();
  let worker: Worker | null = null,
    current: EngineRequest | null = null,
    dead = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(timer);
    current = null;
    dead = true;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      worker = null;
    }
  };
  const fail = (error: Error) => {
    if (dead) return;
    stop();
    client.onerror?.(error);
  };
  const client: EngineClient = {
    onmessage: null,
    onerror: null,
    terminate: stop,
    postMessage: (data) => {
      if (dead) throw new Error("Cognitive worker terminated");
      if (current) throw new Error("Search already running");
      if (JSON.stringify(data.engineProfile) !== JSON.stringify(profile))
        throw new Error("Session profile changed");
      current = data;
      timer = setTimeout(
        () => fail(new Error("Cognitive search timeout")),
        COGNITIVE_TIMEOUT_MS,
      );
      try {
        if (!worker) {
          worker = spawn();
          worker.onmessage = ({ data }: MessageEvent<EngineResponse>) => {
            if (dead || !current || data.id !== current.id) return;
            try {
              if (data.error) throw new Error(data.error);
              const game = new Chess();
              if (current.pgn) game.loadPgn(current.pgn);
              else if (current.fen) game.load(current.fen);
              if (current.fen && game.fen() !== current.fen)
                throw new Error("Position/history mismatch");
              if (data.move) game.move(data.move);
              else if (!game.isGameOver())
                throw new Error("Missing cognitive move");
              clearTimeout(timer);
              current = null;
              client.onmessage?.({ data });
            } catch (error) {
              fail(asError(error));
            }
          };
          worker.onerror = (event) =>
            fail(new Error(event.message || "Cognitive worker failed"));
        }
        worker.postMessage(data);
      } catch (error) {
        fail(asError(error));
      }
    },
  };
  return client;
};
