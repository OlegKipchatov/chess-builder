import {allMoves,resolveAction,unitAt,livingUnits,attacksSquare,isKingThreatened,isSquareAttacked} from './pve-battle.js?v=116';
import {unitPower,damage,maxHp} from './pve-model.js?v=116';
const value = unit => unit.type==='k'?240*(.35+.65*unit.hp/maxHp(unit))+unitPower(unit):unitPower(unit);
const evaluate = (battle,color) => {
 if(battle.result)return battle.result.outcome==='draw'?0:(battle.result.outcome===(color==='w'?'win':'loss')?1:-1)*100000;
 const units=livingUnits(battle),enemyKing=units.find(unit=>unit.color!==color&&unit.type==='k');
 return units.reduce((score,unit)=>{
  const x=unit.square.charCodeAt(0)-97,y=Number(unit.square[1]),center=7-Math.abs(x-3.5)-Math.abs(y-4.5);
  const forward=unit.color==='w'?y-1:8-y;
  const distance=enemyKing&&unit.color===color?Math.abs(x-(enemyKing.square.charCodeAt(0)-97))+Math.abs(y-Number(enemyKing.square[1])):8;
  const enemies=units.filter(row=>row.color!==unit.color);
  const incoming=Math.max(0,...enemies.filter(row=>attacksSquare(battle,row,unit.square)).map(damage));
  const risk=unit.type==='k'?(incoming>=unit.hp?180:35*incoming/unit.hp):unitPower(unit)*Math.min(1,incoming/unit.hp)*.6;
  const unsafe=unit.type==='k'?[-1,0,1].reduce((count,dx)=>count+[-1,0,1].filter(dy=>{
   const file=x+dx,rank=y+dy;
   return (dx||dy)&&file>=0&&file<8&&rank>=1&&rank<=8&&isSquareAttacked(battle,String.fromCharCode(97+file)+rank,unit.color==='w'?'b':'w');
  }).length,0):0;
  const positional=unit.type==='k'?-.04*center-.12*unsafe:.04*center+.025*forward+(unit.color===color?.035*(14-distance):0);
  return score+(unit.color===color?1:-1)*(value(unit)+positional-risk);
 },0);
};
const priority = (battle,move,color) => {
 const target=unitAt(battle,move.to),attacker=unitAt(battle,move.from),next=resolveAction(battle,move,{track:false});
 const attack=target?(target.hp<=damage(attacker)?value(target)*12:value(target)*damage(attacker)/target.hp):0;
 return attack+evaluate(next,color);
};
export const choosePveMove = battle => {
 if(battle.phase!=='playing')return null;
 const color=battle.turn,moves=allMoves(battle);
 const candidates=moves.map(move=>({move,score:priority(battle,move,color)})).sort((a,b)=>b.score-a.score).slice(0,isKingThreatened(battle)?moves.length:12);
 let best=null,bestScore=-Infinity;
 for(const {move} of candidates){
  const next=resolveAction(battle,move,{track:false});let score=evaluate(next,color);
  if(!next.result){
   score=Infinity;
   // Full opponent response, then our best continuation: a survivable hit may
   // be worth accepting when it enables a king kill on the following turn.
   for(const reply of allMoves(next)){
    const response=resolveAction(next,reply,{track:false});
    let continuation=evaluate(response,color);
    if(!response.result){
     continuation=-Infinity;
     for(const action of allMoves(response)){
      continuation=Math.max(continuation,evaluate(resolveAction(response,action,{track:false}),color));
      if(continuation===100000)break;
     }
    }
    score=Math.min(score,continuation);
    if(score<=bestScore)break;
   }
   if(battle.lastEvent?.from===move.to&&battle.lastEvent?.to===move.from)score-=.2;
  }
  if(score>bestScore){bestScore=score;best=move;}
 }
 return best;
};
