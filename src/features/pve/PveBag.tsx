import type { PveProfile } from "../../domain/pve/types.js";
import { PveIcon } from "./PveIcons.js";
export const PveBag = ({ profile }: { profile: PveProfile }) => (
  <div className="pve-page">
    <div className="pve-resource">
      <span>
        <PveIcon kind="stone" />
      </span>
      <div>
        <h2>Камни опыта · {profile.stones}</h2>
        <p>Добавляют фигуре 10% порога опыта её уровня.</p>
      </div>
    </div>
    <div className="pve-resource">
      <span>
        <PveIcon kind="core" />
      </span>
      <div>
        <h2>Ядра эволюции · {profile.cores}</h2>
        <p>
          Один шаг эволюции: пешка → конь или слон → ладья → ферзь. Уровень и
          опыт сохраняются.
        </p>
      </div>
    </div>
  </div>
);
