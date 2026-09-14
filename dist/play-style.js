import {Chess} from './chess.js?v=22';
import {DIFFICULTY as C} from './difficulty-config.js?v=22';
import {PLAY_STYLES,STYLE_CONFIG as S,validPlayStyle} from './play-style-config.js?v=22';
import {qualityFor,seededRandom,positionSeed,weightedChoice} from './difficulty-model.js?v=22';
export {PLAY_STYLES,STYLE_CONFIG,validPlayStyle} from './play-style-config.js?v=22';
const bound = value => Math.max(-1,Math.min(1,value));
const xy = square => [square.charCodeAt(0)-97,Number(square[1])-1];
const distance = (a,b) => Math.max(...xy(a).map((v,i)=>Math.abs(v-xy(b)[i])));
const pieces = game => game.board().flat().filter(Boolean);
const structure = (board,side) => {
 const own=board.filter(p=>p.color===side&&p.type==='p'),enemy=board.filter(p=>p.color!==side&&p.type==='p');
 let value=0;
 for(const pawn of own){
  const [file,rank]=xy(pawn.square),forward=side==='w'?1:-1;
  if(own.filter(p=>xy(p.square)[0]===file).length>1)value-=.5;
  if(!own.some(p=>Math.abs(xy(p.square)[0]-file)===1))value-=.5;
  if(!enemy.some(p=>Math.abs(xy(p.square)[0]-file)<=1&&(xy(p.square)[1]-rank)*forward>0))value+=1+((side==='w'?rank:7-rank)/6);
 }
 return value;
};
const activity = (board,side) => board.filter(p=>p.color===side&&p.type!=='k').reduce((sum,p)=>{
 const [file,rank]=xy(p.square),central=(3.5-Math.abs(file-3.5)+3.5-Math.abs(rank-3.5))/7;
 return sum+central+(p.type==='p'?(side==='w'?rank:7-rank)/7:0);
},0);
const exposed = (game,board,side) => board.filter(p=>p.color===side&&p.type!=='k'&&game.isAttacked(p.square,side==='w'?'b':'w')&&!game.isAttacked(p.square,side)).reduce((sum,p)=>sum+C.pieceValue[p.type],0);
const kingDanger = (game,board,side) => {
 const king=board.find(p=>p.color===side&&p.type==='k'),enemy=side==='w'?'b':'w';
 if(!king)return 0;
 const [file,rank]=xy(king.square);let count=0;
 for(let x=Math.max(0,file-1);x<=Math.min(7,file+1);x++)for(let y=Math.max(0,rank-1);y<=Math.min(7,rank+1);y++)if(game.isAttacked(String.fromCharCode(97+x)+(y+1),enemy))count++;
 return count/9;
};
/** Cheap one-ply board features; replies are legal, not asserted to be good or human-obvious. */
export const candidateFeatures = (game,candidates) => {
 const side=game.turn(),enemy=side==='w'?'b':'w',before=pieces(game),enemyKing=before.find(p=>p.color===enemy&&p.type==='k').square;
 const baseline={structure:structure(before,side),activity:activity(before,side),exposed:exposed(game,before,side),danger:kingDanger(game,before,side)};
 return new Map(candidates.map(candidate=>{
  const after=new Chess(game.fen()),move=after.move({from:candidate.move.slice(0,2),to:candidate.move.slice(2,4),...(candidate.move[4]?{promotion:candidate.move[4]}:{})});
  const board=pieces(after),replies=after.moves({verbose:true}),check=after.isCheck(),capture=!!move.captured;
  const queenTrade=move.piece==='q'&&move.captured==='q';
  const exchange=(C.pieceValue[move.captured]||0)/S.exchangeScale;
  const attack=bound((check?.6:0)+(distance(move.from,enemyKing)-distance(move.to,enemyKing))/S.kingRadius+kingDanger(after,board,enemy)-kingDanger(game,before,enemy));
  const safety=bound(baseline.danger-kingDanger(after,board,side)+(baseline.exposed-exposed(after,board,side))/S.exposureScale+(move.flags.includes('k')||move.flags.includes('q')?.35:0));
  const position=bound((structure(board,side)-baseline.structure)/S.structureScale+(activity(board,side)-baseline.activity)/S.activityScale);
  const forcing=replies.filter(m=>m.captured||/[+#]/.test(m.san)).length;
  const complexity=bound(.5*replies.length/S.replyScale+.5*forcing/S.forcingReplyScale+(board.some(p=>p.type==='q'&&p.color===side)&&board.some(p=>p.type==='q'&&p.color===enemy)?.25:0)-exchange);
  return [candidate.move,{attack,safety,position,complexity,exchange,isCapture:capture,isCheck:check,queenTrade}];
 }));
};
export const styleScore = (features,profile) => ['attack','safety','position','complexity','exchange'].reduce((sum,key)=>sum+features[key]*PLAY_STYLES[profile][key],0);
/** Elo has already selected the severity. Style can only change preference within it. */
export const styleEnvelope = (candidates,baseline) => candidates.filter(c=>
 qualityFor(c.evaluationLoss)===qualityFor(baseline.evaluationLoss)&&
 Math.abs(c.evaluationLoss-baseline.evaluationLoss)<=S.maxLossDifference+1e-9&&
 c.mate===baseline.mate&&((c.guardWeight??1)<1)===((baseline.guardWeight??1)<1));
export const applyPlayStyle = ({game,candidates,baseline,profile,seed,features}) => {
 if(!validPlayStyle(profile))throw RangeError('Unknown play style');
 if(!candidates.includes(baseline))throw Error('Baseline is not an allowed candidate');
 if(!profile||profile==='default')return baseline;
 const eligible=styleEnvelope(candidates,baseline);
 if(eligible.length<2)return baseline;
 const rng=seededRandom(positionSeed((seed^S.seedSalt)>>>0,game.fen()));
 if(rng()>=S.reconsiderRate)return baseline;
 const values=features||candidateFeatures(game,eligible),scores=eligible.map(c=>styleScore(values.get(c.move),profile)),maximum=Math.max(...scores);
 return weightedChoice(eligible,c=>Math.exp(S.preferenceStrength*(styleScore(values.get(c.move),profile)-maximum)),rng);
};
