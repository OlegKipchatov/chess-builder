export const rewardFor = (game, resigned=false, mode='bot', playerColor='w') => {
  if (!game.isGameOver() && !resigned) return 0;
  if (game.history().length < 10 && !game.isCheckmate()) return 0;
  if (game.isDraw() && !resigned) return 40;
  if (mode === 'local') return 40;
  return resigned || game.turn() === playerColor ? 25 : 60;
};
