import { GameReview } from "./GameReview.js";
import { useImportedGame } from "./ImportedGameProvider.js";
import { usePgnImportDialog } from "./PgnImportDialog.js";
import { useMemo } from "react";
import { Chess } from "chess.js";
export const PgnImport = () => {
  const { entry, setPlayerColor, saveAnalysis } = useImportedGame(),
    open = usePgnImportDialog();
  const pgn = entry?.pgn;
  const colors = useMemo(() => {
    if (!pgn) return new Set();
    const game = new Chess();
    game.loadPgn(pgn);
    return new Set(game.history({ verbose: true }).map((move) => move.color));
  }, [pgn]);
  return (
    <>
      {entry && (
        <>
          <div className="pgn-analysis-side">
            <span>Сторона разбора</span>
            <div
              className="segmented"
              role="group"
              aria-label="Сторона разбора"
            >
              {(
                [
                  ["w", "Белые"],
                  ["b", "Чёрные"],
                ] as const
              ).map(([color, label]) => (
                <button
                  key={color}
                  type="button"
                  className={entry.playerColor === color ? "active" : ""}
                  aria-pressed={entry.playerColor === color}
                  disabled={!colors.has(color)}
                  onClick={() => setPlayerColor(color)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <GameReview
            key={`${entry.id}:${entry.playerColor}`}
            entry={entry}
            showExport={false}
            onAnalysisReady={saveAnalysis}
          />
        </>
      )}
      {!entry && <button onClick={open}>Открыть PGN</button>}
    </>
  );
};
