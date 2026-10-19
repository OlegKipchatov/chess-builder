export const ANALYSIS_VERSION = "post-game-analysis-v11";
export const PROFILE = Object.freeze({
  version: "post-game-profile-v1",
  quickNodes: 75000,
  deepNodes: 300000,
  multiPv: 3,
  maxEvents: 8,
  maxPositive: 2,
  bestCluster: 0.005,
  excellentLoss: 0.015,
  significantGap: 0.05,
  thresholds: [0.005, 0.025, 0.06, 0.15],
});
export const ENGINE = Object.freeze({
  name: "Stockfish",
  version: "stockfish-19",
  nnue: "nn-61e7af4bb97d.nnue",
});
