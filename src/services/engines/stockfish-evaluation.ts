import type { Color } from "chess.js";
import type { EngineLine,RawEngineLine } from "./types.js";
// Engine WDL is relative to the root side. Domain callers choose the perspective once.
export const normalizeWdl = (
  wdl: number[] | undefined,
  rootSide: Color = "w",
  playerColor: Color = rootSide,
) => {
  if (
    !Array.isArray(wdl) ||
    wdl.length !== 3 ||
    wdl.some((value) => !Number.isFinite(value) || value < 0) ||
    wdl.reduce((a, b) => a + b, 0) !== 1000
  )
    throw Error("Missing exact WDL");
  const [win, draw, loss] = rootSide === playerColor ? wdl : [...wdl].reverse();
  return { win: win / 1000, draw: draw / 1000, loss: loss / 1000 };
};
export const expectedScore = (
  row: RawEngineLine,
  rootSide: Color = "w",
  playerColor: Color = rootSide,
) => {
  if (row.scoreType === "mate")
    return (rootSide === playerColor ? row.scoreValue : -row.scoreValue) > 0
      ? 1
      : 0;
  const wdl = normalizeWdl(row.wdl, rootSide, playerColor);
  return wdl.win + wdl.draw * 0.5;
};
export const engineLine = (
  row: RawEngineLine,
  rootSide: Color,
  playerColor: Color,
  { pvLimit = row.scoreType === "mate" ? 8 : 4 } = {},
): EngineLine => ({
  move: row.move,
  rawScore: { type: row.scoreType, value: row.scoreValue },
  score: {
    type: row.scoreType,
    value: (rootSide === playerColor ? 1 : -1) * row.scoreValue,
  },
  ...(row.wdl ? { wdl: normalizeWdl(row.wdl, rootSide, playerColor) } : {}),
  expectedScorePlayer: expectedScore(row, rootSide, playerColor),
  pv: (row.pv || [row.move]).slice(0, pvLimit),
  depth: row.depth,
  nodes: row.nodes,
});
