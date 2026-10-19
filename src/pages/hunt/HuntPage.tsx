import { GameHeader } from "../../shared/ui/GameHeader.js";
import { useBlocker, useNavigate, useSearch } from "@tanstack/react-router";
import type { Square } from "chess.js";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault } from "../../app/providers/VaultProvider.js";
import {
  calculateMiniGameCoins,
  playerMoves,
  remainingTime,
} from "../../domain/hunt/hunt.js";
import { Chessboard } from "../../features/chessboard/Chessboard.js";
import { useHunt } from "../../features/hunt/useHunt.js";
import { useClock } from "../../shared/hooks/useClock.js";
import { Page, Stat } from "../../shared/ui/Page.js";
export const HuntPage = () => {
  const search = useSearch({ strict: false }),
    mode = "mode" in search && search.mode === "timed" ? "timed" : "endless";
  return <HuntGame key={mode} mode={mode} />;
};
const HuntGame = ({ mode }: { mode: "timed" | "endless" }) => {
  const hunt = useHunt(mode),
    run = hunt.state.run,
    equipped = useVault((s) => s.equipped),
    record = useVault((s) => s.hunt.records[mode].bestScore),
    { show } = useOverlays(),
    navigate = useNavigate(),
    [selected, setSelected] = useState<Square | null>(null),
    now = useClock(200),
    shownResult = useRef<string | null>(null),
    previousBest = useRef(record),
    legal = selected
      ? playerMoves(run).filter((move) => move.from === selected)
      : [];
  const leaving = useRef(false);
  useBlocker({
    shouldBlockFn: () => !leaving.current && run.phase !== "finished",
    enableBeforeUnload: run.phase !== "finished",
  });
  const leave = () => {
    leaving.current = true;
    hunt.abort();
    show(null);
    void navigate({ to: "/play" });
  };
  const exit = () =>
    run.phase === "finished"
      ? leave()
      : show({
          title: "Выйти из охоты?",
          body: (
            <>
              <p>Незавершённая игра не приносит монеты и не меняет рекорд.</p>
              <button className="danger wide" onClick={leave}>
                Выйти
              </button>
            </>
          ),
        });
  const presentResult = useEffectEvent(() => {
    if (
      run.phase !== "finished" ||
      run.finishReason === "abandoned" ||
      hunt.state.presenting ||
      hunt.state.queue.length ||
      hunt.award !== "saved" ||
      shownResult.current === run.runId
    )
      return;
    shownResult.current = run.runId;
    const finished = () => {
      show(null);
      void navigate({ to: "/play" });
    };
    const rewards = () =>
      show({
        title: "Награда за охоту",
        onClose: finished,
        body: (
          <div id="hunt-reward">
            <Stat value={calculateMiniGameCoins(run)} label="Монеты" />
            <button
              id="hunt-again"
              className="primary wide"
              onClick={() => {
                show(null);
                previousBest.current = Math.max(record, run.score);
                setSelected(null);
                hunt.restart();
              }}
            >
              Ещё раз
            </button>
            <button className="quiet wide" onClick={finished}>
              К мини-играм
            </button>
          </div>
        ),
      });
    show({
      title:
        run.finishReason === "timer"
          ? "Время вышло"
          : run.finishReason === "lives"
            ? "Жизни закончились"
            : "На доске нет места",
      onClose: rewards,
      body: (
        <div id="hunt-result">
          <div className="hunt-result-stats">
            <Stat value={run.score} label="Очки" />
            <Stat
              value={Math.max(previousBest.current, run.score)}
              label={
                run.score > previousBest.current ? "Новый рекорд" : "Рекорд"
              }
            />
          </div>
          <button className="primary wide" onClick={rewards}>
            Далее
          </button>
        </div>
      ),
    });
  });
  useEffect(() => {
    presentResult();
  }, [run, hunt.award, hunt.state.presenting, hunt.state.queue.length]);
  return (
    <Page
      id="hunt"
      title={mode === "timed" ? "Охота на время" : "Бесконечная охота"}
      header={
        <GameHeader
          title={mode === "timed" ? "Охота на время" : "Бесконечная охота"}
          exitLabel="Закрыть охоту"
          onExit={exit}
        />
      }
    >
      <div className="hunt-layout hunt-surface">
        <div className="hunt-hud">
          <div>
            <span>{mode === "timed" ? "Время" : "Жизни"}</span>
            <strong>
              {mode === "timed"
                ? `${Math.ceil(remainingTime(run, now) / 1000)} с`
                : run.lives}
            </strong>
          </div>
          <div>
            <span>Очки</span>
            <strong>{run.score}</strong>
          </div>
        </div>
        {mode === "endless" && (
          <p className="hunt-recovery">
            До дополнительной жизни: {run.lifeRecoveryMaterial} / 20
          </p>
        )}
        <Chessboard
          feedback
          pieces={hunt.state.shown}
          equipped={equipped}
          selected={selected}
          legal={legal.map((m) => m.to)}
          last={run.lastMove}
          disabled={run.phase !== "awaitingPlayer"}
          moves={run.phase === "awaitingPlayer" ? playerMoves(run) : []}
          onMove={(from, to) => {
            hunt.move({ from, to });
            setSelected(null);
          }}
          onSquare={(square) => {
            if (selected && legal.some((m) => m.to === square)) {
              hunt.move({ from: selected, to: square });
              setSelected(null);
            } else
              setSelected(run.pieces[square]?.color === "w" ? square : null);
          }}
        />
        {run.phase === "finished" &&
        run.finishReason !== "abandoned" &&
        !hunt.state.queue.length &&
        !hunt.state.presenting ? (
          <section className="panel">
            {hunt.award === "failed" ? (
              <>
                <p role="alert">{hunt.error}</p>
                <button className="primary wide" onClick={hunt.retry}>
                  Сохранить награду
                </button>
              </>
            ) : (
              <p role="status">
                {hunt.award === "saved"
                  ? "Охота завершена"
                  : "Сохраняем награду…"}
              </p>
            )}
          </section>
        ) : mode === "endless" ? (
          <p className="page-supporting">
            Берите чёрные фигуры и защищайте свои. За каждые 20 очков материала
            вы получаете жизнь.
          </p>
        ) : null}
      </div>
    </Page>
  );
};
export default HuntPage;
