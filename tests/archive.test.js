import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {initialState,migrateState} from '../dist/state.js';
import {createStartedGame} from '../dist/session.js';
import {capturePoints,completedMatch} from '../dist/archive.js';
const match = () => {const state=initialState();state.game=createStartedGame(state,()=>0.9);return state;};
const meta={id:'one',finishedAt:'2026-09-10T20:00:00.000Z'};
test('Завершение сохраняет PGN, начисляет награды и освобождает главный экран',()=>{const state=match(),game=new Chess();['f3','e5','g4','Qh4#'].forEach(move=>game.move(move));const result=completedMatch(state,game,meta);assert.equal(result.entry.result,'Победа');assert.equal(result.reward,21);assert.equal(result.state.rating.value,1023);assert.equal(result.state.game.started,false);assert.equal(result.state.game.pgn,'');const replay=new Chess();replay.loadPgn(result.entry.pgn);assert.equal(replay.fen(),game.fen());assert.equal(result.state.archive.length,1);assert.equal(completedMatch(result.state,game,meta),null);});
test('Сдача без собственного хода не меняет прогресс, в том числе после хода ИИ',()=>{for(const color of ['w','b']){const state=match(),game=new Chess();state.game.playerColor=color;if(color==='b')game.move('e4');state.game.resigned=true;const result=completedMatch(state,game,meta);assert.equal(result.cancelled,true);assert.equal(result.entry,null);assert.equal(result.reward,0);assert.deepEqual(result.state.rating,state.rating);assert.equal(result.state.played,state.played);assert.deepEqual(result.state.archive,state.archive);assert.equal(result.state.game.started,false);}});
test('Сдача после своего хода учитывается и сохраняется',()=>{const state=match(),game=new Chess();game.move('e4');game.move('e5');state.game.resigned=true;const result=completedMatch(state,game,meta);assert.equal(result.entry.result,'Поражение');assert.equal(result.state.played,1);assert.equal(result.state.rating.value,959);assert.deepEqual(migrateState(result.state).archive,result.state.archive);});
test('Старая уже оплаченная партия архивируется без повторной выплаты',()=>{const state=match();state.game.resigned=true;state.game.settled=true;state.played=5;const result=completedMatch(state,new Chess(),meta);assert.equal(result.state.coins,state.coins);assert.equal(result.state.played,5);assert.deepEqual(result.state.rating,state.rating);});
test('Незавершённая партия не переносится в архив',()=>{assert.equal(completedMatch(match(),new Chess(),meta),null);});
test('Очки учитывают взятия и сторону, включая взятие на проходе',()=>{const game=new Chess();['e4','a6','e5','d5','exd6'].forEach(move=>game.move(move));assert.equal(capturePoints(game,'w'),1);assert.equal(capturePoints(game,'b'),0);});
test('Разница материала бывает положительной, отрицательной и нулевой',async()=>{const {materialBalance}=await import('../dist/archive.js');const game=new Chess();assert.equal(materialBalance(game,'w'),0);['e4','d5','exd5'].forEach(move=>game.move(move));assert.equal(materialBalance(game,'w'),1);assert.equal(materialBalance(game,'b'),-1);game.move('Qxd5');assert.equal(materialBalance(game,'w'),0);});

test('История считает полные ходы и конечный баланс со стороны игрока, игнорируя старые очки',async()=>{
 const {historyMetrics}=await import('../dist/archive.js');
 const game=new Chess();['e4','d5','exd5','Qxd5','Nc3'].forEach(move=>game.move(move));
 const entry={pgn:game.pgn(),playerColor:'w',points:99};
 assert.deepEqual(historyMetrics(entry),{moves:3,balance:0});
 game.move('Qe5+');game.move('Be2');game.move('Qxe2+');entry.pgn=game.pgn();
 assert.deepEqual(historyMetrics(entry),{moves:4,balance:-3});
 assert.deepEqual(historyMetrics({...entry,playerColor:'b'}),{moves:4,balance:3});
 assert.deepEqual(historyMetrics({pgn:'invalid',points:99}),{moves:null,balance:null});
});
test('История учитывает превращение и взятие на проходе в финальном материале',async()=>{
 const {historyMetrics,materialBalance}=await import('../dist/archive.js');
 for(const game of [new Chess(),new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1')]){
  (game.fen().startsWith('7k')?['a8=Q+']:['e4','a6','e5','d5','exd6']).forEach(move=>game.move(move));
  assert.equal(historyMetrics({pgn:game.pgn(),playerColor:'w'}).balance,materialBalance(game,'w'));
 }
});
test('Строка истории показывает время, ходы и материал вместо суммы взятий',async()=>{
 const {renderArchiveList}=await import('../dist/ui/components/archive-list.js');
 const root={style:{setProperty:()=>{}},scrollTop:0,clientHeight:520};
 renderArchiveList(root,[{id:'a',result:'Победа',finishedAt:'2026-09-27T07:30:00Z',playerColor:'w',pgn:'1. e4 d5 2. exd5',points:99}]);
 assert.match(root.innerHTML,/2 хода/);assert.match(root.innerHTML,/Материал/);assert.match(root.innerHTML,/>\+1</);assert.match(root.innerHTML,/datetime="2026-09-27T07:30:00.000Z"/);assert.doesNotMatch(root.innerHTML,/очк|99/);
});
