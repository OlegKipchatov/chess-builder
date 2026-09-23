import {TYPES,pieceId,boardId} from './catalog.js?v=35';
export const presetEquipment = style => ({pieces:Object.fromEntries(TYPES.map(type=>[type,pieceId(style,type)])),board:boardId(style)});
export const canEquipPreset = (state,style) => [...Object.values(presetEquipment(style).pieces),boardId(style)].every(id=>state.owned.includes(id));
