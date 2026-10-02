import {createHunt,startHunt,resolvePlayerMove,releaseHuntInput,skipExpiredSpawn,tickHunt,finishHunt,remainingTime,huntBoardAdapter,huntConfig,calculateMiniGameCoins} from '../../hunt.js?v=87';
import {renderBoard,snapshotBoard,animateTransition,showCaptureMaterial} from '../../board.js?v=87';
import {pieceSVG} from '../../pieces.js?v=87';
import {statCard,disclosure} from '../primitives.js?v=87';
export const huntFAQ = () => disclosure('Как играть в «Охоту»?','<p>Управляйте двумя белыми фигурами и набирайте очки взятиями: пешка — 1, конь и слон — 3, ладья — 5, ферзь — 9. Вам выпадают только кони, слоны, ладьи и ферзи — никогда пешки. Используется выбранное оформление из коллекции.</p><p>В начале на доске две фигуры соперника. После каждых двух ваших ходов появляется ещё одна. Новая фигура не может взять вашу в момент появления. Королей и шаха нет; фигуры ходят и берут по обычной геометрии. Можно ходить без взятия — штрафа за это нет.</p><p>Вы играете белыми. После каждого вашего хода одна чёрная фигура делает ответный ход. Если доступно взятие, соперник выбирает самую ценную фигуру; иначе перемещается, создавая угрозы. Пешка ходит на одну клетку вперёд, берёт по диагонали и на последней горизонтали становится ферзём.</p><p>На время: игра длится 60 секунд, потерянные фигуры заменяются. Время идёт и при сворачивании приложения. Бесконечный режим: у вас 3 жизни, потеря фигуры отнимает одну. Пока жизни остаются, фигура заменяется. Каждые 20 единиц взятого материала восстанавливают жизнь. Остаток сохраняется; при трёх жизнях можно накопить не больше 19.</p><p>За завершённую охоту начисляются монеты: чем выше счёт, тем больше награда, но она не равна взятому материалу. Рекорды режимов сохраняются отдельно. Ранний выход не даёт монет и не обновляет рекорд.</p>');

export const huntEntry = () => `<section id="hunt-entry" class="hunt-entry"><h2>Поохотимся?</h2><div class="hunt-modes"><button class="primary" data-hunt-mode="timed">На время</button><button class="primary" data-hunt-mode="endless">Бесконечный</button></div></section>`;

