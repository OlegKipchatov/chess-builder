import type { SearchDiagnostic } from "../../shared/types/engine.js";
import type { Item } from "../catalog/types.js";
export type DecisionQuality =
  "best" | "good" | "inaccuracy" | "mistake" | "blunder";
export type QualityDecision =
  { forced: true; loss?: never } | { forced?: false; loss: number };
export interface QualitySummary {
  status: "complete";
  total: number;
  accuracy: number;
  stability: number;
  best: number;
  counts: Record<DecisionQuality, number>;
  eligibleMoves: number;
  profile: string;
  diagnostics?: SearchDiagnostic[];
}
export interface QualityFailure {
  status: "unavailable";
  diagnostics?: SearchDiagnostic[];
}
export interface RewardBreakdown {
  cleanMoves: number;
  completion: number;
  moves: number;
  result: number;
  outcome: "win" | "loss" | "draw";
  reason: "unfinished" | "early-resignation" | "legacy-local" | null;
  quality: number;
  qualityStatus:
    "ineligible" | "pending" | "unavailable" | "complete" | "fallback";
  rewardVersion: string;
  total: number;
  qualityDetails?: QualitySummary | null;
  qualityDiagnostics?: SearchDiagnostic[];
}
export interface ChestReward {
  kind: "shards" | "piece" | "board";
  item: Item | null;
  duplicate: boolean;
  shards: number;
  pity: number;
}
