import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {Chess} from '../../dist/chess.js';
import {createStockfishClient} from '../../dist/stockfish-client.js';
import {spawnStockfish} from '../stockfish-process.mjs';
import {selectCandidate,seededRandom,positionSeed,qualityFor} from '../../dist/difficulty-model.js';
import {PLAY_STYLES,applyPlayStyle,candidateFeatures,styleScore} from '../../dist/play-style.js';
import {DIFFICULTY} from '../../dist/difficulty-config.js';
const profiles=Object.keys(PLAY_STYLES),elos=[600,1000,1400,1600],root='docs/ai/results/play-styles';
mkdirSync(root,{recursive:true});
const choose=(game,analysis,elo,seed,profile,features)=>{
 const baseline=selectCandidate(analysis.candidates,elo,analysis.context,seededRandom(positionSeed(seed,game.fen())));
 const selected=applyPlayStyle({game,candidates:analysis.candidates,baseline,profile,seed,features});
 return {baseline,selected};
};
const diagnostics=()=>{
 const positions=JSON.parse(readFileSync('docs/ai/results/search-budget.json'))[1].positions,rows=[];
 for(const elo of elos)for(const profile of ['default',...profiles]){
  let total=0,changed=0,loss=0,cpN=0,referenceLoss=0,score=0,baseScore=0,featureMs=0;const quality={},featureTotals={attack:0,safety:0,position:0,complexity:0,exchange:0},examples=[];
  for(const p of positions){
   const game=new Chess(p.fen),start=performance.now(),features=candidateFeatures(game,p.candidates);featureMs+=performance.now()-start;
   for(let i=0;i<1000;i++){
    const seed=20260913+i,{baseline,selected}=choose({fen:()=>p.fen},p,elo,seed,profile,features),f=features.get(selected.move);
    total++;changed+=selected!==baseline;quality[qualityFor(selected.evaluationLoss)]=(quality[qualityFor(selected.evaluationLoss)]||0)+1;
    if(p.candidates.every(c=>c.mate===null)){loss+=selected.evaluationLoss;cpN++;}
    referenceLoss+=p.reference.candidates.find(c=>c.move===selected.move).evaluationLoss;
    for(const key of Object.keys(featureTotals))featureTotals[key]+=f[key];
    if(profile!=='default'){score+=styleScore(f,profile);baseScore+=styleScore(features.get(baseline.move),profile);}
    if(selected!==baseline&&examples.length<6)examples.push({fen:p.fen,seed,baseline:baseline.move,selected:selected.move,baselineLoss:baseline.evaluationLoss,loss:selected.evaluationLoss,features:f});
   }
  }
  rows.push({elo,profile,total,changedFraction:changed/total,cpLoss:100*loss/cpN,referenceUtilityLoss:referenceLoss/total,quality,styleScore:score/total,baselineStyleScore:baseScore/total,features:Object.fromEntries(Object.entries(featureTotals).map(([k,v])=>[k,v/total])),featureMsPerPosition:featureMs/positions.length,examples});
 }
 const pairwise=[];
 for(const elo of elos){const counts={};let total=0;
  for(const p of positions){const game=new Chess(p.fen),features=candidateFeatures(game,p.candidates),snapshot={fen:()=>p.fen};
   for(let i=0;i<1000;i++){const seed=20260913+i,baseline=selectCandidate(p.candidates,elo,p.context,seededRandom(positionSeed(seed,p.fen)));
    const selected=profiles.map(profile=>applyPlayStyle({game:snapshot,candidates:p.candidates,baseline,profile,seed,features}));total++;
    for(let a=0;a<profiles.length;a++)for(let b=a+1;b<profiles.length;b++){const key=profiles[a]+'/'+profiles[b];counts[key]=(counts[key]||0)+(selected[a]!==selected[b]);}
   }
  }
  pairwise.push({elo,total,differences:Object.fromEntries(Object.entries(counts).map(([k,n])=>[k,n/total]))});
 }
 writeFileSync(root+'/positions.json',JSON.stringify({seed:20260913,iterationsPerPosition:1000,rows,pairwise},null,2));console.table(rows.map(({elo,profile,changedFraction,cpLoss,styleScore,baselineStyleScore})=>({elo,profile,changedFraction,cpLoss,styleScore,baselineStyleScore})));
};
const empty=()=>({moves:0,cpMoves:0,cpLoss:0,utilityLoss:0,rank:0,captures:0,checks:0,changed:0,features:{attack:0,safety:0,position:0,complexity:0,exchange:0},choices:{},quality:{}});
const tournament=async()=>{
 const jobs=[];
 for(const elo of elos)for(let a=0;a<profiles.length;a++)for(let b=a+1;b<profiles.length;b++)for(let pair=0;pair<2;pair++)for(let swap=0;swap<2;swap++)jobs.push({id:jobs.length,elo,white:profiles[swap?b:a],black:profiles[swap?a:b],seed:20260913+pair*1009});
 const games=[];let next=0;
 const lane=async()=>{
  const client=createStockfishClient(()=>spawnStockfish(19));
  const ask=data=>new Promise((resolve,reject)=>{client.onmessage=({data})=>resolve(data);client.onerror=reject;client.postMessage(data);});
  try{while(next<jobs.length){
   const job=jobs[next++];
   if(process.argv.includes('--resume')&&existsSync(`${root}/game-${job.id}.json`)){
    const saved=JSON.parse(readFileSync(`${root}/game-${job.id}.json`)),replay=new Chess();replay.loadPgn(readFileSync(`${root}/game-${job.id}.pgn`,'utf8'));
    if(Object.keys(job).some(k=>job[k]!==saved[k])||replay.history().length!==saved.plies)throw Error('Invalid saved tournament game');
    games.push(saved);continue;
   }
   const game=new Chess(),stats={w:empty(),b:empty()};let engineMs=0,featureMs=0,selectionMs=0,materialAt20=null,queenCaptures={w:0,b:0};
   for(let ply=0;ply<240&&!game.isGameOver();ply++){
    const side=game.turn(),profile=side==='w'?job.white:job.black,seed=job.seed;
    const response=await ask({id:ply,fen:game.fen(),pgn:game.pgn(),analysisOnly:true,engineProfile:{id:'humanized19-v1',targetElo:job.elo,effectiveElo:job.elo,seed}});
    if(response.recovered||!response.analysis?.candidates.length)throw Error('Incomplete tournament analysis');
    const analysis=response.analysis;engineMs+=response.durationMs;
    let start=performance.now();const features=candidateFeatures(game,analysis.candidates);featureMs+=performance.now()-start;
    start=performance.now();const {baseline,selected}=choose(game,analysis,job.elo,seed,profile,features);selectionMs+=performance.now()-start;
    const s=stats[side];s.moves++;s.changed+=selected!==baseline;s.utilityLoss+=selected.evaluationLoss;s.rank+=analysis.candidates.indexOf(selected)+1;
    if(analysis.candidates.every(c=>c.mate===null)){s.cpMoves++;s.cpLoss+=100*selected.evaluationLoss;}
    const q=qualityFor(selected.evaluationLoss);s.quality[q]=(s.quality[q]||0)+1;
    const key=game.fen().split(' ').slice(0,4).join(' ')+'|'+selected.move;s.choices[key]=(s.choices[key]||0)+1;
    for(const k of Object.keys(s.features))s.features[k]+=features.get(selected.move)[k];
    const move=game.move({from:selected.move.slice(0,2),to:selected.move.slice(2,4),...(selected.move[4]?{promotion:selected.move[4]}:{})});
    s.captures+=!!move.captured;s.checks+=game.isCheck();if(move.captured==='q')queenCaptures[side]++;
    if(ply===39)materialAt20=game.board().flat().filter(Boolean).reduce((n,p)=>n+DIFFICULTY.pieceValue[p.type],0);
   }
   const result=game.isCheckmate()?(game.turn()==='w'?'0-1':'1-0'):game.isDraw()?'1/2-1/2':'*';
   const record={...job,result,termination:game.isCheckmate()?'checkmate':game.isStalemate()?'stalemate':game.isThreefoldRepetition()?'repetition':game.isInsufficientMaterial()?'insufficient':game.isDraw()?'draw':'ply-limit',plies:game.history().length,materialAt20,queenExchangePairs:Math.min(queenCaptures.w,queenCaptures.b),stats,engineMs,featureMs,selectionMs};
   for(const [key,value] of Object.entries({Event:'GachaChess style screening',White:job.white,Black:job.black,WhiteElo:String(job.elo),BlackElo:String(job.elo),Result:result,Seed:String(job.seed)}))game.setHeader(key,value);
   writeFileSync(`${root}/game-${job.id}.pgn`,game.pgn());writeFileSync(`${root}/game-${job.id}.json`,JSON.stringify(record));games.push(record);
   console.log(JSON.stringify({done:games.length,total:jobs.length,id:job.id,elo:job.elo,white:job.white,black:job.black,result,plies:record.plies}));
  }}finally{client.terminate();}
 };
 await Promise.all(Array.from({length:4},()=>lane()));
 writeFileSync(root+'/tournament.json',JSON.stringify({elos,gamesPerPair:4,search:{depth:DIFFICULTY.analysisDepth,nodes:DIFFICULTY.analysisNodes,multiPv:DIFFICULTY.multiPv},lanes:4,maxPlies:240,games:games.sort((a,b)=>a.id-b.id)},null,2));
};
if(process.argv.includes('--positions'))diagnostics();else await tournament();
