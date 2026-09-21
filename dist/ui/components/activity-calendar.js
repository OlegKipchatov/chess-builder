import {activityDate,currentStreak,dayLabel} from '../../activity-model.js?v=27';
export const calendarHTML = (activity,now=new Date()) => {
  const today=activityDate(now,activity.timeZone),month=today.slice(0,7),first=new Date(`${month}-01T12:00:00Z`);
  const offset=(first.getUTCDay()+6)%7,total=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const days=new Set(activity.days),title=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
  const cells=Array.from({length:total},(_,index)=>{
    const day=`${month}-${String(index+1).padStart(2,'0')}`,closed=days.has(day),isToday=day===today;
    const status=closed?'сыграна партия':isToday?'сегодня':day>today?'будущий день':'без партии';
    return `<span class="calendar-day ${closed?'closed':''} ${isToday?'today':''} ${day>today?'future':''}" ${isToday?'aria-current="date"':''} aria-label="${index+1}, ${status}">${index+1}</span>`;
  });
  return `<article class="panel activity-calendar"><p class="eyebrow">ТЕКУЩАЯ СЕРИЯ</p><strong class="streak-value">${dayLabel(currentStreak(activity,today))}</strong><h2>${title}</h2><div class="calendar-grid" role="group" aria-label="${title}">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=>`<span class="calendar-weekday">${day}</span>`).join('')}${'<span aria-hidden="true"></span>'.repeat(offset)}${cells.join('')}</div><p class="calendar-legend"><span><i class="calendar-key" aria-hidden="true"></i> День с партией</span><span>Контур — сегодня</span></p></article>`;
};
