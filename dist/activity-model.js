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
