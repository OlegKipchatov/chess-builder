import {exportPgnDialog,cancelledDialog,matchResultDialog,botFailureDialog,promotionDialog,craftDialog,saveSetDialog,activityDialog,chestRewardDialog,resignDialog,installHelpDialog} from './ui/dialog-content.js?v=31';
import {mountAppShell} from './ui/shell.js?v=31';
import {statCard} from './ui/primitives.js?v=31';
import {createDialog,createToast} from './ui/dialog.js?v=31';
import {renderArchiveList} from './ui/components/archive-list.js?v=31';
import {moveList} from './ui/components/move-list.js?v=31';
import {playStyleName,randomPlayStyle} from './play-style-config.js?v=31';
import {exportPgn,sharePgn,downloadPgn} from './pgn-export.js?v=31';
import {closeActivityDay, calendarHTML} from './activity.js?v=31';
import {createBotClient} from './bot-client.js?v=31';
import {completedMatch, materialBalance, canAbortFailedMatch, abortFailedMatch} from './archive.js?v=31';
import {signedDelta} from './rating.js?v=31';
import {Chess} from './chess.js?v=31';
import {TYPES, ITEMS, PIECE_NAMES, rarityNames, itemById, craftCost} from './catalog.js?v=31';
import {openChest, craftItem} from './economy.js?v=31';
import {KEY, loadState, initialState, newGame} from './state.js?v=31';
import {pieceSVG, itemPreview} from './pieces.js?v=31';
import {renderBoard, snapshotBoard, animateMove, animateTransition, historyMoves} from './board.js?v=31';
import {renderCollection, escapeHTML, presetEquipment, canEquipPreset} from './collection.js?v=31';
import {isMatchActive, navigationTarget, createStartedGame, positionAt, historyCursor, canPlayPosition} from './session.js?v=31';
mountAppShell(document.querySelector('#app'));
const $ = selector => document.querySelector(selector);
let storageError = false;
let state;
try {state=loadState(localStorage);} catch {state=initialState();storageError=true;}
const game = new Chess();
try {if(state.game.pgn)game.loadPgn(state.game.pgn);} catch {game.reset();state.game=newGame();storageError=true;}
let selected=null, promotion=null, busy=false, animating=false, worker=null, taskId=0, installPrompt=null;
let collectionView='sets', pieceType='k', ownedOnly=false, currentScreen='play', reviewCursor=null, pendingBotMove=null;
let queuedCursor=undefined;
let lastBotError=null;
const exportViewedMatch = () => {
 const config=viewedConfig(),error=config.engineFailure||(!displayMatch&&lastBotError?.fen===game.fen()?lastBotError:null);
 const pgn=exportPgn(viewedGame(),config,error);
 showModal(exportPgnDialog(pgn));
};
let pendingActivity=null;
let displayMatch=null, pendingResult=false, replayRunning=false, replayTimer=null;
const viewedGame = () => displayMatch?.game||game;
const viewedConfig = () => displayMatch?.config||(state.game.started?state.game:state.settings);
const toast = createToast($('#toast'));
const persist = (next,reset=false) => {
  const snapshot={...next, game:{...next.game,pgn:reset?'':game.pgn()}};
  try {localStorage.setItem(KEY,JSON.stringify(snapshot));state=snapshot;return true;}
  catch {toast('Не удалось сохранить прогресс. Освободите место или разрешите хранение данных.');return false;}
};
const showModal = createDialog($('#modal'),$('#modal-content'),$('#close-modal'));
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
  const {entry,reward,rewardBreakdown}=result;
  stopBot();game.reset();reviewCursor=null;queuedCursor=undefined;selected=null;
  if(!wasSettled){displayMatch={game:finishedGame,config:finishedConfig,kind:'result'};pendingResult=true;}
  if(result.cancelled){showModal(cancelledDialog(),{closeLabel:'Продолжить',closeVariant:'primary'});return;}
  if(!wasSettled)showModal(matchResultDialog(title,reward,entry,rewardBreakdown),{closeLabel:'Продолжить',closeVariant:'primary'});
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
const renderArchive = () => renderArchiveList($('#match-archive'),state.archive);
const renderStatistics = () => {
  const entries=state.archive.filter(entry=>entry.mode==='bot'&&entry.counted!==false), wins=entries.filter(entry=>entry.result==='Победа').length;
  const draws=entries.filter(entry=>entry.result==='Ничья').length, losses=entries.length-wins-draws;
  const percent=entries.length?Math.round(wins/entries.length*100)+'%':'—';
  const card=statCard;
  $('#play-stats').innerHTML=card(entries.length,'Сыграно партий')+card(wins,'Побед');
  $('#detailed-statistics').innerHTML=card(entries.length,'Партий с ИИ')+card(wins,'Побед')+card(draws,'Ничьих')+card(losses,'Поражений')+card(percent,'Процент побед')+card(state.owned.length,'Предметов')+card(state.opened,'Сундуков');
};
$('#match-archive').addEventListener('scroll',renderArchive,{passive:true});
window.addEventListener('resize',()=>{if(currentScreen==='archive')renderArchive();});
const renderCalendar = () => {$('#activity-calendar').innerHTML=calendarHTML(state.activity);};
setInterval(()=>{if(currentScreen==='calendar')renderCalendar();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentScreen==='calendar')renderCalendar();});
const renderProfile = () => {

  renderArchive();renderStatistics();
  $('#profile-played').textContent=state.played;
  $('#profile-owned').textContent=state.owned.length;
  $('#profile-opened').textContent=state.opened;
  $('#profile-rewards').textContent='Завершение +10 · ходы до +20 · победа +10 / ничья +5';
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
  $('#moves').innerHTML=moveList(moves,cursor);
  if(reviewCursor===null)$('#moves').scrollTop=$('#moves').scrollHeight;
};
const renderGameInfo = () => {
  const config=viewedConfig(),hasBoard=!!displayMatch||state.game.started;
  const color=config.playerColor||'w';
  const points=materialBalance(positionAt(viewedGame(),reviewCursor),color);
  const pointsText=`${signedDelta(points)} очк.`;
  for(const node of [$('#match-points'),$('#match-settings')])node.dataset.balance=points>0?'positive':points<0?'negative':'zero';
  $('#player-name').textContent=config.mode==='bot'?'Вы':'Игрок 1';
  $('#opponent-avatar').innerHTML=pieceSVG('n',color==='w'?'b':'w');
  $('#player-avatar').innerHTML=pieceSVG('p',color);
  $('#opponent').textContent=config.mode==='bot'?`ИИ · ${playStyleName(config.engineProfile?.profile)}`:'Игрок 2';
  $('#match-points').textContent=pointsText;
  $('#match-surface').hidden=!hasBoard;
  $('#archive-return').hidden=displayMatch?.kind!=='archive';
  $('#archive-return').disabled=animating;
  $('#play-stats').hidden=hasBoard||!state.archive.some(entry=>entry.mode==='bot'&&entry.counted!==false);
  $('#status').textContent=displayMatch?(displayMatch.title||'Партия завершена'):reviewCursor!==null?'Просмотр истории':state.game.started?statusText():'Готовы начать?';
  $('#resign').disabled=!active();
  $('#resign').hidden=!active();
  $('#abort-failed').hidden=!canAbortFailedMatch(state,game)||!!displayMatch;
  $('#abort-failed').disabled=animating;
  $('#retry-failed').hidden=$('#abort-failed').hidden;
  $('#retry-failed').disabled=locked();
  $('#hint').textContent=displayMatch?'Просматривайте партию стрелками.':reviewCursor!==null?'Ходы не отменяются. Вернитесь к текущей позиции, чтобы продолжить.':active()?'Выберите фигуру, чтобы увидеть доступные ходы.':state.game.started?'Можно просмотреть всю партию или вернуться в профиль.':'Начните новую партию с ИИ.';
  $('#game-ready').hidden=hasBoard;
  $('#match-title').textContent=displayMatch?'История партии':active()?'В игре':state.game.started?'Итоги партии':'Игра';
  $('#match-settings').textContent='';
  $('#start-game').textContent='Сыграем?';
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
const botFailure = (error) => {
  lastBotError={message:error?.message||String(error||'Unknown engine error'),fen:game.fen()};
  stopBot();
  const failed={...state,game:{...state.game,engineFailure:lastBotError}};if(!persist(failed))state=failed;
  renderGameInfo();
  showModal(botFailureDialog());
};
const applyMove = async move => {
  if(!active()||animating)return;
  const followLive=reviewCursor===null;
  const before=snapshotBoard($('#board'));
  let played;
  try {played=game.move(move);} catch {toast('Этот ход недоступен.');return;}
  if(!persist({...state,game:{...state.game,engineFailure:null}})){game.undo();drawBoard();return;}
  lastBotError=null;
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
    worker??=createBotClient(state.game.engineProfile);
    worker.onmessage=({data})=>{
      if(data.id!==taskId)return;
      if(data.error||!data.move){botFailure(data.error||'Missing engine move');return;}
      busy=false;
      if(animating){pendingBotMove=data.move;return;}
      void applyMove(data.move);
    };
    worker.onerror=error=>{if(id===taskId)botFailure(error);};
    worker.postMessage({id,fen:game.fen(),pgn:game.pgn(),engineProfile:state.game.engineProfile,difficulty:state.game.difficulty,rating:state.game.rating?.opponent});
  } catch(error) {botFailure(error);}
};
const showPromotion = (from,to) => {
  promotion={from,to};
  showModal(promotionDialog(game.turn(),state.game.equipped),{hideClose:true});
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
  showModal(craftDialog(item,id),{closeLabel:'Отмена'});
};
const showSaveSet = () => {
  if(active())return;
  if(state.sets.length>=12){toast('Можно сохранить до 12 наборов. Удалите ненужный, чтобы добавить новый.');return;}
  showModal(saveSetDialog(),{closeLabel:'Отмена'});
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
    if(card){
      const top=document.querySelector('header').getBoundingClientRect().bottom;
      const dock=$('#app-nav');
      const bottom=dock.hidden?window.innerHeight:Math.min(window.innerHeight,dock.getBoundingClientRect().top);
      const rect=card.getBoundingClientRect();
      window.scrollTo({top:window.scrollY+rect.top+rect.height/2-(top+bottom)/2,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }
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
$('#export-pgn').onclick=exportViewedMatch;
$('#modal-content').addEventListener('submit',event=>{
  if(active()||event.target.id!=='save-set-form')return;
  event.preventDefault();
  const name=$('#set-name').value.trim();
  if(!name||state.sets.length>=12)return;
  const set={id:crypto.randomUUID(),name:name.slice(0,32),...structuredClone(state.equipped)};
  if(persist({...state,sets:[...state.sets,set]})){showModal.close();drawCollection();toast('Набор сохранён.');}
});
$('#modal-content').addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if(!button)return;
  if(button.dataset.promote&&promotion){const move={...promotion,promotion:button.dataset.promote};await showModal.close();void applyMove(move);}
  if(button.dataset.confirmCraft&&!active()){
    const next=craftItem(state,button.dataset.confirmCraft);
    if(next&&persist(next)){showModal.close();render();toast('Предмет создан и добавлен в коллекцию.');}
  }
  if(button.dataset.useReward){useItem(button.dataset.useReward);showModal.close();}
  if(button.hasAttribute('data-confirm-resign'))confirmResignation();
  if(button.hasAttribute('data-abort-failed'))abortAfterFailure();
  if(button.hasAttribute('data-download-pgn'))downloadPgn($('#pgn-text').value);
  if(button.hasAttribute('data-share-pgn'))void sharePgn($('#pgn-text').value).catch(()=>toast('Не удалось передать PGN. Используйте скачивание или копирование.'));
  if(button.hasAttribute('data-copy-pgn')){const field=$('#pgn-text');field.focus();field.select();if(navigator.clipboard?.writeText)navigator.clipboard.writeText(field.value).then(()=>toast('PGN скопирован')).catch(()=>toast('Текст выделен. Выберите «Копировать».'));else toast('Текст выделен. Выберите «Копировать».');}
  if(button.hasAttribute('data-export-pgn'))void exportViewedMatch();
  if(button.hasAttribute('data-retry-bot')){showModal.close();requestBot();}
});
$('#modal').addEventListener('cancel',()=>{if(!promotion){selected=null;if(!animating)drawBoard();}});
$('#modal').addEventListener('dialogdismiss',()=>{
  if(pendingResult&&!$('#modal').open){pendingResult=false;displayMatch=null;reviewCursor=null;render();
    const event=pendingActivity;pendingActivity=null;
    if(event)showModal(activityDialog(event),{closeLabel:'Продолжить',closeVariant:'primary'});
  }
});
$('#close-modal').onclick=()=>showModal.close();
$('#open-chest').onclick=()=>{
  if(active())return;
  const opened=openChest(state);
  if(!opened||!persist(opened.state))return;
  render();
  const {item,duplicate,shards}=opened.result;
  const title=!item?'Осколки для мастерской':duplicate?'Предмет уже в коллекции':'Новый предмет!';
  const artwork=item?itemPreview(item):'<div class="shard-reveal">✧</div>';
  const copy=!item?'В этом сундуке нет предмета. Осколки можно потратить на конкретную фигурку или доску.':duplicate?'Повтор превратился в осколки. Сохранённый предмет остаётся у вас.':'Предмет добавлен в коллекцию. Используйте его отдельно или включите в свой набор.';
  showModal(chestRewardDialog(title,artwork,item,shards,copy,duplicate));
};
$('#start-game').onclick=()=>{
  if(active()||animating||pendingResult||displayMatch)return;
  const previousPGN=game.pgn();
  stopBot();game.reset();
  if(!persist({...state,game:createStartedGame(state,Math.random,{profile:randomPlayStyle()})})){
    game.loadPgn(previousPGN);render();return;
  }
  selected=null;promotion=null;reviewCursor=null;
  currentScreen='play';
  changeTab('play');render();
  const surface=$('#match-surface');
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    surface.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
  }
  requestBot();
};
const abortAfterFailure = () => {
  const next=abortFailedMatch(state,game,{id:crypto.randomUUID(),finishedAt:new Date().toISOString()});
  if(!next)return;
  stopBot();if(!persist(next,true)){renderGameInfo();return;}
  game.reset();displayMatch=null;pendingResult=false;pendingActivity=null;reviewCursor=null;queuedCursor=undefined;selected=null;promotion=null;lastBotError=null;
  showModal.close();render();toast('Партия сохранена в истории. Прогресс не изменился.');
};
$('#abort-failed').onclick=abortAfterFailure;
$('#retry-failed').onclick=requestBot;
const confirmResignation = () => {
  if(!active())return;
  stopBot();
  if(persist({...state,game:{...state.game,resigned:true}})){settle();render();}
  else {showModal.close();requestBot();}
};
$('#resign').onclick=()=>{
  if(!active())return;
  showModal(resignDialog(),{closeLabel:'Продолжить игру'});
};
$('#install').onclick=async()=>{
  if(active())return;
  if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}
  else showModal(installHelpDialog());
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
