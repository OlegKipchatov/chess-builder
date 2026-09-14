import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess} from '../dist/chess.js';
import {PLAY_STYLES,STYLE_CONFIG,candidateFeatures,applyPlayStyle,styleEnvelope,styleScore,validPlayStyle} from '../dist/play-style.js';
import {selectCandidate,seededRandom,positionSeed,createDifficultyProfile,qualityFor} from '../dist/difficulty-model.js';
import {createStartedGame} from '../dist/session.js';
import {initialState,migrateState} from '../dist/state.js';
import {validEngineProfile} from '../dist/strength.js';
import {exportPgn} from '../dist/pgn-export.js';
const positions=JSON.parse(readFileSync('docs/ai/results/search-budget.json'))[1].positions;
test('Four validated profiles with used, finite coefficients; explicit default',()=>{
 assert.equal(Object.keys(PLAY_STYLES).length,4);
 for(const [id,p] of Object.entries(PLAY_STYLES)){assert.equal(p.id,id);assert.ok(p.name);for(const k of ['attack','safety','position','complexity','exchange'])assert.ok(Number.isFinite(p[k]));}
 assert.ok(validPlayStyle(undefined));assert.ok(validPlayStyle('default'));assert.equal(validPlayStyle('unknown'),false);assert.equal(validPlayStyle(null),false);
 assert.throws(()=>createDifficultyProfile(900,()=>.5,undefined,{profile:'unknown'}));
});
test('Profile assignment survives session, migration and PGN; absent profile retains shape and strength RNG',()=>{
 const baseline=createDifficultyProfile(900,()=>.5),styled=createDifficultyProfile(900,()=>.5,undefined,{profile:'aggressive'});
 assert.deepEqual(styled,{...baseline,profile:'aggressive'});assert.ok(validEngineProfile(styled));assert.equal(validEngineProfile({...styled,profile:'no'}),false);
 const state=initialState();state.game=createStartedGame(state,()=>.5,{profile:'positional'});
 assert.equal(migrateState(state).game.engineProfile.profile,'positional');
 assert.match(exportPgn(new Chess(),state.game),/BotPlayStyle "positional"/);
});
test('Default identity, determinism, legality and Elo envelope over fixed positions, sides and seeds',()=>{
 for(const p of positions){
  const game=new Chess(p.fen),fen=game.fen(),features=candidateFeatures(game,p.candidates),legal=new Set(game.moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||'')));
  assert.equal(game.fen(),fen);
  for(const elo of [600,1000,1400,1600])for(let seed=0;seed<40;seed++){
   const baseline=selectCandidate(p.candidates,elo,p.context,seededRandom(positionSeed(seed,p.fen)));
   const args={game,candidates:p.candidates,baseline,seed,features};
   assert.equal(applyPlayStyle(args),baseline);assert.equal(applyPlayStyle({...args,profile:'default'}),baseline);
   for(const profile of Object.keys(PLAY_STYLES)){
    const selected=applyPlayStyle({...args,profile});
    assert.equal(selected,applyPlayStyle({...args,profile}));assert.ok(p.candidates.includes(selected));assert.ok(legal.has(selected.move));
    assert.equal(qualityFor(selected.evaluationLoss),qualityFor(baseline.evaluationLoss));assert.equal(selected.mate,baseline.mate);
    assert.ok(Math.abs(selected.evaluationLoss-baseline.evaluationLoss)<=STYLE_CONFIG.maxLossDifference+1e-9);
    assert.equal(selected.guardWeight<1,baseline.guardWeight<1);
   }
  }
 }
});
test('Envelope cannot turn a quiet good move into a 250cp attack or bypass mate/guard',()=>{
 const b={move:'e2e4',evaluationLoss:0,mate:null,guardWeight:1};
 const others=[{...b,move:'d2d4',evaluationLoss:.14},{...b,move:'f2f4',evaluationLoss:2.5},{...b,move:'g2g4',guardWeight:.15},{...b,move:'a2a4',mate:1}];
 assert.deepEqual(styleEnvelope([b,...others],b),[b,others[0]]);
});
test('Features expose captures, direct queen exchange and castling safety',()=>{
 const game=new Chess('4k3/8/8/3q4/3Q4/8/8/4K3 w - - 0 1');
 const f=candidateFeatures(game,[{move:'d4d5'}]).get('d4d5');assert.equal(f.queenTrade,true);assert.equal(f.isCapture,true);assert.equal(f.exchange,1);
 const castle=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');assert.ok(candidateFeatures(castle,[{move:'e1g1'}]).get('e1g1').safety>0);
});
test('Style vectors have distinct directional preferences',()=>{
 const zero={attack:0,safety:0,position:0,complexity:0,exchange:0};
 for(const [profile,key] of [['aggressive','attack'],['solid','safety'],['positional','position'],['tricky','complexity']])assert.equal(styleScore({...zero,[key]:1},profile),1);
 assert.ok(styleScore({...zero,exchange:1},'solid')>styleScore({...zero,exchange:1},'aggressive'));
});
test('Color rotation gives equivalent style features',()=>{
 const white=new Chess('4k3/6p1/8/8/8/8/1P6/4K3 w - - 0 1');
 const black=new Chess('3k4/6p1/8/8/8/8/1P6/3K4 b - - 0 1');
 const a=candidateFeatures(white,[{move:'b2b4'}]).get('b2b4'),b=candidateFeatures(black,[{move:'g7g5'}]).get('g7g5');
 for(const key of Object.keys(a))assert.ok(typeof a[key]==='number'?Math.abs(a[key]-b[key])<1e-9:a[key]===b[key],key);
});
test('Single forced candidate and promotion remain legal; caller position unchanged',()=>{
 const game=new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1'),baseline={move:'a7a8q',evaluationLoss:0,mate:null,guardWeight:1};
 const fen=game.fen();candidateFeatures(game,[baseline]);assert.equal(game.fen(),fen);
 assert.equal(applyPlayStyle({game,candidates:[baseline],baseline,profile:'tricky',seed:1}),baseline);
 assert.throws(()=>applyPlayStyle({game,candidates:[],baseline,profile:'tricky',seed:1}));
});
test('Statistical style preference improves its own feature score without changing quality mass',()=>{
 for(const profile of Object.keys(PLAY_STYLES)){
  let beforeScore=0,afterScore=0,changed=0,total=0,lossDelta=0;
  const beforeQuality={},afterQuality={};
  for(const p of positions){const features=candidateFeatures(new Chess(p.fen),p.candidates),game={fen:()=>p.fen};
   for(let seed=100;seed<400;seed++){
    const baseline=selectCandidate(p.candidates,1000,p.context,seededRandom(positionSeed(seed,p.fen))),selected=applyPlayStyle({game,candidates:p.candidates,baseline,seed,profile,features});
    beforeScore+=styleScore(features.get(baseline.move),profile);afterScore+=styleScore(features.get(selected.move),profile);
    total++;changed+=selected!==baseline;lossDelta+=selected.evaluationLoss-baseline.evaluationLoss;
    const b=qualityFor(baseline.evaluationLoss),a=qualityFor(selected.evaluationLoss);beforeQuality[b]=(beforeQuality[b]||0)+1;afterQuality[a]=(afterQuality[a]||0)+1;
   }
  }
  assert.deepEqual(afterQuality,beforeQuality);assert.ok(afterScore>beforeScore,profile);
  assert.ok(changed/total>.03&&changed/total<.4,profile);assert.ok(Math.abs(lossDelta/total)<.02,profile);
 }
});
test('Named opponents: all four styles can be drawn and their names survive game state and PGN',async()=>{
 const {randomPlayStyle,playStyleName}=await import('../dist/play-style-config.js');
 for(const [index,id] of Object.keys(PLAY_STYLES).entries()){
  assert.equal(randomPlayStyle(()=>index/4+.01),id);
  const state=initialState();state.game=createStartedGame(state,()=>.5,{profile:id});
  const restored=migrateState(state).game;
  assert.equal(playStyleName(restored.engineProfile.profile),PLAY_STYLES[id].name);
  const pgn=new Chess();pgn.loadPgn(exportPgn(new Chess(),restored));
  assert.equal(pgn.getHeaders()[restored.playerColor==='w'?'Black':'White'],PLAY_STYLES[id].name);
 }
 assert.equal(playStyleName(undefined),'ИИ');assert.equal(playStyleName('default'),'ИИ');assert.equal(playStyleName('unknown'),'ИИ');
});
