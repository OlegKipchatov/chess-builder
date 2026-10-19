import { useNotificationError } from "../../shared/hooks/useNotificationError.js";
import { motionDuration } from "../../shared/styles/motion.js";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useVault, useVaultStore } from "../../app/providers/VaultProvider.js";
import {
  playPveAction,
  resignPve,
  resumePveBattle,
  settlePve,
} from "../../domain/pve/pve-battle.js";
import type { PveAction, PveBattle } from "../../domain/pve/types.js";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion.js";
import type { ChessboardProps } from "../chessboard/Chessboard.js";
export const usePveBattle = (active: boolean) => {
  const profile = useVault((s) => s.pve),
    store = useVaultStore(),
    reduced = useReducedMotion(),
    [visual, setVisual] = useState<PveBattle | null>(profile.battle),
    [attack, setAttack] = useState<ChessboardProps["attack"]>(),
    [phase, setPhase] = useState<
      "idle" | "saving" | "thinking" | "animating" | "failed"
    >("idle"),
    [error, setError] = useNotificationError(),
    [retry, bump] = useState(0),
    busy = useRef(false),
    generation = useRef(0),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    mounted = useRef(false);
  useEffect(() => {
    const ownedTimers = timers.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      ownedTimers.forEach(clearTimeout);
      busy.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    if (!busy.current) setVisual(profile.battle);
  }, [profile.battle]);
  useEffect(() => {
    if (active)
      void store.update((s) => {
        const pve = resumePveBattle(s.pve);
        return pve === s.pve ? s : settlePve({ ...s, pve });
      });
  }, [active, store]);
  useEffect(() => {
    if (active) return;
    generation.current++;
    timers.current.forEach(clearTimeout);
    timers.current.length = 0;
    busy.current = false;
    setAttack(undefined);
    setVisual(store.getSnapshot().pve.battle);
    setPhase("idle");
  }, [active, store]);
  const perform = useCallback(
    async (action: PveAction) => {
      if (busy.current || !active) return;
      const before = store.getSnapshot().pve,
        battle = before.battle;
      if (!battle || battle.phase !== "playing") return;
      busy.current = true;
      setPhase("saving");
      setError("");
      const token = generation.current;
      const result = await store.transact((state) => {
        if (
          state.pve.revision !== before.revision ||
          state.pve.battle?.id !== battle.id
        )
          return { state, value: false };
        const next = playPveAction(state.pve, action);
        return {
          state:
            next === state.pve ? state : settlePve({ ...state, pve: next }),
          value: next !== state.pve,
        };
      });
      if (!mounted.current || generation.current !== token) return;
      if (!result.ok || !result.value) {
        busy.current = false;
        setPhase("failed");
        setError(
          !result.ok
            ? result.error.message
            : "Позиция изменилась. Повторите ход.",
        );
        setVisual(store.getSnapshot().pve.battle);
        return;
      }
      const next = result.state.pve.battle!,
        event = next.lastEvent;
      const finish = () => {
        if (!mounted.current || generation.current !== token) return;
        setVisual(next);
        setAttack(undefined);
        busy.current = false;
        setPhase("idle");
      };
      if (reduced || !event) {
        finish();
        return;
      }
      setPhase("animating");
      const schedule = (callback: () => void, delay: number) => {
        timers.current.push(
          setTimeout(() => {
            if (mounted.current && generation.current === token) callback();
          }, delay),
        );
      };
      if (!event.targetId) {
        setVisual(next);
        schedule(finish, motionDuration.board);
        return;
      }
      setVisual(battle);
      setAttack({ id: event.attackerId, to: event.to });
      schedule(() => {
        setVisual({
          ...battle,
          units: battle.units.map((unit) =>
            unit.id === event.targetId
              ? {
                  ...unit,
                  hp: next.units.find((p) => p.id === unit.id)?.hp ?? 0,
                }
              : unit,
          ),
        });
        setAttack({
          id: event.attackerId,
          to: event.to,
          targetId: event.targetId,
          damage: event.damage,
        });
      }, motionDuration.board);
      schedule(() => {
        setAttack(undefined);
        if (event.killed) setVisual(next);
      }, 2 * motionDuration.board);
      schedule(finish, (event.killed ? 2 : 3) * motionDuration.board);
    },
    [store, active, reduced, setError],
  );
  const workerBlocked = ["saving", "animating", "failed"].includes(phase);
  useEffect(() => {
    const battle = profile.battle;
    if (
      !active ||
      busy.current ||
      workerBlocked ||
      !battle ||
      battle.phase !== "playing" ||
      battle.turn !== "b"
    )
      return;
    const token = ++generation.current;
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../../workers/pve/worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch {
      setError(
        "Не удалось запустить расчёт соперника. Бой сохранён — повторите расчёт.",
      );
      setPhase("failed");
      return;
    }
    setPhase("thinking");
    const fail = (message: string) => {
      if (!mounted.current || generation.current !== token) return;
      worker.terminate();
      setError(message);
      setPhase("failed");
    };
    let stopped = false;
    const timeout = setTimeout(
      () => fail("Соперник не ответил. Бой сохранён — повторите расчёт."),
      10000,
    );
    worker.onmessage = ({
      data,
    }: MessageEvent<{
      id: number;
      move?: PveAction | null;
      error?: string;
    }>) => {
      if (stopped || data.id !== token || generation.current !== token) return;
      clearTimeout(timeout);
      worker.terminate();
      if (data.error || !data.move) {
        fail(data.error || "Не удалось получить ход");
        return;
      }
      void perform(data.move);
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      fail("Ошибка расчёта соперника");
    };
    worker.postMessage({ id: token, battle });
    return () => {
      stopped = true;
      worker.onmessage = null;
      worker.onerror = null;
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [active, profile.battle, workerBlocked, retry, perform, setError]);
  const resign = async () => {
    generation.current++;
    timers.current.forEach(clearTimeout);
    busy.current = false;
    const result = await store.update((s) =>
      settlePve({ ...s, pve: resignPve(s.pve) }),
    );
    if (!mounted.current) return;
    if (!result.ok) {
      setError(result.error.message);
      setPhase("failed");
    } else {
      setVisual(result.state.pve.battle);
      setAttack(undefined);
      setPhase("idle");
    }
  };
  return {
    profile,
    visual,
    attack,
    phase,
    error,
    move: perform,
    resign,
    retry: () => {
      setError("");
      setPhase("idle");
      bump((n) => n + 1);
    },
  };
};
