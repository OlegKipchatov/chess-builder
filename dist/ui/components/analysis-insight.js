import {escapeHTML as esc} from '../primitives.js?v=89';
import {explanationFor,qualityLabel} from '../../analysis/analysis-explanations.js?v=89';
import {humanMove} from './move-list.js?v=89';
import {isImportantInsight} from '../../analysis/analysis-events.js?v=89';
export {isImportantInsight};
export const visibleVariation = (move,expanded=false) => {
 const line=move?.bestLine;if(!line)return {pv:[],san:[]};
 if(expanded&&move.recommendationEvidence?.pv)return {pv:move.recommendationEvidence.pv,san:[]};
 const mateEnd=line.pvSan?.findIndex(san=>san.endsWith('#'))??-1;
 const length=expanded?(mateEnd>=0?mateEnd+1:Math.min(line.pv?.length||1,4)):1;
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
 const exercise=move.exercise?'<button type="button" class="primary analysis-variation" data-analysis-practice>Найти мат</button>':'';
 // Mate exercises offer practice only; do not disclose their saved solution.
 const recommendation=!move.exercise&&line?`<button type="button" class="quiet analysis-variation" data-analysis-line="${esc(line.move)}" aria-pressed="false">Подсказка</button>`:'';
 return `<div class="analysis-insight-heading"><h2 data-quality="${esc(move.highlight||move.quality)}">${esc(label)}</h2><div class="analysis-insight-actions">${!move.exercise&&line&&visibleVariation(move,true).pv.length>1?`<button type="button" class="quiet analysis-variation" data-analysis-expand="${esc(line.move)}" hidden>Вариант</button>`:''}${exercise||recommendation}</div></div><p>Вы сыграли: <strong>${esc(humanMove(move.playedSan))}</strong></p>${explanation?`<p>${esc(explanation)}</p>`:''}${move.relatedPlies?.length>1?'<p>В следующих ходах сохранялась та же возможность. Разберём её один раз.</p>':''}${move.recommendationEvidence&&!move.recommendationEvidence.primary?`<p>${esc(move.recommendationEvidence.text)}</p>`:''}`;
};
