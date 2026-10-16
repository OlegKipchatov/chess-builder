import { useState } from "react";
import { useVault } from "../../app/providers/VaultProvider.js";
import type { ArchiveEntry } from "../../domain/chess/types.js";
import { importPgn,MAX_PGN_BYTES } from "../../shared/lib/pgn-import.js";
import { GameReview } from "./GameReview.js";
export const PgnImport = () => {
  const equipped = useVault((s) => s.equipped),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [entry, setEntry] = useState<ArchiveEntry | null>(null);
  const open = () => {
    try {
      const { game } = importPgn(text);
      setEntry({
        id: "imported",
        pgn: game.pgn(),
        finishedAt: new Date().toISOString(),
        mode: "local",
        playerColor: "w",
        equipped,
        result: game.getHeaders().Result || "*",
        points: 0,
        playerRating: 0,
        opponentRating: null,
        ratingDelta: null,
        engineProfile: null,
        imported: true,
        counted: false,
      });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return entry ? (
    <>
      <GameReview entry={entry} />
      <button onClick={() => setEntry(null)}>Открыть другой PGN</button>
    </>
  ) : (
    <>
      <p>Откройте одну партию. Импорт не меняет историю, рейтинг и награды.</p>
      <label>
        Текст PGN
        <textarea
          style={{ fontSize: 16, width: "100%", minHeight: 200 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <label>
        Файл PGN
        <input
          type="file"
          accept=".pgn,text/plain,application/x-chess-pgn"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_PGN_BYTES) {
              setError("Максимальный размер — 512 КБ");
              return;
            }
            setText(await file.text());
            setError("");
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="primary wide" onClick={open}>
        Открыть партию
      </button>
    </>
  );
};
