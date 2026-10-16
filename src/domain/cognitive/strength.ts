import { CONFIG as C } from "./cognitive-config.js";
import { clamp,createSession,hash } from "./cognitive-model.js";
import { validPlayStyle } from "./play-style-config.js";
import type {
ArchivedEngineProfile,
EngineProfile
} from "./types.js";
const validSeed = (seed: unknown): seed is number =>
  typeof seed === "number" &&
  Number.isInteger(seed) &&
  seed >= 0 &&
  seed <= 0xffffffff;
const validElo = (elo: unknown): elo is number =>
  typeof elo === "number" &&
  Number.isFinite(elo) &&
  elo >= C.minElo &&
  elo <= C.maxElo;
export const validEngineProfile = (
  profile?: Partial<ArchivedEngineProfile> | null,
): profile is EngineProfile =>
  profile?.id === "cognitive-v2" &&
  validPlayStyle(profile.profile) &&
  validElo(profile.targetElo) &&
  validElo(profile.effectiveElo) &&
  validSeed(profile.seed);
// Historical metadata only. These IDs never route to a retired algorithm.
export const validArchivedProfile = (
  profile?: Partial<ArchivedEngineProfile> | null,
): profile is ArchivedEngineProfile =>
  validEngineProfile(profile) ||
  (profile?.id === "humanized19-v1" &&
    validPlayStyle(profile.profile) &&
    Number.isFinite(profile.targetElo) &&
    profile.targetElo! >= 100 &&
    profile.targetElo! <= 1600 &&
    Number.isFinite(profile.effectiveElo) &&
    profile.effectiveElo! >= 100 &&
    profile.effectiveElo! <= 1600 &&
    validSeed(profile.seed)) ||
  ((profile?.id === "stockfish18-v1" || profile?.id === "stockfish19-v1") &&
    Number.isInteger(profile!.skill) &&
    profile!.skill! >= 0 &&
    profile!.skill! <= 12 &&
    Number.isInteger(profile!.nodes) &&
    profile!.nodes! >= 1500 &&
    profile!.nodes! <= 20000 &&
    profile!.milliseconds === 1500);
export const migrateEngineProfile = (
  profile: Partial<ArchivedEngineProfile> | null | undefined,
  {
    playerElo = 1000,
    targetElo,
    pgn = "",
  }: { playerElo?: number; targetElo?: number; pgn?: string } = {},
): EngineProfile => {
  if (validEngineProfile(profile))
    return { ...profile, calibrationVersion: C.version };
  const seed = validSeed(profile?.seed)
    ? profile.seed
    : hash(0x47414348, `${pgn}:${playerElo}:${targetElo ?? ""}`);
  const next = createSession(
    playerElo,
    seed,
    validPlayStyle(profile?.profile) ? profile?.profile : "default",
  );
  const previous = Number.isFinite(profile?.targetElo)
    ? profile!.targetElo
    : targetElo;
  if (typeof previous === "number" && Number.isFinite(previous)) {
    const variance = next.effectiveElo - next.targetElo;
    next.targetElo = clamp(previous, C.minElo, C.maxElo);
    next.effectiveElo = clamp(next.targetElo + variance, C.minElo, C.maxElo);
  }
  return next;
};
