import {closeActivityDay, calendarHTML, dayLabel} from './activity.js?v=14';
import {createStockfishClient, createStockfish19Client} from './stockfish-client.js?v=14';
import {capturePoints, completedMatch, materialBalance} from './archive.js?v=14';
import {opponentFor, settleRating, signedDelta} from './rating.js?v=14';
import {Chess} from './chess.js?v=14';
import {TYPES, ITEMS, PIECE_NAMES, rarityNames, itemById, styleById, craftCost} from './catalog.js?v=14';
import {openChest, craftItem} from './economy.js?v=14';
import {KEY, loadState, initialState, newGame} from './state.js?v=14';
import {pieceSVG, itemPreview, equipmentPreview} from './pieces.js?v=14';
import {renderBoard, snapshotBoard, animateMove, animateTransition, historyMoves} from './board.js?v=14';
import {renderCollection, escapeHTML, presetEquipment, canEquipPreset} from './collection.js?v=14';
import {isMatchActive, navigationTarget, createStartedGame, positionAt, historyCursor, canPlayPosition} from './session.js?v=14';
const $ = selector => document.querySelector(selector);
let storageError = false;
let state;
try {state=loadState(localStorage);} catch {state=initialState();storageError=true;}
const game = new Chess();
try {if(state.game.pgn)game.loadPgn(state.game.pgn);} catch {game.reset();state.game=newGame();storageError=true;}
let selected=null, promotion=null, busy=false, animating=false, worker=null, taskId=0, toastTimer, installPrompt=null;
let collectionView='sets', pieceType='k', ownedOnly=false, currentScreen='play', reviewCursor=null, pendingBotMove=null;
let queuedCursor=undefined;
let pendingActivity=null;
let displayMatch=null, pendingResult=false, replayRunning=false, replayTimer=null;
const viewedGame = () => displayMatch?.game||game;
const viewedConfig = () => displayMatch?.config||(state.game.started?state.game:state.settings);
const toast = message => {
  $('#toast').textContent=message;
  $('#toast').style.display='block';
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('#toast').style.display='none',5000);
};
const persist = (next,reset=false) => {
  const snapshot={...next, game:{...next.game,pgn:reset?'':game.pgn()}};
  try {localStorage.setItem(KEY,JSON.stringify(snapshot));state=snapshot;return true;}
  catch {toast('Не удалось сохранить прогресс. Освободите место или разрешите хранение данных.');return false;}
};
const showModal = html => {
  $('#modal-content').innerHTML=html;
  $('#close-modal').hidden=false;
  if(!$('#modal').open)$('#modal').showModal();
};
const ended = () => state.game.resigned || game.isGameOver();
const locked = () => busy || animating;
const active = () => isMatchActive(state,game);
const statusText = () => {
  if(state.game.resigned)return state.game.mode==='bot'?'Вы сдались':`${game.turn()==='w'?'Белые':'Чёрные'} сдались`;
  if(game.isCheckmate())return `Мат. ${game.turn()==='w'?'Чёрные':'Белые'} победили`;
  if(game.isStalemate())return 'Пат. Ничья';
  if(game.isThreefoldRepetition())return 'Ничья: повторение позиции';
  if(game.isInsufficientMaterial())return 'Ничья: недостаточно фигур';
  if(game.isDraw())return 'Ничья';
  return `${game.isCheck()?'Шах! ':''}Ход ${game.turn()==='w'?'белых':'чёрных'}`;
};
const settle = (notifyActivity=true) => {
  if(!ended()||!state.game.started)return;
  const wasSettled=state.game.settled, title=statusText();
  const finishedGame=new Chess();finishedGame.loadPgn(game.pgn());
  const finishedConfig=structuredClone(state.game);
  const result=completedMatch(state,game,{id:crypto.randomUUID(),finishedAt:new Date().toISOString()});
  if(!result)return;
  const closed=closeActivityDay(state.activity,{counted:!!result.entry&&!wasSettled,finishedAt:result.entry?.finishedAt});
  if(!persist({...result.state,activity:closed.activity},true))return;
  pendingActivity=notifyActivity?closed.event:null;
  const {entry,reward,rating}=result;
  stopBot();game.reset();reviewCursor=null;queuedCursor=undefined;selected=null;
  if(!wasSettled){displayMatch={game:finishedGame,config:finishedConfig,kind:'result'};pendingResult=true;}
  if(result.cancelled){showModal('<h2>Партия отменена</h2><p>Вы не сделали ни одного хода. Рейтинг сохранён, партия не учитывается в статистике.</p>');return;}
  if(!wasSettled)showModal(`<p class="eyebrow">ПАРТИЯ ЗАВЕРШЕНА</p><h2>${title}</h2><h2>+${reward} монет</h2><p>Взято фигур на ${entry.points} очков</p>${rating?`<p class="rating-result">Рейтинг: ${entry.playerRating} → <strong>${rating.value}</strong> (${signedDelta(rating.lastDelta)})</p>`:''}<p>Партия сохранена в истории профиля.</p>`);
};
const drawBoard = () => {
  const config=viewedConfig(),equipped=config.equipped||state.equipped;
  renderBoard($('#board'),positionAt(viewedGame(),reviewCursor),equipped,!displayMatch&&reviewCursor===null?selected:null,config.playerColor||'w');
  $('#board').classList.toggle('reviewing',reviewCursor!==null);
  $('#board').setAttribute('aria-label',reviewCursor!==null?'Просмотр прежней позиции':'Шахматная доска');
  $('#board').querySelectorAll('[data-square]').forEach(cell=>cell.setAttribute('aria-disabled',String(!!displayMatch||!canPlayPosition(state,game,reviewCursor))));
};
const drawCollection = () => renderCollection($('#collection-content'),state,collectionView,pieceType,ownedOnly);
const syncNavigation = () => {
  currentScreen=pendingResult?'play':navigationTarget(state,game,currentScreen);
  document.querySelectorAll('.tab').forEach(section=>section.hidden=section.id!==currentScreen);
  document.querySelectorAll('[data-tab]').forEach(button=>{
    button.classList.toggle('active',button.dataset.tab===currentScreen);
    button.disabled=(active()||pendingResult)&&button.dataset.tab!=='play';
    button.title=button.disabled?'Доступно после завершения партии':'';
    button.setAttribute('aria-current',button.dataset.tab===currentScreen?'page':'false');
  });
  $('#app-nav').hidden=active()||pendingResult;
  $('#profile-avatar').disabled=active()||pendingResult;

  document.body.classList.toggle('match-active',active()||pendingResult);
  $('.brand').setAttribute('aria-disabled',String(active()));
};
const renderArchive = () => {
  const root=$('#match-archive'), rowHeight=104, total=state.archive.length;
  if(!total){root.innerHTML='<p class="muted">Здесь появятся завершённые партии.</p>';return;}
  const start=Math.max(0,Math.floor((root.scrollTop||0)/rowHeight)-3);
  const end=Math.min(total,start+Math.ceil((root.clientHeight||520)/rowHeight)+6);
  root.innerHTML=`<div style="height:${start*rowHeight}px" aria-hidden="true"></div>${state.archive.slice(start,end).map((entry,index)=>`<button class="archive-entry" data-archive="${escapeHTML(entry.id)}" aria-label="Партия ${start+index+1} из ${total}: ${escapeHTML(entry.result)}"><span><strong>${escapeHTML(entry.result)}</strong><small>${entry.playerColor==='w'?'Белые':'Чёрные'} · ${Number.isNaN(Date.parse(entry.finishedAt))?'Дата неизвестна':new Date(entry.finishedAt).toLocaleDateString('ru-RU')}</small></span><span>${entry.points} очк.<small>${entry.ratingDelta===null?'Без рейтинга':signedDelta(entry.ratingDelta)+' рейтинга'}</small></span></button>`).join('')}<div style="height:${(total-end)*rowHeight}px" aria-hidden="true"></div>`;
};
const renderStatistics = () => {
  const entries=state.archive.filter(entry=>entry.mode==='bot'), wins=entries.filter(entry=>entry.result==='Победа').length;
  const draws=entries.filter(entry=>entry.result==='Ничья').length, losses=entries.length-wins-draws;
  const percent=entries.length?Math.round(wins/entries.length*100)+'%':'—';
  const card=(value,label)=>`<article><strong>${value}</strong><span>${label}</span></article>`;
  $('#play-stats').innerHTML=card(state.rating.value,'Рейтинг')+card(percent,'Побед');
  $('#detailed-statistics').innerHTML=card(entries.length,'Партий с ИИ')+card(wins,'Побед')+card(draws,'Ничьих')+card(losses,'Поражений')+card(percent,'Процент побед')+card(state.rating.value,'Текущий рейтинг')+card(state.rating.games,'Рейтинговых партий')+card(state.owned.length,'Предметов')+card(state.opened,'Сундуков');
};
$('#match-archive').addEventListener('scroll',renderArchive,{passive:true});
window.addEventListener('resize',()=>{if(currentScreen==='archive')renderArchive();});
const renderCalendar = () => {$('#activity-calendar').innerHTML=calendarHTML(state.activity);};
setInterval(()=>{if(currentScreen==='calendar')renderCalendar();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentScreen==='calendar')renderCalendar();});
const renderProfile = () => {

  $('#rating-value').textContent=state.rating.value;
  $('#rating-delta').textContent=state.rating.games?`${signedDelta(state.rating.lastDelta)} за последнюю партию`:'Начальный рейтинг';
  $('#rating-progress').value=Math.min(state.rating.games,10);
  $('#rating-calibration').textContent=state.rating.games<10?`Калибровка: ${state.rating.games} из 10 партий`:`Рейтинговых партий: ${state.rating.games}`;
  $('#rating-opponent').textContent=`Следующий уровень: ${opponentFor(state.rating.value)}${state.rating.value>=1600?' · максимум движка':''}`;
  renderArchive();renderStatistics();
  $('#profile-played').textContent=state.played;
  $('#profile-owned').textContent=state.owned.length;
  $('#profile-opened').textContent=state.opened;
  $('#profile-rewards').textContent=state.settings.mode==='local'?'Завершённая партия +40 монет':'Победа +60 · ничья +40 · поражение +25';
};
const renderHistory = () => {
  const moves=viewedGame().history(), cursor=(queuedCursor===undefined?reviewCursor:queuedCursor)??moves.length;
  $('#replay-start').hidden=displayMatch?.kind!=='archive'||replayRunning;
  $('#replay-pause').hidden=displayMatch?.kind!=='archive'||!replayRunning;
  $('#replay-start').disabled=!moves.length;
  $('#history-live').setAttribute('aria-label',displayMatch?.kind==='archive'?'К последнему ходу':'К текущему ходу');
  $('#history-back').disabled=cursor===0;
  $('#history-forward').disabled=cursor===moves.length;
  $('#history-live').disabled=cursor===moves.length;
  $('#history-position').textContent=reviewCursor===null?`Текущая позиция · ${moves.length} полуходов`:`Позиция ${cursor} из ${moves.length}`;
  $('#history-notice').hidden=reviewCursor===null||!!displayMatch;
  $('#move-count').textContent=moves.length;
  const moveButton=(index)=>moves[index]?`<button data-history-ply="${index+1}" class="history-move ${cursor===index+1?'selected-move':''}" aria-current="${cursor===index+1?'step':'false'}" >${moves[index]}</button>`:'<span>—</span>';
  $('#moves').innerHTML=moves.length?Array.from({length:Math.ceil(moves.length/2)},(_,i)=>`<div class="move-row"><span class="muted">${i+1}.</span>${moveButton(i*2)}${moveButton(i*2+1)}</div>`).join(''):'<p class="muted">Здесь появится история партии.</p>';
  if(reviewCursor===null)$('#moves').scrollTop=$('#moves').scrollHeight;
};
const renderGameInfo = () => {
  const config=viewedConfig(),hasBoard=!!displayMatch||state.game.started;
  const color=config.playerColor||'w';
  const points=materialBalance(positionAt(viewedGame(),reviewCursor),color);
  const pointsText=`${signedDelta(points)} очк.`;
  for(const node of [$('#match-points'),$('#match-settings')])node.dataset.balance=points>0?'positive':points<0?'negative':'zero';
  $('#player-color').textContent=hasBoard?(color==='w'?'Белые фигуры':'Чёрные фигуры'):'Случайная сторона';
  $('#opponent-color').textContent=hasBoard?(color==='w'?'Чёрные фигуры':'Белые фигуры'):'Сторона определится при старте';
  $('#player-name').textContent=config.mode==='bot'?'Вы':'Игрок 1';
  $('#opponent-avatar').innerHTML=pieceSVG('n',color==='w'?'b':'w');
  $('#player-avatar').innerHTML=pieceSVG('p',color);
  $('#opponent').textContent=config.mode==='bot'?'ИИ':'Второй игрок';
  $('#opponent-rating').textContent=config.mode==='bot'?`Рейтинг ${config.rating?.opponent??opponentFor(state.rating.value)}`:'';
  $('#player-rating').textContent=`Рейтинг ${config.rating?.before??state.rating.value}`;
  $('#match-points').textContent=pointsText;
  $('#match-surface').hidden=!hasBoard;
  $('#archive-return').hidden=displayMatch?.kind!=='archive';
  $('#archive-return').disabled=animating;
  $('#play-rewards').hidden=hasBoard;
  $('#play-stats').hidden=hasBoard;
  $('#status').textContent=displayMatch?(displayMatch.title||'Партия завершена'):reviewCursor!==null?'Просмотр истории':state.game.started?statusText():'Готовы начать?';
  $('#resign').disabled=!active()||animating;
  $('#resign').hidden=!active();
  $('#hint').textContent=displayMatch?'Просматривайте партию стрелками или выберите ход в журнале.':reviewCursor!==null?'Ходы не отменяются. Вернитесь к текущей позиции, чтобы продолжить.':active()?'Выберите фигуру, чтобы увидеть доступные ходы.':state.game.started?'Можно просмотреть всю партию или вернуться в профиль.':'Настройки игры выбираются в профиле.';
  $('#skin-name').textContent=styleById(itemById((config.equipped||state.equipped).board).style).name;
  $('#game-ready').hidden=hasBoard;
  $('#match-title').textContent=displayMatch?'История партии':active()?'В игре':state.game.started?'Итоги партии':'Игра';
  $('#match-settings').textContent=hasBoard?'':config.mode==='bot'?'ИИ · по вашему рейтингу':'Вдвоём';
  $('#ready-title').textContent=state.game.started?'Готовы к новой партии?':'Сыграем?';
  $('#ready-description').textContent=state.game.started?'Завершённые партии хранятся в профиле.':'Сторона выбирается случайно. Уровень — по вашему рейтингу.';
  $('#start-game').textContent=state.game.started?'Начать новую партию':'Начать партию';
  $('#start-game').disabled=active()||animating;
  renderHistory();
};
const render = () => {
  if(!animating)drawBoard();
  drawCollection();renderProfile();renderCalendar();renderGameInfo();syncNavigation();
  $('#coins').textContent=state.coins;
  $('#shards').textContent=state.shards;
  $('#count').textContent=`${state.owned.length}/${ITEMS.length}`;
  $('#open-chest').disabled=active()||state.coins<100;
  $('#pity').textContent=`Гарантированный предмет через ${10-state.pity}`;
  $('#pity-progress').value=state.pity;
};
const stopBot = () => {taskId++;worker?.terminate();worker=null;busy=false;pendingBotMove=null;};
const botFailure = () => {
  stopBot();renderGameInfo();
  showModal('<h2>Компьютер не смог ответить</h2><p>Партия сохранена. Повторите расчёт. Если движок только обновился, перезагрузите приложение для его активации.</p><button class="quiet" data-retry-bot>Повторить расчёт</button>');
};
const applyMove = async move => {
  if(!active()||animating)return;
  const followLive=reviewCursor===null;
  const before=snapshotBoard($('#board'));
  let played;
  try {played=game.move(move);} catch {toast('Этот ход недоступен.');return;}
  if(!persist(state)){game.undo();drawBoard();return;}
  selected=null;promotion=null;animating=followLive;
  drawBoard();renderGameInfo();
  try {if(followLive)await animateMove($('#board'),played,before);} finally {animating=false;}
  settle();render();if(!pendingResult&&queuedCursor!==undefined){const cursor=queuedCursor;queuedCursor=undefined;void showHistory(cursor);}else requestBot();
};
const requestBot = () => {
  if(!active()||state.game.mode!=='bot'||game.turn()===state.game.playerColor||locked())return;
  busy=true;renderGameInfo();
  const id=++taskId;
  try {
    worker??=state.game.engineProfile?.id==='stockfish19-v1'?createStockfish19Client():state.game.engineProfile?createStockfishClient():new Worker('./bot-worker.js?v=14',{type:'module'});
    worker.onmessage=({data})=>{
      if(data.id!==taskId)return;
      if(data.error||!data.move){botFailure();return;}
      busy=false;
      if(animating){pendingBotMove=data.move;return;}
      void applyMove(data.move);
    };
    worker.onerror=()=>{if(id===taskId)botFailure();};
    worker.postMessage({id,fen:game.fen(),pgn:game.pgn(),engineProfile:state.game.engineProfile,difficulty:state.game.difficulty,rating:state.game.rating?.opponent});
  } catch {botFailure();}
};
const showPromotion = (from,to) => {
  promotion={from,to};
  showModal(`<h2>Превращение пешки</h2><p>Выберите фигуру</p><div class="promotion">${['q','r','b','n'].map(type=>`<button data-promote="${type}" aria-label="${PIECE_NAMES[type]}">${pieceSVG(type,game.turn(),itemById(state.game.equipped.pieces[type]).style)}</button>`).join('')}</div>`);
  $('#close-modal').hidden=true;
};
$('#board').addEventListener('click',event=>{
  const square=event.target.closest('[data-square]')?.dataset.square;
  if(!square||displayMatch||!canPlayPosition(state,game,reviewCursor)||locked()||ended()||(state.game.mode==='bot'&&game.turn()!==state.game.playerColor))return;
  const piece=game.get(square);
  if(selected){
    const moves=game.moves({square:selected,verbose:true}).filter(move=>move.to===square);
    if(moves.length){
      if(moves.some(move=>move.promotion))showPromotion(selected,square);
      else void applyMove({from:selected,to:square});
      return;
    }
  }
  selected=piece?.color===game.turn()?(selected===square?null:square):null;
  drawBoard();
});
$('#board').addEventListener('keydown',event=>{
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];
  if(!delta)return;
  const cells=[...$('#board').querySelectorAll('[data-square]')];
  const index=cells.indexOf(event.target);
  if(index<0)return;
  event.preventDefault();cells[Math.max(0,Math.min(63,index+delta))].focus();
});
const changeTab = tab => {
  stopReplay();
  if(animating||pendingResult)return;
  const target=navigationTarget(state,game,tab);
  if(displayMatch?.kind==='archive'&&target!=='play'){displayMatch=null;reviewCursor=null;render();}
  if(target!==tab&&active())toast('Другие экраны доступны после завершения партии.');
  currentScreen=target;
  window.history.replaceState(null,'','#'+target);
  syncNavigation();if(target==='archive')renderArchive();if(target==='calendar')renderCalendar();
};
const showHistory = async (cursor,automatic=false) => {
  if(!automatic)stopReplay();
  if(animating){queuedCursor=cursor;renderHistory();return;}
  const total=viewedGame().history().length, from=reviewCursor??total;
  const target=cursor===null||cursor>=total?total:Math.max(0,cursor);
  if(from===target)return;
  const before=snapshotBoard($('#board')), steps=historyMoves(viewedGame(),from,target);
  reviewCursor=target===total?null:target;selected=null;animating=true;
  drawBoard();renderGameInfo();
  try {await animateTransition($('#board'),steps,before);} finally {animating=false;}
  render();
  if(queuedCursor!==undefined){const next=queuedCursor;queuedCursor=undefined;await showHistory(next);return;}
  if(pendingBotMove){const move=pendingBotMove;pendingBotMove=null;void applyMove(move);}
  else requestBot();
};
const stopReplay = () => {
  replayRunning=false;clearTimeout(replayTimer);replayTimer=null;
  if($('#replay-start'))renderHistory();
};
const replayStep = async () => {
  if(!replayRunning||displayMatch?.kind!=='archive'||currentScreen!=='play')return;
  const total=viewedGame().history().length;
  await showHistory(historyCursor(queuedCursor===undefined?reviewCursor:queuedCursor,1,total),true);
  if(!replayRunning)return;
  if(reviewCursor===null){stopReplay();return;}
  replayTimer=setTimeout(()=>void replayStep(),800);
};
$('#replay-start').onclick=async()=>{
  if(replayRunning||displayMatch?.kind!=='archive')return;
  if(reviewCursor===null)await showHistory(0);
  replayRunning=true;renderHistory();replayTimer=setTimeout(()=>void replayStep(),500);
};
$('#replay-pause').onclick=stopReplay;
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopReplay();});
$('#history-back').onclick=()=>showHistory(historyCursor(queuedCursor===undefined?reviewCursor:queuedCursor,-1,viewedGame().history().length));
$('#history-forward').onclick=()=>showHistory(historyCursor(queuedCursor===undefined?reviewCursor:queuedCursor,1,viewedGame().history().length));
$('#history-live').onclick=()=>showHistory(null);
$('#moves').addEventListener('click',event=>{
  const value=event.target.closest('[data-history-ply]')?.dataset.historyPly;
  if(value!==undefined)showHistory(Number(value));
});
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>changeTab(button.dataset.tab));
document.querySelectorAll('[data-go]').forEach(button=>button.onclick=()=>changeTab(button.dataset.go));
$('.brand').onclick=event=>{event.preventDefault();changeTab('play');};
window.addEventListener('hashchange',()=>changeTab(location.hash.slice(1)));
window.addEventListener('popstate',()=>changeTab(location.hash.slice(1)));
const useItem = id => {
  const item=itemById(id);
  if(active()||!item||!state.owned.includes(id)||animating)return;
  const equipped=structuredClone(state.equipped);
  if(item.kind==='board')equipped.board=id;else equipped.pieces[item.type]=id;
  if(persist({...state,equipped})){render();toast('Предмет уже на доске.');}
};
const confirmCraft = id => {
  if(active())return;
  const item=itemById(id);
  if(!item||state.owned.includes(id)||state.shards<craftCost(item))return;
  showModal(`<p class="eyebrow">МАСТЕРСКАЯ</p><div class="result-art">${itemPreview(item)}</div><h2>${item.name}</h2><p>Создать выбранный предмет за ${craftCost(item)} осколков? Случайности нет.</p><button class="primary" data-confirm-craft="${id}">Создать за ${craftCost(item)} ✧</button>`);
};
const showSaveSet = () => {
  if(active())return;
  if(state.sets.length>=12){toast('Можно сохранить до 12 наборов. Удалите ненужный, чтобы добавить новый.');return;}
  showModal('<h2>Сохранить свой набор</h2><p>Сохраним шесть выбранных скинов и текущую доску.</p><form id="save-set-form"><label for="set-name">Название</label><input id="set-name" name="name" maxlength="32" required placeholder="Например, Полярная ночь" autocomplete="off"><button class="primary" type="submit">Сохранить набор</button></form>');
  $('#set-name').focus();
};
$('#collection-content').addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(active()||!button||button.disabled)return;
  if(button.dataset.openItem){
    const item=itemById(button.dataset.openItem);
    if(!item)return;
    pieceType=item.kind==='board'?'board':item.type;
    collectionView='items';ownedOnly=false;drawCollection();
    const card=document.getElementById(`collection-item-${item.id}`);
    card?.classList.add('focused-item');
    card?.focus({preventScroll:true});
    card?.scrollIntoView({block:'nearest'});
    return;
  }
  if(button.dataset.pieceType){pieceType=button.dataset.pieceType;collectionView='items';drawCollection();}
  if(button.hasAttribute('data-owned-only')){ownedOnly=!ownedOnly;drawCollection();}
  if(button.dataset.collectionView){collectionView=button.dataset.collectionView;drawCollection();}
  if(animating)return;
  if(button.dataset.equip)useItem(button.dataset.equip);
  if(button.dataset.craft)confirmCraft(button.dataset.craft);
  if(button.hasAttribute('data-save-set'))showSaveSet();
  if(button.dataset.preset&&canEquipPreset(state,button.dataset.preset)){
    if(persist({...state,equipped:presetEquipment(button.dataset.preset)})){render();toast('Коллекция выбрана.');}
  }
  if(button.dataset.loadSet){
    const set=state.sets.find(set=>set.id===button.dataset.loadSet);
    if(set&&persist({...state,equipped:{pieces:{...set.pieces},board:set.board}})){render();toast('Ваш набор выбран.');}
  }
  if(button.dataset.deleteSet&&confirm('Удалить сохранённый набор? Все предметы останутся в коллекции.')){
    if(persist({...state,sets:state.sets.filter(set=>set.id!==button.dataset.deleteSet)}))drawCollection();
  }
});
$('#match-archive').addEventListener('click',event=>{
  if(active()||animating||pendingResult)return;
  const id=event.target.closest('[data-archive]')?.dataset.archive;
  const entry=state.archive.find(entry=>entry.id===id);if(!entry)return;
  const replay=new Chess();try{replay.loadPgn(entry.pgn);}catch{toast('Не удалось прочитать запись партии.');return;}
  displayMatch={game:replay,kind:'archive',title:entry.result,config:{...entry,started:true,rating:{before:entry.playerRating,opponent:entry.opponentRating}}};
  reviewCursor=replay.history().length?0:null;selected=null;changeTab('play');render();
});
$('#archive-return').onclick=()=>changeTab('archive');
$('#modal-content').addEventListener('submit',event=>{
  if(active()||event.target.id!=='save-set-form')return;
  event.preventDefault();
  const name=$('#set-name').value.trim();
  if(!name||state.sets.length>=12)return;
  const set={id:crypto.randomUUID(),name:name.slice(0,32),...structuredClone(state.equipped)};
  if(persist({...state,sets:[...state.sets,set]})){$('#modal').close();drawCollection();toast('Набор сохранён.');}
});
$('#modal-content').addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button)return;
  if(button.dataset.promote&&promotion){const move={...promotion,promotion:button.dataset.promote};$('#modal').close();void applyMove(move);}
  if(button.dataset.confirmCraft&&!active()){
    const next=craftItem(state,button.dataset.confirmCraft);
    if(next&&persist(next)){$('#modal').close();render();toast('Предмет создан и добавлен в коллекцию.');}
  }
  if(button.dataset.useReward){useItem(button.dataset.useReward);$('#modal').close();}
  if(button.hasAttribute('data-retry-bot')){$('#modal').close();requestBot();}
});
$('#modal').addEventListener('cancel',()=>{promotion=null;selected=null;if(!animating)drawBoard();});
$('#modal').addEventListener('close',()=>{
  if(pendingResult&&!$('#modal').open){pendingResult=false;displayMatch=null;reviewCursor=null;render();
    const event=pendingActivity;pendingActivity=null;
    if(event)showModal(`<div class="day-closed-mark" aria-hidden="true">✓</div><h2>День закрыт</h2><p>${event.streak===1?'Началась новая серия.':`Вы играете ${dayLabel(event.streak)} подряд.`}</p><strong class="streak-value">${dayLabel(event.streak)}</strong>`);
  }
});
$('#close-modal').onclick=()=>$('#modal').close();
$('#open-chest').onclick=()=>{
  if(active())return;
  const opened=openChest(state);
  if(!opened||!persist(opened.state))return;
  render();
  const {item,duplicate,shards}=opened.result;
  const title=!item?'Осколки для мастерской':duplicate?'Предмет уже в коллекции':'Новый предмет!';
  const artwork=item?itemPreview(item):'<div class="shard-reveal">✧</div>';
  const copy=!item?'В этом сундуке нет предмета. Осколки можно потратить на конкретную фигурку или доску.':duplicate?'Повтор превратился в осколки. Сохранённый предмет остаётся у вас.':'Предмет добавлен в коллекцию. Используйте его отдельно или включите в свой набор.';
  showModal(`<p class="eyebrow">${title}</p><div class="result-art reveal">${artwork}</div>${item?`<span class="rarity ${item.rarity}">${rarityNames[item.rarity]}</span><h2>${item.name}</h2>`:''}${shards?`<h2>+${shards} осколков</h2>`:''}<p>${copy}</p>${item&&!duplicate?`<button class="quiet" data-use-reward="${item.id}">Использовать</button>`:''}`);
};
$('#start-game').onclick=()=>{
  if(active()||animating||pendingResult||displayMatch)return;
  const previousPGN=game.pgn();
  stopBot();game.reset();
  if(!persist({...state,game:createStartedGame(state)})){
    game.loadPgn(previousPGN);render();return;
  }
  selected=null;promotion=null;reviewCursor=null;
  currentScreen='play';
  changeTab('play');render();requestBot();
};
$('#resign').onclick=()=>{
  if(!active()||animating||!confirm('Сдаться и завершить текущую партию? Просмотр истории не меняет её результат.'))return;
  stopBot();
  if(persist({...state,game:{...state.game,resigned:true}})){settle();render();}
  else requestBot();
};
$('#install').onclick=async()=>{
  if(active())return;
  if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}
  else showModal('<h2>Установить GachaChess</h2><p>На iPhone: откройте сайт в Safari → «Поделиться» → «На экран Домой».</p><p>На Android и компьютере: в меню браузера выберите «Установить приложение».</p><p>После загрузки офлайн-кэша можно играть без интернета.</p>');
};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{$('#install').hidden=true;toast('Приложение установлено');});
if(matchMedia('(display-mode: standalone)').matches)$('#install').hidden=true;
window.addEventListener('storage',event=>{if(event.key===KEY){location.reload();}});
const showUpdate = registration => {
  if(!registration.waiting)return;
  $('#update-app').hidden=false;
  $('#update-app').onclick=()=>{
    if(active()){toast('Обновление можно применить после завершения партии.');return;}
    registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  };
};
if('serviceWorker' in navigator){
  let refreshing=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!refreshing){refreshing=true;location.reload();}});
  navigator.serviceWorker.register('./sw.js').then(registration=>{
    showUpdate(registration);
    registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',()=>showUpdate(registration)));
  }).catch(()=>toast('Офлайн-режим недоступен. Игра работает при подключении к сети.'));
}
$('.brand>span:first-child').innerHTML=pieceSVG('n','w');
$('#chest-art').innerHTML=pieceSVG('q','w','gold');
$('#status').setAttribute('aria-live','polite');
currentScreen=navigationTarget(state,game,location.hash.slice(1)||'play');
changeTab(currentScreen);render();settle(false);render();requestBot();
if(storageError)toast('Сохранение не удалось прочитать. Старые данные оставлены в браузере.');
