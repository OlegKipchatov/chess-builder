import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,migrateState} from '../src/services/persistence/state.ts';
import {currentStreak,normalizeActivity} from '../src/domain/activity/activity-model.ts';
import {recordCalendarGame,calendarRewards,claimCalendarReward,buyFreeze,freezeCandidate,dailyTasks,visibleCalendarRewards} from '../src/domain/activity/calendar-rewards.ts';
const at=day=>`${day}T12:00:00Z`;
const wallet=()=>({...initialState(),activity:normalizeActivity({timeZone:'UTC'}),shards:30});
test('Tasks record progress without issuing currency; claiming is atomic and idempotent',()=>{
 let state=wallet();for(const mode of ['ai','hunt','auto'])state=recordCalendarGame(state,{mode,moves:30,captures:5,score:20,finishedAt:at('2026-10-16')});
 assert.equal(state.coins,100);assert.equal(state.activity.days.length,1);
 const rows=calendarRewards(state.activity,at('2026-10-16')).filter(row=>row.group==='daily');
 assert.equal(rows.filter(row=>row.ready).length,6);
 for(const row of rows){state=claimCalendarReward(state,row.id,at('2026-10-16'));assert.equal(claimCalendarReward(state,row.id,at('2026-10-16')),state);}
 assert.equal(state.coins,160);assert.equal(state.shards,35);assert.deepEqual(migrateState(state).activity,state.activity);
});
test('Incomplete and unknown rewards cannot be claimed; earned rewards survive midnight and month boundary',()=>{
 let state=recordCalendarGame(wallet(),{finishedAt:at('2026-09-30')});
 assert.equal(claimCalendarReward(state,'daily:2026-09-30:all',at('2026-10-01')),state);
 assert.equal(claimCalendarReward(state,'unknown',at('2026-10-01')),state);
 state=claimCalendarReward(state,'daily:2026-09-30:play',at('2026-10-01'));assert.equal(state.coins,108);
 assert.equal(calendarRewards(state.activity,at('2026-10-01')).find(row=>row.id==='daily:2026-10-01:play').value,0);
});
test('Yesterday freeze bridges month boundary before or after today game, without adding activity days',()=>{
 let state=wallet();state.activity.days=['2026-09-29','2026-09-30'];
 assert.equal(currentStreak(state.activity,'2026-10-02'),0);
 const frozen=buyFreeze(state,at('2026-10-02'));assert.equal(frozen.shards,20);assert.equal(currentStreak(frozen.activity,'2026-10-02'),2);assert.equal(frozen.activity.days.length,2);
 assert.equal(buyFreeze(frozen,at('2026-10-02')),frozen);
 const after=recordCalendarGame(state,{finishedAt:at('2026-10-02')});
 const restored=buyFreeze(after,at('2026-10-02'));assert.equal(currentStreak(restored.activity,'2026-10-02'),3);
 assert.equal(restored.activity.days.filter(day=>day.startsWith('2026-10')).length,1);
});
test('Freeze rejects two missing days, no previous streak, played yesterday and insufficient funds',()=>{
 for(const days of [[],['2026-10-12'],['2026-10-15']])assert.equal(freezeCandidate({...wallet().activity,days},'2026-10-16'),null);
 const state=wallet();state.activity.days=['2026-10-14'];state.shards=9;assert.equal(buyFreeze(state,at('2026-10-16')),state);
});
test('Streak milestone remains earned after a gap and cannot pay twice',()=>{
 let state=wallet();state.activity.days=['2026-10-01','2026-10-02','2026-10-03'];
 assert.equal(claimCalendarReward(state,'streak:3',at('2026-10-16')),state);
 for(const step of [1,3])state=claimCalendarReward(state,`streak:${step}`,at('2026-10-16'));assert.equal(state.coins,130);
 state.activity.days.push('2026-10-14','2026-10-15','2026-10-16');assert.equal(claimCalendarReward(state,'streak:3',at('2026-10-16')),state);
});
test('Five daily tasks: always finish one game, two AI and two distinct mini activities; stable across reload',()=>{
 const variants=new Set();
 for(let i=1;i<=31;i++){
  const day=`2026-10-${String(i).padStart(2,'0')}`,tasks=dailyTasks(day);
  assert.equal(tasks.length,5);assert.equal(tasks[0].key,'play');assert.equal(new Set(tasks.map(row=>row.key)).size,5);
  assert.equal(tasks.filter(row=>row.kind==='ai').length,2);assert.equal(tasks.filter(row=>row.kind==='mini').length,2);
  assert.deepEqual(tasks,dailyTasks(day));variants.add(tasks.map(row=>row.key).join(','));
 }
 assert.ok(variants.size>10);
});
test('AI and minigame metrics cannot complete each other; mode data survives reload',()=>{
 let state=recordCalendarGame(wallet(),{mode:'hunt',moves:20,score:12,finishedAt:at('2026-10-16')});
 let row=state.activity.daily['2026-10-16'];assert.equal(row.aiMoves,0);assert.equal(row.huntMoves,20);assert.equal(row.huntScore,12);assert.equal(row.miniGames,1);
 state=recordCalendarGame(state,{mode:'ai',moves:15,captures:3,resigned:true,finishedAt:at('2026-10-16')});
 row=state.activity.daily['2026-10-16'];assert.equal(row.aiMoves,15);assert.equal(row.aiFinished,0);assert.equal(row.aiCaptures,3);assert.equal(row.miniGames,1);
 assert.deepEqual(migrateState(state).activity,state.activity);
});
test('Only the next streak reward is visible; monthly rewards are removed',()=>{
 let state=wallet();state.activity.days=['2026-10-01','2026-10-02','2026-10-03'];
 const next=()=>visibleCalendarRewards(state.activity,at('2026-10-16')).filter(row=>row.group!=='daily');
 assert.deepEqual(next().map(row=>row.target),[1]);
 assert.equal(claimCalendarReward(state,'month:2026-10:1',at('2026-10-16')),state);
 assert.equal(claimCalendarReward(state,'streak:2',at('2026-10-16')),state);
 state=claimCalendarReward(state,'streak:1',at('2026-10-16'));
 assert.deepEqual(next().map(row=>row.target),[3]);
});
test('Earned old daily tasks remain available after migration',()=>{
 const state=wallet();state.activity.daily['2026-10-15']={games:3,wins:1};
 const rows=calendarRewards(migrateState(state).activity,at('2026-10-16')).filter(row=>row.period==='2026-10-15');
 assert.equal(rows.length,4);assert.ok(rows.every(row=>row.ready));
});

test('New streak milestones skip daily pennies and preserve prior claim receipts',()=>{
 const state=wallet();state.activity.days=Array.from({length:31},(_,i)=>`2026-10-${String(i+1).padStart(2,'0')}`);state.activity.claimed=['streak:1','streak:2','streak:3'];
 const rewards=calendarRewards(state.activity,at('2026-10-31')).filter(row=>row.group==='streak');
 assert.deepEqual(rewards.map(row=>[row.target,row.coins]),[[1,10],[3,20],[5,30],[7,50],[14,100],[21,150],[30,200],[45,250],[60,300],[90,400]]);
 assert.equal(visibleCalendarRewards(state.activity,at('2026-10-31')).find(row=>row.group==='streak').target,5);
 assert.equal(claimCalendarReward(state,'streak:1',at('2026-10-31')),state);
 assert.equal(claimCalendarReward(state,'streak:2',at('2026-10-31')),state);
});
