import {escapeHTML as esc} from '../primitives.js?v=75';
import {syncHistorySlider,bindHistorySlider} from '../components/move-navigation.js?v=75';
import {analysisInsight,insightLines,visibleVariation} from '../components/analysis-insight.js?v=75';
import {humanMove} from '../components/move-list.js?v=75';
import {qualityLabel} from '../../analysis/analysis-explanations.js?v=75';
import {renderBoard,snapshotBoard,animateTransition,historyMoves} from '../../board.js?v=75';
import {Chess} from '../../chess.js?v=75';
import {positionAt} from '../../session.js?v=75';
import {createAnalysisPlayback} from '../../analysis/analysis-playback.js?v=75';
import {createMateExercise} from '../../analysis/analysis-training.js?v=75';

export const analysisBoardTools = () => `<div id="analysis-board-tools" hidden>
 <div id="analysis-variation-tools" hidden><p data-analysis-context role="status"></p>
 <div class="analysis-variation-controls"><button type="button" class="quiet" data-variation-back aria-label="Назад по варианту">←</button><button type="button" class="quiet" data-variation-next aria-label="Вперёд по варианту">→</button><button type="button" class="quiet" data-analysis-return>К партии</button></div></div>
 <div id="analysis-practice-tools" hidden><p data-practice-message role="status"></p><div data-practice-promotion hidden></div>
 <div class="analysis-variation-controls"><button type="button" class="primary" data-practice-continue hidden>Продолжить</button><button type="button" class="quiet" data-analysis-return>К партии</button></div></div>
 </div>`;
