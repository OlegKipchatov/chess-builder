import {Chess} from './chess.js?v=115';
export const MAX_PGN_BYTES=512*1024;
export const importPgn = value => {
 if(typeof value!=='string'||!value.trim())throw Error('Вставьте текст PGN или выберите файл.');
 if(new TextEncoder().encode(value).length>MAX_PGN_BYTES)throw Error('Файл слишком большой. Максимум — 512 КБ.');
 const text=value.replace(/^\uFEFF/,'').trim();
 // Reject a second header block or another game after a termination marker.
 const plain=text.replace(/\{[^}]*\}/gs,' ').replace(/;[^\n]*/g,' ');
 const body=plain.replace(/^(?:\s*\[\w+\s+"(?:[^"\\]|\\.)*"\]\s*)*/,'');
 if(/\[\w+\s+"/.test(body)||/(?:^|\s)(?:1-0|0-1|1\/2-1\/2|\*)\s+\S/.test(body))throw Error('Откройте PGN одной партии.');
 const game=new Chess();
 try {game.loadPgn(text);}catch{throw Error('Не удалось прочитать PGN. Проверьте заголовки и последовательность ходов.');}
 if(!game.history().length)throw Error('В PGN нет ходов для просмотра.');
 const headers=game.getHeaders();
 return {game,config:{imported:true,counted:false,mode:'imported',started:true,playerColor:'w',pgn:game.pgn(),white:headers.White||'Белые',black:headers.Black||'Чёрные',result:headers.Result||'*'}};
};
