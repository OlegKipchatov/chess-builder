import {validPlayStyle} from './play-style-config.js?v=28';
import {CONFIG as C} from './cognitive-config.js?v=28';
import {createSession,clamp,hash} from './cognitive-model.js?v=28';
const validSeed = seed => Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff;
const validElo = elo => Number.isFinite(elo)&&elo>=C.minElo&&elo<=C.maxElo;
export const validEngineProfile = profile => profile?.id==='cognitive-v2'&&validPlayStyle(profile.profile)&&validElo(profile.targetElo)&&validElo(profile.effectiveElo)&&validSeed(profile.seed);
// Historical metadata only. These IDs never route to a retired algorithm.
export const validArchivedProfile = profile => validEngineProfile(profile)||(
 profile?.id==='humanized19-v1'&&validPlayStyle(profile.profile)&&Number.isFinite(profile.targetElo)&&profile.targetElo>=100&&profile.targetElo<=1600&&Number.isFinite(profile.effectiveElo)&&profile.effectiveElo>=100&&profile.effectiveElo<=1600&&validSeed(profile.seed)
)||(['stockfish18-v1','stockfish19-v1'].includes(profile?.id)&&Number.isInteger(profile.skill)&&profile.skill>=0&&profile.skill<=12&&Number.isInteger(profile.nodes)&&profile.nodes>=1500&&profile.nodes<=20000&&profile.milliseconds===1500);
export const migrateEngineProfile = (profile,{playerElo=1000,targetElo,pgn=''}={}) => {
 if(validEngineProfile(profile))return {...profile};
 const seed=validSeed(profile?.seed)?profile.seed:hash(0x47414348,`${pgn}:${playerElo}:${targetElo??''}`);
 const next=createSession(playerElo,seed,validPlayStyle(profile?.profile)?profile?.profile:'default');
 const previous=Number.isFinite(profile?.targetElo)?profile.targetElo:targetElo;
 if(Number.isFinite(previous)){
  const variance=next.effectiveElo-next.targetElo;
  next.targetElo=clamp(previous,C.minElo,C.maxElo);
  next.effectiveElo=clamp(next.targetElo+variance,C.minElo,C.maxElo);
 }
 return next;
};
