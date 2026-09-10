// Internal progression scale, not a calibrated human Elo rating.
export const initialRating = () => ({value:1000,games:0,lastDelta:0});
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
export const normalizeRating = rating => ({
  value:Number.isSafeInteger(rating?.value)?clamp(rating.value,100,2400):1000,
  games:Number.isSafeInteger(rating?.games)&&rating.games>=0?rating.games:0,
  lastDelta:Number.isSafeInteger(rating?.lastDelta)?clamp(rating.lastDelta,-64,64):0
});
export const opponentFor = value => clamp(Math.round(value/50)*50,400,1600);
export const ratingSnapshot = rating => {const current=normalizeRating(rating);return {before:current.value,opponent:opponentFor(current.value),k:current.games<10?64:32};};
export const validRatingSnapshot = snapshot => snapshot && Number.isSafeInteger(snapshot.before) && snapshot.before>=100 && snapshot.before<=2400 && Number.isSafeInteger(snapshot.opponent) && snapshot.opponent>=400 && snapshot.opponent<=1600 && [32,64].includes(snapshot.k);
export const adaptiveLevel = (rating=1000) => {
  const target=opponentFor(Number.isFinite(rating)?rating:1000);
  const progress=(target-400)/1200;
  return {depth:target<800?1:target<1150?2:target<1450?3:4,milliseconds:Math.round(250+1550*progress),noise:Math.round(260*(1-progress)**2)};
};
export const settleRating = (state,game) => {
  const match=state.game;
  if(!match.started||match.settled||match.mode!=='bot'||match.difficulty!=='adaptive'||!validRatingSnapshot(match.rating)||(!match.resigned&&!game.isGameOver()))return null;
  const {before,opponent,k}=match.rating;
  const score=match.resigned?0:game.isDraw()?0.5:game.turn()!==(match.playerColor||'w')?1:0;
  const expected=1/(1+10**((opponent-before)/400));
  const value=clamp(Math.round(before+k*(score-expected)),100,2400);
  return {value,games:normalizeRating(state.rating).games+1,lastDelta:value-before};
};
export const signedDelta = delta => `${delta>0?'+':''}${delta}`;
