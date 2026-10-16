import { useRef, useState, type KeyboardEvent } from "react";
import {
  PIECE_NAMES,
  itemById,
  styleById,
} from "../../domain/catalog/catalog.js";
import type { Equipment } from "../../domain/catalog/types.js";
import { formation } from "../../domain/pve/pve-battle.js";
import {
  activeArmy,
  campaignComplete,
  damage,
  evolutionOptions,
  maxHp,
  xpThreshold,
} from "../../domain/pve/pve-model.js";
import type { PveProfile, PveUnit } from "../../domain/pve/types.js";
import { Piece } from "../../shared/ui/Piece.js";
export const PveArmy = ({
  profile,
  equipped,
  onToggle,
  onStone,
  onEvolve,
}: {
  profile: PveProfile;
  equipped: Equipment;
  onToggle: (id: string) => void;
  onStone: (id: string) => void;
  onEvolve: (unit: PveUnit) => void;
}) => {
  const [selected, setSelected] = useState<string>(),
    board = useRef<HTMLDivElement>(null),
    units = formation(activeArmy(profile), "w"),
    chosen =
      profile.units.find((unit) => unit.id === selected) ||
      profile.units.find((unit) => unit.active)!,
    reserve = profile.units.filter((unit) => !unit.active),
    position = units.find((unit) => unit.id === chosen.id)?.square,
    full =
      chosen.level === profile.levelCap &&
      chosen.xp >= xpThreshold(chosen.level) - 1,
    locked = !!profile.battle,
    style = styleById(itemById(equipped.board)?.style);
  const key = (event: KeyboardEvent<HTMLButtonElement>) => {
    const directions: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -8,
        ArrowDown: 8,
      },
      delta = directions[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const cells = Array.from(
      board.current!.querySelectorAll<HTMLButtonElement>("[data-square]"),
    );
    cells[
      Math.max(
        0,
        Math.min(cells.length - 1, cells.indexOf(event.currentTarget) + delta),
      )
    ]?.focus({ preventScroll: true });
  };
  const icon = (unit: PveUnit) => (
    <Piece
      type={unit.type}
      color="w"
      style={itemById(equipped.pieces[unit.type])?.style}
    />
  );
  return (
    <div className="pve-page pve-army-page">
      <div className="pve-section-intro">
        <strong>В строю {units.length} / 8</strong>
        <span className="pve-meta">
          Камни {profile.stones} · Ядра {profile.cores}
        </span>
      </div>
      {locked && (
        <p className="pve-note">Состав и прокачка доступны после боя.</p>
      )}
      <div
        id="pve-army-board"
        ref={board}
        className="board"
        role="group"
        aria-label="Стартовая расстановка армии"
      >
        {Array.from({ length: 32 }, (_, i) => {
          const square = "abcdefgh"[i % 8] + (4 - Math.floor(i / 8)),
            unit = units.find((unit) => unit.square === square),
            dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          return (
            <button
              key={square}
              data-square={square}
              data-pve-unit={unit?.id}
              className={`square ${dark ? "dark" : ""} ${unit?.id === chosen.id ? "selected" : ""}`}
              style={{
                backgroundColor:
                  unit?.id === chosen.id
                    ? "var(--board-selected)"
                    : dark
                      ? style.dark
                      : style.light,
              }}
              aria-disabled={!unit}
              aria-label={
                unit
                  ? `${square}, ${PIECE_NAMES[unit.type]}, уровень ${unit.level}`
                  : `${square}, пусто`
              }
              onKeyDown={key}
              onClick={() => {
                if (unit) setSelected(unit.id);
              }}
            >
              {unit && (
                <>
                  {icon(profile.units.find((value) => value.id === unit.id)!)}
                  <span className="pve-army-level" aria-hidden="true">
                    {unit.level}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <section className="pve-reserve">
        <h2>Резерв</h2>
        <div className="pve-reserve-slots">
          {reserve.map((unit) => (
            <button
              key={unit.id}
              className={`quiet pve-reserve-unit ${unit.id === chosen.id ? "is-selected" : ""}`}
              data-pve-unit={unit.id}
              aria-pressed={unit.id === chosen.id}
              aria-label={`${PIECE_NAMES[unit.type]}, уровень ${unit.level}, резерв`}
              onClick={() => setSelected(unit.id)}
            >
              <span>{icon(unit)}</span>
              <small>{unit.level}</small>
            </button>
          ))}
          {Array.from({ length: Math.max(0, 2 - reserve.length) }, (_, i) => (
            <span key={i} className="pve-reserve-empty" aria-hidden="true" />
          ))}
        </div>
      </section>
      <div id="pve-army-details">
        <article className={`pve-unit ${!chosen.active ? "in-reserve" : ""}`}>
          <div className="pve-unit-top">
            <span className="pve-piece">{icon(chosen)}</span>
            <div>
              <h2>
                {PIECE_NAMES[chosen.type]} · {position || "Резерв"}
              </h2>
              <span className="pve-meta">
                Уровень {chosen.level} · {chosen.active ? "В строю" : "Резерв"}
              </span>
            </div>
            {chosen.type !== "k" && (
              <button
                className="quiet pve-unit-toggle"
                data-pve-toggle={chosen.id}
                disabled={locked || (!chosen.active && units.length >= 8)}
                onClick={() => onToggle(chosen.id)}
              >
                {chosen.active ? "В резерв" : "В строй"}
              </button>
            )}
          </div>
          <div className="pve-unit-stats">
            <span>
              <strong>{maxHp(chosen)}</strong> HP
            </span>
            <span>
              <strong>{damage(chosen)}</strong> урон
            </span>
          </div>
          <div className="pve-xp">
            <progress
              value={chosen.xp}
              max={xpThreshold(chosen.level)}
              aria-label={`Опыт ${PIECE_NAMES[chosen.type]}`}
            />
            <span>
              {chosen.xp} / {xpThreshold(chosen.level)} XP
            </span>
          </div>
          <button
            className="quiet pve-stone-use"
            data-pve-stone={chosen.id}
            disabled={!profile.stones || locked || full}
            onClick={() => onStone(chosen.id)}
          >
            {full
              ? "Достигнут лимит опыта"
              : `Камень опыта · +${Math.ceil(xpThreshold(chosen.level) * 0.1)} XP`}
          </button>
          {!!evolutionOptions(chosen.type).length && (
            <button
              className="quiet pve-evolve"
              data-pve-evolve={chosen.id}
              disabled={!campaignComplete(profile) || !profile.cores || locked}
              onClick={() => onEvolve(chosen)}
            >
              Эволюция · 1 ядро
            </button>
          )}
        </article>
      </div>
    </div>
  );
};
