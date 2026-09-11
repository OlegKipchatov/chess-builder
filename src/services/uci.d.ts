import type {MoveInput,EngineProfile} from '../domain/types';
export type Client={terminate:()=>void;postMessage:(data:{id:number;pgn:string;fen:string;rating:number;difficulty:string;engineProfile?:EngineProfile|null})=>void;onmessage:((event:MessageEvent<{move:MoveInput|null}>)=>void)|null;onerror:((event:unknown)=>void)|null};
export const createStockfishClient:(spawn:()=>Worker)=>Client;
