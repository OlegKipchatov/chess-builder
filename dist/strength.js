// Versioned internal levels. These numbers are not calibrated human Elo.
export const stockfishProfile = (rating=1000) => {
 const value=Math.max(400,Math.min(1600,Number.isFinite(rating)?rating:1000));
 const progress=(value-400)/1200;
 return {id:'stockfish18-v1',skill:Math.round(progress*12),nodes:Math.round(1500+18500*progress**2),milliseconds:1500};
};
export const validEngineProfile = profile => profile?.id==='stockfish18-v1'&&Number.isInteger(profile.skill)&&profile.skill>=0&&profile.skill<=12&&Number.isInteger(profile.nodes)&&profile.nodes>=1500&&profile.nodes<=20000&&profile.milliseconds===1500;
