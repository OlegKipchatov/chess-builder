import {DIFFICULTY as C} from './difficulty-config.js?v=17';
// Versioned internal levels. These numbers are not calibrated human Elo.
export const stockfishProfile = (rating=1000) => {
 const value=Math.max(400,Math.min(1600,Number.isFinite(rating)?rating:1000));
 const progress=(value-400)/1200;
 return {id:'stockfish19-v1',skill:Math.round(progress*12),nodes:Math.round(1500+18500*progress**2),milliseconds:1500};
};
export const validEngineProfile = profile => profile?.id==='humanized19-v1' ? Number.isFinite(profile.targetElo)&&profile.targetElo>=C.minHumanElo&&profile.targetElo<=C.maxHumanElo&&Number.isFinite(profile.effectiveElo)&&profile.effectiveElo>=C.minHumanElo&&profile.effectiveElo<=C.maxHumanElo&&Number.isInteger(profile.seed)&&profile.seed>=0&&profile.seed<=C.seedMax : ['stockfish18-v1','stockfish19-v1'].includes(profile?.id)&&Number.isInteger(profile.skill)&&profile.skill>=0&&profile.skill<=12&&Number.isInteger(profile.nodes)&&profile.nodes>=1500&&profile.nodes<=20000&&profile.milliseconds===1500;
