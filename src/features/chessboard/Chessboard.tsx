import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { createPortal } from "react-dom";
import type { Color, Square } from "chess.js";
import {
  memo,
  useId,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type ComponentProps,
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
  hidden?: boolean;
  skipAnimation?: boolean;
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
    hidden,
    skipAnimation,
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
        (last.x === point.x && last.y === point.y) ||
        reduced ||
        skipAnimation ||
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
    }, [point.x, point.y, duration, reduced, skipAnimation]);
    return (
      <span
        ref={node}
        className={`${styles.piece} moving-piece ${piece.hp !== undefined ? styles.combat : ""}`}
        style={{
          left: `${point.x * 12.5}%`,
          top: `${point.y * 12.5}%`,
          visibility: hidden ? "hidden" : undefined,
        }}
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
    a.hidden === b.hidden &&
    a.skipAnimation === b.skipAnimation &&
    a.piece.id === b.piece.id &&
    a.piece.square === b.piece.square &&
    a.piece.type === b.piece.type &&
    a.piece.color === b.piece.color &&
    a.piece.hp === b.piece.hp &&
    a.piece.maxHp === b.piece.maxHp &&
    a.piece.level === b.piece.level,
);
interface CellProps {
  tabIndex: number;
  draggable: boolean;
  dragging: boolean;
  onFocus: (square: Square) => void;
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
    tabIndex,
    draggable,
    dragging,
    onFocus,
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
  }: CellProps) => {
    const drag = useDraggable({ id: square, disabled: !draggable || disabled });
    const drop = useDroppable({ id: square, disabled });
    const { setNodeRef: setDragRef } = drag;
    const { setNodeRef: setDropRef } = drop;
    const ref = useCallback(
      (node: HTMLButtonElement | null) => {
        setDragRef(node);
        setDropRef(node);
      },
      [setDragRef, setDropRef],
    );
    return (
      <button
        ref={ref}
        {...drag.listeners}
        aria-describedby={
          draggable ? drag.attributes["aria-describedby"] : undefined
        }
        data-draggable={draggable && !disabled ? "true" : undefined}
        data-drop-target={dragging && drop.isOver && legal ? "true" : undefined}
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
        tabIndex={tabIndex}
        onFocus={() => onFocus(square)}
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
    );
  },
);
export const BoardDragSource = ({
  source,
  disabled,
  dragDisabled,
  ...props
}: ComponentProps<"button"> & { source: string; dragDisabled?: boolean }) => {
  const drag = useDraggable({ id: source, disabled: disabled || dragDisabled });
  return (
    <button
      {...props}
      {...drag.listeners}
      ref={drag.setNodeRef}
      disabled={disabled}
      className={`${props.className ?? ""} ${styles.reserveSource}`}
      style={{
        ...props.style,
        visibility: drag.isDragging ? "hidden" : undefined,
      }}
    />
  );
};

