import { Piece } from "../../shared/ui/Piece.js";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault, useVaultStore } from "../../app/providers/VaultProvider.js";
import { CHEST_COST, rarityNames } from "../../domain/catalog/catalog.js";
import { openChest } from "../../domain/economy/economy.js";
import { useInventory } from "../../features/inventory/useInventory.js";
import { ItemPreview } from "../../shared/ui/ItemPreview.js";
import { Page, plural } from "../../shared/ui/Page.js";
export const ChestsPage = () => {
  const coins = useVault((s) => s.coins),
    pity = useVault((s) => s.pity),
    store = useVaultStore(),
    { show, toast } = useOverlays(),
    inventory = useInventory(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    pending = useRef(false),
    mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const open = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const result = await store.transact((state) => {
      const opened = openChest(state);
      return { state: opened?.state || state, value: opened?.result };
    });
    pending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (!result.ok) {
      toast(result.error.message);
      return;
    }
    const reward = result.value;
    if (!reward) return;
    const title = !reward.item
      ? "Осколки"
      : reward.duplicate
        ? "Предмет уже в коллекции"
        : "Новый предмет!";
    const copy = !reward.item
      ? "В сундуке — осколки. Их можно потратить на нужную фигуру или доску."
      : reward.duplicate
        ? "Повтор превратился в осколки. Ваш предмет остаётся в коллекции."
        : "Предмет добавлен в коллекцию.";
    show({
      title,
      titleHidden: true,
      body: (
        <>
          <div
            className={`reward-content reward-${reward.shards ? "shards" : reward.item?.rarity || "shards"}`}
          >
            <p className="eyebrow">{title}</p>
            <div className="result-art reveal">
              {reward.item ? (
                <ItemPreview item={reward.item} />
              ) : (
                <div className="shard-reveal">✧</div>
              )}
            </div>
            {reward.item && (
              <>
                <span className={`rarity ${reward.item.rarity}`}>
                  {rarityNames[reward.item.rarity]}
                </span>
                <h2>{reward.item.name}</h2>
              </>
            )}
            {reward.shards > 0 && (
              <h2>
                +{reward.shards}{" "}
                {plural(reward.shards, ["осколок", "осколка", "осколков"])}
              </h2>
            )}
            <p>{copy}</p>
          </div>
          {reward.item && !reward.duplicate && (
            <div className="chest-reward-actions">
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
              <button
                className="quiet"
                onClick={() => {
                  show(null);
                  void navigate({
                    to: "/collection",
                    search: { item: reward.item!.id },
                  });
                }}
              >
                В коллекцию
              </button>
            </div>
          )}
        </>
      ),
    });
  };
  return (
    <Page id="chests" title="Сундуки">
      <div className="chest-layout">
        <article className="chest-card">
          <div className="chest-symbol" aria-hidden="true">
            <Piece type="q" color="w" style="gold" />
          </div>
          <h2>Сундук</h2>
          <button
            id="open-chest"
            className="primary stable-label"
            data-size-label="Не хватает 100 монет"
            data-size-alt="Не хватает 21 монеты"
            disabled={busy || coins < CHEST_COST}
            onClick={() => void open()}
          >
            <span className="control-label">
              {coins < CHEST_COST
                ? `Не хватает ${CHEST_COST - coins} ${plural(CHEST_COST - coins, ["монеты", "монет", "монет"])}`
                : `Открыть за ${CHEST_COST} ◈`}
            </span>
          </button>
          <div className="pity-meter">
            <span>
              Эпический или легендарный предмет — максимум через {10 - pity}{" "}
              сундуков
            </span>
            <progress value={pity} max={10} aria-label="Прогресс гарантии" />
            <small>{pity} / 10</small>
          </div>
        </article>
      </div>
    </Page>
  );
};
export default ChestsPage;
