import {Chess} from '../domain/chess.js';
import {initialState,loadState,migrateState,KEY} from '../domain/state.js';
import {createStartedGame} from '../domain/session.js';
import {completedMatch} from '../domain/archive.js';
import {openChest,craftItem} from '../domain/economy.js';
import {itemById,TYPES,boardId,pieceId} from '../domain/catalog.js';
import type {State,Snapshot,MoveInput,Equipment,Match} from '../domain/types';
export const STORAGE_KEY='chess-vault-preprod-v3';
export const createGame=(pgn='')=>{const game=new Chess();if(pgn)game.loadPgn(pgn);return game;};
export const createStore=()=>{
 let snapshot:Snapshot={data:initialState() as unknown as State,ready:false,error:null,busy:false,result:null,notice:null};
 let storage:Storage|null=null;
 const listeners=new Set<()=>void>();
 const emit=(patch:Partial<Snapshot>)=>{snapshot={...snapshot,...patch};listeners.forEach(listener=>listener());};
 const active=()=>snapshot.data.game.started&&!snapshot.result;
 const commit=(data:State,patch:Partial<Snapshot>={})=>{
  try{if(!storage)throw Error();storage.setItem(STORAGE_KEY,JSON.stringify(data));emit({data,error:null,...patch});return true;}
  catch{emit({error:'Не удалось сохранить прогресс. Проверьте доступное место и разрешение хранения.'});return false;}
 };
 const complete=(data:State)=>{
  const game=createGame(data.game.pgn);
  const result=completedMatch(data,game,{id:crypto.randomUUID(),finishedAt:new Date().toISOString()});
  if(!result)return commit(data);
  return commit(result.state as unknown as State,{busy:false,result:data.game.settled?null:{entry:result.entry,config:data.game,reward:result.reward} as Snapshot['result']});
 };
 const play=(move:MoveInput,bot=false)=>{
  if(!active())return false;
  const data=snapshot.data,game=createGame(data.game.pgn);
  if(data.game.mode==='bot'&&(game.turn()!==data.game.playerColor)!==bot)return false;
  try{game.move(move);}catch{return false;}
  const next={...data,game:{...data.game,pgn:game.pgn()}};
  return game.isGameOver()?complete(next):commit(next,{busy:false});
 };
 const idle=()=>!active()&&!snapshot.result;
 return {
  getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
  initialize:(target:Storage)=>{
   if(snapshot.ready)return;storage=target;
   try{const adapter={getItem:(key:string)=>target.getItem(key===KEY?STORAGE_KEY:`preprod:${key}`),setItem:(_key:string,value:string)=>target.setItem(STORAGE_KEY,value)};
    const data=loadState(adapter) as unknown as State;createGame(data.game.pgn);emit({data,ready:true});
    if(data.game.started&&(data.game.resigned||createGame(data.game.pgn).isGameOver()))complete(data);
   }catch{emit({ready:true,error:'Не удалось прочитать сохранение. Исходные данные оставлены в браузере.'});}
  },
  start:()=>{if(!idle())return false;return commit({...snapshot.data,game:createStartedGame(snapshot.data) as Match});},
  play,
  resign:()=>active()&&complete({...snapshot.data,game:{...snapshot.data.game,resigned:true}}),
  dismissResult:()=>emit({result:null}),dismissNotice:()=>emit({notice:null}),clearError:()=>emit({error:null}),
  setBusy:(busy:boolean)=>emit({busy}),setError:(error:string)=>emit({error,busy:false}),
  openChest:()=>{if(!idle())return;const outcome=openChest(snapshot.data);if(!outcome)return;
   const r=outcome.result;commit(outcome.state as State,{notice:{title:r.item?(r.duplicate?'Повтор предмета':r.item.name):'Осколки',body:r.duplicate?`${r.item?.name}. Компенсация: ${r.shards} ✧`:r.item?'Предмет добавлен в коллекцию.':`Вы получили ${r.shards} ✧`}});
  },
  craft:(id:string)=>{if(!idle())return;const next=craftItem(snapshot.data,id);if(next)commit(next,{notice:{title:'Предмет создан',body:itemById(id)?.name||''}});},
  equip:(id:string)=>{if(!idle()||!snapshot.data.owned.includes(id))return;const item=itemById(id);if(!item)return;const equipped=structuredClone(snapshot.data.equipped);if(item.kind==='board')equipped.board=id;else equipped.pieces[item.type as keyof Equipment['pieces']]=id;commit({...snapshot.data,equipped});},
  preset:(style:string)=>{if(!idle())return;const equipped={pieces:Object.fromEntries(TYPES.map(type=>[type,pieceId(style,type)])),board:boardId(style)} as Equipment;if([...Object.values(equipped.pieces),equipped.board].every(id=>snapshot.data.owned.includes(id)))commit({...snapshot.data,equipped});},
  saveSet:(name:string)=>{if(!idle()||!name.trim()||snapshot.data.sets.length>=12)return;commit({...snapshot.data,sets:[...snapshot.data.sets,{...structuredClone(snapshot.data.equipped),id:crypto.randomUUID(),name:name.trim().slice(0,32)}]});},
  loadSet:(id:string)=>{if(!idle())return;const set=snapshot.data.sets.find(set=>set.id===id);if(set)commit({...snapshot.data,equipped:{pieces:{...set.pieces},board:set.board}});},
  deleteSet:(id:string)=>{if(idle())commit({...snapshot.data,sets:snapshot.data.sets.filter(set=>set.id!==id)});},
  importData:(input:unknown)=>{if(!idle())return false;try{const data=migrateState(input) as unknown as State;const game=createGame(data.game.pgn);return data.game.started&&(data.game.resigned||game.isGameOver())?complete(data):commit(data);}catch{emit({error:'Файл не содержит корректного сохранения.'});return false;}}
 };
};
export type Store=ReturnType<typeof createStore>;
