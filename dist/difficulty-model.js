import {DIFFICULTY as C} from './difficulty-config.js?v=16';
/** @typedef {()=>number} RandomSource */
export const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
export const seededRandom = seed => {let state=seed>>>0;return ()=>{state+=0x6D2B79F5;let x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};};
export const positionSeed = (seed,fen) => {let hash=seed>>>0;for(const character of fen)hash=Math.imul(hash^character.charCodeAt(0),16777619);return hash>>>0;};
export const skillFor = (elo,config=C) => {if(!Number.isFinite(elo))throw RangeError('Elo must be finite');return clamp((elo-config.minHumanElo)/(config.maxHumanElo-config.minHumanElo),0,1);};
export const targetFor = (playerElo,config=C) => {if(!Number.isFinite(playerElo))throw RangeError('Elo must be finite');return clamp(playerElo-config.targetEloOffset,config.minHumanElo,config.maxHumanElo);};
export const createDifficultyProfile = (playerElo,rng=Math.random,config=C) => {
  const seed=Math.floor(rng()*config.seedMax)>>>0,random=seededRandom(seed);
  const variance=clamp(Math.sqrt(-2*Math.log(Math.max(Number.EPSILON,random())))*Math.cos(2*Math.PI*random())*config.sessionSigma,-config.varianceLimit,config.varianceLimit);
  const targetElo=targetFor(playerElo,config);
  return {id:'humanized19-v1',targetElo,effectiveElo:clamp(targetElo+variance,config.minHumanElo,config.maxHumanElo),seed};
};
export const qualityFor = (loss,config=C) => ['best','good','inaccuracy','mistake','blunder'][config.thresholds.findIndex(value=>loss<value)===-1?4:config.thresholds.findIndex(value=>loss<value)];
export const probabilitiesFor = (elo,context={},config=C) => {
  const skill=skillFor(elo,config),complexity=clamp(context.complexity??1,config.complexity.min,config.complexity.max);
  const phase=config.phase[context.phase||'middlegame'];
  const win=context.bestEvaluation>config.winning.evaluation?1+config.winning.maxBonus*(1-clamp((elo-config.winning.fadeStart)/(config.winning.fadeEnd-config.winning.fadeStart),0,1)):1;
  const errors=Object.fromEntries(Object.entries(config.errors).map(([name,p])=>[name,p.max*(1-skill)**p.power*complexity*phase*win*config.errorMultiplier]));
  const mass=Object.values(errors).reduce((sum,p)=>sum+p,0),scale=mass>config.maxErrorMass?config.maxErrorMass/mass:1;
  for(const key of Object.keys(errors))errors[key]*=scale;
  const remaining=1-Object.values(errors).reduce((sum,p)=>sum+p,0),best=Math.min(remaining,config.best.base+config.best.gain*skill**config.best.power);
  return {best,good:remaining-best,...errors};
};
export const weightedChoice = (items,weight,rng) => {
  const weights=items.map(weight),total=weights.reduce((sum,value)=>sum+value,0);let ticket=rng()*total;
  return items.find((item,index)=>(ticket-=weights[index])<0)||items.at(-1);
};
export const mateProbability = (distance,elo,config=C) => {const p=distance===1?config.mate.one:config.mate.two;return clamp(1-(1-p.min)*(1-skillFor(elo,config))**p.power*config.errorMultiplier,0,1);};
/** Pure decision over evaluated, legal candidates; no engine calls and no random legal fallback. */
export const selectCandidate = (candidates,elo,context={},rng=Math.random,config=C) => {
  if(!candidates.length)throw Error('No evaluated legal candidates');
  if(candidates.length===1)return candidates[0];
  let pool=candidates;
  const distance=candidates.some(c=>c.mate===1)?1:candidates.some(c=>c.mate===2)?2:null;
  if(distance){
    const mating=candidates.filter(c=>c.mate>0&&c.mate<=distance),other=candidates.filter(c=>!mating.includes(c));
    pool=!other.length||rng()<mateProbability(distance,elo,config)?mating:other;
  }
  const distribution=probabilitiesFor(elo,context,config),order=['best','good','inaccuracy','mistake','blunder'];
  const quality=weightedChoice(order,name=>distribution[name],rng);let eligible=[];
  for(let index=order.indexOf(quality);index>=0&&!eligible.length;index--)eligible=pool.filter(c=>qualityFor(c.evaluationLoss,config)===order[index]);
  // Excluding a recognised mate can leave only lower-quality candidates. Select the best evaluated remainder, never an unevaluated move.
  if(!eligible.length){const best=Math.min(...pool.map(c=>c.evaluationLoss));eligible=pool.filter(c=>c.evaluationLoss===best);}
  const minimum=Math.min(...eligible.map(c=>c.evaluationLoss)),temperature=config.temperature.min+config.temperature.gain*skillFor(elo,config);
  const chosen=weightedChoice(eligible,c=>Math.exp(-(c.evaluationLoss-minimum)*temperature)*(c.guardWeight??1),rng);
  if((chosen.guardWeight??1)<1&&rng()>chosen.guardWeight){
    const safer=pool.filter(c=>c.evaluationLoss<chosen.evaluationLoss&&(c.guardWeight??1)===1);
    if(safer.length){const bestLoss=Math.min(...safer.map(c=>c.evaluationLoss));return weightedChoice(safer,c=>Math.exp(-(c.evaluationLoss-bestLoss)*temperature),rng);}
  }
  return chosen;
};
