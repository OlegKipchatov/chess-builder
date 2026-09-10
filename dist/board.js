import {PIECE_NAMES, itemById, styleById} from './catalog.js?v=3';
import {pieceSVG} from './pieces.js?v=3';
export const renderBoard = (root, game, equipped, selected) => {
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
    return `<button class="${classes}" data-square="${square}" aria-label="${square}${piece?`, ${piece.color==='w'?'белые':'чёрные'}: ${PIECE_NAMES[piece.type]}`:', пусто'}${legal.includes(square)?', доступный ход':''}" aria-pressed="${selected===square}">${piece?pieceSVG(piece.type,piece.color,itemById(equipped.pieces[piece.type])?.style):''}${c===0?`<span class="coord rank" aria-hidden="true">${8-r}</span>`:''}${r===7?`<span class="coord" aria-hidden="true">${'abcdefgh'[c]}</span>`:''}</button>`;
  })).join('');
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
export const animateMove = async (root, move, before) => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !root.getBoundingClientRect().width || !root.animate) return;
  const boardRect = root.getBoundingClientRect();
  const nodes = [], hidden = [], animations = [];
  const overlay = (source, className='') => {
    if (!source?.icon) return null;
    const node = document.createElement('span');
    node.className = `moving-piece ${className}`;
    node.innerHTML = source.icon;
    Object.assign(node.style,{left:`${source.rect.left-boardRect.left-root.clientLeft}px`,top:`${source.rect.top-boardRect.top-root.clientTop}px`,width:`${source.rect.width}px`,height:`${source.rect.height}px`});
    root.append(node);nodes.push(node);return node;
  };
  const capturedSquare = move.flags.includes('e') ? move.to[0]+move.from[1] : move.to;
  if (move.captured) {
    const captured = overlay(before.get(capturedSquare),'captured-piece');
    if (captured) animations.push(captured.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.75)'}],{duration:180,fill:'forwards'}).finished);
  }
  for (const step of animationMoves(move)) {
    const source = before.get(step.from), target = before.get(step.to);
    const node = overlay(source);
    if (!node || !target) continue;
    const destination = root.querySelector(`[data-square="${step.to}"] svg`);
    if (destination) {destination.style.visibility='hidden';hidden.push(destination);}
    animations.push(node.animate([{transform:'translate(0,0)'},{transform:`translate(${target.rect.left-source.rect.left}px,${target.rect.top-source.rect.top}px)`}],{duration:240,easing:'cubic-bezier(.2,.75,.25,1)',fill:'forwards'}).finished);
  }
  try {await Promise.allSettled(animations);} finally {nodes.forEach(node=>node.remove());hidden.forEach(node=>node.style.visibility='');}
};
