import {styleById, itemById} from './catalog.js?v=5';
// Functional chess icons: a single silhouette language, independent of fonts/emoji.
const shapes = {
  p:'<circle cx="32" cy="18" r="8"/><path d="M27 27h10l-2 12 7 9H22l7-9z"/>',
  r:'<path d="M18 12h7v7h4v-7h6v7h4v-7h7v14l-8 6 2 16H24l2-16-8-6z"/>',
  n:'<path d="M22 48l3-15-9-2 3-10L33 10l9 5 5 13-4 20z"/><path d="M30 12l1-7 7 7"/>',
  b:'<path d="M32 9c-7 7-12 12-12 18 0 6 5 10 12 10s12-4 12-10C44 21 39 16 32 9z"/><path d="M28 36h8l5 12H23z"/>',
  q:'<path d="M17 21l9 7 6-12 6 12 9-7-6 21H23z"/><circle cx="16" cy="17" r="3"/><circle cx="32" cy="11" r="3"/><circle cx="48" cy="17" r="3"/><path d="M24 42h16l3 6H21z"/>',
  k:'<path d="M29 7h6v6h6v5h-6v7h-6v-7h-6v-5h6z"/><path d="M20 29c0-7 8-8 12-2 4-6 12-5 12 2 0 5-5 10-7 13l5 6H22l5-6c-2-3-7-8-7-13z"/>'
};
export const pieceSVG = (type, color='w', style='classic') => {
  const theme = styleById(style);
  const fill = color === 'w' ? '#faf8ef' : '#202933';
  const stroke = color === 'w' ? '#46515c' : '#a7b3bf';
  const detail = color === 'w' ? '#46515c' : '#e6edf1';
  return `<svg class="piece-icon" data-color="${color}" data-style="${theme.id}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g fill="${fill}" stroke="${stroke}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${shapes[type]||shapes.p}<path d="M21 48h22l3 7H18z"/></g>${type==='n'?`<circle cx="29" cy="23" r="1.8" fill="${detail}"/>`:''}${type==='b'?`<path d="M35 19l-7 10" stroke="${detail}" stroke-width="2" stroke-linecap="round"/>`:''}<path d="M24 50h16" stroke="${theme.accent}" stroke-width="3" stroke-linecap="round"/>${theme.id!=='classic'?`<path d="M27 43h10" stroke="${theme.accent}" stroke-width="2.5" stroke-linecap="round"/>`:''}</svg>`;
};
export const itemPreview = item => {
  if (item.kind === 'piece') return `<div class="piece-pair">${pieceSVG(item.type,'w',item.style)}${pieceSVG(item.type,'b',item.style)}</div>`;
  const style = styleById(item.style);
  return `<div class="mini-board" style="--square-light:${style.light};--square-dark:${style.dark}">${Array.from({length:16},(_,i)=>`<span class="${(Math.floor(i/4)+i)%2?'dark':''}"></span>`).join('')}</div>`;
};
export const equipmentPreview = equipment => ['k','q','r','b','n','p'].map(type => pieceSVG(type,'w',itemById(equipment.pieces[type])?.style)).join('');
