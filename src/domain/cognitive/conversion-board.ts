import type { Chess,Square } from "chess.js";
import type { ConversionMove,RawMove } from "./types.js";
interface ChessInternals {
  _moves: () => RawMove[];
  _makeMove: (move: RawMove) => void;
  _undoMove: () => RawMove | null;
}
const internals = (game: Chess) => game as unknown as ChessInternals;
/**
 * SAN-free adapter for the bundled chess.js. Private calls are isolated here.
 * _makeMove does NOT update repetition counts: conversion-history owns them.
 * Contract tests compare moves/terminal states with the public Chess API.
 */
const square = (index: number): Square =>
  (String.fromCharCode(97 + (index & 7)) + (8 - (index >> 4))) as Square;
export const conversionMoves = (game: Chess): ConversionMove[] =>
  internals(game)
    ._moves()
    .map((raw) => ({
      raw,
      from: square(raw.from),
      to: square(raw.to),
      piece: raw.piece,
      captured: raw.captured,
      promotion: raw.promotion,
      uci: square(raw.from) + square(raw.to) + (raw.promotion || ""),
    }))
    .sort((a, b) => (a.uci < b.uci ? -1 : a.uci > b.uci ? 1 : 0));
export const withConversionMove = <T>(
  game: Chess,
  move: ConversionMove,
  run: () => T,
): T => {
  internals(game)._makeMove(move.raw);
  try {
    return run();
  } finally {
    internals(game)._undoMove();
  }
};
export const halfmoveClock = (game: Chess) => Number(game.fen().split(" ")[4]);
