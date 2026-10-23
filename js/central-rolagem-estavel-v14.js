/* Caseirão — proteção da posição de leitura durante atualizações dos pedidos. */
(()=>{
  'use strict';
  const selectors='.admWorkspaceMain,.sheet.full,.kanbanCards,.ordersKanban';
  let state=null, timeout=0, raf=0;
  const capture=()=>({page:window.scrollY, nodes:[...document.querySelectorAll(selectors)].map(el=>({el,top:el.scrollTop,left:el.scrollLeft}))});
  function restore(){
    if(!state)return;
    for(const item of state.nodes){if(item.el.isConnected){item.el.scrollTop=item.top;item.el.scrollLeft=item.left;}}
    if(Math.abs(window.scrollY-state.page)>1)window.scrollTo(0,state.page);
  }
  function schedule(){if(!state||raf)return;raf=requestAnimationFrame(()=>{raf=0;restore()});}
  function stop(){clearTimeout(timeout);state=null;}
  function hold(){state=capture();clearTimeout(timeout);schedule();timeout=setTimeout(stop,2200);}
  const statusSelector='[data-st][data-oid],[data-status-proxy],.statusApplyCorrection,.statusCancel,[data-kitchen][data-next]';
  document.addEventListener('click',event=>{
    if(event.target.closest('.sheet.full '+statusSelector.split(',').join(',.sheet.full ')))hold();
  },true);
  // Se o operador rolar deliberadamente, sua ação tem prioridade sobre a proteção.
  for(const name of ['wheel','touchmove'])document.addEventListener(name,stop,{passive:true,capture:true});
  document.addEventListener('keydown',event=>{if(['PageDown','PageUp','ArrowDown','ArrowUp','Home','End',' '].includes(event.key))stop()},true);
  const observer=new MutationObserver(records=>{
    if(state&&records.some(r=>r.addedNodes.length||r.removedNodes.length))schedule();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  // Atualizações automáticas também preservam a posição, sem interferir nos dados.
  for(const name of ['renderAdmin','renderOrders']){
    if(typeof window[name]!=='function')continue;
    const original=window[name];
    window[name]=function(...args){
      const previous=state, snap=previous||capture();
      if(!previous)state=snap;
      try{return original.apply(this,args)}finally{
        schedule();requestAnimationFrame(schedule);
        if(!previous){clearTimeout(timeout);timeout=setTimeout(stop,180)}
      }
    };
  }
  const style=document.createElement('style');
  style.textContent='.sheet.full,.admWorkspaceMain,.ordersKanban,.kanbanCards{overflow-anchor:none!important;scroll-behavior:auto!important}';
  document.head.appendChild(style);
})();
