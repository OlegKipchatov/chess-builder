/// <reference lib="webworker" />
import { choosePveMove } from "../../domain/pve/pve-ai.js";
import type { PveBattle } from "../../domain/pve/types.js";
import { asError } from "../../shared/lib/errors.js";
const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = ({
  data,
}: MessageEvent<{ id: number; battle: PveBattle }>) => {
  try {
    scope.postMessage({ id: data.id, move: choosePveMove(data.battle) });
  } catch (error) {
    scope.postMessage({ id: data.id, error: asError(error).message });
  }
};
