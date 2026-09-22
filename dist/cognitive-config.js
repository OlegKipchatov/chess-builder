// Cognitive v2 calibration 9, promoted unchanged. Values are hypotheses, not human statistics.
export const CONTROL_POINTS = [
 [100,.05,.02,0,1,0,.05],[200,.10,.05,0,1,0,.08],[300,.15,.10,.5,1,.02,.12],
 [400,.22,.15,1,1.1,.05,.18],[500,.30,.23,1.2,1.2,.08,.25],[600,.40,.32,1.4,1.4,.10,.32],
 [700,.52,.43,1.7,1.7,.15,.40],[800,.65,.55,2.1,2,.20,.48],[900,.75,.65,2.5,2.2,.30,.57],
 [1000,.82,.73,3,2.5,.40,.66],[1100,.87,.80,3.5,2.8,.52,.74],[1200,.91,.86,4,3.1,.65,.81],
 [1300,.94,.91,4.6,3.5,.77,.87],[1400,.96,.94,5.2,3.8,.87,.92]
];
export const EXTRA_POINTS = [[100,.10,.05,.90],[600,.45,.40,.97],[1000,.75,.75,.99],[1400,.93,.93,.997]];
export const CONFIG = Object.freeze({version:'cognitive-v2.1-conversion-1',minElo:100,maxElo:1400,nativeStockfishFromElo:1400,technicalDepthCap:2,
 offset:-100,sigma:40,varianceLimit:60,maxNodes:2000,maxRoot:16,searchRootMax:6,rootBase:2,rootWidth:1.5,
 values:{p:100,n:320,b:335,r:500,q:900,k:0},
 complexity:{moves:40,forcing:12,exposed:8,weights:[.25,.30,.30,.15]},
 salience:{normal:.5,major:.75,queen:1},attention:{boostMin:2,boostMax:12,loadPenalty:2,noise:.10},
 valueUncertainty:.1,threatWeight:.8,escapeDiscount:0,temperature:{low:65,high:6,load:.6},
 positionWeight:18,development:25,checkBonus:120,checkEvaluationBonus:260,profileStrength:48,repeatPenalty:24,earlyQueenPenalty:30,castleBonus:30,
 terminalValue:100000,winningMaterial:200,conversionExchange:25,
 errorThresholds:[15,20,70,180]
});
