import {activityDate,currentStreak,dayLabel} from '../../activity-model.js?v=53';
export const calendarHTML = (activity,now=new Date()) => {
  const today=activityDate(now,activity.timeZone),month=today.slice(0,7),first=new Date(`${month}-01T12:00:00Z`);
  const offset=(first.getUTCDay()+6)%7,total=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const days=new Set(activity.days),title=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
  const formatDate=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'});
  const cellCount=Math.ceil((offset+total)/7)*7;
  const cells=Array.from({length:cellCount},(_,index)=>{
    const date=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),index-offset+1));
    const day=date.toISOString().slice(0,10),dayNumber=date.getUTCDate();
    const adjacent=day.slice(0,7)!==month,closed=days.has(day),isToday=day===today;
    const status=closed?'сыграна партия':isToday?'сегодня':day>today?'будущий день':'без партии';
    const dateLabel=formatDate.format(date);
    return `<span class="calendar-day ${closed?'closed':''} ${isToday?'today':''} ${day>today?'future':''} ${adjacent?'adjacent':''}" ${isToday?'aria-current="date"':''} aria-label="${dateLabel}, ${status}">${dayNumber}</span>`;
  });
  return `<article class="panel activity-calendar"><p class="eyebrow">Текущая серия</p><strong class="streak-value">${dayLabel(currentStreak(activity,today))}</strong><h2>${title}</h2><div class="calendar-grid" role="group" aria-label="${title}">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=>`<span class="calendar-weekday">${day}</span>`).join('')}${cells.join('')}</div>${days.size?'':'<p class="calendar-empty">Первая завершённая партия отметит сегодняшний день в календаре.</p>'}<p class="calendar-legend"><span><i class="calendar-key" aria-hidden="true"></i> С партией</span><span><i class="calendar-key today" aria-hidden="true"></i> Сегодня</span></p></article>`;
};
