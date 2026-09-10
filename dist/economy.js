import {ITEMS, CHEST_COST, EMPTY_SHARDS, itemById, craftCost, duplicateRefund} from './catalog.js?v=2';
export const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const select = (items, rng) => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
export const rollChest = (owned, pity, rng = random) => {
  const guarantee = pity >= 9;
  const outcome = rng();
  if (!guarantee && outcome >= .95) return {kind:'shards', item:null, duplicate:false, shards:EMPTY_SHARDS, pity:pity+1};
  const kind = outcome < (guarantee ? .9 : .85) ? 'piece' : 'board';
  const roll = rng();
  const rarity = guarantee ? (roll < .9 ? 'epic' : 'legendary') : roll < .6 ? 'common' : roll < .9 ? 'rare' : roll < .99 ? 'epic' : 'legendary';
  const item = select(ITEMS.filter(item => item.kind === kind && item.rarity === rarity), rng);
  const duplicate = owned.includes(item.id);
  return {kind, item, duplicate, shards:duplicate ? duplicateRefund(item) : 0, pity:['epic','legendary'].includes(rarity) ? 0 : pity+1};
};
export const openChest = (state, rng = random) => {
  if (state.coins < CHEST_COST) return null;
  const result = rollChest(state.owned, state.pity, rng);
  const owned = result.item && !result.duplicate ? [...state.owned,result.item.id] : [...state.owned];
  return {state:{...state, coins:state.coins-CHEST_COST, shards:state.shards+result.shards, owned, pity:result.pity, opened:state.opened+1}, result};
};
export const craftItem = (state, id) => {
  const item = itemById(id);
  if (!item || item.rarity === 'base' || state.owned.includes(id) || state.shards < craftCost(item)) return null;
  return {...state, shards:state.shards-craftCost(item), owned:[...state.owned,id]};
};
