import type { EngineProfile } from "../../domain/cognitive/types.js";
export interface EngineScore {
  type: "cp" | "mate";
  value: number;
}
export interface RawEngineLine {
  depth: number;
  index: number;
  move: string;
  pv: string[];
  nodes: number;
  scoreType: "cp" | "mate";
  scoreValue: number;
  wdl?: number[];
}
export interface EngineLine {
  move: string;
  rawScore: EngineScore;
  score: EngineScore;
  wdl?: { win: number; draw: number; loss: number };
  expectedScorePlayer: number;
  pv: string[];
  depth: number;
  nodes: number;
  san?: string;
  pvSan?: string[];
}
export interface EngineRequest {
  id: number;
  requestId?: number;
  jobId?: string;
  moveIndex?: number;
  fen?: string;
  pgn?: string;
  engineProfile?: EngineProfile;
  analysisOnly?: boolean;
  economy?: boolean;
  searchMove?: string;
  analysis?: {
    mode?: "nodes";
    nodes?: number;
    multiPv?: number;
    depth?: number;
    milliseconds?: number;
  };
}
export interface EngineResponse {
  id: number;
  requestId?: number;
  jobId?: string;
  moveIndex?: number;
  move: { from: string; to: string; promotion?: string } | string | null;
  lines?: RawEngineLine[];
  evaluation?: RawEngineLine;
  durationMs?: number;
  recovered?: boolean;
  analysis?: unknown;
  error?: string;
  trace?: unknown;
}
export interface EngineClient {
  onmessage: ((event: { data: EngineResponse }) => void) | null;
  onerror: ((error: Error) => void) | null;
  postMessage: (data: EngineRequest) => void;
  terminate: () => void;
}
export interface UciWorker {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((error: Error) => void) | null;
  postMessage: (data: unknown) => void;
  terminate: () => void;
  readonly variant?: "threaded" | "single";
}
export interface AutoplayEngine {
  ready: Promise<void>;
  isIdle: () => boolean;
  newGame: () => Promise<void>;
  search: (fen: string, moves: string[]) => Promise<string>;
  terminate: () => void;
}
export interface SearchDiagnostic {
  ply: number;
  stage: string;
  attempt: number;
  message: string;
}
