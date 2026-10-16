import { useBlocker,useNavigate } from "@tanstack/react-router";
import type { PieceSymbol,Square } from "chess.js";
import { useEffect,useMemo,useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault } from "../../app/providers/VaultProvider.js";
import { materialBalance } from "../../domain/chess/archive.js";
import { positionAt } from "../../domain/chess/session.js";
import { playStyleName } from "../../domain/cognitive/play-style-config.js";
import { Chessboard } from "../../features/chessboard/Chessboard.js";
import { chessPieces } from "../../features/chessboard/model.js";
import { MoveNavigation } from "../../features/game-review/MoveNavigation.js";
import { PgnActions } from "../../features/game-review/PgnActions.js";
import { useGameSession } from "../../features/game-session/useGameSession.js";
import { Page } from "../../shared/ui/Page.js";
import { Piece } from "../../shared/ui/Piece.js";
export const GamePage = () => {
  const session = useGameSession(),
    { show } = useOverlays(),
    navigate = useNavigate(),
    equipped = useVault((state) => state.equipped),
    played = useVault((state) => state.played);
  const [selected, setSelected] = useState<Square | null>(null);
  useBlocker({
    shouldBlockFn: () => session.active || !!session.view.result,
    enableBeforeUnload: false,
  });
  const final = session.view.result,
    live = final?.game || session.game,
    config = final?.config || session.saved;
  const board = useMemo(
    () => positionAt(live, session.view.cursor),
    [live, session.view.cursor],
  );
  const pieces = useMemo(() => chessPieces(board), [board]),
    last = board.history({ verbose: true }).at(-1);
  const legal = selected
    ? board.moves({ square: selected, verbose: true })
    : [];
  const canMove =
    session.active &&
    session.view.phase === "idle" &&
    session.view.cursor === null &&
    (config.mode === "local" || live.turn() === config.playerColor);
  useEffect(() => {
    setSelected(null);
  }, [session.saved.pgn]);
  useEffect(() => {
    if (!final) return;
    const finish = () => {
      session.closeResult();
      show(null);
    };
    const analysis = () => {
      finish();
      if (final.entry)
        void navigate({
          to: "/history/$id",
          params: { id: final.entry.id },
          search: { analyze: true },
        });
    };
    const lastStep = () =>
      show({
        title: final.cancelled ? "Партия отменена" : "Партия завершена",
        onClose: finish,
        body: (
          <div className="dialog-actions">
            {final.entry && (
              <button className="primary wide" onClick={analysis}>
                Разобрать партию
              </button>
            )}
            <button className="quiet wide" onClick={finish}>
              Готово
            </button>
          </div>
        ),
      });
    const activity = () => {
      if (final.activity)
        show({
          title:
            final.activity.streak > 1
              ? `${final.activity.streak} дней подряд`
              : "Сегодня с игрой",
          onClose: lastStep,
          body: (
            <>
              <div className="activity-day today closed">
                {Number(final.activity.date.slice(-2))}
              </div>
              <button className="primary wide" onClick={lastStep}>
                Продолжить
              </button>
            </>
          ),
        });
      else lastStep();
    };
    show({
      title: final.cancelled
        ? "Партия отменена"
        : final.entry?.result || "Партия завершена",
      onClose: final.cancelled ? finish : activity,
      body: (
        <>
          <p>{final.reason}</p>
          {final.entry && (
            <p className="reward-amount">
              +{final.entry.rewardBreakdown?.total || 0}{" "}
              <span className="coins">◈</span>
            </p>
          )}
          <button
            className="primary wide"
            onClick={final.cancelled ? finish : activity}
          >
            Продолжить
          </button>
        </>
      ),
    });
  }, [final]);
  const activate = (square: Square) => {
    if (!canMove) return;
    const target = legal.filter((move) => move.to === square);
    if (selected && target.length) {
      const from = selected;
      setSelected(null);
      if (target.some((move) => move.promotion))
        show({
          title: "Превращение пешки",
          dismissible: false,
          body: (
            <div className="promotion-options">
              {(["q", "r", "b", "n"] as PieceSymbol[]).map((type) => (
                <button
                  key={type}
                  aria-label={type}
                  onClick={() => {
                    show(null);
                    void session.move(from, square, type);
                  }}
                >
                  <Piece type={type} color={config.playerColor} />
                </button>
              ))}
            </div>
          ),
        });
      else void session.move(from, square);
      return;
    }
    setSelected(
      board.get(square)?.color ===
        (config.mode === "local" ? board.turn() : config.playerColor) &&
        selected !== square
        ? square
        : null,
    );
  };
  if (!session.saved.started && !final)
    return (
      <Page id="play" title="Игра">
        <div id="game-ready" className="game-ready">
          <div className="play-featured">
            <h2>Сыграем?</h2>
            <button
              id="start-game"
              className="primary"
              onClick={() => void session.start()}
            >
              Партия с ИИ
            </button>
          </div>
          <button
            className="calendar-home"
            onClick={() => void navigate({ to: "/calendar" })}
          >
            ▦ Календарь активности <span>›</span>
          </button>
          <div className="mini-game-entries">
            <button
              className="panel"
              onClick={() =>
                void navigate({ to: "/hunt", search: { mode: "endless" } })
              }
            >
              Бесконечная охота
            </button>
            <button
              className="panel"
              onClick={() =>
                void navigate({ to: "/hunt", search: { mode: "timed" } })
              }
            >
              Охота на время
            </button>
            <button
              className="panel"
              onClick={() => void navigate({ to: "/autochess" })}
            >
              Автошахматы
            </button>
          </div>
        </div>
        {played > 0 && (
          <p className="page-supporting">Сыграно партий: {played}</p>
        )}
      </Page>
    );
  return (
    <section id="play" className="tab active-match" data-page-kind="detail">
      <div className="page-content">
        <div className="game-grid" id="match-surface">
          <div className="board-area">
            <div className="match-summary">
              <button
                id="resign"
                className="icon-button"
                aria-label="Сдаться"
                disabled={!!final}
                onClick={() =>
                  show({
                    title: "Завершить партию?",
                    body: (
                      <>
                        <p>
                          Сдача будет засчитана как поражение. До первого вашего
                          хода партия отменяется.
                        </p>
                        <button
                          className="danger wide"
                          onClick={() => {
                            show(null);
                            void session.resign();
                          }}
                        >
                          Сдаться
                        </button>
                      </>
                    ),
                  })
                }
              >
                ×
              </button>
              <div className="match-versus">
                <span className="match-person">
                  <span
                    className={`avatar ${config.playerColor === "w" ? "light" : ""}`}
                  />
                  <strong>Вы</strong>
                </span>
                <span className="versus">VS</span>
                <span className="match-person">
                  <span
                    className={`avatar ${config.playerColor === "b" ? "light" : ""}`}
                  />
                  <strong>
                    {playStyleName(config.engineProfile?.profile)}
                  </strong>
                </span>
              </div>
              <strong>{materialBalance(board, config.playerColor)}</strong>
            </div>
            <p className="turn-status" aria-live="polite">
              {board.isCheck() ? "Шах · " : ""}Ход{" "}
              {board.turn() === "w" ? "белых" : "чёрных"}
            </p>
            <Chessboard
              pieces={pieces}
              equipped={config.equipped || equipped}
              orientation={config.playerColor}
              selected={selected}
              legal={legal.map((move) => move.to)}
              last={last}
              check={
                board.isCheck()
                  ? pieces.find(
                      (piece) =>
                        piece.type === "k" && piece.color === board.turn(),
                    )?.square
                  : null
              }
              disabled={!canMove}
              onSquare={activate}
            />
            <MoveNavigation
              cursor={session.view.cursor ?? live.history().length}
              total={live.history().length}
              onSeek={(ply) =>
                session.setCursor(ply === live.history().length ? null : ply)
              }
            />
            {session.view.cursor !== null && (
              <p className="history-notice">
                Вы смотрите прошлую позицию. Вернитесь к текущему ходу, чтобы
                продолжить.
              </p>
            )}
            {session.view.error && (
              <div role="alert">
                <p>{session.view.error}</p>
                <button onClick={session.retry}>Повторить</button>
                <button onClick={() => void session.abort()}>
                  Закрыть без награды
                </button>
              </div>
            )}
          </div>
          <aside className="match-status-panel">
            <PgnActions game={live} config={config} />
            <ol className="moves">
              {live.history().map((san, index) => (
                <li key={index}>
                  <button onClick={() => session.setCursor(index + 1)}>
                    {Math.floor(index / 2) + 1}
                    {index % 2 ? "…" : "."} {san}
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </section>
  );
};
export default GamePage;
