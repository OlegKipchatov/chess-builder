// The controller owns result/activity sequencing; this module only manages the dialog UI.
export const createDialog = (root,content,closeButton) => {
  let returnFocus=null,returnId='',returnData=[];
  root.addEventListener('close',()=>{
    queueMicrotask(()=>{
      if(root.open)return;
      const visible = element => element?.isConnected&&!element.disabled&&element.getClientRects().length;
      const sameAction=[...document.querySelectorAll('button')].find(element=>returnData.length&&returnData.every(([key,value])=>element.dataset[key]===value)&&visible(element));
      const candidates=[returnFocus,returnId?document.getElementById(returnId):null,sameAction,document.querySelector('#start-game')];
      const target=candidates.find(visible)||document.querySelector('.tab:not([hidden]) h1');
      if(target?.tagName==='H1')target.setAttribute('tabindex','-1');
      target?.focus({preventScroll:true});
    });
  });
  return (html,{closeLabel='Закрыть',closeVariant='secondary',hideClose=false}={}) => {
    if(!root.open){
      returnFocus=document.activeElement;
      returnId=returnFocus?.id||'';
      returnData=Object.entries(returnFocus?.dataset||{});
    }
    content.innerHTML=html;
    const title=content.querySelector('h2');
    if(title){title.id='dialog-title';root.setAttribute('aria-labelledby',title.id);}
    else root.removeAttribute('aria-labelledby');
    closeButton.hidden=hideClose;
    closeButton.textContent=closeLabel;
    closeButton.className=`ui-button ${closeVariant==='primary'?'primary':'quiet'}`;
    if(!root.open)root.showModal();
  };
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
