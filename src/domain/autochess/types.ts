import type { Color,PieceSymbol } from "chess.js";
import type { Outcome } from "../pve/types.js";
export interface AutoPiece {
  id: string;
  type: PieceSymbol;
  square: string | null;
  benched?: boolean;
  paid?: number;
  reserveSlot?: number;
}
export interface AutoResult {
  winner: Color | null;
  reason: string;
}
export interface RoundResult extends AutoResult {
  incomeRule?: number;
  shopLevel?: number;
  battleId: string;
  outcome: Outcome;
}
export interface AutoBattle {
  id: string;
  initialFen: string;
  moves: string[];
  elapsed: number;
  profile: string;
  result: AutoResult | null;
}
export interface ShopProgress {
  reserve: number;
  level: number;
  purchases: number;
  sales?: number;
  income?: number;
  openingBalance?: number;
  strategy?: number;
}
export interface AutoShop {
  version: number;
  phase: "preparation" | "paused" | "result";
  army: AutoPiece[];
  reserve: number;
  level: number;
  purchases: number;
  sales: number;
  nextId: number;
  seed: string;
  saleLoss?: number;
  legacyReserveOverflow?: boolean;
}
export interface AutoRun extends AutoShop {
  seriesGoal?: { wins: number; losses: number };
  reserveRule?: number;
  id: string;
  round: number;
  color: Color;
  opponent: AutoPiece[];
  opponentProgress?: ShopProgress;
  opponentSetupVersion?: number;
  battle: AutoBattle | null;
  results: RoundResult[];
}
export interface AutoAward {
  coins: number;
  outcome: Outcome;
  reason: string;
}
export interface BeamState {
  reserve: number;
  level: number;
  purchases: number;
  troops: { value: number; paid: number }[];
  score: number;
  first: "buy" | "upgrade" | "save" | null;
}
