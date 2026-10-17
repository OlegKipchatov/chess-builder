import { ControlIcon } from "../../shared/ui/ControlIcon.js";
import { MoveList } from "../../features/game-review/MoveList.js";
import { useHistoryReturn } from "../../features/game-review/HistoryReturnProvider.js";
import { ActivityCelebration } from "../../features/game-session/ActivityCelebration.js";
import { eligibleEntry } from "../../domain/analysis/analysis-storage.js";
import { PIECE_NAMES } from "../../domain/catalog/catalog.js";
import { useShellPresentation } from "../../app/providers/ShellPresentation.js";
import { MatchReward } from "../../features/game-session/MatchReward.js";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import type { PieceSymbol, Square } from "chess.js";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Page, Stat } from "../../shared/ui/Page.js";
import { Piece } from "../../shared/ui/Piece.js";
export const GamePage = () => {
  const historyOrigin = useHistoryReturn();
  const session = useGameSession(),
    { show } = useOverlays(),
    navigate = useNavigate(),
    equipped = useVault((state) => state.equipped),
    archive = useVault((state) => state.archive);
  const countedGames = archive.filter(
    (entry) => entry.mode === "bot" && entry.counted !== false,
  );
  const [selected, setSelected] = useState<Square | null>(null),
    allowNavigation = useRef(false);
  useBlocker({
    shouldBlockFn: () =>
      !allowNavigation.current && (session.active || !!session.view.result),
    enableBeforeUnload: false,
  });
  const final = session.view.result,
    live = final?.game || session.view.display?.game || session.game,
    config = final?.config || session.view.display?.config || session.saved;
  const shell = useShellPresentation();
  useLayoutEffect(() => {
    shell(session.saved.started || !!final || !!session.view.display);
    return () => shell(false);
  }, [shell, session.saved.started, final, session.view.display]);
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
  const presentResult = useEffectEvent(() => {
    if (!final) return;
    const finish = () => {
      session.closeResult();
      show(null);
    };
    const analysis = () => {
      historyOrigin.fromList = false;
      historyOrigin.returnTo = "/play";
      allowNavigation.current = true;
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
        closeLabel: "Готово",
        body: (
          <div className="dialog-actions">
            {eligibleEntry(final.entry) && (
              <button className="primary wide" onClick={analysis}>
                Разобрать партию
              </button>
            )}
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
          closeLabel: "Продолжить",
          closeVariant: "primary",
          body: (
            <>
              <ActivityCelebration event={final.activity} />
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
      closeLabel: "Продолжить",
      closeVariant: "primary",
      body: (
        <>
          <p className="match-end-reason">{final.reason}</p>
          {final.entry && <MatchReward id={final.entry.id} />}
        </>
      ),
    });
  });
  useEffect(() => {
    presentResult();
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
                  aria-label={PIECE_NAMES[type]}
                  onClick={() => {
                    show(null);
                    void session.move(from, square, type);
                  }}
                >
                  <Piece type={type} color={board.turn()} />
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
  if (!session.saved.started && !final && !session.view.display)
    return (
      <Page id="play" title="Игры">
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
            id="calendar-entry"
            className="calendar-home"
            onClick={() => void navigate({ to: "/calendar" })}
          >
            <span className="calendar-home-icon" aria-hidden="true">
              ▦
            </span>
            <span>Календарь активности</span>
            <span aria-hidden="true">›</span>
          </button>
          <section id="hunt-entry" className="hunt-entry">
            <h2>Охота</h2>
            <div className="hunt-modes">
              <button
                className="quiet"
                data-hunt-mode="timed"
                onClick={() =>
                  void navigate({ to: "/hunt", search: { mode: "timed" } })
                }
              >
                На время
              </button>
              <button
                className="quiet"
                data-hunt-mode="endless"
                onClick={() =>
                  void navigate({ to: "/hunt", search: { mode: "endless" } })
                }
              >
                На жизни
              </button>
            </div>
          </section>
          <section id="autochess-entry" className="autochess-entry">
            <button
              id="autochess-open"
              className="mode-link"
              onClick={() => void navigate({ to: "/autochess" })}
            >
              Автошахматы<span aria-hidden="true">↗</span>
            </button>
          </section>
        </div>
        {countedGames.length > 0 && (
          <div id="play-stats" className="play-stats">
            <Stat value={countedGames.length} label="Сыграно партий" />
            <Stat
              value={
                countedGames.filter((entry) => entry.result === "Победа").length
              }
              label="Побед"
            />
          </div>
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
                <ControlIcon name="close" />
              </button>
              <div className="match-versus">
                <span className="match-person">
                  <span
                    className={`avatar ${config.playerColor === "w" ? "light" : ""}`}
                  >
                    <Piece type="k" color={config.playerColor} />
                  </span>
                  <strong>Вы</strong>
                </span>
                <span className="versus">VS</span>
                <span className="match-person">
                  <span
                    className={`avatar ${config.playerColor === "b" ? "light" : ""}`}
                  >
                    <Piece
                      type="k"
                      color={config.playerColor === "w" ? "b" : "w"}
                    />
                  </span>
                  <strong>
                    {config.mode === "bot"
                      ? `ИИ · ${playStyleName(config.engineProfile?.profile)}`
                      : "Игрок 2"}
                  </strong>
                </span>
              </div>
              <strong
                id="match-points"
                data-balance={
                  materialBalance(board, config.playerColor) > 0
                    ? "positive"
                    : materialBalance(board, config.playerColor) < 0
                      ? "negative"
                      : "zero"
                }
              >
                {materialBalance(board, config.playerColor) > 0 ? "+" : ""}
                {materialBalance(board, config.playerColor)} очков
              </strong>
            </div>
            <p id="status" className="turn-status" aria-live="polite">
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
              feedback={session.view.cursor === null}
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
          <aside className="match-secondary">
            <MoveList
              moves={live.history()}
              cursor={session.view.cursor ?? live.history().length}
              onSeek={session.setCursor}
            />
            <div className="match-actions">
              <PgnActions game={live} config={config} />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};
export default GamePage;
