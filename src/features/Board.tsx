import {useMemo,useRef,type CSSProperties} from 'react';
import {createGame} from '../services/store';
import {Piece} from '../shared/ui/Piece';
import {itemById,styleById,PIECE_NAMES} from '../domain/catalog.js';
import type {Color,Equipment,PieceType} from '../domain/types';
import styles from './Board.module.css';
export const Board=({pgn,cursor,equipped,orientation,selected,onSelect,disabled}:{pgn:string;cursor:number;equipped:Equipment;orientation:Color;selected:string|null;onSelect:(square:string)=>void;disabled:boolean})=>{
 const root=useRef<HTMLDivElement>(null);
 const {game,identities}=useMemo(()=>{
  const full=createGame(pgn),moves=full.history({verbose:true}),game=createGame();if(moves[0])game.load(moves[0].before);
  const identities=new Map(game.board().flat().filter(Boolean).map(piece=>[piece!.square,piece!.square]));
  for(const move of moves.slice(0,cursor)){
   const id=identities.get(move.from)!;identities.delete(move.from);if(move.flags.includes('e'))identities.delete(move.to[0]+move.from[1]);identities.set(move.to,id);
   if(move.flags.includes('k')||move.flags.includes('q')){const from=(move.flags.includes('k')?'h':'a')+move.from[1],to=(move.flags.includes('k')?'f':'d')+move.from[1];identities.set(to,identities.get(from)!);identities.delete(from);}
   game.move(move);
  }
  return {game,identities};
 },[pgn,cursor]);
 const theme=styleById(itemById(equipped.board)?.style),last=game.history({verbose:true}).at(-1);
 const legal=selected?game.moves({square:selected,verbose:true}).map(move=>move.to):[];
 const cells=game.board().flatMap((row,r)=>row.map((piece,c)=>({piece,square:'abcdefgh'[c]+(8-r),r,c})));
 if(orientation==='b')cells.reverse();
 return <div ref={root} className={`${styles.board} board`} style={{'--square-light':theme.light,'--square-dark':theme.dark} as CSSProperties} role="group" aria-label="Шахматная доска" onKeyDown={event=>{
  const steps:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8};if(!(event.key in steps))return;event.preventDefault();const buttons=Array.from(root.current!.querySelectorAll<HTMLButtonElement>('button'));const index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[Math.max(0,Math.min(63,index+steps[event.key]))]?.focus();
 }}>{cells.map(({piece,square,r,c},index)=><button key={square} data-square={square} className={`square ${(r+c)%2?'dark':''} ${piece?'occupied':''} ${selected===square?'selected':''} ${legal.includes(square)?'legal':''} ${last&&(last.from===square||last.to===square)?'last':''} ${piece?.type==='k'&&piece.color===game.turn()&&game.isCheck()?'check':''}`} aria-label={`${square}${piece?`, ${piece.color==='w'?'белые':'чёрные'}: ${PIECE_NAMES[piece.type]}`:', пусто'}`} aria-pressed={selected===square} aria-disabled={disabled} onClick={()=>{if(!disabled)onSelect(square);}}>{index%8===0&&<span className="coord rank">{8-r}</span>}{index>=56&&<span className="coord">{'abcdefgh'[c]}</span>}</button>)}<div className={styles.pieces} aria-hidden="true">{cells.filter(cell=>cell.piece).map(({piece,square,r,c})=><span key={identities.get(square)} className={styles.piece} style={{transform:`translate(${(orientation==='b'?7-c:c)*100}%,${(orientation==='b'?7-r:r)*100}%)`}}><Piece type={piece!.type as PieceType} color={piece!.color as Color} style={itemById(equipped.pieces[piece!.type as PieceType])?.style}/></span>)}</div></div>;
};
