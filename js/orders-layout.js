/* Organização visual da tela de pedidos. Move os elementos originais com seus eventos. */
(()=>{
 'use strict';
 let queued=false;
 let currentBox=null,cachedAlert=null,cachedSummary=null,cachedTools=null;
 function organize(){
  const root=document.querySelector('.proAdmin');
  if(!root)return;
  const active=typeof adminTab!=='undefined'&&adminTab==='pedidos';
  root.classList.toggle('ca-orders-page',active);
  if(!active)return;
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
