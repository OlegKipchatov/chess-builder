import {awardAutochess,autoRewardCoins,autoSeriesCoins} from './autochess-rewards.js?v=100';
import {autochessEntry,autochessFAQ,mountAutochess} from './ui/pages/autochess.js?v=100';
import {huntEntry,huntFAQ,mountHunt} from './ui/pages/hunt.js?v=100';
import {awardHunt} from './hunt.js?v=100';
import {analyzeGame} from './analysis/analysis-service.js?v=100';
import {eligibleEntry,isCompatible,attachAnalysis} from './analysis/analysis-storage.js?v=100';
import {mountAnalysis,showAnalysisProgress} from './ui/pages/analysis.js?v=100';
import {analyzeReward} from './economy-analysis.js?v=100';
import {applyQualityReward} from './reward-quality.js?v=100';
import {motionDuration, motionEasing} from './ui/motion.js?v=100';
import {exportPgnDialog,cancelledDialog,matchResultDialog,botFailureDialog,promotionDialog,craftDialog,saveSetDialog,activityDialog,chestRewardDialog,resignDialog,installHelpDialog,deleteSetDialog} from './ui/dialog-content.js?v=100';
import {mountAppShell} from './ui/shell.js?v=100';
import {statCard,plural,pageHeader,iconButton,backIcon} from './ui/primitives.js?v=100';
import {createDialog,createToast} from './ui/dialog.js?v=100';
import {renderArchiveList} from './ui/components/archive-list.js?v=100';
import {moveList} from './ui/components/move-list.js?v=100';
import {syncHistorySlider,bindHistorySlider} from './ui/components/move-navigation.js?v=100';
import {playStyleName,randomPlayStyle} from './play-style-config.js?v=100';
import {importPgn,MAX_PGN_BYTES} from './pgn-import.js?v=100';
import {importPgnDialog} from './ui/dialog-content.js?v=100';
import {exportPgn,sharePgn,downloadPgn} from './pgn-export.js?v=100';
import {closeActivityDay, calendarHTML} from './activity.js?v=100';
import {createBotClient} from './bot-client.js?v=100';
import {completedMatch, materialBalance, canAbortFailedMatch, abortFailedMatch,matchEndReason} from './archive.js?v=100';
import {signedDelta} from './rating.js?v=100';
import {Chess} from './chess.js?v=100';
import {TYPES, ITEMS, PIECE_NAMES, rarityNames, itemById, craftCost} from './catalog.js?v=100';
import {openChest, craftItem} from './economy.js?v=100';
import {KEY, loadState, initialState, newGame, createRecordId} from './state.js?v=100';
import {pieceSVG, itemPreview} from './pieces.js?v=100';
import {renderBoard, snapshotBoard, animateMove, animateTransition, historyMoves, showCaptureMaterial, clearCaptureMaterial} from './board.js?v=100';
import {renderCollection, escapeHTML, presetEquipment, canEquipPreset} from './collection.js?v=100';
import {isMatchActive, navigationTarget, createStartedGame, positionAt, historyCursor, boardAvailability} from './session.js?v=100';
mountAppShell(document.querySelector('#app'));
const $ = selector => document.querySelector(selector);
// Sticky catalogue navigation follows the real header height, including text scaling.
const headerResizeObserver = new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty('--app-header-height',`${entry.target.getBoundingClientRect().height}px`);
});
headerResizeObserver.observe(document.querySelector('header'));
// Reserve the actual navigation height, including text enlargement. Hidden
// navigation must not erase the last measurement before it becomes visible.
const navigationResizeObserver = new ResizeObserver(([entry]) => {
  const height=entry.target.getBoundingClientRect().height;
  if(height>0)document.documentElement.style.setProperty('--nav-height',`${height}px`);
});
navigationResizeObserver.observe(document.querySelector('#app-nav'));
let storageError = false;
let state;
try {state=loadState(localStorage);} catch {state=initialState();storageError=true;}
const game = new Chess();
try {if(state.game.pgn)game.loadPgn(state.game.pgn);} catch {game.reset();state.game=newGame();storageError=true;}
let selected=null, promotion=null, busy=false, animating=false, worker=null, taskId=0, installPrompt=null;
let collectionView='sets', pieceType='k', ownedOnly=false, currentScreen='play', reviewCursor=null, pendingBotMove=null;
let queuedCursor=undefined;
let queuedHistoryInstant=false;
let archiveReturnContext=null;
let analysisController=null,disposeAnalysis=null,analysisGeneration=0,analysisEntryId=null,analysisLoadingTimer=null,analysisComplete=false;
const stopAnalysis = () => {
 clearTimeout(analysisLoadingTimer);analysisComplete=false;$('#archive-analysis').disabled=false;
 analysisGeneration++;analysisController?.abort();analysisController=null;disposeAnalysis?.();disposeAnalysis=null;
 $('#match-surface').classList.remove('analysis-active');delete $('#match-surface').dataset.mode;
 $('#analysis-progress').hidden=true;$('#analysis-board-tools').hidden=true;$('#analysis-insight').hidden=true;$('#analysis-summary').hidden=true;
 $('#analysis-game-controls').hidden=false;$('#analysis-retry').hidden=true;
 $('#board').closest('.board-area').style.minHeight='';
 restoreHistoryControls();
};
const openAnalysis = async (id,force=false) => {
 const entry=state.archive.find(row=>row.id===id);if(!eligibleEntry(entry)||active()||pendingResult)return;
 stopReplay();stopAnalysis();const generation=analysisGeneration;analysisEntryId=id;
 render();
 $('#archive-analysis').hidden=false;$('#archive-analysis').disabled=true;$('#analysis-retry').hidden=true;
 analysisLoadingTimer=setTimeout(()=>{if(generation!==analysisGeneration)return;$('#archive-analysis').hidden=true;$('#analysis-progress').hidden=false;},motionDuration.enter);
 analysisController=new AbortController();
 try {
  let result=entry.analysis;
  if(force||!isCompatible(result,entry)){
   result=await analyzeGame(entry,{signal:analysisController.signal,onProgress:progress=>{if(generation===analysisGeneration)showAnalysisProgress(progress);}});
   if(generation!==analysisGeneration)return;
   // Persistence merges into the latest state, including any concurrent economy reward.
   persist(attachAnalysis(state,id,result));
  }
  if(generation!==analysisGeneration)return;
  clearTimeout(analysisLoadingTimer);analysisController=null;analysisComplete=result.status==='complete';$('#analysis-progress').hidden=true;$('#archive-analysis').hidden=true;$('#analysis-retry').hidden=analysisComplete;$('#archive-review-actions').hidden=analysisComplete;
  $('#match-surface').classList.add('analysis-active');
  disposeAnalysis=mountAnalysis({analysis:result,entry,equipped:state.equipped,initialPly:reviewCursor??viewedGame().history().length,onPly:ply=>{reviewCursor=ply;if(disposeAnalysis)renderGameInfo();}});
 }catch(error){
  if(generation!==analysisGeneration||error.name==='AbortError')return;
  clearTimeout(analysisLoadingTimer);analysisController=null;analysisComplete=false;$('#archive-review-actions').hidden=false;$('#analysis-progress').hidden=true;$('#archive-analysis').hidden=true;$('#analysis-retry').hidden=false;toast('Не удалось разобрать партию. Попробуйте ещё раз.',{error:true});
 }
};
$('#analysis-cancel').onclick=()=>{stopAnalysis();render();};
$('#analysis-retry').onclick=()=>void openAnalysis(analysisEntryId,true);
$('#archive-analysis').onclick=()=>void openAnalysis(displayMatch?.config.id);

