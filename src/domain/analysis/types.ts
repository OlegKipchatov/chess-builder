import type { Chess, Color, Move, PieceSymbol, Square } from "chess.js";
import type { EngineClient, EngineLine } from "../../shared/types/engine.js";
import type { DecisionQuality } from "../economy/types.js";
export type Reason =
  | "allowed_mate"
  | "missed_mate"
  | "mate_opportunity"
  | "found_mate"
  | "only_move"
  | "hung_piece"
  | "lost_material"
  | "missed_capture"
  | "missed_tactic"
  | "promotion"
  | "generic";
export type MateTransition =
  "allowed_mate" | "missed_mate" | "preserves_mate" | "already_lost" | null;
export interface MoveClassification {
  topGap: number;
  expectedScoreLoss: number;
  quality: DecisionQuality;
  highlight: "excellent" | null;
  mateTransition: MateTransition;
  bestVsSecondGap: number;
  forced: boolean;
}
export interface LineEvidence {
  valid: boolean;
  san: string[];
  delta: number;
  first: Move | null;
  moves?: Move[];
}
export interface TraceStep {
  ply: number;
  token: string;
  actor: "player" | "opponent";
  piece: PieceSymbol;
  from: Square;
  to: Square;
  captured: PieceSymbol | null;
  promotion: PieceSymbol | null;
  check: boolean;
  mate: boolean;
  delta: number;
  threats: { square: Square; piece: PieceSymbol }[];
}
export interface Continuation {
  steps: TraceStep[];
  pv: string[];
  delta: number;
  settled: boolean;
  terminal: boolean;
}
interface FactBase {
  priority: number;
  end: number;
  reason?: Reason | null;
}
export type ComparisonFact = FactBase &
  (
    | { kind: "material"; bestDelta: number; actualDelta: number }
    | { kind: "promotion" | "threat"; step: TraceStep }
    | { kind: "check"; step: TraceStep; followup?: TraceStep }
    | {
        kind: "target_escape";
        first: TraceStep;
        escape: TraceStep;
        recapture: TraceStep | null;
        followup?: TraceStep;
      }
    | {
        kind: "protection";
        actor: PieceSymbol;
        capturedBy: PieceSymbol;
        defender: PieceSymbol;
        pv: string[];
      }
  );
export interface Recommendation {
  version: string;
  kind: ComparisonFact["kind"] | "evaluation";
  primary: boolean;
  coverage: "evaluation_only" | "verified_line";
  text: string;
  pv: string[];
  facts: unknown[];
  reason?: Reason | null;
  themeKey?: string | null;
  playedPv?: string[];
  comparison?: {
    bestDelta: number;
    playedDelta: number;
    bestPlies: number;
    playedPlies: number;
  };
}
export interface MateReply {
  move: string;
  finishes: string[];
}
export interface MateSolution {
  move: string;
  replies: MateReply[];
}
export interface MateExercise {
  type?: "engine";
  fen: string;
  mateIn: number;
  solutions?: MateSolution[];
}
export interface MoveAnalysis extends Partial<MoveClassification> {
  ply: number;
  actor: "player" | "opponent";
  fenBefore: string;
  fenAfter: string;
  playedMove: string;
  playedSan: string;
  status: "complete" | "unavailable" | "not_analyzed";
  alternatives: EngineLine[];
  autoPause: boolean;
  bestLine?: EngineLine;
  playedLine?: EngineLine;
  bestEvidence?: LineEvidence;
  playedEvidence?: LineEvidence;
  recommendationEvidence?: Recommendation | null;
  reason?: Reason | null;
  explanationKey?: string | null;
  shortMate?: { moves: number; verified: boolean } | null;
  exercise?: MateExercise | null;
  recommendationRequired?: boolean;
  repeatedOpportunity?: boolean;
  relatedPlies?: number[];
  repeatedFromPly?: number;
  primaryEvent?: string | null;
  eventPriority?: number;
}
export interface AnalysisProfile {
  version: string;
  multiPv: number;
  quickNodes: number;
  deepNodes: number;
  thresholds: readonly number[];
  significantGap: number;
  excellentLoss: number;
  bestCluster: number;
}
export interface AnalysisProgress {
  stage: "quick" | "deep";
  done: number;
  total: number;
}
export interface GameAnalysis {
  analysisVersion: number | string;
  profileVersion: string;
  engine: { version: string; nnue: string };
  gameId: string;
  sourcePgn: string;
  playerColor: Color;
  createdAt: string;
  status: "complete" | "partial" | "failed";
  totalPlies: number;
  analyzedPlayerMoves: number;
  moves: MoveAnalysis[];
  focusEvents: number[];
  summary: Record<DecisionQuality | "excellent", number>;
  diagnostics?: {
    searches: { ply: number; nodes: number; restricted: boolean; ms: number }[];
  };
}
export type ExerciseState =
  | "awaitMove"
  | "wrong"
  | "success"
  | "correct"
  | "opponent"
  | "checking"
  | "unverified";
export interface ExerciseSnapshot {
  fen: string;
  state: ExerciseState;
  mateIn: number;
  turn: Color;
  hintPending?: boolean;
  failedAttempts?: number;
  canHint?: boolean;
}
export interface ExerciseController {
  game: Chess;
  getSnapshot: () => ExerciseSnapshot;
  getHint: () => string | null | undefined | Promise<string | null | undefined>;
  submit: (token: string) => ExerciseSnapshot | Promise<ExerciseSnapshot>;
  continue: () => ExerciseSnapshot;
  dispose?: () => void;
}
export interface ExerciseOptions {
  createClient?: () => EngineClient;
  nodes?: number;
  attempts?: Map<string, number>;
}
