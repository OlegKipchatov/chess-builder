import { useEffect, useReducer, useRef, useState } from "react";
import type {
  QualitySummary,
  QualityFailure,
} from "../../domain/economy/types.js";
import { useVault, useVaultStore } from "../../app/providers/VaultProvider.js";
import { applyQualityReward } from "../../domain/economy/reward-quality.js";
import { analyzeReward } from "../../services/engines/economy-analysis.js";
export const RewardProcessor = () => {
  const cached = useRef<{
      id: string;
      quality: QualitySummary | QualityFailure;
    } | null>(null),
    [failedId, setFailedId] = useState<string | null>(null),
    [retry, retrySave] = useReducer((value: number) => value + 1, 0);
  const store = useVaultStore(),
    id = useVault(
      (state) =>
        state.archive.find((entry) =>
          ["pending", "unavailable"].includes(
            entry.rewardBreakdown?.qualityStatus || "",
          ),
        )?.id,
    );
  useEffect(() => {
    if (!id) return;
    const entry = store.getSnapshot().archive.find((entry) => entry.id === id);
    if (!entry) return;
    const controller = new AbortController();
    setFailedId(null);
    const process = async () => {
      let quality = cached.current?.id === id ? cached.current.quality : null;
      if (!quality) {
        try {
          quality = await analyzeReward(entry, { signal: controller.signal });
        } catch (cause) {
          const failure = cause as {
            diagnostics?: QualityFailure["diagnostics"];
          } | null;
          quality = {
            status: "unavailable",
            diagnostics: failure?.diagnostics || [],
          };
        }
      }
      if (controller.signal.aborted) return;
      cached.current = { id, quality };
      const result = await store.update((latest) =>
        controller.signal.aborted
          ? latest
          : applyQualityReward(latest, id, quality),
      );
      if (controller.signal.aborted) return;
      if (!result.ok) setFailedId(id);
      else if (cached.current?.id === id) cached.current = null;
    };
    void process();
    return () => controller.abort();
  }, [id, store, retry]);
  return failedId && failedId === id ? (
    <div role="alert">
      <p>Не удалось сохранить бонус за качество игры.</p>
      <button
        className="quiet"
        onClick={() => {
          setFailedId(null);
          retrySave();
        }}
      >
        Повторить сохранение бонуса
      </button>
    </div>
  ) : null;
};
