import {visibleCalendarRewards,freezeCandidate,FREEZE_COST} from '../../calendar-rewards.js?v=132';
import {activityDate,currentStreak,dayLabel} from '../../activity-model.js?v=132';
export const calendarHTML = (activity,now=new Date(),shards=0,view='all') => {
  const today=activityDate(now,activity.timeZone),month=today.slice(0,7),first=new Date(`${month}-01T12:00:00Z`);
  const offset=(first.getUTCDay()+6)%7,total=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const days=new Set(activity.days),title=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
  const formatDate=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'});
  const cellCount=Math.ceil((offset+total)/7)*7;
  const cells=Array.from({length:cellCount},(_,index)=>{
    const date=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),index-offset+1));
    const day=date.toISOString().slice(0,10),dayNumber=date.getUTCDate();
    const adjacent=day.slice(0,7)!==month,closed=days.has(day),frozen=(activity.frozen||[]).includes(day),isToday=day===today;
    const status=closed?'сыграна партия':frozen?'заморожен, серия сохранена':isToday?'сегодня':day>today?'будущий день':'без партии';
    const dateLabel=formatDate.format(date);
    return `<span class="calendar-day ${closed?'closed':frozen?'frozen':''} ${isToday?'today':''} ${day>today?'future':''} ${adjacent?'adjacent':''}" ${isToday?'aria-current="date"':''} aria-label="${dateLabel}, ${status}">${dayNumber}</span>`;
  });
  const rewards=visibleCalendarRewards(activity,now),candidate=freezeCandidate(activity,today);
  const amount=row=>`<span class="calendar-coins">◈ ${row.coins}</span>${row.shards?` <span class="calendar-shards">✧ ${row.shards}</span>`:''}`;
  const action=row=>row.claimed?`<span class="quest-completed" role="img" aria-label="Награда получена: ${row.title}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span>`:`<button class="${row.ready&&!row.claimed?'primary':'secondary'}" data-calendar-claim="${row.id}" ${!row.ready||row.claimed?'disabled':''} aria-label="${row.claimed?'Получено':row.ready?'Забрать награду':'В процессе'}: ${row.title}">${row.claimed?'✓':row.ready?'Забрать':amount(row)}</button>`;
  const rewardRow=row=>`<div class="calendar-reward ${row.claimed?'is-claimed':''}"><span class="quest-symbol" aria-hidden="true">${row.id.endsWith(':all')?'★':row.id.includes(':ai-')?'♞':row.id.includes(':hunt-')?'♜':row.id.includes(':auto-')?'♟':'◆'}</span><div class="calendar-reward-copy"><h3>${row.title}</h3><p>${row.value} / ${row.target}${row.ready&&!row.claimed?` <span aria-hidden="true">·</span> ${amount(row)}`:''}${row.period&&row.period!==today?` · ${row.period.split('-').reverse().join('.')}`:''}</p><progress max="${row.target}" value="${row.value}" aria-label="${row.title}"></progress></div>${action(row)}</div>`;
  const track=()=>{
   const row=rewards.find(row=>row.group==='streak'),streak=currentStreak(activity,today);
   const progress=row?(row.ready?row.target:Math.min(streak,row.target)):0;
   return `<article class="calendar-track streak-card"><div class="streak-card-heading"><h2><span aria-hidden="true">ϟ</span> Серия</h2><strong>${dayLabel(streak)}</strong></div>${row?`<div class="streak-card-body"><div class="streak-card-prize"><p>Награда за ${row.target}-й день</p><div class="streak-card-amount">${amount(row)}</div></div><div class="streak-card-action">${row.ready?action(row):`<span>Ещё ${dayLabel(row.target-progress)}</span>`}</div></div><progress class="streak-progress" max="${row.target}" value="${progress}" aria-label="Прогресс к награде за ${row.target}-й день"></progress>`:'<p class="track-complete">Все награды получены ✓</p>'}</article>`;
  };
  const pending=rewards.filter(row=>row.ready&&!row.claimed&&row.period&&row.period!==(row.group==='daily'?today:month));
  const daily=rewards.filter(row=>row.group==='daily'&&row.period===today),complete=daily.filter(row=>!row.id.endsWith(':all')&&row.ready).length;
  const series=`<article class="panel activity-calendar"><div class="calendar-month-heading"><h2>${title}</h2><span class="streak-chip" aria-label="Текущая серия: ${dayLabel(currentStreak(activity,today))}"><span aria-hidden="true">ϟ</span> ${dayLabel(currentStreak(activity,today))}</span></div><div class="calendar-grid" role="group" aria-label="${title}">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=>`<span class="calendar-weekday">${day}</span>`).join('')}${cells.join('')}</div><p class="calendar-legend"><span><i class="calendar-key" aria-hidden="true"></i> С партией</span><span><i class="calendar-key today" aria-hidden="true"></i> Сегодня</span><span><i class="calendar-key frozen" aria-hidden="true"></i> Заморожен</span></p></article>
  ${candidate?`<section class="panel calendar-freeze"><h2>Сохранить серию</h2><p>Заморозить ${formatDate.format(new Date(candidate+'T12:00:00Z'))}</p><button class="secondary" data-calendar-freeze ${shards<FREEZE_COST?'disabled':''}>❄ Заморозить · ${FREEZE_COST} ✧</button>${shards<FREEZE_COST?`<p class="calendar-description">Не хватает ${FREEZE_COST-shards} осколков</p>`:''}</section>`:''}
  
`;
  const quests=`<div class="calendar-tracks">${track()}</div>  <section class="panel calendar-rewards"><div class="quest-heading"><h2>Задачи на сегодня</h2><span>${complete} / 5</span></div>${daily.map(rewardRow).join('')}</section>
  ${pending.length?`<section class="panel calendar-rewards"><h2>Ждут получения</h2>${pending.map(rewardRow).join('')}</section>`:''}`;
  return `<div class="calendar-layout">${view!=='activity'?series:''}${view!=='streak'?quests:''}</div>`;
};
