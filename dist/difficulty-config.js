export const DIFFICULTY = Object.freeze({
  minHumanElo:400,maxHumanElo:1600,targetEloOffset:100,sessionSigma:40,varianceLimit:120,
  multiPv:32,analysisDepth:10,analysisNodes:500000,
  hashMb:16,watchdogMs:15000,initializationMs:60000,
  thresholds:[0.15,0.40,0.90,1.80],
  errors:{inaccuracy:{max:.35,power:1.2},mistake:{max:.28,power:2.3},blunder:{max:.16,power:3}},
  errorMultiplier:1.15,
  best:{base:.10,gain:.45,power:1.3},maxErrorMass:.95,
  complexity:{min:.75,max:1.5,manyMoves:30,manyBonus:.10,equalLoss:.15,equalCount:3,equalBonus:.10,tactics:5,tacticalBonus:.20,forcedMoves:2,forcedDiscount:.25},
  phase:{opening:.75,middlegame:1,endgame:1.15,openingPlies:16,endgameMaterial:16},
  winning:{evaluation:3,maxBonus:.25,fadeStart:600,fadeEnd:1200},
  mate:{one:{min:.65,power:3.4},two:{min:.20,power:1.65},base:100,distance:.1,maxDistance:50,cpBound:50},
  temperature:{min:.5,gain:2.5},guard:{majorValue:5,lossThreshold:1.8,weight:.15,rescueProbability:.60},
  pieceValue:{p:1,n:3,b:3,r:5,q:9,k:0},seedMax:4294967295
});
