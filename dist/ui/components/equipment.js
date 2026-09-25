import {TYPES,itemById,rarityNames} from '../../catalog.js?v=42';
import {pieceSVG,itemPreview} from '../../pieces.js?v=42';
import {escapeHTML,button} from '../primitives.js?v=42';
export const rarityLabel = rarity => `<span class="rarity ${escapeHTML(rarity)}">${escapeHTML(rarityNames[rarity])}</span>`;
export const equipmentPreviewItem = (id,owned=true) => {
  const item=itemById(id),label=`${item.name}${owned?'':' · не получен'}`;
  return `<button type="button" class="preset-part ${owned?'':'missing'}" data-open-item="${escapeHTML(id)}" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}">${item.kind==='piece'?pieceSVG(item.type,'w',item.style):itemPreview(item)}</button>`;
};
export const equipmentPreview = (equipment,owned) => [...TYPES.map(type=>equipment.pieces[type]),equipment.board].map(id=>equipmentPreviewItem(id,!owned||owned.includes(id))).join('');
export const equipmentRow = ({name,meta,preview,actions,equipped=false}) => `<article class="collection-row ${equipped?'equipped':''}"><div class="collection-name"><h3>${escapeHTML(name)}</h3>${meta}</div><div class="collection-pieces">${preview}</div><div class="collection-action">${actions}</div></article>`;
export const savedSetRow = set => equipmentRow({name:set.name,meta:'<span class="saved-label">Свой набор</span>',preview:equipmentPreview(set),actions:button({label:'Выбрать','data-load-set':set.id})+button({label:'Удалить',variant:'ghost','data-delete-set':set.id,'aria-label':`Удалить набор ${set.name}`})});
