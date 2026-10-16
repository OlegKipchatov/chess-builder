import type { PieceSymbol } from "chess.js";
import type {
CollectionStyle,
Equipment,
Item,
ItemId,
Rarity,
StyleId,
} from "./types.js";
export const TYPES: PieceSymbol[] = ["k", "q", "r", "b", "n", "p"];
export const PIECE_NAMES = {
  k: "Король",
  q: "Ферзь",
  r: "Ладья",
  b: "Слон",
  n: "Конь",
  p: "Пешка",
};
export const STYLES: CollectionStyle[] = [
  {
    id: "classic",
    name: "Монохром",
    rarity: "base",
    accent: "#a6adad",
    light: "#cdd3bc",
    dark: "#718572",
  },
  {
    id: "sand",
    name: "Песчаник",
    rarity: "common",
    accent: "#cb965c",
    light: "#dfc9a8",
    dark: "#a07e57",
  },
  {
    id: "slate",
    name: "Графит",
    rarity: "common",
    accent: "#8196b2",
    light: "#bbc5cf",
    dark: "#667486",
  },
  {
    id: "ocean",
    name: "Глубина",
    rarity: "rare",
    accent: "#45c2e1",
    light: "#a0cbd5",
    dark: "#497b8d",
  },
  {
    id: "rose",
    name: "Розовый кварц",
    rarity: "rare",
    accent: "#dc84b4",
    light: "#dec2d1",
    dark: "#9b708b",
  },
  {
    id: "nebula",
    name: "Туманность",
    rarity: "epic",
    accent: "#b69afa",
    light: "#c9bce2",
    dark: "#796597",
  },
  {
    id: "aurora",
    name: "Северное сияние",
    rarity: "epic",
    accent: "#55d6b0",
    light: "#add4c6",
    dark: "#4d827d",
  },
  {
    id: "gold",
    name: "Золотая династия",
    rarity: "legendary",
    accent: "#eabe59",
    light: "#e8d5a7",
    dark: "#a58b51",
  },
];
export const rarityNames = {
  base: "Базовый",
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
};
export const pieceId = (style: StyleId, type: PieceSymbol): ItemId =>
  `piece:${style}:${type}`;
export const boardId = (style: StyleId): ItemId => `board:${style}`;
export const ITEMS: Item[] = STYLES.flatMap((style) => [
  ...TYPES.map((type) => ({
    id: pieceId(style.id, type),
    kind: "piece" as const,
    type,
    style: style.id,
    rarity: style.rarity,
    name: `${PIECE_NAMES[type]} · ${style.name}`,
  })),
  {
    id: boardId(style.id),
    kind: "board",
    style: style.id,
    rarity: style.rarity,
    name: `Доска · ${style.name}`,
  },
]);
export const itemById = (id: unknown) => ITEMS.find((item) => item.id === id);
export const styleById = (id: unknown) =>
  STYLES.find((style) => style.id === id) || STYLES[0];
export const defaultEquipment = (): Equipment => ({
  pieces: Object.fromEntries(
    TYPES.map((type) => [type, pieceId("classic", type)]),
  ) as Record<PieceSymbol, ItemId>,
  board: boardId("classic"),
});
export const baseInventory = () =>
  ITEMS.filter((item) => item.rarity === "base").map((item) => item.id);
export const COSTS: Partial<Record<Rarity, number>> = {
  common: 40,
  rare: 100,
  epic: 300,
  legendary: 750,
};
export const REFUNDS: Partial<Record<Rarity, number>> = {
  common: 8,
  rare: 20,
  epic: 60,
  legendary: 150,
};
export const craftCost = (item: Item) =>
  (COSTS[item.rarity] || 0) * (item.kind === "board" ? 2 : 1);
export const duplicateRefund = (item: Item) =>
  (REFUNDS[item.rarity] || 0) * (item.kind === "board" ? 2 : 1);
export const CHEST_COST = 100;
export const EMPTY_SHARDS = 15;
