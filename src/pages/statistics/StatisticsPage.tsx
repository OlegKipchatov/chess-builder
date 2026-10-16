import { useVault } from "../../app/providers/VaultProvider.js";
import { Page, Stat } from "../../shared/ui/Page.js";
export const StatisticsPage = () => {
  const archive = useVault((s) => s.archive),
    rating = useVault((s) => s.rating),
    owned = useVault((s) => s.owned.length),
    opened = useVault((s) => s.opened),
    games = archive.filter((e) => e.mode === "bot" && e.counted !== false),
    wins = games.filter((e) => e.result === "Победа").length,
    losses = games.filter((e) => e.result === "Поражение").length,
    draws = games.filter((e) => e.result === "Ничья").length,
    firstLoss = games.findIndex((e) => e.result !== "Победа"),
    streak = firstLoss < 0 ? games.length : firstLoss;
  return (
    <Page id="statistics" title="Статистика" back="/profile">
      <section className="statistics-group">
        <h2>Игра</h2>
        <div className="statistics-grid">
          <Stat label="Рейтинг" value={rating.value} />
          <Stat label="Партий с ИИ" value={games.length} />
          <Stat label="Победы" value={wins} />
          <Stat label="Поражения" value={losses} />
          <Stat label="Ничьи" value={draws} />
          <Stat
            label="Процент побед"
            value={
              games.length ? `${Math.round((wins / games.length) * 100)}%` : "—"
            }
          />
          <Stat label="Побед подряд" value={streak} />
        </div>
      </section>
      <section className="statistics-group statistics-progress">
        <h2>Прогресс</h2>
        <div className="statistics-grid">
          <Stat label="Предметов" value={owned} />
          <Stat label="Открыто сундуков" value={opened} />
        </div>
      </section>
    </Page>
  );
};
export default StatisticsPage;
