import test from 'node:test';
import assert from 'node:assert/strict';
import {activityDate,closeActivityDay,currentStreak,normalizeActivity} from '../src/domain/activity/activity-model.ts';
import {initialState,migrateState,loadState,KEY} from '../src/services/persistence/state.ts';
import {activityDialog} from './helpers/react-markup.js';
test('Ячейка после партии показывает длину серии, а не дату',()=>{
  for(const [streak,label] of [[1,'1 день'],[2,'2 дня подряд'],[12,'12 дней подряд'],[21,'21 день подряд']]){
    const html=activityDialog({date:'2026-09-27',streak});
    assert.match(html,new RegExp(`day-closed-mark"[^>]*>${streak}</div>`));
    assert.ok(html.includes(`>${label}</strong>`));
    assert.ok(!html.includes('>27</div>'));
  }
});
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
  assert.deepEqual(migrateState(state).activity,normalizeActivity(state.activity));
  assert.deepEqual(normalizeActivity({...state.activity,days:['2026-02-30','2026-09-10','2026-09-10']}).days,['2026-09-10']);
  const storage=new Map([[KEY,JSON.stringify({...state,activity:undefined})]]);
  loadState({getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
  assert.ok(JSON.parse(storage.get(KEY)).activity.timeZone);
});
// Calendar rendering and route separation: tests/react/activity.test.tsx.
