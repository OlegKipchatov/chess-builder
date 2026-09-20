import {validPlayStyle} from './play-style-config.js?v=23';
import {validCognitiveProfile} from './cognitive-model.js?v=23';
// Versioned internal levels. These numbers are not calibrated human Elo.
export const stockfishProfile = (rating=1000) => {
 const value=Math.max(400,Math.min(1600,Number.isFinite(rating)?rating:1000));
 const progress=(value-400)/1200;
 return {id:'stockfish19-v1',skill:Math.round(progress*12),nodes:Math.round(1500+18500*progress**2),milliseconds:1500};
};
const validLegacyHumanized = profile => profile?.id==='humanized19-v1'&&validPlayStyle(profile.profile)&&Number.isFinite(profile.targetElo)&&profile.targetElo>=400&&profile.targetElo<=1600&&Number.isFinite(profile.effectiveElo)&&profile.effectiveElo>=400&&profile.effectiveElo<=1600&&Number.isInteger(profile.seed)&&profile.seed>=0&&profile.seed<=4294967295;
export const validEngineProfile = profile => validCognitiveProfile(profile)||validLegacyHumanized(profile)||['stockfish18-v1','stockfish19-v1'].includes(profile?.id)&&Number.isInteger(profile.skill)&&profile.skill>=0&&profile.skill<=12&&Number.isInteger(profile.nodes)&&profile.nodes>=1500&&profile.nodes<=20000&&profile.milliseconds===1500;
