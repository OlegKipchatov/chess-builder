import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault,useVaultStore } from "../../app/providers/VaultProvider.js";
import { CHEST_COST,rarityNames } from "../../domain/catalog/catalog.js";
import { openChest } from "../../domain/economy/economy.js";
import { useInventory } from "../../features/inventory/useInventory.js";
import { ItemPreview } from "../../shared/ui/ItemPreview.js";
import { Page } from "../../shared/ui/Page.js";
export const ChestsPage = () => {
  const coins = useVault((s) => s.coins),
    pity = useVault((s) => s.pity),
    store = useVaultStore(),
    { show, toast } = useOverlays(),
    inventory = useInventory(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false);
  const open = async () => {
    if (busy) return;
    setBusy(true);
    const result = await store.transact((state) => {
      const opened = openChest(state);
      return { state: opened?.state || state, value: opened?.result };
    });
    setBusy(false);
    if (!result.ok) {
      toast(result.error.message);
      return;
    }
    const reward = result.value;
    if (!reward) return;
    show({
      title: reward.item?.name || "Осколки",
      body: (
        <>
          <div
            className={`reward-reveal rarity-${reward.item?.rarity || "shards"}`}
          >
            {reward.item ? (
              <ItemPreview item={reward.item} />
            ) : (
              <span className="shard-symbol">◇</span>
            )}
            <p>{reward.item ? rarityNames[reward.item.rarity] : ""}</p>
            <strong>
              {reward.shards
                ? `+${reward.shards} осколков`
                : reward.duplicate
                  ? "Уже в коллекции"
                  : "Новый предмет"}
            </strong>
          </div>
          <div className="dialog-actions">
            {reward.item && !reward.duplicate && (
              <button
                className="primary"
                onClick={() =>
                  void inventory.equip(reward.item!).then((ok) => {
                    if (ok) show(null);
                  })
                }
              >
                Использовать
              </button>
            )}
            <button
              onClick={() => {
                show(null);
                void navigate({ to: "/collection" });
              }}
            >
              Коллекция
            </button>
            <button onClick={() => show(null)}>Готово</button>
          </div>
        </>
      ),
    });
  };
  return (
    <Page id="chests" title="Сундуки">
      <div className="chest-layout">
        <article className="chest-card">
          <div className="chest-symbol" aria-hidden="true">
            ▣
          </div>
          <h2>Сундук коллекционера</h2>
          <p>Новые фигуры, доски или осколки для создания предметов.</p>
          <button
            id="open-chest"
            className="primary"
            disabled={busy || coins < CHEST_COST}
            onClick={() => void open()}
          >
            {coins < CHEST_COST
              ? `Не хватает ${CHEST_COST - coins} монет`
              : `Открыть · ${CHEST_COST} ◈`}
          </button>
          <div className="pity-meter">
            <span>Гарантия эпического предмета</span>
            <progress value={pity} max={9} />
            <small>{pity} / 9</small>
          </div>
        </article>
      </div>
    </Page>
  );
};
export default ChestsPage;
