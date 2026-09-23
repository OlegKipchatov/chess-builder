import {escapeHTML,emptyState} from '../primitives.js?v=35';
export const ARCHIVE_ROW_HEIGHT=104;
export const renderArchiveList = (root,entries) => {
  const total=entries.length;
  if(!total){root.innerHTML=emptyState('Здесь появятся завершённые партии.');return;}
  const start=Math.max(0,Math.floor((root.scrollTop||0)/ARCHIVE_ROW_HEIGHT)-3);
  const end=Math.min(total,start+Math.ceil((root.clientHeight||520)/ARCHIVE_ROW_HEIGHT)+6);
  root.style.setProperty('--archive-row-height',`${ARCHIVE_ROW_HEIGHT}px`);
  root.innerHTML=`<div style="height:${start*ARCHIVE_ROW_HEIGHT}px" aria-hidden="true"></div>`+entries.slice(start,end).map((entry,index)=>`<button class="archive-entry" data-archive="${escapeHTML(entry.id)}" aria-label="Партия ${start+index+1} из ${total}: ${escapeHTML(entry.result)}"><span><strong>${escapeHTML(entry.result)}</strong><small>${entry.playerColor==='w'?'Белые':'Чёрные'} · ${Number.isNaN(Date.parse(entry.finishedAt))?'Дата неизвестна':new Date(entry.finishedAt).toLocaleDateString('ru-RU')}</small></span><span>${entry.points} ${Math.abs(entry.points)%100>10&&Math.abs(entry.points)%100<20?'очков':Math.abs(entry.points)%10===1?'очко':Math.abs(entry.points)%10>1&&Math.abs(entry.points)%10<5?'очка':'очков'}</span></button>`).join('')+`<div style="height:${(total-end)*ARCHIVE_ROW_HEIGHT}px" aria-hidden="true"></div>`;
};
