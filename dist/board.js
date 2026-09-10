import {Chess} from './chess.js?v=5';
import {PIECE_NAMES, itemById, styleById} from './catalog.js?v=5';
import {pieceSVG} from './pieces.js?v=5';
export const renderBoard = (root, game, equipped, selected, orientation='w') => {
  const style = styleById(itemById(equipped.board)?.style);
  root.style.setProperty('--square-light',style.light);
  root.style.setProperty('--square-dark',style.dark);
  const legal = selected ? game.moves({square:selected,verbose:true}).map(move=>move.to) : [];
  const last = game.history({verbose:true}).at(-1);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset.square : null;
  root.innerHTML = game.board().flatMap((row,r) => row.map((piece,c) => {
    const square = 'abcdefgh'[c]+(8-r);
    const check = piece?.type === 'k' && piece.color === game.turn() && game.isCheck();
    const classes = ['square',(r+c)%2?'dark':'',piece?'occupied':'',selected===square?'selected':'',legal.includes(square)?'legal':'',last&&(last.from===square||last.to===square)?'last':'',check?'check':''].join(' ');
    return `<button class="${classes}" data-square="${square}" aria-label="${square}${piece?`, ${piece.color==='w'?'белые':'чёрные'}: ${PIECE_NAMES[piece.type]}`:', пусто'}${legal.includes(square)?', доступный ход':''}" aria-pressed="${selected===square}">${piece?pieceSVG(piece.type,piece.color,itemById(equipped.pieces[piece.type])?.style):''}${c===(orientation==='b'?7:0)?`<span class="coord rank" aria-hidden="true">${8-r}</span>`:''}${r===(orientation==='b'?0:7)?`<span class="coord" aria-hidden="true">${'abcdefgh'[c]}</span>`:''}</button>`;
  })).filter(Boolean)[orientation==='b'?'reverse':'slice']().join('');
  if (focused) root.querySelector(`[data-square="${focused}"]`)?.focus({preventScroll:true});
};
export const snapshotBoard = root => new Map([...root.querySelectorAll('[data-square]')].map(cell => [cell.dataset.square,{rect:cell.getBoundingClientRect(),icon:cell.querySelector('svg')?.outerHTML}]));
export const animationMoves = move => {
  const result = [{from:move.from,to:move.to}];
  const rank = move.from[1];
  if (move.flags.includes('k')) result.push({from:`h${rank}`,to:`f${rank}`});
  if (move.flags.includes('q')) result.push({from:`a${rank}`,to:`d${rank}`});
  return result;
};
// Stable identities let history jumps move each piece, including both rooks in castling.
export const historyMoves = (game,from,to) => {
  const moves=game.history({verbose:true});
  const start=new Chess(moves[0]?.before||game.fen());
  const identities=new Map(start.board().flat().filter(Boolean).map(piece=>[piece.square,piece.square]));
  const snapshots=[new Map(identities)];
  for(const move of moves){
    const identity=identities.get(move.from);
    identities.delete(move.from);
    if(move.flags.includes('e'))identities.delete(move.to[0]+move.from[1]);
    identities.set(move.to,identity);
    for(const step of animationMoves(move).slice(1)){
      const rook=identities.get(step.from);identities.delete(step.from);identities.set(step.to,rook);
    }
    snapshots.push(new Map(identities));
  }
  const before=snapshots[from], after=snapshots[to];
  return [...before].flatMap(([square,id])=>{
    const target=[...after].find(([,other])=>other===id)?.[0];
    return target&&target!==square?[{from:square,to:target}]:[];
  });
};
export const animateTransition = async (root, steps, before) => {
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!root.getBoundingClientRect().width||!root.animate)return;
  const rect=root.getBoundingClientRect(), nodes=[],hidden=[],animations=[];
  const timing={duration:420,easing:'cubic-bezier(.25,.1,.25,1)',fill:'forwards'};
  const overlay=source=>{
    if(!source?.icon)return null;
    const node=document.createElement('span');node.className='moving-piece';node.innerHTML=source.icon;
    Object.assign(node.style,{left:`${source.rect.left-rect.left-root.clientLeft}px`,top:`${source.rect.top-rect.top-root.clientTop}px`,width:`${source.rect.width}px`,height:`${source.rect.height}px`});
    root.append(node);nodes.push(node);return node;
  };
  const hide=icon=>{if(icon){icon.style.visibility='hidden';hidden.push(icon);}};
  try {
    for(const step of steps){
      const source=before.get(step.from), target=before.get(step.to), node=overlay(source);
      if(!node||!target)continue;
      hide(root.querySelector(`[data-square="${step.to}"] svg`));
      animations.push(node.animate([{transform:'translate(0,0)'},{transform:`translate(${target.rect.left-source.rect.left}px,${target.rect.top-source.rect.top}px)`}],timing).finished);
    }
    for(const [square,source] of before){
      const icon=root.querySelector(`[data-square="${square}"] svg`);
      const leaves=steps.some(step=>step.from===square), arrives=steps.some(step=>step.to===square);
      if(!leaves&&!arrives&&source.icon===icon?.outerHTML)continue;
      if(source.icon&&!leaves){const node=overlay(source);animations.push(node.animate([{opacity:1},{opacity:0}],timing).finished);}
      if(icon&&!arrives){const node=overlay({...source,icon:icon.outerHTML});hide(icon);animations.push(node.animate([{opacity:0},{opacity:1}],timing).finished);}
    }
    await Promise.allSettled(animations);
  } finally {nodes.forEach(node=>node.remove());hidden.forEach(icon=>icon.style.visibility='');}
};
export const animateMove = (root,move,before) => animateTransition(root,animationMoves(move),before);
