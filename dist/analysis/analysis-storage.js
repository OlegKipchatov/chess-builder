import {ANALYSIS_VERSION,PROFILE,ENGINE} from './analysis-config.js?v=74';
import {Chess} from '../chess.js?v=74';
export const eligibleEntry = entry => {
 if(!entry||entry.counted===false||entry.engineFailure||entry.mode!=='bot'||!entry.finishedAt||!['w','b'].includes(entry.playerColor))return false;
 try {const game=new Chess();game.loadPgn(entry.pgn);return game.history({verbose:true}).some(move=>move.color===entry.playerColor);} catch {return false;}
};
export const isCompatible = (analysis,entry) => analysis?.status==='complete'&&analysis.analysisVersion===ANALYSIS_VERSION&&analysis.profileVersion===PROFILE.version&&analysis.engine?.version===ENGINE.version&&analysis.engine?.nnue===ENGINE.nnue&&analysis.gameId===entry.id&&analysis.playerColor===entry.playerColor&&analysis.sourcePgn===entry.pgn&&Array.isArray(analysis.moves)&&analysis.moves.length===analysis.totalPlies;
export const attachAnalysis = (state,id,analysis) => ({...state,archive:state.archive.map(entry=>entry.id===id&&analysis.gameId===id&&entry.pgn===analysis.sourcePgn?{...entry,analysis:{...analysis,diagnostics:undefined}}:entry)});
// Preserve old versions for display of the archive; compatibility gates reuse.
export const restoreAnalysis = (value,entry) => value&&value.gameId===entry.id&&Array.isArray(value.moves)&&Array.isArray(value.focusEvents)&&value.moves.length<=2000&&['complete','partial','failed'].includes(value.status)?structuredClone(value):undefined;
