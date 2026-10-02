import {Chess} from './chess.js?v=94';
export const AUTO = Object.freeze({version:4,wins:10,losses:3,maxBudget:24,budget:3,income:3,maxPieces:8,maxPly:120,duration:30000,movetime:100,pace:200});
export const AUTO_KEY='gachachess-autochess-v1';
export const PRICES=Object.freeze({k:0,p:1,n:3,b:3,r:5,q:9});
const copy = value => structuredClone(value);
const rank = (color,front=false) => color==='w'?(front?'2':'1'):(front?'7':'8');
export const placementSquares = (type,color) => [...'abcdefgh'].flatMap(file=>(color==='w'?[1,2,3,4]:[8,7,6,5]).filter(row=>type!=='p'||(row!==1&&row!==8)).map(row=>file+row));
const hash = text => [...String(text)].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);
const startingBudget = run => run.version===1?12:AUTO.budget;
export const purchasePrice = run => 1+run.purchases;
export const levelPrice = run => 3+2*(run.level-1);
export const roundIncome = result => result?.outcome==='win'?5:result?.outcome==='draw'?3:2;
export const shopOdds = level => {
 const step=Math.max(0,Math.min(9,level-1));
 const p=40-4*step,n=25-step,b=25-step,q=1+2*step;
 return {p,n,b,r:100-p-n-b-q,q};
};
export const salePrice = piece => Math.min(PRICES[piece.type],piece.paid??PRICES[piece.type]);
export const buyRandomPiece = run => {
 if(run.version!==4||run.phase!=='preparation'||run.army.length>=AUTO.maxPieces||run.reserve<purchasePrice(run))return run;
 const next=copy(run),paid=purchasePrice(run);let roll=hash(run.seed+':shop:'+run.purchases)%100,type='p';
 for(const [candidate,chance] of Object.entries(shopOdds(run.level))){type=candidate;if(roll<chance)break;roll-=chance;}
 next.reserve-=paid;next.purchases++;next.army.push({id:'piece-'+next.nextId++,type,square:null,paid});return next;
};
export const upgradeShop = run => {
 if(run.version!==4||run.phase!=='preparation'||run.level>=10||run.reserve<levelPrice(run))return run;
 return {...copy(run),reserve:run.reserve-levelPrice(run),level:run.level+1};
};
export const opponentFor = (seed,round,color,initialBudget=AUTO.budget) => {
 const budget=Math.min(AUTO.maxBudget,initialBudget+(round-1)*AUTO.income);
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
 return {version:AUTO.version,id,seed,round:1,color,reserve:AUTO.budget,level:1,purchases:0,sales:0,nextId:1,army:[{id:'king',type:'k',square:'e'+rank(color)}],opponent:opponentFor(seed,1,color==='w'?'b':'w'),phase:'preparation',battle:null,results:[]};
};
export const buyPiece = (run,type) => {
 if(run.version===4||run.phase!=='preparation'||!PRICES[type]||run.reserve<PRICES[type]||run.army.length>=AUTO.maxPieces)return run;
 const next=copy(run);next.reserve-=PRICES[type];next.army.push({id:'piece-'+next.nextId++,type,square:null});return next;
};
export const sellPiece = (run,id) => {
 const piece=run.army.find(piece=>piece.id===id);
 if(run.phase!=='preparation'||!piece||piece.type==='k')return run;
 const next=copy(run),refund=salePrice(piece);next.reserve+=refund;if(run.version===4)next.sales+=refund;next.army=next.army.filter(piece=>piece.id!==id);return next;
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
  if(game.isStalemate())return 'Измените расстановку: у белых нет допустимых ходов';
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
export const seriesFinished = run => run.results.filter(row=>row.outcome==='win').length>=AUTO.wins||run.results.filter(row=>row.outcome==='loss').length>=AUTO.losses;
export const nextRound = run => {
 if(run.phase!=='result'||seriesFinished(run))return run;
 const next=copy(run);next.round++;next.reserve+=run.version===4?roundIncome(run.results.at(-1)):Math.max(0,Math.min(AUTO.income,AUTO.maxBudget-startingBudget(run)-(run.round-1)*AUTO.income));next.phase='preparation';next.battle=null;
 const color=hash(next.seed+':'+next.round+':color')%2?'b':'w';
 if(color!==next.color)next.army=next.army.map(piece=>({...piece,square:piece.square?piece.square[0]+(9-Number(piece.square[1])):null}));
 next.color=color;next.opponent=opponentFor(next.seed,next.round,color==='w'?'b':'w',startingBudget(next));return next;
};
export const restoreAutoRun = value => {
 if(!value)return null;
 const run=JSON.parse(value);
 if(![1,2,3,AUTO.version].includes(run.version)||typeof run.id!=='string'||typeof run.seed!=='string'||!['preparation','paused','result'].includes(run.phase)||!['w','b'].includes(run.color)||!Number.isInteger(run.round)||run.round<1)throw Error('Несовместимое сохранение автошахмат');
 if(!Array.isArray(run.army)||!run.army.length||run.army.length>AUTO.maxPieces||!Number.isInteger(run.reserve)||run.reserve<0||!Number.isInteger(run.nextId))throw Error('Повреждена армия');
 if(run.army.some(piece=>typeof piece.id!=='string'||!(piece.type in PRICES)||(piece.square!==null&&!placementSquares(piece.type,run.color).includes(piece.square)))||new Set(run.army.map(piece=>piece.id)).size!==run.army.length||run.army.filter(piece=>piece.type==='k').length!==1)throw Error('Повреждена расстановка');
 if(run.version!==4&&run.reserve+run.army.reduce((sum,piece)=>sum+PRICES[piece.type],0)!==Math.min(AUTO.maxBudget,startingBudget(run)+(run.round-1)*AUTO.income))throw Error('Повреждён запас');
 if(JSON.stringify(run.opponent)!==JSON.stringify(opponentFor(run.seed,run.round,run.color==='w'?'b':'w',startingBudget(run))))throw Error('Повреждён соперник');
 if(!Array.isArray(run.results)||run.results.length!==(run.phase==='result'?run.round:run.round-1))throw Error('Повреждены результаты');
 if(run.version===4){
  if(!Number.isInteger(run.level)||run.level<1||run.level>10||!Number.isSafeInteger(run.purchases)||run.purchases<0||!Number.isSafeInteger(run.sales)||run.sales<0||run.army.some(piece=>piece.type!=='k'&&(!Number.isInteger(piece.paid)||piece.paid<1||piece.paid>run.purchases)))throw Error('Повреждён магазин');
  const income=run.results.slice(0,run.round-1).reduce((sum,row)=>sum+roundIncome(row),0),upgrades=run.level-1;
  if(run.reserve!==AUTO.budget+income+run.sales-run.purchases*(run.purchases+1)/2-upgrades*(upgrades+2))throw Error('Повреждён запас магазина');
 }
 if(run.results.some((row,index)=>!['win','draw','loss'].includes(row.outcome)||row.battleId!==run.id+':'+(index+1))||seriesFinished({...run,results:run.phase==='result'?run.results.slice(0,-1):run.results}))throw Error('Повреждены результаты серии');
 if(run.battle){
  if(run.battle.initialFen!==setupFen(run)||!Array.isArray(run.battle.moves)||run.battle.moves.length>AUTO.maxPly||!Number.isFinite(run.battle.elapsed)||run.battle.elapsed<0||run.battle.elapsed>AUTO.duration)throw Error('Повреждён бой');
  battleGame(run);
 }else if(run.phase!=='preparation')throw Error('Отсутствует бой');
 return run;
};
