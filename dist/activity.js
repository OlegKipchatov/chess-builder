// Calendar dates are assigned once in the user's fixed activity timezone.
export const initialActivity = () => ({version:1,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',days:[]});
export const validDay = day => typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
export const normalizeActivity = value => {
  const fallback=initialActivity();
  let timeZone=value?.timeZone||fallback.timeZone;
  try {new Intl.DateTimeFormat('en',{timeZone}).format();} catch {timeZone=fallback.timeZone;}
  return {version:1,timeZone,days:[...new Set((Array.isArray(value?.days)?value.days:[]).filter(validDay))].sort()};
};
export const activityDate = (instant,timeZone) => {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));
  const part=type=>parts.find(item=>item.type===type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
export const previousDay = day => new Date(Date.parse(day)-86400000).toISOString().slice(0,10);
export const currentStreak = (activity,today) => {
  const days=new Set(activity.days);let cursor=days.has(today)?today:previousDay(today),count=0;
  while(days.has(cursor)){count++;cursor=previousDay(cursor);}
  return count;
};
export const closeActivityDay = (activity,{counted,finishedAt}) => {
  if(!counted)return {activity,event:null};
  const date=activityDate(finishedAt,activity.timeZone);
  if(activity.days.includes(date))return {activity,event:null};
  const next={...activity,days:[...activity.days,date].sort()};
  return {activity:next,event:{date,streak:currentStreak(next,date)}};
};
export const dayLabel = count => `${count} ${count%10===1&&count%100!==11?'день':count%10>=2&&count%10<=4&&(count%100<12||count%100>14)?'дня':'дней'}`;
export const calendarHTML = (activity,now=new Date()) => {
  const today=activityDate(now,activity.timeZone),month=today.slice(0,7),first=new Date(`${month}-01T12:00:00Z`);
  const offset=(first.getUTCDay()+6)%7,total=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const days=new Set(activity.days),title=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
  const cells=Array.from({length:total},(_,index)=>{
    const day=`${month}-${String(index+1).padStart(2,'0')}`,closed=days.has(day),isToday=day===today;
    const status=closed?'сыграна партия':isToday?'сегодня':day>today?'будущий день':'без партии';
    return `<span class="calendar-day ${closed?'closed':''} ${isToday?'today':''} ${day>today?'future':''}" ${isToday?'aria-current="date"':''} aria-label="${index+1}, ${status}">${index+1}${closed?'<small aria-hidden="true">✓</small>':''}</span>`;
  });
  return `<article class="panel activity-calendar"><p class="eyebrow">ТЕКУЩАЯ СЕРИЯ</p><strong class="streak-value">${dayLabel(currentStreak(activity,today))}</strong><h2>${title}</h2><div class="calendar-grid" role="group" aria-label="${title}">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=>`<span class="calendar-weekday">${day}</span>`).join('')}${'<span aria-hidden="true"></span>'.repeat(offset)}${cells.join('')}</div><p class="calendar-legend"><span>✓ День с партией</span><span>Контур — сегодня</span></p><p class="muted">Календарный день: ${activity.timeZone.replaceAll('_',' ')}. Часовой пояс зафиксирован при включении календаря.</p></article>`;
};
