import {readFileSync,writeFileSync} from 'node:fs';
const root='docs/ai/results/play-styles',data=JSON.parse(readFileSync(root+'/tournament.json')),rows=[];
for(const elo of [...data.elos,'all'])for(const profile of ['aggressive','solid','positional','tricky']){
 const games=data.games.filter(g=>(elo==='all'||g.elo===elo)&&(g.white===profile||g.black===profile));
 const row={elo,profile,games:games.length,wins:0,draws:0,losses:0,unfinished:0,moves:0,cpMoves:0,cpLoss:0,rank:0,captures:0,checks:0,changed:0,queenExchangePairs:0,materialAt20:0,materialSamples:0};const choices={},features={attack:0,safety:0,position:0,complexity:0,exchange:0};
 for(const g of games){
  const side=g.white===profile?'w':'b',s=g.stats[side];
  if(g.result==='*')row.unfinished++;else if(g.result==='1/2-1/2')row.draws++;else if((g.result==='1-0')===(side==='w'))row.wins++;else row.losses++;
  for(const k of ['moves','cpMoves','cpLoss','rank','captures','checks','changed'])row[k]+=s[k];
  row.queenExchangePairs+=g.queenExchangePairs;if(g.materialAt20!==null){row.materialAt20+=g.materialAt20;row.materialSamples++;}
  for(const [key,count] of Object.entries(s.choices)){const [fen,move]=key.split('|');choices[fen]??={};choices[fen][move]=(choices[fen][move]||0)+count;}
  for(const k of Object.keys(features))features[k]+=s.features[k];
 }
 const repeated=Object.values(choices).filter(m=>Object.values(m).reduce((a,b)=>a+b,0)>1);
 rows.push({...row,score: (row.wins+.5*row.draws)/(games.length-row.unfinished),averageCpLoss:row.cpLoss/row.cpMoves,averageRank:row.rank/row.moves,capturesPerGame:row.captures/games.length,checksPerGame:row.checks/games.length,changedFraction:row.changed/row.moves,queenExchangesPerGame:row.queenExchangePairs/games.length,meanMaterialAt20:row.materialAt20/row.materialSamples,repeatedPositions:repeated.length,moveDiversity:repeated.length?repeated.reduce((n,m)=>n+Object.keys(m).length,0)/repeated.length:null,features:Object.fromEntries(Object.entries(features).map(([k,v])=>[k,v/row.moves]))});
}
const totalMoves=data.games.reduce((n,g)=>n+g.plies,0),summary={rows,games:data.games.length,totalMoves,unfinished:data.games.filter(g=>g.result==='*').length,performance:{engineMsPerMove:data.games.reduce((n,g)=>n+g.engineMs,0)/totalMoves,fullFeatureMsPerMove:data.games.reduce((n,g)=>n+g.featureMs,0)/totalMoves,selectionMsPerMove:data.games.reduce((n,g)=>n+g.selectionMs,0)/totalMoves}};
writeFileSync(root+'/summary.json',JSON.stringify(summary,null,2));
writeFileSync(root+'/games.pgn',data.games.map(g=>readFileSync(`${root}/game-${g.id}.pgn`,'utf8')).join('\n\n'));
console.table(rows.map(({elo,profile,wins,draws,losses,unfinished,averageCpLoss,capturesPerGame,checksPerGame,changedFraction})=>({elo,profile,wins,draws,losses,unfinished,averageCpLoss,capturesPerGame,checksPerGame,changedFraction})));
console.log(summary.performance);
