import { useMemo, useState } from "react";
import type { Square } from "chess.js";
import { PIECE_NAMES } from "../../domain/catalog/catalog.js";
import type { Equipment } from "../../domain/catalog/types.js";
import {
  isKingThreatened,
  movesFor,
  unitAt,
} from "../../domain/pve/pve-battle.js";
import {
  NODES,
  damage,
  maxHp,
  xpThreshold,
} from "../../domain/pve/pve-model.js";
import { Chessboard } from "../chessboard/Chessboard.js";
import type { usePveBattle } from "./usePveBattle.js";
export const PveBattleView = ({
  battle,
  equipped,
  onResign,
}: {
  battle: ReturnType<typeof usePveBattle>;
  equipped: Equipment;
  onResign: () => void;
}) => {
  const [selected, setSelected] = useState<Square | null>(null),
    visual = battle.visual;
  const pieces = useMemo(
    () =>
      visual
        ? visual.units
            .filter(
              (unit) => unit.hp > 0 || unit.id === battle.attack?.targetId,
            )
            .map((unit) => ({
              ...unit,
              maxHp: maxHp(unit),
              description: `${unit.color === "w" ? "ваша" : "вражеская"} ${PIECE_NAMES[unit.type]}, уровень ${unit.level}, HP ${unit.hp} из ${maxHp(unit)}, урон ${damage(unit)}`,
            }))
        : [],
    [visual, battle.attack?.targetId],
  );
  if (!visual) return null;
  const own = unitAt(visual, selected || ""),
    legal = own?.color === "w" ? movesFor(visual, own) : [],
    event = visual.lastEvent,
    locked =
      battle.phase !== "idle" ||
      visual.turn !== "w" ||
      visual.phase !== "playing";
  return (
    <div className="pve-battle">
      <div className="pve-battle-top">
        <span>Вы · белые</span>
        <span>{NODES.find((node) => node.id === visual.nodeId)?.name}</span>
      </div>
      <div className="pve-turn" id="pve-turn" role="status">
        {visual.phase === "result"
          ? "Бой завершён"
          : battle.error
            ? "Бой приостановлен"
            : `${isKingThreatened(visual) ? "Король под ударом · " : ""}${visual.turn === "w" ? "Ваш ход" : "Ход соперника"}`}
      </div>
      <Chessboard
        id="pve-board"
        label="Бой PvE"
        pieces={pieces}
        equipped={equipped}
        selected={selected}
        legal={legal.map((move) => move.to)}
        last={event}
        attack={battle.attack}
        check={
          isKingThreatened(visual)
            ? visual.units.find(
                (unit) => unit.type === "k" && unit.color === visual.turn,
              )?.square
            : null
        }
        disabled={locked}
        animateDraggedMove
        moves={
          locked
            ? []
            : visual.units
                .filter((unit) => unit.color === "w" && unit.hp > 0)
                .flatMap((unit) => movesFor(visual, unit))
        }
        onMove={(from, to) => {
          void battle.move({ from, to });
          setSelected(null);
        }}
        onSquare={(square) => {
          if (own?.color === "w" && legal.some((move) => move.to === square)) {
            void battle.move({ from: own.square, to: square });
            setSelected(null);
          } else setSelected(selected === square ? null : square);
        }}
      />
      <div
        className={`pve-inspect ${own ? "has-unit" : ""}`}
        id="pve-inspect"
        aria-live="polite"
      >
        <div className="pve-inspect-size" aria-hidden="true">
          <strong>Ферзь · уровень 5</strong>
          <span>HP 200 / 200 · Урон 200</span>
          <span className="pve-meta">Опыт: 999 / 999 · В бою +999 XP</span>
        </div>
        <div className="pve-inspect-content">
          {own && (
            <>
              <strong>
                {PIECE_NAMES[own.type]} · уровень {own.level}
              </strong>
              <span>
                HP {own.hp} / {maxHp(own)} · Урон {damage(own)}
              </span>
              <span className="pve-meta">
                {own.color === "w"
                  ? `Опыт: ${battle.profile.units.find((unit) => unit.id === own.id)?.xp ?? 0} / ${xpThreshold(own.level)} · В бою +${visual.xp[own.id] || 0} XP`
                  : "Вражеская фигура"}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="pve-battle-log" id="pve-log" role="status">
        {event &&
          `${event.from} → ${event.to}${event.enPassant ? " · на проходе" : ""}${event.damage ? ` · −${event.damage} HP${event.killed ? " · фигура повержена" : ""}` : ""}${event.promoted ? " · временное превращение в ферзя" : ""}`}
      </div>
      <div className="pve-battle-actions">
        <button
          className="quiet"
          onClick={onResign}
          disabled={visual.phase === "result"}
        >
          Сдаться
        </button>
        {battle.error && (
          <button className="primary" onClick={battle.retry}>
            Повторить ход ИИ
          </button>
        )}
      </div>
    </div>
  );
};
