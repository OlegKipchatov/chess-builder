import { AUTO_KEY,restoreAutoRun } from "../../domain/autochess/autochess.js";
import type { AutoRun } from "../../domain/autochess/types.js";
import type { StoragePort } from "./state.js";
export const createAutoStore = (
  storage: StoragePort & { removeItem: (key: string) => void },
) => {
  let raw = storage.getItem(AUTO_KEY),
    run = restoreAutoRun(raw);
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot: () => run,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    save: (next: AutoRun | null) => {
      if (storage.getItem(AUTO_KEY) !== raw)
        throw Error("Серия изменилась в другой вкладке. Откройте её заново.");
      const serialized = next === null ? null : JSON.stringify(next);
      if (serialized === null) storage.removeItem(AUTO_KEY);
      else storage.setItem(AUTO_KEY, serialized);
      raw = serialized;
      run = next;
      publish();
      return true;
    },
    refresh: () => {
      raw = storage.getItem(AUTO_KEY);
      run = restoreAutoRun(raw);
      publish();
    },
  };
};
