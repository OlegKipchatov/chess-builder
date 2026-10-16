import type { Color,Square } from "chess.js";
import {
memo,
useCallback,
useLayoutEffect,
useRef,
useState,
type CSSProperties,
type KeyboardEvent,
} from "react";
import {
itemById,
PIECE_NAMES,
styleById,
} from "../../domain/catalog/catalog.js";
import type { Equipment,StyleId } from "../../domain/catalog/types.js";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion.js";
import { motionDuration,motionEasing } from "../../shared/styles/motion.js";
import { Piece } from "../../shared/ui/Piece.js";
import styles from "./Chessboard.module.css";
import { boardPoint,boardSquares,type BoardPiece } from "./model.js";
interface PieceProps {
  piece: BoardPiece;
  orientation: Color;
  skin: StyleId;
  duration: number;
  reduced: boolean;
  target?: string;
  damage?: number;
}
const MovingPiece = memo(
  ({
    piece,
    orientation,
    skin,
    duration,
    reduced,
    target,
    damage,
  }: PieceProps) => {
    const node = useRef<HTMLSpanElement>(null),
      previous = useRef<{ x: number; y: number } | null>(null);
    const point = boardPoint(target || piece.square, orientation);
    useLayoutEffect(() => {
      const last = previous.current;
      previous.current = point;
      if (
        !node.current ||
        !last ||
        reduced ||
        !duration ||
        !node.current.animate
      )
        return;
      const animation = node.current.animate(
        [
          {
            transform: `translate(${(last.x - point.x) * 100}%,${(last.y - point.y) * 100}%)`,
          },
          { transform: "translate(0,0)" },
        ],
        { duration, easing: motionEasing.board },
      );
      return () => animation.cancel();
    }, [point.x, point.y, duration, reduced]);
    return (
      <span
        ref={node}
        className={`${styles.piece} moving-piece ${piece.hp !== undefined ? styles.combat : ""}`}
        style={{ left: `${point.x * 12.5}%`, top: `${point.y * 12.5}%` }}
        data-piece-id={piece.id}
      >
        <Piece type={piece.type} color={piece.color} style={skin} />
        {piece.hp !== undefined && (
          <>
            <span className={styles.level}>{piece.level}</span>
            <span className={styles.health} aria-hidden="true">
              <span
                style={{
                  width: `${(100 * piece.hp) / (piece.maxHp || piece.hp || 1)}%`,
                }}
              />
            </span>
            {!!damage && <span className={styles.damage}>−{damage}</span>}
          </>
        )}
      </span>
    );
  },
);
interface CellProps {
  square: Square;
  dark: boolean;
  selected: boolean;
  legal: boolean;
  last: boolean;
  check: boolean;
  disabled: boolean;
  label: string;
  rank: boolean;
  file: boolean;
  activate: (square: Square) => void;
  onKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
}
const Cell = memo(
  ({
    square,
    dark,
    selected,
    legal,
    last,
    check,
    disabled,
    label,
    rank,
    file,
    activate,
    onKey,
  }: CellProps) => (
    <button
      className={[
        "square",
        dark ? "dark" : "",
        selected ? "selected" : "",
        legal ? "legal" : "",
        last ? "last" : "",
        check ? "check" : "",
      ].join(" ")}
      data-square={square}
      aria-label={label}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) activate(square);
      }}
      onKeyDown={onKey}
    >
      {rank && (
        <span className="coord rank" aria-hidden="true">
          {square[1]}
        </span>
      )}
      {file && (
        <span className="coord" aria-hidden="true">
          {square[0]}
        </span>
      )}
    </button>
  ),
);
export interface ChessboardProps {
  pieces: BoardPiece[];
  equipped: Equipment;
  orientation?: Color;
  selected?: string | null;
  legal?: readonly string[];
  last?: { from: string; to: string } | null;
  check?: string | null;
  disabled?: boolean;
  onSquare?: (square: Square) => void;
  duration?: number;
  attack?: {
    id: string;
    to: string;
    targetId?: string | null;
    damage?: number;
  };
  label?: string;
}
const noop = () => {};
export const Chessboard = memo(
  ({
    pieces,
    equipped,
    orientation = "w",
    selected = null,
    legal = [],
    last = null,
    check = null,
    disabled = false,
    onSquare = noop,
    duration = motionDuration.board,
    attack,
    label = "Шахматная доска",
  }: ChessboardProps) => {
    const reduced = useReducedMotion(),
      root = useRef<HTMLDivElement>(null);
    const previous = useRef<BoardPiece[]>(pieces),
      [captured, setCaptured] = useState<BoardPiece[]>([]);
    useLayoutEffect(() => {
      const missing = previous.current.filter(
        (old) => !pieces.some((piece) => piece.id === old.id),
      );
      previous.current = pieces;
      if (reduced || !missing.length || !duration) { setCaptured([]); return; }
      setCaptured(missing);
      const timer = setTimeout(() => setCaptured([]), duration);
      return () => clearTimeout(timer);
    }, [pieces, reduced, duration]);
    const boardStyle = styleById(itemById(equipped.board)?.style);
    const key = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
      const directions: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -8,
        ArrowDown: 8,
      };
      if (!(event.key in directions)) return;
      event.preventDefault();
      const cells = Array.from(
          root.current?.querySelectorAll<HTMLButtonElement>("[data-square]") ||
            [],
        ),
        index = cells.indexOf(event.currentTarget);
      cells[Math.max(0, Math.min(63, index + directions[event.key]))]?.focus({
        preventScroll: true,
      });
    }, []);
    const squares =
      orientation === "b" ? [...boardSquares].reverse() : boardSquares;
    return (
      <div
        ref={root}
        className={`board ${styles.board} ${selected ? "has-selection" : ""}`}
        role="group"
        aria-label={label}
        aria-busy={disabled}
        style={
          {
            "--square-light": boardStyle.light,
            "--square-dark": boardStyle.dark,
          } as CSSProperties
        }
      >
        {squares.map((square, index) => {
          const piece = pieces.find((p) => p.square === square);
          return (
            <Cell
              key={square}
              square={square}
              dark={(Math.floor(index / 8) + (index % 8)) % 2 === 1}
              selected={selected === square}
              legal={legal.includes(square)}
              last={!!last && (last.from === square || last.to === square)}
              check={check === square}
              disabled={disabled}
              label={`${square}${piece ? `, ${piece.color === "w" ? "белые" : "чёрные"}: ${PIECE_NAMES[piece.type]}${piece.hp !== undefined ? `, здоровье ${piece.hp}` : ""}` : ", пусто"}${legal.includes(square) ? ", доступный ход" : ""}`}
              rank={index % 8 === 0}
              file={index >= 56}
              activate={onSquare}
              onKey={key}
            />
          );
        })}
        {captured.map((piece) => (
          <span
            className={`${styles.ghost} moving-piece`}
            key={`capture-${piece.id}`}
            style={{
              left: `${boardPoint(piece.square, orientation).x * 12.5}%`,
              top: `${boardPoint(piece.square, orientation).y * 12.5}%`,
            }}
          >
            <Piece
              type={piece.type}
              color={piece.color}
              style={itemById(equipped.pieces[piece.type])?.style}
            />
          </span>
        ))}
        {pieces.map((piece) => (
          <MovingPiece
            key={piece.id}
            piece={piece}
            orientation={orientation}
            skin={itemById(equipped.pieces[piece.type])?.style || "classic"}
            duration={duration}
            reduced={reduced}
            target={attack?.id === piece.id ? attack.to : undefined}
            damage={attack?.targetId === piece.id ? attack.damage : undefined}
          />
        ))}
      </div>
    );
  },
);
