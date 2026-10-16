/// <reference lib="webworker" />
const scope = globalThis as unknown as DedicatedWorkerGlobalScope & {
  STOCKFISH_WASM_URL: string;
};
scope.STOCKFISH_WASM_URL = new URL(
  "../vendor/sf19-single/stockfish-19-lite-single.wasm",
  scope.location.href,
).href;
scope.importScripts(
  new URL(
    "../vendor/sf19-single/stockfish-19-lite-single.js",
    scope.location.href,
  ).href,
);
const uciHandler = scope.onmessage;
scope.onmessage = (event) => {
  if (event.data?.type === "STOP_ENGINE") {
    scope.onmessage = null;
    scope.postMessage({ type: "ENGINE_STOPPED" });
    scope.close();
    return;
  }
  uciHandler?.call(scope, event);
};
export { };
