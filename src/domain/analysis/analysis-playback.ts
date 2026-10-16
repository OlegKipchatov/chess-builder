import type { GameAnalysis } from "./types.js";
type PlaybackState =
  "idle" | "pausedByUser" | "playing" | "pausedForInsight" | "finished";
// Presentation-only state machine: no imports from engine/service/config.
import { isImportantInsight } from "./analysis-events.js";
export const createAnalysisPlayback = ({
  analysis,
  showPly,
  onChange = () => {},
  schedule = setTimeout,
  unschedule = clearTimeout,
}: {
  analysis: Pick<GameAnalysis, "totalPlies" | "moves" | "focusEvents">;
  showPly: (ply: number, animate: boolean) => void | Promise<void>;
  onChange?: (snapshot: { ply: number; state: PlaybackState }) => void;
  schedule?: typeof setTimeout;
  unschedule?: typeof clearTimeout;
}) => {
  let ply = 0,
    state: PlaybackState = "idle",
    timer: ReturnType<typeof setTimeout> | undefined,
    generation = 0;
  const emit = () => onChange({ ply, state });
  const stop = (next: PlaybackState) => {
    generation++;
    unschedule(timer);
    timer = undefined;
    state = next;
    emit();
  };
  const seek = async (target: number) => {
    stop("pausedByUser");
    ply = Math.max(0, Math.min(analysis.totalPlies, target));
    await showPly(ply, false);
    emit();
  };
  const advance = async () => {
    if (state !== "playing") return;
    const token = generation;
    ply++;
    await showPly(ply, true);
    if (token !== generation) return;
    const move = analysis.moves?.[ply - 1];
    if (
      analysis.moves
        ? isImportantInsight(move)
        : analysis.focusEvents.includes(ply)
    ) {
      state = "pausedForInsight";
      emit();
      return;
    }
    if (ply === analysis.totalPlies) {
      state = "finished";
      emit();
      return;
    }
    emit();
    timer = schedule(() => void advance(), 375);
  };
  return {
    getSnapshot: () => ({ ply, state }),
    seek,
    play: async () => {
      if (state === "playing" || !analysis.totalPlies) return;
      if (ply === analysis.totalPlies) await seek(0);
      state = "playing";
      generation++;
      emit();
      timer = schedule(() => void advance(), 100);
    },
    pause: () => stop("pausedByUser"),
    dispose: () => stop("idle"),
  };
};
