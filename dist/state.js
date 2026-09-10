import {TYPES, STYLES, ITEMS, baseInventory, defaultEquipment, pieceId, boardId, itemById} from './catalog.js?v=2';
export const KEY = 'chess-vault-v2';
export const LEGACY_KEY = 'chess-vault-v1';
export const newGame = (mode='bot', difficulty='normal') => ({pgn:'', mode, difficulty, settled:false, resigned:false});
export const initialState = () => ({version:2, coins:100, shards:0, owned:baseInventory(), equipped:defaultEquipment(), sets:[], pity:0, played:0, opened:0, game:newGame()});
const integer = (value, fallback=0) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;
export const validEquipment = (candidate, owned) => {
  const equipped = defaultEquipment();
  for (const type of TYPES) {
    const item = itemById(candidate?.pieces?.[type]);
    if (item?.kind === 'piece' && item.type === type && owned.includes(item.id)) equipped.pieces[type] = item.id;
  }
  const board = itemById(candidate?.board);
  if (board?.kind === 'board' && owned.includes(board.id)) equipped.board = board.id;
  return equipped;
};
export const migrateState = input => {
  if (!input || typeof input !== 'object') return initialState();
  const next = {...initialState(), coins:integer(input.coins,100), shards:integer(input.shards), pity:Math.min(9,integer(input.pity)), played:integer(input.played), opened:integer(input.opened)};
  const legacy = input.version !== 2;
  const owned = Array.isArray(input.owned) ? input.owned : [];
  const ids = legacy ? ITEMS.filter(item => owned.includes(item.style)).map(item => item.id) : owned;
  next.owned = [...new Set([...baseInventory(),...ids.filter(id => itemById(id))])];
  const style = STYLES.some(s => s.id === input.skin) ? input.skin : 'classic';
  const equipment = legacy ? {pieces:Object.fromEntries(TYPES.map(type => [type,pieceId(style,type)])), board:boardId(style)} : input.equipped;
  next.equipped = validEquipment(equipment,next.owned);
  next.game = {...newGame(), pgn:typeof input.game?.pgn === 'string' ? input.game.pgn : '', mode:input.game?.mode === 'local' ? 'local' : 'bot', difficulty:['easy','normal','hard'].includes(input.game?.difficulty) ? input.game.difficulty : 'normal', settled:input.game?.settled === true, resigned:input.game?.resigned === true};
  next.sets = (Array.isArray(input.sets) ? input.sets : []).filter(s => typeof s?.id === 'string' && typeof s.name === 'string').slice(0,12).map(s => ({id:s.id, name:s.name.trim().slice(0,32)||'Мой набор', ...validEquipment(s,next.owned)}));
  return next;
};
export const loadState = storage => {
  const saved = storage.getItem(KEY);
  if (saved !== null) return migrateState(JSON.parse(saved));
  const legacy = storage.getItem(LEGACY_KEY);
  const next = migrateState(legacy ? JSON.parse(legacy) : null);
  storage.setItem(KEY,JSON.stringify(next));
  return next;
};
