import test from 'node:test';
import assert from 'node:assert/strict';
import {activityDate,closeActivityDay,currentStreak,normalizeActivity,calendarHTML} from '../dist/activity.js';
import {initialState,migrateState,loadState,KEY} from '../dist/state.js';
const activity=(days=[])=>({version:1,timeZone:'Europe/Helsinki',days});
test('Закрытие дня идемпотентно; неучитываемая партия ничего не меняет',()=>{
  const input=activity(),event={counted:true,finishedAt:'2026-09-12T10:00:00Z'};
  const first=closeActivityDay(input,event);assert.deepEqual(first.event,{date:'2026-09-12',streak:1});
  assert.equal(closeActivityDay(first.activity,event).event,null);
  assert.equal(closeActivityDay(input,{...event,counted:false}).activity,input);
});
test('Серия продолжается через границу месяца, сохраняется до конца сегодня, обрывается после пропуска',()=>{
  const data=activity(['2026-08-30','2026-08-31','2026-09-01']);
  assert.equal(currentStreak(data,'2026-09-01'),3);assert.equal(currentStreak(data,'2026-09-02'),3);
  assert.equal(currentStreak(data,'2026-09-03'),0);
  assert.equal(closeActivityDay(data,{counted:true,finishedAt:'2026-09-03T10:00:00Z'}).event.streak,1);
});
test('Полночь и DST используют календарные даты фиксированной зоны',()=>{
  assert.equal(activityDate('2026-09-12T20:58:00Z','Europe/Helsinki'),'2026-09-12');
  assert.equal(activityDate('2026-09-12T21:05:00Z','Europe/Helsinki'),'2026-09-13');
  assert.equal(currentStreak(activity(['2026-03-28','2026-03-29','2026-03-30']),'2026-03-30'),3);
  assert.equal(currentStreak(activity(['2024-02-28','2024-02-29','2024-03-01']),'2024-03-01'),3);
});
test('Миграция не переносит даты и не зависит от истории партий',()=>{
  const state=initialState();state.activity=activity(['2026-09-10']);
  assert.deepEqual(migrateState(state).activity,state.activity);
  assert.deepEqual(normalizeActivity({...state.activity,days:['2026-02-30','2026-09-10','2026-09-10']}).days,['2026-09-10']);
  const storage=new Map([[KEY,JSON.stringify({...state,activity:undefined})]]);
  loadState({getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
  assert.ok(JSON.parse(storage.get(KEY)).activity.timeZone);
});
test('Календарь показывает текущий месяц без интерактивных дат',()=>{
  const html=calendarHTML(activity(['2026-09-10']),'2026-09-12T12:00:00Z');
  assert.ok(html.includes('сентябрь 2026'));assert.equal((html.match(/class="calendar-day /g)||[]).length,30);
  assert.ok(html.includes('aria-current="date"'));assert.ok(!html.includes('<button'));
});
