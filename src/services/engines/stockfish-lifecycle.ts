import { asError } from "../../shared/lib/errors.js";
import { detectStockfishCapabilities } from "./stockfish-capabilities.js";
import { STOCKFISH } from "./stockfish-config.js";
import type { UciWorker } from "./types.js";

// Module ownership is limited to serialized retirement and capability diagnostics.
// A React mount never allocates a worker until its feature requests a search.
let retirement: Promise<void> = Promise.resolve();
let threadedFailure: string | null = null;
let restartReason: string | null = null;
const retire = (worker: Worker): Promise<void> => {
  const stopped = new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      resolve();
    };
    const timer = setTimeout(finish, STOCKFISH.retirementMs);
    worker.onmessage = (event) => {
      if (event.data?.type === "ENGINE_STOPPED") finish();
    };
    worker.onerror = finish;
    try {
      worker.postMessage({ type: "STOP_ENGINE" });
    } catch {
      finish();
    }
  });
  retirement = Promise.all([retirement, stopped]).then(() => undefined);
  return retirement;
};
const recoverable = (error: Error) =>
  /WebAssembly|\bwasm\b|SharedArrayBuffer|shared memory|cross.origin|Atomics|pthread|module.*worker|worker.*module|out of memory|allocation failed/i.test(
    error.message,
  ) && !/ReferenceError|SyntaxError/.test(error.message);
export const createEngineWorker = (): UciWorker => {
  const capability = detectStockfishCapabilities();
  let variant: "threaded" | "single" =
    capability.threaded && !threadedFailure ? "threaded" : "single";
  let worker: Worker | null = null,
    closed = false,
    initialized = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const queue: unknown[] = [];
  const dispose = () => {
    clearTimeout(timer);
    const old = worker;
    worker = null;
    initialized = false;
    return old ? retire(old) : retirement;
  };
  const fail = (error: Error) => {
    if (closed) return;
    const handler = proxy.onerror;
    proxy.terminate();
    handler?.(error);
  };
  const failed = (error: Error, canRecover: boolean) => {
    if (closed) return;
    if (variant !== "threaded" || !canRecover) {
      fail(error);
      return;
    }
    threadedFailure = error.message;
    variant = "single";
    void dispose().then(start);
  };
  const proxy: UciWorker = {
    onmessage: null,
    onerror: null,
    get variant() {
      return variant;
    },
    postMessage: (data) => {
      if (closed) return;
      if (initialized && worker) worker.postMessage(data);
      else queue.push(data);
    },
    terminate: () => {
      if (closed) return;
      closed = true;
      queue.length = 0;
      proxy.onmessage = null;
      proxy.onerror = null;
      void dispose();
    },
  };
  const start = () => {
    if (closed) return;
    if (!capability.wasm) {
      fail(new Error("WebAssembly unavailable"));
      return;
    }
    try {
      const owned =
        variant === "threaded"
          ? new Worker(
              new URL("../../workers/stockfish/threaded.ts", import.meta.url),
              { type: "module" },
            )
          : new Worker(
              new URL("../../workers/stockfish/single.ts", import.meta.url),
            );
      worker = owned;
      timer = setTimeout(
        () => failed(new Error("Stockfish initialization timeout"), true),
        STOCKFISH.variantInitializationMs,
      );
      owned.onmessage = (event) => {
        if (closed || worker !== owned) return;
        if (event.data?.type === "ENGINE_INIT_ERROR") {
          failed(
            new Error(event.data.message),
            event.data.recoverable === true,
          );
          return;
        }
        if (!initialized) {
          for (const line of String(event.data).split("\n")) {
            if (line.trim() === "uciok") owned.postMessage("isready");
            if (line.trim() === "readyok") {
              initialized = true;
              clearTimeout(timer);
              queue.splice(0).forEach((data) => owned.postMessage(data));
              return;
            }
          }
          return;
        }
        proxy.onmessage?.({ data: event.data });
      };
      owned.onerror = (event) => {
        if (closed || worker !== owned) return;
        const error = new Error(event.message || "Worker failed");
        if (!initialized) failed(error, recoverable(error));
        else {
          restartReason = error.message;
          fail(error);
        }
      };
      owned.postMessage("uci");
    } catch (error) {
      failed(asError(error), recoverable(asError(error)));
    }
  };
  void retirement.then(start);
  return proxy;
};
export const recordStockfishRestart = (reason: string) => {
  restartReason = reason;
};
export const stockfishDiagnostics = () => ({ threadedFailure, restartReason });