let lastBotError=null;
const exportViewedMatch = () => {
 const config=viewedConfig(),error=config.engineFailure||(!displayMatch&&lastBotError?.fen===game.fen()?lastBotError:null);
 const pgn=config.imported?viewedGame().pgn():exportPgn(viewedGame(),config,error);
 showModal(exportPgnDialog(pgn));
};
let pendingActivity=null;
let displayMatch=null, pendingResult=false, replayRunning=false, replayTimer=null,postGameAnalysisId=null,archiveReturnTarget='archive';
const viewedGame = () => displayMatch?.game||game;
const viewedConfig = () => displayMatch?.config||(state.game.started?state.game:state.settings);
const toast = createToast($('#toast'));
const persist = (next,reset=false) => {
  const snapshot={...next, game:{...next.game,pgn:reset?'':game.pgn()}};
  try {localStorage.setItem(KEY,JSON.stringify(snapshot));state=snapshot;return true;}
  catch {toast('Не удалось сохранить прогресс. Проверьте свободное место и разрешение на хранение данных.',{error:true});return false;}
};
const showModal = createDialog($('#modal'),$('#modal-content'),$('#close-modal'));
let huntController=null,autoController=null;
$('#play').insertAdjacentHTML('afterend',`<section id="minigames" class="tab" data-page-kind="root" hidden>${pageHeader({title:'Мини-игры',titleId:'minigames-title',startContent:iconButton({id:'hunt-exit',label:'Выйти из охоты',icon:backIcon})})}<div class="page-content">${huntEntry()}${autochessEntry()}<div id="hunt-root" hidden></div><div id="autochess-root" hidden></div></div></section>`);
$('#faq>.page-content').insertAdjacentHTML('beforeend',huntFAQ()+autochessFAQ());
const closeHunt = mode => {
  huntController?.dispose();huntController=null;$('#hunt-root').hidden=true;document.body.classList.remove('hunt-active');render();
  if(mode)startHuntMode(mode);else $('[data-hunt-mode="timed"]').focus({preventScroll:true});
};
const startHuntMode = mode => {
  if(active()||pendingResult||animating||huntController||autoController)return;
  stopReplay();stopAnalysis();displayMatch=null;
  $('#hunt-root').hidden=false;document.body.classList.add('hunt-active');
  huntController=mountHunt({root:$('#hunt-root'),exitButton:$('#hunt-exit'),mode,runId:createRecordId(),runSeed:createRecordId(),equipped:structuredClone(state.equipped),showModal,onExit:closeHunt,getBest:mode=>state.hunt.records[mode].bestScore,award:run=>{
    const next=awardHunt(state,run);if(next!==state&&!persist(next))return false;
    $('#coins').textContent=state.coins;$('#coins').nextElementSibling.textContent=plural(state.coins,['монета','монеты','монет']);return true;
  }});
  render();
};
document.querySelectorAll('[data-hunt-mode]').forEach(button=>button.onclick=()=>startHuntMode(button.dataset.huntMode));
$('#autochess-open').onclick=()=>{
 if(active()||pendingResult||animating||huntController||autoController)return;
 if(qualityRunning){toast('Дождитесь завершения оценки последней партии.');return;}
 stopReplay();stopAnalysis();stopBot();displayMatch=null;
 $('#autochess-root').hidden=false;document.body.classList.add('autochess-active');
 autoController=mountAutochess({root:$('#autochess-root'),exitButton:$('#hunt-exit'),equipped:structuredClone(state.equipped),showModal,toast,createId:createRecordId,award:run=>{
  try {
   const latest=loadState(localStorage),next=awardAutochess(latest,run);
   if(next!==latest)localStorage.setItem(KEY,JSON.stringify(next));
   state=next;$('#coins').textContent=state.coins;$('#coins').nextElementSibling.textContent=plural(state.coins,['монета','монеты','монет']);
   return {saved:true,coins:state.autochessAwards?.[run.battle.id]?.coins||0,total:autoSeriesCoins(state,run)};
  }catch{return {saved:false};}
 },onExit:()=>{
  const previous=autoController;autoController=null;previous?.dispose();$('#autochess-root').hidden=true;document.body.classList.remove('autochess-active');render();$('#autochess-open').focus({preventScroll:true});
 }});render();
};
const ended = () => state.game.resigned || game.isGameOver();
const locked = () => busy || animating;
const active = () => isMatchActive(state,game);
const statusText = () => {
  if(state.game.resigned)return state.game.mode==='bot'?'Вы сдались':`${game.turn()==='w'?'Белые':'Чёрные'} сдались`;
  if(game.isCheckmate())return `Мат. ${game.turn()==='w'?'Чёрные':'Белые'} победили`;
  if(game.isStalemate())return 'Пат. Ничья';
  if(game.isThreefoldRepetition())return 'Ничья — троекратное повторение позиции';
  if(game.isInsufficientMaterial())return 'Ничья — недостаточно материала для мата';
  if(game.isDraw())return 'Ничья';
  return `${game.isCheck()?'Шах · ход':'Ход'} ${game.turn()==='w'?'белых':'чёрных'}`;
};
let qualityRunning=false,visibleRewardId=null;
const processPendingRewards = async () => {
 if(qualityRunning)return;
 qualityRunning=true;
 try {
  while(state.archive.some(entry=>['pending','unavailable'].includes(entry.rewardBreakdown?.qualityStatus))){
   const pending=state.archive.find(entry=>['pending','unavailable'].includes(entry.rewardBreakdown?.qualityStatus));
   let quality;
   try {quality=await analyzeReward(pending,{onProgress:(done,total)=>{
    if(visibleRewardId===pending.id&&$('#reward-quality-progress'))$('#reward-quality-progress').textContent=`Оценка качества: ${done} из ${total} ходов`;
   },onRetry:({done,total})=>{
    if(visibleRewardId===pending.id&&$('#reward-quality-progress'))$('#reward-quality-progress').textContent=`Оценка качества: ${done} из ${total} ходов · возобновляем…`;
   }});}catch(error) {quality={status:'unavailable',diagnostics:error.diagnostics||[{stage:'replay',message:String(error.message||error).slice(0,180)}]};}
   const next=applyQualityReward(state,pending.id,quality);
   if(next===state)continue;
   if(!persist(next))break;
   const updated=state.archive.find(entry=>entry.id===pending.id);
   if(visibleRewardId===pending.id&&$('#reward-quality-progress')){
    $('#modal-content').innerHTML=matchResultDialog(updated.result,updated.rewardBreakdown.total,updated,updated.rewardBreakdown,matchEndReason(displayMatch.game,displayMatch.config.resigned));
    $('#modal-content h2').id='dialog-title';
   }else if(updated.rewardBreakdown.quality>0)toast(`${updated.rewardBreakdown.qualityStatus==='fallback'?'Резервный бонус':'Бонус за качество'}: +${updated.rewardBreakdown.quality} монет`);
   render();
  }
 }finally{qualityRunning=false;}
};
const settle = (notifyActivity=true) => {
  if(!ended()||!state.game.started)return;
  const wasSettled=state.game.settled, reason=matchEndReason(game,state.game.resigned);
  const finishedGame=new Chess();finishedGame.loadPgn(game.pgn());
  const finishedConfig=structuredClone(state.game);
  const result=completedMatch(state,game,{id:createRecordId(),finishedAt:new Date().toISOString()});
  if(!result)return;
  const closed=closeActivityDay(state.activity,{counted:!!result.entry&&!wasSettled,finishedAt:result.entry?.finishedAt});
  if(!persist({...result.state,activity:closed.activity},true))return;
  pendingActivity=notifyActivity?closed.event:null;
  const {entry,reward,rewardBreakdown}=result;
  stopBot();game.reset();reviewCursor=null;queuedCursor=undefined;selected=null;
  if(!wasSettled){displayMatch={game:finishedGame,config:finishedConfig,kind:'result'};pendingResult=true;}
  const analysisStep=()=>eligibleEntry(entry)?{html:`<h2>Разобрать партию?</h2><p>Посмотрите важные моменты и попробуйте найти более сильные ходы.</p><button class="primary" data-post-analysis="${entry.id}">Разобрать партию</button>`,options:{closeLabel:'На главный экран'}}:null;
  const options={closeLabel:'Продолжить',closeVariant:'primary',next:()=>{
    const event=pendingActivity;pendingActivity=null;
    return event?{html:activityDialog(event),options:{closeLabel:'Продолжить',closeVariant:'primary',next:analysisStep}}:analysisStep();
  }};
  if(!wasSettled){visibleRewardId=entry?.id||null;void showModal(result.cancelled?cancelledDialog():matchResultDialog(entry.result,reward,entry,rewardBreakdown,reason),options).then(()=>processPendingRewards());}
};
const boardState = () => boardAvailability(state,game,reviewCursor,{readOnly:!!displayMatch,busy,animating});
const syncBoardAvailability = () => {
  if(disposeAnalysis)return;
  const availability=boardState();
  $('#board').setAttribute('aria-busy',String(availability.busy));
  $('#board').querySelectorAll('[data-square]').forEach(cell=>cell.setAttribute('aria-disabled',String(availability.disabled)));
};
const drawBoard = () => {
  if(disposeAnalysis)return;
  const config=viewedConfig(),equipped=config.equipped||state.equipped;
  renderBoard($('#board'),positionAt(viewedGame(),reviewCursor),equipped,!displayMatch&&reviewCursor===null?selected:null,config.playerColor||'w');
  $('#board').classList.toggle('reviewing',reviewCursor!==null);
  $('#board').setAttribute('aria-label',reviewCursor!==null?'Шахматная доска: просмотр истории':'Шахматная доска');
  syncBoardAvailability();
};
const drawCollection = () => renderCollection($('#collection-content'),state,collectionView,pieceType,ownedOnly);
const syncNavigation = () => {
  currentScreen=pendingResult?'play':navigationTarget(state,game,currentScreen);
  document.querySelectorAll('.tab').forEach(section=>section.hidden=section.id!==currentScreen);
  document.querySelectorAll('[data-tab]').forEach(button=>{
    button.classList.toggle('active',button.dataset.tab===currentScreen);
    button.disabled=(active()||pendingResult)&&button.dataset.tab!=='play';
    button.title=button.disabled?(button.dataset.tab==='archive'?'История доступна после завершения партии':'Раздел доступен после завершения партии'):'';
    button.setAttribute('aria-current',button.dataset.tab===currentScreen?'page':'false');
  });
  $('#app-nav').hidden=!!huntController||!!autoController||active()||pendingResult||displayMatch?.kind==='archive'||currentScreen==='analysis';
  document.body.classList.toggle('archive-viewing',displayMatch?.kind==='archive');
  $('#play').dataset.pageKind=displayMatch?.kind==='archive'?'detail':'root';
  $('#profile-avatar').disabled=!!huntController||!!autoController||active()||pendingResult;

  document.body.classList.toggle('match-active',active()||pendingResult);
  $('.brand').setAttribute('aria-disabled',String(active()));
};
const renderArchive = () => {
  if(currentScreen!=='archive')return;
  const root=$('#match-archive');
  const focusedId=root.contains(document.activeElement)?document.activeElement.dataset.archive:null;
  renderArchiveList(root,state.archive);
  if(focusedId)root.querySelector(`[data-archive="${CSS.escape(focusedId)}"]`)?.focus({preventScroll:true});
};
const restoreArchiveContext = () => {
  if(!archiveReturnContext)return;
  const {id,scrollTop,x,y}=archiveReturnContext;
  $('#match-archive').scrollTop=scrollTop;
  renderArchive();
  const entry=$('#match-archive').querySelector(`[data-archive="${CSS.escape(id)}"]`);
  (entry||$('#match-archive')).focus({preventScroll:true});
  window.scrollTo({left:x,top:y,behavior:'instant'});
  archiveReturnContext=null;
};
const renderStatistics = () => {
  const entries=state.archive.filter(entry=>entry.mode==='bot'&&entry.counted!==false), wins=entries.filter(entry=>entry.result==='Победа').length;
  const draws=entries.filter(entry=>entry.result==='Ничья').length, losses=entries.length-wins-draws;
  const percent=entries.length?Math.round(wins/entries.length*100)+'%':'—';
  const winStreak=entries.findIndex(entry=>entry.result!=='Победа');
  const currentWins=winStreak<0?entries.length:winStreak;
  const card=statCard;
  $('#play-stats').innerHTML=card(entries.length,'Сыграно партий')+card(wins,'Побед');
  $('#detailed-statistics').innerHTML=`<section class="statistics-group"><h2>Игра</h2><div class="statistics-grid">${card(wins,'Побед')}${card(losses,'Поражений')}${card(draws,'Ничьих')}${card(entries.length,'Сыграно партий')}${card(percent,'Процент побед')}${card(currentWins,'Серия побед')}</div></section><section class="statistics-group statistics-progress"><h2>Прогресс</h2><div class="statistics-grid">${card(state.owned.length,'Предметов')}${card(state.opened,'Открыто сундуков')}</div></section>`;
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
};
const renderHistory = () => {
  if(disposeAnalysis)return;
  const moves=viewedGame().history(), cursor=(queuedCursor===undefined?reviewCursor:queuedCursor)??moves.length;
  const canReplay=displayMatch?.kind==='archive';
  $('#replay-start').hidden=!canReplay||replayRunning;
  $('#replay-pause').hidden=!canReplay||!replayRunning;
  $('#replay-start').disabled=!moves.length;
  $('#history-live').setAttribute('aria-label',displayMatch?.kind==='archive'?'К последнему ходу':'К текущему ходу');
  $('#history-back').disabled=cursor===0;
  $('#history-forward').disabled=cursor===moves.length;
  $('#history-live').disabled=cursor===moves.length;
  $('#history-position').textContent=`${cursor} / ${moves.length}`;
  syncHistorySlider($('#history-slider'),cursor,moves.length,replayRunning&&animating);
  $('#history-notice').hidden=reviewCursor===null||!!displayMatch;
  $('#move-count').textContent=moves.length;
  $('#moves').innerHTML=moveList(moves,cursor);
  if(reviewCursor===null)$('#moves').scrollTop=$('#moves').scrollHeight;
};
const renderGameInfo = () => {
  $('#minigames-title').textContent=autoController?'Автошахматы':huntController?'Охота':'Мини-игры';
  $('#hunt-exit').closest('.page-header-start').hidden=!huntController&&!autoController;
  $('#hunt-exit').setAttribute('aria-label',autoController?'Выйти из автошахмат':'Выйти из охоты');
  if(huntController||autoController)return;
  syncBoardAvailability();
  if(pendingResult){
    $('#resign').disabled=true;
    $('#match-surface').inert=true;
    renderHistory();
    return;
  }
  $('#match-surface').inert=false;
  const config=viewedConfig(),hasBoard=!!displayMatch||state.game.started;
  const color=config.playerColor||'w';
  const points=materialBalance(positionAt(viewedGame(),reviewCursor),color);
  const pointsText=`${signedDelta(points)} ${plural(points,['очко','очка','очков'])}`;
  for(const node of [$('#match-points'),$('#match-settings')])node.dataset.balance=points>0?'positive':points<0?'negative':'zero';
  $('#player-name').textContent=config.imported?config.white:config.mode==='bot'?'Вы':'Игрок 1';
  $('#opponent-avatar').innerHTML=pieceSVG('n',color==='w'?'b':'w');
  $('#player-avatar').innerHTML=pieceSVG('p',color);
  $('#opponent').textContent=config.imported?config.black:config.mode==='bot'?`ИИ · ${playStyleName(config.engineProfile?.profile)}`:'Игрок 2';
  $('#match-points').textContent=pointsText;
  if(state.game.started&&ended()&&!$('#match-surface').hidden){
    $('#resign').disabled=true;renderHistory();return;
  }
  $('#match-surface').hidden=!hasBoard;
  $('#archive-return').hidden=displayMatch?.kind!=='archive';
  $('#archive-return').setAttribute('aria-label',archiveReturnTarget==='profile'?'В профиль':archiveReturnTarget==='play'?'К игре':'К истории партий');
  $('#archive-return').title=$('#archive-return').getAttribute('aria-label');
  const archived=displayMatch?.kind==='archive',canAnalyze=archived&&eligibleEntry(state.archive.find(entry=>entry.id===displayMatch.config.id));
  $('#archive-heading-actions').hidden=!archived;
  $('#archive-review-actions').hidden=analysisComplete||!canAnalyze;
  const exportParent=archived?$('#archive-export-slot'):$('.match-actions'),exportButton=$('#export-pgn');
  if(exportButton.parentElement!==exportParent){
   exportParent.prepend(exportButton);exportButton.classList.toggle('icon-button',archived);
   exportButton.setAttribute('aria-label','Экспортировать PGN');exportButton.title='Экспортировать PGN';
   exportButton.innerHTML=archived?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>':'Экспортировать PGN';
  }
  if(!analysisController)$('#archive-analysis').hidden=!!disposeAnalysis||!$('#analysis-retry').hidden||!canAnalyze;
  $('#play-stats').hidden=hasBoard||!state.archive.some(entry=>entry.mode==='bot'&&entry.counted!==false);
  const shownPosition=positionAt(viewedGame(),reviewCursor);
  $('#status').textContent=reviewCursor!==null||displayMatch?`${shownPosition.isCheck()?'Шах · ход':'Ход'} ${shownPosition.turn()==='w'?'белых':'чёрных'}`:state.game.started?statusText():'Партия';
  $('#resign').disabled=!active();
  $('#resign').hidden=!active()&&!pendingResult&&!(state.game.started&&ended());
  $('#abort-failed').hidden=!canAbortFailedMatch(state,game)||!!displayMatch;
  $('#abort-failed').disabled=animating;
  $('#retry-failed').hidden=$('#abort-failed').hidden;
  $('#retry-failed').disabled=locked();
  $('#game-ready').hidden=hasBoard;
  $('#match-title').textContent=displayMatch?'История партии':active()?'Партия':state.game.started?'Итоги партии':'Игра';
  $('#match-settings').textContent='';
  $('#start-game').textContent='Партия с ИИ';
  $('#start-game').disabled=active()||animating;
  renderHistory();
};
const render = () => {
  if(!animating)drawBoard();
  drawCollection();renderProfile();renderCalendar();renderGameInfo();syncNavigation();
  $('#coins').textContent=state.coins;
  $('#shards').textContent=state.shards;
  $('#coins').nextElementSibling.textContent=plural(state.coins,['монета','монеты','монет']);
  $('#shards').nextElementSibling.textContent=plural(state.shards,['осколок','осколка','осколков']);
  $('#count').textContent=`${state.owned.length}/${ITEMS.length}`;
  $('#open-chest').disabled=active()||state.coins<100;
  $('#open-chest').classList.toggle('disabled-explanation',state.coins<100);
  $('#open-chest .control-label').textContent=state.coins<100?`Не хватает ${100-state.coins} ${plural(100-state.coins,['монеты','монет','монет'])}`:'Открыть за 100 ◈';
  $('#pity').textContent=`Эпический или легендарный предмет — максимум через ${10-state.pity} ${plural(10-state.pity,['сундук','сундука','сундуков'])}`;
  $('#pity-progress').value=state.pity;
};
const stopBot = () => {taskId++;worker?.terminate();worker=null;busy=false;pendingBotMove=null;syncBoardAvailability();};
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
  try {played=game.move(move);} catch {toast('Этот ход недоступен.',{error:true});return;}
  if(!persist({...state,game:{...state.game,engineFailure:null}})){game.undo();drawBoard();return;}
  lastBotError=null;
  selected=null;promotion=null;animating=followLive;
  drawBoard();renderGameInfo();
  if(followLive)showCaptureMaterial($('#board'),played,state.game.playerColor);
  try {if(followLive)await animateMove($('#board'),played,before);} finally {animating=false;syncBoardAvailability();}
  settle();render();if(!pendingResult&&queuedCursor!==undefined){const cursor=queuedCursor,quick=queuedHistoryInstant;queuedCursor=undefined;queuedHistoryInstant=false;void showHistory(cursor,false,quick);}else requestBot();
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
      busy=false;syncBoardAvailability();
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
  if(!square||boardState().disabled)return;
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
  if(autoController){autoController.requestExit();return;}
  if(huntController){huntController.requestExit();return;}
  if(tab==='analysis')tab='archive';
  if(tab!=='play'&&(analysisController||disposeAnalysis))stopAnalysis();
  stopReplay();
  const returningToArchive=displayMatch?.kind==='archive'&&tab==='archive';
  if(pendingResult||(animating&&!returningToArchive))return;
  if(returningToArchive){
    queuedCursor=undefined;
    $('#board').getAnimations({subtree:true}).forEach(animation=>animation.cancel());
    animating=false;
  }
  const target=navigationTarget(state,game,tab);
  const leavingArchive=displayMatch?.kind==='archive'&&target!=='play';
  if(leavingArchive){displayMatch=null;reviewCursor=null;render();}
  if(target!==tab&&active())toast('Завершите партию, чтобы перейти в другой раздел.');
  currentScreen=target;
  window.history.replaceState(null,'','#'+target);
  syncNavigation();if(target==='archive')renderArchive();if(target==='calendar')renderCalendar();
  if(leavingArchive&&target==='archive')restoreArchiveContext();
};
const showHistory = async (cursor,automatic=false,instant=false) => {
  if(pendingResult)return;
  if(!automatic)stopReplay();
  if(animating){queuedCursor=cursor;queuedHistoryInstant=instant;renderHistory();return;}
  const total=viewedGame().history().length, from=reviewCursor??total;
  const target=cursor===null||cursor>=total?total:Math.max(0,cursor);
  if(from===target)return;
  clearCaptureMaterial($('#board'));
  const before=snapshotBoard($('#board')), steps=historyMoves(viewedGame(),from,target);
  const matchAtStart=displayMatch;
  reviewCursor=target===total?null:target;selected=null;animating=true;
  drawBoard();renderGameInfo();
  try {if(!instant)await animateTransition($('#board'),steps,before);} finally {animating=false;syncBoardAvailability();}
  if(displayMatch!==matchAtStart)return;
  render();
  if(queuedCursor!==undefined){const next=queuedCursor,quick=queuedHistoryInstant;queuedCursor=undefined;queuedHistoryInstant=false;await showHistory(next,false,quick);return;}
  if(pendingBotMove){const move=pendingBotMove;pendingBotMove=null;void applyMove(move);}
  else requestBot();
};
const stopReplay = () => {
  replayRunning=false;clearTimeout(replayTimer);replayTimer=null;
  if($('#replay-start'))renderHistory();
};
const replayStep = async () => {
  if(!replayRunning||displayMatch?.kind!=='archive'||currentScreen!=='play'||pendingResult)return;
  const total=viewedGame().history().length;
  await showHistory(historyCursor(queuedCursor===undefined?reviewCursor:queuedCursor,1,total),true);
  if(!replayRunning)return;
  if(reviewCursor===null){stopReplay();return;}
  replayTimer=setTimeout(()=>void replayStep(),375);
};
$('#replay-start').onclick=async()=>{
  if(replayRunning||displayMatch?.kind!=='archive'||pendingResult||!viewedGame().history().length)return;
  if(reviewCursor===null)await showHistory(0);
  replayRunning=true;renderHistory();replayTimer=setTimeout(()=>void replayStep(),100);
};
$('#replay-pause').onclick=stopReplay;
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopReplay();});
const restoreHistoryControls = () => {
 $('#history-back').onclick=()=>showHistory(historyCursor(queuedCursor===undefined?reviewCursor:queuedCursor,-1,viewedGame().history().length));
 $('#history-forward').onclick=()=>showHistory(historyCursor(queuedCursor===undefined?reviewCursor:queuedCursor,1,viewedGame().history().length));
 $('#history-live').onclick=()=>showHistory(null);
 $('#replay-pause').onclick=stopReplay;
 $('#replay-start').onclick=async()=>{
  if(replayRunning||displayMatch?.kind!=='archive'||pendingResult||!viewedGame().history().length)return;
  if(reviewCursor===null)await showHistory(0);
  replayRunning=true;renderHistory();replayTimer=setTimeout(()=>void replayStep(),100);
 };
 bindHistorySlider($('#history-slider'),ply=>void showHistory(ply,false,true));
 $('#moves').onclick=null;
};
restoreHistoryControls();
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
  if(persist({...state,equipped})){render();toast('Предмет выбран для игры.');}
};
const confirmCraft = id => {
  if(active())return;
  const item=itemById(id);
  if(!item||state.owned.includes(id)||state.shards<craftCost(item))return;
  showModal(craftDialog(item,id),{closeLabel:'Отмена'});
};
const showSaveSet = async () => {
  if(active())return;
  if(state.sets.length>=12){toast('Можно сохранить до 12 наборов. Удалите один, чтобы сохранить новый.');return;}
  await showModal(saveSetDialog(),{closeLabel:'Отмена'});
  $('#set-name').focus();
};
const focusCollectionItem = id => {
  const item=itemById(id);
  if(!item)return;
  pieceType=item.kind==='board'?'board':item.type;
  collectionView='items';if(!state.owned.includes(id))ownedOnly=false;drawCollection();
  const card=document.getElementById(`collection-item-${item.id}`);
  card?.classList.add('navigation-target');
  card?.addEventListener('blur',()=>card.classList.remove('navigation-target'),{once:true});
  card?.focus({preventScroll:true});
  if(card){
    const top=document.querySelector('header').getBoundingClientRect().bottom+($('#collection-content .equipment-strip')?.getBoundingClientRect().height||0)+24;
    const dock=$('#app-nav');
    const bottom=dock.hidden?window.innerHeight:Math.min(window.innerHeight,dock.getBoundingClientRect().top);
    const rect=card.getBoundingClientRect();
    window.scrollTo({top:window.scrollY+rect.top+rect.height/2-(top+bottom)/2,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
};
$('#collection-content').addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(active()||!button||button.disabled)return;
  if(button.dataset.openItem){
    focusCollectionItem(button.dataset.openItem);
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
    if(persist({...state,equipped:presetEquipment(button.dataset.preset)})){render();toast('Набор выбран.');}
  }
  if(button.dataset.loadSet){
    const set=state.sets.find(set=>set.id===button.dataset.loadSet);
    if(set&&persist({...state,equipped:{pieces:{...set.pieces},board:set.board}})){render();toast('Набор выбран.');}
  }
  if(button.dataset.deleteSet)showModal(deleteSetDialog(button.dataset.deleteSet),{closeLabel:'Отмена'});
});
const openArchivedGame = (id,returnTarget='archive') => {
  const entry=state.archive.find(entry=>entry.id===id);if(!entry)return;
  const replay=new Chess();try{replay.loadPgn(entry.pgn);}catch{toast('Не удалось открыть запись партии.',{error:true});return;}
  archiveReturnTarget=returnTarget;
  archiveReturnContext={id,scrollTop:$('#match-archive').scrollTop,x:window.scrollX,y:window.scrollY};
  displayMatch={game:replay,kind:'archive',title:entry.result,config:{...entry,started:true,rating:{before:entry.playerRating,opponent:entry.opponentRating}}};
  reviewCursor=replay.history().length?0:null;selected=null;changeTab('play');render();
  $('#match-title').tabIndex=-1;
  $('#match-title').focus({preventScroll:true});
  window.scrollTo({top:0,left:0,behavior:'instant'});
};
$('#match-archive').addEventListener('click',event=>{
  if(active()||animating||pendingResult)return;
  openArchivedGame(event.target.closest('[data-archive]')?.dataset.archive);
});
$('#archive-return').onclick=()=>{
 if(archiveReturnTarget==='play'){stopAnalysis();stopReplay();displayMatch=null;reviewCursor=null;changeTab('play');render();$('#start-game').focus({preventScroll:true});}
 else changeTab(archiveReturnTarget==='profile'?'profile':'archive');
};
$('#export-pgn').onclick=exportViewedMatch;
$('#open-pgn').onclick=()=>{if(!active()&&!pendingResult)showModal(importPgnDialog());};
const openImportedPgn = async text => {
 try {
  const imported=importPgn(text);
  if(active()||pendingResult)return;
  await showModal.close();stopAnalysis();stopReplay();archiveReturnContext=null;archiveReturnTarget='profile';
  displayMatch={...imported,kind:'archive'};reviewCursor=0;selected=null;changeTab('play');render();
  $('#archive-return').setAttribute('aria-label','В профиль');$('#archive-return').title='В профиль';
  $('#match-title').tabIndex=-1;$('#match-title').focus({preventScroll:true});
 }catch(error){const feedback=$('#pgn-import-error');if(feedback)feedback.textContent=error.message;}
};
$('#modal-content').addEventListener('change',async event=>{
 if(event.target.id!=='pgn-file')return;
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>MAX_PGN_BYTES){$('#pgn-import-error').textContent='Файл слишком большой. Максимум — 512 КБ.';return;}
 try {await openImportedPgn(await file.text());}catch{$('#pgn-import-error').textContent='Не удалось прочитать файл.';}
});
$('#modal-content').addEventListener('submit',event=>{
  if(event.target.id==='import-pgn-form'){event.preventDefault();void openImportedPgn($('#import-pgn-text').value);return;}
  if(active()||event.target.id!=='save-set-form')return;
  event.preventDefault();
  const name=$('#set-name').value.trim();
  if(!name||state.sets.length>=12)return;
  const set={id:createRecordId(),name:name.slice(0,32),...structuredClone(state.equipped)};
  if(persist({...state,sets:[...state.sets,set]})){showModal.close();drawCollection();toast('Набор сохранён.');}
});
$('#modal-content').addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if(!button)return;
  if(button.hasAttribute('data-pgn-paste')){$('#import-pgn-form').hidden=false;$('#import-pgn-text').focus({preventScroll:true});}
  if(button.hasAttribute('data-pgn-file'))$('#pgn-file').click();
  if(button.dataset.postAnalysis){postGameAnalysisId=button.dataset.postAnalysis;button.disabled=true;await showModal.close();return;}
  if(button.dataset.promote&&promotion){const move={...promotion,promotion:button.dataset.promote};await showModal.close();void applyMove(move);}
  if(button.dataset.confirmDeleteSet&&!active()){
    if(persist({...state,sets:state.sets.filter(set=>set.id!==button.dataset.confirmDeleteSet)})){await showModal.close();drawCollection();}
  }
  if(button.dataset.confirmCraft&&!active()){
    const next=craftItem(state,button.dataset.confirmCraft);
    if(next&&persist(next)){showModal.close();render();toast('Готово! Предмет в коллекции.');}
  }
  if(button.dataset.viewReward&&!active()){
    const id=button.dataset.viewReward;
    button.disabled=true;
    await showModal.close();
    changeTab('collection');
    focusCollectionItem(id);
  }
  if(button.dataset.useReward){useItem(button.dataset.useReward);showModal.close();}
  if(button.hasAttribute('data-confirm-resign'))confirmResignation();
  if(button.hasAttribute('data-abort-failed'))abortAfterFailure();
  if(button.hasAttribute('data-download-pgn'))downloadPgn($('#pgn-text').value);
  if(button.hasAttribute('data-share-pgn'))void sharePgn($('#pgn-text').value).catch(()=>toast('Не удалось поделиться PGN. Скачайте файл или скопируйте текст.',{error:true}));
  if(button.hasAttribute('data-copy-pgn')){
   const field=$('#pgn-text'),feedback=$('#pgn-feedback');button.copyIcon??=button.innerHTML;const original=button.copyIcon;clearTimeout(button.copyTimer);button.disabled=true;
   try {
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(field.value);
    else {field.focus({preventScroll:true});field.select();if(!document.execCommand('copy'))throw Error('Clipboard unavailable');button.focus({preventScroll:true});}
    feedback.dataset.error='false';feedback.textContent='PGN скопирован';
    button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
    button.copyTimer=setTimeout(()=>{if(button.isConnected)button.innerHTML=original;},2000);
   }catch{button.innerHTML=original;feedback.dataset.error='true';feedback.textContent='Не удалось скопировать. Выделите текст и выберите «Копировать».';}
   finally{button.disabled=false;}
  }
  if(button.hasAttribute('data-export-pgn'))void exportViewedMatch();
  if(button.hasAttribute('data-retry-bot')){showModal.close();requestBot();}
});
$('#modal').addEventListener('cancel',()=>{if(!promotion){selected=null;if(!animating)drawBoard();}});
$('#modal').addEventListener('dialogdismiss',()=>{
  visibleRewardId=null;
  if(!pendingResult||$('#modal').open)return;
  if(postGameAnalysisId){
   const id=postGameAnalysisId;postGameAnalysisId=null;pendingResult=false;pendingActivity=null;
   openArchivedGame(id,'play');void openAnalysis(id);return;
  }
  const finish = () => {
    pendingResult=false;pendingActivity=null;displayMatch=null;reviewCursor=null;
    render();$('#start-game').focus({preventScroll:true});

  };
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Keep a visual copy of the outgoing board while the ready screen takes its place.
  // Do not fade the entire document or briefly reveal an empty page.
  const surface=$('#match-surface'),rect=surface.getBoundingClientRect();
  const outgoing=!reduced&&surface.animate?surface.cloneNode(true):null;
  if(outgoing){
    outgoing.removeAttribute('id');outgoing.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
    outgoing.inert=true;outgoing.setAttribute('aria-hidden','true');
    const areaRect=surface.querySelector('.board-area').getBoundingClientRect();
    Object.assign(outgoing.querySelector('.board-area').style,{width:`${areaRect.width}px`,maxWidth:`${areaRect.width}px`});
    Object.assign(outgoing.style,{position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,margin:'0',zIndex:'34',pointerEvents:'none',background:'var(--bg)'});
    document.body.append(outgoing);
  }
  finish();
  if(outgoing){
    const animation=outgoing.animate([{opacity:1},{opacity:0}],{duration:motionDuration.fast,easing:motionEasing.exit});
    animation.finished.catch(()=>{}).finally(()=>outgoing.remove());
  }
});
$('#close-modal').onclick=()=>showModal.close();
window.addEventListener('pagehide',stopAnalysis);
$('#open-chest').onclick=()=>{
  if(active())return;
  const opened=openChest(state);
  if(!opened||!persist(opened.state))return;
  render();
  const {item,duplicate,shards}=opened.result;
  const title=!item?'Осколки':duplicate?'Предмет уже в коллекции':'Новый предмет!';
  const artwork=item?itemPreview(item):'<div class="shard-reveal">✧</div>';
  const copy=!item?'В сундуке — осколки. Их можно потратить на нужную фигуру или доску.':duplicate?'Повтор превратился в осколки. Ваш предмет остаётся в коллекции.':'Предмет добавлен в коллекцию.';
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
    surface.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:motionDuration.standard,easing:motionEasing.enter});
  }
  requestBot();
};
const abortAfterFailure = () => {
  const next=abortFailedMatch(state,game,{id:createRecordId(),finishedAt:new Date().toISOString()});
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
let refreshPending=false,refreshing=false,updateAccepted=false,firstIsolationPending=false,updateRegistration=null;
const syncUpdateButtons = () => {
 for(const id of ['#update-app','#profile-update-app'])$(id).hidden=!(refreshPending||updateRegistration?.waiting);
};
const applyPendingUpdate = () => {
 if(!refreshPending||refreshing||(!updateAccepted&&!firstIsolationPending)||huntController||autoController||active()||pendingResult||animating||$('#modal').open)return;
 refreshing=true;location.reload();
};
const acceptUpdate = () => {
 if(huntController||autoController||active()||pendingResult||analysisController||disposeAnalysis){toast('Завершите партию или выйдите из разбора перед обновлением.');return;}
 if(!persist(state,!state.game.started))return;
 updateAccepted=true;
 if(updateRegistration?.waiting)updateRegistration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
 else applyPendingUpdate();
};
$('#update-app').onclick=acceptUpdate;$('#profile-update-app').onclick=acceptUpdate;
if('serviceWorker' in navigator){
 let controlled=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  // Only first installation may reload without user consent to enable WASM isolation.
  if(!controlled&&!globalThis.crossOriginIsolated)firstIsolationPending=true;
  refreshPending=true;controlled=true;syncUpdateButtons();applyPendingUpdate();
 });
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>{
  updateRegistration=registration;
  const announce=()=>{syncUpdateButtons();};
  announce();registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',announce));
  const check=()=>{if(!document.hidden){applyPendingUpdate();void registration.update().then(announce).catch(()=>{});}};
  document.addEventListener('visibilitychange',check);window.addEventListener('online',check);
  $('#modal').addEventListener('dialogdismiss',applyPendingUpdate);check();
 }).catch(()=>toast('Офлайн-режим недоступен. Игра работает при подключении к сети.',{error:true}));
}
$('.brand>span:first-child').innerHTML=pieceSVG('n','w');
$('#chest-art').innerHTML=pieceSVG('q','w','gold');
$('#status').setAttribute('aria-live','polite');
setInterval(()=>{if(firstIsolationPending)applyPendingUpdate();},1000);
currentScreen=navigationTarget(state,game,location.hash.slice(1)||'play');
changeTab(currentScreen);render();settle(false);render();requestBot();
if(storageError)toast('Не удалось прочитать сохранённый прогресс. Данные в браузере не удалены.',{error:true});

void processPendingRewards();
