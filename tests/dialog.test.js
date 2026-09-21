import test from 'node:test';
import assert from 'node:assert/strict';
import {createDialog} from '../dist/ui/dialog.js';
const setup = ({reduced=false,mobile=true}={}) => {
 const root=new EventTarget(),events=[],animations=[];
 root.open=false;root.classList={add:()=>{},remove:()=>{}};root.setAttribute=()=>{};root.removeAttribute=()=>{};
 root.showModal=()=>{root.open=true;events.push('open');};
 root.close=()=>{root.open=false;events.push('close');};
 root.animate=()=>{let finish;const finished=new Promise(resolve=>{finish=resolve;});animations.push(finish);return {finished,cancel:()=>{}};};
 const content={innerHTML:'',querySelector:()=>({})},button={};
 globalThis.window={matchMedia:query=>({matches:query.includes('reduced-motion')?reduced:mobile})};
 globalThis.document={activeElement:null,body:{classList:root.classList},querySelectorAll:()=>[],querySelector:()=>null};
 root.addEventListener('dialogdismiss',()=>events.push('dismiss'));
 return {root,content,button,events,animations,show:createDialog(root,content,button)};
};
test('Смена содержимого ждёт скрытия шторки; замена не завершает результат партии',async()=>{
 const ui=setup();await ui.show('Подтверждение');
 const next=ui.show('Результат');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.content.innerHTML,'Подтверждение');assert.equal(ui.root.open,true);
 ui.animations.shift()();await next;
 assert.equal(ui.content.innerHTML,'Результат');assert.deepEqual(ui.events,['open','close','open']);
 const closing=ui.show.close();const repeated=ui.show.close();await new Promise(resolve=>setImmediate(resolve));
 ui.animations.shift()();await Promise.all([closing,repeated]);
 assert.deepEqual(ui.events,['open','close','open','close','dismiss']);
});
test('Окно активности появляется только после полного закрытия результата',async()=>{
 const ui=setup({reduced:true});
 ui.root.addEventListener('dialogdismiss',()=>{void ui.show('День закрыт');});
 await ui.show('Результат');await ui.show.close();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.root.open,true);assert.equal(ui.content.innerHTML,'День закрыт');assert.equal(ui.animations.length,0);
});
test('Выбор превращения нельзя закрыть Escape; обычное окно можно',async()=>{
 const ui=setup({mobile:false});await ui.show('Превращение',{hideClose:true});
 const cancel=new Event('cancel',{cancelable:true});ui.root.dispatchEvent(cancel);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(cancel.defaultPrevented,true);assert.equal(ui.root.open,true);assert.equal(ui.button.hidden,true);
 await ui.show('Обычное');ui.root.dispatchEvent(new Event('cancel',{cancelable:true}));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.root.open,false);
});
