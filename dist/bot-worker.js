import {decide} from './cognitive-search.js?v=31';
import {validEngineProfile} from './strength.js?v=31';
self.onmessage = ({data}) => {
  try {
    const profile=data.engineProfile;
    if(!validEngineProfile(profile))throw Error('Invalid cognitive profile');
    const {move}=decide({fen:data.fen,pgn:data.pgn,elo:profile.effectiveElo,seed:profile.seed,profile:profile.profile});
    self.postMessage({id:data.id,move:move?{from:move.slice(0,2),to:move.slice(2,4),...(move[4]?{promotion:move[4]}:{})}:null});
  }catch(error){self.postMessage({id:data.id,error:error.message||'Не удалось рассчитать ход'});}
};
