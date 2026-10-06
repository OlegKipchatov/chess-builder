import {choosePveMove} from './pve-ai.js?v=114';
self.onmessage = ({data}) => {
 try{self.postMessage({id:data.id,move:choosePveMove(data.battle)});}
 catch{self.postMessage({id:data.id,error:'Не удалось выбрать ход'});}
};
