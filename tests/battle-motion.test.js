import test from 'node:test';
import assert from 'node:assert/strict';
import {animatePveAction,clearBoardTransition} from '../dist/board.js';
import {createBattleController} from '../dist/autochess-battle.js';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const scene=()=>{
 const animations=[],created=[];
 const element=()=>({style:{},setAttribute:()=>{},querySelector:()=>element(),outerHTML:'<svg></svg>',append:()=>{},remove:()=>{},animate:(frames,timing)=>{
  let resolve;const finished=new Promise(r=>{resolve=r;});const animation={frames,timing,finished,finish:resolve,cancel:resolve};animations.push(animation);return animation;
 }});
 const source={...element(),querySelectorAll:()=>[icon],getBoundingClientRect:()=>({left:0,top:0,width:50,height:50})},icon=element();
 const health=element();health.style.width='80%';
 const target={...element(),querySelector:selector=>selector==='.pve-hp i'?health:null,querySelectorAll:()=>[],getBoundingClientRect:()=>({left:100,top:100,width:50,height:50})};
 const root={...element(),clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:0,top:0,width:400}),querySelector:selector=>selector.includes('a1')?source:target};
 return {root,animations,created,health,element:()=>{const node=element();created.push(node);return node;},icon};
};
for(const killed of [false,true])test(`RPG impact follows approach; return only for surviving target (${killed})`,async()=>{
 const oldDocument=globalThis.document,oldMedia=globalThis.matchMedia,s=scene();
 globalThis.document={createElement:s.element};globalThis.matchMedia=()=>({matches:false});
 try{
  let impacts=0,done=false;
  const pending=animatePveAction(s.root,{from:'a1',to:'c3',damage:80,moved:killed,killed},()=>{impacts++;s.health.style.width='30%';}).then(()=>{done=true;});
  assert.equal(impacts,0);assert.equal(s.animations[0].timing.duration,420);
  s.animations[0].finish();await flush();assert.equal(impacts,1);assert.equal(done,false);assert.equal(s.animations[1].timing.duration,420);assert.equal(s.animations[2].timing.duration,200);assert.deepEqual(s.animations[2].frames,[{width:'80%'},{width:killed?'0%':'30%'}]);
  s.animations[2].finish();await flush();
  assert.equal(s.animations.length,3);assert.equal(done,false);
  s.animations[1].finish();await flush();
  if(!killed){assert.equal(done,false);assert.equal(s.animations[3].timing.duration,420);assert.equal(s.animations[3].frames[1].transform,'translate(0,0)');s.animations[3].finish();}
  await pending;assert.equal(s.icon.style.visibility,'');assert.equal(s.animations.length,killed?3:4);
 }finally{globalThis.document=oldDocument;globalThis.matchMedia=oldMedia;}
});
test('RPG cancellation before contact never invokes a stale impact',async()=>{
 const oldDocument=globalThis.document,oldMedia=globalThis.matchMedia,s=scene();globalThis.document={createElement:s.element};globalThis.matchMedia=()=>({matches:false});
 try{let impacts=0;const pending=animatePveAction(s.root,{from:'a1',to:'c3',damage:80,moved:false},()=>impacts++);clearBoardTransition(s.root);await pending;assert.equal(impacts,0);assert.equal(s.icon.style.visibility,'');}finally{globalThis.document=oldDocument;globalThis.matchMedia=oldMedia;}
});
test('RPG reduced motion applies impact without animation or delay',async()=>{
 const oldMedia=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:true});try{let impacts=0;await animatePveAction({}, {},()=>impacts++);assert.equal(impacts,1);}finally{globalThis.matchMedia=oldMedia;}
});
test('autochess prefetch waits for both pacing and presentation; pause drops pending move',async()=>{
 let run={color:'w',phase:'paused',results:[],battle:{id:'timing',initialFen:'4k3/7p/8/8/8/8/P7/4K3 w - - 0 1',moves:[],elapsed:0}},now=0,release;
 const timers=[],commits=[];let searches=0;
 const presentation=new Promise(resolve=>{release=resolve;});
 const c=createBattleController({getRun:()=>run,save:next=>{run=next;commits.push(now);return true;},onChange:()=>run.battle.moves.length===1?presentation:undefined,onError:error=>assert.fail(error),clock:()=>now,schedule:(fn,delay)=>{timers.push({fn,delay});return fn;},cancel:()=>{},engineFactory:()=>({ready:Promise.resolve(),search:async()=>{searches++;return searches===1?'a2a3':'h7h6';},terminate:()=>{}})});
 await c.start();await flush();assert.equal(searches,2);assert.equal(run.battle.moves.length,1);assert.equal(timers[0].delay,200);
 now=200;timers.shift().fn();await flush();assert.equal(run.battle.moves.length,1);
 now=260;release();await flush();assert.equal(run.battle.moves.length,2);assert.deepEqual(commits,[0,260]);
 c.pause();await flush();assert.equal(run.battle.moves.length,2);c.dispose();
});
test('en passant moves diagonally but animates damage at the adjacent pawn',async()=>{
 const oldDocument=globalThis.document,oldMedia=globalThis.matchMedia,s=scene(),lookup=s.root.querySelector;
 const victim={querySelector:selector=>selector==='.pve-hp i'?s.health:null,getBoundingClientRect:()=>({left:150,top:50,width:50,height:50})};
 s.root.querySelector=selector=>selector.includes('d3')?victim:lookup(selector);
 globalThis.document={createElement:s.element};globalThis.matchMedia=()=>({matches:false});
 try{
  const pending=animatePveAction(s.root,{from:'a1',to:'c3',targetSquare:'d3',damage:80,moved:true,killed:true},()=>{});
  assert.equal(s.animations[0].frames[1].transform,'translate(100px,100px)');
  s.animations[0].finish();await flush();
  assert.equal(s.created[1].style.left,'154px');assert.equal(s.created[1].style.top,'85px');assert.equal(s.animations[2].frames[1].width,'0%');
  s.animations[1].finish();s.animations[2].finish();await pending;
 }finally{globalThis.document=oldDocument;globalThis.matchMedia=oldMedia;}
});
