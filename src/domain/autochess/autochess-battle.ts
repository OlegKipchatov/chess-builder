import type { Chess } from "chess.js";
import { createAutoplayEngine } from "../../services/engines/autochess-engine.js";
import type { AutoplayEngine } from "../../services/engines/types.js";
import { asError } from "../../shared/lib/errors.js";
import {
AUTO,
battleGame,
battleResult,
completeBattle,
positionCompositionError,
} from "./autochess.js";
import type { AutoResult,AutoRun } from "./types.js";
export const createBattleController = ({
  getRun,
  save,
  onChange,
  onError,
  engineFactory = createAutoplayEngine,
  clock = () => performance.now(),
  schedule = setTimeout,
  cancel = clearTimeout,
}: {
  getRun: () => AutoRun;
  save: (run: AutoRun) => boolean;
  onChange: () => void | Promise<void>;
  onError: (message: string) => void;
  engineFactory?: () => AutoplayEngine;
  clock?: () => number;
  schedule?: typeof setTimeout;
  cancel?: typeof clearTimeout;
}) => {
  let position: Chess | null = null,
    engine: AutoplayEngine | null = null,
    generation = 0,
    active = false,
    base = 0,
    started = 0,
    next: ReturnType<typeof setTimeout> | undefined,
    preparing = false,
    attempt = 1,
    releasePace: (() => void) | null = null;
  const elapsed = () => base + (active ? Math.max(0, clock() - started) : 0);
  const halt = () => {
    active = false;
    preparing = false;
    generation++;
    cancel(next);
    next = undefined;
    releasePace?.();
    releasePace = null;
    engine?.terminate();
    engine = null;
    position = null;
  };
  const commit = (run: AutoRun) => {
    if (!save(run))
      throw Error("Не удалось сохранить бой. Освободите место и повторите.");
    return onChange();
  };
  const fail = (error: Error) => {
    const spent = active ? elapsed() : getRun().battle!.elapsed;
    halt();
    const run = getRun();
    if (run?.battle && run.phase !== "result")
      save({
        ...run,
        phase: "paused",
        battle: { ...run.battle!, elapsed: spent },
      });
    onChange();
    onError(
      /out of memory|memory access|allocation/i.test(error.message)
        ? "Не хватает памяти для движка после 3 попыток. Бой сохранён. Закройте другие вкладки и продолжите."
        : error.message,
    );
  };
  const finish = (result: AutoResult) => {
    const run = getRun(),
      spent = elapsed();
    halt();
    try {
      commit(
        completeBattle(
          { ...run, battle: { ...run.battle!, elapsed: spent } },
          result,
        ),
      );
    } catch (error) {
      onError(asError(error).message);
    }
  };
  const current = (token: number) => token === generation;
  const recover = (error: Error, token: number) => {
    engine?.terminate();
    engine = null;
    if (!current(token))
      throw Object.assign(Error("Бой приостановлен"), { name: "AbortError" });
    if (
      error.name === "AbortError" ||
      ("code" in error && error.code === "UNSUPPORTED_POSITION")
    )
      throw error;
    if (attempt >= 3)
      throw Error(
        `Не удалось запустить расчёт после 3 попыток. Бой сохранён. ${error.message}`,
      );
    attempt++;
    preparing = true;
    onChange();
  };
  const prepare = async (token: number) => {
    while (current(token) && !engine) {
      try {
        preparing = true;
        engine = engineFactory();
        onChange();
        await engine.ready;
        if (!current(token))
          throw Object.assign(Error("Бой приостановлен"), {
            name: "AbortError",
          });
        preparing = false;
        onChange();
      } catch (error) {
        if (!current(token)) throw error;
        recover(asError(error), token);
      }
    }
  };
  const search = async (run: AutoRun, token: number): Promise<string> => {
    while (current(token)) {
      await prepare(token);
      if (!current(token))
        throw Object.assign(Error("Бой приостановлен"), { name: "AbortError" });
      try {
        return await engine!.search(run.battle!.initialFen, [
          ...run.battle!.moves,
        ]);
      } catch (error) {
        if (!current(token)) throw error;
        recover(asError(error), token);
      }
    }
    throw Object.assign(Error("Бой приостановлен"), { name: "AbortError" });
  };
  const step = async (
    token: number,
    gate: Promise<unknown> = Promise.resolve(),
  ): Promise<void> => {
    if (!active || token !== generation) return;
    const run = getRun();
    try {
      const [move] = await Promise.all([search(run, token), gate]);
      if (!active || token !== generation) return;
      attempt = 1;
      const spent = elapsed();
      const game = position!;
      game.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        ...(move[4] ? { promotion: move[4] } : {}),
      });
      const updated = {
        ...run,
        battle: {
          ...run.battle!,
          moves: [...run.battle!.moves, move],
          elapsed: spent,
        },
      };
      const result = battleResult(game, updated.battle.moves.length, spent);
      if (result) {
        halt();
        commit(completeBattle(updated, result));
        return;
      }
      const presentation = commit(updated);
      const pace = new Promise<void>((resolve) => {
        releasePace = resolve;
        next = schedule(() => {
          next = undefined;
          releasePace = null;
          resolve();
        }, AUTO.pace);
      });
      void step(token, Promise.all([pace, presentation]));
    } catch (error) {
      if (token === generation) fail(asError(error));
    }
  };
  return {
    elapsed,
    isActive: () => active,
    start: async () => {
      if (engine || active || preparing) return;
      const run = getRun();
      if (!run?.battle || run.phase === "result") return;
      const token = ++generation;
      attempt = 1;
      try {
        const issue = positionCompositionError(run.battle.initialFen);
        if (issue) throw Error(issue);
        position = battleGame(run);
        base = run.battle!.elapsed;
        const initialResult = battleResult(
          position,
          run.battle.moves.length,
          base,
        );
        if (initialResult) {
          finish(initialResult);
          return;
        }
        await prepare(token);
        if (token !== generation) return;
        started = clock();
        active = true;
        const result = battleResult(position, run.battle.moves.length, base);
        if (result) {
          finish(result);
          return;
        }
        onChange();
        void step(token);
      } catch (error) {
        if (token === generation) fail(asError(error));
      }
    },
    pause: () => {
      if (!engine && !active && !preparing) return true;
      const run = getRun(),
        spent = active ? elapsed() : run.battle!.elapsed;
      halt();
      try {
        commit({
          ...run,
          phase: "paused",
          battle: { ...run.battle!, elapsed: spent },
        });
        return true;
      } catch (error) {
        onError(asError(error).message);
        return false;
      }
    },
    dispose: () => halt(),
    isPreparing: () => preparing,
    retryAttempt: () => attempt,
  };
};
