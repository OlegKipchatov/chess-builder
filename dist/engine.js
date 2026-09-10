import { Chess } from './chess.js';
export const SKINS = [
 {id:'classic',name:'Классика',rarity:'base',white:'#f6f1dc',black:'#273530',light:'#cdd3bc',dark:'#718572'},
 {id:'sand',name:'Песчаник',rarity:'common',white:'#ffe3af',black:'#573a25',light:'#e5c79b',dark:'#ae8050'},
 {id:'slate',name:'Графит',rarity:'common',white:'#e9edf4',black:'#293344',light:'#b6c1ce',dark:'#65748a'},
 {id:'ocean',name:'Глубина',rarity:'rare',white:'#b8f4ff',black:'#143763',light:'#91c4d5',dark:'#387284'},
 {id:'rose',name:'Розовый кварц',rarity:'rare',white:'#ffdef1',black:'#68294b',light:'#e3b7cf',dark:'#a16b87'},
 {id:'nebula',name:'Туманность',rarity:'epic',white:'#eed1ff',black:'#542887',light:'#c4afe6',dark:'#77609e'},
 {id:'aurora',name:'Северное сияние',rarity:'epic',white:'#a8ffe6',black:'#124d64',light:'#9bd0bf',dark:'#487e89'},
 {id:'gold',name:'Золотая династия',rarity:'legendary',white:'#ffe398',black:'#6e4512',light:'#eed397',dark:'#ad8a49'}
];
export const rarityNames = {base:'Базовый',common:'Обычный',rare:'Редкий',epic:'Эпический',legendary:'Легендарный'};
export const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
export const rollChest = (owned, pity, rng = random) => {
 const value=rng();
 const rarity=pity>=9 ? (value<.9?'epic':'legendary') : value<.6?'common':value<.9?'rare':value<.99?'epic':'legendary';
 const pool=SKINS.filter(s=>s.rarity===rarity);
 const skin=pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
 return {skin,duplicate:owned.includes(skin.id),pity:['epic','legendary'].includes(rarity)?0:pity+1};
};
export const rewardFor = (game, resigned=false, mode='bot') => {
 if(!game.isGameOver()&&!resigned)return 0;
 if(game.history().length<10&&!game.isCheckmate())return 0;
 if(game.isDraw()&&!resigned)return 40;
 if(mode==='local')return 40;
 return resigned || game.turn()==='w'?25:60;
};
const weights={p:100,n:320,b:330,r:500,q:900,k:0};
const evaluate = game => {
 if(game.isCheckmate())return game.turn()==='w'?100000:-100000;
 if(game.isDraw())return 0;
 return game.board().flat().filter(Boolean).reduce((sum,p)=>sum+(p.color==='b'?1:-1)*(weights[p.type]+(p.type==='p'?(p.color==='b'?8-Number(p.square[1]):Number(p.square[1])-1)*5:0)),0);
};
const search = (game,depth,alpha,beta) => {
 if(!depth||game.isGameOver())return evaluate(game);
 const maximize=game.turn()==='b';let best=maximize?-Infinity:Infinity;
 const moves=game.moves({verbose:true}).sort((a,b)=>(weights[b.captured]||0)-(weights[a.captured]||0));
 for(const move of moves){game.move(move);const score=search(game,depth-1,alpha,beta);game.undo();best=maximize?Math.max(best,score):Math.min(best,score);if(maximize)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break;}
 return best;
};
export const chooseMove = (fen,rng=Math.random) => {
 const game=new Chess(fen);let best=-Infinity;let chosen=null;
 for(const move of game.moves({verbose:true})){game.move(move);const score=search(game,1,-Infinity,Infinity)+rng()*8;game.undo();if(score>best){best=score;chosen={from:move.from,to:move.to,promotion:move.promotion};}}
 return chosen;
};
