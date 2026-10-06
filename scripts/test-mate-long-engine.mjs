import assert from 'node:assert/strict';
export const testLongMateEngine = async page => {
 const results=await page.evaluate(async()=>{
  const {Chess}=await import('./chess.js?v=113');
  const {createStockfishClient}=await import('./stockfish-client.js?v=113');
  const {engineLine}=await import('./stockfish-evaluation.js?v=113');
  const {verifyShortMate}=await import('./analysis/analysis-reasons.js?v=113');
  const {prepareMateExercise,createMateExercise}=await import('./analysis/analysis-training.js?v=113');
  const search=async game=>{
   const client=createStockfishClient();
   try{return await new Promise((resolve,reject)=>{
    client.onmessage=({data})=>data.recovered?reject(Error('Recovered search')):resolve(data.lines[0]);client.onerror=reject;
    client.postMessage({id:1,requestId:1,jobId:'test',moveIndex:0,fen:game.fen(),pgn:game.pgn(),analysisOnly:true,analysis:{mode:'nodes',nodes:300000,multiPv:1}});
   });}finally{client.terminate();}
  };
  const found=[],scores=[];
  for(const fen of ['7k/8/8/4K3/8/8/8/3Q4 w - - 0 1','7k/8/8/8/4K3/8/8/3Q4 w - - 0 1','7k/8/8/3K4/8/8/8/3Q4 w - - 0 1','7k/8/8/8/5K2/8/8/3Q4 w - - 0 1']){
   const row=await search(new Chess(fen));scores.push([fen,row.scoreType,row.scoreValue]);
   if(row.scoreType!=='mate'||![3,4].includes(row.scoreValue)||found.some(result=>result.mate===row.scoreValue))continue;
   const shortMate=await verifyShortMate(fen,engineLine(row,'w','w'));
   if(!shortMate)throw Error('Confirmed engine mate was not recognized');
   const data=await prepareMateExercise({fenBefore:fen,shortMate}),exercise=createMateExercise(data);
   let count=0,next=row.move;
   try{
    while(count++<4){
     const state=(await exercise.submit(next)).state;
     if(state==='success')break;
     if(state!=='correct')throw Error(`Proven move ${next}: ${state}`);
     exercise.continue();exercise.continue();next=(await search(exercise.game)).move;
    }
    if(exercise.getSnapshot().state!=='success')throw Error('Mate not completed');
    found.push({mate:row.scoreValue,plies:exercise.game.history().length});
   }finally{exercise.dispose();}
   if(found.length===2)break;
  }
  return {found,scores};
 });
 assert.deepEqual(results.found.map(row=>row.mate).sort(),[3,4],JSON.stringify(results));
 console.log('PASS real Stockfish: mate in 3 and 4, verified PV, practice, defence and checkmate',results.found);
};
