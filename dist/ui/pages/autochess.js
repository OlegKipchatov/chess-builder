import {AUTO,armyCapacity,AUTO_KEY,PRICES,createAutoRun,buyPiece,sellPiece,placePiece,placementSquares,setupFen,setupError,beginBattle,nextRound,restoreAutoRun,seriesFinished,buyRandomPiece,upgradeShop,purchasePrice,levelPrice,shopOdds,salePrice,roundIncome,benchPiece} from '../../autochess.js?v=97';
import {createBattleController} from '../../autochess-battle.js?v=97';
import {createAutoplaySession} from '../../autochess-engine.js?v=97';
import {Chess} from '../../chess.js?v=97';
import {renderBoard,snapshotBoard,animateTransition,animationMoves,clearBoardTransition} from '../../board.js?v=97';
import {motionDuration} from '../motion.js?v=97';
import {pieceSVG} from '../../pieces.js?v=97';
import {PIECE_NAMES,itemById} from '../../catalog.js?v=97';
import {disclosure,statCard,plural} from '../primitives.js?v=97';
const shopIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const levelIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m5 13 7-7 7 7M12 6v14"/></svg>';
const oddsFAQ=()=>'<div class="auto-odds-table"><table><caption>Шансы фигур по уровню магазина</caption><thead><tr><th>Уровень</th><th>Пешка</th><th>Конь</th><th>Слон</th><th>Ладья</th><th>Ферзь</th></tr></thead><tbody>'+Array.from({length:10},(_,i)=>'<tr><th>'+(i+1)+'</th>'+Object.values(shopOdds(i+1)).map(n=>'<td>'+n+'%</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
export const autochessEntry=()=>`<section id="autochess-entry" class="autochess-entry"><h2>Автошахматы</h2><button id="autochess-open" class="primary">Играть</button></section>`;
export const autochessFAQ=()=>disclosure('Как играть в автошахматы?','<p>Серия идёт до десяти побед или трёх поражений. Ничья не приближает ни к победе в серии, ни к её завершению. Вы покупаете армию и расставляете её, а Stockfish играет за обе стороны с одинаковыми настройками, без адаптации к рейтингу. Король, шах, мат и обычные шахматные правила сохраняются. Ваш цвет известен заранее. Фигуры соперника открываются только после начала боя; белые ходят первыми.</p><p>В начале доступны король и 3 монеты серии. Кнопка покупки даёт случайную фигуру: первая стоит 1 монету, каждая следующая дороже на 1 до конца забега. У магазина 10 уровней: первое повышение стоит 3 монеты, каждое следующее дороже на 2. Уровень повышает шансы ладьи и ферзя; точные вероятности приведены в таблице ниже. На первом уровне в армии помещаются 8 фигур вместе с королём. Каждое повышение уровня добавляет одно место, максимум — 16 на уровнях 9 и 10. Фигуры в запасе тоже занимают место. Вместимость соперника зависит от его собственного уровня по тому же правилу. Продажа возвращает 50% цены покупки с округлением вниз, но не меньше 1 монеты, короля продать нельзя. Монеты серии используются только в автошахматах. Основные монеты и осколки не расходуются.</p><p>Выберите фигуру и нажмите на клетку или перетащите её. Доступны четыре ближних ряда: 1–4 для белых и 5–8 для чёрных. Пешки не ставятся на крайнюю линию 1 или 8. Рокировка доступна только с обычных исходных клеток. Двойной клик или двойное касание по фигуре снимает её с поля в запас; её можно вернуть позже; она остаётся вашей и занимает место в армии. Король перед боем должен быть на поле. Повторное нажатие на выбранную фигуру или Escape снимает выбор. При смене цвета расположение относительно вас сохраняется. Взятие первым ходом разрешено. Если материала недостаточно для мата, в том числе при королях и слонах только на клетках одного цвета, бой сразу заканчивается ничьей.</p><p>Бой длится до 30 секунд или 60 полных ходов (120 полуходов). По любому лимиту — ничья, независимо от перевеса. Победу даёт только мат. При скрытии приложения или выходе бой сохраняется на паузе; подготовка не ограничена по времени.</p><p>На следующий бой выдаются монеты серии: 5 за победу, 3 за ничью, 2 за поражение. Они не переводятся в основной кошелёк. Каждый уровень выше первого добавляет 1 монету к доходу: например, на уровне 3 победа даёт 7, ничья — 5, поражение — 4. Учитывается уровень на момент завершения боя. Соперник сохраняет армию и ведёт собственный бюджет по тем же правилам: покупает случайные фигуры, повышает уровень магазина, копит монеты и продаёт фигуры за 50% цены покупки, минимум за 1 монету. Он самостоятельно расставляет армию, не видя вашу расстановку. Количество покупок ограничено монетами и местом в армии. Сохранённые забеги прежних версий сохраняют прежний магазин и доход. Все купленные фигуры восстанавливаются, превращённые пешки снова становятся пешками. Результаты не влияют на рейтинг, календарь и статистику обычных партий. Награда за серию в основном кошельке: 3 монеты за победу и 1 за каждую из первых пяти ничьих, максимум 30 монет за всю серию. Монеты сохраняются по мере завершения боёв; итоговое окно показывает общую сумму. Награда сохраняется при выходе и не начисляется повторно. За незавершённый бой и техническое прерывание награды нет.</p>'+oddsFAQ());
export const mountAutochess=({root,exitButton,equipped,showModal,onExit,toast,createId,award,storage=localStorage})=>{
 let run=null,selected=null,disposed=false,hasLock=false,releaseLock=null,message='',shownResult=null,lastFen=null,lastPreparation=null,lastMoves=0,replay=null,replayId=null,replayPly=0,lastReplayMove=null;
 const icon=type=>pieceSVG(type,run.color,itemById(equipped.pieces[type])?.style);
 root.innerHTML='<div class="autochess-surface"><p id="auto-loading" role="status">Загружаем серию…</p><div id="auto-content" hidden><div class="auto-hud"><strong id="auto-round"></strong><span id="auto-resource"></span></div><p id="auto-side" class="auto-secondary"></p><div id="auto-board" class="board" role="group" aria-label="Автошахматы — расстановка и бой"></div><div id="auto-action"></div><p id="auto-status" class="auto-status" role="status"></p><div class="auto-sidebar"><div id="auto-shop"></div></div></div></div>';
 const board=root.querySelector('#auto-board'),shop=root.querySelector('#auto-shop'),actions=root.querySelector('#auto-action'),modal=document.querySelector('#modal');
 const save=next=>{if(!hasLock)return false;try{storage.setItem(AUTO_KEY,JSON.stringify(next));run=next;return true;}catch{return false;}};
 const error=text=>{message=text;draw();};
 const engineSession=createAutoplaySession();
 const controller=createBattleController({getRun:()=>run,save,onChange:()=>draw(),onError:error,engineFactory:engineSession.create});
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
  }else actions.innerHTML=`${reward.saved?'':rewardError}<button class="primary" data-auto-next ${reward.saved?'':'disabled'}>К следующему бою</button>`;
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
  if(preparation){game={fen:()=>JSON.stringify(run.army)+run.color,board:()=>Array.from({length:8},(_,r)=>[...'abcdefgh'].map(file=>{const piece=run.army.find(piece=>piece.square===file+(8-r));return piece?{...piece,color:run.color}:null;})),turn:()=>run.color,isCheck:()=>false};replay=null;replayId=null;lastReplayMove=null;}
  else {
   if(!replay||replayId!==run.battle.id||replayPly>run.battle.moves.length){replay=new Chess(run.battle.initialFen);replayId=run.battle.id;replayPly=0;lastReplayMove=null;}
   for(;replayPly<run.battle.moves.length;replayPly++){const move=run.battle.moves[replayPly];lastReplayMove=replay.move({from:move.slice(0,2),to:move.slice(2,4),...(move[4]?{promotion:move[4]}:{})});}
   game=replay;
  }
  const fen=game.fen();
  const focused=document.activeElement?.dataset.autoPiece;
  if(lastFen!==fen||preparation||lastPreparation!==preparation){
   clearBoardTransition(board);
   const before=snapshotBoard(board);
   renderBoard(board,{board:()=>game.board().map(row=>row.map(piece=>preparation&&piece?.color!==run.color?null:piece)),history:()=>[],turn:()=>game.turn(),isCheck:()=>!preparation&&game.isCheck()},equipped,null,run.color);
   const moved=!preparation&&run.battle.moves.length===lastMoves+1;
   if(moved)void animateTransition(board,animationMoves(lastReplayMove),before,motionDuration.autoBoard);
   lastFen=fen;lastPreparation=preparation;lastMoves=run.battle?.moves.length||0;
  }
  if(board.getAttribute('aria-disabled')!==String(!preparation))board.setAttribute('aria-disabled',String(!preparation));
  const piece=run.army.find(piece=>piece.id===selected),allowed=piece?placementSquares(piece.type,run.color):[];
  board.querySelectorAll('[data-square]').forEach(cell=>{
   const own=run.army.find(piece=>piece.square===cell.dataset.square);
   if(cell.getAttribute('aria-disabled')!==String(!preparation))cell.setAttribute('aria-disabled',String(!preparation));
   if(cell.draggable!==(preparation&&!!own))cell.draggable=preparation&&!!own;
   cell.classList.toggle('auto-place',preparation&&allowed.includes(cell.dataset.square)&&!run.army.some(other=>other.id!==selected&&other.square===cell.dataset.square));
   cell.classList.toggle('selected',preparation&&own?.id===selected);
  });
  const reason=preparation?setupError(run):'';
  root.querySelector('#auto-status').textContent=message||(preparation?reason:warming?'Готовим движок…':playing?'Бой идёт автоматически':run.phase==='result'?`${resultTitle()} · ${run.battle.result.reason}`:'Бой на паузе. Можно продолжить.');
  shop.hidden=!preparation;
  if(preparation){
   const armyNodes=new Map([...shop.querySelectorAll('[data-auto-piece]')].map(node=>[node.dataset.autoPiece,node]));
   shop.innerHTML=`<div class="auto-army" aria-label="Ваша армия">${run.army.map(piece=>`<button data-auto-piece="${piece.id}" draggable="true" aria-pressed="${piece.id===selected}" aria-label="${PIECE_NAMES[piece.type]}, ${piece.square||'не расставлена'}">${icon(piece.type)}<span>${piece.square||'В запасе'}</span></button>`).join('')}</div><div class="auto-selection"><span class="auto-selection-label"><span>${piece?PIECE_NAMES[piece.type]:''}</span><span>${piece?(piece.square||'В запасе'):''}</span></span><button class="primary ${piece&&piece.type!=='k'?'':'auto-sale-placeholder'}" ${piece&&piece.type!=='k'?`data-auto-sell="${piece.id}"`:'disabled aria-hidden="true" tabindex="-1"'}>Продать · ${piece&&piece.type!=='k'?salePrice(piece):1}</button></div><div class="auto-section-title"><h2>Магазин</h2><strong id="auto-coins" aria-label="Монеты серии">${run.reserve} ${plural(run.reserve,['монета','монеты','монет'])}</strong></div><div class="auto-catalog">${['p','n','b','r','q'].map(type=>`<button data-auto-buy="${type}" ${run.reserve<PRICES[type]||run.army.length>=armyCapacity(run)?'disabled':''} aria-label="Купить: ${PIECE_NAMES[type]}, монеты серии ${PRICES[type]}">${icon(type)}<span>${PIECE_NAMES[type]}</span><strong>${PRICES[type]}</strong></button>`).join('')}</div>`;
   if(run.version===4){
    shop.querySelector('.auto-catalog').outerHTML=`<div class="auto-shop-actions"><button class="primary" data-auto-random ${run.reserve<purchasePrice(run)||run.army.length>=armyCapacity(run)?'disabled':''}>${shopIcon}<span>${run.army.length>=armyCapacity(run)?'Армия заполнена':`Фигура · ${purchasePrice(run)}`}</span></button><button class="auto-level-outlined" data-auto-level ${run.level>=10||run.reserve<levelPrice(run)?'disabled':''}>${levelIcon}<span>${run.level>=10?'Уровень':`Уровень · ${levelPrice(run)}`}</span></button></div>`;
   }
   shop.querySelectorAll('[data-auto-piece]').forEach(node=>{
    const old=armyNodes.get(node.dataset.autoPiece);if(!old)return;
    for(const name of ['aria-label','aria-pressed'])old.setAttribute(name,node.getAttribute(name));
    if(old.innerHTML!==node.innerHTML)old.innerHTML=node.innerHTML;
    node.replaceWith(old);
   });
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
  const target=event.target.closest('button');if(!target){if(selected&&run.phase==='preparation'){selected=null;draw();}return;}
  if(target.matches('[data-auto-next],[data-auto-retry]')){void next(event);return;}
  if(target.id==='auto-start'){start();return;}
  if(run.phase!=='preparation')return;
  if(target.hasAttribute('data-auto-random')){const updated=buyRandomPiece(run);if(updated!==run)selected=updated.army.at(-1).id;mutate(updated);}
  else if(target.hasAttribute('data-auto-level'))mutate(upgradeShop(run));
  else if(target.dataset.autoBuy){const next=buyPiece(run,target.dataset.autoBuy);if(next!==run)selected=next.army.at(-1).id;mutate(next);}
  else if(target.dataset.autoSell){const next=sellPiece(run,target.dataset.autoSell);selected=null;mutate(next);}
  else if(target.dataset.autoBench){mutate(benchPiece(run,target.dataset.autoBench));}
  else if(target.dataset.autoPiece){selected=selected===target.dataset.autoPiece?null:target.dataset.autoPiece;draw();}
  else if(target.dataset.square){
   const square=target.dataset.square,own=run.army.find(piece=>piece.square===square);
   if(own){selected=selected===own.id?null:own.id;draw();}else if(selected)mutate(placePiece(run,selected,square));
  }
 };
 root.ondblclick=event=>{
  if(run?.phase!=='preparation')return;
  const target=event.target.closest('button');
  const id=target?.dataset.autoPiece||run.army.find(piece=>piece.square===target?.dataset.square)?.id;
  if(!id)return;event.preventDefault();selected=null;mutate(benchPiece(run,id));
 };
 root.onkeydown=event=>{if(event.key==='Escape'&&run?.phase==='preparation'&&selected){event.preventDefault();selected=null;draw();}};
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
  if(!controller.pause())return;engineSession.dispose();
  void showModal('<h2>Выйти из автошахмат?</h2><p>Сохраните забег, чтобы продолжить позже, или удалите его для новой игры. Уже начисленные монеты останутся.</p><button class="primary" data-auto-exit="save">Сохранить и выйти</button><button class="danger" data-auto-exit="discard">Выйти без сохранения</button>',{closeLabel:'Продолжить игру'});
 };
 exitButton.onclick=requestExit;
 const hidden=()=>{if(document.hidden){controller.pause();engineSession.dispose();}};
 const pagehide=()=>{controller.pause();engineSession.dispose();};
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
 return {requestExit,dispose:()=>{controller.pause();disposed=true;controller.dispose();engineSession.dispose();clearInterval(interval);replay=null;lastReplayMove=null;run=null;releaseLock?.();modal.removeEventListener('click',next);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide);clearBoardTransition(board);root.replaceChildren();}};
};
