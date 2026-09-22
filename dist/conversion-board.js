/**
 * SAN-free adapter for the bundled chess.js. Private calls are isolated here.
 * _makeMove does NOT update repetition counts: conversion-history owns them.
 * Contract tests compare moves/terminal states with the public Chess API.
 */
const square = index => String.fromCharCode(97+(index&7))+(8-(index>>4));
export const conversionMoves = game => game._moves().map(raw=>({
 raw,from:square(raw.from),to:square(raw.to),piece:raw.piece,
 captured:raw.captured,promotion:raw.promotion,
 uci:square(raw.from)+square(raw.to)+(raw.promotion||''),
})).sort((a,b)=>a.uci<b.uci?-1:a.uci>b.uci?1:0);
export const withConversionMove = (game,move,run) => {
 game._makeMove(move.raw);
 try{return run();}finally{game._undoMove();}
};
export const halfmoveClock = game => Number(game.fen().split(' ')[4]);
