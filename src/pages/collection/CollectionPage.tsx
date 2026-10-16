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
import { Piece } from "../../shared/ui/Piece.js";
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
  const rows = useRef(new Map<ItemId, HTMLElement>());
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
  const jump = (id: ItemId) => {
    const item = itemById(id);
    if (!item) return;
    setView("items");
    setType(item.kind === "board" ? "board" : item.type);
    if (!owned.includes(id)) setOnlyOwned(false);
    setTarget(id);
  };
  const preview = (ids: ItemId[]) =>
    ids.map((id) => {
      const item = itemById(id)!;
      return (
        <button
          key={id}
          className={`preset-part ${owned.includes(id) ? "" : "missing"}`}
          aria-label={`Открыть: ${item.name}`}
          onClick={() => jump(id)}
        >
          {item.kind === "piece" ? (
            <Piece type={item.type} color="w" style={item.style} />
          ) : (
            <ItemPreview item={item} />
          )}
        </button>
      );
    });
  return (
    <Page id="collection" title="Коллекция">
      <article className="equipment-strip">
        <div className="strip-label">
          <p className="eyebrow">Выбранный набор</p>
          <button
            className="text-button"
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
            Сохранить набор
          </button>
        </div>
        <nav className="equipment-slots" aria-label="Тип предмета">
          {[...TYPES, "board" as const].map((slot) => {
            const item = itemById(
                slot === "board" ? equipped.board : equipped.pieces[slot],
              )!,
              label = slot === "board" ? "Доска" : PIECE_NAMES[slot];
            return (
              <button
                key={slot}
                className={`equipment-slot ${view === "items" && type === slot ? "active" : ""}`}
                aria-label={`Настроить: ${label}`}
                aria-pressed={view === "items" && type === slot}
                onClick={() => jump(item.id)}
              >
                {item.kind === "piece" ? (
                  <Piece type={item.type} color="w" style={item.style} />
                ) : (
                  <ItemPreview item={item} />
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </article>
      <div className="collection-toolbar">
        <div className="segmented" role="group" aria-label="Раздел коллекции">
          {(["sets", "items", "saved"] as const).map((key, i) => (
            <button
              key={key}
              data-collection-view={key}
              className={key === view ? "active" : ""}
              aria-pressed={key === view}
              onClick={() => setView(key)}
            >
              {["Коллекции", "Фигуры и доски", "Мои наборы"][i]}
            </button>
          ))}
        </div>
        <span className="muted">
          {owned.length}/{ITEMS.length} предметов
        </span>
      </div>
      <div className="collection-content-group">
        {view === "sets" && (
          <div className="collection-list">
            {STYLES.map((style) => {
              const ids = [
                  ...TYPES.map((t) => pieceId(style.id, t)),
                  boardId(style.id),
                ],
                total = ids.filter((id) => owned.includes(id)).length,
                active = sameEquipment(equipped, presetEquipment(style.id));
              return (
                <article
                  key={style.id}
                  className={`collection-row rarity-row rarity-${style.rarity} ${active ? "equipped" : ""}`}
                >
                  <div className="collection-name">
                    <h3>{style.name}</h3>
                    <span className="sr-only">{rarityNames[style.rarity]}</span>
                  </div>
                  <div className="collection-pieces">{preview(ids)}</div>
                  <div className="collection-action">
                    <span>{total} из 7</span>
                    {total === 7 && (
                      <button
                        data-preset={style.id}
                        className={active ? "equipped-button" : ""}
                        disabled={active}
                        onClick={() =>
                          void inventory.equipSet(presetEquipment(style.id))
                        }
                      >
                        {active ? "Выбрано" : "Выбрать"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {view === "items" && (
          <>
            <div className="catalog-heading">
              <h3>{type === "board" ? "Доски" : PIECE_NAMES[type]}</h3>
              <button
                className="filter-toggle"
                data-owned-only
                aria-pressed={onlyOwned}
                onClick={() => setOnlyOwned(!onlyOwned)}
              >
                Только полученные
              </button>
            </div>
            <div className="collection-items-list">
              {ITEMS.filter(
                (item) =>
                  (type === "board"
                    ? item.kind === "board"
                    : item.kind === "piece" && item.type === type) &&
                  (!onlyOwned || owned.includes(item.id)),
              ).map((item) => (
                <article
                  key={item.id}
                  ref={(node) => {
                    if (node) rows.current.set(item.id, node);
                    else rows.current.delete(item.id);
                  }}
                  tabIndex={-1}
                  className={`compact-item rarity-row rarity-${item.rarity} ${isEquipped(item) ? "equipped" : ""} ${target === item.id ? "navigation-target" : ""}`}
                >
                  <div className="compact-item-art">
                    <ItemPreview item={item} />
                  </div>
                  <div className="compact-item-copy">
                    <span className="sr-only">{rarityNames[item.rarity]}</span>
                    <h3>
                      {STYLES.find((style) => style.id === item.style)?.name}
                    </h3>
                    <span className="sr-only">
                      {owned.includes(item.id) ? "В коллекции" : "Не получен"}
                    </span>
                  </div>
                  <button
                    data-equip={owned.includes(item.id) ? item.id : undefined}
                    data-craft={!owned.includes(item.id) ? item.id : undefined}
                    className={isEquipped(item) ? "equipped-button" : ""}
                    disabled={
                      isEquipped(item) ||
                      (!owned.includes(item.id) && shards < craftCost(item))
                    }
                    onClick={() => {
                      if (owned.includes(item.id)) void inventory.equip(item);
                      else
                        show({
                          title: `Создать ${item.name}?`,
                          body: (
                            <>
                              <ItemPreview item={item} />
                              <p>Стоимость: {craftCost(item)} осколков.</p>
                              <button
                                className="primary wide"
                                onClick={() =>
                                  void inventory.craft(item).then((ok) => {
                                    if (ok) show(null);
                                  })
                                }
                              >
                                Создать · {craftCost(item)} ✧
                              </button>
                            </>
                          ),
                        });
                    }}
                  >
                    {isEquipped(item)
                      ? "Выбрано"
                      : owned.includes(item.id)
                        ? "Выбрать"
                        : `Создать · ${craftCost(item)} ✧`}
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        {view === "saved" && (
          <>
            <h2>Мои наборы {sets.length}/12</h2>
            <div className="collection-list">
              {!sets.length && (
                <p className="empty-state">
                  Сохраните текущие фигуры и доску как отдельный набор.
                </p>
              )}
              {sets.map((set) => {
                const active = sameEquipment(equipped, set);
                return (
                  <article
                    className={`collection-row ${active ? "equipped" : ""}`}
                    key={set.id}
                  >
                    <div className="collection-name">
                      <h3>{set.name}</h3>
                    </div>
                    <div className="collection-pieces">
                      {preview([
                        ...TYPES.map((type) => set.pieces[type]),
                        set.board,
                      ])}
                    </div>
                    <div className="collection-action">
                      <button
                        data-load-set={set.id}
                        className={active ? "equipped-button" : ""}
                        disabled={active}
                        onClick={() => void inventory.equipSet(set)}
                      >
                        {active ? "Выбрано" : "Выбрать"}
                      </button>
                      <button
                        className="delete-set icon-button"
                        data-delete-set={set.id}
                        aria-label={`Удалить набор ${set.name}`}
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
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6" />
                        </svg>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Page>
  );
};
export default CollectionPage;
