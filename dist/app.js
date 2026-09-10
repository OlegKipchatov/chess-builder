import {Chess} from './chess.js';
import {SKINS,rarityNames,rollChest,rewardFor} from './engine.js';
const $ = selector => document.querySelector(selector);
const KEY='chess-vault-v1';
const initial = () => ({coins:100,owned:['classic'],skin:'classic',pity:0,played:0,game:{pgn:'',mode:'bot',settled:false,resigned:false}});
let state=initial();let storageAvailable=true;
try {const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Number.isSafeInteger(saved.coins)&&saved.coins>=0&&Array.isArray(saved.owned)&&saved.game){state={...initial(),...saved};state.owned=state.owned.filter(id=>SKINS.some(s=>s.id===id));if(!state.owned.includes('classic'))state.owned.unshift('classic');if(!state.owned.includes(state.skin))state.skin='classic';state.pity=Math.max(0,Math.min(9,Number(state.pity)||0));}}catch{storageAvailable=false;}
const game=new Chess();try{if(state.game.pgn)game.loadPgn(state.game.pgn);}catch{state.game=initial().game;game.reset();}
let selected=null,promotion=null,busy=false,worker=null,taskId=0,toastTimer,installPrompt=null;
const symbols={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const pieceNames={k:'король',q:'ферзь',r:'ладья',b:'слон',n:'конь',p:'пешка'};
const toast = message => {$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',4500);};
const save = () => {state.game.pgn=game.pgn();try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageAvailable=false;toast('Не удалось сохранить прогресс. Проверьте доступное место и настройки браузера.');}};
const showModal = html => {$('#modal-content').innerHTML=html;$('#close-modal').hidden=false;if(!$('#modal').open)$('#modal').showModal();};
const ended = () => state.game.resigned||game.isGameOver();
const settle = () => {
 if(!ended()||state.game.settled)return;
 const reward=rewardFor(game,state.game.resigned,state.game.mode);
 state.coins+=reward;state.played++;state.game.settled=true;save();
 showModal(`<p class="eyebrow">ПАРТИЯ ЗАВЕРШЕНА</p><h2>${statusText()}</h2><div class="reveal">◈</div><h2>+${reward} монет</h2><p>${reward?'Отличный повод заглянуть в хранилище.':'Награда начисляется после 10 полуходов или при мате.'}</p>`);
};
const statusText = () => {
 if(state.game.resigned)return state.game.mode==='bot'?'Вы сдались':`${game.turn()==='w'?'Белые':'Чёрные'} сдались`;
 if(game.isCheckmate())return `Мат. ${game.turn()==='w'?'Чёрные':'Белые'} победили`;
 if(game.isStalemate())return 'Пат. Ничья';
 if(game.isThreefoldRepetition())return 'Ничья: повторение позиции';
 if(game.isInsufficientMaterial())return 'Ничья: недостаточно фигур';
 if(game.isDraw())return 'Ничья';
 return `${game.isCheck()?'Шах! ':''}Ход ${game.turn()==='w'?'белых':'чёрных'}`;
};
const renderBoard = () => {
 const skin=SKINS.find(s=>s.id===state.skin)||SKINS[0];const board=$('#board');
 board.style.setProperty('--piece-white',skin.white);board.style.setProperty('--piece-black',skin.black);board.style.setProperty('--square-light',skin.light);board.style.setProperty('--square-dark',skin.dark);
 const legal=selected?game.moves({square:selected,verbose:true}).map(m=>m.to):[];const last=game.history({verbose:true}).at(-1);
 board.innerHTML=game.board().flatMap((row,r)=>row.map((p,c)=>{const square='abcdefgh'[c]+(8-r);return `<button class="square ${(r+c)%2?'dark':''} ${p?.color==='b'?'black':''} ${p?'occupied':''} ${selected===square?'selected':''} ${legal.includes(square)?'legal':''} ${last&&(last.from===square||last.to===square)?'last':''}" data-square="${square}" aria-label="${square}${p?`, ${p.color==='w'?'белые':'чёрные'}: ${pieceNames[p.type]}`:', пусто'}" aria-pressed="${selected===square}">${p?symbols[p.type]:''}${c===0?`<span class="coord rank" aria-hidden="true">${8-r}</span>`:''}${r===7?`<span class="coord" aria-hidden="true">${'abcdefgh'[c]}</span>`:''}</button>`;})).join('');
 $('#skin-name').textContent=skin.name;
};
const renderCollection = () => {
 $('#skins').innerHTML=SKINS.map(s=>{const owned=state.owned.includes(s.id);return `<article class="skin-card ${owned?'':'locked'}"><div class="skin-preview" style="background:linear-gradient(135deg,${s.dark},${s.light});color:${s.white}">♜ ♞ ♛</div><span class="rarity ${s.rarity}">${rarityNames[s.rarity]}</span><h2>${s.name}</h2><button data-skin="${s.id}" class="${state.skin===s.id?'primary':'quiet'}" ${!owned||state.skin===s.id?'disabled':''}>${!owned?'В сундуках':state.skin===s.id?'✓ Выбран':'Выбрать'}</button></article>`;}).join('');
};
const render = () => {
 renderBoard();renderCollection();$('#coins').textContent=state.coins;$('#count').textContent=`${state.owned.length}/${SKINS.length}`;
 $('#mode').value=state.game.mode;$('#mode').disabled=game.history().length>0&&!ended();$('#opponent').textContent=state.game.mode==='bot'?'Компьютер':'Второй игрок';
 $('.reward-card p').textContent=state.game.mode==='local'?'Завершённая партия +40 монет':'Победа +60 · ничья +40 · поражение +25';$('#status').textContent=statusText();$('#thinking').textContent=busy?'Обдумывает ход…':ended()?'Партия завершена':'Без таймера';
 $('#resign').disabled=ended()||!game.history().length||busy;
 $('#hint').textContent=ended()?'Начните новую партию или откройте сундук.':busy?'Компьютер выбирает ответ.':'Выберите фигуру, чтобы увидеть доступные ходы.';
 const moves=game.history();$('#move-count').textContent=moves.length;$('#moves').innerHTML=moves.length?Array.from({length:Math.ceil(moves.length/2)},(_,i)=>`<div class="move-row"><span class="muted">${i+1}.</span><span>${moves[i*2]}</span><span>${moves[i*2+1]||'—'}</span></div>`).join(''):'<p class="muted">Первый ход за вами.</p>';$('#moves').scrollTop=$('#moves').scrollHeight;
 $('#open-chest').disabled=state.coins<100;$('#chest-hint').textContent=state.coins<100?`Не хватает ${100-state.coins} монет. Сыграйте партию.`:'100 монет за сундук · повторы возвращают 35.';
 $('#pity').textContent=`До гарантии: ${10-state.pity} сундуков`;
};
const requestBot = () => {
 if(ended()||state.game.mode!=='bot'||game.turn()!=='b'||busy)return;
 busy=true;render();const id=++taskId;
 try{worker??=new Worker('./bot-worker.js',{type:'module'});worker.onmessage=({data})=>{if(data.id!==taskId)return;busy=false;if(data.move){game.move(data.move);save();settle();render();}};worker.onerror=()=>{busy=false;worker?.terminate();worker=null;render();toast('Компьютер недоступен. Перезагрузите приложение для повторной попытки.');};worker.postMessage({id,fen:game.fen()});}catch{busy=false;render();toast('Браузер не поддерживает компьютерного соперника. Выберите игру вдвоём.');}
};
const movePiece = (from,to,promote='q') => {try{game.move({from,to,promotion:promote});selected=null;promotion=null;save();settle();render();requestBot();}catch{selected=null;render();}};
$('#board').addEventListener('click',event=>{
 const button=event.target.closest('[data-square]');if(!button||busy||ended()||(state.game.mode==='bot'&&game.turn()==='b'))return;
 const square=button.dataset.square;const piece=game.get(square);
 if(selected){const moves=game.moves({square:selected,verbose:true}).filter(m=>m.to===square);if(moves.length){if(moves.some(m=>m.promotion)){promotion={from:selected,to:square};showModal(`<h2>Превращение пешки</h2><p>Выберите фигуру</p><div class="promotion">${['q','r','b','n'].map(type=>`<button data-promote="${type}" aria-label="${pieceNames[type]}">${symbols[type]}</button>`).join('')}</div>`);$('#close-modal').hidden=true;return;}movePiece(selected,square);return;}}
 selected=piece?.color===game.turn()?(selected===square?null:square):null;renderBoard();
});
$('#modal-content').addEventListener('click',event=>{const type=event.target.closest('[data-promote]')?.dataset.promote;if(type&&promotion){const {from,to}=promotion;$('#modal').close();movePiece(from,to,type);}});
$('#modal').addEventListener('cancel',()=>{promotion=null;selected=null;renderBoard();});
$('#close-modal').onclick=()=>$('#modal').close();
const changeTab = tab => {document.querySelectorAll('.tab').forEach(s=>s.hidden=s.id!==tab);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>changeTab(b.dataset.tab));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>changeTab(b.dataset.go));
$('#skins').onclick=event=>{const id=event.target.closest('[data-skin]')?.dataset.skin;if(!id||!state.owned.includes(id))return;state.skin=id;save();render();toast('Набор выбран. Он уже на вашей доске.');};
$('#open-chest').onclick=()=>{
 if(state.coins<100)return;
 const result=rollChest(state.owned,state.pity);state.coins-=100;state.pity=result.pity;if(result.duplicate)state.coins+=35;else state.owned.push(result.skin.id);save();render();
 showModal(`<p class="eyebrow">${result.duplicate?'НАБОР УЖЕ В КОЛЛЕКЦИИ':'НОВЫЙ НАБОР!'}</p><div class="reveal" style="color:${result.skin.white}">♛</div><span class="rarity ${result.skin.rarity}">${rarityNames[result.skin.rarity]}</span><h2>${result.skin.name}</h2><p>${result.duplicate?'Компенсация за повтор: +35 монет.':'Набор добавлен в коллекцию. Выберите его, чтобы изменить фигуры.'}</p>`);
};
$('#new').onclick=()=>{if(game.history().length&&!ended()&&!confirm('Завершить текущую партию без награды и начать новую?'))return;taskId++;worker?.terminate();worker=null;busy=false;game.reset();state.game={pgn:'',mode:$('#mode').value,settled:false,resigned:false};selected=null;save();render();};
$('#resign').onclick=()=>{if(busy||ended()||!confirm('Сдаться и завершить партию?'))return;state.game.resigned=true;settle();render();};
$('#mode').onchange=()=>{state.game.mode=$('#mode').value;save();render();requestBot();};
$('#install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else showModal('<h2>Установить Chess Vault</h2><p>На iPhone: откройте сайт в Safari, нажмите «Поделиться» → «На экран Домой».</p><p>На Android и компьютере: в меню браузера выберите «Установить приложение». Если пункта нет, откройте сайт в отдельной вкладке браузера.</p><p>После первого открытия можно играть без интернета.</p>');};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{$('#install').hidden=true;toast('Приложение установлено');});
if(matchMedia('(display-mode: standalone)').matches)$('#install').hidden=true;
window.addEventListener('storage',event=>{if(event.key===KEY){location.reload();}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('Офлайн-режим недоступен. Игра работает при подключении к сети.'));
render();settle();render();requestBot();if(!storageAvailable)toast('Сохранение недоступно или повреждено. Проверьте настройки браузера.');
