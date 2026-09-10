import {chooseMove} from './engine.js?v=3';
self.onmessage = ({data}) => {
  try {self.postMessage({id:data.id,move:chooseMove(data.fen,data.difficulty)});}
  catch {self.postMessage({id:data.id,error:'Не удалось рассчитать ход'});}
};
