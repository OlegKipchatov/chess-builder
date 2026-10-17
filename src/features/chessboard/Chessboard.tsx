import type { Color, Square } from "chess.js";
import {
  memo,
  useId,
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
import type { Equipment, StyleId } from "../../domain/catalog/types.js";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion.js";
import { motionDuration, motionEasing } from "../../shared/styles/motion.js";
import { Piece } from "../../shared/ui/Piece.js";
import styles from "./Chessboard.module.css";
import {
  boardPoint,
  boardSquares,
  variationArrowPoints,
  type BoardPiece,
} from "./model.js";
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
      previous.current = { x: point.x, y: point.y };
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
          <span className="pve-vitals" aria-hidden="true">
            <span className="pve-level">{piece.level}</span>
            <span className={`pve-hp ${styles.health}`}>
              <i
                style={{
                  width: `${(100 * piece.hp) / (piece.maxHp || piece.hp || 1)}%`,
                }}
              />
            </span>
            {!!damage && (
              <span className={`pve-damage-number ${styles.damage}`}>
                −{damage}
              </span>
            )}
          </span>
        )}
      </span>
    );
  },
  (a, b) =>
    a.orientation === b.orientation &&
    a.skin === b.skin &&
    a.duration === b.duration &&
    a.reduced === b.reduced &&
    a.target === b.target &&
    a.damage === b.damage &&
    a.piece.id === b.piece.id &&
    a.piece.square === b.piece.square &&
    a.piece.type === b.piece.type &&
    a.piece.color === b.piece.color &&
    a.piece.hp === b.piece.hp &&
    a.piece.maxHp === b.piece.maxHp &&
    a.piece.level === b.piece.level,
);
interface CellProps {
  square: Square;
  dark: boolean;
  selected: boolean;
  legal: boolean;
  capture: boolean;
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
    capture,
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
        capture ? "capture" : "",
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
  id?: string;
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
  arrow?: string | null;
  feedback?: boolean;
  annotation?: {
    square: string;
    quality: string;
    symbol: string;
    label: string;
  } | null;
}
const noop = () => {};
export const Chessboard = memo(
  ({
    id = "board",
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
    arrow,
    feedback = false,
    annotation = null,
    label = "Шахматная доска",
  }: ChessboardProps) => {
    const markerId = useId();
    const arrowPoints = arrow ? variationArrowPoints(arrow, orientation) : null;
    const reduced = useReducedMotion(),
      root = useRef<HTMLDivElement>(null);
    const previous = useRef<BoardPiece[]>(pieces),
      [captured, setCaptured] = useState<BoardPiece[]>([]),
      [material, setMaterial] = useState<BoardPiece[]>([]),
      feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
      );
    useLayoutEffect(() => () => clearTimeout(feedbackTimer.current), []);
    useLayoutEffect(() => {
      const missing = previous.current.filter(
        (old) => !pieces.some((piece) => piece.id === old.id),
      );
      previous.current = pieces;
      clearTimeout(feedbackTimer.current);
      setMaterial(feedback ? missing : []);
      if (feedback && missing.length)
        feedbackTimer.current = setTimeout(
          () => setMaterial([]),
          motionDuration.board + motionDuration.standard + motionDuration.fast,
        );
      if (reduced || !missing.length || !duration) {
        setCaptured([]);
        return;
      }
      setCaptured(missing);
      const timer = setTimeout(() => setCaptured([]), duration);
      return () => clearTimeout(timer);
    }, [pieces, reduced, duration, feedback]);
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
        id={id}
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
              capture={legal.includes(square) && !!piece}
              last={!!last && (last.from === square || last.to === square)}
              check={check === square}
              disabled={disabled}
              label={`${square}${piece?.description ? `, ${piece.description}` : piece ? `, ${piece.color === "w" ? "белые" : "чёрные"}: ${PIECE_NAMES[piece.type]}${piece.hp !== undefined ? `, здоровье ${piece.hp}` : ""}` : ", пусто"}${legal.includes(square) ? ", доступный ход" : ""}`}
              rank={index % 8 === 0}
              file={index >= 56}
              activate={onSquare}
              onKey={key}
            />
          );
        })}
        {annotation && (
          <span
            className={`${styles.annotation} analysis-marker`}
            data-square-annotation={annotation.square}
            style={{
              left: `${boardPoint(annotation.square, orientation).x * 12.5}%`,
              top: `${boardPoint(annotation.square, orientation).y * 12.5}%`,
            }}
            role="img"
            aria-label={`${annotation.square}: ${annotation.label}`}
          >
            <span
              className="analysis-badge"
              data-quality={annotation.quality}
              aria-hidden="true"
            >
              {annotation.symbol}
            </span>
          </span>
        )}
        {arrowPoints && (
          <svg
            className={`${styles.arrow} analysis-arrow`}
            viewBox="0 0 8 8"
            aria-label="Рекомендуемый ход"
          >
            <defs>
              <marker
                id={markerId}
                markerWidth="3"
                markerHeight="3"
                refX="2.3"
                refY="1.5"
                orient="auto"
              >
                <path d="M0 0 3 1.5 0 3z" fill="currentColor" />
              </marker>
            </defs>
            <line
              x1={arrowPoints[0]}
              y1={arrowPoints[1]}
              x2={arrowPoints[2]}
              y2={arrowPoints[3]}
              stroke="currentColor"
              strokeWidth=".13"
              markerEnd={`url(#${markerId})`}
            />
          </svg>
        )}
        {captured.map((piece) => (
          <span
            className={`${styles.ghost} moving-piece`}
            key={`capture-${piece.id}`}
            style={{
              animationDuration: `${duration}ms`,
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
        {material.map(
          (piece) =>
            piece.type !== "k" && (
              <span
                key={`material-${piece.id}`}
                className="capture-material"
                data-balance={
                  piece.color === orientation ? "negative" : "positive"
                }
                aria-hidden="true"
                style={{
                  left: `${(boardPoint(piece.square, orientation).x + 1) * 12.5}%`,
                  top: `${boardPoint(piece.square, orientation).y * 12.5}%`,
                  transform: "translateX(-100%)",
                }}
              >
                {piece.color === orientation ? "−" : "+"}
                {{ p: 1, n: 3, b: 3, r: 5, q: 9 }[piece.type]}
              </span>
            ),
        )}
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
