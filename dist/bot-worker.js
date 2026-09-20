import {decide} from './cognitive-search.js?v=23';
self.onmessage = ({data}) => {
  try {
    const profile=data.engineProfile;
    if(profile?.id!=='cognitive-v2'||profile.mode!=='cognitive')throw Error('Invalid Cognitive v2 profile');
    const result=decide({fen:data.fen,pgn:data.pgn,elo:profile.effectiveElo,seed:profile.seed,profile:profile.profile});
    const token=result.move;
    self.postMessage({id:data.id,move:token?{from:token.slice(0,2),to:token.slice(2,4),...(token[4]?{promotion:token[4]}:{})}:null});
  }
  catch {self.postMessage({id:data.id,error:'Не удалось рассчитать ход'});}
};
