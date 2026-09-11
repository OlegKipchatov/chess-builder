import type {Color,PieceType,MoveInput} from './types';
export type Move={from:string;to:string;color:Color;piece:PieceType;flags:string;san:string;before:string;after:string;promotion?:PieceType;captured?:PieceType};
export type BoardPiece={square:string;type:PieceType;color:Color};
export class Chess {
 constructor(fen?:string);
 loadPgn(pgn:string):void;load(fen:string):void;pgn():string;fen():string;turn():Color;
 history(options:{verbose:true}):Move[];history(options?:{verbose?:false}):string[];
 moves(options:{square?:string;verbose:true}):Move[];moves(options?:{square?:string;verbose?:false}):string[];
 board():(BoardPiece|null)[][];get(square:string):BoardPiece|undefined;
 move(move:MoveInput|string):Move;undo():Move|null;reset():void;
 isGameOver():boolean;isCheck():boolean;isCheckmate():boolean;isStalemate():boolean;isDraw():boolean;isThreefoldRepetition():boolean;isInsufficientMaterial():boolean;
}
