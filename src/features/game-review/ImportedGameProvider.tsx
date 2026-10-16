import { createContext, useContext, useState, type ReactNode } from "react";
import type { ArchiveEntry } from "../../domain/chess/types.js";
const Context = createContext<{
  entry: ArchiveEntry | null;
  setEntry: (entry: ArchiveEntry | null) => void;
} | null>(null);
export const ImportedGameProvider = ({ children }: { children: ReactNode }) => {
  const [entry, setEntry] = useState<ArchiveEntry | null>(null);
  return <Context value={{ entry, setEntry }}>{children}</Context>;
};
export const useImportedGame = () => {
  const context = useContext(Context);
  if (!context) throw Error("ImportedGameProvider missing");
  return context;
};
