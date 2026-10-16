import { useNavigate } from "@tanstack/react-router";
import { useEffect,useMemo,useRef,useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault } from "../../app/providers/VaultProvider.js";
import { autoSeriesCoins } from "../../domain/autochess/autochess-rewards.js";
import {
armyCapacity,
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
roundIncome,
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
import { Page,Stat } from "../../shared/ui/Page.js";
import { Piece } from "../../shared/ui/Piece.js";
export const AutochessPage = () => {
  const auto = useAutochess(),
    run = auto.run,
    equipped = useVault((s) => s.equipped),
    awards = useVault((s) => s.autochessAwards),
    { show, toast } = useOverlays(),
    navigate = useNavigate(),
    [selected, setSelected] = useState<string | null>(null),
    lastTap = useRef({ id: "", at: 0 });
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const game = useMemo(
      () => (run?.battle ? battleGame(run) : null),
      [run?.battle],
    ),
    pieces: BoardPiece[] = game
      ? chessPieces(game)
      : run?.army
          .filter((p) => p.square)
          .map((p) => ({ ...p, square: p.square!, color: run.color })) || [];
  const piece = run?.army.find((p) => p.id === selected),
    preparation = run?.phase === "preparation";
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
      auto.change((value) => benchPiece(value, id));
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
      <div className="autochess-surface" id="auto-content">
        <p id="auto-side">
          Вы играете {run.color === "w" ? "белыми" : "чёрными"}. Соперник
          появится в бою.
        </p>
        <div
          onPointerDown={(event) => {
            const square = (
              event.target as HTMLElement
            ).closest<HTMLButtonElement>("[data-square]")?.dataset.square;
            const found = run.army.find((p) => p.square === square);
            if (found && preparation)
              event.currentTarget.dataset.drag = found.id;
          }}
          onPointerUp={(event) => {
            const id = event.currentTarget.dataset.drag;
            delete event.currentTarget.dataset.drag;
            const target = document
              .elementFromPoint(event.clientX, event.clientY)
              ?.closest<HTMLButtonElement>("[data-square]")?.dataset.square;
            const original = run.army.find((p) => p.id === id);
            if (id && target && original?.square !== target && preparation) {
              const error = placementError(run, id, target);
              if (error) toast(error);
              else auto.change((value) => placePiece(value, id, target));
              setSelected(null);
            }
          }}
        >
          <Chessboard
            pieces={pieces}
            equipped={equipped}
            orientation={run.color}
            selected={piece?.square}
            legal={preparation ? legal : []}
            last={game?.history({ verbose: true }).at(-1)}
            disabled={!preparation || !auto.locked}
            duration={160}
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
              disabled={!preparation || !piece || piece.type === "k"}
              onClick={() => {
                if (selected)
                  auto.change((value) => sellPiece(value, selected));
                setSelected(null);
              }}
            >
              Продать {piece && piece.type !== "k" ? salePrice(piece) : "—"}
            </button>
          </div>
          {bench.length > 4 && (
            <div className="auto-overflow-list">
              {bench
                .filter((p, index) => (p.reserveSlot ?? index) >= 4)
                .map((p) => (
                  <button key={p.id} onClick={() => select(p.id)}>
                    <Piece type={p.type} color={run.color} /> Лишний резерв
                  </button>
                ))}
            </div>
          )}
          <div className="auto-shop-meta">
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
                disabled={!!purchaseError(run)}
                title={purchaseError(run)}
                onClick={() => auto.change(buyRandomPiece)}
              >
                Фигура · {purchasePrice(run)} ◈
              </button>
              <button
                className="auto-level-outlined"
                disabled={!!upgradeError(run)}
                title={upgradeError(run)}
                onClick={() => auto.change(upgradeShop)}
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
                  onClick={() => auto.change((value) => buyPiece(value, t))}
                >
                  <Piece type={t} color={run.color} />
                  {PRICES[t]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="auto-status">
          <span role="status">
            {auto.preparing
              ? `Подготовка движка · попытка ${auto.attempt}`
              : auto.active
                ? "Идёт бой"
                : run.phase === "result"
                  ? result?.reason
                  : preparation
                    ? setupError(run) || "Армия готова"
                    : "Бой сохранён"}
          </span>
          <span id="auto-resource">
            {run.battle?.moves.length || 0}/120 ходов
          </span>
        </div>
        {auto.error && <p role="alert">{auto.error}</p>}
        <div id="auto-action">
          {run.phase === "result" ? (
            <>
              {!auto.award ? (
                <button onClick={auto.retryReward}>Сохранить награду</button>
              ) : (
                <>
                  <p>
                    +{roundIncome(result)} монет магазина · В серии заработано{" "}
                    {autoSeriesCoins({ autochessAwards: awards }, run)} ◈
                  </p>
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
          ) : (
            <button
              className="primary"
              disabled={
                !auto.locked ||
                auto.preparing ||
                (preparation && !!setupError(run))
              }
              onClick={() => {
                setSelected(null);
                if (auto.active) auto.pause();
                else auto.start();
              }}
            >
              {auto.active
                ? "Пауза"
                : preparation
                  ? "Начать бой"
                  : "Продолжить бой"}
            </button>
          )}
        </div>
        <div className="auto-results">
          <Stat
            label={`Победы / ${goal.wins}`}
            value={run.results.filter((r) => r.outcome === "win").length}
          />
          <Stat
            label={`Поражения / ${goal.losses}`}
            value={run.results.filter((r) => r.outcome === "loss").length}
          />
          <Stat
            label="Ничьи"
            value={run.results.filter((r) => r.outcome === "draw").length}
          />
        </div>
      </div>
    </Page>
  );
};
export default AutochessPage;
