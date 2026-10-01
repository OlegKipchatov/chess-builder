import {historyMetrics} from '../../archive.js?v=65';
import {signedDelta} from '../../rating.js?v=65';
import {escapeHTML,emptyState,plural} from '../primitives.js?v=65';
// Lucide icons (ISC), see LUCIDE-LICENSE.
const statusIcons={
 win:'<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" /><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" /><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" /><path d="M4 22h16" /><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" /><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" />',
 loss:'<path d="m13 19 6-6" /><path d="M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5" /><path d="m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586" /><path d="m16 16 4 4" /><path d="m19 21 2-2" /><path d="m5 14 4 4" /><path d="m5 21-2-2" /><path d="M7.5 16.5 4 20" />',
 draw:'<path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" /><path d="m21 3 1 11h-2" /><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" /><path d="M3 4h8" />',
 interrupted:'<circle cx="12" cy="12" r="9"/><path d="M9 8v8m6-8v8"/>'
};
const resultStatus = entry => {
 if(entry.counted===false||entry.result?.startsWith('Прервана'))return 'interrupted';
 if(entry.result==='Ничья')return 'draw';
 if(entry.result==='Победа'||entry.result===(entry.playerColor==='b'?'Победа чёрных':'Победа белых'))return 'win';
 return 'loss';
};
const statusIcon = status => `<span class="archive-status-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${statusIcons[status]}</svg></span>`;
export const ARCHIVE_ROW_HEIGHT=104;
export const renderArchiveList = (root,entries) => {
  const total=entries.length;
  if(!total){root.innerHTML=emptyState('Здесь появятся завершённые партии.');return;}
  const start=Math.max(0,Math.floor((root.scrollTop||0)/ARCHIVE_ROW_HEIGHT)-3);
  const end=Math.min(total,start+Math.ceil((root.clientHeight||520)/ARCHIVE_ROW_HEIGHT)+6);
  root.style.setProperty('--archive-row-height',`${ARCHIVE_ROW_HEIGHT}px`);
  root.innerHTML=`<div style="height:${start*ARCHIVE_ROW_HEIGHT}px" aria-hidden="true"></div>`+entries.slice(start,end).map((entry,index)=>{
    const {moves,balance}=historyMetrics(entry);
    const date=new Date(entry.finishedAt),validDate=!Number.isNaN(date.getTime());
    const dateText=validDate?`${date.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',...(date.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{})})} · ${date.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`:'Дата неизвестна';
    const movesText=moves===null?'Ходы —':`${moves} ${plural(moves,['ход','хода','ходов'])}`;
    const balanceText=balance===null?'—':signedDelta(balance);
    const status=resultStatus(entry);
    const side=entry.playerColor==='b'?'Чёрные':'Белые';
    return `<button class="archive-entry" data-result="${status}" data-archive="${escapeHTML(entry.id)}" aria-label="Партия ${start+index+1} из ${total}: ${escapeHTML(entry.result)}, ${side}, ${dateText}, ${movesText}, материал ${balanceText}">${statusIcon(status)}<strong class="archive-result">${escapeHTML(entry.result)}</strong><span class="archive-moves">${movesText}</span><small class="archive-date">${side} · <time${validDate?` datetime="${date.toISOString()}" title="${escapeHTML(date.toLocaleString('ru-RU'))}"`:''}>${dateText}</time></small><span class="archive-material">Материал <b data-balance="${balance>0?'positive':balance<0?'negative':'zero'}">${balanceText}</b></span></button>`;
  }).join('')+`<div style="height:${(total-end)*ARCHIVE_ROW_HEIGHT}px" aria-hidden="true"></div>`;
};