export const analysisInsights = () => '<div id="analysis-insight" class="analysis-insight" aria-live="polite" hidden></div><p id="analysis-summary" class="muted" hidden></p>';
export const showAnalysisProgress = ({stage,done,total}) => {
 document.querySelector('#analysis-loading').textContent=`${stage==='quick'?'Быстрый анализ':'Уточняем важные моменты'} · ${done} из ${total}${stage==='quick'?' ходов':''}`;
};
export const variationArrowPoints = (token,orientation='w') => {
 if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token||''))return null;
 const point=square=>{const x='abcdefgh'.indexOf(square[0]),y=8-Number(square[1]);return orientation==='b'?[7-x+.5,7-y+.5]:[x+.5,y+.5];};
 return [...point(token.slice(0,2)),...point(token.slice(2,4))];
};
export const mountAnalysis = ({analysis,entry,equipped,initialPly=0,onPly=()=>{}}) => {
 const $=selector=>document.querySelector(selector),root=$('#board'),game=new Chess();game.loadPgn(entry.pgn);
 let shown=0,disposed=false,transition=0,mode='game',previewStep=0,exercise=null,selected=null,promotions=[];
 const cancelAnimations=()=>root.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
 const clearMarkers=()=>root.querySelectorAll('.analysis-marker').forEach(node=>node.remove());
 const board=(position,selection=null,interactive=false)=>{
  clearMarkers();renderBoard(root,position,entry.equipped||equipped,selection,entry.playerColor);
  root.querySelectorAll('[data-square]').forEach(cell=>cell.setAttribute('aria-disabled',String(!interactive)));
 };
 const setMode=next=>{
  // Keep the page footprint when replacing an insight with compact board controls.
  // Otherwise mobile scroll anchoring/clamping moves the board under the user.
  const area=root.closest('.board-area');
  if(mode==='game'&&next!=='game')area.style.minHeight=`${area.getBoundingClientRect().height}px`;
  if(next==='game')area.style.minHeight='';
  mode=next;$('#analysis-board-tools').hidden=['game','hint'].includes(next);$('#analysis-game-controls').hidden=!['game','hint'].includes(next);
  $('#analysis-variation-tools').hidden=next!=='variation';$('#analysis-practice-tools').hidden=next!=='practice';
  $('#analysis-insight').hidden=!['game','hint'].includes(next);$('#match-surface').dataset.mode=next;
 };
 const marker=move=>{
  if(move?.status!=='complete')return;
  const mark=move.highlight?'!':({blunder:'??',mistake:'?',inaccuracy:'?!'})[move.quality];
  const cell=root.querySelector(`[data-square="${move.playedMove.slice(2,4)}"]`);
  if(cell&&mark){const span=document.createElement('span');span.className='analysis-marker analysis-badge';span.dataset.quality=move.highlight||move.quality;span.textContent=mark;span.setAttribute('aria-hidden','true');cell.append(span);}
 };
 const showVariation=(token,step=0)=>{
  const move=analysis.moves[shown-1],line=insightLines(move).find(line=>line.move===token);
  if(!line||disposed)return;
  const entering=mode!=='variation',position=new Chess(move.fenBefore),{pv}=visibleVariation(move);
  previewStep=Math.max(0,Math.min(step,pv.length));
  for(const next of pv.slice(0,previewStep))position.move({from:next.slice(0,2),to:next.slice(2,4),promotion:next[4]});
  playback.pause();transition++;cancelAnimations();exercise=null;setMode(pv.length===1?'hint':'variation');board(position);
  root.setAttribute('aria-label',`Вариант: ${previewStep} / ${pv.length}`);root.dataset.variation=token;
  const points=variationArrowPoints(pv[previewStep],entry.playerColor);
  if(points){
   const [x1,y1,x2,y2]=points;
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 8 8');svg.setAttribute('aria-hidden','true');svg.classList.add('analysis-marker','analysis-arrow');
   svg.innerHTML=`<defs><marker id="analysis-tip" markerWidth="3" markerHeight="3" refX="2.3" refY="1.5" orient="auto"><path d="M0 0L3 1.5L0 3z" fill="currentColor"/></marker></defs><path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="currentColor" stroke-width=".1" marker-end="url(#analysis-tip)"/>`;root.append(svg);
  }
  $('[data-analysis-context]').textContent=position.isCheckmate()?'Мат':previewStep===0?'Рекомендуемое продолжение':'Вариант';
  if(pv.length===1){const button=$('[data-analysis-line]');button.textContent='Скрыть подсказку';button.setAttribute('aria-pressed','true');}
  $('[data-variation-back]').disabled=previewStep===0;$('[data-variation-next]').disabled=previewStep===pv.length;
  if(entering&&pv.length>1)$('[data-variation-next]').focus({preventScroll:true});
 };
 const renderExercise=()=>{
  if(!exercise||disposed)return;
  const {state,mateIn}=exercise.getSnapshot(),interactive=state==='awaitMove'&&!promotions.length;
  board(exercise.game,selected,interactive);root.setAttribute('aria-label','Задание: найдите мат');
  $('#match-surface').dataset.practice=state;
  $('[data-practice-message]').textContent=({awaitMove:exercise.game.history().length?'Найдите завершающий ход.':`Найдите мат ${mateIn===1?'в один ход':'в два хода'}.`,wrong:'Этот ход не приводит к мату за отведённое число ходов. Попробуйте другое продолжение.',correct:'',opponent:'Соперник отвечает…',success:'Мат! Вы нашли решение.'})[state];
  const next=$('[data-practice-continue]');next.hidden=['awaitMove','correct','opponent'].includes(state);next.textContent=state==='wrong'?'Попробовать снова':state==='success'?'Продолжить разбор':'Продолжить';
  const promotion=$('[data-practice-promotion]');promotion.hidden=!promotions.length;
  promotion.innerHTML=promotions.length?`<p>Выберите фигуру:</p>${promotions.map(move=>`<button type="button" class="quiet" data-practice-promote="${move.from+move.to+move.promotion}">${({q:'Ферзь',r:'Ладья',b:'Слон',n:'Конь'})[move.promotion]}</button>`).join('')}`:'';
 };
 const startExercise=()=>{
  const data=analysis.moves[shown-1]?.exercise;if(!data||disposed)return;
  playback.pause();transition++;cancelAnimations();exercise=createMateExercise(data);selected=null;promotions=[];
  delete root.dataset.variation;setMode('practice');renderExercise();
  root.querySelector(`[data-square="${exercise.game.moves({verbose:true})[0]?.from}"]`)?.focus({preventScroll:true});
 };
 const submitExercise=async token=>{
  if(!exercise)return;const owned=exercise,generation=++transition,before=snapshotBoard(root);
  exercise.submit(token);selected=null;promotions=[];renderExercise();
  if(owned.getSnapshot().state==='correct'){
   await animateTransition(root,[owned.game.history({verbose:true}).at(-1)],before);
   if(disposed||exercise!==owned||generation!==transition)return;
   const replyBefore=snapshotBoard(root);owned.continue();renderExercise();
   await animateTransition(root,[owned.game.history({verbose:true}).at(-1)],replyBefore);
   if(disposed||exercise!==owned||generation!==transition)return;
   owned.continue();renderExercise();return;
  }
  if(!$('[data-practice-continue]').hidden)$('[data-practice-continue]').focus({preventScroll:true});
 };
 const showPly=async(ply,animate)=>{
  if(disposed)return;
  $('#analysis-insight').inert=true;
  if(mode!=='game')board(positionAt(game,shown));
  exercise=null;selected=null;promotions=[];setMode('game');delete $('#match-surface').dataset.practice;
  const token=++transition;cancelAnimations();clearMarkers();delete root.dataset.variation;root.setAttribute('aria-label','Доска: разбор партии');
  const before=snapshotBoard(root),steps=historyMoves(game,shown,ply);shown=ply;
  onPly(ply);
  board(positionAt(game,ply));
  $('#history-position').textContent=`${ply} / ${analysis.totalPlies}`;
  syncHistorySlider($('#history-slider'),ply,analysis.totalPlies);
  $('#history-back').disabled=ply===0;$('#history-forward').disabled=ply===analysis.totalPlies;$('#history-live').disabled=ply===analysis.totalPlies;
  $('#moves').querySelectorAll('[data-analysis-ply]').forEach(button=>button.setAttribute('aria-current',String(Number(button.dataset.analysisPly)===ply)));
  if(animate)await animateTransition(root,steps,before);
  if(disposed||token!==transition)return;
  $('#analysis-insight').inert=false;
  const move=analysis.moves[ply-1];$('#analysis-insight').innerHTML=analysisInsight(move);marker(move);
 };
 const playback=createAnalysisPlayback({analysis,showPly,onChange:({state})=>{
  if(disposed)return;$('#replay-start').hidden=state==='playing';$('#replay-pause').hidden=state!=='playing';
  $('#replay-start').setAttribute('aria-label',state==='pausedForInsight'?'Продолжить разбор':'Начать воспроизведение');$('#match-surface').dataset.playback=state;
 }});
 const returnToGame=()=>void showPly(shown,false).then(()=>$('#replay-start').focus({preventScroll:true}));
 $('#moves').innerHTML=analysis.moves.map(move=>`<button class="text-button" data-analysis-ply="${move.ply}" data-quality="${esc(move.highlight||move.quality||'')}" aria-label="${move.ply}. ${esc(humanMove(move.playedSan))}${move.quality&&!['best','good'].includes(move.quality)?', '+esc(qualityLabel[move.quality]):''}"><span>${Math.ceil(move.ply/2)}${move.ply%2?'.':'…'}</span> ${esc(humanMove(move.playedSan))} <small>${move.highlight?'!':({blunder:'??',mistake:'?',inaccuracy:'?!'})[move.quality]||''}</small></button>`).join('');
 $('#analysis-summary').hidden=analysis.status==='complete';
 $('#analysis-summary').textContent=analysis.status==='complete'?'':'Часть ходов не удалось оценить. Можно повторить анализ.';
 $('#history-back').onclick=()=>void playback.seek(playback.getSnapshot().ply-1);
 $('#history-forward').onclick=()=>void playback.seek(playback.getSnapshot().ply+1);
 $('#history-live').onclick=()=>void playback.seek(analysis.totalPlies);
 const disposeSlider=bindHistorySlider($('#history-slider'),ply=>void playback.seek(ply));
 $('#replay-start').onclick=()=>void playback.play();$('#replay-pause').onclick=playback.pause;
 $('#moves').onclick=event=>{const button=event.target.closest('[data-analysis-ply]');if(button)void playback.seek(Number(button.dataset.analysisPly));};
 $('#analysis-insight').onclick=event=>{
  const button=event.target.closest('[data-analysis-line]');if(button){if(mode==='hint')void showPly(shown,false);else showVariation(button.dataset.analysisLine);return;}
  if(event.target.closest('[data-analysis-practice]'))startExercise();
 };
 $('#analysis-board-tools').onclick=event=>{
  if(event.target.closest('[data-analysis-return]')){returnToGame();return;}
  if(event.target.closest('[data-variation-back]')){showVariation(root.dataset.variation,previewStep-1);return;}
  if(event.target.closest('[data-variation-next]')){showVariation(root.dataset.variation,previewStep+1);return;}
  const promotion=event.target.closest('[data-practice-promote]');if(promotion){submitExercise(promotion.dataset.practicePromote);return;}
  if(event.target.closest('[data-practice-continue]')&&exercise){
   if(exercise.getSnapshot().state==='success'){returnToGame();return;}
   exercise.continue();selected=null;renderExercise();
   if(exercise.getSnapshot().state==='awaitMove')root.querySelector(`[data-square="${exercise.game.moves({verbose:true})[0]?.from}"]`)?.focus({preventScroll:true});
  }
 };
 root.onclick=event=>{
  if(disposed||mode!=='practice'||!exercise||exercise.getSnapshot().state!=='awaitMove'||promotions.length)return;
  const square=event.target.closest('[data-square]')?.dataset.square;if(!square)return;
  const moves=selected?exercise.game.moves({square:selected,verbose:true}).filter(move=>move.to===square):[];
  if(moves.length){
   if(moves.some(move=>move.promotion)){promotions=moves;renderExercise();$('[data-practice-promote]')?.focus({preventScroll:true});}
   else void submitExercise(moves[0].from+moves[0].to);
   return;
  }
  selected=exercise.game.get(square)?.color===exercise.game.turn()?(selected===square?null:square):null;renderExercise();
 };
 const keyboard=event=>{
  if(event.target.closest('input,textarea')||event.altKey||event.ctrlKey||event.metaKey)return;
  if(['ArrowLeft','ArrowRight'].includes(event.key)){
   event.preventDefault();if(mode==='practice')return;
   if(mode==='variation')showVariation(root.dataset.variation,previewStep+(event.key==='ArrowLeft'?-1:1));
   else void playback.seek(playback.getSnapshot().ply+(event.key==='ArrowLeft'?-1:1));
  }
 };
 const visibility=()=>{if(document.hidden)playback.pause();};
 $('#play').addEventListener('keydown',keyboard);document.addEventListener('visibilitychange',visibility);
 void playback.seek(initialPly);$('#replay-start').hidden=false;
 return ()=>{disposed=true;transition++;disposeSlider();exercise=null;root.onclick=null;$('#analysis-board-tools').onclick=null;playback.dispose();cancelAnimations();$('#play').removeEventListener('keydown',keyboard);document.removeEventListener('visibilitychange',visibility);};
};
