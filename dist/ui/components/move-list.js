import {escapeHTML} from '../primitives.js?v=114';
export const humanMove = san => {
 if(!san)return '';
 if(san.startsWith('O-O'))return 'Рокировка';
 const piece=({K:'Король',Q:'Ферзь',R:'Ладья',B:'Слон',N:'Конь'})[san[0]]||'Пешка';
 return piece+(san.includes('x')?' — взятие':'')+(san.includes('=')?' — превращение':'')+(san.endsWith('#')?' · мат':san.endsWith('+')?' · шах':'');
};
export const moveList = (moves,cursor) => {
 const moveButton = index => moves[index]?`<button data-history-ply="${index+1}" class="history-move ${cursor===index+1?'selected-move':''}" aria-current="${cursor===index+1?'step':'false'}">${escapeHTML(moves[index])}</button>`:'<span>—</span>';
 return moves.length?Array.from({length:Math.ceil(moves.length/2)},(_,i)=>`<div class="move-row"><span class="muted">${i+1}.</span>${moveButton(i*2)}${moveButton(i*2+1)}</div>`).join(''):'<p class="muted">Здесь появится история партии.</p>';
};