export interface ChessboardProps {
  reservePieces?: BoardPiece[];
  reserveContent?: ReactNode;
  onReserveMove?: (
    id: string,
    to: Square,
  ) => void | boolean | Promise<void | boolean>;
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
  /** All currently allowed moves, independent of click selection. */
  moves?: readonly { from: string; to: string }[];
  onMove?: (
    from: Square,
    to: Square,
  ) => void | boolean | Promise<void | boolean>;
  /** PvE keeps its full approach/impact/return presentation after a drop. */
  animateDraggedMove?: boolean;
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
  /** Changes when pieces belong to a different scene, not a played move. */
  captureContext?: string;
  annotation?: {
    square: string;
    quality: string;
    symbol: string;
    label: string;
  } | null;
}
const noop = () => {};
const noPieces: BoardPiece[] = [];
const noMoves: NonNullable<ChessboardProps["moves"]> = [];
const dragAccessibility = {
  restoreFocus: false,
  screenReaderInstructions: {
    draggable:
      "Для хода выберите фигуру и клетку назначения. Используйте стрелки и Enter. Перетаскивание можно отменить клавишей Escape.",
  },
  announcements: {
    onDragStart: ({ active }: { active: { id: string | number } }) =>
      `Фигура с ${active.id} взята.`,
    onDragOver: () => undefined,
    onDragEnd: () => "Перетаскивание завершено.",
    onDragCancel: () => "Перетаскивание отменено.",
  },
};
export const Chessboard = memo(
  ({
    id = "board",
    pieces,
    reservePieces = noPieces,
    reserveContent,
    onReserveMove,
    equipped,
    orientation = "w",
    selected = null,
    legal = [],
    last = null,
    check = null,
    disabled = false,
    onSquare = noop,
    moves = noMoves,
    onMove,
    animateDraggedMove = false,
    duration = motionDuration.board,
    attack,
    arrow,
    feedback = false,
    captureContext,
    annotation = null,
    label = "Шахматная доска",
  }: ChessboardProps) => {
    const markerId = useId();
    const suppressPointerClick = useRef(false);
    const sensors = useSensors(
      useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
      useSensor(TouchSensor, {
        activationConstraint: { distance: 4 },
      }),
    );
    const allPieces = [...pieces, ...reservePieces];
    const positionKey = `${orientation}:${disabled}:${allPieces.map((piece) => `${piece.id}:${piece.square}:${piece.type}:${piece.color}:${piece.hp ?? ""}`).join("|")}`;
    const [dragged, setDragged] = useState<{
      piece: BoardPiece;
      position: string;
      size: number;
    } | null>(null);
    const [lastDrop, setLastDrop] = useState<{
      id: string;
      from: string;
      to: string;
    } | null>(null);
    useLayoutEffect(() => {
      if (
        lastDrop &&
        [...pieces, ...reservePieces].find((piece) => piece.id === lastDrop.id)
          ?.square !== lastDrop.from
      )
        setLastDrop(null);
    }, [pieces, reservePieces, lastDrop]);
    const dragging =
      !disabled && dragged?.position === positionKey ? dragged.piece : null;
    // Keep highlights in the same presentation state as the dropped piece.
    // Clearing selection must not briefly reveal the previous committed move.
    const pendingDrop = !animateDraggedMove ? lastDrop : null;
    const displayedLast = pendingDrop ?? last;
    const activeSquare = dragging?.square ?? (pendingDrop ? null : selected);
    const activeLegal = dragging
      ? moves
          .filter((move) => move.from === dragging.square)
          .map((move) => move.to)
      : pendingDrop
        ? []
        : legal;
    // A position/turn change invalidates the gesture permanently, even if the
    // same position becomes interactive again before pointer-up.
    useLayoutEffect(() => {
      setDragged(null);
    }, [positionKey]);
    const [focusedSquare, setFocusedSquare] = useState<Square>(
      orientation === "b" ? "h1" : "a8",
    );
    const arrowPoints = arrow ? variationArrowPoints(arrow, orientation) : null;
    const reduced = useReducedMotion(),
      root = useRef<HTMLDivElement>(null);
    const previous = useRef({ pieces, captureContext }),
      [captured, setCaptured] = useState<BoardPiece[]>([]),
      [material, setMaterial] = useState<BoardPiece[]>([]),
      feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
      );
    useLayoutEffect(() => () => clearTimeout(feedbackTimer.current), []);
    useLayoutEffect(() => {
      const missing =
        previous.current.captureContext === captureContext
          ? previous.current.pieces.filter(
              (old) => !pieces.some((piece) => piece.id === old.id),
            )
          : [];
      previous.current = { pieces, captureContext };
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
    }, [pieces, reduced, duration, feedback, captureContext]);
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
      if (
        (event.key === "ArrowLeft" && index % 8 === 0) ||
        (event.key === "ArrowRight" && index % 8 === 7) ||
        (event.key === "ArrowUp" && index < 8) ||
        (event.key === "ArrowDown" && index >= 56)
      )
        return;
      cells[Math.max(0, Math.min(63, index + directions[event.key]))]?.focus({
        preventScroll: true,
      });
    }, []);
    const squares =
      orientation === "b" ? [...boardSquares].reverse() : boardSquares;
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        autoScroll={false}
        accessibility={dragAccessibility}
        onDragStart={({ active }) => {
          suppressPointerClick.current = true;
          const piece = allPieces.find((item) => item.square === active.id);
          if (
            !disabled &&
            (onMove || onReserveMove) &&
            piece &&
            moves.some((move) => move.from === piece.square)
          )
            setDragged({
              piece,
              position: positionKey,
              size: (root.current?.getBoundingClientRect().width ?? 400) / 8,
            });
        }}
        onDragCancel={() => setDragged(null)}
        onDragEnd={({ active, over }) => {
          const from = dragging?.square,
            to = over?.id;
          setDragged(null);
          if (
            !from ||
            active.id !== from ||
            typeof to !== "string" ||
            (!onMove && !onReserveMove) ||
            !moves.some((move) => move.from === from && move.to === to)
          )
            return;
          const drop = { id: dragging.id, from, to };
          setLastDrop(drop);
          const rollback = () =>
            setLastDrop((current) => (current === drop ? null : current));
          try {
            const reserve = reservePieces.find(
              (piece) => piece.square === from,
            );
            const result = reserve
              ? onReserveMove
                ? onReserveMove(reserve.id, to as Square)
                : false
              : onMove?.(from as Square, to as Square);
            if (result === false) rollback();
            else if (result instanceof Promise)
              void result.then((accepted) => {
                if (accepted === false) rollback();
              }, rollback);
          } catch {
            rollback();
          }
        }}
      >
        <div
          id={id}
          onMouseDownCapture={() => {
            suppressPointerClick.current = false;
          }}
          onTouchStartCapture={() => {
            suppressPointerClick.current = false;
          }}
          onClickCapture={(event) => {
            if (suppressPointerClick.current && event.detail > 0) {
              event.preventDefault();
              event.stopPropagation();
              suppressPointerClick.current = false;
            }
          }}
          ref={root}
          className={`board ${styles.board} ${activeSquare ? "has-selection" : ""}`}
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
                tabIndex={focusedSquare === square ? 0 : -1}
                onFocus={setFocusedSquare}
                square={square}
                dark={(Math.floor(index / 8) + (index % 8)) % 2 === 1}
                draggable={
                  !!onMove && moves.some((move) => move.from === square)
                }
                dragging={!!dragging}
                selected={activeSquare === square}
                legal={activeLegal.includes(square)}
                capture={activeLegal.includes(square) && !!piece}
                last={
                  !!displayedLast &&
                  (displayedLast.from === square || displayedLast.to === square)
                }
                check={check === square}
                disabled={disabled}
                label={`${square}${piece?.description ? `, ${piece.description}` : piece ? `, ${piece.color === "w" ? "белые" : "чёрные"}: ${PIECE_NAMES[piece.type]}${piece.hp !== undefined ? `, здоровье ${piece.hp}` : ""}` : ", пусто"}${activeLegal.includes(square) ? ", доступный ход" : ""}`}
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
          {[
            ...pieces,
            ...reservePieces.filter(
              (piece) =>
                lastDrop?.id === piece.id &&
                !pieces.some((placed) => placed.id === piece.id),
            ),
          ].map((piece) => (
            <MovingPiece
              key={piece.id}
              piece={piece}
              orientation={orientation}
              skin={itemById(equipped.pieces[piece.type])?.style || "classic"}
              duration={duration}
              reduced={reduced}
              hidden={
                dragging?.id === piece.id ||
                !!(
                  !animateDraggedMove &&
                  lastDrop &&
                  piece.id !== lastDrop.id &&
                  piece.square === lastDrop.to &&
                  allPieces.some(
                    (source) =>
                      source.id === lastDrop.id &&
                      source.square === lastDrop.from,
                  )
                )
              }
              skipAnimation={!animateDraggedMove && lastDrop?.id === piece.id}
              target={
                attack?.id === piece.id
                  ? attack.to
                  : !animateDraggedMove && lastDrop?.id === piece.id
                    ? lastDrop.to
                    : undefined
              }
              damage={attack?.targetId === piece.id ? attack.damage : undefined}
            />
          ))}
        </div>
        {reserveContent}
        {typeof document !== "undefined" &&
          createPortal(
            <DragOverlay dropAnimation={null} zIndex={30}>
              {dragging ? (
                <span
                  className={`${styles.dragPreview} ${dragging.hp !== undefined ? styles.combat : ""}`}
                  aria-hidden="true"
                  style={
                    reservePieces.some((piece) => piece.id === dragging.id)
                      ? {
                          width: dragged?.size,
                          height: dragged?.size,
                          left: `calc(50% - ${(dragged?.size ?? 0) / 2}px)`,
                          top: `calc(50% - ${(dragged?.size ?? 0) / 2}px)`,
                        }
                      : undefined
                  }
                >
                  <Piece
                    type={dragging.type}
                    color={dragging.color}
                    style={
                      itemById(equipped.pieces[dragging.type])?.style ||
                      "classic"
                    }
                  />
                  {dragging.hp !== undefined && (
                    <span className="pve-vitals">
                      <span className="pve-level">{dragging.level}</span>
                      <span className="pve-hp">
                        <i
                          style={{
                            width: `${(100 * dragging.hp) / (dragging.maxHp || dragging.hp || 1)}%`,
                          }}
                        />
                      </span>
                    </span>
                  )}
                </span>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>
    );
  },
);
