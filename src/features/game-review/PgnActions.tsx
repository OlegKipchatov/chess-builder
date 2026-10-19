import { Chess } from "chess.js";
import { ControlIcon } from "../../shared/ui/ControlIcon.js";
import { useMemo } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import type { ArchiveEntry, SavedGame } from "../../domain/chess/types.js";
import {
  canSharePgn,
  downloadPgn,
  exportPgn,
  sharePgn,
} from "../../shared/lib/pgn-export.js";
const ExportDialog = ({ pgn }: { pgn: string }) => {
  const { toast } = useOverlays();
  const canShare = canSharePgn(pgn);
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
          type="button"
          className="quiet icon-button"
          aria-label="Копировать"
          title="Копировать"
          onClick={() =>
            void Promise.resolve()
              .then(() => navigator.clipboard.writeText(pgn))
              .then(
                () => toast("PGN скопирован"),
                () =>
                  toast("Не удалось скопировать. Выделите текст PGN.", {
                    error: true,
                  }),
              )
          }
        >
          <ControlIcon name="copy" />
        </button>
        <button
          type="button"
          className="quiet icon-button"
          aria-label={canShare ? "Поделиться" : "Скачать"}
          title={canShare ? "Поделиться" : "Скачать"}
          onClick={() => {
            if (canShare)
              void sharePgn(pgn).catch(() =>
                toast("Не удалось поделиться", { error: true }),
              );
            else {
              try {
                downloadPgn(pgn);
              } catch {
                toast("Не удалось скачать", { error: true });
              }
            }
          }}
        >
          <ControlIcon name={canShare ? "share" : "download"} />
        </button>
      </div>
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
