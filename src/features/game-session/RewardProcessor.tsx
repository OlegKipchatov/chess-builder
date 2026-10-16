import { useEffect } from "react";
import { useVault, useVaultStore } from "../../app/providers/VaultProvider.js";
import { applyQualityReward } from "../../domain/economy/reward-quality.js";
import { analyzeReward } from "../../services/engines/economy-analysis.js";
export const RewardProcessor = () => {
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
    void analyzeReward(entry, { signal: controller.signal })
      .then((quality) => {
        if (!controller.signal.aborted)
          return store.update((latest) =>
            applyQualityReward(latest, id, quality),
          );
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          void store.update((latest) =>
            applyQualityReward(latest, id, {
              status: "unavailable",
              diagnostics: error.diagnostics || [],
            }),
          );
      });
    return () => controller.abort();
  }, [id, store]);
  return null;
};