export const mountHunt = ({root,exitButton,mode,runId,runSeed,equipped,award,onExit,showModal,getBest,config=huntConfig}) => {
  let run=createHunt({mode,runId,runSeed},config),selected=null,disposed=false,presenting=false,resultShown=false,rewardSaved=false,restartMode;
  root.innerHTML=`<div class="hunt-surface"><div class="hunt-sides"><span><span class="hunt-side-piece" aria-hidden="true">${pieceSVG('n','w')}</span><strong>Вы — белые</strong></span></div><div class="hunt-hud"><div><span>${mode==='timed'?'Время':'Жизни'}</span><strong id="hunt-resource"></strong></div><div><span>Очки</span><strong id="hunt-score">0</strong></div></div>${mode==='endless'?'<p id="hunt-recovery" class="hunt-recovery"></p>':''}<div id="hunt-board" class="board" role="group" aria-label="Охота — шахматная доска"></div></div>`;
  const board=root.querySelector('#hunt-board');
  const availability = () => {
    const locked=presenting||run.phase!=='awaitingPlayer';
    board.setAttribute('aria-disabled',String(locked));
    board.querySelectorAll('[data-square]').forEach(cell=>cell.setAttribute('aria-disabled',String(locked)));
  };
  const draw = (pieces=run.pieces) => {renderBoard(board,huntBoardAdapter({...run,pieces}),equipped,selected);availability();};
  const hud = () => {
    root.querySelector('#hunt-resource').textContent=mode==='timed'?`${Math.ceil(remainingTime(run,Date.now())/1000)} с`:`${run.lives} / ${config.endlessMaxLives}`;
    root.querySelector('#hunt-score').textContent=run.score;
    if(mode==='endless')root.querySelector('#hunt-recovery').textContent=`До восстановления жизни: ${run.lifeRecoveryMaterial} / ${config.materialPerRecoveredLife}`;
  };
  const complete = () => {
    if(disposed||run.phase!=='finished'||run.finishReason==='abandoned'||resultShown)return;
    resultShown=true;
    const best=getBest(mode),coins=calculateMiniGameCoins(run,config);
    rewardSaved=award(run);
    if(!rewardSaved){
      void showModal('<h2>Не удалось сохранить награду</h2><p>Проверьте свободное место и повторите сохранение.</p><button id="hunt-save" class="primary">Сохранить награду</button>',{hideClose:true});
      return;
    }
    const rewardStep=()=>({html:`<div id="hunt-reward"><h2>Награда за охоту</h2>${statCard(coins,'Монеты')}<p>${run.score>best?'Новый рекорд · ':'Рекорд · '}${Math.max(best,run.score)}</p><button id="hunt-again" class="primary">Ещё раз</button></div>`,options:{closeLabel:'К мини-играм'}});
    void showModal(`<div id="hunt-result"><h2>${run.finishReason==='timer'?'Время вышло':run.finishReason==='lives'?'Жизни закончились':'На доске нет места'}</h2><div class="hunt-result-stats">${statCard(run.score,'Очки')}${statCard(run.capturedMaterial,'Взятый материал')}</div></div>`,{closeLabel:'Далее',closeVariant:'primary',next:rewardStep});
    availability();
  };
  const tick = () => {
    if(disposed)return;
    run=tickHunt(run,Date.now());hud();availability();
    if(!presenting)complete();
  };
  board.onclick=async event=>{
    if(disposed||presenting||run.phase!=='awaitingPlayer')return;
    tick();if(run.phase!=='awaitingPlayer')return;
    const square=event.target.closest('[data-square]')?.dataset.square;
    if(!square)return;
    if(run.pieces[square]?.color==='w'){selected=selected===square?null:square;draw();return;}
    if(!selected)return;
    const resolution=resolvePlayerMove(run,{from:selected,to:square},{now:Date.now(),clock:Date.now,config});
    if(resolution.state===run)return;
    run=resolution.state;selected=null;presenting=true;availability();
    try {
      for(const step of resolution.events){
        if(disposed)break;
        // A scheduled spawn has not been presented yet: expiration skips it.
        const reconciled=skipExpiredSpawn(run,step,Date.now());
        if(reconciled!==run){run=reconciled;continue;}
        const before=snapshotBoard(board);draw(step.pieces);
        if(step.captured)showCaptureMaterial(board,{...step,flags:'c'},'w');
        await animateTransition(board,step.from?[{from:step.from,to:step.to}]:[],before);
      }
    } finally {
      if(!disposed){presenting=false;run=releaseHuntInput(run,Date.now());draw();hud();complete();}
    }
  };
  board.addEventListener('keydown',event=>{
    const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];
    if(!delta)return;
    const cells=[...board.querySelectorAll('[data-square]')],index=cells.indexOf(event.target);
    if(index<0)return;event.preventDefault();cells[Math.max(0,Math.min(63,index+delta))].focus({preventScroll:true});
  });
  const modal=document.querySelector('#modal');
  const confirmExit = async event => {
    if(event.target.closest('#hunt-save')){resultShown=false;complete();return;}
    if(event.target.closest('#hunt-again')){restartMode=mode;await showModal.close();return;}
    if(!event.target.closest('[data-hunt-abandon]'))return;
    // Time continues in an exit dialog; expiration remains a completed run.
    if(run.phase==='finished'){
      complete();
      return;
    }else run=finishHunt(run,'abandoned',Date.now());
    await showModal.close();if(!disposed)onExit();
  };
  modal.addEventListener('click',confirmExit);
  const resultDismissed = () => {
    if(!disposed&&resultShown&&rewardSaved)onExit(restartMode);
  };
  modal.addEventListener('dialogdismiss',resultDismissed);
  const requestExit = () => {
    tick();
    if(run.phase==='finished'){complete();return;}
    void showModal('<h2>Выйти из охоты?</h2><p>Монеты и рекорд за незавершённую игру не сохранятся.</p><button class="danger" data-hunt-abandon>Выйти без награды</button>',{closeLabel:'Продолжить игру'});
  };
  exitButton.onclick=requestExit;
  draw();run=startHunt(run,Date.now(),config);hud();availability();
  const timer=setInterval(tick,100);
  document.addEventListener('visibilitychange',tick);window.addEventListener('pageshow',tick);
  return {requestExit,dispose:()=>{disposed=true;clearInterval(timer);exitButton.onclick=null;modal.removeEventListener('click',confirmExit);modal.removeEventListener('dialogdismiss',resultDismissed);document.removeEventListener('visibilitychange',tick);window.removeEventListener('pageshow',tick);board.getAnimations({subtree:true}).forEach(animation=>animation.cancel());root.replaceChildren();}};
};
