import {escapeHTML as esc} from '../primitives.js?v=71';
import {explanationFor,qualityLabel} from '../../analysis/analysis-explanations.js?v=71';
export const analysisInsight = move => {
 if(!move)return '<h2>Начальная позиция</h2><p>Просматривайте ходы самостоятельно или включите воспроизведение. На важных моментах оно остановится.</p>';
 if(move.actor==='opponent')return `<h2>Ход соперника</h2><p>${esc(move.playedSan)}</p><p class="muted">В разборе оцениваются ваши решения.</p>`;
 if(move.status!=='complete')return `<h2>Ход ${esc(move.playedSan)}</h2><p>Не удалось оценить этот ход. Можно повторить анализ.</p>`;
 const label=move.reason==='allowed_mate'?'Допущен мат':move.reason==='missed_mate'?'Упущен мат':move.highlight?'Отличный ход':qualityLabel[move.quality];
 const recommend=move.expectedScoreLoss>.005||move.recommendationRequired;
 const pv=(recommend?move.bestLine:move.playedLine).pvSan||[];
 return `<h2 data-quality="${esc(move.highlight||move.quality)}">${esc(label)}</h2><p>Вы сыграли: <strong>${esc(move.playedSan)}</strong></p><p>${esc(explanationFor(move))}</p>${recommend?`<p>Вместо сыгранного хода: <strong>${esc(move.bestLine.san||move.bestLine.move)}</strong></p>`:''}${pv.length?`<p class="analysis-pv">Вариант: ${esc(pv.join(' '))}</p>`:''}${move.alternatives.filter(line=>!recommend||line.move!==move.bestLine.move).length?`<p class="muted">Также: ${esc(move.alternatives.filter(line=>!recommend||line.move!==move.bestLine.move).map(line=>line.san||line.move).join(', '))}</p>`:''}<p class="muted">Ожидаемый результат: ${Math.round(move.bestLine.expectedScorePlayer*100)}% → ${Math.round(move.playedLine.expectedScorePlayer*100)}%<br><small>Вероятность победы + половина вероятности ничьей.</small></p>`;
};
