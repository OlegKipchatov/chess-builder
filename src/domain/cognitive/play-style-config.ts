import type { PlayStyle } from "./types.js";
/** @typedef {'aggressive'|'solid'|'positional'|'tricky'} PlayStyle */
/** Public style IDs are stable. Coefficients weight normalized board features, not Elo. */
export const PLAY_STYLES = Object.freeze(
  Object.fromEntries(
    Object.entries({
      aggressive: {
        name: "Reina",
        attack: 1,
        safety: -0.25,
        position: 0.15,
        complexity: 0.65,
        exchange: -0.65,
      },
      solid: {
        name: "Bastion",
        attack: -0.15,
        safety: 1,
        position: 0.25,
        complexity: -0.65,
        exchange: 0.8,
      },
      positional: {
        name: "Silas",
        attack: 0.1,
        safety: 0.15,
        position: 1,
        complexity: 0.05,
        exchange: 0.1,
      },
      tricky: {
        name: "NIX-7",
        attack: 0.35,
        safety: -0.15,
        position: 0.1,
        complexity: 1,
        exchange: -0.8,
      },
    }).map(([id, value]) => [id, Object.freeze({ id, ...value })]),
  ),
);
export const validPlayStyle = (
  profile: unknown,
): profile is PlayStyle | undefined =>
  profile === undefined ||
  profile === "default" ||
  (typeof profile === "string" && Object.hasOwn(PLAY_STYLES, profile));

export const playStyleName = (profile: unknown, fallback = "ИИ") =>
  typeof profile === "string" && Object.hasOwn(PLAY_STYLES, profile)
    ? PLAY_STYLES[profile].name
    : fallback;
export const randomPlayStyle = (rng = Math.random) => {
  const ids = Object.keys(PLAY_STYLES);
  return ids[Math.floor(rng() * ids.length)] as PlayStyle;
};
