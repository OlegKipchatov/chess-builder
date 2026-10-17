import type { MoveAnnotation } from "./annotations.js";
interface Props {
  moves: string[];
  cursor: number;
  onSeek: (ply: number) => void;
  annotations?: readonly MoveAnnotation[];
}
export const MoveList = ({
  moves,
  cursor,
  onSeek,
  annotations = [],
}: Props) => (
  <div className="move-log">
    <div className="section-header">
      <h2>Ходы</h2>
    </div>
    <ol className="moves" aria-label="Ходы партии">
      {Array.from({ length: Math.ceil(moves.length / 2) }, (_, row) => (
        <li key={row} className="move-row">
          <span>{row + 1}.</span>
          {moves.slice(row * 2, row * 2 + 2).map((san, column) => {
            const ply = row * 2 + column + 1;
            const annotation = annotations.find((item) => item.ply === ply);
            return (
              <button
                key={ply}
                className={`history-move ${cursor === ply ? "selected-move" : ""}`}
                data-quality={annotation?.quality}
                aria-label={
                  annotation
                    ? `${Math.ceil(ply / 2)}${ply % 2 ? "." : "…"} ${san}, ${annotation.label}`
                    : undefined
                }
                aria-current={cursor === ply ? "step" : undefined}
                onClick={() => onSeek(ply)}
              >
                {san}
                {annotation?.symbol && <small> {annotation.symbol}</small>}
              </button>
            );
          })}
        </li>
      ))}
    </ol>
  </div>
);
