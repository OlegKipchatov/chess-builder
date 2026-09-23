import {initialActivity, normalizeActivity} from './activity.js?v=35';
import {validArchivedProfile,migrateEngineProfile} from './strength.js?v=35';
import {initialRating, normalizeRating, validRatingSnapshot, ratingSnapshot} from './rating.js?v=35';
import {Chess} from './chess.js?v=35';
import {TYPES, STYLES, ITEMS, baseInventory, defaultEquipment, pieceId, boardId, itemById} from './catalog.js?v=35';
export const KEY = 'chess-vault-v3';
export const createRecordId = () => {
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
export const PREVIOUS_KEY = 'chess-vault-v2';
export const LEGACY_KEY = 'chess-vault-v1';
export const newGame = (mode='bot', difficulty='adaptive') => ({pgn:'', mode, difficulty, playerColor:'w', started:false, settled:false, resigned:false});
export const initialState = () => ({version:3, activity:initialActivity(), archive:[], rating:initialRating(), settings:{mode:'bot',difficulty:'adaptive'}, coins:100, shards:0, owned:baseInventory(), equipped:defaultEquipment(), sets:[], pity:0, played:0, opened:0, game:newGame()});
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
const hasMoves = pgn => {
  try {const game=new Chess();game.loadPgn(pgn);return game.history().length>0;} catch {return false;}
};
export const migrateState = input => {
  if (!input || typeof input !== 'object') return initialState();
  const next = {...initialState(), coins:integer(input.coins,100), shards:integer(input.shards), pity:Math.min(9,integer(input.pity)), played:integer(input.played), opened:integer(input.opened)};
  const legacy = ![2,3].includes(input.version);
  const owned = Array.isArray(input.owned) ? input.owned : [];
  const ids = legacy ? ITEMS.filter(item => owned.includes(item.style)).map(item => item.id) : owned;
  next.owned = [...new Set([...baseInventory(),...ids.filter(id => itemById(id))])];
  const style = STYLES.some(s => s.id === input.skin) ? input.skin : 'classic';
  const equipment = legacy ? {pieces:Object.fromEntries(TYPES.map(type => [type,pieceId(style,type)])), board:boardId(style)} : input.equipped;
  next.equipped = validEquipment(equipment,next.owned);
  next.game = {...newGame(), pgn:typeof input.game?.pgn === 'string' ? input.game.pgn : '', mode:input.game?.mode === 'local' ? 'local' : 'bot', difficulty:['easy','normal','hard','adaptive'].includes(input.game?.difficulty) ? input.game.difficulty : 'normal', settled:input.game?.settled === true, resigned:input.game?.resigned === true};
  next.settings = {mode:input.settings?.mode === 'local' ? 'local' : input.settings?.mode === 'bot' ? 'bot' : next.game.mode, difficulty:['easy','normal','hard','adaptive'].includes(input.settings?.difficulty) ? input.settings.difficulty : next.game.difficulty};
  next.activity = normalizeActivity(input.activity);
  next.rating = normalizeRating(input.rating);
  next.game.rating = validRatingSnapshot(input.game?.rating) ? {...input.game.rating} : null;
  next.game.engineFailure = typeof input.game?.engineFailure?.fen==='string'&&typeof input.game.engineFailure.message==='string'?{fen:input.game.engineFailure.fen.slice(0,120),message:input.game.engineFailure.message.slice(0,240)}:null;
  next.game.engineProfile = validArchivedProfile(input.game?.engineProfile)?{...input.game.engineProfile}:null;
  next.game.started = typeof input.game?.started === 'boolean' ? input.game.started : hasMoves(next.game.pgn);
  next.game.equipped = validEquipment(input.game?.equipped || next.equipped,next.owned);
  next.settings = {mode:'bot',difficulty:'adaptive'};
  next.game.playerColor = input.game?.playerColor === 'b' ? 'b' : 'w';
  if(next.game.mode==='bot' && !next.game.settled){
    next.game.difficulty='adaptive';
    if(next.game.started && !next.game.rating)next.game.rating=ratingSnapshot(next.rating);
    if(next.game.started&&!next.game.resigned)next.game.engineProfile=migrateEngineProfile(next.game.engineProfile,{playerElo:next.game.rating?.before??next.rating.value,targetElo:next.game.rating?.opponent,pgn:next.game.pgn});
  }
  next.archive = (Array.isArray(input.archive)?input.archive:[]).filter(entry=>typeof entry?.id==='string'&&typeof entry.pgn==='string').map(entry=>({
    ...(entry.counted===false?{counted:false}:{}),
    ...(typeof entry.engineFailure?.fen==='string'&&typeof entry.engineFailure.message==='string'?{engineFailure:{fen:entry.engineFailure.fen.slice(0,120),message:entry.engineFailure.message.slice(0,240)}}:{}),
    id:entry.id,pgn:entry.pgn,engineProfile:validArchivedProfile(entry.engineProfile)?{...entry.engineProfile}:null,finishedAt:typeof entry.finishedAt==='string'?entry.finishedAt:'',
    mode:entry.mode==='local'?'local':'bot',playerColor:entry.playerColor==='b'?'b':'w',equipped:validEquipment(entry.equipped,next.owned),
    result:typeof entry.result==='string'?entry.result.slice(0,40):'Партия завершена',points:integer(entry.points),
    playerRating:integer(entry.playerRating,1000),opponentRating:Number.isSafeInteger(entry.opponentRating)?entry.opponentRating:null,
    ratingDelta:Number.isSafeInteger(entry.ratingDelta)?entry.ratingDelta:null
  }));
  next.sets = (Array.isArray(input.sets) ? input.sets : []).filter(s => typeof s?.id === 'string' && typeof s.name === 'string').slice(0,12).map(s => ({id:s.id, name:s.name.trim().slice(0,32)||'Мой набор', ...validEquipment(s,next.owned)}));
  return next;
};
export const loadState = storage => {
  const saved = storage.getItem(KEY);
  if (saved !== null) {const input=JSON.parse(saved),next=migrateState(input);if(!input.activity||JSON.stringify(input.game?.engineProfile)!==JSON.stringify(next.game.engineProfile))storage.setItem(KEY,JSON.stringify(next));return next;}
  const legacy = storage.getItem(PREVIOUS_KEY) ?? storage.getItem(LEGACY_KEY);
  const next = migrateState(legacy ? JSON.parse(legacy) : null);
  storage.setItem(KEY,JSON.stringify(next));
  return next;
};
