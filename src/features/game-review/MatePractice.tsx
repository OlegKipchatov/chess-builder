import { motionDuration } from "../../shared/styles/motion.js";
import type { PieceSymbol, Square } from "chess.js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { createMateExercise } from "../../services/analysis/analysis-training.js";
import type {
  ExerciseController,
  MateExercise,
} from "../../domain/analysis/types.js";
import type { Equipment } from "../../domain/catalog/types.js";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion.js";
import { PIECE_NAMES } from "../../domain/catalog/catalog.js";
import { Piece } from "../../shared/ui/Piece.js";
import { Chessboard } from "../chessboard/Chessboard.js";
import { chessPieces } from "../chessboard/model.js";
export const MatePractice = ({
  exercise,
  equipped,
  onClose,
  attempts,
  header,
  minHeight,
}: {
  exercise: MateExercise;
  equipped: Equipment;
  onClose: () => void;
  attempts: Map<string, number>;
  header?: ReactNode;
  minHeight?: number;
}) => {
  const controller = useRef<ExerciseController | null>(null),
    [snapshot, setSnapshot] = useState(() =>
      createMateExercise(exercise, { attempts }).getSnapshot(),
    ),
    [selected, setSelected] = useState<Square | null>(null),
    [hint, setHint] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    { show } = useOverlays(),
    reduced = useReducedMotion();
  useEffect(() => {
    const owned = createMateExercise(exercise, { attempts });
    controller.current = owned;
    setSnapshot(owned.getSnapshot());
    return () => {
      controller.current = null;
      owned.dispose?.();
    };
  }, [exercise, attempts]);
  useEffect(() => {
    if (!["correct", "opponent"].includes(snapshot.state)) return;
    const owned = controller.current;
    const next = () => {
      if (owned && controller.current === owned) setSnapshot(owned.continue());
    };
    if (reduced) {
      next();
      return;
    }
    const timer = setTimeout(next, motionDuration.board);
    return () => clearTimeout(timer);
  }, [snapshot.state, reduced]);
  const game = controller.current?.game,
    legal =
      selected && game ? game.moves({ square: selected, verbose: true }) : [];
  const submit = async (token: string) => {
    const owned = controller.current;
    if (!owned || busy) return;
    setBusy(true);
    setSelected(null);
    setHint(null);
    const promise = owned.submit(token);
    setSnapshot(owned.getSnapshot());
    const next = await promise;
    if (controller.current !== owned) return;
    setSnapshot(next);
    setBusy(false);
  };
  const choose = (square: Square) => {
    if (!game || snapshot.state !== "awaitMove" || busy) return;
    const moves = legal.filter((move) => move.to === square);
    if (selected && moves.length) {
      const from = selected;
      if (moves.some((move) => move.promotion))
        show({
          title: "Превращение пешки",
          dismissible: false,
          body: (
            <div className="promotion-options">
              {(["q", "r", "b", "n"] as PieceSymbol[]).map((type) => (
                <button
                  key={type}
                  aria-label={PIECE_NAMES[type]}
                  onClick={() => {
                    show(null);
                    void submit(from + square + type);
                  }}
                >
                  <Piece type={type} color={game.turn()} />
                </button>
              ))}
            </div>
          ),
        });
      else void submit(from + square);
    } else setSelected(game.get(square)?.color === game.turn() ? square : null);
  };
  return (
    <div
      id="match-surface"
      data-practice={snapshot.state}
      className="game-grid analysis-layout analysis-practice"
      style={{ minHeight }}
    >
      <div className="board-area">
        {header}
        {game && (
          <Chessboard
            pieces={chessPieces(game)}
            equipped={equipped}
            orientation={exercise.fen.split(" ")[1] === "b" ? "b" : "w"}
            selected={selected}
            legal={legal.map((m) => m.to)}
            arrow={hint}
            last={game.history({ verbose: true }).at(-1)}
            disabled={busy || snapshot.state !== "awaitMove"}
            onSquare={choose}
          />
        )}
      </div>
      <aside className="analysis-panel">
        <h2>Мат в {exercise.mateIn}</h2>
        <p role="status">
          {
            {
              awaitMove: "Найдите продолжение",
              wrong: "Попробуйте другое продолжение",
              success: "Мат! Задача решена",
              correct: "Верно",
              opponent: "Ход соперника",
              checking: "Проверяем продолжение…",
              unverified:
                "Движок не смог подтвердить вариант. Попробуйте ещё раз.",
            }[snapshot.state]
          }
        </p>
        {["wrong", "unverified"].includes(snapshot.state) && (
          <button
            data-practice-continue
            className="primary"
            onClick={() => {
              const owned = controller.current;
              if (owned) setSnapshot(owned.continue());
            }}
          >
            Продолжить
          </button>
        )}
        {snapshot.canHint && snapshot.state === "awaitMove" && (
          <button
            data-practice-hint
            disabled={busy}
            onClick={async () => {
              if (hint) {
                setHint(null);
                return;
              }
              const owned = controller.current;
              if (!owned) return;
              setBusy(true);
              const move = await owned.getHint();
              if (controller.current !== owned) return;
              setHint(move || null);
              setSnapshot(owned.getSnapshot());
              setBusy(false);
            }}
          >
            {hint ? "Скрыть" : "Подсказка"}
          </button>
        )}
        <button
          data-practice-continue={
            snapshot.state === "success" ? true : undefined
          }
          data-analysis-return={snapshot.state !== "success" ? true : undefined}
          className={snapshot.state === "success" ? "primary" : "quiet"}
          onClick={onClose}
        >
          {snapshot.state === "success"
            ? "Продолжить просмотр"
            : "Вернуться к партии"}
        </button>
      </aside>
    </div>
  );
};
