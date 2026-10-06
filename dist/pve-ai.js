import {allMoves,resolveAction,unitAt,livingUnits} from './pve-battle.js?v=114';
import {unitPower,damage} from './pve-model.js?v=114';
const value = unit => unit.type==='k'?240+unitPower(unit):unitPower(unit);
const evaluate = (battle,color) => {
 if(battle.result?.reason==='king')return (battle.result.outcome===(color==='w'?'win':'loss')?1:-1)*100000;
 const units=livingUnits(battle),enemyKing=units.find(unit=>unit.color!==color&&unit.type==='k');
 return units.reduce((score,unit)=>{
  const x=unit.square.charCodeAt(0)-97,y=Number(unit.square[1]),center=7-Math.abs(x-3.5)-Math.abs(y-4.5);
  const forward=unit.color==='w'?y-1:8-y;
  const distance=enemyKing&&unit.color===color?Math.abs(x-(enemyKing.square.charCodeAt(0)-97))+Math.abs(y-Number(enemyKing.square[1])):8;
  const positional=unit.type==='k'?.015*center:.04*center+.025*forward+(unit.color===color?.035*(14-distance):0);
  return score+(unit.color===color?1:-1)*(value(unit)+positional);
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
 const candidates=moves.map(move=>({move,score:priority(battle,move,color)})).sort((a,b)=>b.score-a.score).slice(0,12);
 let best=null,bestScore=-Infinity;
 for(const {move} of candidates){
  const next=resolveAction(battle,move,{track:false});let score=evaluate(next,color);
  if(!next.result){
   const replies=allMoves(next).map(reply=>({move:reply,score:priority(next,reply,next.turn)})).sort((a,b)=>b.score-a.score).slice(0,12);
   for(const reply of replies)score=Math.min(score,evaluate(resolveAction(next,reply.move,{track:false}),color));
   // Avoid purposeless loops without inventing a reward for move count.
   if(battle.lastEvent?.from===move.to&&battle.lastEvent?.to===move.from)score-=.2;
  }
  if(score>bestScore){bestScore=score;best=move;}
 }
 return best;
};
