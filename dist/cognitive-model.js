import {CONFIG as C,CONTROL_POINTS,EXTRA_POINTS} from './cognitive-config.js?v=27';
import {validPlayStyle} from './play-style-config.js?v=27';
export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const hash = (seed,key) => {let value=seed>>>0;for(const c of key)value=Math.imul(value^c.charCodeAt(0),16777619);return value>>>0;};
export const random = (seed,key) => {let x=hash(seed,key)+0x6D2B79F5;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};
const interpolate = (rows,elo) => {
 const upper=rows.findIndex(row=>row[0]>=elo);if(upper<=0)return rows[0].slice(1);
 const a=rows[upper-1],b=rows[upper],t=(elo-a[0])/(b[0]-a[0]);return a.slice(1).map((v,i)=>v+(b[i+1]-v)*t);
};
export const capabilitiesFor = elo => {
 if(!Number.isFinite(elo))throw RangeError('Elo must be finite');elo=clamp(elo,C.minElo,C.maxElo);
 const keys=['threatAwareness','tacticalAwareness','calculationDepth','calculationWidth','positionalAwareness','conversionSkill'];
 return {...Object.fromEntries(keys.map((key,i)=>[key,interpolate(CONTROL_POINTS,elo)[i]])),
  ...Object.fromEntries(['evaluationAccuracy','openingDiscipline','oversightResistance'].map((key,i)=>[key,interpolate(EXTRA_POINTS,elo)[i]])),elo};
};
export const decisionModeFor = elo => clamp(Number.isFinite(elo)?elo:C.minElo,C.minElo,C.maxElo)>=C.nativeStockfishFromElo?'native-stockfish':'cognitive-v2';
export const targetFor = playerElo => clamp((Number.isFinite(playerElo)?playerElo:1000)+C.offset,C.minElo,C.maxElo);
export const createSession = (playerElo,seed,profile='default') => {
 if(!validPlayStyle(profile))throw RangeError('Unknown play style');
 if(!Number.isFinite(playerElo)||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw RangeError('Invalid session input');
 const targetElo=targetFor(playerElo);
 const variance=clamp(Math.sqrt(-2*Math.log(Math.max(Number.EPSILON,random(seed,'variance-a'))))*Math.cos(2*Math.PI*random(seed,'variance-b'))*C.sigma,-C.varianceLimit,C.varianceLimit);
 return {id:'cognitive-v2',calibrationVersion:C.version,targetElo,effectiveElo:clamp(targetElo+variance,C.minElo,C.maxElo),seed,profile};
};
export const uci = m => m.from+m.to+(m.promotion||'');
export const opposite = side => side==='w'?'b':'w';
export const boardPieces = game => game.board().flat().filter(Boolean);
export const threatsFor = (game,pieces=boardPieces(game)) => pieces.filter(p=>p.type!=='k').flatMap(p=>game.attackers(p.square,opposite(p.color)).filter(from=>game.get(from).type!=='k'||!game.isAttacked(p.square,p.color)).map(from=>({
  id:`${from}:${p.square}`,from,to:p.square,color:p.color,type:p.type,
  obviousness:p.type==='q'?C.salience.queen:C.values[p.type]>=500?C.salience.major:C.salience.normal
 })));
export const factsFor = game => {
 const pieces=boardPieces(game),legal=game.moves({verbose:true}).sort((a,b)=>uci(a).localeCompare(uci(b))),threats=threatsFor(game,pieces);
 const forcing=legal.filter(m=>m.captured||/[+#]/.test(m.san)).length;
 const signal=[Math.min(1,legal.length/C.complexity.moves),Math.min(1,forcing/C.complexity.forcing),Math.min(1,threats.length/C.complexity.exposed),pieces.filter(p=>p.type==='q').length/2];
 const complexity=clamp(signal.reduce((s,v,i)=>s+v*C.complexity.weights[i],0),0,1);
 const material=pieces.reduce((s,p)=>s+C.values[p.type],0),ply=(Number(game.fen().split(' ')[5])-1)*2+(game.turn()==='b');
 return {pieces,legal,threats,complexity,phase:material<=1600?'endgame':ply<16?'opening':'middlegame'};
};
export const detectionProbability = (capability,elo,obviousness,load=0,attention=0) => {
 const c=clamp(capability,.000001,.999999),skill=(clamp(elo,100,1400)-100)/1300;
 const logit=Math.log(c/(1-c))+(C.attention.boostMin+(C.attention.boostMax-C.attention.boostMin)*skill)*(obviousness-.5)-C.attention.loadPenalty*load+attention;
 return 1/(1+Math.exp(-logit));
};
export const perceive = (facts,caps,seed,key) => {
 const capacity=Math.sqrt(caps.calculationDepth*caps.calculationWidth/(5.2*3.8)),load=Math.max(0,facts.complexity-capacity);
 const attention=(random(seed,key+':attention')*2-1)*C.attention.noise;
 const noticed=facts.threats.filter(t=>random(seed,key+':threat:'+t.id)<detectionProbability(caps.threatAwareness,caps.elo,t.obviousness,load,attention));
 const oversight=random(seed,key+':oversight')>caps.oversightResistance;
 const retained=oversight?noticed.filter(t=>t.obviousness>.5||random(seed,key+':omit:'+t.id)>.25):noticed;
 return {noticed:retained,missed:facts.threats.filter(t=>!retained.includes(t)),complexity:facts.complexity,load,oversight,
  tactics:random(seed,key+':tactics')<caps.tacticalAwareness,
  position:random(seed,key+':position')<caps.positionalAwareness,
  opening:random(seed,key+':opening')<caps.openingDiscipline};
};
export const errorQuality = evaluationLoss => {
 const [best,good,inaccuracy,mistake]=C.errorThresholds;
 if(!Number.isFinite(evaluationLoss))return 'unknown';
 if(evaluationLoss<best)return 'best';
 if(evaluationLoss<good)return 'good';
 if(evaluationLoss<inaccuracy)return 'inaccuracy';
 if(evaluationLoss<mistake)return 'mistake';
 return 'blunder';
};
/** Reporting-only heuristic; it never feeds back into move selection. */
export const classifyError = ({evaluationLoss,trace}) => {
 const quality=errorQuality(evaluationLoss);if(quality==='best'||quality==='good')return 'none';
 if(quality==='unknown')return 'unknown';
 const causes=[];
 if(trace?.oversight)causes.push('oversight');
 if(trace?.missed?.length)causes.push('perception');
 if((trace?.load??0)>.15||(trace?.completedDepth??0)<(trace?.depth??0))causes.push('calculation');
 if(trace?.position&&quality!=='inaccuracy')causes.push('strategy');
 return causes.length===0?'evaluation':causes.length===1?causes[0]:'mixed';
};
