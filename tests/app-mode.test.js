import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {initialState,migrateState} from '../dist/state.js';
import {createStartedGame,navigationTarget,updatePreferences} from '../dist/session.js';
import {historyMoves,renderBoard,animateTransition} from '../dist/board.js';
import {settleRating} from '../dist/rating.js';
import {rewardFor} from '../dist/engine.js';
import {renderCollection} from '../dist/collection.js';
const setupBoard = (states=[]) => {
 const parse = html => [...html.matchAll(/<button ([^>]+)>([\s\S]*?)<\/button>/g)].map(([,attributes,innerHTML])=>{
  const attrs=Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value]));
  return {dataset:{square:attrs['data-square']},className:attrs.class,innerHTML,getAttribute:name=>attrs[name],setAttribute:(name,value)=>{attrs[name]=value;},get outerHTML(){return `<button class="${this.className}" data-square="${this.dataset.square}">${this.innerHTML}</button>`;}};
 });
 globalThis.document={activeElement:null,createElement:()=>({content:{children:[]},set innerHTML(html){this.content.children=parse(html);}})};
 let cells=[];
 return {style:{setProperty:()=>{}},classList:{toggle:(name,value)=>states.push([name,value])},contains:()=>false,querySelectorAll:()=>cells,replaceChildren:(...next)=>{cells=next;},get innerHTML(){return cells.map(cell=>cell.outerHTML).join('');}};
};
const play = moves => {const game=new Chess();moves.forEach(move=>game.move(move));return game;};
test('Стартовый экран — игра; коллекция доступна только вне партии',()=>{const state=initialState(),game=new Chess();assert.equal(navigationTarget(state,game,''),'play');assert.equal(navigationTarget(state,game,'collection'),'collection');state.game=createStartedGame(state,()=>0);assert.equal(navigationTarget(state,game,'craft'),'play');});
test('Сторона случайна и сохраняется; настройки сложности всегда адаптивные',()=>{const state=initialState();state.settings.difficulty='hard';assert.equal(createStartedGame(state,()=>0.49).playerColor,'w');state.game=createStartedGame(state,()=>0.5);assert.equal(state.game.playerColor,'b');assert.equal(state.game.difficulty,'adaptive');assert.equal(migrateState(state).game.playerColor,'b');assert.equal(updatePreferences(initialState(),new Chess(),{mode:'bot',difficulty:'easy'}).settings.difficulty,'adaptive');});
test('Старые сохранения сохраняют белую сторону и переходят на адаптацию',()=>{const state=initialState();state.game={started:true,mode:'bot',difficulty:'hard'};const restored=migrateState(state);assert.equal(restored.game.playerColor,'w');assert.equal(restored.game.difficulty,'adaptive');assert.equal(restored.game.rating.opponent,900);assert.equal(restored.game.engineProfile.id,'cognitive-v2');});
test('Победа чёрными повышает рейтинг и даёт награду победителя',()=>{const state=initialState();state.game=createStartedGame(state,()=>0.9);const game=play(['f3','e5','g4','Qh4#']);assert.equal(rewardFor(game,false,'bot','b'),21);assert.equal(settleRating(state,game).value,1023);state.game.playerColor='w';assert.equal(rewardFor(game,false,'bot','w'),11);assert.equal(settleRating(state,game).value,959);});
test('История анимирует прямые, обратные ходы и прыжок нескольких фигур',()=>{const game=play(['e4','e5','Nf3']);assert.deepEqual(historyMoves(game,2,3),[{from:'g1',to:'f3'}]);assert.deepEqual(historyMoves(game,3,2),[{from:'f3',to:'g1'}]);assert.equal(historyMoves(game,0,3).length,3);});
test('История отслеживает рокировку, взятие на проходе и превращение',()=>{const castle=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');castle.move('O-O');assert.deepEqual(historyMoves(castle,1,0),[{from:'g1',to:'e1'},{from:'f1',to:'h1'}]);const ep=play(['e4','a6','e5','d5','exd6']);assert.deepEqual(historyMoves(ep,5,4),[{from:'d6',to:'e5'}]);const promo=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');promo.move('a8=Q');assert.deepEqual(historyMoves(promo,1,0),[{from:'a8',to:'a7'}]);});
test('Доска за чёрных развёрнута без разворота рисунков фигур',()=>{const root=setupBoard();renderBoard(root,new Chess(),initialState().equipped,null,'b');assert.ok(root.innerHTML.indexOf('data-square="h1"')<root.innerHTML.indexOf('data-square="a8"'));assert.equal((root.innerHTML.match(/data-square=/g)||[]).length,64);delete globalThis.document;});
test('Выбор фигуры переключает приоритет подсветки, сохраняя последний ход',()=>{
 const states=[];
 const root=setupBoard(states);
 const game=play(['e4','e5']);
 renderBoard(root,game,initialState().equipped,null);
 renderBoard(root,game,initialState().equipped,'g1');
 assert.deepEqual(states,[['has-selection',false],['has-selection',true]]);
 assert.match(root.innerHTML,/class="[^"]*selected[^"]*" data-square="g1"/);
 assert.match(root.innerHTML,/class="[^"]*last[^"]*" data-square="e5"/);
 delete globalThis.document;
});
test('Предмет выбирается и создаётся в коллекции без дублирующих чипов',()=>{const root={},state=initialState();renderCollection(root,state,'items');assert.ok(root.innerHTML.includes('data-craft="'));assert.ok(root.innerHTML.includes('data-equip='));assert.ok(!root.innerHTML.includes('item-type-filter'));});
test('Режим уменьшенного движения отключает переходы',async()=>{globalThis.matchMedia=()=>({matches:true});await animateTransition({},[],new Map());delete globalThis.matchMedia;});

test('Ход бота сохраняет все клетки доски и содержимое неподвижных фигур',()=>{
 const root=setupBoard(),game=play(['e4']),equipment=initialState().equipped;
 renderBoard(root,game,equipment,null);
 const before=[...root.querySelectorAll()],rook=before.find(cell=>cell.dataset.square==='a1'),markup=rook.innerHTML;
 let rewrites=0;Object.defineProperty(rook,'innerHTML',{get:()=>markup,set:()=>{rewrites++;}});
 game.move('e5');renderBoard(root,game,equipment,null);renderBoard(root,game,equipment,null);
 assert.ok(root.querySelectorAll().every((cell,index)=>cell===before[index]));assert.equal(rewrites,0);
 delete globalThis.document;
});
