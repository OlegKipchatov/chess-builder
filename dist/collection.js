import {TYPES, PIECE_NAMES, STYLES, ITEMS, rarityNames, itemById, pieceId, boardId, craftCost, duplicateRefund} from './catalog.js?v=2';
import {pieceSVG, itemPreview, equipmentPreview} from './pieces.js?v=2';
export const escapeHTML = value => String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const presetEquipment = style => ({pieces:Object.fromEntries(TYPES.map(type=>[type,pieceId(style,type)])),board:boardId(style)});
export const canEquipPreset = (state, style) => [...Object.values(presetEquipment(style).pieces),boardId(style)].every(id=>state.owned.includes(id));
const isEquipped = (state,item) => item.kind === 'board' ? state.equipped.board === item.id : state.equipped.pieces[item.type] === item.id;
const renderItem = (state, item) => {
  const owned = state.owned.includes(item.id);
  const equipped = isEquipped(state,item);
  const cost = craftCost(item);
  const button = owned
    ? `<button class="${equipped?'equipped-button':'quiet'}" data-equip="${item.id}" ${equipped?'disabled':''}>${equipped?'✓ На доске':'Использовать'}</button>`
    : `<button class="quiet" data-craft="${item.id}" ${state.shards<cost?'disabled':''}>Создать за ${cost} ✧</button>`;
  return `<article class="item-card ${owned?'owned':'locked'} ${equipped?'equipped':''}"><div class="item-art" style="--item-accent:${STYLES.find(style=>style.id===item.style).accent}">${itemPreview(item)}<span class="item-state">${equipped?'Используется':owned?'В коллекции':'Не получен'}</span></div><div class="item-body"><span class="rarity ${item.rarity}">${rarityNames[item.rarity]}</span><h3>${STYLES.find(style=>style.id===item.style).name}</h3><p>${item.kind==='board'?'Доска 8 × 8':PIECE_NAMES[item.type]+' · обе стороны'}</p>${button}${!owned?`<small>Повтор: +${duplicateRefund(item)} ✧</small>`:'<small>Можно включать в свои наборы</small>'}</div></article>`;
};
const renderSets = state => {
  const saved = state.sets.map(set=>`<article class="set-card"><div class="set-preview">${equipmentPreview(set)}</div><h3>${escapeHTML(set.name)}</h3><p>Сохранённый набор</p><div class="actions"><button class="quiet" data-load-set="${escapeHTML(set.id)}">Использовать</button><button class="text-button" data-delete-set="${escapeHTML(set.id)}" aria-label="Удалить набор ${escapeHTML(set.name)}">Удалить</button></div></article>`).join('');
  const presets = STYLES.map(style=>{
    const equipment=presetEquipment(style.id);
    const total=[...Object.values(equipment.pieces),equipment.board].filter(id=>state.owned.includes(id)).length;
    return `<article class="set-card"><div class="set-preview">${equipmentPreview(equipment)}</div><span class="rarity ${style.rarity}">${rarityNames[style.rarity]}</span><h3>${style.name}</h3><p>${total}/7 предметов · 6 фигур и доска</p><button class="quiet" data-preset="${style.id}" ${total<7?'disabled':''}>${total===7?'Использовать набор':'Соберите все предметы'}</button></article>`;
  }).join('');
  return `<div class="section-title"><h2>Мои наборы</h2><button class="primary" data-save-set>Сохранить текущий</button></div>${saved?`<div class="sets-grid">${saved}</div>`:'<p class="empty-note">Выберите скин для каждого типа фигур и доску, затем сохраните сочетание.</p>'}<h2 class="preset-heading">Готовые коллекции</h2><div class="sets-grid">${presets}</div>`;
};
export const renderCollection = (root,state,view,type) => {
  const board = itemById(state.equipped.board);
  root.innerHTML = `<article class="loadout"><div><p class="eyebrow">ВАШ НАБОР</p><h2>Шесть фигур. Ваше сочетание.</h2><p>Доска: ${STYLES.find(style=>style.id===board.style).name}</p><button class="text-button" data-save-set>Сохранить сочетание ↗</button></div><div class="loadout-pieces">${TYPES.map(pieceType=>`<button data-piece-type="${pieceType}" class="loadout-slot ${type===pieceType&&view==='pieces'?'active':''}" aria-label="Настроить: ${PIECE_NAMES[pieceType]}">${pieceSVG(pieceType,'w',itemById(state.equipped.pieces[pieceType]).style)}<span>${PIECE_NAMES[pieceType]}</span></button>`).join('')}</div></article><div class="collection-toolbar"><div class="segmented" role="group" aria-label="Тип коллекции">${[['pieces','Фигуры'],['boards','Доски'],['sets','Наборы']].map(([id,label])=>`<button data-collection-view="${id}" class="${view===id?'active':''}" aria-pressed="${view===id}">${label}</button>`).join('')}</div><span class="muted">${state.owned.length}/${ITEMS.length} предметов · ${state.shards} ✧</span></div>${view==='sets'?renderSets(state):`<p class="catalog-note">${view==='pieces'?`${PIECE_NAMES[type]}: скин применяется ко всем фигурам этого типа. Белые остаются светлыми, чёрные — тёмными.`:'Доска выбирается отдельно от фигур. Любую полученную доску можно включить в свой набор.'}</p><div class="items-grid">${ITEMS.filter(item=>view==='boards'?item.kind==='board':item.kind==='piece'&&item.type===type).map(item=>renderItem(state,item)).join('')}</div>`}`;
};
