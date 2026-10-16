import type { Chess } from "chess.js";
import { useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import type { ArchiveEntry,SavedGame } from "../../domain/chess/types.js";
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
      <div className="dialog-actions">
        <button
          onClick={() =>
            void navigator.clipboard.writeText(pgn).then(
              () => setMessage("Скопировано"),
              () => setMessage("Не удалось скопировать. Выделите текст выше."),
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
}: {
  game: Chess;
  config: Partial<SavedGame & ArchiveEntry>;
}) => {
  const { show } = useOverlays();
  return (
    <button
      className="quiet"
      onClick={() =>
        show({
          title: "PGN партии",
          body: <ExportDialog pgn={exportPgn(game, config)} />,
        })
      }
    >
      Экспорт PGN
    </button>
  );
};
