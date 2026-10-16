import type { PieceSymbol } from "chess.js";
export type Rarity = "base" | "common" | "rare" | "epic" | "legendary";
export type StyleId =
  | "classic"
  | "sand"
  | "slate"
  | "ocean"
  | "rose"
  | "nebula"
  | "aurora"
  | "gold";
export type ItemId = `piece:${StyleId}:${PieceSymbol}` | `board:${StyleId}`;
export interface CollectionStyle {
  id: StyleId;
  name: string;
  rarity: Rarity;
  accent: string;
  light: string;
  dark: string;
}
interface ItemBase {
  id: ItemId;
  name: string;
  style: StyleId;
  rarity: Rarity;
}
export type Item =
  | (ItemBase & { kind: "piece"; type: PieceSymbol })
  | (ItemBase & { kind: "board" });
export interface Equipment {
  pieces: Record<PieceSymbol, ItemId>;
  board: ItemId;
}
export interface SavedSet extends Equipment {
  id: string;
  name: string;
}
