import { useEffect, useReducer, useState } from "react";
import { useVaultStore } from "../../app/providers/VaultProvider.js";
import {
  awardHunt,
  createHunt,
  finishHunt,
  releaseHuntInput,
  resolvePlayerMove,
  skipExpiredSpawn,
  startHunt,
  tickHunt,
} from "../../domain/hunt/hunt.js";
import type {
  HuntEvent,
  HuntMode,
  HuntMove,
  HuntState,
} from "../../domain/hunt/types.js";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion.js";
import type { BoardPiece } from "../chessboard/model.js";
interface State {
  run: HuntState;
  shown: BoardPiece[];
  queue: HuntEvent[];
  step: number;
  presenting: boolean;
}
type Event =
  | { type: "move"; move: HuntMove; now: number }
  | { type: "tick"; now: number }
  | { type: "frame"; now: number }
  | { type: "restart"; mode: HuntMode; id: string; now: number }
  | { type: "abort"; now: number };
const initial = (mode: HuntMode, id: string, now: number): State => {
  const run = startHunt(createHunt({ mode, runId: id, runSeed: id }), now);
  return {
    run,
    shown: Object.entries(run.pieces).map(([square, piece]) => ({
      ...piece,
      square,
      id: run.runId + square,
    })),
    queue: [],
    step: 0,
    presenting: false,
  };
};
const frame = (state: State, now: number): State => {
  const event = state.queue[0];
  if (!event)
    return {
      ...state,
      presenting: false,
      run: releaseHuntInput(state.run, now),
    };
  const run = skipExpiredSpawn(state.run, event, now);
  const board =
    event.type === "opponentSpawned" && run.phase === "finished"
      ? run.pieces
      : event.pieces;
  const shown = Object.entries(board).map(([square, piece]) => {
    const previous =
      event.to === square && event.from
        ? state.shown.find((p) => p.square === event.from)
        : state.shown.find(
            (p) =>
              p.square === square &&
              p.color === piece.color &&
              p.type === piece.type,
          );
    return {
      ...piece,
      square,
      id:
        previous?.id ||
        `${run.runId}:${run.playerMoveCount}:${state.step}:${square}`,
    };
  });
  return {
    run,
    shown,
    queue: state.queue.slice(1),
    step: state.step + 1,
    presenting: true,
  };
};
const reducer = (state: State, event: Event): State => {
  switch (event.type) {
    case "restart":
      return initial(event.mode, event.id, event.now);
    case "abort":
      return {
        ...state,
        run: finishHunt(state.run, "abandoned", event.now),
        queue: [],
        presenting: false,
      };
    case "tick":
      return { ...state, run: tickHunt(state.run, event.now) };
    case "frame":
      return frame(state, event.now);
    case "move": {
      if (state.run.phase !== "awaitingPlayer") return state;
      const resolved = resolvePlayerMove(state.run, event.move, {
        now: event.now,
      });
      if (resolved.state === state.run) return state;
      return frame(
        { ...state, run: resolved.state, queue: resolved.events, step: 0 },
        event.now,
      );
    }
  }
};
export const useHunt = (mode: HuntMode) => {
  const [state, dispatch] = useReducer(reducer, mode, (value) =>
      initial(value, crypto.randomUUID(), Date.now()),
    ),
    [award, setAward] = useState<"pending" | "saved" | "failed">("pending"),
    [error, setError] = useState(""),
    [retry, bump] = useReducer((n: number) => n + 1, 0),
    store = useVaultStore(),
    reduced = useReducedMotion();
  useEffect(() => {
    const timer = setInterval(
      () => dispatch({ type: "tick", now: Date.now() }),
      200,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!state.presenting) return;
    const timer = setTimeout(
      () => dispatch({ type: "frame", now: Date.now() }),
      reduced ? 0 : 420,
    );
    return () => clearTimeout(timer);
  }, [state.step, state.run.phase, state.queue, state.presenting, reduced]);
  useEffect(() => {
    if (
      state.run.phase !== "finished" ||
      state.run.finishReason === "abandoned" ||
      state.queue.length ||
      state.presenting
    )
      return;
    let live = true;
    setAward("pending");
    void store
      .update((wallet) => awardHunt(wallet, state.run))
      .then((result) => {
        if (!live) return;
        setAward(result.ok ? "saved" : "failed");
        if (!result.ok) setError(result.error.message);
      });
    return () => {
      live = false;
    };
  }, [state.run, state.queue.length, state.presenting, retry, store]);
  return {
    state,
    award,
    error,
    retry: () => bump(),
    move: (move: HuntMove) => dispatch({ type: "move", move, now: Date.now() }),
    restart: () => {
      setAward("pending");
      dispatch({
        type: "restart",
        mode,
        id: crypto.randomUUID(),
        now: Date.now(),
      });
    },
    abort: () => dispatch({ type: "abort", now: Date.now() }),
  };
};
