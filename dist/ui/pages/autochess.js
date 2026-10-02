import {AUTO,AUTO_KEY,PRICES,createAutoRun,buyPiece,sellPiece,placePiece,placementSquares,setupFen,setupError,beginBattle,nextRound,restoreAutoRun,seriesFinished,buyRandomPiece,upgradeShop,purchasePrice,levelPrice,shopOdds,salePrice,roundIncome} from '../../autochess.js?v=94';
import {createBattleController} from '../../autochess-battle.js?v=94';
import {Chess} from '../../chess.js?v=94';
import {renderBoard,snapshotBoard,animateTransition,animationMoves} from '../../board.js?v=94';
import {motionDuration} from '../motion.js?v=94';
import {pieceSVG} from '../../pieces.js?v=94';
import {PIECE_NAMES,itemById} from '../../catalog.js?v=94';
import {disclosure,statCard,plural} from '../primitives.js?v=94';
export const autochessEntry=()=>`<section id="autochess-entry" class="autochess-entry"><h2>Автошахматы</h2><button id="autochess-open" class="primary">Играть</button></section>`;
export const autochessFAQ=()=>disclosure('Как играть в автошахматы?','<p>Серия идёт до десяти побед или трёх поражений. Ничья не приближает ни к победе в серии, ни к её завершению. Вы покупаете армию и расставляете её, а Stockfish играет за обе стороны с одинаковыми настройками, без адаптации к рейтингу. Король, шах, мат и обычные шахматные правила сохраняются. Ваш цвет известен заранее. Фигуры соперника открываются только после начала боя; белые ходят первыми.</p><p>В начале доступны король и 3 монеты серии. Кнопка покупки даёт случайную фигуру: первая стоит 1 монету, каждая следующая дороже на 1 до конца забега. У магазина 10 уровней: первое повышение стоит 3 монеты, каждое следующее дороже на 2. Уровень повышает шансы ладьи и ферзя; точные вероятности доступны в магазине. В армии не больше восьми фигур вместе с королём. Продажа возвращает номинальную стоимость фигуры, но не больше цены покупки, короля продать нельзя. Монеты серии используются только в автошахматах. Основные монеты и осколки не расходуются.</p><p>Выберите фигуру и нажмите на клетку или перетащите её. Доступны четыре ближних ряда: 1–4 для белых и 5–8 для чёрных. Пешки не ставятся на крайнюю линию 1 или 8. Рокировка доступна только с обычных исходных клеток. Все покупки нужно расставить перед боем. Взятие первым ходом разрешено. Если материала недостаточно для мата, в том числе при королях и слонах только на клетках одного цвета, бой сразу заканчивается ничьей.</p><p>Бой длится до 30 секунд или 60 полных ходов (120 полуходов). По любому лимиту — ничья, независимо от перевеса. Победу даёт только мат. При скрытии приложения или выходе бой сохраняется на паузе; подготовка не ограничена по времени.</p><p>На следующий бой выдаются монеты серии: 5 за победу, 3 за ничью, 2 за поражение. Они не переводятся в основной кошелёк. Уровень магазина сам по себе доход не увеличивает. Армия соперника развивается по номеру боя с бюджетом до 24. Сохранённые забеги прежних версий сохраняют прежний магазин и доход. Все купленные фигуры восстанавливаются, превращённые пешки снова становятся пешками. Результаты не влияют на рейтинг, календарь и статистику обычных партий. Награда за серию в основном кошельке: 3 монеты за победу и 1 за каждую из первых пяти ничьих, максимум 30 монет за всю серию. Монеты сохраняются по мере завершения боёв; итоговое окно показывает общую сумму. Награда сохраняется при выходе и не начисляется повторно. За незавершённый бой и техническое прерывание награды нет.</p>');
export const mountAutochess=({root,exitButton,equipped,showModal,onExit,toast,createId,award,storage=localStorage})=>{
 let run=null,selected=null,disposed=false,hasLock=false,releaseLock=null,message='',shownResult=null,lastFen=null,lastPreparation=null,lastMoves=0,replay=null,replayId=null,replayPly=0,lastReplayMove=null;
 const icon=type=>pieceSVG(type,run.color,itemById(equipped.pieces[type])?.style);
 root.innerHTML='<div class="autochess-surface"><p id="auto-loading" role="status">Загружаем серию…</p><div id="auto-content" hidden><div class="auto-hud"><strong id="auto-round"></strong><span id="auto-resource"></span></div><p id="auto-side" class="auto-secondary"></p><div id="auto-board" class="board" role="group" aria-label="Автошахматы — расстановка и бой"></div><div id="auto-action"></div><p id="auto-status" class="auto-status" role="status"></p><div class="auto-sidebar"><div id="auto-shop"></div></div></div></div>';
 const board=root.querySelector('#auto-board'),shop=root.querySelector('#auto-shop'),actions=root.querySelector('#auto-action'),modal=document.querySelector('#modal');
 const save=next=>{if(!hasLock)return false;try{storage.setItem(AUTO_KEY,JSON.stringify(next));run=next;return true;}catch{return false;}};
 const error=text=>{message=text;draw();};
 const controller=createBattleController({getRun:()=>run,save,onChange:()=>draw(),onError:error});
 const mutate=next=>{if(next===run)return;if(!save(next)){message='Не удалось сохранить изменения. Проверьте свободное место.';}else message='';draw();};
 const resultTitle=()=>run.battle.result.winner===null?'Ничья':run.battle.result.winner===run.color?'Победа':'Поражение';
 const rewardError='<p role="alert">Не удалось сохранить награду. Повторите попытку.</p><button class="primary" data-auto-retry>Сохранить награду</button>';
 const rewardStep=()=>{
  const reward=award(run);
  return {html:`<div id="auto-reward"><h2>Награда за серию</h2>${reward.saved?statCard(reward.total,'Монеты'):rewardError}<button class="primary" data-auto-next ${reward.saved?'':'disabled'}>Завершить серию</button></div>`,options:{closeLabel:'Посмотреть доску'}};
 };
 const presentResult=()=>{
  if(disposed||run.phase!=='result'||shownResult===run.battle.id)return;
  shownResult=run.battle.id;
  const final=seriesFinished(run),reward=award(run);
  if(final){
   const totals=`<div class="auto-results">${statCard(run.results.filter(row=>row.outcome==='win').length,'Победы')}${statCard(run.results.filter(row=>row.outcome==='draw').length,'Ничьи')}${statCard(run.results.filter(row=>row.outcome==='loss').length,'Поражения')}</div>`;
   void showModal(`<div id="auto-result"><h2>Серия завершена</h2>${totals}</div>`,{closeLabel:'Далее',closeVariant:'primary',next:rewardStep});
  }else actions.innerHTML=`${reward.saved?`<p class="auto-reward">+${reward.coins} ${plural(reward.coins,['монета','монеты','монет'])}</p>`:rewardError}<button class="primary" data-auto-next ${reward.saved?'':'disabled'}>К следующему бою</button>`;
 };
 const hud=()=>{
  if(!run)return;
  root.querySelector('#auto-round').textContent=`Бой ${run.round}`;
  root.querySelector('#auto-resource').textContent=run.phase==='preparation'?'':`${Math.ceil((AUTO.duration-(controller.isActive()?controller.elapsed():run.battle.elapsed))/1000)} с · ${Math.ceil(run.battle.moves.length/2)} / 60`;
 };
 const draw=()=>{
  if(disposed||!run)return;
  root.querySelector('#auto-loading').hidden=true;root.querySelector('#auto-content').hidden=false;
  hud();const preparation=run.phase==='preparation',playing=controller.isActive(),warming=controller.isPreparing();
  root.querySelector('#auto-side').textContent=`Победы ${run.results.filter(row=>row.outcome==='win').length} / ${AUTO.wins} · Поражения ${run.results.filter(row=>row.outcome==='loss').length} / ${AUTO.losses} · Вы — ${run.color==='w'?'белые':'чёрные'}`;
  let game;
  if(preparation){game=new Chess(setupFen(run));replay=null;replayId=null;lastReplayMove=null;}
  else {
   if(!replay||replayId!==run.battle.id||replayPly>run.battle.moves.length){replay=new Chess(run.battle.initialFen);replayId=run.battle.id;replayPly=0;lastReplayMove=null;}
   for(;replayPly<run.battle.moves.length;replayPly++){const move=run.battle.moves[replayPly];lastReplayMove=replay.move({from:move.slice(0,2),to:move.slice(2,4),...(move[4]?{promotion:move[4]}:{})});}
   game=replay;
  }
  const fen=game.fen();
  const focused=document.activeElement?.dataset.autoPiece;
  if(lastFen!==fen||preparation||lastPreparation!==preparation){
   board.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
   const before=snapshotBoard(board);
   renderBoard(board,{board:()=>game.board().map(row=>row.map(piece=>preparation&&piece?.color!==run.color?null:piece)),history:()=>[],turn:()=>game.turn(),isCheck:()=>!preparation&&game.isCheck()},equipped,null,run.color);
   const moved=!preparation&&run.battle.moves.length===lastMoves+1;
   if(moved)void animateTransition(board,animationMoves(lastReplayMove),before,motionDuration.autoBoard);
   lastFen=fen;lastPreparation=preparation;lastMoves=run.battle?.moves.length||0;
  }
  board.setAttribute('aria-disabled',String(!preparation));
  const piece=run.army.find(piece=>piece.id===selected),allowed=piece?placementSquares(piece.type,run.color):[];
  board.querySelectorAll('[data-square]').forEach(cell=>{
   const own=run.army.find(piece=>piece.square===cell.dataset.square);
   cell.setAttribute('aria-disabled',String(!preparation));cell.draggable=preparation&&!!own;
   cell.classList.toggle('auto-place',preparation&&allowed.includes(cell.dataset.square)&&!run.army.some(other=>other.id!==selected&&other.square===cell.dataset.square));
   cell.classList.toggle('selected',preparation&&own?.id===selected);
  });
  const reason=preparation?setupError(run):'';
  root.querySelector('#auto-status').textContent=message||(preparation?(reason||(run.army.length===1?'Добавьте фигуры к королю':piece?'Выберите выделенную клетку':'')):warming?'Готовим движок…':playing?'Бой идёт автоматически':run.phase==='result'?`${resultTitle()} · ${run.battle.result.reason}`:'Бой на паузе. Можно продолжить.');
  shop.hidden=!preparation;
  if(preparation){
   shop.innerHTML=`<div class="auto-army" aria-label="Ваша армия">${run.army.map(piece=>`<button data-auto-piece="${piece.id}" draggable="true" aria-pressed="${piece.id===selected}" aria-label="${PIECE_NAMES[piece.type]}, ${piece.square||'не расставлена'}">${icon(piece.type)}<span>${piece.square||'На поле'}</span></button>`).join('')}</div><div class="auto-selection">${piece?`<span>${PIECE_NAMES[piece.type]} · ${piece.square||'не расставлена'}</span>${piece.type!=='k'?`<button class="primary" data-auto-sell="${piece.id}">Продать · ${salePrice(piece)}</button>`:`<span>${run.army.length} / ${AUTO.maxPieces}</span>`}`:`<span>Выберите фигуру</span><span>${run.army.length} / ${AUTO.maxPieces}</span>`}</div><div class="auto-section-title"><h2>Магазин</h2><strong id="auto-coins" aria-label="Монеты серии">${run.reserve} ${plural(run.reserve,['монета','монеты','монет'])}</strong></div><div class="auto-catalog">${['p','n','b','r','q'].map(type=>`<button data-auto-buy="${type}" ${run.reserve<PRICES[type]||run.army.length>=AUTO.maxPieces?'disabled':''} aria-label="Купить: ${PIECE_NAMES[type]}, монеты серии ${PRICES[type]}">${icon(type)}<span>${PIECE_NAMES[type]}</span><strong>${PRICES[type]}</strong></button>`).join('')}</div>`;
   if(run.version===4){
    shop.querySelector('.auto-catalog').outerHTML=`<div class="auto-shop-actions"><button class="primary" data-auto-random ${run.reserve<purchasePrice(run)||run.army.length>=AUTO.maxPieces?'disabled':''}>Купить фигуру · ${purchasePrice(run)}</button><button data-auto-level ${run.level>=10||run.reserve<levelPrice(run)?'disabled':''}>${run.level>=10?'Максимальный уровень':`Повысить уровень · ${levelPrice(run)}`}</button></div><p>Уровень магазина ${run.level} / 10</p><details><summary>Шансы фигур</summary><p>${Object.entries(shopOdds(run.level)).map(([type,chance])=>`${PIECE_NAMES[type]} — ${chance}%`).join(' · ')}</p></details>`;
   }else shop.insertAdjacentHTML('beforeend','<p class="auto-secondary">Сохранённый забег: прежний магазин. Новый магазин доступен в новой игре.</p>');
   if(focused)shop.querySelector(`[data-auto-piece="${focused}"]`)?.focus({preventScroll:true});
  }
  const label=preparation?'Начать бой':run.phase==='result'?'Результат боя':warming?'Готовим движок…':playing?'Бой идёт':'Продолжить бой';
  if(run.phase!=='result'||seriesFinished(run))actions.innerHTML=`<button id="auto-start" class="primary" ${reason||playing||warming?'disabled':''}>${label}</button>`;
  presentResult();
 };
 const start=()=>{
  message='';
  if(run.phase==='result'){shownResult=null;presentResult();return;}
  if(run.phase==='preparation'){const next=beginBattle(run);if(next===run)return;if(!save(next)){error('Не удалось сохранить начало боя');return;}}
  void controller.start();
 };
 root.onclick=event=>{
  if(!hasLock||!run)return;
  const target=event.target.closest('button');if(!target)return;
  if(target.matches('[data-auto-next],[data-auto-retry]')){void next(event);return;}
  if(target.id==='auto-start'){start();return;}
  if(run.phase!=='preparation')return;
  if(target.hasAttribute('data-auto-random')){const updated=buyRandomPiece(run);if(updated!==run)selected=updated.army.at(-1).id;mutate(updated);}
  else if(target.hasAttribute('data-auto-level'))mutate(upgradeShop(run));
  else if(target.dataset.autoBuy){const next=buyPiece(run,target.dataset.autoBuy);if(next!==run)selected=next.army.at(-1).id;mutate(next);}
  else if(target.dataset.autoSell){const next=sellPiece(run,target.dataset.autoSell);selected=null;mutate(next);}
  else if(target.dataset.autoPiece){selected=target.dataset.autoPiece;draw();}
  else if(target.dataset.square){
   const square=target.dataset.square,own=run.army.find(piece=>piece.square===square);
   if(own){selected=own.id;draw();}else if(selected)mutate(placePiece(run,selected,square));
  }
 };
 root.ondragstart=event=>{
  if(run?.phase!=='preparation')return;
  const target=event.target.closest('button');selected=target?.dataset.autoPiece||run.army.find(piece=>piece.square===target?.dataset.square)?.id;
  if(!selected){event.preventDefault();return;}event.dataTransfer.setData('text/plain',selected);event.dataTransfer.effectAllowed='move';
  // Do not replace the dragged node until dragend.
 };
 board.ondragover=event=>{if(run?.phase==='preparation')event.preventDefault();};
 board.ondrop=event=>{event.preventDefault();const square=event.target.closest('[data-square]')?.dataset.square;if(square&&selected)mutate(placePiece(run,selected,square));};
 const next=async event=>{
  const choice=event.target.closest('[data-auto-exit]')?.dataset.autoExit;
  if(choice){
   if(choice==='discard'){try{storage.removeItem(AUTO_KEY);}catch{toast('Не удалось удалить сохранение',{error:true});return;}}
   else if(!save(run)){toast('Не удалось сохранить забег',{error:true});return;}
   await showModal.close();if(!disposed)onExit();return;
  }
  if(event.target.closest('[data-auto-retry]')){
   if(run?.phase!=='result')return;
   if(seriesFinished(run)){const step=rewardStep();void showModal(step.html,step.options);}
   else {shownResult=null;presentResult();}
   return;
  }
  if(!event.target.closest('[data-auto-next]')||run?.phase!=='result')return;
  if(!award(run).saved){toast('Не удалось сохранить награду',{error:true});return;}
  if(seriesFinished(run)){
   try{storage.removeItem(AUTO_KEY);}catch{error('Не удалось завершить серию');return;}
   await showModal.close();if(!disposed)onExit();
  }else{
   const updated=nextRound(run);if(!save(updated)){toast('Не удалось сохранить следующий бой',{error:true});return;}
   selected=null;message='';draw();
  }
 };
 modal.addEventListener('click',next);
 const requestExit=()=>{
  if(!run||!hasLock){onExit();return;}
  if(run.phase==='result'&&!award(run).saved){shownResult=null;presentResult();return;}
  if(!controller.pause())return;
  void showModal('<h2>Выйти из автошахмат?</h2><p>Сохраните забег, чтобы продолжить позже, или удалите его для новой игры. Уже начисленные монеты останутся.</p><button class="primary" data-auto-exit="save">Сохранить и выйти</button><button class="danger" data-auto-exit="discard">Выйти без сохранения</button>',{closeLabel:'Продолжить игру'});
 };
 exitButton.onclick=requestExit;
 const hidden=()=>{if(document.hidden)controller.pause();};
 const pagehide=()=>controller.pause();
 document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pagehide);
 const interval=setInterval(hud,100);
 const acquire=async()=>{
  if(!navigator.locks){root.querySelector('#auto-loading').textContent='Для безопасного сохранения серии обновите браузер.';return;}
  await navigator.locks.request(AUTO_KEY,{ifAvailable:true},async lock=>{
   if(disposed)return;
   if(!lock){root.querySelector('#auto-loading').textContent='Серия открыта в другом окне. Закройте её там и откройте снова.';return;}
   hasLock=true;
   try{run=restoreAutoRun(storage.getItem(AUTO_KEY))||createAutoRun(createId());if(!save(run))throw Error('Не удалось сохранить серию');draw();}
   catch(error){root.querySelector('#auto-loading').hidden=false;root.querySelector('#auto-loading').textContent=error.message;hasLock=false;return;}
   await new Promise(resolve=>{releaseLock=resolve;});hasLock=false;
  });
 };
 void acquire().catch(error=>{if(!disposed)root.querySelector('#auto-loading').textContent=error.message;});
 return {requestExit,dispose:()=>{controller.pause();disposed=true;controller.dispose();clearInterval(interval);replay=null;lastReplayMove=null;run=null;releaseLock?.();modal.removeEventListener('click',next);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide);board.getAnimations({subtree:true}).forEach(animation=>animation.cancel());root.replaceChildren();}};
};
