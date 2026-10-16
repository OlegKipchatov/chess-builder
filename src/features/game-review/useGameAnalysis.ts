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
export const useGameAnalysis = (entry: ArchiveEntry) => {
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
    [entry.id],
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
      const saved = await store.update((state) =>
        token === generation.current && !controller.signal.aborted
          ? attachAnalysis(state, entry.id, analysis)
          : state,
      );
      if (!saved.ok) throw saved.error;
      if (token === generation.current && !controller.signal.aborted)
        setJob({ status: "ready", analysis });
    } catch (error) {
      if (token === generation.current && !controller.signal.aborted)
        setJob({
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
        });
    }
  }, [entry, store]);
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
      job.analysis.sourcePgn === entry.pgn
        ? job.analysis
        : isCompatible(entry.analysis, entry)
          ? entry.analysis
          : undefined,
  };
};
