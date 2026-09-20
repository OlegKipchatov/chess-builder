export const CAPABILITY_POINTS = Object.freeze([
  [100,.05,.02,0,1,0,.05],
  [200,.10,.05,0,1,0,.08],
  [300,.15,.10,.5,1,.02,.12],
  [400,.22,.15,1,1.1,.05,.18],
  [500,.30,.23,1.2,1.2,.08,.25],
  [600,.40,.32,1.4,1.4,.10,.32],
  [700,.52,.43,1.7,1.7,.15,.40],
  [800,.65,.55,2.1,2,.20,.48],
  [900,.75,.65,2.5,2.2,.30,.57],
  [1000,.82,.73,3,2.5,.40,.66],
  [1100,.87,.80,3.5,2.8,.52,.74],
  [1200,.91,.86,4,3.1,.65,.81],
  [1300,.94,.91,4.6,3.5,.77,.87],
  [1400,.96,.94,5.2,3.8,.87,.92]
].map(([elo,threatAwareness,tacticalAwareness,calculationDepth,calculationWidth,positionalAwareness,conversionSkill])=>Object.freeze({elo,threatAwareness,tacticalAwareness,calculationDepth,calculationWidth,positionalAwareness,conversionSkill})));

export const AUXILIARY_POINTS = Object.freeze([
  {elo:100,evaluationAccuracy:.10,openingDiscipline:.05,oversightResistance:.90},
  {elo:600,evaluationAccuracy:.45,openingDiscipline:.40,oversightResistance:.97},
  {elo:1000,evaluationAccuracy:.75,openingDiscipline:.75,oversightResistance:.99},
  {elo:1400,evaluationAccuracy:.93,openingDiscipline:.93,oversightResistance:.997}
].map(Object.freeze));

export const CONFIG = Object.freeze({
  id:'cognitive-v2',calibrationVersion:9,
  minElo:100,maxElo:1400,targetEloOffset:100,sessionSigma:40,varianceLimit:60,
  nativeStockfishFromElo:1400,seedMax:4294967295,
  rootIdeaLimit:16,searchRootLimit:6,technicalDepthCap:2,maxNodes:2400,
  pieceValue:Object.freeze({p:100,n:320,b:335,r:500,q:900,k:0}),
  perception:Object.freeze({attentionNoise:.32,loadPenalty:1.35,obviousnessScale:1.25}),
  complexity:Object.freeze({moves:36,captures:8,forcing:7,attacked:8}),
  selection:Object.freeze({lowTemperature:160,highTemperature:4,minimumWeight:1e-8}),
  evaluation:Object.freeze({noiseAt100:185,noiseAt1400:12,tempo:8,bishopPair:22,passedPawn:18}),
  profile:Object.freeze({maximumAdjustment:34})
});

export const CALIBRATION = Object.freeze({capabilities:CAPABILITY_POINTS,auxiliary:AUXILIARY_POINTS});
