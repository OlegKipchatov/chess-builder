import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Color } from "chess.js";
import type { ArchiveEntry } from "../../domain/chess/types.js";
import type { GameAnalysis } from "../../domain/analysis/types.js";
type ImportedGame = {
  entry: ArchiveEntry | null;
  analyses: Partial<Record<Color, GameAnalysis>>;
};
const Context = createContext<{
  entry: ArchiveEntry | null;
  setEntry: (entry: ArchiveEntry | null) => void;
  setPlayerColor: (color: Color) => void;
  saveAnalysis: (analysis: GameAnalysis) => void;
} | null>(null);
export const ImportedGameProvider = ({ children }: { children: ReactNode }) => {
  const [{ entry }, setGame] = useState<ImportedGame>({
    entry: null,
    analyses: {},
  });
  const setEntry = useCallback((entry: ArchiveEntry | null) => {
    setGame({
      entry,
      analyses: entry?.analysis ? { [entry.playerColor]: entry.analysis } : {},
    });
  }, []);
  const setPlayerColor = useCallback((color: Color) => {
    setGame((current) =>
      !current.entry || current.entry.playerColor === color
        ? current
        : {
            ...current,
            entry: {
              ...current.entry,
              playerColor: color,
              analysis: current.analyses[color],
            },
          },
    );
  }, []);
  const saveAnalysis = useCallback((analysis: GameAnalysis) => {
    setGame((current) => {
      if (
        !current.entry ||
        current.entry.id !== analysis.gameId ||
        current.entry.pgn !== analysis.sourcePgn ||
        current.entry.playerColor !== analysis.playerColor
      )
        return current;
      const saved = { ...analysis, diagnostics: undefined };
      return {
        entry: { ...current.entry, analysis: saved },
        analyses: { ...current.analyses, [analysis.playerColor]: saved },
      };
    });
  }, []);
  return (
    <Context value={{ entry, setEntry, setPlayerColor, saveAnalysis }}>
      {children}
    </Context>
  );
};
export const useImportedGame = () => {
  const context = useContext(Context);
  if (!context) throw Error("ImportedGameProvider missing");
  return context;
};
