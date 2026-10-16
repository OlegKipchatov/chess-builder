// Test-only entry. Compiled independently; never imported by the application.
export {Chess} from 'chess.js';
export {createStockfishClient} from '../../src/services/engines/stockfish-client.js';
export {createAutoplayEngine,createAutoplaySession} from '../../src/services/engines/autochess-engine.js';
export {createBattleController} from '../../src/services/engines/autochess-battle.js';
export {createBotClient} from '../../src/services/engines/bot-client.js';
export {createSession} from '../../src/domain/cognitive/cognitive-model.js';
export {analyzeReward} from '../../src/services/engines/economy-analysis.js';
export {analyzeGame} from '../../src/services/analysis/analysis-service.js';
export {engineLine} from '../../src/domain/chess/evaluation.js';
export {verifyShortMate} from '../../src/domain/analysis/analysis-reasons.js';
export {prepareMateExercise,createMateExercise} from '../../src/services/analysis/analysis-training.js';
