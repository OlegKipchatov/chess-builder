import test from 'node:test';
import assert from 'node:assert/strict';
import {createDialog} from '../dist/ui/dialog.js';
const setup = ({reduced=false,mobile=true}={}) => {
 const root=new EventTarget(),events=[],animations=[];
 root.getBoundingClientRect=()=>({height:root.testHeight??300});
 root.open=false;root.classList={add:()=>{},remove:()=>{}};root.setAttribute=()=>{};root.removeAttribute=()=>{};
 root.showModal=()=>{root.open=true;events.push('open');};
 root.close=()=>{root.open=false;events.push('close');};
 root.animate=(frames,options)=>{root.lastAnimation={frames,options};let finish;const finished=new Promise(resolve=>{finish=resolve;});animations.push(finish);return {finished,cancel:()=>{}};};
 const content={innerHTML:'',querySelector:()=>({})},button={focus:()=>{}};
 globalThis.window={matchMedia:query=>({matches:query.includes('reduced-motion')?reduced:mobile})};
 globalThis.document={activeElement:null,body:{classList:root.classList},querySelectorAll:()=>[],querySelector:()=>null};
 root.addEventListener('dialogdismiss',()=>events.push('dismiss'));
 return {root,content,button,events,animations,show:createDialog(root,content,button)};
};
test('Подтверждение сдачи заменяется результатом без закрытия окна и backdrop',async()=>{
 const ui=setup();await ui.show('Подтверждение');
 await ui.show('Результат');
 assert.equal(ui.content.innerHTML,'Результат');assert.equal(ui.root.open,true);
 assert.deepEqual(ui.events,['open']);assert.equal(ui.animations.length,0);
 const closing=ui.show.close();const repeated=ui.show.close();await new Promise(resolve=>setImmediate(resolve));
 ui.animations.shift()();await Promise.all([closing,repeated]);
 assert.deepEqual(ui.events,['open','close','dismiss']);
});
test('Окно активности появляется только после полного закрытия результата',async()=>{
 const ui=setup({reduced:true});
 ui.root.addEventListener('dialogdismiss',()=>{void ui.show('День закрыт');});
 await ui.show('Результат');await ui.show.close();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.root.open,true);assert.equal(ui.content.innerHTML,'День закрыт');assert.equal(ui.animations.length,0);
});
test('Выбор превращения нельзя закрыть Escape; обычное окно можно',async()=>{
 const ui=setup({mobile:false,reduced:true});await ui.show('Превращение',{hideClose:true});
 const cancel=new Event('cancel',{cancelable:true});ui.root.dispatchEvent(cancel);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(cancel.defaultPrevented,true);assert.equal(ui.root.open,true);assert.equal(ui.button.hidden,true);
 await ui.show('Обычное');ui.root.dispatchEvent(new Event('cancel',{cancelable:true}));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.root.open,false);
});

test('Результат и серия остаются в одном открытом диалоге до последнего сообщения',async()=>{
 const ui=setup({reduced:true});
 await ui.show('Результат',{next:()=>({html:'Серия',options:{closeLabel:'Продолжить'}})});
 await ui.show.close();
 assert.equal(ui.content.innerHTML,'Серия');assert.equal(ui.root.open,true);
 assert.deepEqual(ui.events,['open']);
 await ui.show.close();
 assert.deepEqual(ui.events,['open','close','dismiss']);
});

test('Мобильная шторка плавно меняет высоту между результатом и серией без закрытия',async()=>{
 const ui=setup();
 await ui.show('Результат',{next:()=>({html:'Серия'})});
 let reads=0;ui.root.getBoundingClientRect=()=>({height:reads++===0?500:280});
 const switching=ui.show.close();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(ui.root.lastAnimation.frames,[{height:'500px'},{height:'280px'}]);
 assert.equal(ui.root.lastAnimation.options.duration,200);
 assert.equal(ui.root.open,true);assert.deepEqual(ui.events,['open']);
 const duplicate=ui.show.close();ui.animations.shift()();await Promise.all([switching,duplicate]);
 assert.deepEqual(ui.events,['open']);assert.equal(ui.content.innerHTML,'Серия');
});
test('Увеличение высоты анимируется только на мобильном экране без reduced motion',async()=>{
 for(const options of [{mobile:true,reduced:false},{mobile:false,reduced:false},{mobile:true,reduced:true}]){
  const ui=setup(options);await ui.show('Подтверждение');
  let reads=0;ui.root.getBoundingClientRect=()=>({height:reads++===0?280:500});
  const switching=ui.show('Результат');await new Promise(resolve=>setImmediate(resolve));
  if(options.mobile&&!options.reduced){assert.deepEqual(ui.root.lastAnimation.frames,[{height:'280px'},{height:'500px'}]);ui.animations.shift()();}
  else assert.equal(ui.animations.length,0);
  await switching;assert.deepEqual(ui.events,['open']);
 }
});
