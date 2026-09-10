import {TYPES, PIECE_NAMES, STYLES, ITEMS, rarityNames, itemById, pieceId, boardId, craftCost} from './catalog.js?v=6';
import {pieceSVG, itemPreview, equipmentPreview} from './pieces.js?v=6';
export const escapeHTML = value => String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const presetEquipment = style => ({pieces:Object.fromEntries(TYPES.map(type=>[type,pieceId(style,type)])),board:boardId(style)});
export const canEquipPreset = (state,style) => [...Object.values(presetEquipment(style).pieces),boardId(style)].every(id=>state.owned.includes(id));
const isEquipped = (state,item) => item.kind === 'board' ? state.equipped.board === item.id : state.equipped.pieces[item.type] === item.id;
const sameEquipment = (first,second) => first.board===second.board&&TYPES.every(type=>first.pieces[type]===second.pieces[type]);
const renderItem = (state,item,craft=false) => {
  const owned=state.owned.includes(item.id), equipped=isEquipped(state,item), cost=craftCost(item);
  const style=STYLES.find(style=>style.id===item.style);
  const action=craft?`data-craft="${item.id}"`:owned?`data-equip="${item.id}"`:`data-craft-link="${item.id}"`;
  const disabled=craft?(owned||state.shards<cost):equipped;
  const label=craft?(owned?'Уже получен':`${cost} ✧ · создать`):equipped?'✓ Выбрано':owned?'Выбрать':'Перейти в крафт';
  return `<article class="compact-item ${equipped?'equipped':''}"><div class="compact-item-art" style="--item-accent:${style.accent}">${itemPreview(item)}</div><div class="compact-item-copy"><span class="rarity ${item.rarity}">${rarityNames[item.rarity]}</span><h3>${style.name}</h3><span class="item-ownership">${owned?'В коллекции':'Ещё не получен'}</span></div><button class="${equipped?'equipped-button':'quiet'}" ${action} ${disabled?'disabled':''}>${label}</button></article>`;
};
const presetCard = (state,style) => {
  const equipment=presetEquipment(style.id), ids=[...Object.values(equipment.pieces),equipment.board];
  const total=ids.filter(id=>state.owned.includes(id)).length, equipped=sameEquipment(state.equipped,equipment);
  const missing=ids.filter(id=>!state.owned.includes(id));
  const preview=ids.map(id=>{const item=itemById(id);return `<span class="preset-part ${state.owned.includes(id)?'':'missing'}" title="${item.name}${state.owned.includes(id)?' · получен':' · не получен'}">${item.kind==='piece'?pieceSVG(item.type,'w',item.style):itemPreview(item)}</span>`;}).join('');
  return `<article class="compact-set ${equipped?'equipped':''}"><div class="row"><h3>${style.name}</h3><span class="rarity ${style.rarity}">${rarityNames[style.rarity]}</span></div><div class="preset-parts">${preview}</div><div class="row set-completion"><span>${total}/7 получено</span><span>${equipped?'Сейчас выбрана':total===7?'Коллекция собрана':'Соберите недостающие'}</span></div><progress max="7" value="${total}" aria-label="${style.name}: ${total} из 7"></progress>${missing.length?`<details><summary>Что осталось собрать?</summary><ul>${missing.map(id=>{const item=itemById(id);return `<li><button class="text-button" data-piece-type="${item.kind==='board'?'board':item.type}">${item.kind==='board'?'Доска':PIECE_NAMES[item.type]} →</button></li>`;}).join('')}</ul></details>`:''}<button class="${equipped?'equipped-button':'quiet'}" data-preset="${style.id}" ${total<7||equipped?'disabled':''}>${equipped?'✓ Выбрана':total===7?'Выбрать коллекцию':'Не все предметы получены'}</button></article>`;
};
const renderSaved = state => {
  const cards=state.sets.map(set=>`<article class="compact-set"><div class="row"><h3>${escapeHTML(set.name)}</h3><span class="saved-label">Свой набор</span></div><div class="set-preview">${equipmentPreview(set)}</div><p class="saved-board">Доска: ${STYLES.find(style=>style.id===itemById(set.board).style).name}</p><div class="actions"><button class="quiet" data-load-set="${escapeHTML(set.id)}">Использовать</button><button class="text-button" data-delete-set="${escapeHTML(set.id)}" aria-label="Удалить набор ${escapeHTML(set.name)}">Удалить</button></div></article>`).join('');
  return `<div class="section-title"><h2>Мои наборы <span class="muted">${state.sets.length}/12</span></h2><button class="quiet" data-save-set>Сохранить текущий</button></div>${cards?`<div class="compact-sets-grid">${cards}</div>`:'<p class="empty-note">Здесь будут ваши сочетания. Выберите фигурки и доску, затем нажмите «Сохранить набор».</p>'}`;
};
const renderItems = (state,type,ownedOnly) => {
  const items=ITEMS.filter(item=>(type==='board'?item.kind==='board':item.kind==='piece'&&item.type===type)&&(!ownedOnly||state.owned.includes(item.id)));
  const filters=[...TYPES,'board'].map(slot=>`<button data-piece-type="${slot}" class="${slot===type?'active':''}" aria-pressed="${slot===type}">${slot==='board'?'Доски':PIECE_NAMES[slot]}</button>`).join('');
  return `<div class="item-type-filter" role="group" aria-label="Тип предмета">${filters}</div><div class="catalog-heading"><p>${type==='board'?'Доска выбирается независимо от фигур.':`${PIECE_NAMES[type]} · скин применяется к обеим сторонам.`}</p><button class="filter-toggle" data-owned-only aria-pressed="${ownedOnly}">${ownedOnly?'✓ Только полученные':'Все предметы'}</button></div><div class="compact-items-grid">${items.map(item=>renderItem(state,item)).join('')}</div>`;
};
export const renderCollection = (root,state,view='sets',type='k',ownedOnly=false) => {
  const slots=[...TYPES,'board'].map(slot=>{const item=itemById(slot==='board'?state.equipped.board:state.equipped.pieces[slot]);return `<button class="equipment-slot" data-piece-type="${slot}" title="${item.name}" aria-label="Настроить: ${slot==='board'?'доска':PIECE_NAMES[slot]}">${slot==='board'?itemPreview(item):pieceSVG(slot,'w',item.style)}<span>${slot==='board'?'Доска':PIECE_NAMES[slot]}</span></button>`;}).join('');
  const content=view==='saved'?renderSaved(state):view==='items'?renderItems(state,type,ownedOnly):`<p class="catalog-note">Выберите всю коллекцию одним нажатием. Полупрозрачные предметы ещё не получены.</p><div class="compact-sets-grid">${STYLES.map(style=>presetCard(state,style)).join('')}</div>`;
  root.innerHTML=`<article class="equipment-strip"><div class="strip-label"><p class="eyebrow">ВЫБРАННЫЙ НАБОР</p><button class="text-button" data-save-set>Сохранить набор</button></div><div class="equipment-slots">${slots}</div></article><div class="collection-toolbar"><div class="segmented" role="group" aria-label="Раздел коллекции">${[['sets','Коллекции'],['items','Фигуры и доски'],['saved','Мои наборы']].map(([id,label])=>`<button data-collection-view="${id}" class="${view===id?'active':''}" aria-pressed="${view===id}">${label}</button>`).join('')}</div><span class="muted">${state.owned.length}/${ITEMS.length} предметов · ${state.shards} ✧</span></div>${content}`;
};

export const renderCraft = (root,state,type='k') => {
  const items=ITEMS.filter(item=>type==='board'?item.kind==='board':item.kind==='piece'&&item.type===type);
  const filters=[...TYPES,'board'].map(slot=>`<button data-craft-type="${slot}" class="${slot===type?'active':''}" aria-pressed="${slot===type}">${slot==='board'?'Доски':PIECE_NAMES[slot]}</button>`).join('');
  root.innerHTML=`<div class="craft-balance"><span>Доступно осколков</span><strong>${state.shards} ✧</strong></div><div class="item-type-filter" role="group" aria-label="Тип создаваемого предмета">${filters}</div><p class="catalog-note">Создайте недостающий предмет без случайности. Осколки выпадают из сундуков и начисляются за повторы.</p><div class="compact-items-grid">${items.map(item=>renderItem(state,item,true)).join('')}</div>`;
};
