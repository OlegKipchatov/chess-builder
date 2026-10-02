import {createHunt,startHunt,playerMoves,resolvePlayerMove,releaseHuntInput,tickHunt,calculateMiniGameCoins,materialValues} from '../dist/hunt.js';
// Deterministic greedy policy, not a claim about observed human play speed.
const choose = state => playerMoves(state).map(move=>{
  const capture=materialValues[state.pieces[move.to]?.type]||0;
  const next=resolvePlayerMove(state,move,{now:state.startedAtMs});
  const loss=next.events.find(e=>e.type==='opponentCaptured');
  const future=playerMoves(next.state).reduce((best,m)=>Math.max(best,materialValues[next.state.pieces[m.to]?.type]||0),0);
  return {move,value:capture*10-(loss?materialValues[loss.captured]*12:0)+future};
}).sort((a,b)=>b.value-a.value)[0]?.move;
for(const mode of ['timed','endless'])for(const stepMs of [1500,3000])for(const seed of [7,42,123]){
  let state=startHunt(createHunt({mode,runId:`${mode}-${seed}`,runSeed:seed}),0),now=0;
  while(state.phase!=='finished'&&now<600_000){
    now+=stepMs;state=tickHunt(state,now);if(state.phase==='finished')break;
    const move=choose(state);if(!move)break;
    state=releaseHuntInput(resolvePlayerMove(state,move,{now}).state,now);
  }
  const completed=state.phase==='finished',coins=completed?calculateMiniGameCoins(state):0;
  console.log(JSON.stringify({mode,seed,stepMs,durationSeconds:now/1000,score:state.score,capturedMaterial:state.capturedMaterial,coins,coinsPerMinute:+(coins/(now/60000)).toFixed(2),completed}));
}
