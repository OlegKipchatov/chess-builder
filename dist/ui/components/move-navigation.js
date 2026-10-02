import {iconButton} from '../primitives.js?v=84';
import {motionDuration} from '../motion.js?v=84';

const control = (id,label,path,hidden=false) => iconButton({
  id,label,hidden,variant:'secondary',
  icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}" /></svg>`
});

export const moveNavigation = (prefix='') => `<div class="history-controls" role="group" aria-label="История ходов">
  <div class="history-buttons">
    ${control('history-back','Предыдущая позиция','m15 5-7 7 7 7')}
    ${control('replay-start','Начать воспроизведение','m7 4 13 8-13 8z',true)}
    ${control('replay-pause','Приостановить воспроизведение','M8 4v16M16 4v16',true)}
    ${control('history-forward','Следующая позиция','m9 5 7 7-7 7')}
    ${control('history-live','К текущему ходу','m5 5 9 7-9 7zM19 5v14')}
  </div>
  <span id="history-position" aria-live="polite">0 / 0</span>
  <div class="history-timeline"><input id="history-slider" class="history-slider" type="range" min="0" max="0" step="1" value="0" aria-label="Позиция в истории партии" aria-valuetext="0 из 0" disabled><div id="history-markers" class="history-markers" role="group" aria-label="Моменты разбора" hidden></div></div>
</div>`.replace(/id="([^"]+)"/g,(_,id)=>`id="${prefix}${id}"`);

const sliderAnimations=new WeakMap();
const stopSliderAnimation=slider=>{const frame=sliderAnimations.get(slider);if(frame!==undefined)cancelAnimationFrame(frame);sliderAnimations.delete(slider);};
const setSliderPosition=(slider,value,total)=>{slider.value=String(value);slider.style.setProperty('--history-progress',`${total?value/total*100:0}%`);};
export const syncHistorySlider = (slider,ply,total,animate=false) => {
 stopSliderAnimation(slider);slider.max=String(total);slider.disabled=total===0;
 slider.setAttribute('aria-valuetext',`${ply} из ${total}`);
 if(slider.dataset?.dragging==='true')return;
 if(!animate||matchMedia('(prefers-reduced-motion: reduce)').matches){setSliderPosition(slider,ply,total);return;}
 const from=Number(slider.value),started=performance.now();
 const tick=now=>{
  const progress=Math.min(1,(now-started)/motionDuration.board);
  setSliderPosition(slider,from+(ply-from)*progress,total);
  if(progress<1)sliderAnimations.set(slider,requestAnimationFrame(tick));else sliderAnimations.delete(slider);
 };
 sliderAnimations.set(slider,requestAnimationFrame(tick));
};
const sliderBindings=new WeakMap();
export const bindHistorySlider = (slider,onSeek) => {
 sliderBindings.get(slider)?.();let frame=null;
 slider.step='any';
 const seek=()=>{frame=null;onSeek(Math.round(Number(slider.value)));};
 slider.onpointerdown=()=>{stopSliderAnimation(slider);slider.dataset.dragging='true';};
 slider.oninput=()=>{
  slider.style.setProperty('--history-progress',`${Number(slider.max)?Number(slider.value)/Number(slider.max)*100:0}%`);
  if(frame!==null)cancelAnimationFrame(frame);frame=requestAnimationFrame(seek);
 };
 const finish=()=>{stopSliderAnimation(slider);delete slider.dataset.dragging;if(frame!==null)cancelAnimationFrame(frame);slider.value=String(Math.round(Number(slider.value)));slider.style.setProperty('--history-progress',`${Number(slider.max)?Number(slider.value)/Number(slider.max)*100:0}%`);seek();};
 slider.onkeydown=event=>{
  const value=Math.round(Number(slider.value)),max=Number(slider.max);
  const targets={ArrowLeft:value-1,ArrowDown:value-1,ArrowRight:value+1,ArrowUp:value+1,PageDown:value-10,PageUp:value+10,Home:0,End:max};
  if(!(event.key in targets))return;
  event.preventDefault();slider.value=String(Math.max(0,Math.min(max,targets[event.key])));finish();
 };
 slider.onchange=finish;slider.onpointerup=finish;slider.onpointercancel=finish;
 const dispose=()=>{stopSliderAnimation(slider);if(frame!==null)cancelAnimationFrame(frame);delete slider.dataset.dragging;slider.oninput=slider.onchange=slider.onpointerdown=slider.onpointerup=slider.onpointercancel=slider.onkeydown=null;};
 sliderBindings.set(slider,dispose);return dispose;
};
