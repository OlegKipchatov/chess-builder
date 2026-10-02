import {Chess} from './chess.js?v=92';
export const AUTO = Object.freeze({version:2,rounds:5,budget:3,income:3,maxPieces:8,maxPly:120,duration:30000,movetime:100,pace:200});
export const AUTO_KEY='gachachess-autochess-v1';
export const PRICES=Object.freeze({k:0,p:1,n:3,b:3,r:5,q:9});
const copy = value => structuredClone(value);
const rank = (color,front=false) => color==='w'?(front?'2':'1'):(front?'7':'8');
export const placementSquares = (type,color) => [...'abcdefgh'].flatMap(file=>(type==='p'?[rank(color,true)]:type==='k'?[rank(color)]:[rank(color),rank(color,true)]).map(row=>file+row));
const hash = text => [...String(text)].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);
const startingBudget = run => run.version===1?12:AUTO.budget;
export const opponentFor = (seed,round,color,initialBudget=AUTO.budget) => {
 const budget=initialBudget+(round-1)*AUTO.income;
 const templates={3:[['p','p','p'],['n'],['b']],6:[['r','p'],['n','b'],['n','p','p','p']],9:[['q'],['r','n','p'],['n','b','p','p','p']],12:[['q','p','p','p'],['r','n','b','p'],['n','n','b','b']],15:[['q','r','p'],['r','r','n','p','p'],['n','n','b','b','n']],18:[['q','q'],['r','r','r','n'],['n','n','n','b','b','b']],21:[['q','q','n'],['q','r','r','p','p'],['n','n','n','b','b','b','b']],24:[['q','q','n','b'],['q','r','r','r'],['q','n','n','n','b','b']]};
 const types=templates[budget][hash(seed+':'+round)%3];
 const army=[{id:'enemy-king',type:'k',square:'e'+rank(color)}];
 const files=hash(seed+'side'+round)%2?[...'abcdefgh']:[...'hgfedcba'];
 for(const [i,type] of types.entries()){
  const choices=type==='p'?files.map(file=>file+rank(color,true)):[...files.map(file=>file+rank(color)),...files.map(file=>file+rank(color,true))];
  army.push({id:'enemy-'+i,type,square:choices.find(square=>!army.some(piece=>piece.square===square))});
 }
 return army;
};
export const createAutoRun = (id,seed=id) => {
 const color=hash(seed+':1:color')%2?'b':'w';
 return {version:AUTO.version,id,seed,round:1,color,reserve:AUTO.budget,nextId:1,army:[{id:'king',type:'k',square:'e'+rank(color)}],opponent:opponentFor(seed,1,color==='w'?'b':'w'),phase:'preparation',battle:null,results:[]};
};
export const buyPiece = (run,type) => {
 if(run.phase!=='preparation'||!PRICES[type]||run.reserve<PRICES[type]||run.army.length>=AUTO.maxPieces)return run;
 const next=copy(run);next.reserve-=PRICES[type];next.army.push({id:'piece-'+next.nextId++,type,square:null});return next;
};
export const sellPiece = (run,id) => {
 const piece=run.army.find(piece=>piece.id===id);
 if(run.phase!=='preparation'||!piece||piece.type==='k')return run;
 const next=copy(run);next.reserve+=PRICES[piece.type];next.army=next.army.filter(piece=>piece.id!==id);return next;
};
export const placePiece = (run,id,square) => {
 const piece=run.army.find(piece=>piece.id===id);
 if(run.phase!=='preparation'||!piece||!placementSquares(piece.type,run.color).includes(square)||run.army.some(other=>other.id!==id&&other.square===square))return run;
 const next=copy(run);next.army.find(piece=>piece.id===id).square=square;return next;
};
export const setupFen = run => {
 const pieces=[...run.army.filter(piece=>piece.square).map(piece=>({...piece,color:run.color})),...run.opponent.map(piece=>({...piece,color:run.color==='w'?'b':'w'}))];
 const rows=Array.from({length:8},(_,r)=>{
  let row='',empty=0;
  for(const file of 'abcdefgh'){
   const piece=pieces.find(piece=>piece.square===file+(8-r));
   if(!piece){empty++;continue;}if(empty){row+=empty;empty=0;}row+=piece.color==='w'?piece.type.toUpperCase():piece.type;
  }
  return row+(empty||'');
 });
 const at=(square,type,color)=>pieces.some(piece=>piece.square===square&&piece.type===type&&piece.color===color);
 let castling='';
 for(const color of ['w','b'])if(at('e'+rank(color),'k',color))for(const [file,right] of [['h','k'],['a','q']])if(at(file+rank(color),'r',color))castling+=color==='w'?right.toUpperCase():right;
 return rows.join('/')+' w '+(castling||'-')+' - 0 1';
};
export const setupError = run => {
 if(run.army.some(piece=>!piece.square))return 'Расставьте купленные фигуры';
 if(run.army.filter(piece=>piece.type==='k').length!==1||run.opponent.filter(piece=>piece.type==='k').length!==1)return 'На поле должны быть оба короля';
 if(run.army.length>AUTO.maxPieces||run.army.some(piece=>!placementSquares(piece.type,run.color).includes(piece.square)))return 'Проверьте расстановку';
 const squares=[...run.army,...run.opponent].map(piece=>piece.square);if(new Set(squares).size!==squares.length)return 'Фигуры не могут занимать одну клетку';
 try{
  const fen=setupFen(run),game=new Chess(fen);
  if(game.isCheck()||new Chess(fen.replace(' w ',' b ')).isCheck())return 'Король под шахом';
  if(game.isGameOver())return 'Добавьте фигуры: начальная позиция уже завершена';
 }catch{return 'Недопустимая начальная позиция';}
 return '';
};
export const beginBattle = run => {
 if(run.phase!=='preparation'||setupError(run))return run;
 return {...copy(run),phase:'paused',battle:{id:run.id+':'+run.round,initialFen:setupFen(run),moves:[],elapsed:0,profile:'sf19-autoplay-100ms-v1',result:null}};
};
export const battleGame = run => {
 const game=new Chess(run.battle.initialFen);
 for(const token of run.battle.moves)game.move({from:token.slice(0,2),to:token.slice(2,4),...(token[4]?{promotion:token[4]}:{})});
 return game;
};
export const battleResult = (game,ply,elapsed) => {
 if(game.isCheckmate())return {winner:game.turn()==='w'?'b':'w',reason:'Мат'};
 if(game.isStalemate())return {winner:null,reason:'Пат'};
 if(game.isThreefoldRepetition())return {winner:null,reason:'Троекратное повторение'};
 if(game.isInsufficientMaterial())return {winner:null,reason:'Недостаточно материала'};
 if(game.isDraw())return {winner:null,reason:'Ничья по правилам шахмат'};
 if(ply>=AUTO.maxPly)return {winner:null,reason:'Достигнут лимит ходов'};
 if(elapsed>=AUTO.duration)return {winner:null,reason:'Время боя закончилось'};
 return null;
};
export const completeBattle = (run,result) => {
 if(run.phase==='result'||!run.battle||run.battle.result)return run;
 const next=copy(run);next.phase='result';next.battle.result=result;
 next.results.push({...result,battleId:next.battle.id,outcome:result.winner===null?'draw':result.winner===run.color?'win':'loss'});return next;
};
export const nextRound = run => {
 if(run.phase!=='result'||run.round>=AUTO.rounds)return run;
 const next=copy(run);next.round++;next.reserve+=AUTO.income;next.phase='preparation';next.battle=null;
 const color=hash(next.seed+':'+next.round+':color')%2?'b':'w';
 if(color!==next.color)next.army=next.army.map(piece=>({...piece,square:piece.square?piece.square[0]+(9-Number(piece.square[1])):null}));
 next.color=color;next.opponent=opponentFor(next.seed,next.round,color==='w'?'b':'w',startingBudget(next));return next;
};
export const restoreAutoRun = value => {
 if(!value)return null;
 const run=JSON.parse(value);
 if(![1,AUTO.version].includes(run.version)||typeof run.id!=='string'||typeof run.seed!=='string'||!['preparation','paused','result'].includes(run.phase)||!['w','b'].includes(run.color)||!Number.isInteger(run.round)||run.round<1||run.round>AUTO.rounds)throw Error('Несовместимое сохранение автошахмат');
 if(!Array.isArray(run.army)||!run.army.length||run.army.length>AUTO.maxPieces||!Number.isInteger(run.reserve)||run.reserve<0||!Number.isInteger(run.nextId))throw Error('Повреждена армия');
 if(run.army.some(piece=>typeof piece.id!=='string'||!(piece.type in PRICES)||(piece.square!==null&&!placementSquares(piece.type,run.color).includes(piece.square)))||new Set(run.army.map(piece=>piece.id)).size!==run.army.length||run.army.filter(piece=>piece.type==='k').length!==1)throw Error('Повреждена расстановка');
 if(run.reserve+run.army.reduce((sum,piece)=>sum+PRICES[piece.type],0)!==startingBudget(run)+(run.round-1)*AUTO.income)throw Error('Повреждён запас');
 if(JSON.stringify(run.opponent)!==JSON.stringify(opponentFor(run.seed,run.round,run.color==='w'?'b':'w',startingBudget(run))))throw Error('Повреждён соперник');
 if(!Array.isArray(run.results)||run.results.length!==(run.phase==='result'?run.round:run.round-1))throw Error('Повреждены результаты');
 if(run.battle){
  if(run.battle.initialFen!==setupFen(run)||!Array.isArray(run.battle.moves)||run.battle.moves.length>AUTO.maxPly||!Number.isFinite(run.battle.elapsed)||run.battle.elapsed<0||run.battle.elapsed>AUTO.duration)throw Error('Повреждён бой');
  battleGame(run);
 }else if(run.phase!=='preparation')throw Error('Отсутствует бой');
 return run;
};
