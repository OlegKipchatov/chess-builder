import { Chess, type Square } from "chess.js";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault, useVaultStore } from "../../app/providers/VaultProvider.js";
import {
  activityDate,
  currentStreak,
} from "../../domain/activity/activity-model.js";
import { recordCalendarGame } from "../../domain/activity/calendar-rewards.js";
import {
  abortFailedMatch,
  completedMatch,
  matchEndReason,
} from "../../domain/chess/archive.js";
import { createStartedGame } from "../../domain/chess/session.js";
import type { ArchiveEntry, SavedGame } from "../../domain/chess/types.js";
import { randomPlayStyle } from "../../domain/cognitive/play-style-config.js";
import { validEngineProfile } from "../../domain/cognitive/strength.js";
import { createBotClient } from "../../services/engines/bot-client.js";
import type { EngineClient } from "../../shared/types/engine.js";
import { createRecordId, newGame } from "../../services/persistence/state.js";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion.js";
import { motionDuration } from "../../shared/styles/motion.js";
import { useLiveRewardAnalysis } from "./useLiveRewardAnalysis.js";
type Phase = "idle" | "saving" | "thinking" | "animating" | "failed";
interface Result {
  game: Chess;
  config: SavedGame;
  entry: ArchiveEntry | null;
  reason: string;
  cancelled: boolean;
  activity: { date: string; streak: number } | null;
}
interface View {
  display: { game: Chess; config: SavedGame } | null;
  phase: Phase;
  error: string | null;
  cursor: number | null;
  result: Result | null;
}
type Event =
  | { type: "freeze"; game: Chess; config: SavedGame }
  | { type: "phase"; phase: Phase }
  | { type: "error"; message: string }
  | { type: "cursor"; cursor: number | null }
  | { type: "result"; result: Result }
  | { type: "reset" };
