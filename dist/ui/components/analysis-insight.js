import {escapeHTML as esc} from '../primitives.js?v=75';
import {explanationFor,qualityLabel} from '../../analysis/analysis-explanations.js?v=75';
import {humanMove} from './move-list.js?v=75';
import {isImportantInsight} from '../../analysis/analysis-events.js?v=75';
export {isImportantInsight};
export const visibleVariation = move => {
 const line=move?.bestLine;if(!line)return {pv:[],san:[]};
 const contextual=line.score?.type==='mate'||['mate_opportunity','missed_mate','missed_tactic','lost_material','hung_piece'].includes(move.reason);
 const mateEnd=line.pvSan?.findIndex(san=>san.endsWith('#'))??-1;
 const length=contextual?(mateEnd>=0?mateEnd+1:4):1;
 return {pv:(line.pv||[line.move]).slice(0,length),san:(line.pvSan||[line.san||line.move]).slice(0,length)};
};
export const insightLines = move => {
 if(!isImportantInsight(move)||!move.bestLine||move.bestLine.move===move.playedMove)return [];
 if(move.expectedScoreLoss<=.005&&!['mate_opportunity','missed_mate','allowed_mate'].includes(move.reason))return [];
 return [move.bestLine];
};
export const analysisInsight = move => {
 if(!isImportantInsight(move))return '';
 const label=move.reason==='allowed_mate'?'Допущен мат':move.reason==='mate_opportunity'?'Матовая возможность':move.reason==='missed_mate'?'Упущен мат':move.highlight?'Отличный ход':qualityLabel[move.quality];
 const line=insightLines(move)[0],explanation=explanationFor(move);
 const exercise=move.exercise?'<button type="button" class="primary" data-analysis-practice>Найти мат самостоятельно</button>':'';
 // Do not reveal the solution before the user chooses to see it.
 return `<h2 data-quality="${esc(move.highlight||move.quality)}">${esc(label)}</h2><p>Вы сыграли: <strong>${esc(humanMove(move.playedSan))}</strong></p>${explanation?`<p>${esc(explanation)}</p>`:''}<div class="analysis-insight-actions">${exercise}${line?`<button type="button" class="quiet analysis-variation" data-analysis-line="${esc(line.move)}" aria-pressed="false">${move.exercise?'Показать решение':'Показать вариант'}</button>`:''}</div>`;
};
