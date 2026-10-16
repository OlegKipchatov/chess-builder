import {
useEffect,
useReducer,
useRef,
useState,
useSyncExternalStore,
} from "react";
import { useVaultStore } from "../../app/providers/VaultProvider.js";
import { createBattleController } from "../../domain/autochess/autochess-battle.js";
import { awardAutochess } from "../../domain/autochess/autochess-rewards.js";
import {
AUTO_KEY,
beginBattle,
createAutoRun,
nextRound,
} from "../../domain/autochess/autochess.js";
import type { AutoRun } from "../../domain/autochess/types.js";
import { createAutoStore } from "../../services/persistence/autochess-store.js";
export const useAutochess = () => {
  const [store] = useState(() => createAutoStore(localStorage)),
    run = useSyncExternalStore(store.subscribe, store.getSnapshot),
    wallet = useVaultStore(),
    [error, setError] = useState(""),
    [locked, setLocked] = useState(false),
    [award, setAward] = useState(false),
    [revision, render] = useReducer((n: number) => n + 1, 0),
    controller = useRef<ReturnType<typeof createBattleController> | null>(null);
  useEffect(() => {
    let cancelled = false,
      release: (() => void) | undefined;
    const acquire = () =>
      new Promise<void>((resolve) => {
        if (cancelled) {
          resolve();
          return;
        }
        release = resolve;
        setLocked(true);
      });
    if (navigator.locks)
      void navigator.locks.request(
        "gachachess-autochess-session",
        { ifAvailable: true },
        (lock) => {
          if (!lock) {
            if (!cancelled)
              setError(
                "Серия открыта в другой вкладке. Закройте её и откройте режим снова.",
              );
            return;
          }
          return acquire();
        },
      );
    else setLocked(true);
    return () => {
      cancelled = true;
      release?.();
    };
  }, []);
  useEffect(() => {
    if (!locked) return;
    let live = true;
    const owned = createBattleController({
      getRun: () => {
        const current = store.getSnapshot();
        if (!current) throw Error("Серия закрыта");
        return current;
      },
      save: (next) => {
        try {
          return store.save(next);
        } catch (cause) {
          if (live)
            setError(cause instanceof Error ? cause.message : String(cause));
          return false;
        }
      },
      onChange: () => {
        if (live) render();
      },
      onError: (message) => {
        if (live) setError(message);
      },
    });
    controller.current = owned;
    const pause = () => {
        if (document.hidden) owned.pause();
      },
      pagehide = () => owned.pause(),
      storage = (event: StorageEvent) => {
        if (event.key === AUTO_KEY) {
          owned.dispose();
          store.refresh();
          setError(
            "Серия обновлена в другой вкладке. Продолжите с сохранённой позиции.",
          );
        }
      };
    document.addEventListener("visibilitychange", pause);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("storage", storage);
    return () => {
      live = false;
      owned.pause();
      owned.dispose();
      controller.current = null;
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("storage", storage);
    };
  }, [store, locked]);
  useEffect(() => {
    if (run?.phase !== "result") return;
    let live = true;
    setAward(false);
    void wallet
      .update((state) => awardAutochess(state, run))
      .then((result) => {
        if (!live) return;
        if (result.ok) setAward(true);
        else setError(result.error.message);
      });
    return () => {
      live = false;
    };
  }, [run?.battle?.id, run?.phase, revision, wallet]);
  const save = (next: AutoRun | null) => {
    if (!locked) return false;
    try {
      store.save(next);
      setError("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    }
  };
  const change = (transform: (run: AutoRun) => AutoRun) => {
    const current = store.getSnapshot();
    if (current) save(transform(current));
  };
  return {
    run,
    error,
    locked,
    award,
    active: controller.current?.isActive() || false,
    preparing: controller.current?.isPreparing() || false,
    attempt: controller.current?.retryAttempt() || 1,
    change,
    retryReward: () => render(),
    create: () => save(createAutoRun(crypto.randomUUID())),
    discard: () => {
      controller.current?.pause();
      save(null);
    },
    pause: () => controller.current?.pause(),
    start: () => {
      const current = store.getSnapshot();
      if (!current) return;
      if (current.phase === "preparation" && !save(beginBattle(current)))
        return;
      setError("");
      void controller.current?.start();
    },
    next: () => change(nextRound),
  };
};
