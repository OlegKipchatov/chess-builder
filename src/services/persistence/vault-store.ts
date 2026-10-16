import type { VaultState } from "../../domain/chess/types.js";
import { initialState,KEY,loadState,type StoragePort } from "./state.js";
export type TransactionResult<T> =
  { ok: true; value: T; state: VaultState } | { ok: false; error: Error };
type LockPort = {
  request: <T>(name: string, callback: () => Promise<T>) => Promise<T>;
};
export const createVaultStore = (storage: StoragePort, locks?: LockPort) => {
  let state: VaultState = initialState(),
    error: Error | null = null;
  try {
    state = loadState(storage);
  } catch (cause) {
    error = cause instanceof Error ? cause : new Error(String(cause));
  }
  const listeners = new Set<() => void>();
  let queue: Promise<unknown> = Promise.resolve();
  const publish = (next: VaultState) => {
    // Reuse unchanged slices so a move cannot invalidate collection/ledger subscribers.
    for (const key of Object.keys(next) as (keyof VaultState)[]) {
      if (JSON.stringify(next[key]) === JSON.stringify(state[key]))
        Object.defineProperty(next, key, {
          value: state[key],
          enumerable: true,
          writable: true,
          configurable: true,
        });
    }
    state = next;
    listeners.forEach((listener) => listener());
  };
  const transact = <T>(
    transform: (current: VaultState) => { state: VaultState; value: T },
  ): Promise<TransactionResult<T>> => {
    const execute = async (): Promise<TransactionResult<T>> => {
      try {
        if (error) throw error;
        const current = loadState(storage);
        const result = transform(current);
        if (result.state !== current)
          storage.setItem(KEY, JSON.stringify(result.state));
        publish(result.state);
        return { ok: true, ...result };
      } catch (cause) {
        return {
          ok: false,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        };
      }
    };
    const pending = queue.then(() =>
      locks ? locks.request("gachachess-vault-v3", execute) : execute(),
    );
    queue = pending.catch(() => undefined);
    return pending;
  };
  return {
    getSnapshot: () => state,
    getError: () => error,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    transact,
    update: (transform: (current: VaultState) => VaultState) =>
      transact((current) => ({ state: transform(current), value: undefined })),
    refresh: () => {
      try {
        publish(loadState(storage));
      } catch (cause) {
        error = cause instanceof Error ? cause : new Error(String(cause));
        listeners.forEach((listener) => listener());
      }
    },
  };
};
export type VaultStore = ReturnType<typeof createVaultStore>;
