import {iconButton} from '../primitives.js?v=67';

const control = (id,label,path,hidden=false) => iconButton({
  id,label,hidden,variant:'secondary',
  icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}" /></svg>`
});

export const moveNavigation = () => `<div class="history-controls" role="group" aria-label="История ходов">
  <div class="history-buttons">
    ${control('history-back','Предыдущая позиция','m15 5-7 7 7 7')}
    ${control('replay-start','Начать воспроизведение','m7 4 13 8-13 8z',true)}
    ${control('replay-pause','Приостановить воспроизведение','M8 4v16M16 4v16',true)}
    ${control('history-forward','Следующая позиция','m9 5 7 7-7 7')}
    ${control('history-live','К текущему ходу','m5 5 9 7-9 7zM19 5v14')}
  </div>
  <span id="history-position" aria-live="polite">0 / 0</span>
</div>`;
