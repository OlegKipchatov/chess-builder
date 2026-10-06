import {PVE,NODES,activeArmy,frontier,isUnlocked,campaignComplete,strengthLabel,encounter,maxHp,damage,xpThreshold,useStone,toggleUnit,evolveUnit} from '../../pve-model.js?v=113';
import {formation,beginPveBattle,playPveAction,resignPve,returnToMap,pveBoardAdapter,unitAt,movesFor,allMoves} from '../../pve-battle.js?v=113';
import {renderBoard,snapshotBoard,animateTransition,clearBoardTransition} from '../../board.js?v=113';
import {pieceSVG} from '../../pieces.js?v=113';
import {PIECE_NAMES,itemById} from '../../catalog.js?v=113';
import {disclosure,statCard,backIcon} from '../primitives.js?v=113';
import {motionDuration,motionEasing} from '../motion.js?v=113';
const pathIcon='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 40c-7-13 31-9 24-22S15 17 18 6" stroke-dasharray="4 4"/><circle cx="10" cy="40" r="3"/><path d="M18 6h13l-3 5 3 5H18M18 6v17"/></svg>';
const stoneIcon='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m10 4 13 3 5 14-13 8L4 18Z M10 4l5 25M23 7 4 18l24 3M10 4l18 17"/></svg>';
const coreIcon='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 11 6.5v13L16 29 5 22.5v-13Z"/><circle cx="16" cy="16" r="5"/><path d="M16 3v5M27 9.5l-4.3 2.5M27 22.5 22.7 20M16 29v-5M5 22.5 9.3 20M5 9.5 9.3 12"/></svg>';
const name = unit => `${PIECE_NAMES[unit.type]} · ${unit.id.replace('pve-unit-','№ ')}`;
const stat = (value,label) => `<span><strong>${value}</strong> ${label}</span>`;
export const pveEntry = () => `<section id="pve-entry" class="pve-entry"><div class="pve-entry-icon">${pathIcon}</div><div><span class="pve-eyebrow">PvE · Первая глава</span><h2>Поход</h2><p>Развивайте армию и дойдите до Стража крепости.</p></div><button id="pve-open" class="primary">В поход</button></section>`;
export const pveFAQ = () => [
 disclosure('Как играть в PvE-поход?', '<p>Вы играете белыми. У каждой фигуры есть уровень, опыт, HP и урон. Атака снимает HP: если цель выжила, атакующий остаётся на месте, а ход переходит сопернику. Автоматического ответного урона нет. Фигуры равного уровня побеждают друг друга одной атакой.</p><p>Бой заканчивается при гибели короля. Шаха, мата, рокировки и взятия на проходе нет. Пешка может сделать первый двойной ход со второй горизонтали, если путь свободен. На последней горизонтали она становится ферзём только до конца боя. Троекратное повторение, отсутствие ходов или 120 полных ходов завершают бой вничью.</p><p>На развилке достаточно победить одного соперника. Пройденные участки доступны повторно. Сила соперника учитывает активную армию и диапазон участка; состав виден до боя.</p><p>После боя показываются результат, награды, затем отдельный шаг с прогрессом опыта фигур; после закрытия — карта. Каждый ход сохраняется на устройстве. Бой можно приостановить и продолжить позже, в том числе без сети после полной установки приложения.</p>'),
 disclosure('Как развивать армию в походе?', '<p>В новой армии все фигуры первого уровня. Выбирайте 8 из 10 бойцов, включая короля. Заработанные уровни и опыт сохраняются между боями. Опыт получает фигура, победившая противника; выжившие получают небольшой бонус за выигранный бой.</p><p>После боя все фигуры возвращаются с полным HP. Гибель отнимает часть порога опыта текущего уровня: пешка — 12%, конь, слон и король — 16%, ладья — 20%, ферзь — 25%. Потерять можно не больше одного уровня.</p><p>Камень опыта из рюкзака даёт выбранной фигуре 10% порога её уровня. Применяйте предметы в разделе «Армия». Сначала доступна прокачка до уровня 3. Первая победа над боссом открывает уровень 5 и даёт ядро для эволюции одной пешки в ладью. Эволюция сохраняет уровень, опыт и историю фигуры. Повторная победа над боссом не даёт ещё одно ядро.</p>'),
 disclosure('Какие награды даёт поход?', '<p>За обычный бой: победа — 12–17 монет и 2–3 камня опыта, ничья — 8–13 монет и 1–2 камня, поражение — 5–10 монет и 1 камень. За бой с боссом: победа — 23–33 монеты, ничья — 15–25, поражение — 10–20; диапазоны камней те же.</p><p>Количество случайное в указанных пределах и сохраняется: перезагрузка не меняет награду. Первая победа дополнительно даёт 5 монет и 1 камень; на Каменной заставе — 6 монет и 2 камня; над боссом — 10 монет, 3 камня и ядро эволюции. Дневного лимита монет нет.</p><p>Сдача до 10 ходов игрока не даёт монет, но приносит 1 камень опыта. Поздняя сдача даёт награду за поражение. Полученный в бою опыт и штрафы за погибшие фигуры сохраняются. Поход не меняет рейтинг, обычную историю партий и календарь.</p>'),
].join('');
export const mountPve = ({root,exitButton,equipped,getProfile,commit,showModal,toast,onExit,onTitle}) => {
 let profile=getProfile(),view='map',selected=null,armySelected=null,selectedNode=null,disposed=false,presenting=false,worker=null,workerTimer=null,requestId=0,botError=false,modalKind=null,resultShownId=null,presentationGeneration=0,scrollPositions={map:0,army:0,bag:0};
 const modal=document.querySelector('#modal');
 const icon = (unit,color='w') => pieceSVG(unit.type,color,itemById(equipped.pieces[unit.type])?.style);
 const title = () => view==='battle'?'Бой · PvE':'Поход';
 const stopWorker = () => {requestId++;clearTimeout(workerTimer);worker?.terminate();worker=null;};
 const save = transform => {
  if(disposed)return false;
  const result=commit(profile.revision,transform);
  if(!result.saved){
   if(result.conflict){profile=result.pve;stopWorker();view=profile.battle?'battle':'map';presenting=false;render();toast('Прогресс изменился в другой вкладке. Загружена последняя версия.',{error:true});}
   else toast('Не удалось сохранить ход. Проверьте свободное место и повторите действие.',{error:true});
   return false;
  }
  profile=result.pve;return true;
 };
 const go = (next,{front=false}={}) => {
  scrollPositions[view]=window.scrollY;view=next;selected=null;render();
  if(next==='map'&&front)scrollFrontier();else window.scrollTo({top:scrollPositions[next]||0,behavior:'instant'});
 };
 const scrollFrontier = () => {
  const target=root.querySelector(`[data-pve-step="${frontier(profile)}"]`);
  if(target){const top=target.getBoundingClientRect().top+window.scrollY-(document.querySelector('header')?.getBoundingClientRect().height||68)-100;window.scrollTo({top:Math.max(0,top),behavior:'instant'});}
 };
 const mapHTML = () => `<div class="pve-page pve-map">
  <div class="pve-chapter"><div><span class="pve-eyebrow">Глава I</span><h2>Дорога к крепости</h2></div><span class="pve-meta">${campaignComplete(profile)?'Пройдена':`${Math.min(5,frontier(profile)-1)} / 6 этапов`}</span></div>
  ${profile.battle?`<button class="primary" data-pve-action="resume">${profile.battle.phase==='result'?'Результат боя':'Продолжить бой'}</button>`:''}
  <p class="pve-note">${campaignComplete(profile)?'Страж побеждён. Открыт уровень 5 и первая эволюция. Можно вернуться к любому бою.':'Выберите бой на дороге. Победы открывают путь, босс — новые уровни армии.'}</p>
  <div class="pve-road"><svg class="pve-road-line" viewBox="0 0 400 720" preserveAspectRatio="none" aria-hidden="true"><path d="M155 55C155 115 250 105 250 170S200 240 200 295 250 335 250 415 155 465 155 530 200 600 200 665"/></svg><ol class="pve-stops" aria-label="Карта первой главы">${Array.from({length:6},(_,i)=>i+1).map(step=>`<li class="pve-stop ${step===3?'pve-fork':''}" data-pve-step="${step}">${NODES.filter(node=>node.step===step).map(node=>{
   const cleared=profile.cleared.includes(node.id),open=isUnlocked(profile,node),current=step===frontier(profile)&&!campaignComplete(profile);
   return `<button class="pve-node ${cleared?'is-cleared':''} ${current?'is-frontier':''} ${node.boss?'is-boss':''} ${selectedNode===node.id?'is-selected':''}" data-pve-node="${node.id}" ${!open||profile.battle?'disabled':''} aria-label="${node.name}${cleared?', пройдено, доступен повторный бой':open?', бой доступен':', путь закрыт'}" aria-pressed="${selectedNode===node.id}" ${current?'aria-current="step"':''}><span class="pve-node-number" aria-hidden="true">${cleared?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6M8 12l3 3 5-6" stroke-linecap="round" stroke-linejoin="round"/></svg>':node.boss?'♜':step}</span><span class="pve-node-body"><span class="pve-eyebrow">${node.boss?'Босс I':`Монстры · уровень ${node.threat}`}</span><strong>${node.name}</strong><span class="pve-meta">${!open?'Путь закрыт':cleared?'':step===3?'Выберите один путь':'Бой доступен'}</span><span class="pve-node-reward">${node.boss?'23–33 монеты':'12–17 монет'}${!cleared?' · бонус':''}</span></span></button>`;
  }).join('')}</li>`).join('')}</ol></div>
 </div>`;
 const unitHTML = unit => {
  const full=unit.level===profile.levelCap&&unit.xp>=xpThreshold(unit.level)-1,locked=!!profile.battle;
  return `<article class="pve-unit ${!unit.active?'in-reserve':''}"><div class="pve-unit-top"><span class="pve-piece">${icon(unit)}</span><div><h2>${name(unit)}</h2><span class="pve-meta">Уровень ${unit.level} · ${unit.active?'В строю':'Резерв'}</span></div>${unit.type!=='k'?`<button class="quiet pve-unit-toggle" data-pve-toggle="${unit.id}" aria-label="${unit.active?'В резерв':'В строй'}: ${name(unit)}" ${locked||(!unit.active&&activeArmy(profile).length>=8)?'disabled':''}>${unit.active?'В резерв':'В строй'}</button>`:''}</div><div class="pve-unit-stats">${stat(maxHp(unit),'HP')}${stat(damage(unit),'урон')}</div><div class="pve-xp"><progress value="${unit.xp}" max="${xpThreshold(unit.level)}" aria-label="Опыт ${name(unit)}"></progress><span>${unit.xp} / ${xpThreshold(unit.level)} XP</span></div>
  <button class="quiet pve-stone-use" data-pve-stone="${unit.id}" ${!profile.stones||locked||full?'disabled':''}>${full?'Достигнут лимит опыта':`Камень опыта · +${Math.ceil(xpThreshold(unit.level)*.1)} XP`}</button>
  ${unit.type==='p'?`<button class="quiet pve-evolve" data-pve-evolve="${unit.id}" ${!campaignComplete(profile)||!profile.cores||locked?'disabled':''}>Эволюция в ладью · 1 ядро</button>`:''}</article>`;
 };
 const armyLayout = () => formation(activeArmy(profile),'w');
 const armyHTML = () => {
  const chosen=profile.units.find(unit=>unit.id===armySelected)||profile.units.find(unit=>unit.active);armySelected=chosen.id;
  const reserve=profile.units.filter(unit=>!unit.active);
  return `<div class="pve-page pve-army-page"><div class="pve-section-intro"><strong>В строю ${activeArmy(profile).length} / 8</strong><span class="pve-meta">Камни ${profile.stones} · Ядра ${profile.cores}</span></div>${profile.battle?'<p class="pve-note">Состав и прокачка доступны после боя.</p>':''}<div id="pve-army-board" class="board" role="group" aria-label="Стартовая расстановка армии"></div><section class="pve-reserve"><h2>Резерв</h2><div class="pve-reserve-slots">${reserve.map(unit=>`<button class="quiet pve-reserve-unit ${unit.id===armySelected?'is-selected':''}" data-pve-unit="${unit.id}" aria-pressed="${unit.id===armySelected}" aria-label="${name(unit)}, уровень ${unit.level}, резерв"><span>${icon(unit)}</span><small>${unit.level}</small></button>`).join('')}${Array.from({length:Math.max(0,2-reserve.length)},()=>'<span class="pve-reserve-empty" aria-hidden="true"></span>').join('')}</div></section><div id="pve-army-details">${unitHTML(chosen)}</div></div>`;
 };
 const drawArmy = () => {
  const units=armyLayout(),board=root.querySelector('#pve-army-board'),selectedUnit=units.find(unit=>unit.id===armySelected);
  renderBoard(board,{...pveBoardAdapter({units,turn:'w'}),moves:()=>[]},equipped,selectedUnit?.square);
  for(const cell of board.querySelectorAll('[data-square]')){
   const unit=units.find(unit=>unit.square===cell.dataset.square);
   if(Number(cell.dataset.square[1])>4){cell.hidden=true;continue;}
   cell.disabled=!unit;
   if(unit){cell.dataset.pveUnit=unit.id;cell.setAttribute('aria-label',`${cell.dataset.square}, ${name(unit)}, уровень ${unit.level}`);cell.insertAdjacentHTML('beforeend',`<span class="pve-army-level" aria-hidden="true">${unit.level}</span>`);}
  }
  const heading=root.querySelector('#pve-army-details h2');heading.textContent=`${PIECE_NAMES[profile.units.find(unit=>unit.id===armySelected).type]} · ${selectedUnit?.square||'Резерв'}`;
 };
 const bagHTML = () => `<div class="pve-page"><div class="pve-resource"><span>${stoneIcon}</span><div><h2>Камни опыта · ${profile.stones}</h2><p>Добавляют фигуре 10% порога опыта её уровня.</p></div></div><div class="pve-resource"><span>${coreIcon}</span><div><h2>Ядра эволюции · ${profile.cores}</h2><p>Превращают пешку в ладью, сохраняя уровень и опыт.</p></div></div></div>`;
 const navigationHTML = () => `<nav id="pve-nav" aria-label="Разделы похода"><button class="quiet pve-nav-exit" data-pve-action="exit" aria-label="Выйти из похода" title="Выйти из похода">${backIcon}</button>${[
  ['map','Карта',pathIcon],
  ['army','Армия','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 4h8l-1 5 3 10H6L9 9zM9 9h6M5 21h14M12 2v4"/></svg>'],
  ['bag','Рюкзак','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="5" y="6" width="14" height="15" rx="4"/><path d="M9 6V4a3 3 0 0 1 6 0v2M8 13h8v5H8z"/></svg>'],
 ].map(([target,label,image])=>`<button class="secondary ${view===target?'active':''}" data-pve-action="${target}" ${view===target?'aria-current="page"':''}>${image}<span>${label}</span></button>`).join('')}</nav>`;
 const battleHTML = () => `<div class="pve-battle"><div class="pve-battle-top"><span>Вы · белые</span><span>${NODES.find(node=>node.id===profile.battle.nodeId).name}</span></div><div class="pve-turn" id="pve-turn" role="status"></div><div id="pve-board" class="board" role="group" aria-label="Бой PvE"></div><div class="pve-inspect" id="pve-inspect" aria-live="polite"></div><div class="pve-battle-log" id="pve-log" role="status"></div><div class="pve-battle-actions"><button class="quiet" data-pve-action="resign">Сдаться</button></div></div>`;
 const render = () => {
  if(disposed)return;
  onTitle(title());exitButton.setAttribute('aria-label','К карте');exitButton.innerHTML=`${backIcon}<span>К карте</span>`;exitButton.classList.add('pve-back');exitButton.hidden=view!=='battle';if(exitButton.closest('.page-header-start'))exitButton.closest('.page-header-start').hidden=view!=='battle';
  if(view==='battle'&&profile.battle){if(!root.querySelector('#pve-board'))root.innerHTML=battleHTML();drawBattle();}
  else {root.innerHTML=(view==='army'?armyHTML():view==='bag'?bagHTML():mapHTML())+navigationHTML();if(view==='army')drawArmy();}
 };
 const drawBattle = () => {
  const battle=profile.battle,board=root.querySelector('#pve-board');if(!battle||!board)return;
  renderBoard(board,pveBoardAdapter(battle),equipped,selected);
  const locked=presenting||battle.phase!=='playing'||battle.turn!=='w';board.setAttribute('aria-disabled',String(locked));
  for(const cell of board.querySelectorAll('[data-square]')){
   const unit=unitAt(battle,cell.dataset.square);cell.setAttribute('aria-disabled',String(locked));
   cell.querySelector('.pve-vitals')?.remove();
   if(unit){cell.insertAdjacentHTML('beforeend',`<span class="pve-vitals" aria-hidden="true"><span class="pve-level">${unit.level}</span><span class="pve-hp"><i style="width:${100*unit.hp/maxHp(unit)}%"></i></span></span>`);cell.setAttribute('aria-label',`${cell.dataset.square}, ${unit.color==='w'?'ваша':'вражеская'} ${PIECE_NAMES[unit.type]}, уровень ${unit.level}, HP ${unit.hp} из ${maxHp(unit)}, урон ${damage(unit)}${movesFor(battle,unitAt(battle,selected||'')).some(move=>move.to===cell.dataset.square)?', доступный ход':''}`);}
  }
  const own=unitAt(battle,selected||''),status=battle.phase==='result'?'Бой завершён':botError?'Ход ИИ недоступен':battle.turn==='w'?'Ваш ход':'Ход соперника';
  root.querySelector('#pve-turn').textContent=status;
  const inspectContent=own?`<strong>${PIECE_NAMES[own.type]} · уровень ${own.level}</strong><span>HP ${own.hp} / ${maxHp(own)} · Урон ${damage(own)}</span><span class="pve-meta">${own.color==='w'?`Опыт: ${profile.units.find(unit=>unit.id===own.id)?.xp??0} / ${xpThreshold(own.level)} · В бою +${battle.xp[own.id]||0} XP`:'Вражеская фигура'}</span>`:'';
  const inspect=root.querySelector('#pve-inspect');inspect.classList.toggle('has-unit',!!own);
  inspect.innerHTML=`<div class="pve-inspect-size" aria-hidden="true"><strong>Ферзь · уровень 5</strong><span>HP 200 / 200 · Урон 200</span><span class="pve-meta">Опыт: 999 / 999 · В бою +999 XP</span></div><div class="pve-inspect-content">${inspectContent}</div>`;
  const event=battle.lastEvent;root.querySelector('#pve-log').textContent=event?`${event.from} → ${event.to}${event.damage?` · −${event.damage} HP${event.killed?' · фигура повержена':''}`:''}${event.promoted?' · временное превращение в ферзя':''}`:'';
  root.querySelectorAll('.pve-battle-actions button').forEach(button=>button.disabled=battle.phase==='result');
  let retry=root.querySelector('[data-pve-action="retry"]');if(botError&&!retry){root.querySelector('.pve-battle-actions').insertAdjacentHTML('beforeend','<button class="primary" data-pve-action="retry">Повторить ход ИИ</button>');}else if(!botError)retry?.remove();
  if(!presenting)complete();
 };
 const complete = () => {
  const battle=profile.battle;
  if(disposed||view!=='battle'||presenting||battle?.phase!=='result'||!battle.settled||resultShownId===battle.id)return;
  stopWorker();resultShownId=battle.id;modalKind='result';
  const result=battle.result;
  const reason={king:result.outcome==='win'?'Король соперника повержен':'Ваш король повержен',resigned:'Вы сдались',limit:'Достигнут лимит 120 ходов',repetition:'Троекратное повторение', 'no-moves':'Нет доступных ходов'}[result.reason];
  const animateExperience = () => {
   const host=modal.querySelector('#pve-experience');if(!host)return;
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   host.querySelectorAll('.pve-experience-row').forEach(row=>{
    const beforeLevel=Number(row.dataset.beforeLevel),afterLevel=Number(row.dataset.afterLevel),beforeXp=Number(row.dataset.beforeXp),afterXp=Number(row.dataset.afterXp);
    const beforeThreshold=xpThreshold(beforeLevel),afterThreshold=xpThreshold(afterLevel),bar=row.querySelector('.pve-experience-fill'),counter=row.querySelector('.pve-experience-count'),level=row.querySelector('.pve-experience-level');
    const set=(xp,threshold)=>{bar.style.width=`${Math.max(0,Math.min(100,100*xp/threshold))}%`;counter.textContent=`${xp} / ${threshold} XP`;};
    if(reduced){set(afterXp,afterThreshold);level.textContent=`Ур. ${beforeLevel===afterLevel?afterLevel:`${beforeLevel} → ${afterLevel}`}`;return;}
    set(beforeXp,beforeThreshold);
    const tween=(from,to,threshold,duration)=>new Promise(resolve=>{
     const started=performance.now(),tick=now=>{const t=Math.min(1,(now-started)/duration),eased=1-Math.pow(1-t,3),xp=Math.round(from+(to-from)*eased);set(xp,threshold);if(t<1)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);
    });
    void (async()=>{
     if(beforeLevel===afterLevel){await tween(beforeXp,afterXp,afterThreshold,500);return;}
     if(afterLevel>beforeLevel){
      await tween(beforeXp,beforeThreshold,beforeThreshold,500);await new Promise(resolve=>setTimeout(resolve,160));
      level.textContent=`Ур. ${beforeLevel} → ${afterLevel}`;level.animate?.([{opacity:.45,transform:'translateY(2px)'},{opacity:1,transform:'none'}],{duration:200,easing:motionEasing.local});
      set(0,afterThreshold);await tween(0,afterXp,afterThreshold,500);return;
     }
     await tween(beforeXp,0,beforeThreshold,500);await new Promise(resolve=>setTimeout(resolve,160));
     level.textContent=`Ур. ${beforeLevel} → ${afterLevel}`;set(afterThreshold,afterThreshold);await tween(afterThreshold,afterXp,afterThreshold,500);
    })();
   });
  };
  const experienceStep=()=>{
   modalKind='experience';
   queueMicrotask(()=>requestAnimationFrame(animateExperience));
   return {html:`<div id="pve-experience"><h2>Опыт фигур</h2><div class="pve-experience-list">${result.changes.map(row=>{
    const unit=profile.units.find(unit=>unit.id===row.id),afterXp=row.afterXp??unit?.xp??0,beforeXp=row.beforeXp??afterXp,threshold=xpThreshold(row.beforeLevel),delta=(row.earned||0)-(row.penalty||0),deltaLabel=delta>0?`+${delta} XP`:delta<0?`−${Math.abs(delta)} XP`:'Без изменений';
    return `<div class="pve-experience-row" data-before-level="${row.beforeLevel}" data-after-level="${row.afterLevel}" data-before-xp="${beforeXp}" data-after-xp="${afterXp}"><span class="pve-piece">${icon(row)}</span><div class="pve-experience-main"><div class="pve-experience-head"><strong>${PIECE_NAMES[row.type]}${row.square?` · ${row.square}`:''}</strong><span class="pve-experience-delta">${deltaLabel}</span></div><div class="pve-experience-meta"><span class="pve-experience-level">Ур. ${row.beforeLevel}</span><span class="pve-experience-count">${beforeXp} / ${threshold} XP</span></div><div class="pve-experience-track" role="progressbar" aria-label="Опыт ${name(row)}" aria-valuemin="0" aria-valuemax="${xpThreshold(row.afterLevel)}" aria-valuenow="${afterXp}"><i class="pve-experience-fill"></i></div></div></div>`;
   }).join('')}</div></div>`,options:{closeLabel:'К карте',closeVariant:'primary'}};
  };
  const rewardStep=()=>{
   modalKind='reward';
   return {html:`<div id="pve-reward"><h2>Награда за бой</h2><div class="pve-reward-stats">${statCard(result.coins,'Монеты')}${result.stones?statCard(result.stones,'Камни опыта'):''}${result.cores?statCard(result.cores,'Ядро эволюции'):''}</div>${result.cores?'<p class="pve-unlock">Открыты уровень 5 и эволюция пешки в ладью.</p>':''}</div>`,options:{closeLabel:'Далее',closeVariant:'primary',next:experienceStep}};
  };
  void showModal(`<div id="pve-battle-result"><h2>${result.outcome==='win'?'Победа':result.outcome==='draw'?'Ничья':'Поражение'}</h2><p>${reason}</p></div>`,{closeLabel:'Далее',closeVariant:'primary',next:rewardStep});
 };
 const openNode = async id => {
  const node=NODES.find(node=>node.id===id);if(!isUnlocked(profile,node)||profile.battle)return;
  selectedNode=id;render();const opponent=encounter(profile,node),first=!profile.cleared.includes(id);modalKind='node';
  await showModal(`<h2>${node.name}</h2><p>${strengthLabel(opponent.ratio)}</p><div class="pve-enemy-list">${opponent.units.map(unit=>`<div><span>${icon(unit,'b')}</span><span>${PIECE_NAMES[unit.type]}<small>ур. ${unit.level}</small></span></div>`).join('')}</div><p class="pve-note">За победу: ${node.boss?'23–33 монеты':'12–17 монет'} и 2–3 камня.${first?` Бонус первой победы: ${node.boss?'10 монет, 3 камня, ядро и уровень 5':node.bonus?'6 монет и 2 камня':'5 монет и 1 камень'}.`:''}</p>${activeArmy(profile).length!==8?'<p>Соберите 8 фигур в армии, чтобы начать бой.</p>':''}<button class="primary pve-dialog-primary" data-pve-start="${id}" ${activeArmy(profile).length!==8?'disabled':''}>Начать бой</button>`);
 };
 const presentAction = async action => {
  if(disposed||presenting||!profile.battle)return;
  const old=profile.battle,board=root.querySelector('#pve-board'),before=board?snapshotBoard(board):null,generation=++presentationGeneration;
  if(!save(current=>playPveAction(current,action))){if(view==='battle'&&profile.battle?.turn==='b'&&profile.battle.phase==='playing'){botError=true;drawBattle();}return;}
  if(old===profile.battle)return;
  presenting=true;selected=null;drawBattle();
  const event=profile.battle.lastEvent;
  // Save immediately; presentation uses the old board only while damage is shown.
  if(event.damage&&board&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   renderBoard(board,pveBoardAdapter(old),equipped,null);
   board.querySelectorAll('[data-square]').forEach(cell=>cell.setAttribute('aria-disabled','true'));
   const target=board.querySelector(`[data-square="${event.to}"]`),flash=document.createElement('span');flash.className='pve-hit';flash.textContent=`−${event.damage}`;target?.append(flash);
   if(flash.animate){const animation=flash.animate([{opacity:1},{opacity:0}],{duration:motionDuration.fast,easing:motionEasing.local});await animation.finished.catch(()=>{});}flash.remove();
  }
  if(disposed||generation!==presentationGeneration)return;
  drawBattle();
  if(event.moved&&board&&before)await animateTransition(board,[{from:event.from,to:event.to}],before);
  if(disposed||generation!==presentationGeneration)return;presenting=false;drawBattle();scheduleBot();
 };
 const scheduleBot = () => {
  if(disposed||presenting||view!=='battle'||profile.battle?.phase!=='playing'||profile.battle.turn!=='b'||worker||botError)return;
  const id=++requestId;
  const failed = () => {if(disposed||id!==requestId)return;stopWorker();botError=true;drawBattle();};
  try{
   worker=new Worker(new URL('../../pve-worker.js?v=113',import.meta.url),{type:'module'});
   worker.onerror=failed;workerTimer=setTimeout(failed,10000);
   worker.onmessage=({data})=>{
    if(disposed||data.id!==requestId)return;
    clearTimeout(workerTimer);worker.terminate();worker=null;
    if(data.error||!data.move||!allMoves(profile.battle).some(move=>move.from===data.move.from&&move.to===data.move.to)){failed();return;}
    void presentAction(data.move);
   };
   worker.postMessage({id,battle:profile.battle});
  }catch{failed();}
 };
 const clickBoard = event => {
  if(presenting||profile.battle?.phase!=='playing'||profile.battle.turn!=='w')return;
  const square=event.target.closest('[data-square]')?.dataset.square;if(!square)return;
  const target=unitAt(profile.battle,square),own=unitAt(profile.battle,selected||'');
  if(own?.color==='w'&&movesFor(profile.battle,own).some(move=>move.to===square)){void presentAction({from:selected,to:square});return;}
  selected=selected===square?null:square;drawBattle();
 };
 const requestExit = () => {
  presentationGeneration++;presenting=false;const board=root.querySelector('#pve-board');if(board){clearBoardTransition(board);board.getAnimations?.({subtree:true}).forEach(animation=>animation.cancel());}
  if(view==='battle'&&profile.battle?.phase==='result'){drawBattle();return;}
  if(view==='battle'){stopWorker();view='map';render();scrollFrontier();}
  else if(view==='map'){stopWorker();onExit();}
  else go('map');
 };
 const click = async event => {
  if(disposed)return;
  const armyUnit=event.target.closest('[data-pve-unit]');if(armyUnit){armySelected=armyUnit.dataset.pveUnit;render();root.querySelector(`[data-pve-unit="${armySelected}"]`)?.focus({preventScroll:true});return;}
  if(event.target.closest('#pve-board')){clickBoard(event);return;}
  const node=event.target.closest('[data-pve-node]');if(node){void openNode(node.dataset.pveNode);return;}
  const toggle=event.target.closest('[data-pve-toggle]'),stone=event.target.closest('[data-pve-stone]'),evolve=event.target.closest('[data-pve-evolve]');
  if(toggle||stone){const id=toggle?.dataset.pveToggle||stone.dataset.pveStone,attr=toggle?'data-pve-toggle':'data-pve-stone';if(save(current=>toggle?toggleUnit(current,id):useStone(current,id))){render();root.querySelector(`[${attr}="${id}"]`)?.focus({preventScroll:true});}return;}
  if(evolve){const id=evolve.dataset.pveEvolve,unit=profile.units.find(row=>row.id===id);modalKind='evolve';await showModal(`<h2>Превратить пешку в ладью?</h2><p>${name(unit)} сохранит уровень ${unit.level}, опыт и историю. Будет потрачено одно ядро эволюции.</p><button class="primary pve-dialog-primary" data-pve-confirm-evolve="${id}">Эволюционировать</button>`);return;}
  const action=event.target.closest('[data-pve-action]')?.dataset.pveAction;
  if(action==='exit'){stopWorker();onExit();return;}
  if(action==='map'||action==='army'||action==='bag'){go(action);return;}
  if(action==='pause'){requestExit();return;}
  if(action==='resume'){view='battle';botError=false;render();scheduleBot();return;}
  if(action==='retry'){botError=false;drawBattle();scheduleBot();return;}
  if(action==='resign'){stopWorker();modalKind='resign';await showModal(`<h2>Завершить бой поражением?</h2><p>${Math.ceil(profile.battle.ply/2)<10?'Монет не будет.':'Вы получите награду за поражение.'} Вы получите 1 камень опыта. Опыт за побеждённые фигуры и штрафы погибшим сохранятся. Для продолжения позже можно приостановить бой.</p><button class="danger pve-dialog-primary" data-pve-confirm-resign>Сдаться</button>`,{closeLabel:'Продолжить бой'});}
 };
 const modalClick = async event => {
  if(disposed)return;
  const start=event.target.closest('[data-pve-start]');
  if(start&&!start.disabled){
   start.disabled=true;
   if(!save(current=>beginPveBattle(current,start.dataset.pveStart))){start.disabled=false;return;}
   if(!profile.battle)return;
   modalKind=null;await showModal.close();view='battle';selectedNode=null;root.replaceChildren();render();window.scrollTo({top:0,behavior:'instant'});scheduleBot();return;
  }
  const evolve=event.target.closest('[data-pve-confirm-evolve]');
  if(evolve){if(save(current=>evolveUnit(current,evolve.dataset.pveConfirmEvolve))){modalKind=null;await showModal.close();render();toast('Пешка стала ладьёй. Уровень и опыт сохранены.');}return;}
  if(event.target.closest('[data-pve-confirm-resign]')){
   stopWorker();presentationGeneration++;if(save(resignPve)){modalKind=null;await showModal.close();presenting=false;render();}else scheduleBot();
  }
 };
 const dismissed = () => {
  const kind=modalKind;modalKind=null;
  if(kind==='result'||kind==='reward'||kind==='experience'){
   if(save(returnToMap)){resultShownId=null;selectedNode=null;root.replaceChildren();go('map',{front:true});}
   else {resultShownId=null;queueMicrotask(complete);}
   return;
  }
  if(kind==='node'){selectedNode=null;render();}
  if(kind==='resign')scheduleBot();
 };
 const keyboard = event => {
  if(!event.target.closest('#pve-board,#pve-army-board'))return;
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];if(!delta)return;
  const cells=[...event.target.closest('.board').querySelectorAll('[data-square]:not([hidden])')],index=cells.indexOf(event.target);if(index<0)return;
  event.preventDefault();cells[Math.max(0,Math.min(63,index+delta))].focus({preventScroll:true});
 };
 root.addEventListener('click',click);root.addEventListener('keydown',keyboard);modal.addEventListener('click',modalClick);modal.addEventListener('dialogdismiss',dismissed);exitButton.onclick=requestExit;
 render();if(view==='map')scrollFrontier();else scheduleBot();
 return {get title(){return title();},get inBattle(){return view==='battle';},requestExit,dispose:()=>{disposed=true;stopWorker();root.querySelector('#pve-board')?.getAnimations?.({subtree:true}).forEach(animation=>animation.cancel());root.removeEventListener('click',click);root.removeEventListener('keydown',keyboard);modal.removeEventListener('click',modalClick);modal.removeEventListener('dialogdismiss',dismissed);exitButton.onclick=null;exitButton.hidden=false;exitButton.classList.remove('pve-back');exitButton.innerHTML=backIcon;root.replaceChildren();}};
};