const reducer = (state: View, event: Event): View => {
  switch (event.type) {
    case "freeze":
      return {
        ...state,
        phase: "saving",
        display: { game: event.game, config: event.config },
      };
    case "phase":
      return { ...state, phase: event.phase, error: null };
    case "error":
      return { ...state, phase: "failed", error: event.message };
    case "cursor":
      return { ...state, cursor: event.cursor };
    case "result":
      return {
        display: null,
        phase: "idle",
        error: null,
        cursor: null,
        result: event.result,
      };
    case "reset":
      return {
        display: null,
        phase: "idle",
        error: null,
        cursor: null,
        result: null,
      };
  }
};
export const useGameSession = () => {
  const saved = useVault((state) => state.game),
    store = useVaultStore(),
    { toast } = useOverlays(),
    reduced = useReducedMotion();
  const [view, dispatchState] = useReducer(reducer, {
    display: null,
    phase: saved.engineFailure ? "failed" : "idle",
    error: saved.engineFailure?.message || null,
    cursor: null,
    result: null,
  });
  const dispatch = useCallback(
    (event: Event) => {
      if (event.type === "error") toast(event.message, { type: "error" });
      dispatchState(event);
    },
    [toast],
  );
  const initialFailure = useRef(saved.engineFailure?.message);
  useEffect(() => {
    if (initialFailure.current) {
      toast(initialFailure.current, { type: "error" });
      initialFailure.current = undefined;
    }
  }, [toast]);
  const [retry, restart] = useReducer((n: number) => n + 1, 0);
  const engine = useRef<EngineClient | null>(null),
    request = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    mounted = useRef(false),
    inFlight = useRef(false),
    settling = useRef(false);
  const restored = useMemo(() => {
    const board = new Chess();
    try {
      if (saved.pgn) board.loadPgn(saved.pgn);
    } catch {
      return null;
    }
    return board;
  }, [saved.pgn]);
  const game = useMemo(() => restored || new Chess(), [restored]);
  useEffect(() => {
    if (restored) return;
    toast(
      "Не удалось восстановить позицию. Прогресс сохранён; начните новую партию.",
      { type: "error" },
    );
    void store.update((state) =>
      state.game.pgn === saved.pgn ? { ...state, game: newGame() } : state,
    );
  }, [restored, saved.pgn, store, toast]);
  const active =
    !!restored && saved.started && !saved.resigned && !game.isGameOver();
  const stopRewardAnalysis = useLiveRewardAnalysis(
    active &&
      saved.mode === "bot" &&
      !saved.settled &&
      !saved.engineFailure &&
      game.turn() === saved.playerColor &&
      view.phase === "idle" &&
      view.cursor === null,
    saved.pgn,
    saved.startedAt,
  );
  const settle = useCallback(async () => {
    if (settling.current) return;
    stopRewardAnalysis();
    settling.current = true;
    const current = store.getSnapshot(),
      board = new Chess();
    if (current.game.pgn) board.loadPgn(current.game.pgn);
    const config = structuredClone(current.game),
      id = createRecordId(),
      finishedAt = new Date().toISOString();
    dispatch({ type: "freeze", game: board, config });
    let result: Result | null = null;
    const transaction = await store.update((latest) => {
      if (
        latest.game.pgn !== config.pgn ||
        latest.game.startedAt !== config.startedAt
      )
        return latest;
      const completed = completedMatch(latest, board, { id, finishedAt });
      if (!completed) return latest;
      let next = completed.state;
      const cancelled =
        "cancelled" in completed && completed.cancelled === true;
      const date = activityDate(finishedAt, latest.activity.timeZone),
        first = !latest.activity.days.includes(date);
      if (!cancelled) {
        const own = board
          .history({ verbose: true })
          .filter((move) => move.color === config.playerColor);
        next = recordCalendarGame(next, {
          mode: "ai",
          won: completed.entry?.result === "Победа",
          moves: own.length,
          captures: own.filter((move) => move.captured).length,
          resigned: config.resigned,
          finishedAt,
        });
      }
      result = {
        game: board,
        config,
        entry: completed.entry,
        reason: matchEndReason(board, config.resigned),
        cancelled,
        activity:
          !cancelled && first
            ? { date, streak: currentStreak(next.activity, date) }
            : null,
      };
      return next;
    });
    settling.current = false;
    if (!mounted.current) return;
    if (!transaction.ok) {
      dispatch({ type: "error", message: transaction.error.message });
      return;
    }
    if (result) dispatch({ type: "result", result });
    else dispatch({ type: "reset" });
  }, [store, stopRewardAnalysis, dispatch]);
  const present = useCallback(() => {
    clearTimeout(timer.current);
    dispatch({ type: "phase", phase: "animating" });
    timer.current = setTimeout(
      () => {
        if (!mounted.current) return;
        dispatch({ type: "phase", phase: "idle" });
        const current = store.getSnapshot();
        const board = new Chess();
        if (current.game.pgn) board.loadPgn(current.game.pgn);
        if (
          current.game.started &&
          (current.game.resigned || board.isGameOver())
        )
          void settle();
      },
      reduced ? 0 : motionDuration.board,
    );
  }, [store, reduced, settle, dispatch]);
  const invalidateRequest = useCallback(() => {
    request.current++;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidateRequest();
      engine.current?.terminate();
      clearTimeout(timer.current);
    };
  }, [invalidateRequest]);
  useEffect(() => {
    if (
      !saved.started ||
      saved.mode !== "bot" ||
      !validEngineProfile(saved.engineProfile)
    )
      return;
    const client = createBotClient(saved.engineProfile);
    engine.current = client;
    return () => {
      invalidateRequest();
      client.terminate();
      if (engine.current === client) engine.current = null;
    };
  }, [
    saved.startedAt,
    saved.started,
    saved.engineProfile,
    saved.mode,
    retry,
    invalidateRequest,
  ]);
  useEffect(() => {
    if (
      restored &&
      saved.started &&
      (saved.resigned || game.isGameOver()) &&
      view.phase !== "animating" &&
      view.phase !== "saving" &&
      view.phase !== "failed"
    )
      void settle();
  }, [
    restored,
    saved.started,
    saved.resigned,
    saved.pgn,
    view.phase,
    game,
    settle,
  ]);
  const searchBlocked = ["animating", "saving", "failed"].includes(view.phase);
  useEffect(() => {
    if (
      !active ||
      saved.mode !== "bot" ||
      game.turn() === saved.playerColor ||
      searchBlocked ||
      !engine.current
    )
      return;
    const client = engine.current,
      id = ++request.current,
      fen = game.fen(),
      session = saved.startedAt;
    dispatch({ type: "phase", phase: "thinking" });
    client.onmessage = async ({ data }) => {
      if (
        !mounted.current ||
        data.id !== id ||
        request.current !== id ||
        !data.move
      )
        return;
      const move = data.move;
      const transaction = await store.update((latest) => {
        if (
          latest.game.startedAt !== session ||
          latest.game.pgn !== saved.pgn ||
          !latest.game.started
        )
          return latest;
        const board = new Chess();
        if (latest.game.pgn) board.loadPgn(latest.game.pgn);
        if (board.fen() !== fen) return latest;
        board.move(move);
        return {
          ...latest,
          game: { ...latest.game, pgn: board.pgn(), engineFailure: null },
        };
      });
      if (!mounted.current || id !== request.current) return;
      if (!transaction.ok)
        dispatch({ type: "error", message: transaction.error.message });
      else present();
    };
    client.onerror = (error) => {
      if (!mounted.current || id !== request.current) return;
      dispatch({ type: "error", message: error.message });
      void store.update((latest) =>
        latest.game.startedAt === session
          ? {
              ...latest,
              game: {
                ...latest.game,
                engineFailure: { fen, message: error.message },
              },
            }
          : latest,
      );
    };
    client.postMessage({
      id,
      fen,
      pgn: saved.pgn,
      engineProfile: saved.engineProfile as Parameters<
        typeof createBotClient
      >[0],
    });
    return () => {
      client.onmessage = null;
      client.onerror = null;
    };
    // A search is owned by the persisted position, not by the thinking view transition.
  }, [
    dispatch,
    saved.pgn,
    saved.startedAt,
    active,
    retry,
    searchBlocked,
    game,
    present,
    saved.engineProfile,
    saved.mode,
    saved.playerColor,
    store,
  ]);
  const start = async () => {
    if (inFlight.current || active) return;
    inFlight.current = true;
    const result = await store.update((latest) =>
      latest.game.started
        ? latest
        : {
            ...latest,
            game: createStartedGame(latest, Math.random, {
              profile: randomPlayStyle(),
            }),
          },
    );
    inFlight.current = false;
    if (!result.ok) toast(result.error.message, { type: "error" });
    else dispatch({ type: "reset" });
  };
  const move = async (from: Square, to: Square, promotion?: string) => {
    if (
      inFlight.current ||
      !active ||
      view.phase !== "idle" ||
      view.cursor !== null ||
      (saved.mode === "bot" && game.turn() !== saved.playerColor)
    )
      return false;
    inFlight.current = true;
    dispatch({ type: "phase", phase: "saving" });
    stopRewardAnalysis();
    const result = await store.update((latest) => {
      if (latest.game.pgn !== saved.pgn) return latest;
      const board = new Chess();
      if (latest.game.pgn) board.loadPgn(latest.game.pgn);
      board.move({ from, to, promotion });
      return { ...latest, game: { ...latest.game, pgn: board.pgn() } };
    });
    inFlight.current = false;
    if (!mounted.current) return false;
    if (!result.ok) dispatch({ type: "error", message: result.error.message });
    else present();
    return result.ok;
  };
  const resign = async () => {
    stopRewardAnalysis();
    request.current++;
    engine.current?.terminate();
    clearTimeout(timer.current);
    const result = await store.update((latest) => ({
      ...latest,
      game: { ...latest.game, resigned: true },
    }));
    if (result.ok) await settle();
    else dispatch({ type: "error", message: result.error.message });
  };
  const abort = async () => {
    stopRewardAnalysis();
    request.current++;
    engine.current?.terminate();
    const result = await store.update(
      (latest) =>
        abortFailedMatch(latest, game, {
          id: createRecordId(),
          finishedAt: new Date().toISOString(),
        }) || latest,
    );
    if (result.ok) dispatch({ type: "reset" });
    else toast(result.error.message, { type: "error" });
  };
  return {
    saved,
    game,
    active,
    view,
    start,
    move,
    resign,
    abort,
    retry: () => {
      dispatch({ type: "phase", phase: "idle" });
      restart();
    },
    setCursor: (cursor: number | null) => dispatch({ type: "cursor", cursor }),
    closeResult: () => dispatch({ type: "reset" }),
  };
};
