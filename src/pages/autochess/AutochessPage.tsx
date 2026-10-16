import { motionDuration } from "../../shared/styles/motion.js";
import { useBoardFit } from "../../features/autochess/useBoardFit.js";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault } from "../../app/providers/VaultProvider.js";
import { autoSeriesCoins } from "../../domain/autochess/autochess-rewards.js";
import {
  armyCapacity,
  compositionError,
  positionCompositionError,
  battleGame,
  benchPiece,
  buyPiece,
  buyRandomPiece,
  levelPrice,
  placementError,
  placementSquares,
  placePiece,
  PRICES,
  purchaseError,
  purchasePrice,
  reservePieces,
  salePrice,
  sellPiece,
  seriesFinished,
  seriesGoal,
  setupError,
  shopOdds,
  upgradeError,
  upgradeShop,
} from "../../domain/autochess/autochess.js";
import { PIECE_NAMES } from "../../domain/catalog/catalog.js";
import { useAutochess } from "../../features/autochess/useAutochess.js";
import { Chessboard } from "../../features/chessboard/Chessboard.js";
import {
  chessPieces,
  type BoardPiece,
} from "../../features/chessboard/model.js";
import { Page, Stat } from "../../shared/ui/Page.js";
import { Piece } from "../../shared/ui/Piece.js";
export const AutochessPage = () => {
  const auto = useAutochess(),
    run = auto.run,
    equipped = useVault((s) => s.equipped),
    awards = useVault((s) => s.autochessAwards),
    { show, toast } = useOverlays(),
    navigate = useNavigate(),
    [selected, setSelected] = useState<string | null>(null),
    surface = useRef<HTMLDivElement>(null),
    created = useRef(false),
    finishedShown = useRef<string | null>(null),
    lastTap = useRef({ id: "", at: 0 }),
    lastPurchase = useRef(-Infinity),
    drag = useRef<{ id: string; x: number; y: number; pointer: number } | null>(
      null,
    ),
    suppressClick = useRef(false),
    shownOverflow = useRef<string | null>(null);
  const boardWidth = useBoardFit(surface, !!run);
  useEffect(() => {
    if (auto.locked && !run && !created.current) {
      created.current = true;
      auto.create();
    }
  });
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const game = useMemo(() => (run?.battle ? battleGame(run) : null), [run]),
    pieces: BoardPiece[] = game
      ? chessPieces(game)
      : run?.army
          .filter((p) => p.square)
          .map((p) => ({ ...p, square: p.square!, color: run.color })) || [];
  const piece = run?.army.find((p) => p.id === selected),
    preparation = run?.phase === "preparation",
    incompatible = run
      ? preparation
        ? compositionError(run.army)
        : run.phase === "paused" && run.battle
          ? positionCompositionError(run.battle.initialFen)
          : ""
      : "";
  const showOverflow = () => {
    if (!run) return;
    show({
      title: "Резерв старого забега",
      body: (
        <>
          <p>
            Сохранены все {reservePieces(run).length} фигур. Теперь в резерве
            четыре места. Выберите лишнюю фигуру, чтобы расставить её или
            продать.
          </p>
          <div className="auto-overflow-list">
            {reservePieces(run).map((item) => (
              <button
                key={item.id}
                data-auto-overflow-piece={item.id}
                onClick={() => {
                  setSelected(item.id);
                  show(null);
                }}
              >
                <Piece type={item.type} color={run.color} />
                {PIECE_NAMES[item.type]}
              </button>
            ))}
          </div>
          <button className="primary wide" onClick={() => show(null)}>
            К доске
          </button>
        </>
      ),
    });
  };
  useEffect(() => {
    if (
      run &&
      reservePieces(run).length > 4 &&
      shownOverflow.current !== run.id
    ) {
      shownOverflow.current = run.id;
      showOverflow();
    }
  });
  const shopAction = (change: () => void) => {
    const now = performance.now();
    if (now - lastPurchase.current < 350) return;
    lastPurchase.current = now;
    change();
  };
  const presentSeries = useEffectEvent(() => {
    if (
      !run ||
      run.phase !== "result" ||
      !seriesFinished(run) ||
      auto.presenting ||
      !auto.award ||
      finishedShown.current === run.battle?.id
    )
      return;
    finishedShown.current = run.battle!.id;
    const finish = () => {
      auto.discard();
      show(null);
      void navigate({ to: "/play" });
    };
    const reward = () =>
      show({
        title: "Награда за серию",
        body: (
          <div id="auto-reward">
            <Stat
              label="Монеты"
              value={autoSeriesCoins({ autochessAwards: awards }, run)}
            />
            <button className="primary wide" onClick={finish}>
              Завершить серию
            </button>
          </div>
        ),
      });
    show({
      title: "Серия завершена",
      onClose: reward,
      body: (
        <>
          <div className="auto-results">
            <Stat
              label="Победы"
              value={run.results.filter((r) => r.outcome === "win").length}
            />
            <Stat
              label="Ничьи"
              value={run.results.filter((r) => r.outcome === "draw").length}
            />
            <Stat
              label="Поражения"
              value={run.results.filter((r) => r.outcome === "loss").length}
            />
          </div>
          <button className="primary wide" onClick={reward}>
            Продолжить
          </button>
        </>
      ),
    });
  });
  useEffect(() => {
    presentSeries();
  }, [run, auto.presenting, auto.award]);
  const leave = () => {
    auto.pause();
    show({
      title: "Выйти из автошахмат?",
      body: (
        <>
          <button
            className="primary wide"
            onClick={() => {
              show(null);
              void navigate({ to: "/play" });
            }}
          >
            Сохранить и выйти
          </button>
          <button
            className="danger wide"
            onClick={() => {
              auto.discard();
              show(null);
              void navigate({ to: "/play" });
            }}
          >
            Удалить серию
          </button>
        </>
      ),
    });
  };
  if (!run)
    return (
      <Page id="autochess" title="Автошахматы" back="/play">
        <p>
          Соберите армию и расставьте фигуры. Stockfish сыграет за обе стороны.
          Цель серии — 15 побед до 5 поражений.
        </p>
        {auto.error && <p role="alert">{auto.error}</p>}
        <button
          className="primary"
          disabled={!auto.locked}
          onClick={auto.create}
        >
          Начать серию
        </button>
      </Page>
    );
  const bench = reservePieces(run),
    goal = seriesGoal(run),
    finished = seriesFinished(run),
    result = run.results.at(-1),
    legal = piece
      ? placementSquares(piece.type, run.color).filter(
          (square) => !placementError(run, piece.id, square),
        )
      : [];
  const select = (id: string) => {
    const time = Date.now();
    if (lastTap.current.id === id && time - lastTap.current.at < 350) {
      auto.change((value) => {
        const next = benchPiece(value, id);
        if (next === value) toast("Резерв заполнен");
        return next;
      });
      setSelected(null);
    } else setSelected(id === selected ? null : id);
    lastTap.current = { id, at: time };
  };
  const drop = (square: string) => {
    if (!piece || !preparation) return;
    const error = placementError(run, piece.id, square);
    if (error) {
      toast(error);
      return;
    }
    auto.change((value) => placePiece(value, piece.id, square));
    setSelected(null);
  };
  return (
    <Page
      id="autochess"
      title="Автошахматы"
      actions={
        <>
          <span className="auto-round">Раунд {run.round}</span>
          <button aria-label="Выйти" onClick={leave}>
            ×
          </button>
        </>
      }
    >
      <div ref={surface} className="autochess-surface" id="auto-content">
        <p id="auto-side">
          Победы {run.results.filter((r) => r.outcome === "win").length}/
          {goal.wins} · Поражения{" "}
          {run.results.filter((r) => r.outcome === "loss").length}/{goal.losses}{" "}
          · {run.color === "w" ? "Белые" : "Чёрные"}
        </p>
        <div
          style={{
            touchAction: preparation ? "none" : undefined,
            width: boardWidth,
            alignSelf: "center",
          }}
          onPointerDown={(event) => {
            suppressClick.current = false;
            const square = (
              event.target as HTMLElement
            ).closest<HTMLButtonElement>("[data-square]")?.dataset.square;
            const found = run.army.find((p) => p.square === square);
            if (found && preparation && auto.locked) {
              drag.current = {
                id: found.id,
                x: event.clientX,
                y: event.clientY,
                pointer: event.pointerId,
              };
            }
          }}
          onPointerMove={(event) => {
            const owned = drag.current;
            if (
              owned?.pointer === event.pointerId &&
              Math.hypot(event.clientX - owned.x, event.clientY - owned.y) >=
                8 &&
              !event.currentTarget.hasPointerCapture(event.pointerId)
            )
              event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onPointerUp={(event) => {
            const owned = drag.current;
            drag.current = null;
            if (!owned || owned.pointer !== event.pointerId) return;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
            if (
              Math.hypot(event.clientX - owned.x, event.clientY - owned.y) < 8
            )
              return;
            suppressClick.current = true;
            const target = document
              .elementFromPoint(event.clientX, event.clientY)
              ?.closest<HTMLButtonElement>("[data-square]")?.dataset.square;
            if (!target) return;
            const error = placementError(run, owned.id, target);
            if (error) toast(error);
            else auto.change((value) => placePiece(value, owned.id, target));
            setSelected(null);
          }}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            }
          }}
        >
          <Chessboard
            feedback
            id="auto-board"
            pieces={pieces}
            equipped={equipped}
            orientation={run.color}
            selected={piece?.square}
            legal={preparation ? legal : []}
            last={game?.history({ verbose: true }).at(-1)}
            disabled={!preparation || !auto.locked}
            duration={motionDuration.autoBoard}
            onSquare={(square) => {
              if (piece && piece.square !== square && legal.includes(square)) {
                drop(square);
                return;
              }
              const found = run.army.find((p) => p.square === square);
              if (found) select(found.id);
              else setSelected(null);
            }}
          />
        </div>
        <div id="auto-shop">
          <div className="auto-reserve-row">
            <div className="auto-reserve">
              {Array.from({ length: 4 }, (_, slot) => {
                const item = bench.find(
                  (p, index) => (p.reserveSlot ?? index) === slot,
                );
                return (
                  <button
                    key={slot}
                    data-auto-piece={item?.id}
                    aria-label={
                      item
                        ? `${PIECE_NAMES[item.type]} в резерве`
                        : "Пустой слот резерва"
                    }
                    aria-pressed={item?.id === selected}
                    disabled={!preparation}
                    onClick={() => {
                      if (item) select(item.id);
                      else if (selected) {
                        auto.change((value) => benchPiece(value, selected));
                        setSelected(null);
                      }
                    }}
                  >
                    {item && <Piece type={item.type} color={run.color} />}
                  </button>
                );
              })}
            </div>
            <button
              className="auto-sale"
              aria-label="Продать выбранную фигуру"
              disabled={!preparation || !piece || piece.type === "k"}
              onClick={() => {
                if (selected)
                  shopAction(() =>
                    auto.change((value) => sellPiece(value, selected)),
                  );
                setSelected(null);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path d="M20 13 11 22 2 13V4h9l9 9Z" />
                <circle cx="7" cy="9" r="1.5" />
              </svg>
              <span>
                {piece && piece.type !== "k" ? salePrice(piece) : "—"}
              </span>
            </button>
          </div>
          <div className="auto-shop-meta">
            {bench.length > 4 && (
              <button className="text-button" onClick={showOverflow}>
                Резерв {bench.length}/4 · Разобрать
              </button>
            )}
            <button
              onClick={() =>
                show({
                  title: "Шансы магазина",
                  body: (
                    <table>
                      <thead>
                        <tr>
                          <th>Уровень</th>
                          {(["p", "n", "b", "r", "q"] as const).map((t) => (
                            <th key={t}>{PIECE_NAMES[t]}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 10 }, (_, i) => (
                          <tr key={i}>
                            <th>{i + 1}</th>
                            {Object.entries(shopOdds(i + 1)).map(
                              ([t, odds]) => (
                                <td key={t}>{odds}%</td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ),
                })
              }
            >
              Уровень {run.level} · Шансы
            </button>
            <strong>{run.reserve} ◈</strong>
            <span>
              {run.army.length}/{armyCapacity(run)}
            </span>
          </div>
          {run.version === 4 ? (
            <div className="auto-shop-actions">
              <button
                data-auto-random
                disabled={!!purchaseError(run)}
                title={purchaseError(run)}
                onClick={() =>
                  shopAction(() =>
                    auto.change((value) => {
                      const next = buyRandomPiece(value);
                      if (next !== value) setSelected(next.army.at(-1)!.id);
                      return next;
                    }),
                  )
                }
              >
                {purchaseError(run) || `Фигура · ${purchasePrice(run)} ◈`}
              </button>
              <button
                className="auto-level-outlined"
                disabled={!!upgradeError(run)}
                title={upgradeError(run)}
                onClick={() => shopAction(() => auto.change(upgradeShop))}
              >
                Улучшить · {levelPrice(run)} ◈
              </button>
            </div>
          ) : (
            <div className="auto-catalog">
              {(["p", "n", "b", "r", "q"] as const).map((t) => (
                <button
                  key={t}
                  disabled={!!purchaseError(run, PRICES[t])}
                  onClick={() =>
                    shopAction(() => auto.change((value) => buyPiece(value, t)))
                  }
                >
                  <Piece type={t} color={run.color} />
                  {PRICES[t]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="auto-status">
          <span id="auto-status" role="status">
            {auto.preparing
              ? `Подготовка движка · попытка ${auto.attempt}`
              : auto.active
                ? "Идёт бой"
                : run.phase === "result"
                  ? result?.reason
                  : preparation
                    ? incompatible
                      ? ""
                      : setupError(run)
                    : "Бой сохранён"}
          </span>
          {!preparation && (
            <span>
              {" "}
              · Ход {Math.ceil((run.battle?.moves.length || 0) / 2)} / 60
            </span>
          )}
        </div>
        {auto.error && <p role="alert">{auto.error}</p>}
        <div id="auto-action">
          {run.phase === "result" ? (
            auto.presenting ? (
              <p>Бой завершён</p>
            ) : (
              <>
                {!auto.award ? (
                  <button onClick={auto.retryReward}>Сохранить награду</button>
                ) : (
                  <>
                    <button
                      className="primary"
                      onClick={() => {
                        setSelected(null);
                        if (finished) auto.discard();
                        else auto.next();
                      }}
                    >
                      {finished ? "Завершить серию" : "Следующий раунд"}
                    </button>
                  </>
                )}
              </>
            )
          ) : (
            <button
              className="primary"
              disabled={
                !auto.locked ||
                auto.preparing ||
                (preparation && !!setupError(run) && !incompatible)
              }
              onClick={() => {
                setSelected(null);
                if (auto.active) auto.pause();
                else if (incompatible)
                  show({
                    title: "Исправьте состав",
                    body: (
                      <>
                        <p>{incompatible}</p>
                        <p>
                          Фигуры в резерве не учитываются. Можно убрать фигуру
                          двойным нажатием, обменять её с резервом или продать.
                          Все фигуры сохранены.
                        </p>
                        {run.phase === "paused" && (
                          <button
                            data-auto-repair
                            className="primary wide"
                            onClick={() => {
                              auto.pause();
                              auto.change((value) => ({
                                ...value,
                                phase: "preparation",
                                battle: null,
                              }));
                              show(null);
                            }}
                          >
                            Вернуться к расстановке
                          </button>
                        )}
                        <button
                          className="quiet wide"
                          onClick={() => show(null)}
                        >
                          К доске
                        </button>
                      </>
                    ),
                  });
                else auto.start();
              }}
            >
              {incompatible
                ? "Исправить состав"
                : auto.active
                  ? "Пауза"
                  : preparation
                    ? "Начать бой"
                    : "Продолжить бой"}
            </button>
          )}
        </div>
      </div>
    </Page>
  );
};
export default AutochessPage;
