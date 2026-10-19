import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVaultStore } from "../../app/providers/VaultProvider.js";
import type { Equipment, Item } from "../../domain/catalog/types.js";
import { craftItem } from "../../domain/economy/economy.js";
export const useInventory = () => {
  const store = useVaultStore(),
    { toast } = useOverlays();
  const commit = async (transform: Parameters<typeof store.update>[0]) => {
    const result = await store.update(transform);
    if (!result.ok) toast(result.error.message, { type: "error" });
    return result.ok;
  };
  return {
    equip: (item: Item) =>
      commit((state) =>
        !state.owned.includes(item.id)
          ? state
          : {
              ...state,
              equipped:
                item.kind === "board"
                  ? { ...state.equipped, board: item.id }
                  : {
                      ...state.equipped,
                      pieces: {
                        ...state.equipped.pieces,
                        [item.type]: item.id,
                      },
                    },
            },
      ),
    equipSet: (equipped: Equipment) =>
      commit((state) =>
        [...Object.values(equipped.pieces), equipped.board].every((id) =>
          state.owned.includes(id),
        )
          ? { ...state, equipped: structuredClone(equipped) }
          : state,
      ),
    craft: (item: Item) =>
      commit((state) => craftItem(state, item.id) || state),
    save: (name: string) =>
      commit((state) =>
        state.sets.length >= 12 || !name.trim()
          ? state
          : {
              ...state,
              sets: [
                ...state.sets,
                {
                  ...structuredClone(state.equipped),
                  id: crypto.randomUUID(),
                  name: name.trim().slice(0, 32),
                },
              ],
            },
      ),
    remove: (id: string) =>
      commit((state) => ({
        ...state,
        sets: state.sets.filter((set) => set.id !== id),
      })),
  };
};
