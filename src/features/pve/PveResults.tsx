import { motionDuration } from "../../shared/styles/motion.js";
import { useEffect, useRef, useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { PIECE_NAMES, itemById } from "../../domain/catalog/catalog.js";
import type { Equipment } from "../../domain/catalog/types.js";
import { xpThreshold } from "../../domain/pve/pve-model.js";
import type { PveReceipt, UnitChange } from "../../domain/pve/types.js";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion.js";
import { Piece } from "../../shared/ui/Piece.js";
import { Stat } from "../../shared/ui/Page.js";
const ExperienceRow = ({
  change,
  equipped,
}: {
  change: UnitChange;
  equipped: Equipment;
}) => {
  const reduced = useReducedMotion(),
    [position, setPosition] = useState({
      level: change.beforeLevel,
      xp: change.beforeXp,
    });
  useEffect(() => {
    if (reduced) {
      setPosition({ level: change.afterLevel, xp: change.afterXp });
      return;
    }
    let frame = 0,
      start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const elapsed = now - start,
        different = change.beforeLevel !== change.afterLevel,
        up = change.afterLevel > change.beforeLevel,
        second =
          different && elapsed >= motionDuration.reveal + motionDuration.fast;
      const level = second ? change.afterLevel : change.beforeLevel,
        from = second
          ? up
            ? 0
            : xpThreshold(change.afterLevel)
          : change.beforeXp,
        to =
          second || !different
            ? change.afterXp
            : up
              ? xpThreshold(change.beforeLevel)
              : 0,
        t = Math.min(
          1,
          (second
            ? elapsed - motionDuration.reveal - motionDuration.fast
            : elapsed) / motionDuration.reveal,
        );
      setPosition({
        level,
        xp: Math.round(from + (to - from) * (1 - (1 - t) ** 3)),
      });
      if (
        elapsed <
        (different
          ? 2 * motionDuration.reveal + motionDuration.fast
          : motionDuration.reveal)
      )
        frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [change, reduced]);
  const delta = change.earned - change.penalty;
  return (
    <div className="pve-experience-row">
      <span className="pve-piece">
        <Piece
          type={change.type}
          style={itemById(equipped.pieces[change.type])?.style}
        />
      </span>
      <div className="pve-experience-main">
        <div className="pve-experience-head">
          <strong>
            {PIECE_NAMES[change.type]}
            {change.square && ` · ${change.square}`}
          </strong>
          <span className="pve-experience-delta">
            {delta > 0
              ? `+${delta} XP`
              : delta < 0
                ? `−${Math.abs(delta)} XP`
                : "Без изменений"}
          </span>
        </div>
        <div className="pve-experience-meta">
          <span className="pve-experience-level">
            Ур.{" "}
            {position.level !== change.beforeLevel
              ? `${change.beforeLevel} → ${position.level}`
              : position.level}
          </span>
          <span className="pve-experience-count">
            {position.xp} / {xpThreshold(position.level)} XP
          </span>
        </div>
        <div
          className="pve-experience-track"
          role="progressbar"
          aria-label={`Опыт ${PIECE_NAMES[change.type]}`}
          aria-valuemin={0}
          aria-valuemax={xpThreshold(change.afterLevel)}
          aria-valuenow={change.afterXp}
        >
          <i
            className="pve-experience-fill"
            style={{
              width: `${Math.max(0, Math.min(100, (100 * position.xp) / xpThreshold(position.level)))}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
export const PveResults = ({
  receipt,
  ready,
  equipped,
  onFinish,
}: {
  receipt: PveReceipt | null;
  ready: boolean;
  equipped: Equipment;
  onFinish: () => Promise<boolean>;
}) => {
  const { show } = useOverlays(),
    seen = useRef<string | null>(null);
  useEffect(() => {
    if (!receipt || !ready || seen.current === receipt.id) return;
    seen.current = receipt.id;
    const finish = () => {
      experience();
      void onFinish().then((ok) => {
        if (ok) show(null);
      });
    };
    const experience = () =>
      show({
        title: "Опыт фигур",
        onClose: finish,
        body: (
          <div id="pve-experience">
            <div className="pve-experience-list">
              {receipt.changes.map((change) => (
                <ExperienceRow
                  key={change.id}
                  change={change}
                  equipped={equipped}
                />
              ))}
            </div>
            <button className="primary wide" onClick={finish}>
              К карте
            </button>
          </div>
        ),
      });
    const rewards = () =>
      show({
        title: "Награда за бой",
        onClose: experience,
        body: (
          <div id="pve-reward">
            <div className="pve-reward-stats">
              <Stat value={receipt.coins} label="Монеты" />
              {receipt.stones > 0 && (
                <Stat value={receipt.stones} label="Камни опыта" />
              )}
              {receipt.cores > 0 && (
                <Stat value={receipt.cores} label="Ядро эволюции" />
              )}
            </div>
            {receipt.cores > 0 && receipt.first && (
              <p className="pve-unlock">Открыты уровень 5 и эволюция фигур.</p>
            )}
            <button className="primary wide" onClick={experience}>
              Далее
            </button>
          </div>
        ),
      });
    const reason = {
      king:
        receipt.outcome === "win"
          ? "Король соперника повержен"
          : "Ваш король повержен",
      checkmate:
        receipt.outcome === "win"
          ? "Мат королю соперника"
          : "Мат вашему королю",
      resigned: "Вы сдались",
      limit: "Достигнут лимит 120 ходов",
      repetition: "Троекратное повторение",
      "no-moves": "Нет доступных ходов",
    }[receipt.reason];
    show({
      title: { win: "Победа", loss: "Поражение", draw: "Ничья" }[
        receipt.outcome
      ],
      onClose: rewards,
      body: (
        <div id="pve-battle-result">
          <p>{reason}</p>
          <button className="primary wide" onClick={rewards}>
            Далее
          </button>
        </div>
      ),
    });
  }, [receipt, ready, equipped, onFinish, show]);
  return null;
};
