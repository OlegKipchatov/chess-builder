import type { Color } from "chess.js";
export type HuntPieceType = "p" | "n" | "b" | "r" | "q";
export type HuntMode = "timed" | "endless";
export interface HuntPiece {
  type: HuntPieceType;
  color: Color;
}
export type HuntBoard = Record<string, HuntPiece>;
export interface HuntMove {
  from: string;
  to: string;
}
export type HuntPhase = "idle" | "awaitingPlayer" | "resolving" | "finished";
export type HuntFinishReason = "timer" | "lives" | "no-space" | "abandoned";
export interface HuntState {
  runId: string;
  runSeed: string;
  mode: HuntMode;
  phase: HuntPhase;
  pieces: HuntBoard;
  rngState: number;
  score: number;
  capturedMaterial: number;
  playerMoveCount: number;
  lives: number;
  lifeRecoveryMaterial: number;
  lastMove?: HuntMove;
  lastOpponentMove?: HuntMove;
  startedAtMs?: number;
  targetEndAtMs?: number;
  finishedAtMs?: number;
  finishReason?: HuntFinishReason;
}
export interface HuntConfig {
  initialPlayerPieces: number;
  initialOpponentPieces: number;
  opponentSpawnEveryPlayerMoves: number;
  timedDurationMs: number;
  endlessStartingLives: number;
  materialPerRecoveredLife: number;
  rewardMultiplier: number;
  placementAttemptLimit: number;
  opponentMoveWeights: {
    threat: number;
    danger: number;
    distance: number;
    reversal: number;
  };
  playerPool: HuntPieceType[];
  opponentWeights: Record<HuntPieceType, number>;
  playerSquares: string[];
  opponentSquares: string[];
  fallback: [string, HuntPieceType, Color][];
}
export interface HuntProgress {
  records: Record<HuntMode, { bestScore: number }>;
  awards: Record<string, number>;
}
export interface HuntEvent {
  type:
    | "playerMoved"
    | "opponentCaptured"
    | "opponentMoved"
    | "playerRespawned"
    | "opponentSpawned";
  pieces: HuntBoard;
  pieceType?: HuntPieceType;
  from?: string;
  to?: string;
  captured?: HuntPieceType;
  color?: Color;
  square?: string;
}
