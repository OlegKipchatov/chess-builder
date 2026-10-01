import {escapeHTML as esc} from '../primitives.js?v=72';
import {explanationFor,qualityLabel} from '../../analysis/analysis-explanations.js?v=72';
export const insightLines = move => {
 if(move?.actor!=='player'||move.status!=='complete')return [];
 const primary=move.expectedScoreLoss>.005||move.recommendationRequired?move.bestLine:move.playedLine;
 return [primary,...move.alternatives].filter((line,index,lines)=>line&&lines.findIndex(other=>other?.move===line.move)===index);
};
const variationButton = (line,label) => `<button type="button" class="quiet analysis-variation" data-analysis-line="${esc(line.move)}" aria-pressed="false" aria-label="Показать вариант ${esc(label)}">${esc(label)}</button>`;
const variationControls = '<div class="analysis-variation-controls"><button type="button" class="quiet" data-variation-back aria-label="Назад по варианту">←</button><button type="button" class="quiet" data-variation-next aria-label="Вперёд по варианту">→</button></div>';
export const analysisInsight = move => {
 if(!move)return '<h2>Начальная позиция</h2><p>Просматривайте ходы самостоятельно или включите воспроизведение. На важных моментах оно остановится.</p>';
 if(move.actor==='opponent')return `<h2>Ход соперника</h2><p>${esc(move.playedSan)}</p>`;
 if(move.status!=='complete')return `<h2>Ход ${esc(move.playedSan)}</h2><p>Не удалось оценить этот ход. Можно повторить анализ.</p>`;
 const label=move.reason==='allowed_mate'?'Допущен мат':move.reason==='mate_opportunity'?'Матовая возможность':move.reason==='missed_mate'?'Упущен мат':move.highlight?'Отличный ход':qualityLabel[move.quality];
 const recommend=move.expectedScoreLoss>.005||move.recommendationRequired;
 const pv=(recommend?move.bestLine:move.playedLine).pvSan||[];
 const lines=insightLines(move),primary=lines[0];
 const explanation=explanationFor(move);
 return `<h2 data-quality="${esc(move.highlight||move.quality)}">${esc(label)}</h2><p>Вы сыграли: <strong>${esc(move.playedSan)}</strong></p>${explanation?`<p>${esc(explanation)}</p>`:''}${recommend?`<p>Вместо сыгранного хода: <strong>${esc(move.bestLine.san||move.bestLine.move)}</strong></p>`:''}${primary?`<div class="analysis-pv">Вариант: ${variationButton(primary,pv.length?pv.join(' '):primary.san||primary.move)}</div>`:''}${lines.length>1?`<div class="analysis-alternatives">Также: ${lines.slice(1).map(line=>variationButton(line,line.san||line.move)).join(' ')}</div>`:''}<div class="analysis-variation-context" hidden><p role="status" data-analysis-context></p>${variationControls}<button type="button" class="quiet" data-analysis-return>К сыгранному ходу</button></div>`;
};
