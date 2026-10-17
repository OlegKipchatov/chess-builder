import { Chess } from "chess.js";
import { ControlIcon } from "../../shared/ui/ControlIcon.js";
import { useMemo, useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import type { ArchiveEntry, SavedGame } from "../../domain/chess/types.js";
import {
  downloadPgn,
  exportPgn,
  sharePgn,
} from "../../shared/lib/pgn-export.js";
const ExportDialog = ({ pgn }: { pgn: string }) => {
  const [message, setMessage] = useState("");
  return (
    <>
      <textarea
        readOnly
        value={pgn}
        aria-label="PGN партии"
        style={{ fontSize: 16, width: "100%", minHeight: 160 }}
      />
      <div className="dialog-actions pgn-actions">
        <button
          onClick={() =>
            void Promise.resolve()
              .then(() => navigator.clipboard.writeText(pgn))
              .then(
                () => setMessage("PGN скопирован"),
                () =>
                  setMessage("Не удалось скопировать. Выделите текст выше."),
              )
          }
        >
          Копировать
        </button>
        <button onClick={() => downloadPgn(pgn)}>Скачать</button>
        <button
          onClick={() =>
            void sharePgn(pgn).catch(() => setMessage("Не удалось поделиться"))
          }
        >
          Поделиться
        </button>
      </div>
      <p role="status">{message}</p>
    </>
  );
};
export const PgnActions = ({
  game,
  config,
  compact = false,
}: {
  game: Chess;
  config: Partial<SavedGame & ArchiveEntry>;
  compact?: boolean;
}) => {
  const { show } = useOverlays();
  return (
    <button
      id="export-pgn"
      className={compact ? "quiet icon-button" : "quiet"}
      aria-label="Экспортировать PGN"
      title="Экспортировать PGN"
      onClick={() =>
        show({
          title: "PGN партии",
          body: (
            <ExportDialog
              pgn={config.imported ? game.pgn() : exportPgn(game, config)}
            />
          ),
        })
      }
    >
      {compact ? <ControlIcon name="download" /> : "Экспортировать PGN"}
    </button>
  );
};

export const PgnEntryActions = ({ entry }: { entry: ArchiveEntry }) => {
  const game = useMemo(() => {
    const game = new Chess();
    try {
      game.loadPgn(entry.pgn);
      return game;
    } catch {
      return null;
    }
  }, [entry.pgn]);
  return game ? <PgnActions game={game} config={entry} compact /> : null;
};
