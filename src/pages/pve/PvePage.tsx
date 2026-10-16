import type { Square } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault, useVaultStore } from "../../app/providers/VaultProvider.js";
import { PIECE_NAMES } from "../../domain/catalog/catalog.js";
import {
  beginPveBattle,
  isKingThreatened,
  movesFor,
  returnToMap,
  unitAt,
} from "../../domain/pve/pve-battle.js";
import {
  NODES,
  activeArmy,
  armyPower,
  campaignComplete,
  damage,
  encounter,
  evolutionOptions,
  evolveUnit,
  homeSquare,
  isUnlocked,
  maxHp,
  useStone as spendStone,
  strengthLabel,
  toggleUnit,
  xpThreshold,
} from "../../domain/pve/pve-model.js";
import type {
  PveNode,
  PveProfile,
  PveReceipt,
  PveUnit,
  UnitChange,
} from "../../domain/pve/types.js";
import { Chessboard } from "../../features/chessboard/Chessboard.js";
import { usePveBattle } from "../../features/pve/usePveBattle.js";
import { Page } from "../../shared/ui/Page.js";
import { Piece } from "../../shared/ui/Piece.js";
const ProgressRow = ({ change }: { change: UnitChange }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="pve-progress-row">
      <Piece type={change.type} />
      <span>
        {PIECE_NAMES[change.type]} · Ур.{" "}
        {shown ? change.afterLevel : change.beforeLevel}
      </span>
      <div className="pve-xp">
        <span
          style={{
            display: "block",
            height: 6,
            background: "var(--accent)",
            width: `${(100 * (shown ? change.afterXp : change.beforeXp)) / xpThreshold(shown ? change.afterLevel : change.beforeLevel)}%`,
            transition: "width 420ms",
          }}
        />
      </div>
      <span>
        +{change.earned} опыта{change.penalty > 0 && ` / −${change.penalty}`}
      </span>
    </div>
  );
};
export const PvePage = () => {
  const persisted = useVault((s) => s.pve),
    [view, setView] = useState<"map" | "army" | "battle">(() =>
      persisted.battle ? "battle" : "map",
    ),
    battle = usePveBattle(view === "battle"),
    profile = battle.profile,
    store = useVaultStore(),
    equipped = useVault((s) => s.equipped),
    { show, toast } = useOverlays(),
    [selected, setSelected] = useState<Square | null>(null),
    [resultStep, setResultStep] = useState<"outcome" | "reward" | "progress">(
      "outcome",
    );
  const visual = battle.visual,
    pieces = useMemo(
      () =>
        visual
          ? visual.units
              .filter(
                (unit) => unit.hp > 0 || unit.id === battle.attack?.targetId,
              )
              .map((unit) => ({ ...unit, maxHp: maxHp(unit) }))
          : [],
      [visual, battle.attack?.targetId],
    ),
    legal =
      visual && selected ? movesFor(visual, unitAt(visual, selected)) : [];
  const change = async (transform: (profile: PveProfile) => PveProfile) => {
    const result = await store.update((s) => ({ ...s, pve: transform(s.pve) }));
    if (!result.ok) toast(result.error.message);
    return result.ok;
  };
  const begin = async (node: PveNode) => {
    if (await change((p) => beginPveBattle(p, node.id))) {
      setResultStep("outcome");
      setView("battle");
      show(null);
    }
  };
  const preview = (node: PveNode) => {
    const enemy = encounter(profile, node);
    show({
      title: node.name,
      body: (
        <>
          <p>
            {strengthLabel(enemy.ratio)} · {Math.round(enemy.power)} силы
          </p>
          <div className="pve-enemies">
            {enemy.units.map((unit) => (
              <span key={unit.id}>
                <Piece type={unit.type} color="b" />
                Ур. {unit.level}
              </span>
            ))}
          </div>
          <p>
            {profile.cleared.includes(node.id)
              ? "Узел уже пройден. Награды за бой сохраняются."
              : `Первая победа: +${node.boss ? 10 : node.bonus ? 6 : 5} монет и +${node.boss ? 3 : node.bonus ? 2 : 1} камней опыта.`}
          </p>
          <button
            className="primary wide"
            disabled={activeArmy(profile).length !== 8 || !!profile.battle}
            onClick={() => void begin(node)}
          >
            В бой
          </button>
        </>
      ),
    });
  };
  const unitDialog = (unit: PveUnit) =>
    show({
      title: PIECE_NAMES[unit.type],
      body: (
        <>
          <Piece type={unit.type} />
          <p>
            Уровень {unit.level}/{profile.levelCap} · Опыт {unit.xp}/
            {xpThreshold(unit.level)}
          </p>
          <p>
            Здоровье {maxHp(unit)} · Урон {damage(unit)}
          </p>
          <div className="dialog-actions">
            <button
              disabled={
                !!profile.battle ||
                unit.type === "k" ||
                (!unit.active && activeArmy(profile).length >= 8)
              }
              onClick={() =>
                void change((p) => toggleUnit(p, unit.id)).then((ok) => {
                  if (ok) show(null);
                })
              }
            >
              {unit.active ? "В резерв" : "В армию"}
            </button>
            <button
              disabled={
                !!profile.battle ||
                !profile.stones ||
                (unit.level === profile.levelCap &&
                  unit.xp >= xpThreshold(unit.level) - 1)
              }
              onClick={() =>
                void change((p) => spendStone(p, unit.id)).then((ok) => {
                  if (ok) show(null);
                })
              }
            >
              Камень опыта · 1
            </button>
            {campaignComplete(profile) &&
              evolutionOptions(unit.type).map((type) => (
                <button
                  key={type}
                  disabled={!!profile.battle || !profile.cores}
                  onClick={() =>
                    void change((p) => evolveUnit(p, unit.id, type)).then(
                      (ok) => {
                        if (ok) show(null);
                      },
                    )
                  }
                >
                  Эволюция: {PIECE_NAMES[type]} · 1 ядро
                </button>
              ))}
          </div>
        </>
      ),
    });
  const receipt = visual?.settled ? (visual.result as PveReceipt) : null;
  return (
    <Page
      id="pve"
      title={view === "battle" ? "Бой" : view === "army" ? "Армия" : "Поход"}
      actions={
        view === "battle" ? (
          <button
            aria-label="На карту"
            onClick={() => {
              setSelected(null);
              setView("map");
            }}
          >
            ←
          </button>
        ) : undefined
      }
    >
      {view === "map" && (
        <div className="pve-map">
          <div className="pve-chapter">
            <h2>Лесная крепость</h2>
            <p>
              Сила армии: {Math.round(armyPower(activeArmy(profile)))} ·{" "}
              {profile.cleared.length}/{NODES.length} узлов
            </p>
            {profile.battle && (
              <button className="primary" onClick={() => setView("battle")}>
                Продолжить бой
              </button>
            )}
          </div>
          <div className="pve-road">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="pve-stops" key={index}>
                {NODES.filter((node) => node.step === index + 1).map((node) => (
                  <button
                    className={`pve-node ${profile.cleared.includes(node.id) ? "cleared" : ""} ${node.boss ? "boss" : ""}`}
                    key={node.id}
                    disabled={!isUnlocked(profile, node) || !!profile.battle}
                    onClick={() => preview(node)}
                  >
                    <span>
                      {profile.cleared.includes(node.id)
                        ? "✓"
                        : node.boss
                          ? "♜"
                          : node.step}
                    </span>
                    <strong>{node.name}</strong>
                    {node.bonus && <small>Дополнительная награда</small>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {view === "army" && (
        <div className="pve-army">
          <p>
            {activeArmy(profile).length}/8 в армии · Камни опыта:{" "}
            {profile.stones} · Ядра: {profile.cores}
          </p>
          <Chessboard
            pieces={activeArmy(profile).map((unit) => ({
              ...unit,
              square: homeSquare(unit.id),
              color: "w" as const,
              hp: maxHp(unit),
              maxHp: maxHp(unit),
            }))}
            equipped={equipped}
            onSquare={(square) => {
              const unit = profile.units.find(
                (unit) => unit.active && homeSquare(unit.id) === square,
              );
              if (unit) unitDialog(unit);
            }}
          />
          <h2>Резерв</h2>
          <div className="pve-reserve">
            {profile.units
              .filter((unit) => !unit.active)
              .map((unit) => (
                <button key={unit.id} onClick={() => unitDialog(unit)}>
                  <Piece type={unit.type} />
                  <span>
                    {PIECE_NAMES[unit.type]} · {unit.level}
                  </span>
                </button>
              ))}
          </div>
          {activeArmy(profile).length !== 8 && (
            <p>Для боя нужны ровно 8 фигур, включая короля.</p>
          )}
        </div>
      )}
      {view === "battle" && visual && (
        <div className="pve-battle">
          <div className="match-summary">
            <button
              aria-label="Сдаться"
              disabled={!!receipt || battle.phase === "animating"}
              onClick={() =>
                show({
                  title: "Сдаться?",
                  body: (
                    <>
                      <p>
                        До 10 ваших ходов награда составляет 0 монет и 1 камень
                        опыта.
                      </p>
                      <button
                        className="danger wide"
                        onClick={() => {
                          show(null);
                          void battle.resign();
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
            <strong>{NODES.find((n) => n.id === visual.nodeId)?.name}</strong>
            <span>{visual.ply}/240</span>
          </div>
          <p role="status">
            {visual.phase === "result"
              ? "Бой завершён"
              : `${visual.turn === "w" ? "Ваш ход" : "Ход соперника"}${isKingThreatened(visual) ? " · Король под угрозой" : ""}`}
          </p>
          <Chessboard
            pieces={pieces}
            equipped={equipped}
            selected={selected}
            legal={legal.map((move) => move.to)}
            last={visual.lastEvent}
            attack={battle.attack}
            disabled={
              battle.phase !== "idle" ||
              visual.turn !== "w" ||
              visual.phase !== "playing"
            }
            onSquare={(square) => {
              if (selected && legal.some((move) => move.to === square)) {
                void battle.move({ from: selected, to: square });
                setSelected(null);
              } else
                setSelected(
                  unitAt(visual, square)?.color === "w" ? square : null,
                );
            }}
          />
          {battle.error && (
            <div role="alert">
              <p>{battle.error}</p>
              <button onClick={battle.retry}>Повторить</button>
            </div>
          )}
          {receipt && battle.phase === "idle" && (
            <section className="panel pve-result">
              {resultStep === "outcome" ? (
                <>
                  <h2>
                    {
                      { win: "Победа", loss: "Поражение", draw: "Ничья" }[
                        receipt.outcome
                      ]
                    }
                  </h2>
                  <p>
                    {
                      {
                        king: "Король повержен",
                        checkmate: "Бой завершён",
                        resigned: "Сдача",
                        limit: "Лимит ходов",
                        repetition: "Повторение позиции",
                        "no-moves": "Нет доступных ходов",
                      }[receipt.reason]
                    }
                  </p>
                  <button
                    className="primary wide"
                    onClick={() => setResultStep("reward")}
                  >
                    Продолжить
                  </button>
                </>
              ) : resultStep === "reward" ? (
                <>
                  <h2>Награда</h2>
                  <p className="reward-amount">
                    +{receipt.coins} ◈ · +{receipt.stones} камней
                    {receipt.cores > 0 && ` · +${receipt.cores} ядро`}
                  </p>
                  {receipt.first && <p>Первая победа над узлом</p>}
                  <button
                    className="primary wide"
                    onClick={() => setResultStep("progress")}
                  >
                    Продолжить
                  </button>
                </>
              ) : (
                <>
                  <h2>Опыт армии</h2>
                  {receipt.changes.map((change) => (
                    <ProgressRow key={change.id} change={change} />
                  ))}
                  <button
                    className="primary wide"
                    onClick={() =>
                      void change(returnToMap).then((ok) => {
                        if (ok) {
                          setView("map");
                          setResultStep("outcome");
                        }
                      })
                    }
                  >
                    На карту
                  </button>
                </>
              )}
            </section>
          )}
        </div>
      )}
      {view !== "battle" && (
        <nav id="pve-nav" aria-label="Поход">
          <button
            className={view === "map" ? "active" : ""}
            onClick={() => setView("map")}
          >
            Карта
          </button>
          <button
            className={view === "army" ? "active" : ""}
            onClick={() => setView("army")}
          >
            Армия
          </button>
        </nav>
      )}
    </Page>
  );
};
export default PvePage;
