import {Chess} from './chess.js?v=100';
export const AUTO = Object.freeze({version:4,wins:10,losses:3,maxBudget:24,budget:3,income:3,reserveSlots:4,maxPieces:16,maxPly:120,movetime:100,pace:200});
export const AUTO_KEY='gachachess-autochess-v1';
export const PRICES=Object.freeze({k:0,p:1,n:3,b:3,r:5,q:9});
const copy = value => structuredClone(value);
const rank = (color,front=false) => color==='w'?(front?'2':'1'):(front?'7':'8');
export const placementSquares = (type,color) => [...'abcdefgh'].flatMap(file=>(color==='w'?[1,2,3,4]:[8,7,6,5]).filter(row=>type!=='p'||(row!==1&&row!==8)).map(row=>file+row));
const hash = text => [...String(text)].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);
const startingBudget = run => run.version===1?12:AUTO.budget;
export const armyCapacity = run => run.version===4?Math.min(AUTO.maxPieces,7+run.level):8;
export const reservePieces = run => run.army.filter(piece=>!piece.square);
const reserveSlot = run => Array.from({length:AUTO.reserveSlots},(_,i)=>i).find(i=>!reservePieces(run).some((piece,index)=>(piece.reserveSlot??index)===i));
const settleReserve = run => {
 const reserve=reservePieces(run),occupied=new Set(),limit=Math.max(AUTO.reserveSlots,reserve.length);
 for(const piece of reserve){if(!Number.isInteger(piece.reserveSlot)||piece.reserveSlot<0||piece.reserveSlot>=limit||occupied.has(piece.reserveSlot))piece.reserveSlot=Array.from({length:limit},(_,i)=>i).find(i=>!occupied.has(i));occupied.add(piece.reserveSlot);}
 if(reserve.length<=AUTO.reserveSlots)delete run.legacyReserveOverflow;
 return run;
};
export const purchaseError = (run,price=purchasePrice(run)) => {
 if(run.phase!=='preparation')return 'Бой идёт';
 if(run.army.length>=armyCapacity(run))return 'Армия заполнена';
 if(reservePieces(run).length>=AUTO.reserveSlots)return 'Резерв заполнен';
 if(run.reserve<price)return `Не хватает ${price-run.reserve} монет`;
 return '';
};
export const upgradeError = run => run.phase!=='preparation'?'Бой идёт':run.level>=10?'Максимальный уровень':run.reserve<levelPrice(run)?`Не хватает ${levelPrice(run)-run.reserve} монет`:'';
export const purchasePrice = run => 1+run.purchases;
export const levelPrice = run => 3+2*(run.level-1);
export const roundIncome = result => (result?.outcome==='win'?5:result?.outcome==='draw'?3:2)+Math.max(0,(result?.shopLevel||1)-1);
export const shopOdds = level => {
 const step=Math.max(0,Math.min(9,level-1));
 const p=40-4*step,n=25-step,b=25-step,q=1+2*step;
 return {p,n,b,r:100-p-n-b-q,q};
};
export const salePrice = piece => Math.max(1,Math.floor((piece.paid??PRICES[piece.type])*0.5));
export const buyRandomPiece = run => {
 if(run.version!==4||purchaseError(run))return run;
 const next=copy(run),paid=purchasePrice(run);let roll=hash(run.seed+':shop:'+run.purchases)%100,type='p';
 for(const [candidate,chance] of Object.entries(shopOdds(run.level))){type=candidate;if(roll<chance)break;roll-=chance;}
 next.reserve-=paid;next.purchases++;next.army.push({id:'piece-'+next.nextId++,type,square:null,benched:true,paid,reserveSlot:reserveSlot(run)});return next;
};
export const upgradeShop = run => {
 if(run.version!==4||upgradeError(run))return run;
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
 const enemyColor=color==='w'?'b':'w',enemy=planOpponent([{id:'enemy-king',type:'k',square:'e'+rank(enemyColor),paid:0}],{reserve:AUTO.budget,level:1,purchases:0,sales:0,income:0,openingBalance:AUTO.budget},seed,enemyColor);
 return {version:AUTO.version,reserveRule:1,id,seed,round:1,color,reserve:AUTO.budget,level:1,purchases:0,sales:0,nextId:1,army:[{id:'king',type:'k',square:'e'+rank(color)}],opponent:enemy.army,opponentProgress:enemy.progress,phase:'preparation',battle:null,results:[]};
};
export const buyPiece = (run,type) => {
 if(run.version===4||!PRICES[type]||purchaseError(run,PRICES[type]))return run;
 const next=copy(run);next.reserve-=PRICES[type];next.army.push({id:'piece-'+next.nextId++,type,square:null,benched:true,reserveSlot:reserveSlot(run)});return next;
};
export const sellPiece = (run,id) => {
 const piece=run.army.find(piece=>piece.id===id);
 if(run.phase!=='preparation'||!piece||piece.type==='k')return run;
 const next=copy(run),refund=salePrice(piece);next.reserve+=refund;if(run.version===4)next.sales+=refund;else next.saleLoss=(next.saleLoss||0)+PRICES[piece.type]-refund;next.army=next.army.filter(piece=>piece.id!==id);return settleReserve(next);
};
export const placePiece = (run,id,square) => {
 const piece=run.army.find(piece=>piece.id===id),occupant=run.army.find(other=>other.square===square&&other.id!==id);
 if(run.phase!=='preparation'||!piece||!placementSquares(piece.type,run.color).includes(square)||(occupant&&piece.square))return run;
 const next=copy(run),placed=next.army.find(piece=>piece.id===id);
 if(occupant){const swapped=next.army.find(piece=>piece.id===occupant.id);swapped.square=null;swapped.benched=true;swapped.reserveSlot=piece.reserveSlot??reservePieces(run).findIndex(other=>other.id===id);}
 placed.square=square;delete placed.benched;delete placed.reserveSlot;return settleReserve(next);
};
export const benchPiece = (run,id) => {
 const piece=run.army.find(piece=>piece.id===id);
 if(run.phase!=='preparation'||!piece||!piece.square||reservePieces(run).length>=AUTO.reserveSlots)return run;
 const next=copy(run),benched=next.army.find(piece=>piece.id===id);benched.square=null;benched.benched=true;benched.reserveSlot=reserveSlot(run);return next;
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
 if(reservePieces(run).length>AUTO.reserveSlots)return 'Разберите сохранённый резерв';
 if(run.army.some(piece=>piece.type==='k'&&!piece.square))return 'Поставьте короля на поле';

 if(run.army.filter(piece=>piece.type==='k').length!==1||run.opponent.filter(piece=>piece.type==='k').length!==1)return 'На поле должны быть оба короля';
 if(run.army.length>armyCapacity(run)||run.army.some(piece=>piece.square&&!placementSquares(piece.type,run.color).includes(piece.square)))return 'Проверьте расстановку';
 const squares=[...run.army,...run.opponent].map(piece=>piece.square).filter(Boolean);if(new Set(squares).size!==squares.length)return 'Фигуры не могут занимать одну клетку';
 try{
  const fen=setupFen(run),game=new Chess(fen);
 }catch{return 'Недопустимая начальная позиция';}
 return '';
};
// Repair only the bot's placement, without purchases, sales or player changes.
export const legalOpponentSetup = run => {
 const next=copy(run),color=run.color==='w'?'b':'w';
 const threats=()=>{const game=new Chess(setupFen(next)),king=game.board().flat().find(p=>p?.type==='k'&&p.color==='b');return game.attackers(king.square,'w').length;};
 let count=threats();if(!count)return next;
 // Each pass removes at least one attack; swaps preserve even a full formation.
 for(let pass=0;pass<32&&count;pass++){
  let best=null,bestCount=count;
  for(const piece of next.opponent)for(const square of placementSquares(piece.type,color)){
   const previous=piece.square,occupant=next.opponent.find(other=>other!==piece&&other.square===square);
   if(occupant&&!placementSquares(occupant.type,color).includes(previous))continue;
   piece.square=square;if(occupant)occupant.square=previous;
   const score=threats();
   if(score<bestCount){bestCount=score;best={id:piece.id,square,other:occupant?.id,previous};}
   piece.square=previous;if(occupant)occupant.square=square;
   if(bestCount===0)break;
  }
  if(!best)return null;
  next.opponent.find(piece=>piece.id===best.id).square=best.square;
  if(best.other)next.opponent.find(piece=>piece.id===best.other).square=best.previous;
  count=bestCount;
 }
 return count?null:next;
};
export const beginBattle = run => {
 if(run.phase!=='preparation'||setupError(run))return run;
 const next=legalOpponentSetup(run);if(!next)return run;
 return {...next,opponentSetupVersion:1,phase:'paused',battle:{id:run.id+':'+run.round,initialFen:setupFen(next),moves:[],elapsed:0,profile:'sf19-autoplay-100ms-v1',result:null}};
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
 return null;
};
export const completeBattle = (run,result) => {
 if(run.phase==='result'||!run.battle||run.battle.result)return run;
 const next=copy(run);next.phase='result';next.battle.result=result;
 next.results.push({...result,shopLevel:run.version===4?run.level:1,battleId:next.battle.id,outcome:result.winner===null?'draw':result.winner===run.color?'win':'loss'});return next;
};
export const seriesFinished = run => run.results.filter(row=>row.outcome==='win').length>=AUTO.wins||run.results.filter(row=>row.outcome==='loss').length>=AUTO.losses;
// This planner receives only its own inventory/economy. It never inspects the player's board.
const expectedPieceValue = level => Object.entries(shopOdds(level)).reduce((sum,[type,chance])=>sum+PRICES[type]*chance/100,0);
const attacksFrom = (piece,army,color) => {
 const x='abcdefgh'.indexOf(piece.square[0]),y=Number(piece.square[1]),result=[];
 const directions=piece.type==='n'?[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]:piece.type==='p'?[[-1,color==='w'?1:-1],[1,color==='w'?1:-1]]:piece.type==='b'?[[1,1],[1,-1],[-1,1],[-1,-1]]:piece.type==='r'?[[1,0],[-1,0],[0,1],[0,-1]]:[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
 for(const [dx,dy] of directions)for(let step=1;step<=(['b','r','q'].includes(piece.type)?7:1);step++){
  const file=x+dx*step,row=y+dy*step;if(file<0||file>7||row<1||row>8)break;
  const square='abcdefgh'[file]+row;result.push(square);if(army.some(other=>other.square===square))break;
 }
 return result;
};
export const arrangeOpponent = (pieces,color) => {
 const army=copy(pieces);
 // Start from a valid compact position, then make two bounded coordinate-descent passes.
 for(const piece of army){piece.square=placementSquares(piece.type,color).find(square=>!army.some(other=>other!==piece&&other.square===square));delete piece.reserveSlot;delete piece.benched;}
 const score = () => {
  let value=0;const king=army.find(piece=>piece.type==='k');
  for(const piece of army){
   const row=color==='w'?Number(piece.square[1]):9-Number(piece.square[1]),file='abcdefgh'.indexOf(piece.square[0]);
   const attacks=attacksFrom(piece,army,color),friends=army.filter(other=>other!==piece&&attacks.includes(other.square));
   value+=friends.reduce((sum,other)=>sum+(other.type==='k'?1.4:0.3*Math.sqrt(PRICES[other.type])),0);
   if(piece.type==='k'){
    const exits=attacks.filter(square=>!army.some(other=>other.square===square));
    const offRank=exits.filter(square=>square[1]!==piece.square[1]);
    // Shelter must leave escape squares: friendly blockers can create a back-rank mate.
    value+=2*Math.min(3,exits.length)+4*Math.min(2,offRank.length);
    if(offRank.length===0)value-=20;
    const protectedExits=offRank.filter(square=>army.some(other=>other.type!=='k'&&attacksFrom(other,army,color).includes(square)));
    value+=0.8*Math.min(2,protectedExits.length);
    value-=2*(row-1)+0.2*Math.abs(file-4);
   }
   else{
    value+=0.12*attacks.filter(square=>!army.some(other=>other.square===square)).length;
    // Keep an army behind the centre, avoiding an exposed front line before reveal.
    value-=row>2?(row-2)*2:0;
    if(piece.type==='n'||piece.type==='p')value+=0.15*(3.5-Math.abs(file-3.5));
    if(piece.type==='p'&&Math.abs(file-'abcdefgh'.indexOf(king.square[0]))<=1)value+=0.8;
   }
  }
  return value;
 };
 for(let pass=0;pass<2;pass++)for(const piece of army){
  let best=piece.square,bestScore=score();
  for(const square of placementSquares(piece.type,color)){
   if(army.some(other=>other!==piece&&other.square===square))continue;
   piece.square=square;const candidate=score();if(candidate>bestScore+0.00001){bestScore=candidate;best=square;}
  }
  piece.square=best;
 }
 return army;
};
// Eight-round beam forecast: compares buying, upgrading and saving using expected
// draws, never the actual next random result. Numerical states only; no chess worker.
const opponentShopAction = (shop,baseIncome,horizon) => {
 const value = state => state.troops.reduce((sum,piece)=>sum+piece.value,0);
 const rankState = state => state.score+0.5*value(state)+0.2*Math.min(expectedPieceValue(state.level),state.reserve*expectedPieceValue(state.level)/(state.purchases+1));
 let beam=[{reserve:shop.reserve,level:shop.level,purchases:shop.purchases,troops:shop.army.filter(piece=>piece.type!=='k').map(piece=>({value:PRICES[piece.type],paid:piece.paid})),score:0,first:null}];
 for(let round=0;round<horizon;round++){
  const candidates=[];
  for(const state of beam){
   let frontier=[state];
   for(let action=0;action<=3;action++){
    const next=[];
    for(const current of frontier){
     candidates.push({...current,score:current.score+value(current)*Math.pow(0.95,round),first:current.first||'save'});
     if(action===3)continue;
     const troops=[...current.troops].sort((a,b)=>a.value-b.value||b.paid-a.paid),full=troops.length>=armyCapacity({version:4,level:current.level})-1;
     const refund=full?Math.max(1,Math.floor(troops[0].paid/2)):0,cost=current.purchases+1,expected=expectedPieceValue(current.level);
     if(current.reserve+refund>=cost&&(!full||expected>troops[0].value)){
      next.push({...current,reserve:current.reserve+refund-cost,purchases:current.purchases+1,troops:[...(full?troops.slice(1):troops),{value:expected,paid:cost}],first:current.first||'buy'});
     }
     const upgrade=3+2*(current.level-1);
     if(current.level<10&&troops.length>=2&&current.reserve>=upgrade)next.push({...current,reserve:current.reserve-upgrade,level:current.level+1,first:current.first||'upgrade'});
    }
    frontier=next;
   }
  }
  // Retain alternatives for each initial action so pruning cannot force a choice.
  beam=['buy','upgrade','save'].flatMap(first=>candidates.filter(state=>state.first===first).sort((a,b)=>rankState(b)-rankState(a)).slice(0,4));
  if(round<horizon-1)beam=beam.map(state=>({...state,reserve:state.reserve+baseIncome+state.level-1}));
 }
 return beam.sort((a,b)=>rankState(b)-rankState(a))[0]?.first||'save';
};
export const planOpponent = (pieces,progress,seed,color,baseIncome=3,horizon=8) => {
 let shop={version:4,phase:'preparation',army:copy(pieces),seed:seed+':opponent',nextId:progress.purchases+1,...progress};
 const openingBalance=progress.openingBalance??(progress.reserve+progress.purchases*(progress.purchases+1)/2+(progress.level-1)*(progress.level+1)-(progress.sales||0)-(progress.income||0));
 shop.sales=shop.sales||0;
 for(let action=0;action<32;action++){
  if(reservePieces(shop).length>=AUTO.reserveSlots)shop.army=arrangeOpponent(shop.army,color);
  const decision=opponentShopAction(shop,baseIncome,horizon);
  if(decision==='save')break;
  if(decision==='upgrade'){shop=upgradeShop(shop);continue;}
  if(shop.army.length>=armyCapacity(shop)){
   const weakest=shop.army.filter(piece=>piece.type!=='k').sort((a,b)=>PRICES[a.type]-PRICES[b.type]||salePrice(b)-salePrice(a))[0];
   shop=sellPiece(shop,weakest.id); // Commit the sale before the random draw.
  }
  shop=buyRandomPiece(shop);
 }
 return {army:arrangeOpponent(shop.army,color),progress:{strategy:1,reserve:shop.reserve,level:shop.level,purchases:shop.purchases,sales:shop.sales,income:progress.income||0,openingBalance}};
};
export const advanceOpponent = (run,color) => {
 const army=copy(run.opponent).map(piece=>({...piece,paid:piece.paid??PRICES[piece.type]}));
 const progress={...(run.opponentProgress||{reserve:0,level:1,purchases:army.length-1})};
 // Legacy armies retain their inventory and cash; anchor their historical balance once.
 progress.openingBalance??=progress.reserve+progress.purchases*(progress.purchases+1)/2+(progress.level-1)*(progress.level+1)-(progress.sales||0)-(progress.income||0);
 const outcome=run.results.at(-1)?.outcome;
 const income=roundIncome({outcome:outcome==='win'?'loss':outcome==='loss'?'win':'draw',shopLevel:progress.level});
 progress.reserve+=income;progress.income=(progress.income||0)+income;
 return planOpponent(army,progress,run.seed,color,roundIncome({outcome:outcome==='win'?'loss':outcome==='loss'?'win':'draw',shopLevel:1}),Math.max(1,Math.min(8,AUTO.wins-run.results.filter(result=>result.outcome==='win').length)));
};
export const nextRound = run => {
 if(run.phase!=='result'||seriesFinished(run))return run;
 const next=copy(run);next.round++;next.reserve+=run.version===4?roundIncome(run.results.at(-1)):Math.max(0,Math.min(AUTO.income,AUTO.maxBudget-startingBudget(run)-(run.round-1)*AUTO.income));next.phase='preparation';next.battle=null;
 const color=hash(next.seed+':'+next.round+':color')%2?'b':'w';
 if(color!==next.color)next.army=next.army.map(piece=>({...piece,square:piece.square?'abcdefgh'[7-'abcdefgh'.indexOf(piece.square[0])]+(9-Number(piece.square[1])):null}));
 if(run.version===4){const enemy=advanceOpponent(run,color==='w'?'b':'w');next.opponent=enemy.army;next.opponentProgress=enemy.progress;}
 else next.opponent=opponentFor(next.seed,next.round,color==='w'?'b':'w',startingBudget(next));
 next.color=color;return next;
};
export const restoreAutoRun = value => {
 if(!value)return null;
 const run=JSON.parse(value);
 if(![1,2,3,AUTO.version].includes(run.version)||typeof run.id!=='string'||typeof run.seed!=='string'||!['preparation','paused','result'].includes(run.phase)||!['w','b'].includes(run.color)||!Number.isInteger(run.round)||run.round<1)throw Error('Несовместимое сохранение автошахмат');
 if(!Array.isArray(run.army)||!run.army.length||run.army.length>armyCapacity(run)||!Number.isInteger(run.reserve)||run.reserve<0||!Number.isInteger(run.nextId))throw Error('Повреждена армия');
 if(run.army.some(piece=>typeof piece.id!=='string'||!(piece.type in PRICES)||(piece.square!==null&&!placementSquares(piece.type,run.color).includes(piece.square)))||new Set(run.army.map(piece=>piece.id)).size!==run.army.length||run.army.filter(piece=>piece.type==='k').length!==1)throw Error('Повреждена расстановка');
 if(run.version!==4&&run.reserve+run.army.reduce((sum,piece)=>sum+PRICES[piece.type],0)+(run.saleLoss||0)!==Math.min(AUTO.maxBudget,startingBudget(run)+(run.round-1)*AUTO.income))throw Error('Повреждён запас');
 if(run.opponentProgress){
  const p=run.opponentProgress,enemyColor=run.color==='w'?'b':'w';
  if(p.strategy===1&&(![p.sales,p.income,p.openingBalance].every(value=>Number.isSafeInteger(value)&&value>=0)||p.reserve!==p.openingBalance+p.income+p.sales-p.purchases*(p.purchases+1)/2-(p.level-1)*(p.level+1)||run.opponent.some(piece=>!Number.isSafeInteger(piece.paid)||piece.paid<0)))throw Error('Повреждён бюджет соперника');
  if(!Number.isSafeInteger(p.reserve)||p.reserve<0||!Number.isSafeInteger(p.purchases)||p.purchases<0||!Number.isInteger(p.level)||p.level<1||p.level>10||!Array.isArray(run.opponent)||run.opponent.length>armyCapacity({version:4,level:p.level})||run.opponent.filter(piece=>piece.type==='k').length!==1||run.opponent.some(piece=>!(piece.type in PRICES)||!placementSquares(piece.type,enemyColor).includes(piece.square))||new Set(run.opponent.map(piece=>piece.square)).size!==run.opponent.length||new Set(run.opponent.map(piece=>piece.id)).size!==run.opponent.length)throw Error('Повреждён соперник');
 }else {
  const expected=opponentFor(run.seed,run.round,run.color==='w'?'b':'w',startingBudget(run));
  const identity=army=>army.map(({square,...piece})=>piece);
  const valid=run.opponentSetupVersion===1?JSON.stringify(identity(run.opponent))===JSON.stringify(identity(expected))&&run.opponent.every(piece=>placementSquares(piece.type,run.color==='w'?'b':'w').includes(piece.square))&&new Set(run.opponent.map(piece=>piece.square)).size===run.opponent.length:JSON.stringify(run.opponent)===JSON.stringify(expected);
  if(!valid)throw Error('Повреждён соперник');
 }
 if(!Array.isArray(run.results)||run.results.length!==(run.phase==='result'?run.round:run.round-1))throw Error('Повреждены результаты');
 if(run.version===4){
  if(!Number.isInteger(run.level)||run.level<1||run.level>10||!Number.isSafeInteger(run.purchases)||run.purchases<0||!Number.isSafeInteger(run.sales)||run.sales<0||run.army.some(piece=>piece.type!=='k'&&(!Number.isInteger(piece.paid)||piece.paid<1||piece.paid>run.purchases)))throw Error('Повреждён магазин');
  const income=run.results.slice(0,run.round-1).reduce((sum,row)=>sum+roundIncome(row),0),upgrades=run.level-1;
  if(run.reserve!==AUTO.budget+income+run.sales-run.purchases*(run.purchases+1)/2-upgrades*(upgrades+2))throw Error('Повреждён запас магазина');
 }
 if(run.results.some((row,index)=>!['win','draw','loss'].includes(row.outcome)||row.battleId!==run.id+':'+(index+1)||(row.shopLevel!==undefined&&(!Number.isInteger(row.shopLevel)||row.shopLevel<1||row.shopLevel>10)))||seriesFinished({...run,results:run.phase==='result'?run.results.slice(0,-1):run.results}))throw Error('Повреждены результаты серии');
 if(run.battle){
  if(run.battle.initialFen!==setupFen(run)||!Array.isArray(run.battle.moves)||run.battle.moves.length>AUTO.maxPly||!Number.isFinite(run.battle.elapsed)||run.battle.elapsed<0)throw Error('Повреждён бой');
  battleGame(run);
 }else if(run.phase!=='preparation')throw Error('Отсутствует бой');
 const reserve=reservePieces(run);
 if(!run.reserveRule){run.reserveRule=1;if(reserve.length>AUTO.reserveSlots)run.legacyReserveOverflow=true;}
 if(reserve.length>AUTO.reserveSlots&&!run.legacyReserveOverflow)throw Error('Повреждён резерв');
 return settleReserve(run);
};
