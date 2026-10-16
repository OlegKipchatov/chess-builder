import { GameReview } from "./GameReview.js";
import { useImportedGame } from "./ImportedGameProvider.js";
import { usePgnImportDialog } from "./PgnImportDialog.js";
export const PgnImport = () => {
  const { entry } = useImportedGame(),
    open = usePgnImportDialog();
  return (
    <>
      {entry && <GameReview entry={entry} />}
      <button onClick={open}>
        {entry ? "Открыть другой PGN" : "Открыть PGN"}
      </button>
    </>
  );
};
