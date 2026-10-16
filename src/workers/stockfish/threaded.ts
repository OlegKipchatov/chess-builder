/// <reference lib="webworker" />
import { asError } from "../../shared/lib/errors.js";
const scope = globalThis as unknown as DedicatedWorkerGlobalScope & {
  Worker: typeof Worker;
};
interface StockfishEngine {
  uci: (command: string) => void;
  listen: (line: string) => void;
  onError: (message: string) => void;
  setNnueBuffer: (data: Uint8Array, index: number) => void;
}
interface StockfishOptions {
  wasmMemory: WebAssembly.Memory;
  mainScriptUrlOrBlob: string;
  locateFile: (path: string) => string;
}
let engine: StockfishEngine | null = null,
  closed = false;
const queue: string[] = [];
const children = new Set<Worker>(),
  NativeWorker = scope.Worker;
scope.Worker = class extends NativeWorker {
  constructor(url: string | URL, options?: WorkerOptions) {
    super(url, options);
    children.add(this);
  }
  override terminate() {
    children.delete(this);
    super.terminate();
  }
};
scope.onmessage = (event: MessageEvent<string | { type: string }>) => {
  if (typeof event.data === "object" && event.data.type === "STOP_ENGINE") {
    closed = true;
    for (const child of children) child.terminate();
    queue.length = 0;
    engine = null;
    scope.postMessage({ type: "ENGINE_STOPPED" });
    scope.close();
    return;
  }
  if (typeof event.data !== "string") return;
  if (engine) engine.uci(event.data);
  else queue.push(event.data);
};
const initialize = async () => {
  if (!scope.crossOriginIsolated || typeof SharedArrayBuffer === "undefined")
    throw Object.assign(
      new Error("Stockfish shared memory requires isolation"),
      { recoverable: true },
    );
  const base = new URL("../vendor/sf19/", scope.location.href);
  let instance: StockfishEngine;
  try {
    const { default: createStockfish } = (await import(
      /* @vite-ignore */ new URL("sf_19_smallnet.js", base).href
    )) as { default: (options: StockfishOptions) => Promise<StockfishEngine> };
    instance = await createStockfish({
      wasmMemory: new WebAssembly.Memory({
        initial: 1024,
        maximum: 2048,
        shared: true,
      }),
      mainScriptUrlOrBlob: new URL("sf_19_smallnet.js", base).href,
      locateFile: (path) => new URL(path, base).href,
    });
  } catch (error) {
    const failure = asError(error);
    if (
      !(failure instanceof ReferenceError) &&
      !(failure instanceof SyntaxError) &&
      (failure instanceof WebAssembly.CompileError ||
        failure instanceof WebAssembly.LinkError ||
        failure instanceof WebAssembly.RuntimeError ||
        failure instanceof RangeError ||
        /wasm|memory|pthread|Atomics/i.test(failure.message))
    )
      throw Object.assign(failure, { recoverable: true });
    throw failure;
  }
  if (closed) return;
  instance.listen = (data) => scope.postMessage(data);
  instance.onError = (message) => {
    throw new Error(message);
  };
  const response = await fetch(new URL("nn-61e7af4bb97d.nnue", base));
  if (!response.ok) throw new Error("Stockfish 19 network unavailable");
  instance.setNnueBuffer(new Uint8Array(await response.arrayBuffer()), 0);
  if (closed) return;
  engine = instance;
  queue.splice(0).forEach((command) => instance.uci(command));
};
void initialize().catch((error) => {
  if (!closed)
    scope.postMessage({
      type: "ENGINE_INIT_ERROR",
      message: asError(error).message,
      recoverable:
        typeof error === "object" &&
        error !== null &&
        "recoverable" in error &&
        error.recoverable === true,
    });
});
