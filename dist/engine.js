// Only the player's moves in the final line count; undo/replay cannot add rewards.
export const rewardBreakdownFor = (game, resigned=false, mode='bot', playerColor='w') => {
  const cleanMoves=game.history({verbose:true}).filter(move=>move.color===playerColor).length;
  const reason=!game.isGameOver()&&!resigned?'unfinished':resigned&&cleanMoves<10?'early-resignation':null;
  const completion=reason?0:10;
  const moves=reason?0:Math.min(20,Math.floor(cleanMoves/2));
  const outcome=resigned?'loss':game.isDraw()?'draw':game.turn()===playerColor?'loss':'win';
  // Legacy local games share one wallet, so they have no winner bonus.
  const result=reason?0:outcome==='draw'?5:mode==='bot'&&outcome==='win'?10:0;
  return {cleanMoves,completion,moves,result,outcome,reason,total:completion+moves+result};
};
export const rewardFor = (game, resigned=false, mode='bot', playerColor='w') => rewardBreakdownFor(game,resigned,mode,playerColor).total;
