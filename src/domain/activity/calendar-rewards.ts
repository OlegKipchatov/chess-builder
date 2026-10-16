import {
activityDate,
closeActivityDay,
currentStreak,
normalizeActivity,
previousDay,
} from "./activity-model.js";
import type {
Activity,
ActivityWallet,
CalendarGame,
CalendarReward,
DailyMetric,
DailyProgress,
DailyTask,
} from "./types.js";
export const FREEZE_COST = 10;
export const DAILY_TASKS: DailyTask[] = [
  {
    key: "play",
    title: "Завершить игру",
    target: 1,
    metric: "games",
    coins: 5,
  },
  {
    key: "three",
    title: "Завершить 3 игры",
    target: 3,
    metric: "games",
    coins: 10,
  },
  {
    key: "win",
    title: "Победить или набрать 20 очков в охоте",
    target: 1,
    metric: "wins",
    coins: 10,
  },
];
export const TASK_POOL: DailyTask[] = [
  {
    key: "ai-game",
    title: "Завершить партию с ИИ",
    metric: "aiGames",
    target: 1,
    kind: "ai",
    family: "games",
  },
  {
    key: "ai-moves-10",
    title: "Сделать 10 ходов против ИИ",
    metric: "aiMoves",
    target: 10,
    kind: "ai",
    family: "moves",
  },
  {
    key: "ai-moves-20",
    title: "Сделать 20 ходов против ИИ",
    metric: "aiMoves",
    target: 20,
    kind: "ai",
    family: "moves",
  },
  {
    key: "ai-captures-2",
    title: "Взять 2 фигуры против ИИ",
    metric: "aiCaptures",
    target: 2,
    kind: "ai",
    family: "captures",
  },
  {
    key: "ai-captures-4",
    title: "Взять 4 фигуры против ИИ",
    metric: "aiCaptures",
    target: 4,
    kind: "ai",
    family: "captures",
  },
  {
    key: "ai-finish",
    title: "Завершить партию с ИИ без сдачи",
    metric: "aiFinished",
    target: 1,
    kind: "ai",
    family: "finish",
  },
  {
    key: "hunt-game",
    title: "Завершить охоту",
    metric: "huntGames",
    target: 1,
    kind: "mini",
    family: "hunt",
  },
  {
    key: "hunt-score",
    title: "Набрать 10 очков в охоте",
    metric: "huntScore",
    target: 10,
    kind: "mini",
    family: "hunt",
  },
  {
    key: "auto-game",
    title: "Завершить бой в автошахматах",
    metric: "autoGames",
    target: 1,
    kind: "mini",
    family: "auto",
  },
  {
    key: "mini-two",
    title: "Завершить 2 мини-игры",
    metric: "miniGames",
    target: 2,
    kind: "mini",
    family: "mini",
  },
  {
    key: "mini-moves",
    title: "Сделать 10 ходов в охоте",
    metric: "huntMoves",
    target: 10,
    kind: "mini",
    family: "hunt",
  },
].map((task) => ({ ...task, coins: 8 })) as DailyTask[];
// Stable seeded shuffle: reloads and repeated renders never reroll today's quests.
export const dailyTasks = (day: string): DailyTask[] => {
  let seed = [...day].reduce(
    (value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pick = (kind: "ai" | "mini") => {
    const pool = TASK_POOL.filter((task) => task.kind === kind);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen: DailyTask[] = [];
    for (const task of pool)
      if (
        !chosen.some((row) => row.family === task.family) &&
        chosen.length < 2
      )
        chosen.push(task);
    return chosen;
  };
  return [{ ...DAILY_TASKS[0], coins: 8 }, ...pick("ai"), ...pick("mini")];
};
export const STREAK_REWARDS = [
  [1, 10],
  [3, 20],
  [5, 30],
  [7, 50],
  [14, 100],
  [21, 150],
  [30, 200],
  [45, 250],
  [60, 300],
  [90, 400],
];
export const recordCalendarGame = <T extends ActivityWallet>(
  wallet: T,
  {
    won = false,
    mode = "ai",
    moves = 0,
    captures = 0,
    score = 0,
    resigned = false,
    finishedAt = new Date().toISOString(),
  }: CalendarGame = {},
): T => {
  const activity = normalizeActivity(wallet.activity),
    day = activityDate(finishedAt, activity.timeZone),
    row = activity.daily[day] || { games: 0, wins: 0 };
  const next = closeActivityDay(activity, {
    counted: true,
    finishedAt,
  }).activity;
  const updated: DailyProgress = {
    ...Object.fromEntries(
      [
        "aiGames",
        "aiMoves",
        "aiCaptures",
        "aiFinished",
        "huntGames",
        "huntScore",
        "huntMoves",
        "autoGames",
        "miniGames",
      ].map((key) => [key, row[key as DailyMetric] || 0]),
    ),
    ...row,
    questVersion: 2,
    games: row.games + 1,
    wins: row.wins + (won ? 1 : 0),
  };
  const add = (key: DailyMetric, value = 1) => {
    updated[key] =
      (row[key as DailyMetric] || 0) + Math.max(0, Math.floor(value));
  };
  if (mode === "ai") {
    add("aiGames");
    add("aiMoves", moves);
    add("aiCaptures", captures);
    if (!resigned) add("aiFinished");
  }
  if (mode === "hunt") {
    add("huntGames");
    add("huntScore", score);
    add("huntMoves", moves);
    add("miniGames");
  }
  if (mode === "auto") {
    add("autoGames");
    add("miniGames");
  }
  return {
    ...wallet,
    activity: {
      ...next,
      frozen: activity.frozen.filter((date) => date !== day),
      daily: { ...activity.daily, [day]: updated },
    },
  };
};
export const freezeCandidate = (activity: Activity, today: string) => {
  const day = previousDay(today);
  if (activity.days.includes(day) || (activity.frozen || []).includes(day))
    return null;
  return currentStreak(activity, day) > 0 ? day : null;
};
export const buyFreeze = <T extends ActivityWallet>(
  wallet: T,
  now = new Date(),
): T => {
  const activity = normalizeActivity(wallet.activity),
    today = activityDate(now, activity.timeZone),
    day = freezeCandidate(activity, today);
  if (!day || wallet.shards < FREEZE_COST) return wallet;
  return {
    ...wallet,
    shards: wallet.shards - FREEZE_COST,
    activity: { ...activity, frozen: [...activity.frozen, day].sort() },
  };
};
export const calendarRewards = (
  input: Partial<Activity> | null | undefined,
  now = new Date(),
): CalendarReward[] => {
  const activity = normalizeActivity(input),
    today = activityDate(now, activity.timeZone),
    month = today.slice(0, 7),
    claimed = new Set(activity.claimed),
    rewards: CalendarReward[] = [];
  const add = (row: Omit<CalendarReward, "claimed">) =>
    rewards.push({ ...row, claimed: claimed.has(row.id) });
  for (const day of [
    ...new Set([...Object.keys(activity.daily), today]),
  ].sort()) {
    if (day > today) continue;
    const progress = activity.daily[day] || { games: 0, wins: 0 };
    const tasks =
      day === today || progress.questVersion === 2
        ? dailyTasks(day)
        : DAILY_TASKS;
    for (const task of tasks) {
      const value = Math.min(task.target, progress[task.metric] || 0);
      if (day === today || value >= task.target)
        add({
          id: `daily:${day}:${task.key}`,
          group: "daily",
          period: day,
          title: task.title,
          value,
          target: task.target,
          coins: task.coins,
          shards: 0,
          ready: value >= task.target,
        });
    }
    const value = tasks.filter(
      (task) => (progress[task.metric] || 0) >= task.target,
    ).length;
    if (day === today || value === tasks.length)
      add({
        id: `daily:${day}:all`,
        group: "daily",
        period: day,
        title: "Все задачи дня",
        value,
        target: tasks.length,
        coins: 20,
        shards: 5,
        ready: value === tasks.length,
      });
  }
  const best = activity.days
    .filter((day) => day <= today)
    .reduce((best, day) => Math.max(best, currentStreak(activity, day)), 0);
  for (const [target, coins] of STREAK_REWARDS)
    add({
      id: `streak:${target}`,
      group: "streak",
      title: `Серия ${target} дней`,
      value: Math.min(best, target),
      target,
      coins,
      shards: 0,
      ready: best >= target,
    });
  return rewards;
};
export const visibleCalendarRewards = (
  activity: Activity,
  now = new Date(),
) => {
  const rewards = calendarRewards(activity, now),
    seen = new Set();
  return rewards.filter((row) => {
    if (row.group === "daily") return true;
    const key = row.group + ":" + (row.period || "");
    if (row.claimed || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
export const claimCalendarReward = <T extends ActivityWallet>(
  wallet: T,
  id: string,
  now = new Date(),
): T => {
  const reward = visibleCalendarRewards(wallet.activity, now).find(
    (row) => row.id === id,
  );
  if (!reward?.ready || reward.claimed) return wallet;
  return {
    ...wallet,
    coins: wallet.coins + reward.coins,
    shards: wallet.shards + reward.shards,
    activity: {
      ...normalizeActivity(wallet.activity),
      claimed: [...(wallet.activity.claimed || []), id],
    },
  };
};
