import { useNavigate,useSearch } from "@tanstack/react-router";
import type { Square } from "chess.js";
import { useState } from "react";
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
import { Page } from "../../shared/ui/Page.js";
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
    legal = selected
      ? playerMoves(run).filter((move) => move.from === selected)
      : [];
  const leave = () => {
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
  return (
    <Page
      id="hunt"
      title={mode === "timed" ? "Охота на время" : "Бесконечная охота"}
      actions={
        <button aria-label="Закрыть охоту" onClick={exit}>
          ×
        </button>
      }
    >
      <div className="hunt-layout">
        <div className="hunt-stats">
          <strong>{run.score} очков</strong>
          <span>
            {mode === "timed"
              ? `${Math.ceil(remainingTime(run, now) / 1000)} с`
              : `♥ ${run.lives}`}
          </span>
          <span>Рекорд: {record}</span>
        </div>
        <Chessboard
          pieces={hunt.state.shown}
          equipped={equipped}
          selected={selected}
          legal={legal.map((m) => m.to)}
          last={run.lastMove}
          disabled={run.phase !== "awaitingPlayer"}
          onSquare={(square) => {
            if (selected && legal.some((m) => m.to === square)) {
              hunt.move({ from: selected, to: square });
              setSelected(null);
            } else
              setSelected(run.pieces[square]?.color === "w" ? square : null);
          }}
        />
        {run.phase === "finished" &&
        run.finishReason !== "aborted" &&
        !hunt.state.queue.length && !hunt.state.presenting ? (
          <section className="panel">
            <h2>Охота завершена</h2>
            <p>
              {run.score} очков · +{calculateMiniGameCoins(run)} монет
            </p>
            {hunt.award === "failed" ? (
              <>
                <p role="alert">{hunt.error}</p>
                <button onClick={hunt.retry}>Сохранить награду</button>
              </>
            ) : (
              <>
                <button
                  className="primary"
                  disabled={hunt.award !== "saved"}
                  onClick={() => {
                    setSelected(null);
                    hunt.restart();
                  }}
                >
                  Ещё раз
                </button>
                <button disabled={hunt.award !== "saved"} onClick={leave}>
                  Готово
                </button>
              </>
            )}
          </section>
        ) : (
          <p className="page-supporting">
            Берите чёрные фигуры и защищайте свои.{" "}
            {mode === "timed"
              ? "У вас 60 секунд. Время идёт и в фоне."
              : "За каждые 20 очков материала вы получаете жизнь."}
          </p>
        )}
      </div>
    </Page>
  );
};
export default HuntPage;
