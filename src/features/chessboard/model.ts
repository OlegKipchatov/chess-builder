import type { Chess,Color,PieceSymbol,Square } from "chess.js";
import { Chess as ChessRules } from "chess.js";
export interface BoardPiece {
  id: string;
  square: string;
  type: PieceSymbol;
  color: Color;
  level?: number;
  hp?: number;
  maxHp?: number;
}
export const chessPieces = (game: Chess): BoardPiece[] => {
  const history = game.history({ verbose: true }),
    initial = new ChessRules(history[0]?.before || game.fen());
  const identities = new Map<string, string>(
    initial
      .board()
      .flat()
      .filter((p) => p !== null)
      .map((p) => [p.square, p.square]),
  );
  for (const move of history) {
    const id = identities.get(move.from) || move.from;
    identities.delete(move.from);
    if (move.flags.includes("e")) identities.delete(move.to[0] + move.from[1]);
    identities.set(move.to, id);
    for (const [flag, from, to] of [
      ["k", "h", "f"],
      ["q", "a", "d"],
    ])
      if (move.flags.includes(flag)) {
        const source = from + move.from[1],
          target = to + move.from[1];
        identities.set(target, identities.get(source) || source);
        identities.delete(source);
      }
  }
  return game
    .board()
    .flat()
    .filter((p) => p !== null)
    .map((p) => ({ ...p, id: identities.get(p.square) || p.square }));
};
export const boardSquares = Array.from(
  { length: 64 },
  (_, index) => ("abcdefgh"[index % 8] + (8 - Math.floor(index / 8))) as Square,
);
export const boardPoint = (square: string, orientation: Color) => {
  const x = square.charCodeAt(0) - 97,
    y = 8 - Number(square[1]);
  return orientation === "b" ? { x: 7 - x, y: 7 - y } : { x, y };
};
