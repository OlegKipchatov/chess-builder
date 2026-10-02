import {TYPES,itemById,rarityNames} from '../../catalog.js?v=88';
import {pieceSVG,itemPreview} from '../../pieces.js?v=88';
import {escapeHTML,button,iconButton} from '../primitives.js?v=88';
export const rarityLabel = rarity => `<span class="rarity ${escapeHTML(rarity)}">${escapeHTML(rarityNames[rarity])}</span>`;
export const equipmentPreviewItem = (id,owned=true) => {
  const item=itemById(id),label=`${item.name}${owned?'':' · не получен'}`;
  return `<button type="button" class="preset-part ${owned?'':'missing'}" data-open-item="${escapeHTML(id)}" title="${escapeHTML(label)}" aria-label="Открыть: ${escapeHTML(label)}">${item.kind==='piece'?pieceSVG(item.type,'w',item.style):itemPreview(item)}</button>`;
};
export const equipmentPreview = (equipment,owned) => [...TYPES.map(type=>equipment.pieces[type]),equipment.board].map(id=>equipmentPreviewItem(id,!owned||owned.includes(id))).join('');
export const equipmentRow = ({name,meta,preview,actions,equipped=false,rarity}) => `<article class="collection-row ${rarity?`rarity-row rarity-${rarity}`:''} ${equipped?'equipped':''}"><div class="collection-name"><h3>${escapeHTML(name)}</h3>${meta}</div><div class="collection-pieces">${preview}</div><div class="collection-action">${actions}</div></article>`;
export const savedSetRow = (set,current) => {
 const equipped=current?.board===set.board&&TYPES.every(type=>current.pieces?.[type]===set.pieces[type]);
 return equipmentRow({equipped,name:set.name,meta:'',preview:equipmentPreview(set),actions:button({label:equipped?'Выбрано':'Выбрать','data-load-set':set.id,disabled:equipped,className:equipped?'equipped-button':''})+iconButton({label:`Удалить набор ${set.name}`,variant:'ghost',className:'delete-set','data-delete-set':set.id,icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/></svg>'})});
};
