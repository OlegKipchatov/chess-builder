import { useCallback, useEffect, useRef, useState } from "react";
import { useVaultStore } from "../../app/providers/VaultProvider.js";
import { analyzeGame } from "../../services/analysis/analysis-service.js";
import {
  attachAnalysis,
  isCompatible,
} from "../../domain/analysis/analysis-storage.js";
import type {
  AnalysisProgress,
  GameAnalysis,
} from "../../domain/analysis/types.js";
import type { ArchiveEntry } from "../../domain/chess/types.js";
type Job =
  | { status: "idle" }
  | { status: "running"; progress: AnalysisProgress }
  | { status: "ready"; analysis: GameAnalysis }
  | { status: "failed"; message: string };
export const useGameAnalysis = (
  entry: ArchiveEntry,
  onAnalysisReady?: (analysis: GameAnalysis) => void,
) => {
  const store = useVaultStore(),
    [job, setJob] = useState<Job>(() =>
      isCompatible(entry.analysis, entry)
        ? { status: "ready", analysis: entry.analysis }
        : { status: "idle" },
    ),
    owned = useRef<AbortController | null>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      owned.current?.abort();
    },
    [entry.id, entry.pgn, entry.playerColor],
  );
  const start = useCallback(async () => {
    owned.current?.abort();
    const controller = new AbortController(),
      token = ++generation.current;
    owned.current = controller;
    setJob({
      status: "running",
      progress: { stage: "quick", done: 0, total: 0 },
    });
    try {
      const analysis = await analyzeGame(entry, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (token === generation.current && !controller.signal.aborted)
            setJob({ status: "running", progress });
        },
      });
      if (token !== generation.current || controller.signal.aborted) return;
      if (!entry.imported) {
        const saved = await store.update((state) =>
          token === generation.current && !controller.signal.aborted
            ? attachAnalysis(state, entry.id, analysis)
            : state,
        );
        if (!saved.ok)
          throw new Error("Не удалось сохранить разбор. Попробуйте ещё раз.");
      }
      if (token === generation.current && !controller.signal.aborted) {
        onAnalysisReady?.(analysis);
        setJob({ status: "ready", analysis });
      }
    } catch (error) {
      if (token === generation.current && !controller.signal.aborted)
        setJob({
          status: "failed",
          message:
            error instanceof Error &&
            error.message === "Не удалось сохранить разбор. Попробуйте ещё раз."
              ? error.message
              : "Не удалось завершить анализ. Попробуйте ещё раз.",
        });
    }
  }, [entry, store, onAnalysisReady]);
  const cancel = useCallback(() => {
    generation.current++;
    owned.current?.abort();
    setJob({ status: "idle" });
  }, []);
  return {
    job,
    start,
    cancel,
    analysis:
      job.status === "ready" &&
      job.analysis.gameId === entry.id &&
      job.analysis.playerColor === entry.playerColor &&
      job.analysis.sourcePgn === entry.pgn
        ? job.analysis
        : isCompatible(entry.analysis, entry)
          ? entry.analysis
          : undefined,
  };
};
