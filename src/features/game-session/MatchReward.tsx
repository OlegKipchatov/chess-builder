import { ErrorNotification } from "../../shared/ui/ErrorNotification.js";
import type { RewardBreakdown } from "../../domain/economy/types.js";
import { useVault } from "../../app/providers/VaultProvider.js";
import { plural } from "../../shared/ui/Page.js";
export const RewardBreakdownView = ({
  breakdown,
}: {
  breakdown?: RewardBreakdown | null;
}) => {
  if (!breakdown) return null;
  const pending = ["pending", "unavailable"].includes(breakdown.qualityStatus);
  return (
    <>
      <p className="reward-total">
        +{breakdown.total}{" "}
        {plural(breakdown.total, ["монета", "монеты", "монет"])}
      </p>
      <dl className="reward-breakdown">
        <div>
          <dt>Партия завершена</dt>
          <dd>+{breakdown.completion}</dd>
        </div>
        <div>
          <dt>Результат партии</dt>
          <dd>+{breakdown.result}</dd>
        </div>
        {breakdown.qualityDetails ? (
          (["accuracy", "stability", "best"] as const).map((key, i) => (
            <div key={key}>
              <dt>{["Точность", "Стабильность", "Лучшие решения"][i]}</dt>
              <dd>+{breakdown.qualityDetails![key]}</dd>
            </div>
          ))
        ) : (
          <div>
            <dt>Качество решений</dt>
            <dd>{pending ? "Считаем…" : `+${breakdown.quality}`}</dd>
          </div>
        )}
      </dl>
      {pending && (
        <>
          <p className="reward-note" role="status">
            Оцениваем качество ходов…
          </p>
          <p className="reward-note">
            Можно продолжить: бонус начислится после анализа.
          </p>
        </>
      )}
      {breakdown.qualityStatus === "fallback" && (
        <ErrorNotification
          type="warning"
          message="Не удалось оценить качество после повторных попыток. Начислен резервный бонус: 5 монет."
        />
      )}
      {breakdown.reason === "early-resignation" && (
        <p className="reward-note">
          За эту партию монеты не начислены: сдача до 10 собственных ходов.
        </p>
      )}
    </>
  );
};
export const MatchReward = ({ id }: { id: string }) => {
  const breakdown = useVault(
    (state) => state.archive.find((entry) => entry.id === id)?.rewardBreakdown,
  );
  return <RewardBreakdownView breakdown={breakdown} />;
};
