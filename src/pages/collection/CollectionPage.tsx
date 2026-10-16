import type { PieceSymbol } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault } from "../../app/providers/VaultProvider.js";
import {
  ITEMS,
  PIECE_NAMES,
  STYLES,
  TYPES,
  boardId,
  craftCost,
  itemById,
  pieceId,
  rarityNames,
} from "../../domain/catalog/catalog.js";
import { presetEquipment } from "../../domain/catalog/collection-model.js";
import type { Equipment, Item, ItemId } from "../../domain/catalog/types.js";
import { useInventory } from "../../features/inventory/useInventory.js";
import { ItemPreview } from "../../shared/ui/ItemPreview.js";
import { Page } from "../../shared/ui/Page.js";
const sameEquipment = (a: Equipment, b: Equipment) =>
  a.board === b.board &&
  TYPES.every((type) => a.pieces[type] === b.pieces[type]);
const SaveForm = ({ save }: { save: (name: string) => void }) => {
  const [name, setName] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save(name);
      }}
    >
      <label>
        Название набора
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          required
        />
      </label>
      <button className="primary wide" type="submit">
        Сохранить
      </button>
    </form>
  );
};
export const CollectionPage = () => {
  const owned = useVault((s) => s.owned),
    equipped = useVault((s) => s.equipped),
    sets = useVault((s) => s.sets),
    shards = useVault((s) => s.shards),
    { show } = useOverlays(),
    inventory = useInventory();
  const [view, setView] = useState<"sets" | "items" | "saved">("sets"),
    [type, setType] = useState<PieceSymbol | "board">("k"),
    [onlyOwned, setOnlyOwned] = useState(false),
    [target, setTarget] = useState<ItemId | null>(null);
  const rows = useRef(new Map<ItemId, HTMLDivElement>());
  useEffect(() => {
    if (!target || view !== "items") return;
    const frame = requestAnimationFrame(() => {
      const node = rows.current.get(target);
      node?.scrollIntoView({ block: "center", behavior: "instant" });
      node?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [target, view, type]);
  const isEquipped = (item: Item) =>
    item.kind === "board"
      ? equipped.board === item.id
      : equipped.pieces[item.type] === item.id;
  const open = (item: Item) =>
    show({
      title: item.name,
      body: (
        <>
          <ItemPreview item={item} />
          <p>{rarityNames[item.rarity]}</p>
          {owned.includes(item.id) ? (
            <button
              className="primary wide"
              disabled={isEquipped(item)}
              onClick={() =>
                void inventory.equip(item).then((ok) => {
                  if (ok) show(null);
                })
              }
            >
              {isEquipped(item) ? "Выбрано" : "Использовать"}
            </button>
          ) : (
            <>
              <p>Создать за {craftCost(item)} осколков</p>
              <button
                className="primary wide"
                disabled={shards < craftCost(item)}
                onClick={() =>
                  void inventory.craft(item).then((ok) => {
                    if (ok) show(null);
                  })
                }
              >
                Создать · {craftCost(item)} ✧
              </button>
            </>
          )}
        </>
      ),
    });
  const jump = (id: ItemId) => {
    const item = itemById(id);
    if (!item) return;
    setView("items");
    setType(item.kind === "board" ? "board" : item.type);
    if (!owned.includes(id)) setOnlyOwned(false);
    setTarget(id);
  };
  return (
    <Page id="collection" title="Коллекция">
      <div className="equipment-strip">
        <div className="strip-label">
          <span>Выбрано</span>
          <button
            disabled={sets.length >= 12}
            onClick={() =>
              show({
                title: "Сохранить набор",
                body: (
                  <SaveForm
                    save={(name) =>
                      void inventory.save(name).then((ok) => {
                        if (ok) show(null);
                      })
                    }
                  />
                ),
              })
            }
          >
            Сохранить
          </button>
        </div>
        <div className="equipment-slots">
          {[...TYPES.map((t) => equipped.pieces[t]), equipped.board].map(
            (id) => (
              <button
                className="equipment-slot"
                key={id}
                onClick={() => jump(id)}
                aria-label={itemById(id)?.name}
              >
                <ItemPreview item={itemById(id)!} />
              </button>
            ),
          )}
        </div>
      </div>
      <div className="collection-toolbar segmented">
        {(["sets", "items", "saved"] as const).map((key, i) => (
          <button
            key={key}
            aria-pressed={key === view}
            onClick={() => setView(key)}
          >
            {["Наборы", "Предметы", "Сохранённые"][i]}
          </button>
        ))}
      </div>
      {view === "sets" && (
        <div className="collection-items-list">
          {STYLES.map((style) => {
            const ids = [
                ...TYPES.map((t) => pieceId(style.id, t)),
                boardId(style.id),
              ],
              complete = ids.every((id) => owned.includes(id)),
              active = sameEquipment(equipped, presetEquipment(style.id));
            return (
              <div
                key={style.id}
                className={`collection-row rarity-row rarity-${style.rarity} ${active ? "equipped" : ""}`}
              >
                <div className="collection-name">
                  <strong>{style.name}</strong>
                  <small>
                    {rarityNames[style.rarity]} ·{" "}
                    {ids.filter((id) => owned.includes(id)).length}/7
                  </small>
                </div>
                <div className="collection-pieces">
                  {ids.map((id) => (
                    <button
                      key={id}
                      className={`compact-item ${owned.includes(id) ? "" : "missing"}`}
                      aria-label={itemById(id)?.name}
                      onClick={() => jump(id)}
                    >
                      <ItemPreview item={itemById(id)!} />
                    </button>
                  ))}
                </div>
                <button
                  className="collection-action"
                  disabled={!complete || active}
                  onClick={() =>
                    void inventory.equipSet(presetEquipment(style.id))
                  }
                >
                  {active ? "Выбрано" : "Выбрать"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {view === "items" && (
        <>
          <div className="catalog-heading">
            <div className="segmented">
              {[...TYPES, "board" as const].map((t) => (
                <button
                  key={t}
                  aria-pressed={t === type}
                  onClick={() => setType(t)}
                >
                  {t === "board" ? "Доски" : PIECE_NAMES[t]}
                </button>
              ))}
            </div>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={onlyOwned}
                onChange={(e) => setOnlyOwned(e.target.checked)}
              />{" "}
              Только мои
            </label>
          </div>
          <div className="collection-items-list">
            {ITEMS.filter(
              (item) =>
                (type === "board"
                  ? item.kind === "board"
                  : item.kind === "piece" && item.type === type) &&
                (!onlyOwned || owned.includes(item.id)),
            ).map((item) => (
              <div
                key={item.id}
                ref={(node) => {
                  if (node) rows.current.set(item.id, node);
                  else rows.current.delete(item.id);
                }}
                tabIndex={-1}
                className={`collection-row rarity-row rarity-${item.rarity} ${isEquipped(item) ? "equipped" : ""} ${target === item.id ? "collection-target" : ""}`}
              >
                <ItemPreview item={item} />
                <div className="collection-name">
                  <strong>{item.name}</strong>
                  <small>{rarityNames[item.rarity]}</small>
                </div>
                <button disabled={isEquipped(item)} onClick={() => open(item)}>
                  {isEquipped(item)
                    ? "Выбрано"
                    : owned.includes(item.id)
                      ? "Выбрать"
                      : `Создать · ${craftCost(item)} ✧`}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {view === "saved" && (
        <div>
          {sets.length === 0 && (
            <p className="empty-state">
              Сохраните выбранные предметы в свой набор.
            </p>
          )}
          {sets.map((set) => (
            <div
              className={`collection-row ${sameEquipment(equipped, set) ? "equipped" : ""}`}
              key={set.id}
            >
              <strong>{set.name}</strong>
              <div className="collection-pieces">
                {[...TYPES.map((type) => set.pieces[type]), set.board].map(
                  (id) => (
                    <span key={id} className="compact-item">
                      <ItemPreview item={itemById(id)!} />
                    </span>
                  ),
                )}
              </div>
              <button
                disabled={sameEquipment(equipped, set)}
                onClick={() => void inventory.equipSet(set)}
              >
                {sameEquipment(equipped, set) ? "Выбрано" : "Выбрать"}
              </button>
              <button
                aria-label={`Удалить ${set.name}`}
                onClick={() =>
                  show({
                    title: "Удалить набор?",
                    body: (
                      <button
                        className="danger wide"
                        onClick={() =>
                          void inventory.remove(set.id).then((ok) => {
                            if (ok) show(null);
                          })
                        }
                      >
                        Удалить
                      </button>
                    ),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
};
export default CollectionPage;
