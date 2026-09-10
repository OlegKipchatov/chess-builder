import {chooseMove} from './engine.js';
self.onmessage = ({data}) => self.postMessage({id:data.id,move:chooseMove(data.fen)});
