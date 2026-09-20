import {CONFIG,CAPABILITY_POINTS,AUXILIARY_POINTS} from './cognitive-config.js?v=23';
import {validPlayStyle} from './play-style-config.js?v=23';

export const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
export const seededRandom = seed => {let state=seed>>>0;return ()=>{state+=0x6D2B79F5;let x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};};
export const positionSeed = (seed,text='') => {let hash=seed>>>0;for(const character of text)hash=Math.imul(hash^character.charCodeAt(0),16777619);return hash>>>0;};
export const random = (seed,key='') => seededRandom(positionSeed(seed,String(key)))();

const interpolate = (points,elo,keys) => {
  const rating=clamp(elo,points[0].elo,points.at(-1).elo);
  const upper=points.find(point=>point.elo>=rating)||points.at(-1),lower=[...points].reverse().find(point=>point.elo<=rating)||points[0];
  const progress=upper.elo===lower.elo?0:(rating-lower.elo)/(upper.elo-lower.elo);
  return Object.fromEntries(keys.map(key=>[key,lower[key]+(upper[key]-lower[key])*progress]));
};

export const capabilitiesFor = (elo,config=CONFIG) => {
  if(!Number.isFinite(elo))throw RangeError('Elo must be finite');
  const base=interpolate(CAPABILITY_POINTS,clamp(elo,config.minElo,config.maxElo),['threatAwareness','tacticalAwareness','calculationDepth','calculationWidth','positionalAwareness','conversionSkill']);
  return {...base,...interpolate(AUXILIARY_POINTS,clamp(elo,config.minElo,config.maxElo),['evaluationAccuracy','openingDiscipline','oversightResistance'])};
};

export const targetFor = (playerElo,config=CONFIG) => {
  if(!Number.isFinite(playerElo))throw RangeError('Elo must be finite');
  return clamp(playerElo-config.targetEloOffset,config.minElo,config.maxElo);
};

export const createSession = (playerElo,rng=Math.random,profile,options={}) => {
  if(!validPlayStyle(profile))throw RangeError('Unknown play style');
  const seed=Number.isInteger(options.seed)?options.seed>>>0:typeof rng==='number'?rng>>>0:Math.floor(rng()*CONFIG.seedMax)>>>0;
  const source=seededRandom(seed),targetElo=targetFor(playerElo);
  const variance=options.disableVariance?0:clamp(Math.sqrt(-2*Math.log(Math.max(Number.EPSILON,source())))*Math.cos(2*Math.PI*source())*CONFIG.sessionSigma,-CONFIG.varianceLimit,CONFIG.varianceLimit);
  return {id:CONFIG.id,mode:targetElo>=CONFIG.nativeStockfishFromElo?'native':'cognitive',targetElo,effectiveElo:clamp(targetElo+variance,CONFIG.minElo,CONFIG.maxElo),seed,...(profile?{profile}:{}),calibrationVersion:CONFIG.calibrationVersion};
};

export const validCognitiveProfile = profile => profile?.id===CONFIG.id&&['cognitive','native'].includes(profile.mode)&&profile.mode===(profile.targetElo>=CONFIG.nativeStockfishFromElo?'native':'cognitive')&&Number.isFinite(profile.targetElo)&&profile.targetElo>=CONFIG.minElo&&profile.targetElo<=CONFIG.maxElo&&Number.isFinite(profile.effectiveElo)&&profile.effectiveElo>=CONFIG.minElo&&profile.effectiveElo<=CONFIG.maxElo&&Number.isInteger(profile.seed)&&profile.seed>=0&&profile.seed<=CONFIG.seedMax&&validPlayStyle(profile.profile)&&profile.calibrationVersion===CONFIG.calibrationVersion;

const files='abcdefgh';
const distance = (a,b) => Math.max(Math.abs(files.indexOf(a[0])-files.indexOf(b[0])),Math.abs(Number(a[1])-Number(b[1])));
export const threatsFor = game => {
  const rows=[];
  for(const piece of game.board().flat().filter(Boolean)){
    const enemy=piece.color==='w'?'b':'w',attackers=game.attackers(piece.square,enemy),defenders=game.attackers(piece.square,piece.color);
    if(!attackers.length)continue;
    const value=CONFIG.pieceValue[piece.type],leastAttacker=Math.min(...attackers.map(square=>CONFIG.pieceValue[game.get(square)?.type]??10000));
    if(defenders.length>=attackers.length&&leastAttacker>=value&&piece.type!=='k')continue;
    const obviousness=clamp(.34+value/1250+(defenders.length?-.08:.14)+(attackers.some(square=>distance(square,piece.square)===1)?.12:0),.15,1);
    rows.push({id:`attack:${piece.square}:${enemy}`,kind:'attack',square:piece.square,piece:piece.type,color:piece.color,attackers:[...attackers],defenders:[...defenders],value,obviousness});
  }
  return rows;
};

export const positionComplexity = (game,threats=threatsFor(game),config=CONFIG) => {
  const moves=game.moves({verbose:true}),captures=moves.filter(move=>move.captured).length,forcing=moves.filter(move=>/[+#]/.test(move.san)).length;
  return clamp(.12+.28*Math.min(1,moves.length/config.complexity.moves)+.25*Math.min(1,captures/config.complexity.captures)+.20*Math.min(1,forcing/config.complexity.forcing)+.15*Math.min(1,threats.length/config.complexity.attacked),0,1);
};

export const detectionProbability = (capability,elo,obviousness=.5,load=0,config=CONFIG) => {
  const safe=clamp(capability,.001,.999),logit=Math.log(safe/(1-safe));
  const highEloProtection=(clamp(elo,config.minElo,config.maxElo)-config.minElo)/(config.maxElo-config.minElo)*Math.max(0,obviousness-.65)*2.1;
  return clamp(1/(1+Math.exp(-(logit+(obviousness-.5)*config.perception.obviousnessScale-load*config.perception.loadPenalty+highEloProtection))),.001,.999);
};

export const factsFor = game => {
  const threats=threatsFor(game);
  return {threats,complexity:positionComplexity(game,threats),turn:game.turn(),inCheck:game.isCheck(),legalCount:game.moves().length};
};

export const perceive = (facts,caps,seed,key,elo=1000,config=CONFIG) => {
  const capacity=clamp((caps.calculationDepth*caps.calculationWidth)/20,.04,1),load=Math.max(0,facts.complexity-capacity),noticed=[],missed=[];
  for(const threat of facts.threats){
    let probability=detectionProbability(caps.threatAwareness,elo,threat.obviousness,load,config);
    if(random(seed,`${key}:${threat.id}:oversight`)>caps.oversightResistance)probability*=.25;
    (random(seed,`${key}:${threat.id}`)<probability?noticed:missed).push(threat);
  }
  return {noticed,missed,complexity:facts.complexity,load,capacity};
};
