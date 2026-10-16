import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault, useVaultStore } from "../../app/providers/VaultProvider.js";
import {
  activityDate,
  currentStreak,
  dayLabel,
} from "../../domain/activity/activity-model.js";
import {
  buyFreeze,
  claimCalendarReward,
  FREEZE_COST,
  freezeCandidate,
  visibleCalendarRewards,
} from "../../domain/activity/calendar-rewards.js";
import type { CalendarReward } from "../../domain/activity/types.js";
import { useClock } from "../../shared/hooks/useClock.js";
import { Page } from "../../shared/ui/Page.js";
export const ActivityPage = ({
  streakOnly = false,
}: {
  streakOnly?: boolean;
}) => {
  const activity = useVault((s) => s.activity),
    shards = useVault((s) => s.shards),
    store = useVaultStore(),
    { toast } = useOverlays(),
    now = useClock(),
    today = activityDate(now, activity.timeZone),
    month = today.slice(0, 7),
    first = new Date(`${month}-01T12:00:00Z`),
    offset = (first.getUTCDay() + 6) % 7,
    total = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
  const rewards = visibleCalendarRewards(activity, new Date(now)),
    track = rewards.find((row) => row.group === "streak"),
    streak = currentStreak(activity, today),
    candidate = freezeCandidate(activity, today),
    title = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(first);
  const commit = async (transform: Parameters<typeof store.update>[0]) => {
    const result = await store.update(transform);
    if (!result.ok) toast(result.error.message);
  };
  const amount = (row: CalendarReward) => (
    <>
      <span className="calendar-coins">◈ {row.coins}</span>
      {row.shards > 0 && (
        <span className="calendar-shards"> ✧ {row.shards}</span>
      )}
    </>
  );
  const action = (row: CalendarReward) =>
    row.claimed ? (
      <span
        className="quest-completed"
        role="img"
        aria-label={`Награда получена: ${row.title}`}
      >
        ✓
      </span>
    ) : (
      <button
        className={row.ready ? "primary" : "secondary"}
        disabled={!row.ready}
        onClick={() =>
          void commit((s) => claimCalendarReward(s, row.id, new Date()))
        }
        aria-label={`${row.ready ? "Забрать награду" : "В процессе"}: ${row.title}`}
      >
        {row.ready ? "Забрать" : amount(row)}
      </button>
    );
  const reward = (row: CalendarReward) => (
    <div
      className={`calendar-reward ${row.claimed ? "is-claimed" : ""}`}
      key={row.id}
    >
      <span className="quest-symbol" aria-hidden="true">
        {row.id.endsWith(":all")
          ? "★"
          : row.id.includes(":ai-")
            ? "♞"
            : row.id.includes(":hunt-")
              ? "♜"
              : "◆"}
      </span>
      <div className="calendar-reward-copy">
        <h3>{row.title}</h3>
        <p>
          {row.value} / {row.target}
          {row.ready && !row.claimed && <> · {amount(row)}</>}
          {row.period &&
            row.period !== today &&
            ` · ${row.period.split("-").reverse().join(".")}`}
        </p>
        <progress max={row.target} value={row.value} aria-label={row.title} />
      </div>
      {action(row)}
    </div>
  );
  const daily = rewards.filter(
      (row) => row.group === "daily" && row.period === today,
    ),
    pending = rewards.filter(
      (row) =>
        row.ready &&
        !row.claimed &&
        row.period &&
        row.period !== (row.group === "daily" ? today : month),
    );
  return (
    <Page
      id={streakOnly ? "streak" : "calendar"}
      title={streakOnly ? "Серия активности" : "Календарь активности"}
      back="/play"
    >
      <div className="calendar-layout">
        {streakOnly ? (
          <>
            <article className="panel activity-calendar">
              <div className="calendar-month-heading">
                <h2>{title}</h2>
                <span className="streak-chip">ϟ {dayLabel(streak)}</span>
              </div>
              <div className="calendar-grid" role="group" aria-label={title}>
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                  <span className="calendar-weekday" key={day}>
                    {day}
                  </span>
                ))}
                {Array.from(
                  { length: Math.ceil((offset + total) / 7) * 7 },
                  (_, index) => {
                    const date = new Date(
                        Date.UTC(
                          first.getUTCFullYear(),
                          first.getUTCMonth(),
                          index - offset + 1,
                        ),
                      ),
                      day = date.toISOString().slice(0, 10),
                      closed = activity.days.includes(day),
                      frozen = activity.frozen.includes(day),
                      current = day === today;
                    return (
                      <span
                        key={day}
                        className={`calendar-day ${closed ? "closed" : frozen ? "frozen" : ""} ${current ? "today" : ""} ${day > today ? "future" : ""} ${day.slice(0, 7) !== month ? "adjacent" : ""}`}
                        aria-current={current ? "date" : undefined}
                        aria-label={`${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(date)}, ${closed ? "сыграна партия" : frozen ? "заморожен, серия сохранена" : current ? "сегодня" : day > today ? "будущий день" : "без партии"}`}
                      >
                        {date.getUTCDate()}
                      </span>
                    );
                  },
                )}
              </div>
              <p className="calendar-legend">
                <span>
                  <i className="calendar-key" aria-hidden="true" /> С игрой
                </span>
                <span>
                  <i className="calendar-key today" aria-hidden="true" />{" "}
                  Сегодня
                </span>
                <span>
                  <i className="calendar-key frozen" /> Заморожен
                </span>
              </p>
            </article>
            {candidate && (
              <section className="panel calendar-freeze">
                <h2>Сохранить серию</h2>
                <p>Заморозить {candidate}</p>
                <button
                  disabled={shards < FREEZE_COST}
                  onClick={() => void commit((s) => buyFreeze(s))}
                >
                  ❄ Заморозить · {FREEZE_COST} ✧
                </button>
              </section>
            )}
          </>
        ) : (
          <>
            <div className="calendar-tracks">
              <article className="calendar-track streak-card">
                <div className="streak-card-heading">
                  <h2>ϟ Серия</h2>
                  <strong>{dayLabel(streak)}</strong>
                </div>
                {track ? (
                  <>
                    <div className="streak-card-body">
                      <div className="streak-card-prize">
                        <p>Награда за {track.target}-й день</p>
                        <div className="streak-card-amount">
                          {amount(track)}
                        </div>
                      </div>
                      <div className="streak-card-action">
                        {track.ready ? (
                          action(track)
                        ) : (
                          <span>
                            Ещё{" "}
                            {dayLabel(
                              track.target - Math.min(streak, track.target),
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <progress
                      className="streak-progress"
                      max={track.target}
                      value={
                        track.ready
                          ? track.target
                          : Math.min(streak, track.target)
                      }
                      aria-label="Прогресс серии"
                    />
                  </>
                ) : (
                  <p>Все награды получены ✓</p>
                )}
              </article>
            </div>
            <section className="panel calendar-rewards">
              <div className="quest-heading">
                <h2>Задачи на сегодня</h2>
                <span>
                  {
                    daily.filter((row) => !row.id.endsWith(":all") && row.ready)
                      .length
                  }{" "}
                  / 5
                </span>
              </div>
              {daily.map(reward)}
            </section>
            {pending.length > 0 && (
              <section className="panel calendar-rewards">
                <h2>Ждут получения</h2>
                {pending.map(reward)}
              </section>
            )}
          </>
        )}
      </div>
    </Page>
  );
};
export const StreakPage = () => <ActivityPage streakOnly />;
export default ActivityPage;
