import type { Color } from "chess.js";
import type { Activity } from "../activity/types.js";
import type { GameAnalysis } from "../analysis/types.js";
import type { AutoAward } from "../autochess/types.js";
import type { Equipment, ItemId, SavedSet } from "../catalog/types.js";
import type { ArchivedEngineProfile } from "../cognitive/types.js";
import type { RewardBreakdown, RewardCheckpoint } from "../economy/types.js";
import type { HuntProgress } from "../hunt/types.js";
import type { PveProfile } from "../pve/types.js";
export interface Rating {
  value: number;
  games: number;
  lastDelta: number;
}
export interface RatingSnapshot {
  before: number;
  opponent: number;
  k: 32 | 64;
}
export type MatchMode = "bot" | "local";
export interface EngineFailure {
  fen: string;
  message: string;
}
export interface SavedGame {
  rewardCheckpoint?: RewardCheckpoint;
  pgn: string;
  mode: MatchMode;
  difficulty: "adaptive" | "easy" | "normal" | "hard";
  playerColor: Color;
  started: boolean;
  settled: boolean;
  resigned: boolean;
  rating?: RatingSnapshot | null;
  engineFailure?: EngineFailure | null;
  engineProfile?: ArchivedEngineProfile | null;
  startedAt?: string;
  equipped?: Equipment;
}
export interface ArchiveEntry {
  rewardCheckpoint?: RewardCheckpoint;
  analysis?: GameAnalysis;
  imported?: boolean;
  id: string;
  pgn: string;
  startedAt?: string;
  finishedAt: string;
  mode: MatchMode;
  playerColor: Color;
  equipped: Equipment;
  result: string;
  points: number;
  playerRating: number;
  opponentRating: number | null;
  ratingDelta: number | null;
  counted?: false;
  engineFailure?: EngineFailure | null;
  engineProfile: ArchivedEngineProfile | null;
  rewardBreakdown?: RewardBreakdown | null;
}
export interface VaultState {
  version: 3;
  pve: PveProfile;
  autochessAwards: Record<string, AutoAward>;
  hunt: HuntProgress;
  activity: Activity;
  archive: ArchiveEntry[];
  rating: Rating;
  settings: { mode: MatchMode; difficulty: SavedGame["difficulty"] };
  coins: number;
  shards: number;
  owned: ItemId[];
  equipped: Equipment;
  sets: SavedSet[];
  pity: number;
  played: number;
  opened: number;
  game: SavedGame;
}
