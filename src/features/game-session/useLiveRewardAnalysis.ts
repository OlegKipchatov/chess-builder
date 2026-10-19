import { useCallback, useEffect, useRef } from "react";
import { useVaultStore } from "../../app/providers/VaultProvider.js";
import { analyzeReward } from "../../services/engines/economy-analysis.js";

// Only runs during the player's idle turn. Cancellation terminates its Worker
// synchronously before a move can start the opponent's search.
export const useLiveRewardAnalysis = (
  enabled: boolean,
  pgn: string,
  session?: string,
) => {
  const store = useVaultStore();
  const running = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = useCallback(() => {
    clearTimeout(timer.current);
    running.current?.abort();
    running.current = null;
  }, []);
  useEffect(() => {
    if (!enabled || !pgn) return;
    let disposed = false;
    const sameGame = () => {
      const current = store.getSnapshot().game;
      return (
        current.started &&
        !current.resigned &&
        current.pgn === pgn &&
        current.startedAt === session
      );
    };
    const pause = () => {
      stop();
    };
    const resume = () => {
      pause();
      if (disposed || document.hidden || !sameGame()) return;
      timer.current = setTimeout(() => {
        if (disposed || document.hidden || !sameGame()) return;
        const controller = new AbortController();
        running.current = controller;
        const entry = store.getSnapshot().game;
        void analyzeReward(entry, {
          signal: controller.signal,
          onCheckpoint: async (rewardCheckpoint) => {
            if (controller.signal.aborted) return;
            const result = await store.update((latest) =>
              controller.signal.aborted ||
              !latest.game.started ||
              latest.game.resigned ||
              latest.game.startedAt !== session ||
              latest.game.pgn !== pgn
                ? latest
                : { ...latest, game: { ...latest.game, rewardCheckpoint } },
            );
            if (!result.ok) throw result.error;
          },
        })
          .catch(() => {
            // No reward is issued during play. Final processing retries unfinished
            // work and owns the existing bounded failure/fallback policy.
          })
          .finally(() => {
            if (running.current === controller) running.current = null;
          });
      }, 200);
    };
    const unsubscribe = store.subscribe(() => {
      if (!sameGame()) pause();
    });
    const visibility = () => (document.hidden ? pause() : resume());
    document.addEventListener("visibilitychange", visibility);
    resume();
    return () => {
      disposed = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      pause();
    };
  }, [enabled, pgn, session, stop, store]);
  return stop;
};
