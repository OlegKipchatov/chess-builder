// Startup budget covers both variant attempts and serialized retirement.
// Economy request budget includes startup plus its original 20-second search allowance.
// Search strength, node budgets and analysis watchdog are identical for both variants.
export const STOCKFISH = Object.freeze({hashMb:16,milliseconds:1500,nodes:20000,stopAfterMs:2000,watchdogMs:3500,variantInitializationMs:20000,retirementMs:750,initializationMs:42000,economyRequestMs:65000,analysisWatchdogMs:45000,minElo:1320,maxElo:3190});
