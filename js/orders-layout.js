/* Organização visual da tela de pedidos. Move os elementos originais com seus eventos. */
(()=>{
 'use strict';
 let queued=false;
 let currentBox=null,cachedAlert=null,cachedSummary=null,cachedTools=null;
 let boardControl=null,boardResize=null;
 function navigation(board){
  if(boardControl?.board===board&&boardControl.bar.isConnected){boardControl.sync();return;}
  boardResize?.disconnect();
  boardControl?.bar.remove();
  const bar=document.createElement('div');bar.className='ca-board-scroll';
  bar.setAttribute('role','group');bar.setAttribute('aria-label','Rolagem horizontal dos pedidos');
  bar.innerHTML='<div class="ca-board-scroll-label"><b>Mover entre etapas</b><small>Arraste a barra ou use as setas</small></div><button type="button" data-ca-left aria-label="Rolar pedidos para a esquerda">‹</button><input type="range" min="0" max="1000" step="1" value="0" aria-label="Posição horizontal das colunas de pedidos"><button type="button" data-ca-right aria-label="Rolar pedidos para a direita">›</button>';
  const left=bar.querySelector('[data-ca-left]'),right=bar.querySelector('[data-ca-right]'),slider=bar.querySelector('input');
  const max=()=>Math.max(0,board.scrollWidth-board.clientWidth);
  const sync=()=>{const limit=max(),offset=Math.max(0,Math.min(limit,board.scrollLeft));slider.value=limit?String(Math.round(offset/limit*1000)):'0';slider.disabled=limit<=1;left.disabled=offset<=1;right.disabled=offset>=limit-1;slider.setAttribute('aria-valuetext',Math.round(Number(slider.value)/10)+'% da rolagem horizontal');};
  const step=()=>{const column=board.querySelector('.kanbanColumn');return (column?.getBoundingClientRect().width||310)+10;};
  const move=delta=>{board.scrollLeft=Math.max(0,Math.min(max(),board.scrollLeft+delta));sync();};
  slider.addEventListener('input',()=>{board.scrollLeft=Number(slider.value)/1000*max();sync();});
  left.onclick=()=>move(-step());right.onclick=()=>move(step());
  board.addEventListener('scroll',sync,{passive:true});
  board.before(bar);boardControl={board,bar,sync};
  if(typeof ResizeObserver!=='undefined'){boardResize=new ResizeObserver(sync);boardResize.observe(board);}
  requestAnimationFrame(()=>{if(board.isConnected)sync();});
 }
 window.addEventListener('resize',()=>boardControl?.sync());
 function organize(){
  const root=document.querySelector('.proAdmin');
  if(!root)return;
  const active=typeof adminTab!=='undefined'&&adminTab==='pedidos';
  root.classList.toggle('ca-orders-page',active);
  if(!active){boardResize?.disconnect();boardControl=null;return;}
  const box=root.querySelector('#admContent');if(!box)return;
  if(currentBox!==box){currentBox=box;cachedAlert=null;cachedSummary=null;cachedTools=null;}
  cachedAlert=box.querySelector('.alertControl')||cachedAlert;
  cachedSummary=box.querySelector('.ordersSummary')||cachedSummary;
  cachedTools=box.querySelector('.ordersTools')||cachedTools;
  const toolbar=box.querySelector('.proToolbar');
  const alert=box.querySelector('.alertControl')||cachedAlert;
  if(toolbar&&alert&&!toolbar.contains(alert))toolbar.append(alert);
  const input=box.querySelector('#orderSearch');
  if(input&&!input.hasAttribute('aria-label')){input.setAttribute('aria-label','Buscar pedido por número, nome ou telefone');input.placeholder='Buscar por número, nome ou telefone';}
  const folder=box.querySelector('#caseiraoV11Settings');
  const target=folder?.querySelector('.caseiraoV11SettingsBody');
  if(cachedSummary&&!box.contains(cachedSummary))box.insertBefore(cachedSummary,folder||null);
  if(target){
   const tools=box.querySelector('.ordersTools')||cachedTools;if(tools&&!target.contains(tools))target.prepend(tools);
   const hint=box.querySelector('.operationHint');if(hint&&!target.contains(hint))target.append(hint);
   const summary=folder.querySelector(':scope > summary');
   if(summary&&!summary.dataset.caOrganized){summary.dataset.caOrganized='1';summary.innerHTML='<span>Mais opções</span><span class="caseiraoV11SettingsHint">Exportar · sincronizar · equipamentos e alertas <span aria-hidden="true">⌄</span></span>';}
  }
  const board=box.querySelector('.ordersKanban');
  if(board)navigation(board);else{boardControl?.bar.remove();boardResize?.disconnect();boardControl=null;}
  const orders=typeof shiftOrders==='function'?shiftOrders():[];
  box.querySelectorAll('[data-ofilter]').forEach(button=>{
   const key=button.dataset.ofilter;
   const count=orders.filter(o=>key==='all'||(key==='active'?!['entregue','cancelado'].includes(o.status):o.status===key)).length;
   let badge=button.querySelector('.ca-filter-count');
   if(!badge){badge=document.createElement('span');badge.className='ca-filter-count';button.append(badge);}
   if(badge.textContent!==String(count))badge.textContent=String(count);
   const selected=button.classList.contains('on');
   if(button.getAttribute('aria-pressed')!==String(selected))button.setAttribute('aria-pressed',String(selected));
  });
 }
 const previous=window.renderAdmin;
 window.renderAdmin=function(...args){const result=previous.apply(this,args);organize();return result};
 new MutationObserver(records=>{
  if(queued||!records.some(r=>r.addedNodes.length||r.removedNodes.length))return;
  queued=true;requestAnimationFrame(()=>{queued=false;organize()});
 }).observe(document.querySelector('#modalRoot')||document.body,{childList:true,subtree:true});
 organize();
})();
