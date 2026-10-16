import { Chess } from "chess.js";
import { useEffect,useMemo,useRef,useState } from "react";
import { isImportantInsight } from "../../domain/analysis/analysis-events.js";
import {
explanationFor,
qualityLabel,
} from "../../domain/analysis/analysis-explanations.js";
import { createAnalysisPlayback } from "../../domain/analysis/analysis-playback.js";
import { eligibleEntry } from "../../domain/analysis/analysis-storage.js";
import type {
GameAnalysis,
MateExercise,
} from "../../domain/analysis/types.js";
import { positionAt } from "../../domain/chess/session.js";
import type { ArchiveEntry } from "../../domain/chess/types.js";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion.js";
import { Chessboard } from "../chessboard/Chessboard.js";
import { chessPieces } from "../chessboard/model.js";
import { MatePractice } from "./MatePractice.js";
import { MoveNavigation } from "./MoveNavigation.js";
import { PgnActions } from "./PgnActions.js";
import { useGameAnalysis } from "./useGameAnalysis.js";
export const GameReview = ({
  entry,
  autoAnalyze = false,
}: {
  entry: ArchiveEntry;
  autoAnalyze?: boolean;
}) => {
  const live = useMemo(() => {
      const board = new Chess();
      board.loadPgn(entry.pgn);
      return board;
    }, [entry.pgn]),
    { job, start, cancel, analysis } = useGameAnalysis(entry),
    [cursor, setCursor] = useState(0),
    [playing, setPlaying] = useState(false),
    [hint, setHint] = useState(false),
    [variation, setVariation] = useState<number | null>(null),
    [practice, setPractice] = useState<MateExercise | null>(null),
    reduced = useReducedMotion(),
    playback = useRef<ReturnType<typeof createAnalysisPlayback> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    release = useRef<(() => void) | null>(null);
  const move = analysis?.moves[cursor - 1];
  useEffect(() => {
    if (autoAnalyze && eligibleEntry(entry) && !analysis) void start();
  }, [entry.id]);
  useEffect(() => {
    const source =
      analysis ||
      ({
        totalPlies: live.history().length,
        moves: [],
        focusEvents: [],
      } as Pick<GameAnalysis, "totalPlies" | "moves" | "focusEvents">);
    const controller = createAnalysisPlayback({
      analysis: source,
      showPly: (ply, animate) => {
        setCursor(ply);
        setHint(false);
        setVariation(null);
        if (!animate || reduced) return;
        return new Promise<void>((resolve) => {
          release.current = resolve;
          timer.current = setTimeout(() => {
            release.current = null;
            resolve();
          }, 420);
        });
      },
      onChange: (snapshot) => setPlaying(snapshot.state === "playing"),
    });
    playback.current = controller;
    void controller.seek(cursor);
    const hidden = () => {
      if (document.hidden) controller.pause();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      controller.dispose();
      clearTimeout(timer.current);
      release.current?.();
      release.current = null;
      playback.current = null;
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [analysis, live, reduced]);
  const board = useMemo(() => {
    if (hint && move) {
      const position = new Chess(move.fenBefore),
        pv = move.recommendationEvidence?.pv || move.bestLine?.pv || [];
      for (const token of pv.slice(0, variation ?? 1)) {
        try {
          position.move({
            from: token.slice(0, 2),
            to: token.slice(2, 4),
            promotion: token[4],
          });
        } catch {
          break;
        }
      }
      return position;
    }
    return positionAt(live, cursor);
  }, [live, cursor, hint, variation, move]);
  const pieces = useMemo(() => chessPieces(board), [board]);
  if (practice)
    return (
      <MatePractice
        exercise={practice}
        equipped={entry.equipped}
        onClose={() => setPractice(null)}
      />
    );
  return (
    <div className="game-grid analysis-layout">
      <div className="board-area">
        <Chessboard
          pieces={pieces}
          equipped={entry.equipped}
          orientation={entry.playerColor}
          last={board.history({ verbose: true }).at(-1)}
          check={
            board.isCheck()
              ? pieces.find((p) => p.type === "k" && p.color === board.turn())
                  ?.square
              : null
          }
          disabled
        />
        <MoveNavigation
          cursor={cursor}
          total={live.history().length}
          playing={playing}
          onPlay={() => {
            if (playing) playback.current?.pause();
            else void playback.current?.play();
          }}
          onSeek={(ply) => void playback.current?.seek(ply)}
        />
        <PgnActions game={live} config={entry} />
      </div>
      <aside className="analysis-panel">
        {eligibleEntry(entry) && (
          <div>
            {job.status === "running" ? (
              <>
                <p role="status">
                  {job.progress.stage === "quick"
                    ? "Первый проход"
                    : "Глубокий разбор"}{" "}
                  · {job.progress.done}/{job.progress.total}
                </p>
                <progress
                  value={job.progress.done}
                  max={job.progress.total || 1}
                />
                <button onClick={cancel}>Отменить</button>
              </>
            ) : (
              <button onClick={() => void start()}>
                {analysis ? "Повторить анализ" : "Разобрать партию"}
              </button>
            )}
            {job.status === "failed" && <p role="alert">{job.message}</p>}
          </div>
        )}
        {analysis?.status === "partial" && (
          <p role="status">
            Часть ходов не удалось проверить. Можно повторить анализ.
          </p>
        )}
        {move && move.status === "complete" && (
          <article
            className={`analysis-insight ${isImportantInsight(move) ? "important" : ""}`}
          >
            <h2>
              {move.highlight === "excellent"
                ? "Отличный ход"
                : move.quality
                  ? qualityLabel[move.quality]
                  : "Ваш ход"}{" "}
              · {move.playedSan}
            </h2>
            <p>{explanationFor(move)}</p>
            {move.bestLine && (
              <div className="analysis-actions">
                {hint && (
                  <button
                    aria-pressed={variation !== null}
                    onClick={() => setVariation(variation === null ? 1 : null)}
                  >
                    Вариант
                  </button>
                )}
                <button
                  aria-pressed={hint}
                  onClick={() => {
                    playback.current?.pause();
                    setHint(!hint);
                    setVariation(null);
                  }}
                >
                  Подсказка
                </button>
              </div>
            )}
            {hint && variation !== null && (
              <MoveNavigation
                cursor={variation}
                total={
                  (move.recommendationEvidence?.pv || move.bestLine?.pv || [])
                    .length
                }
                onSeek={setVariation}
              />
            )}{" "}
            {move.exercise && (
              <button
                className="primary"
                onClick={() => {
                  playback.current?.pause();
                  setPractice(move.exercise!);
                }}
              >
                Решить задачу
              </button>
            )}
          </article>
        )}
        <ol className="moves">
          {live.history().map((san, index) => (
            <li key={index}>
              <button
                className={
                  analysis?.moves[index] &&
                  isImportantInsight(analysis.moves[index])
                    ? "important"
                    : ""
                }
                aria-current={cursor === index + 1 ? "step" : undefined}
                onClick={() => void playback.current?.seek(index + 1)}
              >
                {Math.floor(index / 2) + 1}
                {index % 2 ? "…" : "."} {san}
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
};
