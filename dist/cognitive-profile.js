import {PLAY_STYLES,validPlayStyle} from './play-style-config.js?v=23';
import {CONFIG} from './cognitive-config.js?v=23';

const files='abcdefgh';
const center = square => 7-Math.abs(files.indexOf(square[0])-3.5)-Math.abs(Number(square[1])-4.5);
const kingDistance = (a,b) => Math.max(Math.abs(files.indexOf(a[0])-files.indexOf(b[0])),Math.abs(Number(a[1])-Number(b[1])));

export const styleFeatures = (game,candidate) => {
  const move=candidate.move||candidate,enemy=game.turn()==='w'?'b':'w',enemyKing=game.board().flat().find(piece=>piece?.type==='k'&&piece.color===enemy)?.square;
  const beforeMoves=game.moves().length;
  game.move(move);
  try{
    const forcing=(game.isCheck()?1:0)+Math.min(1,game.moves({verbose:true}).filter(reply=>reply.captured||/[+#]/.test(reply.san)).length/8);
    const exposure=game.isCheck()?1:Math.min(1,game.attackers(move.to,enemy).length/3);
    return {
      attack:Math.min(1,(move.captured?.length?0.5:0)+(move.san?.includes('+')?.5:0)+(enemyKing?Math.max(0,4-kingDistance(move.to,enemyKing))*.12:0)),
      safety:1-exposure,
      position:Math.max(-1,Math.min(1,(center(move.to)-center(move.from))/5)),
      complexity:Math.min(1,(beforeMoves+forcing*8)/42),
      exchange:move.captured?1:0
    };
  } finally {game.undo();}
};

export const profileAdjustment = (game,candidate,profile='default',scale=CONFIG.profile.maximumAdjustment) => {
  if(!validPlayStyle(profile)||profile==='default'||!PLAY_STYLES[profile])return 0;
  const style=PLAY_STYLES[profile],features=styleFeatures(game,candidate);
  const weighted=style.attack*features.attack+style.safety*features.safety+style.position*features.position+style.complexity*features.complexity+style.exchange*features.exchange;
  return Math.max(-scale,Math.min(scale,weighted*scale/3));
};
