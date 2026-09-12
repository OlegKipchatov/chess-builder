import {chooseMove} from './engine.js?v=13';
self.onmessage = ({data}) => {
  try {self.postMessage({id:data.id,move:chooseMove(data.fen,data.difficulty,Math.random,data.rating)});}
  catch {self.postMessage({id:data.id,error:'Не удалось рассчитать ход'});}
};
