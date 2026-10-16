import type { Color,Move,Square } from "chess.js";
import { Chess } from "chess.js";
import { PLAY_STYLES,validPlayStyle } from "./play-style-config.js";
import type {
PlayStyle
} from "./types.js";

const clamp = (value: number) => Math.max(-1, Math.min(1, value));
const xy = (square: string) => [
  square.charCodeAt(0) - 97,
  Number(square[1]) - 1,
];
const center = (square: string) =>
  7 -
  Math.abs(square.charCodeAt(0) - 97 - 3.5) -
  Math.abs(Number(square[1]) - 1 - 3.5);
const distance = (a: string, b: string) =>
  Math.max(...xy(a).map((value, index) => Math.abs(value - xy(b)[index])));
const pieces = (game: Chess) =>
  game
    .board()
    .flat()
    .filter((piece) => piece !== null);
const value = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };

const kingDanger = (game: Chess, side: Color) => {
  const king = pieces(game).find(
    (piece) => piece.color === side && piece.type === "k",
  );
  if (!king) return 0;
  const enemy = side === "w" ? "b" : "w",
    [file, rank] = xy(king.square);
  let attacked = 0;
  for (let x = Math.max(0, file - 1); x <= Math.min(7, file + 1); x++)
    for (let y = Math.max(0, rank - 1); y <= Math.min(7, rank + 1); y++)
      if (
        game.isAttacked(
          (String.fromCharCode(97 + x) + (y + 1)) as Square,
          enemy,
        )
      )
        attacked++;
  return attacked / 9;
};

/** Cheap, visible-only style features. No engine score or hidden PV enters this layer. */
export const styleFeatures = (
  game: Chess,
  candidate: { move: Pick<Move, "from" | "to" | "piece" | "promotion"> },
) => {
  const move = candidate.move,
    side = game.turn(),
    enemy = side === "w" ? "b" : "w",
    before = pieces(game),
    enemyKing = before.find(
      (piece) => piece.color === enemy && piece.type === "k",
    )?.square;
  const beforeDanger = kingDanger(game, side),
    next = new Chess(game.fen()),
    played = next.move(move),
    after = pieces(next),
    replies = next.moves({ verbose: true });
  const attacked = after
    .filter(
      (piece) =>
        piece.color === side &&
        piece.type !== "k" &&
        next.isAttacked(piece.square, enemy) &&
        !next.isAttacked(piece.square, side),
    )
    .reduce((sum, piece) => sum + value[piece.type], 0);
  const castleSafety =
    played.flags.includes("k") || played.flags.includes("q") ? 0.35 : 0;
  const safety = clamp(
    beforeDanger - kingDanger(next, side) + castleSafety - attacked / 900,
  );
  const check = next.isCheck() || /[+#]/.test(played.san);
  const attack = clamp(
    (check ? 0.65 : 0) +
      (enemyKing
        ? (distance(move.from, enemyKing) - distance(move.to, enemyKing)) / 3
        : 0) +
      (played.captured ? value[played.captured] / 900 : 0),
  );
  const pawnAdvance = move.piece === "p" && !played.captured ? 0.15 : 0;
  const position = clamp(
    (center(move.to) - center(move.from)) / 7 + pawnAdvance,
  );
  const forcing = replies.filter(
    (reply) => reply.captured || /[+#]/.test(reply.san),
  ).length;
  const queensPresent =
    after.some((piece) => piece.type === "q" && piece.color === side) &&
    after.some((piece) => piece.type === "q" && piece.color === enemy);
  const queenComplexity = queensPresent ? 0.25 : 0,
    queenTradePenalty = played.captured === "q" ? 0.5 : 0;
  const complexity = clamp(
    (0.5 * replies.length) / 40 +
      (0.5 * forcing) / 12 +
      queenComplexity -
      queenTradePenalty,
  );
  const exchange = clamp(
    (played.captured ? value[played.captured] : 0) / 900 +
      (played.captured === "q" ? 1 : 0),
  );
  return {
    attack,
    safety,
    position,
    complexity,
    exchange,
    isCapture: !!played.captured,
    isCheck: check,
    queenTrade: played.piece === "q" && played.captured === "q",
  };
};

export const profileAdjustment = (
  game: Chess,
  candidate: { move: Pick<Move, "from" | "to" | "piece" | "promotion"> },
  profile: PlayStyle = "default",
  strength = 1,
) => {
  if (!profile || profile === "default") return 0;
  if (!validPlayStyle(profile)) throw RangeError("Unknown play style");
  const vector = PLAY_STYLES[profile],
    features = styleFeatures(game, candidate);
  return (
    strength *
    ["attack", "safety", "position", "complexity", "exchange"].reduce(
      (sum, key) =>
        sum +
        (features[
          key as "attack" | "safety" | "position" | "complexity" | "exchange"
        ] as number) *
          vector[
            key as "attack" | "safety" | "position" | "complexity" | "exchange"
          ],
      0,
    )
  );
};
