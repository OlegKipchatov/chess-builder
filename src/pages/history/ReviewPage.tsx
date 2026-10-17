import { PgnEntryActions } from "../../features/game-review/PgnActions.js";
import { useRouter, useNavigate } from "@tanstack/react-router";
import { useHistoryReturn } from "../../features/game-review/HistoryReturnProvider.js";
import { useParams, useSearch } from "@tanstack/react-router";
import { useVault } from "../../app/providers/VaultProvider.js";
import { GameReview } from "../../features/game-review/GameReview.js";
import { Page } from "../../shared/ui/Page.js";
export const ReviewPage = () => {
  const origin = useHistoryReturn(),
    router = useRouter(),
    navigate = useNavigate();
  const { id } = useParams({ strict: false }),
    search = useSearch({ strict: false }),
    entry = useVault((s) => s.archive.find((game) => game.id === id));
  return (
    <Page
      actions={
        entry ? (
          <div id="archive-heading-actions">
            <PgnEntryActions entry={entry} />
          </div>
        ) : undefined
      }
      id="analysis"
      title="История партии"
      back="/history"
      onBack={() => {
        if (origin.fromList) {
          origin.fromList = false;
          router.history.back();
        } else void navigate({ to: origin.returnTo, replace: true });
      }}
    >
      {entry ? (
        <GameReview
          showExport={false}
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
