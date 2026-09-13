import {Chess} from './chess.js?v=20';
const clean = value => String(value).replace(/[\r\n\\"]/g,' ').slice(0,240);
export const exportPgn = (game,config={},error=null) => {
 error??=config.engineFailure;
 const copy=new Chess();copy.loadPgn(game.pgn());
 const color=config.playerColor||'w',playerRating=config.rating?.before??config.playerRating;
 const opponentRating=config.rating?.opponent??config.opponentRating;
 const winner=config.result==='Победа'?color:config.result==='Поражение'||config.resigned?(color==='w'?'b':'w'):copy.isCheckmate()?(copy.turn()==='w'?'b':'w'):null;
 const result=winner?(winner==='w'?'1-0':'0-1'):config.result==='Ничья'||copy.isDraw()?'1/2-1/2':'*';
 const headers={...(config.counted===false?{Termination:'abandoned'}:{}),Event:'GachaChess',Site:'https://olegkipchatov.github.io/chess-builder/',White:color==='w'?'Player':'AI',Black:color==='b'?'Player':'AI',Result:result,GachaChessVersion:'0.2-v20',CurrentFEN:copy.fen()};
 if(playerRating!=null)headers[color==='w'?'WhiteElo':'BlackElo']=playerRating;
 if(opponentRating!=null)headers[color==='w'?'BlackElo':'WhiteElo']=opponentRating;
 const profile=config.engineProfile;
 if(profile){headers.BotModel=profile.id;headers.BotTargetElo=profile.targetElo;headers.BotEffectiveElo=profile.effectiveElo;headers.BotSeed=profile.seed;}
 if(error){headers.LastEngineError=error.message;headers.EngineErrorFEN=error.fen;}
 for(const [key,value] of Object.entries(headers))if(value!=null)copy.setHeader(key,clean(value));
 return copy.pgn();
};
export const pgnFileName = (date=new Date()) => {
 const pad=value=>String(value).padStart(2,'0');
 return `GachaChess_${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.pgn`;
};
export const sharePgn = async (pgn,date=new Date()) => {
 const file=new File([pgn],pgnFileName(date),{type:'application/x-chess-pgn'});
 if(navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share({files:[file],text:pgn});return;}catch(error){if(error.name==='AbortError')return;}}
 downloadPgn(pgn,date);
};
export const downloadPgn = (pgn,date=new Date()) => {
 const file=new File([pgn],pgnFileName(date),{type:'application/x-chess-pgn'});
 const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
};
