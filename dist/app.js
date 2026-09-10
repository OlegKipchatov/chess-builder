import {Chess} from './chess.js?v=2';
import {TYPES, ITEMS, PIECE_NAMES, rarityNames, itemById, styleById, craftCost} from './catalog.js?v=2';
import {openChest, craftItem} from './economy.js?v=2';
import {KEY, loadState, initialState, newGame} from './state.js?v=2';
import {DIFFICULTIES, rewardFor} from './engine.js?v=2';
import {pieceSVG, itemPreview} from './pieces.js?v=2';
import {renderBoard, snapshotBoard, animateMove} from './board.js?v=2';
import {renderCollection, presetEquipment, canEquipPreset} from './collection.js?v=2';
const $ = selector => document.querySelector(selector);
let storageError = false;
let state;
try {state=loadState(localStorage);} catch {state=initialState();storageError=true;}
const game = new Chess();
try {if(state.game.pgn)game.loadPgn(state.game.pgn);} catch {game.reset();state.game=newGame();storageError=true;}
let selected=null, promotion=null, busy=false, animating=false, worker=null, taskId=0, toastTimer, installPrompt=null;
let collectionView='pieces', pieceType='k';
const toast = message => {
  $('#toast').textContent=message;
  $('#toast').style.display='block';
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('#toast').style.display='none',5000);
};
const persist = next => {
  const snapshot={...next, game:{...next.game,pgn:game.pgn()}};
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
const statusText = () => {
  if(state.game.resigned)return state.game.mode==='bot'?'Вы сдались':`${game.turn()==='w'?'Белые':'Чёрные'} сдались`;
  if(game.isCheckmate())return `Мат. ${game.turn()==='w'?'Чёрные':'Белые'} победили`;
  if(game.isStalemate())return 'Пат. Ничья';
  if(game.isThreefoldRepetition())return 'Ничья: повторение позиции';
  if(game.isInsufficientMaterial())return 'Ничья: недостаточно фигур';
  if(game.isDraw())return 'Ничья';
  return `${game.isCheck()?'Шах! ':''}Ход ${game.turn()==='w'?'белых':'чёрных'}`;
};
const settle = () => {
  if(!ended() || state.game.settled)return;
  const reward=rewardFor(game,state.game.resigned,state.game.mode);
  const next={...state,coins:state.coins+reward,played:state.played+1,game:{...state.game,settled:true}};
  if(!persist(next))return;
  showModal(`<p class="eyebrow">ПАРТИЯ ЗАВЕРШЕНА</p><h2>${statusText()}</h2><div class="coin-reveal">◈</div><h2>+${reward} монет</h2><p>${reward?'Загляните в хранилище за новым предметом.':'Награда начисляется после 10 полуходов или при мате.'}</p>`);
};
const drawBoard = () => renderBoard($('#board'),game,state.equipped,selected);
const drawCollection = () => renderCollection($('#collection-content'),state,collectionView,pieceType);
const renderGameInfo = () => {
  const inProgress=game.history().length>0&&!ended();
  $('#mode').value=state.game.mode;
  $('#mode').disabled=inProgress||locked();
  $('#difficulty').value=state.game.difficulty;
  $('#difficulty').disabled=locked();
  $('#difficulty-field').hidden=state.game.mode!=='bot';
  $('#difficulty-hint').textContent=DIFFICULTIES[state.game.difficulty].description+' Можно менять между ходами.';
  $('#opponent').textContent=state.game.mode==='bot'?`Компьютер · ${DIFFICULTIES[state.game.difficulty].name}`:'Второй игрок';
  $('.reward-card p').textContent=state.game.mode==='local'?'Завершённая партия +40 монет':'Победа +60 · ничья +40 · поражение +25';
  $('#status').textContent=statusText();
  $('#thinking').textContent=busy?'Обдумывает ход…':ended()?'Партия завершена':'Без таймера';
  $('#resign').disabled=ended()||!game.history().length||locked();
  $('#new').disabled=animating;
  $('#hint').textContent=ended()?'Начните новую партию или откройте сундук.':busy?'Компьютер выбирает ответ.':'Выберите фигуру, чтобы увидеть доступные ходы.';
  $('#skin-name').textContent=styleById(itemById(state.equipped.board).style).name;
  const moves=game.history();
  $('#move-count').textContent=moves.length;
  $('#moves').innerHTML=moves.length?Array.from({length:Math.ceil(moves.length/2)},(_,i)=>`<div class="move-row"><span class="muted">${i+1}.</span><span>${moves[i*2]}</span><span>${moves[i*2+1]||'—'}</span></div>`).join(''):'<p class="muted">Первый ход за вами.</p>';
  $('#moves').scrollTop=$('#moves').scrollHeight;
};
const render = () => {
  if(!animating)drawBoard();
  drawCollection();renderGameInfo();
  $('#coins').textContent=state.coins;
  $('#shards').textContent=state.shards;
  $('#count').textContent=`${state.owned.length}/${ITEMS.length}`;
  $('#open-chest').disabled=state.coins<100;
  $('#chest-hint').textContent=state.coins<100?`Не хватает ${100-state.coins} монет. Сыграйте партию.`:'Один сундук — одно открытие. Вероятности указаны рядом.';
  $('#pity').textContent=`До гарантии эпического или легендарного предмета: ${10-state.pity}`;
  $('#pity-progress').value=state.pity;
};
const stopBot = () => {taskId++;worker?.terminate();worker=null;busy=false;};
const botFailure = () => {
  stopBot();renderGameInfo();
  showModal('<h2>Компьютер не смог ответить</h2><p>Партия сохранена. Можно повторить расчёт или начать новую игру вдвоём.</p><button class="quiet" data-retry-bot>Повторить расчёт</button>');
};
const applyMove = async move => {
  const before=snapshotBoard($('#board'));
  let played;
  try {played=game.move(move);} catch {toast('Этот ход недоступен.');return;}
  if(!persist(state)){game.undo();drawBoard();return;}
  selected=null;promotion=null;animating=true;
  drawBoard();renderGameInfo();
  try {await animateMove($('#board'),played,before);} finally {animating=false;}
  settle();render();requestBot();
};
const requestBot = () => {
  if(ended()||state.game.mode!=='bot'||game.turn()!=='b'||locked())return;
  busy=true;renderGameInfo();
  const id=++taskId;
  try {
    worker??=new Worker('./bot-worker.js?v=2',{type:'module'});
    worker.onmessage=({data})=>{
      if(data.id!==taskId)return;
      if(data.error||!data.move){botFailure();return;}
      busy=false;void applyMove(data.move);
    };
    worker.onerror=botFailure;
    worker.postMessage({id,fen:game.fen(),difficulty:state.game.difficulty});
  } catch {botFailure();}
};
const showPromotion = (from,to) => {
  promotion={from,to};
  showModal(`<h2>Превращение пешки</h2><p>Выберите фигуру</p><div class="promotion">${['q','r','b','n'].map(type=>`<button data-promote="${type}" aria-label="${PIECE_NAMES[type]}">${pieceSVG(type,game.turn(),itemById(state.equipped.pieces[type]).style)}</button>`).join('')}</div>`);
  $('#close-modal').hidden=true;
};
$('#board').addEventListener('click',event=>{
  const square=event.target.closest('[data-square]')?.dataset.square;
  if(!square||locked()||ended()||(state.game.mode==='bot'&&game.turn()==='b'))return;
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
  document.querySelectorAll('.tab').forEach(section=>section.hidden=section.id!==tab);
  document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));
};
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>changeTab(button.dataset.tab));
document.querySelectorAll('[data-go]').forEach(button=>button.onclick=()=>changeTab(button.dataset.go));
const useItem = id => {
  const item=itemById(id);
  if(!item||!state.owned.includes(id)||animating)return;
  const equipped=structuredClone(state.equipped);
  if(item.kind==='board')equipped.board=id;else equipped.pieces[item.type]=id;
  if(persist({...state,equipped})){render();toast('Предмет уже на доске.');}
};
const confirmCraft = id => {
  const item=itemById(id);
  if(!item||state.owned.includes(id)||state.shards<craftCost(item))return;
  showModal(`<p class="eyebrow">МАСТЕРСКАЯ</p><div class="result-art">${itemPreview(item)}</div><h2>${item.name}</h2><p>Создать выбранный предмет за ${craftCost(item)} осколков? Случайности нет.</p><button class="primary" data-confirm-craft="${id}">Создать за ${craftCost(item)} ✧</button>`);
};
const showSaveSet = () => {
  if(state.sets.length>=12){toast('Можно сохранить до 12 наборов. Удалите ненужный, чтобы добавить новый.');return;}
  showModal('<h2>Сохранить свой набор</h2><p>Сохраним шесть выбранных скинов и текущую доску.</p><form id="save-set-form"><label for="set-name">Название</label><input id="set-name" name="name" maxlength="32" required placeholder="Например, Полярная ночь" autocomplete="off"><button class="primary" type="submit">Сохранить набор</button></form>');
  $('#set-name').focus();
};
$('#collection-content').addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||button.disabled)return;
  if(button.dataset.pieceType){pieceType=button.dataset.pieceType;collectionView='pieces';drawCollection();}
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
$('#modal-content').addEventListener('submit',event=>{
  if(event.target.id!=='save-set-form')return;
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
  if(button.dataset.confirmCraft){
    const next=craftItem(state,button.dataset.confirmCraft);
    if(next&&persist(next)){$('#modal').close();render();toast('Предмет создан и добавлен в коллекцию.');}
  }
  if(button.dataset.useReward){useItem(button.dataset.useReward);$('#modal').close();}
  if(button.hasAttribute('data-retry-bot')){$('#modal').close();requestBot();}
});
$('#modal').addEventListener('cancel',()=>{promotion=null;selected=null;if(!animating)drawBoard();});
$('#close-modal').onclick=()=>$('#modal').close();
$('#open-chest').onclick=()=>{
  const opened=openChest(state);
  if(!opened||!persist(opened.state))return;
  render();
  const {item,duplicate,shards}=opened.result;
  const title=!item?'Осколки для мастерской':duplicate?'Предмет уже в коллекции':'Новый предмет!';
  const artwork=item?itemPreview(item):'<div class="shard-reveal">✧</div>';
  const copy=!item?'В этом сундуке нет предмета. Осколки можно потратить на конкретную фигурку или доску.':duplicate?'Повтор превратился в осколки. Сохранённый предмет остаётся у вас.':'Предмет добавлен в коллекцию. Используйте его отдельно или включите в свой набор.';
  showModal(`<p class="eyebrow">${title}</p><div class="result-art reveal">${artwork}</div>${item?`<span class="rarity ${item.rarity}">${rarityNames[item.rarity]}</span><h2>${item.name}</h2>`:''}${shards?`<h2>+${shards} осколков</h2>`:''}<p>${copy}</p>${item&&!duplicate?`<button class="quiet" data-use-reward="${item.id}">Использовать</button>`:''}`);
};
$('#new').onclick=()=>{
  if(animating)return;
  if(game.history().length&&!ended()&&!confirm('Завершить текущую партию без награды и начать новую?'))return;
  const previousPGN=game.pgn();
  stopBot();game.reset();
  if(!persist({...state,game:newGame(state.game.mode,state.game.difficulty)})){game.loadPgn(previousPGN);render();requestBot();return;}
  selected=null;promotion=null;render();
};
$('#resign').onclick=()=>{
  if(locked()||ended()||!confirm('Сдаться и завершить партию?'))return;
  if(persist({...state,game:{...state.game,resigned:true}})){settle();render();}
};
$('#mode').onchange=()=>{
  if(persist({...state,game:{...state.game,mode:$('#mode').value}})){render();requestBot();}
};
$('#difficulty').onchange=()=>{
  if(locked())return;
  if(persist({...state,game:{...state.game,difficulty:$('#difficulty').value}}))renderGameInfo();
};
$('#install').onclick=async()=>{
  if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}
  else showModal('<h2>Установить Chess Vault</h2><p>На iPhone: откройте сайт в Safari → «Поделиться» → «На экран Домой».</p><p>На Android и компьютере: в меню браузера выберите «Установить приложение».</p><p>После загрузки офлайн-кэша можно играть без интернета.</p>');
};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{$('#install').hidden=true;toast('Приложение установлено');});
if(matchMedia('(display-mode: standalone)').matches)$('#install').hidden=true;
window.addEventListener('storage',event=>{if(event.key===KEY){location.reload();}});
const showUpdate = registration => {
  if(!registration.waiting)return;
  $('#update-app').hidden=false;
  $('#update-app').onclick=()=>{
    if(game.history().length&&!ended()&&!confirm('Применить обновление? Партия сохранена и продолжится после перезагрузки.'))return;
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
$('.avatar').innerHTML=pieceSVG('n','b');
$('.avatar.light').innerHTML=pieceSVG('p','w');
$('.teaser>span').innerHTML=pieceSVG('q','w','gold');
$('#chest-art').innerHTML=pieceSVG('q','w','gold');
$('#status').setAttribute('aria-live','polite');
render();settle();render();requestBot();
if(storageError)toast('Сохранение не удалось прочитать. Старые данные оставлены в браузере.');
