import type { Chess,Color,Move,PieceSymbol,Square } from "chess.js";
export type PlayStyle =
  "default" | "aggressive" | "solid" | "positional" | "tricky";
export interface EngineProfile {
  id: "cognitive-v2";
  calibrationVersion: string;
  targetElo: number;
  effectiveElo: number;
  seed: number;
  profile: PlayStyle;
}
export interface Capabilities {
  threatAwareness: number;
  tacticalAwareness: number;
  calculationDepth: number;
  calculationWidth: number;
  positionalAwareness: number;
  conversionSkill: number;
  evaluationAccuracy: number;
  openingDiscipline: number;
  oversightResistance: number;
  elo: number;
}
export interface BoardPiece {
  square: Square;
  type: PieceSymbol;
  color: Color;
}
export interface Threat {
  id: string;
  from: Square;
  to: Square;
  color: Color;
  type: PieceSymbol;
  obviousness: number;
}
export interface Facts {
  pieces: BoardPiece[];
  legal: Move[];
  threats: Threat[];
  complexity: number;
  phase: "opening" | "middlegame" | "endgame";
}
export interface Perception {
  noticed: Threat[];
  missed: Threat[];
  complexity: number;
  load: number;
  oversight: boolean;
  tactics: boolean;
  position: boolean;
  opening: boolean;
}
export interface Candidate {
  move: Move;
  reasons: string[];
  naturalness: number;
  perceivedValue?: number;
}
export interface DecisionInput {
  fen?: string;
  pgn?: string;
  elo: number;
  seed: number;
  maxNodes?: number;
  maxDepth?: number;
  conversionEnabled?: boolean;
  profile?: PlayStyle;
}
export interface ConversionInput {
  game: Chess;
  caps: Capabilities;
  seed: number;
  profile?: PlayStyle;
  maxNodes?: number;
  maxDepth?: number;
}
export type ErrorQuality =
  "best" | "good" | "inaccuracy" | "mistake" | "blunder" | "unknown";
export interface LegacyEngineProfile {
  id: "humanized19-v1" | "stockfish18-v1" | "stockfish19-v1";
  profile?: PlayStyle;
  targetElo?: number;
  effectiveElo?: number;
  seed?: number;
  skill?: number;
  nodes?: number;
  milliseconds?: number;
  calibrationVersion?: string;
}
export type ArchivedEngineProfile = EngineProfile | LegacyEngineProfile;
export interface ConversionProgress {
  signature: string;
  bestProgress: number;
  stagnantMoves: number;
}
export interface ConversionFeatures {
  mobilityCount: number;
  confinement: number;
  edgePressure: number;
  kingProximity: number;
  coverage: number;
  cage: number;
  progress: number;
}
export interface RawMove {
  color: Color;
  from: number;
  to: number;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  flags: number;
}
export interface ConversionMove {
  raw: RawMove;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  uci: string;
}
export interface ConversionCandidate {
  move: ConversionMove;
  order: number;
  check: boolean;
  mate: boolean;
  unsafe: boolean;
  delta: number;
  state: ConversionProgress;
  repeat: number;
  value: number;
  progressAfter: number;
  kingApproach: boolean;
  mobilityReduced: boolean;
  reasons: string[];
}
