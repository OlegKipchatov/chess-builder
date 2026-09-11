import {useEffect,useMemo,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {useSnapshot,useStore} from '../app/context';
import {createGame} from '../services/store';
import {materialBalance} from '../domain/archive.js';
import {itemById,PIECE_NAMES} from '../domain/catalog.js';
import {Piece} from '../shared/ui/Piece';
import {IconButton} from '../shared/ui/Icon';
import {Dialog} from '../shared/ui/Dialog';
import {Board} from './Board';
import type {Entry,PieceType,MoveInput,Color} from '../domain/types';
export const GameScreen=({archiveId}:{archiveId?:string})=>{
 const {data,result}=useSnapshot(),store=useStore();
 const archive=archiveId?data.archive.find(entry=>entry.id===archiveId):undefined;
 if(archiveId&&!archive)return <><Link to="/profile">К истории</Link><p>Партия не найдена.</p></>;
 if(!data.game.started&&!result&&!archive)return <section id="play"><h1>Игра</h1><div className="game-ready"><div><h2>Готовы сыграть?</h2><p className="muted">Адаптивный ИИ · случайная сторона</p></div><button className="primary" onClick={()=>store.start()}>Начать партию</button></div><article className="reward-card" id="play-rewards"><div><h3>Играйте и пополняйте коллекцию</h3><p>Победа — 60, ничья — 40, поражение — 25 монет.</p><small>Награда после 10 полуходов; при мате ограничение снимается.</small></div></article></section>;
 return <MatchView key={archive?.id||'live'} archive={archive}/>;
};
const MatchView=({archive}:{archive?:Entry})=>{
 const {data,busy,result}=useSnapshot(),store=useStore();
 const pgn=archive?.pgn??result?.entry.pgn??data.game.pgn;
 const config=archive?{...archive,rating:{before:archive.playerRating,opponent:archive.opponentRating}}:result?.config||data.game;
 const full=useMemo(()=>createGame(pgn),[pgn]),moves=full.history({verbose:true});
 const [review,setReview]=useState<number|null>(archive?0:null),[running,setRunning]=useState(false),[selected,setSelected]=useState<string|null>(null),[promotion,setPromotion]=useState<MoveInput|null>(null),[resign,setResign]=useState(false),[transitioning,setTransitioning]=useState(false);
 const cursor=review??moves.length;
 const viewed=useMemo(()=>{const game=createGame(pgn);while(game.history().length>cursor)game.undo();return game;},[pgn,cursor]);
 const color=config.playerColor as Color,equipped=config.equipped||data.equipped,points=materialBalance(viewed,color);
 useEffect(()=>{setTransitioning(true);const timer=setTimeout(()=>setTransitioning(false),420);return()=>clearTimeout(timer);},[cursor,pgn]);
 useEffect(()=>{if(!running)return;if(cursor>=moves.length){setRunning(false);return;}const timer=setTimeout(()=>setReview(cursor+1),1250);return()=>clearTimeout(timer);},[running,cursor,moves.length]);
 useEffect(()=>{const pause=()=>{if(document.hidden)setRunning(false);};document.addEventListener('visibilitychange',pause);return()=>document.removeEventListener('visibilitychange',pause);},[]);
 const jump=(next:number|null)=>{setRunning(false);setSelected(null);setReview(next===moves.length?null:next);};
 const playable=!archive&&!result&&review===null&&!busy&&!transitioning&&(data.game.mode!=='bot'||full.turn()===color);
 const choose=(square:string)=>{
  if(!playable)return;
  if(selected){const legal=full.moves({square:selected,verbose:true}).filter(move=>move.to===square);if(legal.length){if(legal.some(move=>move.promotion)){setPromotion({from:selected,to:square});return;}store.play({from:selected,to:square});setSelected(null);return;}}
  setSelected(full.get(square)?.color===full.turn()?square:null);
 };
 const score=<span data-balance={points>0?'positive':points<0?'negative':'zero'}>{points>0?'+':''}{points} очк.</span>;
 return <section id="play"><div className="game-heading">{archive&&<Link to="/profile" className="quiet icon-button" aria-label="К истории партий"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 5-7 7 7 7"/></svg></Link>}<div><p className="eyebrow">{archive?'ИСТОРИЯ ПАРТИИ':'ЗА ДОСКОЙ'}</p><h1>{archive?archive.result:result?'Партия завершена':'В игре'}</h1></div><strong className="material-score">{score}</strong></div><div className="game-grid"><div className="board-area"><div className="player"><span className="avatar"><Piece type="n" color={color==='w'?'b':'w'}/></span><div><strong>{config.mode==='bot'?'ИИ':'Соперник'}</strong><small>Рейтинг {config.rating?.opponent??'—'}</small><small>{color==='w'?'Чёрные':'Белые'} фигуры</small></div></div><Board pgn={pgn} cursor={cursor} equipped={equipped} orientation={color} selected={selected} onSelect={choose} disabled={!playable}/><div className="history-toolbar"><div className="history-buttons">{archive&&<IconButton icon={running?'pause':'play'} label={running?'Приостановить воспроизведение':'Начать воспроизведение'} disabled={!moves.length} onClick={()=>{if(running)setRunning(false);else{if(cursor===moves.length)setReview(0);setRunning(true);}}}/>}<IconButton icon="back" label="Предыдущая позиция" disabled={cursor===0} onClick={()=>jump(Math.max(0,cursor-1))}/><IconButton icon="forward" label="Следующая позиция" disabled={cursor===moves.length} onClick={()=>jump(cursor+1===moves.length?null:cursor+1)}/><IconButton icon="last" label={archive?'К последнему ходу':'К текущему ходу'} disabled={review===null} onClick={()=>jump(null)}/></div><span>Позиция {cursor} из {moves.length}</span></div>{review!==null&&!archive&&<p className="history-notice">Просмотр истории. Вернитесь к текущему ходу, чтобы продолжить игру.</p>}<div className="player"><span className="avatar light"><Piece type="p" color={color}/></span><div><strong>Вы</strong><small>Рейтинг {config.rating?.before??data.rating.value}</small><small>{color==='w'?'Белые':'Чёрные'} фигуры</small></div><div className="player-right"><strong className="material-score">{score}</strong><small>{itemById(equipped.board)?.name}</small></div></div></div><aside><article className="panel"><p className="eyebrow">ПАРТИЯ</p><h2>{archive||result?'Просмотр партии':full.isCheck()?'Шах':`Ход ${full.turn()==='w'?'белых':'чёрных'}`}</h2><div className="row"><h3>Ходы</h3><span className="muted">{moves.length}</span></div><div className="moves">{Array.from({length:Math.ceil(moves.length/2)},(_,row)=><div className="move-row" key={row}><span>{row+1}.</span>{[row*2,row*2+1].map(index=>moves[index]&&<button key={index} className={cursor===index+1?'active':''} onClick={()=>jump(index+1)}>{moves[index].san}</button>)}</div>)}{!moves.length&&<p className="muted">Начальная позиция</p>}</div>{!archive&&!result&&<div className="actions match-actions"><button className="quiet" onClick={()=>setResign(true)}>Сдаться</button></div>}</article></aside></div>{promotion&&<Dialog title="Превращение пешки" onClose={()=>setPromotion(null)}><div className="actions">{(['q','r','b','n'] as PieceType[]).map(type=><button className="quiet" key={type} aria-label={PIECE_NAMES[type]} onClick={()=>{store.play({...promotion,promotion:type});setPromotion(null);setSelected(null);}}><Piece type={type} color={color}/></button>)}</div></Dialog>}{resign&&<Dialog title="Сдаться?" onClose={()=>setResign(false)}><p>Партия будет записана как поражение.</p><button className="quiet" onClick={()=>{store.resign();setResign(false);}}>Подтвердить сдачу</button></Dialog>}</section>;
};
