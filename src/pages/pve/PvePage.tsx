import { useNavigate, useSearch } from "@tanstack/react-router";
import { ControlIcon } from "../../shared/ui/ControlIcon.js";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault, useVaultStore } from "../../app/providers/VaultProvider.js";
import { PIECE_NAMES, itemById } from "../../domain/catalog/catalog.js";
import { beginPveBattle, returnToMap } from "../../domain/pve/pve-battle.js";
import {
  activeArmy,
  damage,
  encounter,
  evolutionOptions,
  evolveUnit,
  maxHp,
  useStone as spendStone,
  strengthLabel,
  toggleUnit,
} from "../../domain/pve/pve-model.js";
import type {
  PveNode,
  PveProfile,
  PveReceipt,
  PveUnit,
} from "../../domain/pve/types.js";
import { PveArmy } from "../../features/pve/PveArmy.js";
import { PveBag } from "../../features/pve/PveBag.js";
import { PveBattleView } from "../../features/pve/PveBattleView.js";
import { PveIcon, type PveView } from "../../features/pve/PveIcons.js";
import { PveMap } from "../../features/pve/PveMap.js";
import { PveResults } from "../../features/pve/PveResults.js";
import { usePveBattle } from "../../features/pve/usePveBattle.js";
import { Page } from "../../shared/ui/Page.js";
import { Piece } from "../../shared/ui/Piece.js";
export const PvePage = () => {
  const search = useSearch({ from: "/pve" }),
    view = search.view,
    navigate = useNavigate(),
    [selectedNode, setSelectedNode] = useState<string | null>(null),
    [confirming, setConfirming] = useState(false),
    battle = usePveBattle(view === "battle" && !confirming),
    profile = battle.profile,
    store = useVaultStore(),
    equipped = useVault((state) => state.equipped),
    { show, toast } = useOverlays();
  const nav = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!nav.current) return;
    const node = nav.current;
    const resize = () =>
      document.documentElement.style.setProperty(
        "--nav-height",
        `${node.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
    return () => observer.disconnect();
  }, [view]);
  const go = useCallback(
    (next: PveView) => {
      void navigate({ to: "/pve", search: { view: next } });
    },
    [navigate],
  );
  const change = useCallback(
    async (transform: (profile: PveProfile) => PveProfile) => {
      const result = await store.update((state) => ({
        ...state,
        pve: transform(state.pve),
      }));
      if (!result.ok) toast(result.error.message);
      return result.ok;
    },
    [store, toast],
  );
  const finish = useCallback(async () => {
    const ok = await change(returnToMap);
    if (ok) {
      setSelectedNode(null);
      go("map");
    }
    return ok;
  }, [change, go]);
  const begin = async (node: PveNode) => {
    if (await change((profile) => beginPveBattle(profile, node.id))) {
      setSelectedNode(null);
      await navigate({ to: "/pve", search: { view: "battle" } });
      show(null);
    }
  };
  const preview = (node: PveNode) => {
    const enemy = encounter(profile, node),
      first = !profile.cleared.includes(node.id);
    setSelectedNode(node.id);
    show({
      title: node.name,
      onClose: () => setSelectedNode(null),
      body: (
        <>
          <p>{strengthLabel(enemy.ratio)}</p>
          <div className="pve-enemy-list">
            {enemy.units.map((unit) => (
              <div key={unit.id}>
                <span>
                  <Piece
                    type={unit.type}
                    color="b"
                    style={itemById(equipped.pieces[unit.type])?.style}
                  />
                </span>
                <span>
                  {PIECE_NAMES[unit.type]}
                  <small>ур. {unit.level}</small>
                </span>
              </div>
            ))}
          </div>
          <p className="pve-note">
            За победу: {node.boss ? "23–33 монеты" : "12–17 монет"} и 2–3 камня
            {node.boss ? ", 1 ядро эволюции" : ""}.
            {first &&
              ` Бонус первой победы: ${node.boss ? "10 монет, 3 камня и уровень 5" : node.bonus ? "6 монет и 2 камня" : "5 монет и 1 камень"}.`}
          </p>
          {activeArmy(profile).length !== 8 && (
            <p>Соберите 8 фигур в армии, чтобы начать бой.</p>
          )}
          <button
            className="primary pve-dialog-primary"
            disabled={activeArmy(profile).length !== 8 || !!profile.battle}
            onClick={() => void begin(node)}
          >
            Начать бой
          </button>
        </>
      ),
    });
  };
  const evolution = (unit: PveUnit) =>
    show({
      title: `Эволюция: ${PIECE_NAMES[unit.type]}`,
      body: (
        <>
          <p>Уровень {unit.level} и опыт сохранятся. Один шаг стоит 1 ядро.</p>
          {evolutionOptions(unit.type).map((type) => (
            <button
              key={type}
              className="primary pve-dialog-primary"
              onClick={() =>
                void change((profile) =>
                  evolveUnit(profile, unit.id, type),
                ).then((ok) => {
                  if (ok) {
                    show(null);
                    toast("Фигура эволюционировала. Уровень и опыт сохранены.");
                  }
                })
              }
            >
              {PIECE_NAMES[type]} · HP {maxHp(unit)} →{" "}
              {maxHp({ ...unit, type })} · урон {damage(unit)} →{" "}
              {damage({ ...unit, type })}
            </button>
          ))}
        </>
      ),
    });
  const resign = () => {
    setConfirming(true);
    show({
      title: "Завершить бой поражением?",
      onClose: () => setConfirming(false),
      body: (
        <>
          <p>
            {Math.ceil((profile.battle?.ply || 0) / 2) < 10
              ? "Монет не будет."
              : "Вы получите награду за поражение."}{" "}
            Вы получите 1 камень опыта. Опыт за побеждённые фигуры и штрафы
            погибшим сохранятся. Для продолжения позже можно приостановить бой.
          </p>
          <button
            className="danger pve-dialog-primary"
            onClick={() => {
              void battle.resign().then(() => setConfirming(false));
            }}
          >
            Сдаться
          </button>
        </>
      ),
    });
  };
  const receipt = battle.visual?.settled
    ? (battle.visual.result as PveReceipt)
    : null;
  return (
    <Page
      id="pve"
      title={view === "battle" ? "Бой · PvE" : "Поход"}
      onBack={view === "battle" ? () => go("map") : undefined}
      backLabel="К карте"
    >
      {view === "map" && (
        <PveMap
          profile={profile}
          selected={selectedNode}
          onNode={preview}
          onResume={() => go("battle")}
        />
      )}
      {view === "army" && (
        <PveArmy
          profile={profile}
          equipped={equipped}
          onToggle={(id) => void change((profile) => toggleUnit(profile, id))}
          onStone={(id) => void change((profile) => spendStone(profile, id))}
          onEvolve={evolution}
        />
      )}
      {view === "bag" && <PveBag profile={profile} />}
      {view === "battle" && (
        <>
          <PveBattleView
            battle={battle}
            equipped={equipped}
            onResign={resign}
          />
          <PveResults
            receipt={receipt}
            ready={battle.phase === "idle" && !confirming}
            equipped={equipped}
            onFinish={finish}
          />
          {!profile.battle && (
            <button onClick={() => go("map")}>К карте</button>
          )}
        </>
      )}
      {view !== "battle" && (
        <nav ref={nav} id="pve-nav" aria-label="Разделы похода">
          <button
            className="quiet pve-nav-exit"
            aria-label="Выйти из похода"
            onClick={() => void navigate({ to: "/play" })}
          >
            <ControlIcon name="back" />
          </button>
          {(["map", "army", "bag"] as const).map((target, index) => (
            <button
              key={target}
              className={`secondary ${view === target ? "active" : ""}`}
              aria-current={view === target ? "page" : undefined}
              onClick={() => go(target)}
            >
              <PveIcon kind={target} />
              <span>{["Карта", "Армия", "Рюкзак"][index]}</span>
            </button>
          ))}
        </nav>
      )}
    </Page>
  );
};
export default PvePage;
