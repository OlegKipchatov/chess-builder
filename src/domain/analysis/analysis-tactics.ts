import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import type { Continuation } from "./types.js";

export interface TacticEvidence {
  kind: "fork" | "pin" | "discovered_attack" | "deflection";
  text: string;
  end: number;
}
const names: Record<PieceSymbol, string> = {
  p: "пешку",
  n: "коня",
  b: "слона",
  r: "ладью",
  q: "ферзя",
  k: "короля",
};
const actors: Record<PieceSymbol, string> = {
  p: "Пешка",
  n: "Конь",
  b: "Слон",
  r: "Ладья",
  q: "Ферзь",
  k: "Король",
};
const genitive: Record<PieceSymbol, string> = {
  p: "пешки",
  n: "коня",
  b: "слона",
  r: "ладьи",
  q: "ферзя",
  k: "короля",
};
const between = (from: Square, to: Square, blocker: Square) => {
  const x = (square: Square) => "abcdefgh".indexOf(square[0]);
  const y = (square: Square) => Number(square[1]);
  const dx = x(to) - x(from),
    dy = y(to) - y(from);
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  return Array.from(
    { length: Math.max(0, distance - 1) },
    (_, i) =>
      x(from) + Math.sign(dx) * (i + 1) === x(blocker) &&
      y(from) + Math.sign(dy) * (i + 1) === y(blocker),
  ).some(Boolean);
};
const play = (game: Chess, token: string) =>
  game.move({
    from: token.slice(0, 2),
    to: token.slice(2, 4),
    promotion: token[4],
  });
const tokens = (game: Chess, color: Color) => {
  const parts = game.fen().split(" ");
  parts[1] = color;
  parts[3] = "-";
  return new Chess(parts.join(" "))
    .moves({ verbose: true })
    .filter((move) => move.captured && move.captured !== "k");
};
const squareAt = (file: number, rank: number) =>
  file >= 0 && file < 8 && rank >= 0 && rank < 8
    ? (`${"abcdefgh"[file]}${rank + 1}` as Square)
    : null;
const rays = (piece: PieceSymbol) => [
  ...(["r", "q"].includes(piece)
    ? [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]
    : []),
  ...(["b", "q"].includes(piece)
    ? [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]
    : []),
];

// Only attach a tactical name to a material consequence actually present in
// the selected legal line. Geometry alone does not prove winning a piece.
export const tacticalEvidence = (
  fen: string,
  best: Continuation,
  actual: Continuation,
  color: Color,
): TacticEvidence | null => {
  if (
    !best.settled ||
    !actual.settled ||
    best.delta < 1 ||
    best.delta - actual.delta < 1
  )
    return null;
  const game = new Chess(fen);
  for (const step of best.steps) {
    const before = new Chess(game.fen());
    play(game, step.token);
    if (step.actor !== "player" || step.ply > 3) continue;
    const captures = tokens(game, color);
    const nextCapture = best.steps.find(
      (row) => row.actor === "player" && row.ply > step.ply && row.captured,
    );
    if (!nextCapture) continue;
    const target = `${names[nextCapture.captured!]} на ${nextCapture.to}`;
    const movedThreats = captures.filter(
      (row) => row.from === step.to && !["p", "k"].includes(row.captured!),
    );
    if (
      movedThreats.length + (step.check ? 1 : 0) >= 2 &&
      nextCapture.from === step.to &&
      movedThreats.some((row) => row.to === nextCapture.to)
    )
      return {
        kind: "fork",
        end: nextCapture.ply,
        text: `Вилка: ${actors[step.piece].toLowerCase()} одновременно атакует ${[...(step.check ? ["короля"] : []), ...movedThreats.map((row) => `${names[row.captured!]} на ${row.to}`)].join(" и ")}. В показанном варианте вы забираете ${target}.`,
      };
    // The moved blocker exposes another piece's line of attack, then that same
    // stationary piece captures its target. Pinned illegal captures are excluded.
    const oldCaptures = tokens(before, color);
    const discovered = captures.find(
      (row) =>
        row.from !== step.to &&
        between(row.from, row.to, step.from) &&
        row.from === nextCapture.from &&
        row.to === nextCapture.to &&
        !oldCaptures.some((old) => old.from === row.from && old.to === row.to),
    );
    if (discovered && rays(discovered.piece).length)
      return {
        kind: "discovered_attack",
        end: nextCapture.ply,
        text: `Вскрытое нападение: ${actors[step.piece].toLowerCase()} освобождает линию для ${genitive[discovered.piece]}. В показанном варианте вы забираете ${target}.`,
      };
    // Absolute pin: exactly one enemy piece lies between our slider and king.
    for (const piece of game.board().flat()) {
      if (!piece || piece.color !== color) continue;
      for (const [dx, dy] of rays(piece.type)) {
        let blocker: { square: Square; type: PieceSymbol } | null = null;
        for (let distance = 1; distance < 8; distance++) {
          const square = squareAt(
            "abcdefgh".indexOf(piece.square[0]) + dx * distance,
            Number(piece.square[1]) - 1 + dy * distance,
          );
          if (!square) break;
          const occupant = game.get(square);
          if (!occupant) continue;
          if (occupant.color === color) break;
          if (!blocker) {
            if (occupant.type === "k") break;
            blocker = { square, type: occupant.type };
            continue;
          }
          if (
            occupant.type === "k" &&
            nextCapture.to === blocker.square &&
            nextCapture.captured === blocker.type
          )
            return {
              kind: "pin",
              end: nextCapture.ply,
              text: `Связка: ${names[blocker.type]} на ${blocker.square} нельзя увести с линии короля. В показанном варианте вы забираете эту фигуру.`,
            };
          break;
        }
      }
    }
    // A defender accepts bait, leaving another target. Verify that before the
    // bait it could legally recapture the very capture used in the continuation.
    const reply = best.steps[step.ply];
    if (
      reply?.actor === "opponent" &&
      reply.captured &&
      reply.to === step.to &&
      nextCapture.ply === step.ply + 2
    ) {
      try {
        const probe = new Chess(before.fen());
        play(probe, nextCapture.token);
        const defended = probe
          .moves({ verbose: true })
          .some(
            (row) =>
              row.from === reply.from &&
              row.to === nextCapture.to &&
              row.captured,
          );
        if (defended)
          return {
            kind: "deflection",
            end: nextCapture.ply,
            text: `Отвлечение защитника: в показанном варианте ${actors[reply.piece].toLowerCase()} соперника принимает жертву на ${reply.to} и оставляет ${target} без своей защиты. Вы забираете эту фигуру.`,
          };
      } catch {
        /* A capture unavailable before the bait does not prove deflection. */
      }
    }
  }
  return null;
};
