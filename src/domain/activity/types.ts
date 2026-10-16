export type DailyMetric =
  | "games"
  | "wins"
  | "aiGames"
  | "aiMoves"
  | "aiCaptures"
  | "aiFinished"
  | "huntGames"
  | "huntScore"
  | "huntMoves"
  | "autoGames"
  | "miniGames";
export type DailyProgress = {
  games: number;
  wins: number;
  questVersion?: 2;
} & Partial<Record<DailyMetric, number>>;
export interface Activity {
  version: 1;
  timeZone: string;
  days: string[];
  frozen: string[];
  daily: Record<string, DailyProgress>;
  claimed: string[];
}
export interface ActivityEvent {
  date: string;
  streak: number;
}
export interface DailyTask {
  key: string;
  title: string;
  target: number;
  metric: DailyMetric;
  coins: number;
  kind?: "ai" | "mini";
  family?: string;
}
export interface CalendarReward {
  id: string;
  group: "daily" | "streak";
  period?: string;
  title: string;
  value: number;
  target: number;
  coins: number;
  shards: number;
  ready: boolean;
  claimed: boolean;
}
export interface ActivityWallet {
  activity: Activity;
  coins: number;
  shards: number;
}
export interface CalendarGame {
  won?: boolean;
  mode?: "ai" | "hunt" | "auto" | "pve";
  moves?: number;
  captures?: number;
  score?: number;
  resigned?: boolean;
  finishedAt?: string;
}
