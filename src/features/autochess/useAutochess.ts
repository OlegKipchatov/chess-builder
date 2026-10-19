import { useNotificationError } from "../../shared/hooks/useNotificationError.js";
import { motionDuration } from "../../shared/styles/motion.js";
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion.js";
import { useVaultStore } from "../../app/providers/VaultProvider.js";
import { createBattleController } from "../../services/engines/autochess-battle.js";
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
    [error, setError] = useNotificationError(),
    [locked, setLocked] = useState(false),
    [award, setAward] = useState(false),
    [presenting, setPresenting] = useState(false),
    reduced = useReducedMotion(),
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
        "gachachess-autochess-v1",
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
  }, [setError]);
  useEffect(() => {
    if (!locked) return;
    let live = true;
    let lastPosition = store.getSnapshot()?.battle?.moves.length || 0;
    const presentations = new Map<ReturnType<typeof setTimeout>, () => void>();
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
        if (!live) return;
        render();
        const length = store.getSnapshot()?.battle?.moves.length || 0;
        if (length === lastPosition) return;
        lastPosition = length;
        if (reduced) return;
        setPresenting(true);
        return new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            presentations.delete(timer);
            if (live) setPresenting(false);
            resolve();
          }, motionDuration.autoBoard);
          presentations.set(timer, resolve);
        });
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
      for (const [timer, resolve] of presentations) {
        clearTimeout(timer);
        resolve();
      }
      presentations.clear();
      owned.pause();
      owned.dispose();
      controller.current = null;
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("storage", storage);
    };
  }, [store, locked, reduced, setError]);
  useEffect(() => {
    if (run?.phase !== "result" || presenting) return;
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
  }, [run, presenting, revision, wallet, setError]);
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
    return current ? save(transform(current)) : false;
  };
  return {
    run,
    error,
    locked,
    award,
    presenting,
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
