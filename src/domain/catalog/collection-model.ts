import type { PieceSymbol } from "chess.js";
import type { VaultState } from "../chess/types.js";
import { TYPES, boardId, pieceId } from "./catalog.js";
import type { Equipment, ItemId, StyleId } from "./types.js";
export const presetEquipment = (style: StyleId): Equipment => ({
  pieces: Object.fromEntries(
    TYPES.map((type) => [type, pieceId(style, type)]),
  ) as Record<PieceSymbol, ItemId>,
  board: boardId(style),
});
export const canEquipPreset = (state: VaultState, style: StyleId) =>
  [...Object.values(presetEquipment(style).pieces), boardId(style)].every(
    (id) => state.owned.includes(id),
  );
