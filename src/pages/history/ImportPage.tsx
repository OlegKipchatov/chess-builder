import { PgnImport } from "../../features/game-review/PgnImport.js";
import { Page } from "../../shared/ui/Page.js";
export default function ImportPage() {
  return (
    <Page id="pgn-import" title="Открыть PGN" back="/profile">
      <PgnImport />
    </Page>
  );
}
