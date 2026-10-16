import { ControlIcon } from "../../shared/ui/ControlIcon.js";
import { motionDuration } from "../../shared/styles/motion.js";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "../../shared/hooks/useReducedMotion.js";
interface Props {
  variant?: boolean;
  cursor: number;
  total: number;
  onSeek: (ply: number) => void;
  playing?: boolean;
  onPlay?: () => void;
  markers?: number[];
}
export const MoveNavigation = ({
  cursor,
  total,
  onSeek,
  playing,
  onPlay,
  markers = [],
  variant = false,
}: Props) => {
  const prefix = variant ? "variation" : "history";
  const [thumb, setThumb] = useState(cursor),
    dragging = useRef(false),
    previous = useRef(cursor),
    reduced = useReducedMotion();
  useEffect(() => {
    const from = previous.current;
    previous.current = cursor;
    if (dragging.current) return;
    if (!playing || reduced || cursor !== from + 1) {
      setThumb(cursor);
      return;
    }
    let frame = 0,
      start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const fraction = Math.min(1, (now - start) / motionDuration.board);
      setThumb(from + (cursor - from) * fraction);
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cursor, playing, reduced]);
  const seek = (value: number) => {
    const ply = Math.max(0, Math.min(total, Math.round(value)));
    setThumb(dragging.current ? value : ply);
    onSeek(ply);
  };
  const finish = () => {
    dragging.current = false;
    setThumb(Math.round(thumb));
  };
  return (
    <div className="history-controls" role="group" aria-label="История ходов">
      <div className="history-buttons">
        <button
          className="icon-button"
          id={`${prefix}-back`}
          aria-label="Предыдущая позиция"
          disabled={!cursor}
          onClick={() => seek(cursor - 1)}
        >
          <ControlIcon name="previous" />
        </button>
        {onPlay && (
          <button
            className="icon-button"
            id={playing ? "replay-pause" : "replay-start"}
            aria-label={
              playing
                ? "Приостановить воспроизведение"
                : "Начать воспроизведение"
            }
            onClick={onPlay}
          >
            <ControlIcon name={playing ? "pause" : "play"} />
          </button>
        )}
        <button
          className="icon-button"
          id={`${prefix}-forward`}
          data-variation-next={variant ? true : undefined}
          aria-label="Следующая позиция"
          disabled={cursor >= total}
          onClick={() => seek(cursor + 1)}
        >
          <ControlIcon name="next" />
        </button>
        <button
          className="icon-button"
          id={`${prefix}-live`}
          aria-label="К текущему ходу"
          disabled={cursor >= total}
          onClick={() => seek(total)}
        >
          <ControlIcon name="live" />
        </button>
      </div>
      <span id={`${prefix}-position`} aria-live="polite">
        {cursor} / {total}
      </span>
      <div className="history-timeline">
        <input
          id={`${prefix}-slider`}
          className="history-slider"
          type="range"
          min={0}
          max={total}
          step="any"
          value={thumb}
          disabled={!total}
          aria-label="Позиция в истории партии"
          aria-valuetext={`${cursor} из ${total}`}
          style={
            {
              "--history-progress": `${total ? (thumb / total) * 100 : 0}%`,
            } as CSSProperties
          }
          onPointerDown={() => {
            dragging.current = true;
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          onBlur={finish}
          onChange={(event) => seek(Number(event.target.value))}
          onKeyDown={(event) => {
            const targets: Record<string, number> = {
              ArrowRight: cursor + 1,
              ArrowUp: cursor + 1,
              ArrowLeft: cursor - 1,
              ArrowDown: cursor - 1,
              Home: 0,
              End: total,
              PageUp: cursor + 10,
              PageDown: cursor - 10,
            };
            const target = targets[event.key];
            if (target !== undefined) {
              event.preventDefault();
              dragging.current = false;
              seek(target);
            }
          }}
        />
        {markers.length > 0 && (
          <div
            className="history-markers"
            role="group"
            aria-label="Моменты разбора"
          >
            {markers.map((ply) => (
              <button
                key={ply}
                className="history-marker"
                aria-label={`Разбор хода ${ply}`}
                style={{ left: `${(ply / total) * 100}%` }}
                onClick={() => seek(ply)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
