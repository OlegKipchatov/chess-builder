import {PVE,NODES,DEATH_RATE,activeArmy,isUnlocked,encounter,maxHp,damage,earnXp,deathPenalty,xpThreshold,frontier} from './pve-model.js?v=112';
const files='abcdefgh';
const coords = square => [files.indexOf(square[0]),Number(square[1])-1];
const squareAt = (x,y) => x>=0&&x<8&&y>=0&&y<8?files[x]+(y+1):null;
const orthogonal=[[1,0],[-1,0],[0,1],[0,-1]],diagonal=[[1,1],[1,-1],[-1,1],[-1,-1]];
export const livingUnits = battle => battle.units.filter(unit=>unit.hp>0);
export const unitAt = (battle,square) => battle.units.find(unit=>unit.hp>0&&unit.square===square);
// HP chess uses movement geometry, not orthodox check legality. Kings may enter
// attacked squares; only their actual death ends the battle. No castling/en passant.
export const movesFor = (battle,unit) => {
 if(!unit||unit.hp<=0)return [];
 const [x,y]=coords(unit.square),moves=[];
 const add = (dx,dy,slide=false) => {
  for(let step=1;step<=(slide?7:1);step++){
   const to=squareAt(x+dx*step,y+dy*step);if(!to)break;
   const target=unitAt(battle,to);
   if(target?.color!==unit.color)moves.push({from:unit.square,to});
   if(target)break;
  }
 };
 if(unit.type==='p'){
  const direction=unit.color==='w'?1:-1,one=squareAt(x,y+direction);
  if(one&&!unitAt(battle,one)){
   moves.push({from:unit.square,to:one});
   const two=squareAt(x,y+2*direction);
   if(!unit.moved&&y===(unit.color==='w'?1:6)&&two&&!unitAt(battle,two))moves.push({from:unit.square,to:two});
  }
  for(const dx of [-1,1]){const to=squareAt(x+dx,y+direction),target=to&&unitAt(battle,to);if(target&&target.color!==unit.color)moves.push({from:unit.square,to});}
 }else if(unit.type==='n')for(const [dx,dy] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]])add(dx,dy);
 else for(const [dx,dy] of unit.type==='b'?diagonal:unit.type==='r'?orthogonal:[...orthogonal,...diagonal])add(dx,dy,unit.type!=='k');
 return moves;
};
export const allMoves = (battle,color=battle.turn) => livingUnits(battle).filter(unit=>unit.color===color).flatMap(unit=>movesFor(battle,unit));
export const positionKey = battle => `${battle.turn}|${livingUnits(battle).map(unit=>`${unit.id}:${unit.type}:${unit.square}:${unit.hp}:${unit.moved?1:0}`).sort().join('|')}`;
export const formation = (units,color) => {
 const used=new Set(),preferred={k:['e1'],r:['a1','h1'],n:['b1','g1'],b:['f1','c1'],q:['d1'],p:['a2','c2','e2','g2','b2','f2','d2','h2']};
 return [...units].sort((a,b)=>(a.type==='k'?-1:b.type==='k'?1:0)).map(unit=>{
  const square=[...preferred[unit.type],...['a2','b2','c2','d2','e2','f2','g2','h2','a1','b1','c1','d1','f1','g1','h1']].find(square=>!used.has(square));used.add(square);
  return {...unit,color,square:color==='b'?square[0]+(9-Number(square[1])):square,hp:maxHp(unit),moved:false};
 });
};
export const beginPveBattle = (profile,nodeId) => {
 const node=NODES.find(node=>node.id===nodeId);
 if(profile.battle||!isUnlocked(profile,node)||activeArmy(profile).length!==PVE.armySize)return profile;
 const enemy=encounter(profile,node),sequence=profile.sequence+1;
 const battle={id:`pve-${sequence}`,nodeId,phase:'playing',turn:'w',ply:0,units:[...formation(activeArmy(profile),'w'),...formation(enemy.units,'b')],xp:{},positions:{},lastEvent:null,result:null,settled:false};
 battle.positions[positionKey(battle)]=1;
 const record=profile.nodes[nodeId]||{attempts:0,wins:0,openedAt:profile.stats.battles};
 return {...profile,revision:profile.revision+1,sequence,battle,nodes:{...profile.nodes,[nodeId]:{...record,attempts:record.attempts+1}}};
};
export const killXp = (attacker,target) => Math.max(4,Math.round(16*(1+.2*(target.level-1))*Math.max(.4,Math.min(1.6,1+.2*(target.level-attacker.level)))));
// No storage or animation here: one action, one turn, no automatic counterattack.
export const resolveAction = (battle,action,{track=true}={}) => {
 if(battle.phase!=='playing')return battle;
 const attacker=unitAt(battle,action?.from);
 if(!attacker||attacker.color!==battle.turn||!movesFor(battle,attacker).some(move=>move.to===action.to))return battle;
 const next={...battle,units:battle.units.map(unit=>({...unit})),xp:{...battle.xp},positions:track?{...battle.positions}:battle.positions};
 const own=next.units.find(unit=>unit.id===attacker.id),target=unitAt(next,action.to),hit=target?Math.min(target.hp,damage(own)):0;
 let killed=false;
 if(target){target.hp-=hit;killed=target.hp===0;if(killed&&own.color==='w')next.xp[own.id]=(next.xp[own.id]||0)+killXp(own,target);}
 if(!target||killed)own.square=action.to;
 own.moved=true;
 const promoted=own.type==='p'&&own.square[1]===(own.color==='w'?'8':'1');if(promoted)own.type='q';
 next.lastEvent={from:action.from,to:action.to,attackerId:own.id,targetId:target?.id||null,damage:hit,killed,moved:!target||killed,promoted};
 next.turn=battle.turn==='w'?'b':'w';next.ply++;
 if(killed&&target.type==='k'){next.phase='result';next.result={outcome:target.color==='b'?'win':'loss',reason:'king'};}
 else if(track){
  const key=positionKey(next);next.positions[key]=(next.positions[key]||0)+1;
  const reason=next.ply>=PVE.maxPlies?'limit':next.positions[key]>=3?'repetition':allMoves(next).length===0?'no-moves':null;
  if(reason){next.phase='result';next.result={outcome:'draw',reason};}
 }
 return next;
};
export const playPveAction = (profile,action) => {
 if(!profile.battle)return profile;
 const battle=resolveAction(profile.battle,action);return battle===profile.battle?profile:{...profile,revision:profile.revision+1,battle};
};
export const resignPve = profile => !profile.battle||profile.battle.phase!=='playing'?profile:{...profile,revision:profile.revision+1,battle:{...profile.battle,phase:'result',result:{outcome:'loss',reason:'resigned'}}};
// Wallet, unit changes, node clear and receipt are committed in a single write.
export const settlePve = (wallet,now=new Date().toISOString()) => {
 const profile=wallet.pve,battle=profile?.battle;
 if(!battle||battle.phase!=='result'||battle.settled)return wallet;
 const node=NODES.find(node=>node.id===battle.nodeId),win=battle.result.outcome==='win',first=win&&!profile.cleared.includes(node.id);
 const levelCap=first&&node.boss?PVE.bossCap:profile.levelCap;
 const coins=win?(first?(node.boss?10:node.bonus?6:5):(node.boss?2:1)):0;
 const record=profile.nodes[node.id]||{attempts:1,wins:0,openedAt:0},wins=record.wins+(win?1:0);
 const stones=win?(first?(node.boss?3:node.bonus?2:1):(wins%3===0?1:0)):0,cores=first&&node.boss?1:0;
 const deaths={...profile.stats.deaths},changes=[];
 const units=profile.units.map(unit=>{
  const fighter=battle.units.find(row=>row.id===unit.id);if(!fighter)return unit;
  const earned=(battle.xp[unit.id]||0)+(win&&fighter.hp>0?(node.boss?12:8):0);
  // Penalty uses the pre-battle type/level and is capped to one lost level.
  const penalized=fighter.hp===0?deathPenalty(unit):unit;
  const next=earnXp(penalized,earned,levelCap);
  if(fighter.hp===0)deaths[unit.type]=(deaths[unit.type]||0)+1;
  changes.push({id:unit.id,type:unit.type,beforeLevel:unit.level,afterLevel:next.level,earned,penalty:fighter.hp===0?Math.ceil(xpThreshold(unit.level)*DEATH_RATE[unit.type]):0,died:fighter.hp===0});
  return next;
 });
 const result={...battle.result,id:battle.id,nodeId:node.id,coins,stones,cores,first,levelCap,changes,plies:battle.ply,finishedAt:now};
 const cleared=first?[...profile.cleared,node.id]:profile.cleared;
 const nodes={...profile.nodes,[node.id]:{...record,wins}};
 const nextFrontier=frontier({...profile,cleared});for(const row of NODES)if(row.step===nextFrontier&&!nodes[row.id])nodes[row.id]={attempts:0,wins:0,openedAt:profile.stats.battles+1};
 const next={...profile,revision:profile.revision+1,units,levelCap,stones:profile.stones+stones,cores:profile.cores+cores,cleared,nodes,lastResult:result,battle:{...battle,settled:true,result},stats:{...profile.stats,battles:profile.stats.battles+1,wins:profile.stats.wins+(win?1:0),draws:profile.stats.draws+(battle.result.outcome==='draw'?1:0),deaths,recent:[...profile.stats.recent,{nodeId:node.id,outcome:result.outcome,levels:units.filter(row=>row.active).map(row=>row.level),deaths:changes.filter(row=>row.died).length,stones,plies:battle.ply}].slice(-30)}};
 return {...wallet,coins:wallet.coins+coins,pve:next};
};
export const returnToMap = profile => profile.battle?.settled?{...profile,revision:profile.revision+1,battle:null}:profile;
export const pveBoardAdapter = battle => ({
 board:()=>Array.from({length:8},(_,row)=>Array.from({length:8},(_,col)=>unitAt(battle,files[col]+(8-row))||null)),
 moves:({square})=>battle.turn==='w'&&unitAt(battle,square)?.color==='w'?movesFor(battle,unitAt(battle,square)):[],
 history:()=>battle.lastEvent?[battle.lastEvent]:[],turn:()=>battle.turn,isCheck:()=>false,
});
