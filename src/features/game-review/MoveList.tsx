interface Props {
  moves: string[];
  cursor: number;
  onSeek: (ply: number) => void;
  important?: readonly number[];
}
export const MoveList = ({ moves, cursor, onSeek, important = [] }: Props) => (
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
            return (
              <button
                key={ply}
                className={`history-move ${cursor === ply ? "selected-move" : ""} ${important.includes(ply) ? "important" : ""}`}
                aria-current={cursor === ply ? "step" : undefined}
                onClick={() => onSeek(ply)}
              >
                {san}
              </button>
            );
          })}
        </li>
      ))}
    </ol>
  </div>
);
