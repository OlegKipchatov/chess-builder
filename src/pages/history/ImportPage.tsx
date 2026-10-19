import { PgnImport } from "../../features/game-review/PgnImport.js";
import { useImportedGame } from "../../features/game-review/ImportedGameProvider.js";
import { PgnEntryActions } from "../../features/game-review/PgnActions.js";
import { Page } from "../../shared/ui/Page.js";
const ImportPage = () => {
  const { entry } = useImportedGame();
  return (
    <Page
      id="pgn-import"
      title="Просмотр партии"
      back="/profile"
      actions={entry ? <PgnEntryActions entry={entry} /> : undefined}
    >
      <PgnImport />
    </Page>
  );
};
export default ImportPage;
