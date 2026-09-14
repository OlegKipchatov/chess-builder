/** @typedef {'aggressive'|'solid'|'positional'|'tricky'} PlayStyle */
/** Public style IDs are stable. Coefficients weight normalized board features, not Elo. */
export const PLAY_STYLES = Object.freeze(Object.fromEntries(Object.entries({
 aggressive:{name:'Reina',attack:1,safety:-.25,position:.15,complexity:.65,exchange:-.65},
 solid:{name:'Bastion',attack:-.15,safety:1,position:.25,complexity:-.65,exchange:.8},
 positional:{name:'Silas',attack:.1,safety:.15,position:1,complexity:.05,exchange:.1},
 tricky:{name:'NIX-7',attack:.35,safety:-.15,position:.1,complexity:1,exchange:-.8}
}).map(([id,value])=>[id,Object.freeze({id,...value})])));
export const STYLE_CONFIG = Object.freeze({maxLossDifference:.15,preferenceStrength:2.5,reconsiderRate:.45,
  kingRadius:3,forcingReplyScale:8,replyScale:40,structureScale:3,activityScale:3,
  exposureScale:9,exchangeScale:9,seedSalt:0x5354594c});
export const validPlayStyle = profile => profile===undefined||profile==='default'||Object.hasOwn(PLAY_STYLES,profile);

export const playStyleName = (profile,fallback='ИИ') => Object.hasOwn(PLAY_STYLES,profile)?PLAY_STYLES[profile].name:fallback;
export const randomPlayStyle = (rng=Math.random) => {const ids=Object.keys(PLAY_STYLES);return ids[Math.floor(rng()*ids.length)];};
