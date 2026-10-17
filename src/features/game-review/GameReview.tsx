import { boardAnnotation, moveAnnotation } from "./annotations.js";
import { materialBalance } from "../../domain/chess/archive.js";
import { motionDuration } from "../../shared/styles/motion.js";
import { MoveList } from "./MoveList.js";
import { playStyleName } from "../../domain/cognitive/play-style-config.js";
import { AnalysisInsight } from "./AnalysisInsight.js";
import { visibleVariation } from "../../domain/analysis/presentation.js";
import { Chess } from "chess.js";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { isImportantInsight } from "../../domain/analysis/analysis-events.js";
import { createAnalysisPlayback } from "./analysis-playback.js";
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
  showExport = true,
}: {
  entry: ArchiveEntry;
  autoAnalyze?: boolean;
  showExport?: boolean;
}) => {
  const live = useMemo(() => {
      const board = new Chess();
      board.loadPgn(entry.pgn);
      return board;
    }, [entry.pgn]),
    { job, start, cancel, analysis } = useGameAnalysis(entry),
    [cursor, setCursor] = useState(0),
    [playing, setPlaying] = useState(false),
    [playbackState, setPlaybackState] = useState("idle"),
    [hint, setHint] = useState(false),
    [footprint, setFootprint] = useState(0),
    surface = useRef<HTMLDivElement>(null),
    [analysisMode, setAnalysisMode] = useState(autoAnalyze),
    [progressVisible, setProgressVisible] = useState(false),
    [variation, setVariation] = useState<number | null>(null),
    [practice, setPractice] = useState<MateExercise | null>(null),
    reduced = useReducedMotion(),
    playback = useRef<ReturnType<typeof createAnalysisPlayback> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    release = useRef<(() => void) | null>(null),
    attempts = useRef(new Map<string, number>());
  const currentCursor = useEffectEvent(() => cursor);
  const move = analysisMode ? analysis?.moves[cursor - 1] : undefined;
  useEffect(() => {
    if (job.status !== "running") {
      setProgressVisible(false);
      return;
    }
    const timer = setTimeout(() => setProgressVisible(true), 200);
    return () => clearTimeout(timer);
  }, [job.status]);
  const startAutomatically = useEffectEvent(() => {
    if (autoAnalyze && eligibleEntry(entry) && !analysis) void start();
  });
  useEffect(() => {
    startAutomatically();
  }, [entry.id, autoAnalyze]);
  useEffect(() => {
    const source =
      (analysisMode ? analysis : undefined) ||
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
          }, motionDuration.board);
        });
      },
      onChange: (snapshot) => {
        setPlaying(snapshot.state === "playing");
        setPlaybackState(snapshot.state);
      },
    });
    playback.current = controller;
    void controller.seek(currentCursor());
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
  }, [analysis, analysisMode, live, reduced]);
  const board = useMemo(() => {
    if (hint && move) {
      const position = new Chess(move.fenBefore),
        pv = visibleVariation(move, variation !== null).pv;
      for (const token of pv.slice(0, variation ?? 0)) {
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
  const balance = materialBalance(board, entry.playerColor);
  const opponent =
    entry.mode === "bot"
      ? (entry.engineProfile?.profile ? `ИИ · ${playStyleName(entry.engineProfile.profile)}` : "ИИ")
      : "Игрок 2";
  const summary = (
    <div className="match-summary">
      <div className="match-versus">
        <strong>
          {entry.imported
            ? live.getHeaders().White || "Белые"
            : entry.playerColor === "w"
              ? "Вы"
              : opponent}
        </strong>
        <span className="versus">VS</span>
        <strong>
          {entry.imported
            ? live.getHeaders().Black || "Чёрные"
            : entry.playerColor === "b"
              ? "Вы"
              : opponent}
        </strong>
      </div>
      <strong
        id="match-points"
        data-balance={
          balance > 0 ? "positive" : balance < 0 ? "negative" : "zero"
        }
      >
        {balance > 0 ? "+" : ""}
        {balance} очков
      </strong>
    </div>
  );
  if (practice)
    return (
      <MatePractice
        exercise={practice}
        equipped={entry.equipped}
        attempts={attempts.current}
        header={summary}
        minHeight={footprint}
        onClose={() => setPractice(null)}
      />
    );
  return (
    <div
      ref={surface}
      id="match-surface"
      className={`game-grid analysis-layout ${analysisMode ? "analysis-active" : ""}`}
      data-playback={playbackState}
      data-mode={hint ? "hint" : "review"}
    >
      <div className="board-area">
        {summary}
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
          annotation={hint ? null : boardAnnotation(move)}
          arrow={
            hint && move
              ? visibleVariation(move, variation !== null).pv[variation ?? 0]
              : null
          }
        />
        <div className="analysis-controls-slot">
          {hint && variation !== null ? (
            <div id="analysis-variation-tools">
              <MoveNavigation
                variant
                cursor={variation}
                total={visibleVariation(move, true).pv.length}
                onSeek={setVariation}
              />
              <button
                data-analysis-return
                className="quiet"
                onClick={() => setVariation(null)}
              >
                Вернуться к партии
              </button>
            </div>
          ) : (
            <MoveNavigation
              markers={
                analysisMode
                  ? analysis?.moves
                      .filter(isImportantInsight)
                      .map(moveAnnotation)
                  : []
              }
              cursor={cursor}
              total={live.history().length}
              playing={playing}
              onPlay={() => {
                if (playing) playback.current?.pause();
                else void playback.current?.play();
              }}
              onSeek={(ply) => void playback.current?.seek(ply)}
            />
          )}
        </div>
        {eligibleEntry(entry) &&
          (!analysisMode || analysis?.status !== "complete") && (
            <div id="archive-review-actions">
              <div id="archive-analysis-actions">
                {job.status === "running" ? (
                  <div
                    id="analysis-progress"
                    style={{
                      visibility: progressVisible ? "visible" : "hidden",
                    }}
                  >
                    <span className="analysis-spinner" aria-hidden="true" />
                    <span
                      role="progressbar"
                      aria-label="Анализ партии"
                      aria-valuemin={0}
                      aria-valuemax={job.progress.total || 1}
                      aria-valuenow={job.progress.done}
                      aria-live="polite"
                    >
                      {job.progress.stage === "quick"
                        ? "Первый проход"
                        : "Глубокий разбор"}{" "}
                      · {job.progress.done}/{job.progress.total}
                    </span>
                    <button
                      id="analysis-cancel"
                      className="quiet"
                      onClick={cancel}
                    >
                      Отменить
                    </button>
                  </div>
                ) : !analysisMode || analysis?.status !== "complete" ? (
                  <button
                    id={
                      analysisMode &&
                      (job.status === "failed" ||
                        (analysis && analysis.status !== "complete"))
                        ? "analysis-retry"
                        : "archive-analysis"
                    }
                    className="primary"
                    onClick={() => {
                      setAnalysisMode(true);
                      if (!analysis || analysis.status !== "complete")
                        void start();
                    }}
                  >
                    {analysisMode && (analysis || job.status === "failed")
                      ? "Повторить анализ"
                      : "Разобрать партию"}
                  </button>
                ) : null}
              </div>
              {job.status === "failed" ? (
                <p role="alert">{job.message}</p>
              ) : analysis?.status === "failed" ? (
                <p role="alert">
                  Не удалось завершить анализ. Повторите попытку.
                </p>
              ) : null}
            </div>
          )}
        <div className="analysis-insight-slot">
          {analysis?.status === "partial" && (
            <p role="status">
              Часть ходов не удалось проверить. Можно повторить анализ.
            </p>
          )}
          <AnalysisInsight
            move={move}
            hint={hint}
            expanded={variation !== null}
            onHint={() => {
              playback.current?.pause();
              setHint(!hint);
              setVariation(null);
            }}
            onExpand={() => setVariation(variation === null ? 0 : null)}
            onPractice={() => {
              playback.current?.pause();
              if (move?.exercise) {
                setFootprint(
                  surface.current?.getBoundingClientRect().height || 0,
                );
                setPractice(move.exercise);
              }
            }}
          />
          {cursor === 0 && (
            <p className="analysis-position-message">
              Начальная позиция. Начните просмотр партии.
            </p>
          )}
          {cursor === live.history().length && !isImportantInsight(move) && (
            <p className="analysis-position-message">Просмотр завершён.</p>
          )}
        </div>
      </div>
      <aside className="match-secondary">
        <MoveList
          moves={live.history()}
          cursor={cursor}
          annotations={analysisMode ? analysis?.moves.map(moveAnnotation) : []}
          onSeek={(ply) => void playback.current?.seek(ply)}
        />
        <div className="match-actions">
          {showExport && <PgnActions game={live} config={entry} />}
        </div>
      </aside>
    </div>
  );
};
