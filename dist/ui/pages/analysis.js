import {matchEndReason} from '../../archive.js?v=113';
import {isImportantInsight} from '../../analysis/analysis-events.js?v=113';
import {escapeHTML as esc} from '../primitives.js?v=113';
import {syncHistorySlider,bindHistorySlider} from '../components/move-navigation.js?v=113';
import {analysisInsight,insightLines,visibleVariation} from '../components/analysis-insight.js?v=113';
import {qualityLabel} from '../../analysis/analysis-explanations.js?v=113';
import {renderBoard,snapshotBoard,animateTransition,historyMoves} from '../../board.js?v=113';
import {Chess} from '../../chess.js?v=113';
import {positionAt} from '../../session.js?v=113';
import {createAnalysisPlayback} from '../../analysis/analysis-playback.js?v=113';
import {createMateExercise} from '../../analysis/analysis-training.js?v=113';

export const analysisBoardTools = () => `<div id="analysis-board-tools" hidden>
 <div id="analysis-variation-tools" hidden><p data-analysis-context role="status"></p>
 <div class="analysis-variation-controls"><button type="button" class="quiet" data-variation-back aria-label="Назад по варианту">←</button><button type="button" class="quiet" data-variation-next aria-label="Вперёд по варианту">→</button><button type="button" class="quiet" data-analysis-return>К партии</button></div></div>
 <div id="analysis-practice-tools" hidden><div class="analysis-practice-heading"><p data-practice-message role="status"></p><button type="button" class="quiet" data-practice-hint hidden>Подсказка</button></div><div data-practice-promotion hidden></div>
 <div class="analysis-variation-controls"><button type="button" class="primary" data-practice-continue hidden>Продолжить</button><button type="button" class="quiet" data-analysis-return>К партии</button></div></div>
 </div>`;
