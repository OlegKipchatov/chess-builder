import {pageHeader,iconButton,backIcon,escapeHTML as esc} from '../primitives.js?v=71';
import {moveNavigation} from '../components/move-navigation.js?v=71';
import {analysisInsight} from '../components/analysis-insight.js?v=71';
import {renderBoard,snapshotBoard,animateTransition,historyMoves} from '../../board.js?v=71';
import {Chess} from '../../chess.js?v=71';
import {positionAt} from '../../session.js?v=71';
import {createAnalysisPlayback} from '../../analysis/analysis-playback.js?v=71';
export const analysisPage = () => `<section id="analysis" class="tab" data-page-kind="detail" hidden>${pageHeader({title:'Разбор партии',startContent:iconButton({id:'analysis-close',label:'Закрыть разбор',icon:backIcon})})}<div class="page-content"><div id="analysis-loading" role="status" aria-live="polite"></div><div id="analysis-content" hidden><div class="analysis-grid"><div class="board-area"><div id="analysis-board" class="board" role="group" aria-label="Доска: разбор партии"></div>${moveNavigation('analysis-')}<div id="analysis-insight" class="analysis-insight" aria-live="polite"></div></div><aside class="analysis-history"><h2>Ходы партии</h2><div id="analysis-moves"></div></aside></div><p id="analysis-summary" class="muted"></p></div><button id="analysis-retry" class="quiet" hidden>Повторить анализ</button></div></section>`;
export const showAnalysisProgress = ({stage,done,total}) => {
 document.querySelector('#analysis-loading').textContent=`${stage==='quick'?'Быстрый анализ':'Уточняем важные моменты'} · ${done} из ${total}${stage==='quick'?' ходов':''}`;
};
export const mountAnalysis = ({analysis,entry,equipped}) => {
 const $=selector=>document.querySelector(selector),root=$('#analysis-board'),game=new Chess();game.loadPgn(entry.pgn);
 let shown=0,disposed=false,transition=0;
 const cancelAnimations=()=>root.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
 const marker=move=>{
  root.querySelectorAll('.analysis-marker').forEach(node=>node.remove());
  if(move?.status!=='complete')return;
  const cell=root.querySelector(`[data-square="${move.playedMove.slice(2,4)}"]`);
  if(cell){const span=document.createElement('span');span.className='analysis-marker analysis-badge';span.dataset.quality=move.highlight||move.quality;span.textContent=move.highlight?'!':({blunder:'??',mistake:'?',inaccuracy:'?!',best:'',good:''})[move.quality];span.setAttribute('aria-hidden','true');cell.append(span);}
  if(move.expectedScoreLoss<=.005&&!move.recommendationRequired)return;
  const token=move.bestLine.move,point=square=>{const x='abcdefgh'.indexOf(square[0]),y=8-Number(square[1]);return entry.playerColor==='b'?[7-x+.5,7-y+.5]:[x+.5,y+.5];};
  const [x1,y1]=point(token.slice(0,2)),[x2,y2]=point(token.slice(2,4));
  // The recommendation belongs to fenBefore; the card explicitly names that context.
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 8 8');svg.setAttribute('aria-hidden','true');svg.classList.add('analysis-marker','analysis-arrow');
  svg.innerHTML=`<defs><marker id="analysis-tip" markerWidth="3" markerHeight="3" refX="2.3" refY="1.5" orient="auto"><path d="M0 0L3 1.5L0 3z" fill="currentColor"/></marker></defs><path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="currentColor" stroke-width=".1" marker-end="url(#analysis-tip)"/>`;
  root.append(svg);
 };
 const showPly=async(ply,animate)=>{
  const token=++transition;cancelAnimations();root.querySelectorAll('.analysis-marker').forEach(node=>node.remove());
  const before=snapshotBoard(root),steps=historyMoves(game,shown,ply);shown=ply;
  renderBoard(root,positionAt(game,ply),entry.equipped||equipped,null,entry.playerColor);
  root.querySelectorAll('[data-square]').forEach(cell=>cell.setAttribute('aria-disabled','true'));
  $('#analysis-history-position').textContent=`${ply} / ${analysis.totalPlies}`;
  $('#analysis-history-back').disabled=ply===0;$('#analysis-history-forward').disabled=ply===analysis.totalPlies;$('#analysis-history-live').disabled=ply===analysis.totalPlies;
  $('#analysis-moves').querySelectorAll('[data-analysis-ply]').forEach(button=>button.setAttribute('aria-current',String(Number(button.dataset.analysisPly)===ply)));
  if(animate)await animateTransition(root,steps,before);
  if(disposed||token!==transition)return;
  const move=analysis.moves[ply-1];$('#analysis-insight').innerHTML=analysisInsight(move);marker(move);
 };
 const playback=createAnalysisPlayback({analysis,showPly,onChange:({state})=>{
  if(disposed)return;$('#analysis-replay-start').hidden=state==='playing';$('#analysis-replay-pause').hidden=state!=='playing';
  $('#analysis-replay-start').setAttribute('aria-label',state==='pausedForInsight'?'Продолжить разбор':'Начать воспроизведение');
  $('#analysis-content').dataset.playback=state;
 }});
 $('#analysis-moves').innerHTML=analysis.moves.map(move=>`<button class="text-button" data-analysis-ply="${move.ply}" data-quality="${esc(move.highlight||move.quality||'')}" aria-label="${move.ply}. ${esc(move.playedSan)}${move.quality?', '+esc(move.highlight?'Отличный ход':({best:'Сильный ход',good:'Хороший ход',inaccuracy:'Неточность',mistake:'Ошибка',blunder:'Грубая ошибка'})[move.quality]):''}"><span>${Math.ceil(move.ply/2)}${move.ply%2?'.':'…'}</span> ${esc(move.playedSan)} <small>${move.highlight?'!':({blunder:'??',mistake:'?',inaccuracy:'?!'})[move.quality]||''}</small></button>`).join('');
 $('#analysis-summary').textContent=`Разобрано ваших ходов: ${analysis.analyzedPlayerMoves}. Ошибок: ${analysis.summary.mistake}, грубых ошибок: ${analysis.summary.blunder}, отличных ходов: ${analysis.summary.excellent}.${analysis.status!=='complete'?' Часть ходов не удалось оценить.':''}`;
 $('#analysis-history-back').onclick=()=>void playback.seek(playback.getSnapshot().ply-1);
 $('#analysis-history-forward').onclick=()=>void playback.seek(playback.getSnapshot().ply+1);
 $('#analysis-history-live').onclick=()=>void playback.seek(analysis.totalPlies);
 $('#analysis-replay-start').onclick=()=>void playback.play();$('#analysis-replay-pause').onclick=playback.pause;
 $('#analysis-moves').onclick=event=>{const button=event.target.closest('[data-analysis-ply]');if(button)void playback.seek(Number(button.dataset.analysisPly));};
 const keyboard=event=>{if(event.target.closest('input,textarea')||event.altKey||event.ctrlKey||event.metaKey)return;if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();void playback.seek(playback.getSnapshot().ply+(event.key==='ArrowLeft'?-1:1));}};
 const visibility=()=>{if(document.hidden)playback.pause();};
 $('#analysis').addEventListener('keydown',keyboard);document.addEventListener('visibilitychange',visibility);
 void showPly(0,false);$('#analysis-replay-start').hidden=false;
 return ()=>{disposed=true;transition++;playback.dispose();cancelAnimations();$('#analysis').removeEventListener('keydown',keyboard);document.removeEventListener('visibilitychange',visibility);};
};
