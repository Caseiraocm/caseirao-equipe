
/* Calcula a altura real do cabeçalho para o banner não ficar escondido atrás dele. */
document.addEventListener('DOMContentLoaded',()=>{
  const header=document.querySelector('.top');
  if(!header)return;
  const syncHeaderHeight=()=>document.documentElement.style.setProperty('--caseirao-header-height',header.getBoundingClientRect().height+'px');
  syncHeaderHeight();
  if('ResizeObserver' in window)new ResizeObserver(syncHeaderHeight).observe(header);
  window.addEventListener('resize',syncHeaderHeight,{passive:true});
});
