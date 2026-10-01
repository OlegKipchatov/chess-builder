import {REWARD_CONFIG as C} from './reward-quality.js?v=76';
// Canonical final history only: replay/undo never creates another reward.
export const rewardBreakdownFor = (game, resigned=false, mode='bot', playerColor='w') => {
 const cleanMoves=game.history({verbose:true}).filter(move=>move.color===playerColor).length;
 const reason=!game.isGameOver()&&!resigned?'unfinished':resigned&&cleanMoves<C.minResignMoves?'early-resignation':mode!=='bot'?'legacy-local':null;
 const outcome=resigned?'loss':game.isDraw()?'draw':game.turn()===playerColor?'loss':'win';
 const completion=reason?0:C.completion,result=reason?0:C[outcome];
 return {cleanMoves,completion,moves:0,result,outcome,reason,quality:0,qualityStatus:reason?'ineligible':'pending',rewardVersion:C.version,total:completion+result};
};
export const rewardFor = (game,resigned=false,mode='bot',playerColor='w') => rewardBreakdownFor(game,resigned,mode,playerColor).total;
