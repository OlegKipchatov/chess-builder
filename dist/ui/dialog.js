// Serialize replacements so result/activity content never changes mid-animation.
export const createDialog = (root,content,closeButton) => {
  let returnFocus=null,returnId='',returnData=[],queue=Promise.resolve(),dismissPending=false,hideClose=false;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => window.matchMedia('(max-width: 760px)').matches;
  const enqueue = action => {queue=queue.then(action);return queue;};
  const restoreFocus = () => queueMicrotask(()=>{
    if(root.open)return;
    const visible = element => element?.isConnected&&!element.disabled&&element.getClientRects().length;
    const sameAction=[...document.querySelectorAll('button')].find(element=>returnData.length&&returnData.every(([key,value])=>element.dataset[key]===value)&&visible(element));
    const target=[returnFocus,returnId?document.getElementById(returnId):null,sameAction,document.querySelector('#start-game')].find(visible)||document.querySelector('.tab:not([hidden]) h1');
    if(target?.tagName==='H1')target.setAttribute('tabindex','-1');
    target?.focus({preventScroll:true});
  });
  const dismiss = async notify => {
    if(!root.open)return;
    root.classList.add('is-closing');
    if(mobile()&&!reducedMotion()&&root.animate){
      const animation=root.animate([{transform:'translateY(0)'},{transform:'translateY(100%)'}],{duration:220,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
      await animation.finished.catch(()=>{});
      root.close();animation.cancel();
    } else root.close();
    root.classList.remove('is-closing');
    document.body.classList.remove('dialog-open');
    if(notify){root.dispatchEvent(new Event('dialogdismiss'));restoreFocus();}
  };
  const show = (html,options={}) => enqueue(async()=>{
    if(!root.open){
      returnFocus=document.activeElement;returnId=returnFocus?.id||'';returnData=Object.entries(returnFocus?.dataset||{});
    } else await dismiss(false);
    content.innerHTML=html;
    const title=content.querySelector('h2');
    if(title){title.id='dialog-title';root.setAttribute('aria-labelledby',title.id);}
    else root.removeAttribute('aria-labelledby');
    hideClose=options.hideClose===true;
    closeButton.hidden=hideClose;
    closeButton.textContent=options.closeLabel||'Закрыть';
    closeButton.className=`ui-button ${options.closeVariant==='primary'?'primary':'quiet'}`;
    document.body.classList.add('dialog-open');
    root.showModal();root.scrollTop=0;
  });
  show.close = () => {
    if(dismissPending)return queue;
    dismissPending=true;
    return enqueue(async()=>{await dismiss(true);dismissPending=false;});
  };
  root.addEventListener('cancel',event=>{event.preventDefault();if(!hideClose)void show.close();});
  let touchStart=null;
  root.addEventListener('touchstart',event=>{
    touchStart=mobile()&&!hideClose&&root.scrollTop===0&&!event.target.closest('button,input,textarea,select,a')?event.touches[0].clientY:null;
  },{passive:true});
  root.addEventListener('touchend',event=>{
    if(touchStart!==null&&event.changedTouches[0].clientY-touchStart>70)void show.close();
    touchStart=null;
  },{passive:true});
  return show;
};
export const createToast = root => {
  let timer;
  return message => {
    root.textContent=message;
    root.hidden=false;
    clearTimeout(timer);
    timer=setTimeout(()=>{root.hidden=true;},5000);
  };
};