export const analysisInsights = () => '<div id="analysis-insight" class="analysis-insight" aria-live="polite" hidden></div><p id="analysis-summary" class="muted" hidden></p>';
export const showAnalysisProgress = ({stage,done,total}) => {
 document.querySelector('#analysis-cancel').setAttribute('aria-label',`${stage==='quick'?'Быстрый анализ':'Уточняем важные моменты'}: ${done} из ${total}. Отменить анализ`);
};
export const variationArrowPoints = (token,orientation='w') => {
 if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token||''))return null;
 const point=square=>{const x='abcdefgh'.indexOf(square[0]),y=8-Number(square[1]);return orientation==='b'?[7-x+.5,7-y+.5]:[x+.5,y+.5];};
 return [...point(token.slice(0,2)),...point(token.slice(2,4))];
};
export const mountAnalysis = ({analysis,entry,equipped,initialPly=0,onPly=()=>{}}) => {
 const $=selector=>document.querySelector(selector),root=$('#board'),game=new Chess();game.loadPgn(entry.pgn);
 let shown=0,disposed=false,transition=0,mode='game',previewStep=0,exercise=null,selected=null,promotions=[];
 const practiceAttempts=new Map();let practiceHint=null;
 const drawArrow=token=>{
  const points=variationArrowPoints(token,entry.playerColor);if(!points)return;
  const [x1,y1,x2,y2]=points,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 8 8');svg.setAttribute('aria-hidden','true');svg.classList.add('analysis-marker','analysis-arrow');
  svg.innerHTML=`<defs><marker id="practice-tip" markerWidth="3" markerHeight="3" refX="2.3" refY="1.5" orient="auto"><path d="M0 0L3 1.5L0 3z" fill="currentColor"/></marker></defs><path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="currentColor" stroke-width=".1" marker-end="url(#practice-tip)"/>`;root.append(svg);
 };
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
  if(move?.status!=='complete'||move.repeatedOpportunity)return;
  const mark=move.highlight?'!':({blunder:'??',mistake:'?',inaccuracy:'?!'})[move.quality];
  const cell=root.querySelector(`[data-square="${move.playedMove.slice(2,4)}"]`);
  if(cell&&mark){const span=document.createElement('span');span.className='analysis-marker analysis-badge';span.dataset.quality=move.highlight||move.quality;span.textContent=mark;span.setAttribute('aria-hidden','true');cell.append(span);}
 };
 const showVariation=async(token,step=0,expanded=mode==='variation')=>{
  const move=analysis.moves[shown-1],line=insightLines(move).find(line=>line.move===token);
  if(!line||disposed)return;
  const entering=mode!=='variation',previous=previewStep,full=new Chess(move.fenBefore),{pv}=visibleVariation(move,expanded),before=snapshotBoard(root);
  previewStep=Math.max(0,Math.min(step,pv.length));
  for(const next of pv)full.move({from:next.slice(0,2),to:next.slice(2,4),promotion:next[4]});
  const position=positionAt(full,previewStep);
  playback.pause();const generation=++transition;cancelAnimations();exercise?.dispose?.();exercise=null;setMode(pv.length===1?'hint':'variation');board(position);
  root.setAttribute('aria-label',`Вариант: ${previewStep} / ${pv.length}`);root.dataset.variation=token;
  if(!entering&&previewStep===previous+1){
   await animateTransition(root,historyMoves(full,previous,previewStep),before);
   if(disposed||generation!==transition)return;
  }
  const points=variationArrowPoints(pv[previewStep],entry.playerColor);
  if(points){
   const [x1,y1,x2,y2]=points;
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 8 8');svg.setAttribute('aria-hidden','true');svg.classList.add('analysis-marker','analysis-arrow');
   svg.innerHTML=`<defs><marker id="analysis-tip" markerWidth="3" markerHeight="3" refX="2.3" refY="1.5" orient="auto"><path d="M0 0L3 1.5L0 3z" fill="currentColor"/></marker></defs><path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="currentColor" stroke-width=".1" marker-end="url(#analysis-tip)"/>`;root.append(svg);
  }
  $('[data-analysis-context]').textContent=position.isCheckmate()?'Мат':previewStep===0?'Рекомендуемое продолжение':'Вариант';
  if(pv.length===1){const button=$('[data-analysis-line]');button.textContent='Скрыть';button.setAttribute('aria-pressed','true');const expand=$('[data-analysis-expand]');if(expand)expand.hidden=false;}
  $('[data-variation-back]').disabled=previewStep===0;$('[data-variation-next]').disabled=previewStep===pv.length;
  if(entering&&pv.length>1)$('[data-variation-next]').focus({preventScroll:true});
 };
 const renderExercise=()=>{
  if(!exercise||disposed)return;
  const {state,mateIn,canHint,hintPending}=exercise.getSnapshot(),interactive=state==='awaitMove'&&!hintPending&&!promotions.length;
  board(exercise.game,selected,interactive);root.setAttribute('aria-label','Задание: найдите мат');
  $('#match-surface').dataset.practice=state;
  const hint=$('[data-practice-hint]');hint.hidden=!canHint||state!=='awaitMove';hint.disabled=hintPending;hint.textContent=practiceHint?'Скрыть':'Подсказка';
  if(practiceHint&&interactive)drawArrow(practiceHint);
  $('[data-practice-message]').textContent=({awaitMove:`Найдите мат в ${Math.max(1,mateIn-Math.floor(exercise.game.history().length/2))} ${Math.max(1,mateIn-Math.floor(exercise.game.history().length/2))===1?'ход':'хода'}.`,checking:'Проверяем продолжение…',unverified:'Не удалось подтвердить мат за отведённое время. Попробуйте ещё раз или выберите другой ход.',wrong:'Есть ход получше. Попробуйте найти его.',correct:'',opponent:'Соперник отвечает…',success:'Мат! Вы нашли решение.'})[state];
  const next=$('[data-practice-continue]');next.hidden=['awaitMove','checking','correct','opponent'].includes(state);next.textContent=['wrong','unverified'].includes(state)?'Попробовать снова':state==='success'?'Продолжить разбор':'Продолжить';
  $('#analysis-practice-tools [data-analysis-return]').hidden=state==='success';
  const promotion=$('[data-practice-promotion]');promotion.hidden=!promotions.length;
  promotion.innerHTML=promotions.length?`<p>Выберите фигуру:</p>${promotions.map(move=>`<button type="button" class="quiet" data-practice-promote="${move.from+move.to+move.promotion}">${({q:'Ферзь',r:'Ладья',b:'Слон',n:'Конь'})[move.promotion]}</button>`).join('')}`:'';
 };
 const startExercise=()=>{
  const data=analysis.moves[shown-1]?.exercise;if(!data||disposed)return;
  playback.pause();transition++;cancelAnimations();exercise?.dispose?.();exercise=createMateExercise(data,{attempts:practiceAttempts});practiceHint=null;selected=null;promotions=[];
  delete root.dataset.variation;setMode('practice');renderExercise();
  root.querySelector(`[data-square="${exercise.game.moves({verbose:true})[0]?.from}"]`)?.focus({preventScroll:true});
 };
 const submitExercise=async token=>{
  if(!exercise)return;const owned=exercise,generation=++transition,before=snapshotBoard(root);
  practiceHint=null;const result=exercise.submit(token);selected=null;promotions=[];renderExercise();
  await result;if(disposed||exercise!==owned||generation!==transition)return;renderExercise();
  $('[data-practice-continue]').disabled=true;
  await animateTransition(root,[owned.game.history({verbose:true}).at(-1)],before);
  if(disposed||exercise!==owned||generation!==transition)return;
  $('[data-practice-continue]').disabled=false;
  if(owned.getSnapshot().state==='correct'){
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
  exercise?.dispose?.();exercise=null;selected=null;promotions=[];setMode('game');delete $('#match-surface').dataset.practice;
  const token=++transition;cancelAnimations();clearMarkers();delete root.dataset.variation;root.setAttribute('aria-label','Доска: разбор партии');
  const before=snapshotBoard(root),steps=historyMoves(game,shown,ply);shown=ply;
  onPly(ply);
  board(positionAt(game,ply));
  $('#history-position').textContent=`${ply} / ${analysis.totalPlies}`;
  syncHistorySlider($('#history-slider'),ply,analysis.totalPlies,animate);
  $('#history-back').disabled=ply===0;$('#history-forward').disabled=ply===analysis.totalPlies;$('#history-live').disabled=ply===analysis.totalPlies;
  $('#moves').querySelectorAll('[data-analysis-ply]').forEach(button=>button.setAttribute('aria-current',String(Number(button.dataset.analysisPly)===ply)));
  if(animate)await animateTransition(root,steps,before);
  if(disposed||token!==transition)return;
  $('#analysis-insight').inert=false;
  const move=analysis.moves[ply-1],card=analysisInsight(move);
  const boundary=ply===0?'<h2>Начало партии</h2><p>Переходите по ходам или выбирайте отметки на шкале, чтобы посмотреть разбор.</p>':ply===analysis.totalPlies?`<div class="analysis-boundary"><h2>Партия завершена</h2><p>${esc([entry.result,matchEndReason(game,entry.result==='Поражение'&&!game.isGameOver())].filter(Boolean).join(' · '))}</p>${analysis.status==='complete'&&!analysis.moves.some(isImportantInsight)?'<p>В этой партии анализ не обнаружил заметных ошибок.</p>':''}</div>`:'';
  $('#analysis-insight').innerHTML=card||boundary;marker(move);
  $('#history-markers').querySelectorAll('[data-insight-ply]').forEach(button=>button.setAttribute('aria-current',String(Number(button.dataset.insightPly)===ply)));
 };
 const playback=createAnalysisPlayback({analysis,showPly,onChange:({state})=>{
  if(disposed)return;$('#replay-start').hidden=state==='playing';$('#replay-pause').hidden=state!=='playing';
  $('#replay-start').setAttribute('aria-label',state==='pausedForInsight'?'Продолжить разбор':'Начать воспроизведение');$('#match-surface').dataset.playback=state;
 }});
 const returnToGame=()=>void showPly(shown,false).then(()=>$('#replay-start').focus({preventScroll:true}));
 $('#moves').innerHTML=analysis.moves.map(move=>`<button class="text-button" data-analysis-ply="${move.ply}" data-quality="${esc(move.highlight||move.quality||'')}" aria-label="${move.ply}. ${esc(move.playedSan)}${move.quality&&!['best','good'].includes(move.quality)?', '+esc(qualityLabel[move.quality]):''}"><span>${Math.ceil(move.ply/2)}${move.ply%2?'.':'…'}</span> ${esc(move.playedSan)} <small>${move.highlight?'!':({blunder:'??',mistake:'?',inaccuracy:'?!'})[move.quality]||''}</small></button>`).join('');
 $('#analysis-summary').hidden=analysis.status==='complete';
 $('#analysis-summary').textContent=analysis.status==='complete'?'':'Часть ходов не удалось оценить. Можно повторить анализ.';
 $('#history-back').onclick=()=>void playback.seek(playback.getSnapshot().ply-1);
 $('#history-forward').onclick=()=>void playback.seek(playback.getSnapshot().ply+1);
 $('#history-live').onclick=()=>void playback.seek(analysis.totalPlies);
 const marks=$('#history-markers');marks.hidden=false;
 marks.innerHTML=analysis.moves.filter(isImportantInsight).map(move=>`<button type="button" class="history-marker" data-insight-ply="${move.ply}" data-quality="${esc(move.highlight||move.quality)}" style="--marker-position:${move.ply/analysis.totalPlies*100}%" aria-label="Разбор хода ${Math.ceil(move.ply/2)}: ${esc(qualityLabel[move.quality]||'Важный момент')}" title="Ход ${Math.ceil(move.ply/2)} · ${esc(qualityLabel[move.quality]||'Важный момент')}"></button>`).join('');
 marks.onclick=event=>{const button=event.target.closest('[data-insight-ply]');if(button)void playback.seek(Number(button.dataset.insightPly));};
 const disposeSlider=bindHistorySlider($('#history-slider'),ply=>void playback.seek(ply));
 $('#replay-start').onclick=()=>void playback.play();$('#replay-pause').onclick=playback.pause;
 $('#moves').onclick=event=>{const button=event.target.closest('[data-analysis-ply]');if(button)void playback.seek(Number(button.dataset.analysisPly));};
 $('#analysis-insight').onclick=event=>{
  const expand=event.target.closest('[data-analysis-expand]');if(expand){showVariation(expand.dataset.analysisExpand,0,true);return;}
  const button=event.target.closest('[data-analysis-line]');if(button){if(mode==='hint')void showPly(shown,false);else showVariation(button.dataset.analysisLine);return;}
  if(event.target.closest('[data-analysis-practice]'))startExercise();
 };
 $('#analysis-board-tools').onclick=event=>{
  if(event.target.closest('[data-analysis-return]')){returnToGame();return;}
  if(event.target.closest('[data-variation-back]')){showVariation(root.dataset.variation,previewStep-1);return;}
  if(event.target.closest('[data-variation-next]')){showVariation(root.dataset.variation,previewStep+1);return;}
  if(event.target.closest('[data-practice-hint]')&&exercise){
   if(practiceHint){practiceHint=null;renderExercise();return;}
   const owned=exercise,generation=transition,pending=owned.getHint();renderExercise();
   void pending.then(token=>{if(disposed||exercise!==owned||transition!==generation)return;practiceHint=token;renderExercise();if(!token)$('[data-practice-message]').textContent='Не удалось проверить подсказку. Попробуйте ещё раз.';});return;
  }
  const promotion=event.target.closest('[data-practice-promote]');if(promotion){submitExercise(promotion.dataset.practicePromote);return;}
  if(event.target.closest('[data-practice-continue]')&&exercise){
   if(exercise.getSnapshot().state==='success'){returnToGame();return;}
   exercise.continue();selected=null;renderExercise();
   if(exercise.getSnapshot().state==='awaitMove')root.querySelector(`[data-square="${exercise.game.moves({verbose:true})[0]?.from}"]`)?.focus({preventScroll:true});
  }
 };
 root.onclick=event=>{
  if(disposed||mode!=='practice'||!exercise||exercise.getSnapshot().state!=='awaitMove'||exercise.getSnapshot().hintPending||promotions.length)return;
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
 return ()=>{disposed=true;transition++;disposeSlider();marks.hidden=true;marks.innerHTML='';marks.onclick=null;exercise?.dispose?.();exercise=null;root.onclick=null;$('#analysis-board-tools').onclick=null;playback.dispose();cancelAnimations();$('#play').removeEventListener('keydown',keyboard);document.removeEventListener('visibilitychange',visibility);};
};
