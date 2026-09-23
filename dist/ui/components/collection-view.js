import {TYPES,PIECE_NAMES,STYLES,ITEMS,itemById,craftCost} from '../../catalog.js?v=35';
import {pieceSVG,itemPreview} from '../../pieces.js?v=35';
import {presetEquipment} from '../../collection-model.js?v=35';
import {button,sectionHeader,emptyState,escapeHTML} from '../primitives.js?v=35';
import {equipmentPreview,equipmentRow,savedSetRow,rarityLabel} from './equipment.js?v=35';
const collectionItemRow = (state,item) => {
  const owned=state.owned.includes(item.id),equipped=item.kind==='board'?state.equipped.board===item.id:state.equipped.pieces[item.type]===item.id,cost=craftCost(item);
  const style=STYLES.find(style=>style.id===item.style);
  const action=owned?{'data-equip':item.id}:{'data-craft':item.id};
  return `<article id="collection-item-${item.id}" tabindex="-1" class="compact-item ${equipped?'equipped':''}"><div class="compact-item-art">${itemPreview(item)}</div><div class="compact-item-copy">${rarityLabel(item.rarity)}<h3>${escapeHTML(style.name)}</h3><span class="item-ownership">${owned?'В коллекции':'Не получен'}</span></div>${button({...action,label:equipped?'Выбрано':owned?'Выбрать':`Создать за ${cost} ✧`,className:equipped?'equipped-button':'',disabled:equipped||(!owned&&state.shards<cost)})}</article>`;
};
const presetCollectionRow = (state,style) => {
  const equipment=presetEquipment(style.id),ids=[...Object.values(equipment.pieces),equipment.board];
  const total=ids.filter(id=>state.owned.includes(id)).length,equipped=equipment.board===state.equipped.board&&TYPES.every(type=>equipment.pieces[type]===state.equipped.pieces[type]);
  return equipmentRow({name:style.name,meta:rarityLabel(style.rarity),preview:equipmentPreview(equipment,state.owned),equipped,actions:`<span>${total} из 7</span>`+(total<7?'<span class="muted">Не собрана</span>':button({label:equipped?'Выбрано':'Выбрать','data-preset':style.id,disabled:equipped,className:equipped?'equipped-button':''}))});
};
const equipmentStrip = (state,view,type) => {
  const slots=[...TYPES,'board'].map(slot=>{
    const item=itemById(slot==='board'?state.equipped.board:state.equipped.pieces[slot]),label=slot==='board'?'Доска':PIECE_NAMES[slot];
    return `<button type="button" class="equipment-slot ${view==='items'&&slot===type?'active':''}" data-open-item="${item.id}" title="${escapeHTML(item.name)}" aria-label="Настроить: ${label}" aria-pressed="${view==='items'&&slot===type}">${slot==='board'?itemPreview(item):pieceSVG(slot,'w',item.style)}<span>${label}</span></button>`;
  }).join('');
  return `<article class="equipment-strip"><div class="strip-label"><p class="eyebrow">Выбранный набор</p>${button({label:'Сохранить набор',variant:'ghost','data-save-set':true})}</div><div class="equipment-slots">${slots}</div></article>`;
};
const savedSets = state => sectionHeader({title:`Мои наборы ${state.sets.length}/12`})+(state.sets.length?`<div class="collection-list">${state.sets.map(savedSetRow).join('')}</div>`:emptyState('Сохраните текущие фигурки и доску как отдельный набор.'));
const itemCatalog = (state,type,ownedOnly) => {
  const items=ITEMS.filter(item=>(type==='board'?item.kind==='board':item.kind==='piece'&&item.type===type)&&(!ownedOnly||state.owned.includes(item.id)));
  return `<div class="catalog-heading"><h3>${type==='board'?'Доски':PIECE_NAMES[type]}</h3>${button({label:'Только полученные',className:'filter-toggle','data-owned-only':true,'aria-pressed':String(ownedOnly)})}</div><div class="collection-items-list">${items.length?items.map(item=>collectionItemRow(state,item)).join(''):emptyState('Полученных предметов этого типа пока нет.')}</div>`;
};
export const renderCollection = (root,state,view='sets',type='k',ownedOnly=false) => {
  const content=view==='saved'?savedSets(state):view==='items'?itemCatalog(state,type,ownedOnly):`<div class="collection-list">${STYLES.map(style=>presetCollectionRow(state,style)).join('')}</div>`;
  root.innerHTML=equipmentStrip(state,view,type)+`<div class="collection-toolbar"><div class="segmented" role="group" aria-label="Раздел коллекции">${[['sets','Коллекции'],['items','Фигуры и доски'],['saved','Мои наборы']].map(([id,label])=>button({label,variant:'ghost','data-collection-view':id,className:view===id?'active':'','aria-pressed':String(view===id)})).join('')}</div><span class="muted">${state.owned.length}/${ITEMS.length} предметов · ${state.shards} ✧</span></div>`+content;
};
