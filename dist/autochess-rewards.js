// The wallet and its reward receipt (including the result) are one atomic state write.
export const autoRewardCoins = result => result?.outcome==='win'?3:result?.outcome==='draw'?1:0;
export const autoRewardTotal = run => Math.min(30,3*run.results.filter(row=>row.outcome==='win').length+Math.min(5,run.results.filter(row=>row.outcome==='draw').length));
export const normalizeAutoAwards = input => Object.fromEntries(Object.entries(input||{}).filter(([id,value])=>id.length<=160&&value&&[0,1,2,3].includes(value.coins)&&['win','draw','loss'].includes(value.outcome)));
export const awardAutochess = (wallet,run) => {
 const result=run.results?.at(-1),awards=normalizeAutoAwards(wallet.autochessAwards);
 if(run.phase!=='result'||!run.battle?.result||!result||result.battleId!==run.battle.id||!['win','draw','loss'].includes(result.outcome)||Object.hasOwn(awards,result.battleId))return wallet;
 const coins=Math.max(0,Math.min(autoRewardCoins(result),autoRewardTotal(run)-autoSeriesCoins(wallet,run)));
 return {...wallet,coins:wallet.coins+coins,autochessAwards:{...awards,[result.battleId]:{coins,outcome:result.outcome,reason:result.reason}}};
};
export const autoSeriesCoins = (wallet,run) => run.results.reduce((total,result)=>total+(wallet.autochessAwards?.[result.battleId]?.coins||0),0);
