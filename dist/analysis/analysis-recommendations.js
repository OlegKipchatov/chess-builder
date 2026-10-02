import {Chess} from '../chess.js?v=84';

export const RECOMMENDATION_VERSION='consequences-v1';
export const MAX_EVIDENCE_PLIES=12;
const value={p:1,n:3,b:3,r:5,q:9,k:0};
const name={p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя',k:'короля'};
const actorName={p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь',k:'Король'};
const tokenOf=move=>move.from+move.to+(move.promotion||'');
const play=(game,token)=>game.move({from:token.slice(0,2),to:token.slice(2,4),promotion:token[4]});
const balance=(game,color)=>game.board().flat().filter(Boolean).reduce((sum,p)=>sum+value[p.type]*(p.color===color?1:-1),0);
const materialEnd=trace=>Math.max(1,...trace.steps.filter(step=>step.captured||step.promotion).map(step=>step.ply));
// A distant hypothetical threat should not displace a direct explanation.
// Confirmed material outcomes retain their priority even after a long exchange.
const rank=fact=>fact.priority-(fact.kind==='material'?0:(fact.end-1)*3);
const orderFacts=(a,b)=>rank(b)-rank(a)||a.end-b.end;
// A threat is a legal capture if the opponent does not address it. It is not a
// promise that material can be won: pinned pieces are excluded by legal moves.
const capturesFor=(game,color)=>{
 const parts=game.fen().split(' ');parts[1]=color;parts[3]='-';
 const view=new Chess(parts.join(' '));
 return view.moves({verbose:true}).filter(move=>move.captured&&move.captured!=='k');
};

// The same trace is used for any position, side and move sequence. No opening,
// game ID, square pattern or particular sequence is part of the detector.
export const traceContinuation=(fen,line,color)=>{
 const game=new Chess(fen),start=balance(game,color),steps=[];
 const pv=(line?.pv||[]).slice(0,MAX_EVIDENCE_PLIES);
 if(!pv.length||(line.move&&pv[0]!==line.move))return null;
 try{
  for(const token of pv){
   const moving=game.get(token.slice(0,2));
   const before=moving?.color===color?capturesFor(game,color).filter(row=>row.from===token.slice(0,2)).map(row=>row.to):[];
   const move=play(game,token),player=move.color===color;
   const threats=player?capturesFor(game,color).filter(row=>row.from===move.to&&!before.includes(row.to)).map(row=>({square:row.to,piece:row.captured})):[];
   steps.push({ply:steps.length+1,token,actor:player?'player':'opponent',piece:move.piece,from:move.from,to:move.to,captured:move.captured||null,promotion:move.promotion||null,check:game.isCheck(),mate:game.isCheckmate(),delta:balance(game,color)-start,threats});
   if(game.isGameOver())break;
  }
 }catch{return null;}
 const last=steps.at(-1);
 const recapturePending=!!(last.captured||last.promotion)&&game.moves({verbose:true}).some(row=>row.captured&&row.to===last.to);
 return {steps,pv:steps.map(row=>row.token),delta:last.delta,settled:!recapturePending,terminal:game.isGameOver()};
};

// Explain why an attacked destination can still be usable. Enumerate captures
// and recaptures for any piece; this is a conditional branch, never "best defence".
const protectionEvidence=(fen,line,color)=>{
 const game=new Chess(fen);let first;
 try{first=play(game,line.move);}catch{return null;}
 for(const capture of game.moves({verbose:true}).filter(row=>row.captured&&row.to===first.to)){
  game.move(capture);
  for(const reply of game.moves({verbose:true}).filter(row=>row.captured&&row.to===capture.to)){
   game.move(reply);
   const gain=value[capture.piece]-value[first.piece];
   const unsafe=game.moves({verbose:true}).some(row=>row.captured&&row.to===reply.to&&value[row.captured]>gain);
   game.undo();
   if(gain>0&&!unsafe){
    game.undo();
    return {kind:'protection',actor:first.piece,capturedBy:capture.piece,defender:reply.piece,pv:[tokenOf(first),tokenOf(capture),tokenOf(reply)]};
   }
  }
  game.undo();
 }
 return null;
};

const describeAction=step=>{
 if(step.promotion)return `${actorName[step.piece]} превращается в ${name[step.promotion]}.`;
 if(step.mate)return `${actorName[step.piece]} ставит мат.`;
 if(step.captured)return `${actorName[step.piece]} забирает ${name[step.captured]}${step.check?' с шахом':''}.`;
 if(step.threats.length)return `${actorName[step.piece]} ${step.threats.length>1?'создаёт одновременное нападение на':'нападает на'} ${step.threats.map(target=>name[target.piece]).join(' и ')}${step.check?' с шахом':''}.`;
 if(step.check)return `${actorName[step.piece]} даёт шах.`;
 return null;
};

// Compare facts, then rank the differences. Text rendering consumes the selected
// facts; it does not recognize moves or infer strategic causes from a score.
export const compareContinuations=(best,actual)=>{
 const candidates=[];
 if(!best||!actual)return candidates;
 const materialGap=best.delta-actual.delta;
 if(best.settled&&actual.settled&&materialGap>=1&&(best.delta>0||actual.delta<0)){
  const immediateLoss=actual.steps[1]?.captured&&actual.steps[1].to===actual.steps[0].to;
  candidates.push({kind:'material',priority:90,end:materialEnd(best),bestDelta:best.delta,actualDelta:actual.delta,
   reason:actual.delta<0?(immediateLoss?'hung_piece':'lost_material'):best.steps[0].captured?'missed_capture':'missed_tactic'});
 }
 const promotion=best.steps.find(step=>step.actor==='player'&&step.promotion);
 if(promotion&&!actual.steps.some(step=>step.actor==='player'&&step.promotion))candidates.push({kind:'promotion',priority:85,end:promotion.ply,step:promotion});
 const first=best.steps[0];
 // An equal exchange is not called a gain. Compare what happens to its target
 // in the actual line, regardless of the later move, piece types or squares.
 if(first.captured){
  const escape=actual.steps.find((step,index)=>step.actor==='opponent'&&step.from===first.to&&!actual.steps.slice(0,index).some(previous=>previous.to===first.to));
  const recapture=best.steps[1]?.captured&&best.steps[1].to===first.to?best.steps[1]:null;
  if(escape)candidates.push({kind:'target_escape',priority:70,end:Math.min(best.steps.length,3),first,escape,recapture,followup:best.steps.find(step=>step.actor==='player'&&step.ply>1)});
 }
 for(const step of best.steps.filter(row=>row.actor==='player')){
  const distinct=step.threats.filter(target=>!actual.steps.some(other=>other.actor==='player'&&other.threats.some(t=>t.square===target.square&&t.piece===target.piece)));
  if(distinct.length)candidates.push({kind:'threat',priority:distinct.filter(target=>value[target.piece]>=3).length>1?65:50,end:step.ply,step:{...step,threats:distinct}});
 }
 if(first.check&&!actual.steps[0].check)candidates.push({kind:'check',priority:30,end:Math.min(best.steps.length,3),step:first,followup:best.steps.find(step=>step.actor==='player'&&step.ply>1)});
 return candidates.sort(orderFacts);
};

const renderComparison=(fact,best,actual)=>{
 if(fact.kind==='material'){
  const first=best.steps[0],reply=best.steps[1];
  if(first.captured&&reply?.captured&&reply.to===first.to&&value[first.captured]>value[first.piece]&&best.delta>0)return `В показанном продолжении вы забираете ${name[first.captured]}, отдавая ${name[first.piece]}. После ответного взятия у вас остаётся материальная выгода.`;
  if(fact.actualDelta<0&&fact.bestDelta>=0)return 'В продолжении после сыгранного хода соперник выигрывает материал. Рекомендуемая последовательность позволяет избежать этой потери в проверенном варианте.';
  if(fact.actualDelta<0)return 'В обоих продолжениях теряется материал, но рекомендуемый вариант уменьшает потери.';
  return 'Рекомендуемая последовательность приносит больше материала, чем продолжение после сыгранного хода. Это видно после ответных взятий в показанном варианте.';
 }
 if(fact.kind==='target_escape'){
  const {first,escape,recapture,followup}=fact;
  const opening=recapture?`Сначала можно разменять ${name[first.piece]} на ${name[first.captured]}${first.check?' с шахом':''}.`:describeAction(first);
  const next=followup?describeAction(followup):null;
  return `${opening}${next?' Затем '+next[0].toLowerCase()+next.slice(1):''} После сыгранного хода соперник может увести ${name[first.captured]}${escape.check?' с шахом':''} и избежать этого взятия.`;
 }
 if(fact.kind==='promotion')return `В рекомендуемом продолжении ${describeAction(fact.step).toLowerCase()}`;
 if(fact.kind==='threat')return `${fact.end>1?'В рекомендуемом продолжении ':''}${fact.end>1?describeAction(fact.step).toLowerCase():describeAction(fact.step)} Это создаёт угрозу, но само по себе ещё не гарантирует выигрыш фигуры.`;
 const next=fact.followup?describeAction(fact.followup):null;
 return `${describeAction(fact.step)} Соперник должен ответить на шах.${next?' Затем '+next[0].toLowerCase()+next.slice(1):''}`;
};

export const buildRecommendation=(move,color)=>{
 if(move.forced||!move.bestLine||move.bestLine.move===move.playedMove||move.mateTransition||move.highlight||Number.isFinite(move.expectedScoreLoss)&&move.expectedScoreLoss<=.005)return null;
 if(new Chess(move.fenBefore).turn()!==color)return null;
 const best=traceContinuation(move.fenBefore,move.bestLine,color);
 const actual=traceContinuation(move.fenBefore,move.playedLine,color);
 if(!best||!actual)return null;
 const candidates=compareContinuations(best,actual);
 const protection=protectionEvidence(move.fenBefore,move.bestLine,color);
 if(protection)candidates.push({...protection,priority:60,end:3});
 candidates.sort(orderFacts);
 const fact=candidates[0];
 if(!fact)return {version:RECOMMENDATION_VERSION,kind:'evaluation',primary:true,coverage:'evaluation_only',text:'Этот вариант получил более высокую оценку при расчёте. Короткое продолжение не позволяет надёжно объяснить конкретную причину преимущества.',pv:best.pv.slice(0,1),facts:[]};
 const pv=fact.kind==='protection'?fact.pv:best.pv.slice(0,fact.end);
 const text=fact.kind==='protection'?`Если соперник заберёт ${name[fact.actor]} ${fact.capturedBy==='n'?'конём':'своей фигурой'}, вы сможете в ответ забрать ${name[fact.capturedBy]}. ${actorName[fact.defender]} защищает ${name[fact.actor]}; в таком размене соперник отдаст более ценную фигуру.`:renderComparison(fact,best,actual);
 const signature=fact.kind==='protection'?fact.pv:fact.kind==='threat'?fact.step.threats.map(target=>target.piece+target.square).sort():fact.kind==='target_escape'?[fact.first.captured,fact.first.check,fact.escape.check]:[];
 return {version:RECOMMENDATION_VERSION,kind:fact.kind,primary:true,coverage:'verified_line',reason:fact.reason||null,text,pv,
  themeKey:fact.kind!=='material'?`${fact.kind}:${move.bestLine.move}:${signature.join(':')}`:null,
  facts:[{...fact,pv:undefined}],playedPv:actual.pv.slice(0,fact.kind==='material'?materialEnd(actual):Math.min(actual.pv.length,3)),comparison:{bestDelta:best.delta,playedDelta:actual.delta,bestPlies:best.pv.length,playedPlies:actual.pv.length}};
};
