import { useParams,useSearch } from "@tanstack/react-router";
import { useVault } from "../../app/providers/VaultProvider.js";
import { GameReview } from "../../features/game-review/GameReview.js";
import { Page } from "../../shared/ui/Page.js";
export const ReviewPage = () => {
  const { id } = useParams({ strict: false }),
    search = useSearch({ strict: false }),
    entry = useVault((s) => s.archive.find((game) => game.id === id));
  return (
    <Page id="analysis" title="Просмотр партии" back="/history">
      {entry ? (
        <GameReview
          key={entry.id}
          entry={entry}
          autoAnalyze={"analyze" in search && search.analyze === true}
        />
      ) : (
        <p role="alert">Партия не найдена.</p>
      )}
    </Page>
  );
};
export default ReviewPage;
