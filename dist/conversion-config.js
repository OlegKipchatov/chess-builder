/** Cognitive 2.1: local technical endings, independent of Elo calibration. */
export const CONVERSION = Object.freeze({
 version:'conversion-1',enabled:true,maxPieces:6,rootCap:8,beam:4,
 depth:4,maxNodes:3000,progressWeight:360,orderingWeight:140,
 rescueDepth:6,rescueNodes:6500,rescueAfter:6,
 featureWeights:Object.freeze({cage:.50,edgePressure:.20,kingProximity:.20,confinement:.05,coverage:.05}),
 repeatPenalty:180,progressEpsilon:.025,stagnationCap:360,
 temperatureScale:.30,styleScale:.25,styleCap:12,
});
