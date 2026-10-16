import type { Color, PieceSymbol } from "chess.js";
export type Outcome = "win" | "loss" | "draw";
export interface PveUnit {
  id: string;
  type: PieceSymbol;
  level: number;
  xp: number;
  deaths: number;
  active: boolean;
}
export interface CombatUnit {
  id: string;
  type: PieceSymbol;
  level: number;
  color: Color;
  square: string;
  hp: number;
  moved: boolean;
}
export interface UnitStats {
  type: PieceSymbol;
  level: number;
  hp?: number;
}
export interface EnemyUnit {
  id: string;
  type: PieceSymbol;
  level: number;
}
export interface PveNode {
  id: string;
  step: number;
  threat: number;
  name: string;
  minPower: number;
  maxPower: number;
  ratio: number;
  composition: "mixed" | "knights" | "rooks" | "bishops";
  bonus?: boolean;
  boss?: boolean;
}
export interface PveAction {
  from: string;
  to: string;
}
export interface CombatEvent extends PveAction {
  attackerId: string;
  targetId: string | null;
  targetSquare: string | null;
  enPassant: boolean;
  damage: number;
  killed: boolean;
  moved: boolean;
  promoted: boolean;
}
export type PveReason =
  "king" | "checkmate" | "resigned" | "limit" | "repetition" | "no-moves";
export interface CombatResult {
  outcome: Outcome;
  reason: PveReason;
}
export interface UnitChange {
  id: string;
  type: PieceSymbol;
  square: string;
  beforeLevel: number;
  afterLevel: number;
  beforeXp: number;
  afterXp: number;
  earned: number;
  penalty: number;
  died: boolean;
}
export interface PveReceipt extends CombatResult {
  id: string;
  nodeId: string;
  coins: number;
  stones: number;
  cores: number;
  bonusCoins: number;
  bonusStones: number;
  first: boolean;
  levelCap: number;
  changes: UnitChange[];
  plies: number;
  finishedAt: string;
}
export interface PveBattle {
  id: string;
  rulesVersion: 2;
  nodeId: string;
  rewardRoll?: { coins: number; stones: number };
  phase: "playing" | "result";
  turn: Color;
  ply: number;
  units: CombatUnit[];
  xp: Record<string, number>;
  positions: Record<string, number>;
  lastEvent: CombatEvent | null;
  result: CombatResult | PveReceipt | null;
  settled: boolean;
}
export interface NodeProgress {
  attempts: number;
  wins: number;
  openedAt: number;
}
export interface PveStatistics {
  battles: number;
  wins: number;
  draws: number;
  stonesUsed: number;
  firstEvolutionAt: number | null;
  stoneInvestments: Record<string, number>;
  deaths: Partial<Record<PieceSymbol, number>>;
  recent: {
    nodeId: string;
    outcome: Outcome;
    levels: number[];
    deaths: number;
    stones: number;
    plies: number;
  }[];
}
export interface PveProfile {
  version: 1;
  revision: number;
  sequence: number;
  levelCap: number;
  stones: number;
  cores: number;
  cleared: string[];
  nodes: Record<string, NodeProgress>;
  battle: PveBattle | null;
  lastResult: PveReceipt | null;
  stats: PveStatistics;
  units: PveUnit[];
}
