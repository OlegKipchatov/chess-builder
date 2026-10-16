export const MoveNavigation = ({
  cursor,
  total,
  onSeek,
  playing,
  onPlay,
}: {
  cursor: number;
  total: number;
  onSeek: (ply: number) => void;
  playing?: boolean;
  onPlay?: () => void;
}) => (
  <div className="history-controls" aria-label="Просмотр ходов">
    <button aria-label="В начало" disabled={!cursor} onClick={() => onSeek(0)}>
      ⇤
    </button>
    <button
      aria-label="Предыдущий ход"
      disabled={!cursor}
      onClick={() => onSeek(cursor - 1)}
    >
      ←
    </button>
    {onPlay && (
      <button aria-label={playing ? "Пауза" : "Воспроизвести"} onClick={onPlay}>
        {playing ? "Ⅱ" : "▶"}
      </button>
    )}
    <span aria-live="polite">
      {cursor} / {total}
    </span>
    <button
      aria-label="Следующий ход"
      disabled={cursor >= total}
      onClick={() => onSeek(cursor + 1)}
    >
      →
    </button>
    <button
      aria-label="В конец"
      disabled={cursor >= total}
      onClick={() => onSeek(total)}
    >
      ⇥
    </button>
  </div>
);
