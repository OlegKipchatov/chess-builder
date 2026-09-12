import {adaptiveLevel} from './rating.js?v=13';
import {Chess} from './chess.js?v=13';
export const DIFFICULTIES = {
  adaptive:{name:'Адаптивный',description:'Подбирает силу по вашему внутреннему рейтингу. Уровень фиксируется на всю партию.'},
  easy:{name:'Новичок', depth:1, milliseconds:250, noise:110, description:'Видит ближайший ход и иногда ошибается.'},
  normal:{name:'Обычный', depth:2, milliseconds:700, noise:8, description:'Проверяет ответ соперника. Для спокойной игры.'},
  hard:{name:'Сложный', depth:4, milliseconds:1800, noise:0, description:'Считает до четырёх полуходов в пределах времени. Не Stockfish.'}
};
export const rewardFor = (game, resigned=false, mode='bot', playerColor='w') => {
  if (!game.isGameOver() && !resigned) return 0;
  if (game.history().length < 10 && !game.isCheckmate()) return 0;
  if (game.isDraw() && !resigned) return 40;
  if (mode === 'local') return 40;
  return resigned || game.turn() === playerColor ? 25 : 60;
};
const weights = {p:100,n:320,b:335,r:500,q:900,k:0};
const evaluate = (game, ply) => {
  if (game.isCheckmate()) return (game.turn() === 'w' ? 1 : -1) * (100000-ply);
  if (game.isDraw()) return 0;
  return game.board().flat().filter(Boolean).reduce((sum,piece) => {
    const file = piece.square.charCodeAt(0)-97;
    const rank = Number(piece.square[1])-1;
    const center = 3.5-Math.abs(file-3.5) + 3.5-Math.abs(rank-3.5);
    const bonus = piece.type === 'p' ? (piece.color === 'b' ? 7-rank : rank)*7 : ['n','b'].includes(piece.type) ? center*9 : 0;
    return sum+(piece.color === 'b' ? 1 : -1)*(weights[piece.type]+bonus);
  },0);
};
const orderedMoves = game => game.moves({verbose:true}).sort((a,b) => ((weights[b.captured]||0)*10 + (b.promotion ? 900 : 0)) - ((weights[a.captured]||0)*10 + (a.promotion ? 900 : 0)));
const search = (game, depth, alpha, beta, context, ply) => {
  if (performance.now() >= context.deadline || ++context.nodes > 16000) throw context.timeout;
  if (!depth || game.isGameOver()) return evaluate(game,ply);
  const maximize = game.turn() === 'b';
  let best = maximize ? -Infinity : Infinity;
  for (const move of orderedMoves(game)) {
    game.move(move);
    let score;
    try {score = search(game,depth-1,alpha,beta,context,ply+1);} finally {game.undo();}
    best = maximize ? Math.max(best,score) : Math.min(best,score);
    if (maximize) alpha = Math.max(alpha,best); else beta = Math.min(beta,best);
    if (beta <= alpha) break;
  }
  return best;
};
const searchRoot = (game, moves, depth, level, context, rng) => {
  const sign = game.turn() === 'b' ? 1 : -1;
  let best = -Infinity;
  let chosen = moves[0];
  for (const move of moves) {
    game.move(move);
    let score;
    try {score = sign*search(game,depth-1,-Infinity,Infinity,context,1) + rng()*level.noise;} finally {game.undo();}
    if (score > best) {best=score;chosen=move;}
  }
  return chosen;
};
export const chooseMove = (fen, difficulty='normal', rng=Math.random, rating=1000) => {
  const game = new Chess(fen);
  if (game.isGameOver()) return null;
  const level = difficulty==='adaptive'?adaptiveLevel(rating):DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const context = {deadline:performance.now()+level.milliseconds, nodes:0, timeout:Symbol('timeout')};
  const moves = orderedMoves(game);
  let chosen = moves[0];
  for (let depth=1; depth<=level.depth; depth++) {
    try {chosen=searchRoot(game,moves,depth,level,context,rng);} catch(error) {if(error!==context.timeout)throw error;break;}
    moves.sort((a,b)=>Number(b===chosen)-Number(a===chosen));
  }
  return chosen ? {from:chosen.from,to:chosen.to,promotion:chosen.promotion} : null;
};
