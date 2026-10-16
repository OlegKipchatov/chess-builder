(() => {
 const key='gachachess-theme';
 const system=window.matchMedia('(prefers-color-scheme: dark)');
 const valid=value=>['system','light','dark'].includes(value);
 let preference='system';
 try {const saved=localStorage.getItem(key);if(valid(saved))preference=saved;} catch {}
 const apply=()=>{
  const theme=preference==='system'?(system.matches?'dark':'light'):preference;
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#111113':'#f4f4f5');
  const control=document.querySelector('#theme-preference');
  if(control)control.value=preference;
 };
 apply();
 system.addEventListener('change',()=>{if(preference==='system')apply();});
 window.addEventListener('storage',event=>{if(event.key===key){preference=valid(event.newValue)?event.newValue:'system';apply();}});
 document.addEventListener('DOMContentLoaded',apply);
 document.addEventListener('change',event=>{
  if(event.target.id!=='theme-preference'||!valid(event.target.value))return;
  preference=event.target.value;apply();
  try {localStorage.setItem(key,preference);} catch {}
 });
})();
