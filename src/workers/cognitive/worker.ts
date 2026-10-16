/// <reference lib="webworker" />
import { decide } from "../../domain/cognitive/cognitive-search.js";
import { validEngineProfile } from "../../domain/cognitive/strength.js";
import type { EngineRequest } from "../../shared/types/engine.js";
import { asError } from "../../shared/lib/errors.js";
const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = ({
  data,
}: MessageEvent<EngineRequest & { debug?: boolean }>) => {
  try {
    const profile = data.engineProfile;
    if (!validEngineProfile(profile))
      throw new Error("Invalid cognitive profile");
    const { move, trace } = decide({
      fen: data.fen,
      pgn: data.pgn,
      elo: profile.effectiveElo,
      seed: profile.seed,
      profile: profile.profile,
    });
    scope.postMessage({
      id: data.id,
      ...(data.debug ? { trace } : {}),
      move: move
        ? {
            from: move.slice(0, 2),
            to: move.slice(2, 4),
            ...(move[4] ? { promotion: move[4] } : {}),
          }
        : null,
    });
  } catch (error) {
    scope.postMessage({ id: data.id, error: asError(error).message });
  }
};
