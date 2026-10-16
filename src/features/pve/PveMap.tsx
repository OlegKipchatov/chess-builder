import {
  NODES,
  frontier,
  campaignComplete,
  isUnlocked,
} from "../../domain/pve/pve-model.js";
import type { PveNode, PveProfile } from "../../domain/pve/types.js";
export const PveMap = ({
  profile,
  selected,
  onNode,
  onResume,
}: {
  profile: PveProfile;
  selected: string | null;
  onNode: (node: PveNode) => void;
  onResume: () => void;
}) => (
  <div className="pve-page pve-map">
    <div className="pve-chapter">
      <div>
        <span className="pve-eyebrow">Глава I</span>
        <h2>Дорога к крепости</h2>
      </div>
      <span className="pve-meta">
        {campaignComplete(profile)
          ? "Пройдена"
          : `${Math.min(5, frontier(profile) - 1)} / 6 этапов`}
      </span>
    </div>
    {profile.battle && (
      <button className="primary" onClick={onResume}>
        {profile.battle.phase === "result" ? "Результат боя" : "Продолжить бой"}
      </button>
    )}
    <p className="pve-note">
      {campaignComplete(profile)
        ? "Страж побеждён. Открыт уровень 5 и первая эволюция. Можно вернуться к любому бою."
        : "Выберите бой на дороге. Победы открывают путь, босс — новые уровни армии."}
    </p>
    <div className="pve-road">
      <svg
        className="pve-road-line"
        viewBox="0 0 400 720"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M155 55C155 115 250 105 250 170S200 240 200 295 250 335 250 415 155 465 155 530 200 600 200 665" />
      </svg>
      <ol className="pve-stops" aria-label="Карта первой главы">
        {Array.from({ length: 6 }, (_, i) => i + 1).map((step) => (
          <li
            key={step}
            className={`pve-stop ${step === 3 ? "pve-fork" : ""}`}
            data-pve-step={step}
          >
            {NODES.filter((node) => node.step === step).map((node) => {
              const cleared = profile.cleared.includes(node.id),
                open = isUnlocked(profile, node),
                current =
                  step === frontier(profile) && !campaignComplete(profile);
              return (
                <button
                  key={node.id}
                  data-pve-node={node.id}
                  className={`pve-node ${cleared ? "is-cleared" : ""} ${current ? "is-frontier" : ""} ${node.boss ? "is-boss" : ""} ${selected === node.id ? "is-selected" : ""}`}
                  disabled={!open || !!profile.battle}
                  aria-label={`${node.name}${cleared ? ", пройдено, доступен повторный бой" : open ? ", бой доступен" : ", путь закрыт"}`}
                  aria-pressed={selected === node.id}
                  aria-current={current ? "step" : undefined}
                  onClick={() => onNode(node)}
                >
                  <span className="pve-node-number" aria-hidden="true">
                    {cleared ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6M8 12l3 3 5-6" />
                      </svg>
                    ) : node.boss ? (
                      "♜"
                    ) : (
                      step
                    )}
                  </span>
                  <span className="pve-node-body">
                    <span className="pve-eyebrow">
                      {node.boss
                        ? "Босс I"
                        : `Монстры · уровень ${node.threat}`}
                    </span>
                    <strong>{node.name}</strong>
                    <span className="pve-meta">
                      {!open
                        ? "Путь закрыт"
                        : cleared
                          ? ""
                          : step === 3
                            ? "Выберите один путь"
                            : "Бой доступен"}
                    </span>
                    <span className="pve-node-reward">
                      {node.boss ? "23–33 монеты" : "12–17 монет"}
                      {!cleared ? " · бонус" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </li>
        ))}
      </ol>
    </div>
  </div>
);
