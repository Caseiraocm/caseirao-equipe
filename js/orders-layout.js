/* Organização visual da tela de pedidos. Move os elementos originais com seus eventos. */
(()=>{
 'use strict';
 let queued=false;
 let currentBox=null,cachedAlert=null,cachedSummary=null,cachedTools=null,cachedTitle=null,cachedManual=null;
 let boardControl=null,boardResize=null;
 let selectedShortcut='';
 const queueStatuses=new Set(['novo','confirmado','preparando']);
 const warningMinutes=30;
 const lateMinutes=35;

 function summarizeOrders(orders,now=Date.now()){
  const queue=orders.filter(order=>queueStatuses.has(order.status));
  const timed=queue
   .map(order=>({order,created:Date.parse(order.created_at)}))
   .filter(item=>Number.isFinite(item.created))
   .sort((a,b)=>a.created-b.created);
  const age=item=>Math.max(0,Math.floor((now-item.created)/60000));
  const late=timed.filter(item=>age(item)>=lateMinutes);
  const near=timed.filter(item=>age(item)>=warningMinutes&&age(item)<lateMinutes);
  const oldest=timed[0];
  return {
   queue,
   oldest:oldest?{order:oldest.order,minutes:age(oldest)}:null,
   alerts:[...late,...near].map(item=>item.order),
   late:late.length,
   near:near.length,
   pickup:orders.filter(order=>order.type==='pickup'&&order.status==='pronto'),
   route:orders.filter(order=>order.status==='em_rota')
  };
 }

 function refreshShortcuts(box,strip,orders){
  const summary=summarizeOrders(orders);
  if(!strip.classList.contains('ca-order-shortcuts')){
   strip.className='ordersSummary ca-order-shortcuts';
   strip.setAttribute('role','group');
   strip.setAttribute('aria-label','Atalhos dos pedidos');
   strip.innerHTML=[
    ['queue','Na fila','≡'],['oldest','Mais antigo','◷'],['alerts','Atenção','!'],
    ['pickup','Prontos pra retirar','✓'],['route','Em rota','➜']
   ].map(([key,label,icon])=>`<button type="button" data-order-shortcut="${key}"><i aria-hidden="true">${icon}</i><span><span class="ca-shortcut-label">${label}</span><strong class="ca-shortcut-value"></strong><small class="ca-shortcut-detail"></small></span></button>`).join('');
  }
  const values={
   queue:[summary.queue.length,''],
   oldest:summary.oldest?[`${summary.oldest.minutes} min`,`#${summary.oldest.order.order_number}`]:['—','Sem pedidos na fila'],
   alerts:summary.late
    ? [`${summary.late} ${summary.late===1?'atrasado':'atrasados'}`,summary.near?`+${summary.near} perto do limite`:'35 min ou mais']
    : [summary.near,summary.near?'Perto do limite':'Fila em dia'],
   pickup:[summary.pickup.length,''],
   route:[summary.route.length,'']
  };
  strip.dataset.alertTone=summary.late?'late':summary.near?'near':'normal';
  strip.querySelectorAll('[data-order-shortcut]').forEach(button=>{
   const key=button.dataset.orderShortcut;
   const [value,detail]=values[key];
   const valueNode=button.querySelector('.ca-shortcut-value');
   const detailNode=button.querySelector('.ca-shortcut-detail');
   if(valueNode.textContent!==String(value))valueNode.textContent=String(value);
   if(detailNode.textContent!==detail)detailNode.textContent=detail;
   button.disabled=key==='oldest'&&!summary.oldest;
   if(key!=='oldest')button.setAttribute('aria-pressed',String(selectedShortcut===key));
  });
  applyShortcut(box,summary);
 }

 function applyShortcut(box,summary){
  const selectedOrders=new Set((summary[selectedShortcut]||[]).map(order=>String(order.id)));
  const cards=[...box.querySelectorAll('details.orderDetailed')];
  cards.forEach(card=>{
   const id=card.dataset.orderId||card.querySelector('[data-oid]')?.dataset.oid;
   card.classList.toggle('ca-shortcut-hidden',Boolean(selectedShortcut)&&!selectedOrders.has(id));
  });
  box.querySelectorAll('.kanbanColumn').forEach(column=>{
   const count=column.querySelectorAll('.orderDetailed:not(.hide,.ca-shortcut-hidden)').length;
   const badge=column.querySelector('.kanbanCount');
   if(badge&&badge.textContent!==String(count))badge.textContent=String(count);
   column.classList.toggle('isEmpty',count===0);
  });
  let filter=box.querySelector('.ca-shortcut-filter');
  if(!selectedShortcut){
   filter?.remove();
   return;
  }
  if(!filter){
   filter=document.createElement('div');
   filter.className='ca-shortcut-filter';
   filter.tabIndex=-1;
   filter.innerHTML='<span></span><button type="button">Limpar filtro</button>';
   filter.querySelector('button').onclick=()=>{
    selectedShortcut='';
    organize();
    box.querySelector('.proFilters button.on')?.focus({preventScroll:true});
   };
   box.querySelector('.proFilters')?.after(filter);
  }
  const labels={queue:'Na fila',alerts:'Pedidos perto do limite ou atrasados',pickup:'Prontos pra retirar',route:'Em rota'};
  const count=cards.filter(card=>!card.matches('.hide,.ca-shortcut-hidden')).length;
  const label=`${labels[selectedShortcut]} · ${count===1?'1 pedido':count+' pedidos'}`;
  if(filter.firstElementChild.textContent!==label)filter.firstElementChild.textContent=label;
 }

 function openShortcut(button){
  const box=button.closest('#admContent');
  const key=button.dataset.orderShortcut;
  const summary=summarizeOrders(shiftOrders());
  const targetId=key==='oldest'?summary.oldest?.order.id:null;
  if(key==='oldest'&&targetId==null)return;
  const next=key==='oldest'||selectedShortcut===key?'':key;
  const active=box.querySelector('[data-ofilter="active"]:not(.on)');
  active?.click();
  selectedShortcut=next;
  const input=box.querySelector('#orderSearch');
  if(input?.value){
   input.value='';
   input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  requestAnimationFrame(()=>{
   if(!box.isConnected)return;
   organize();
   const card=[...box.querySelectorAll('details.orderDetailed:not(.hide,.ca-shortcut-hidden)')].find(item=>
    targetId==null||item.querySelector('[data-oid]')?.dataset.oid===String(targetId));
   if(targetId!=null&&card){
    card.open=true;
    card.querySelector('summary')?.focus({preventScroll:true});
    card.scrollIntoView({block:'center',inline:'nearest'});
   }else if(selectedShortcut){
    const filter=box.querySelector('.ca-shortcut-filter');
    filter?.focus({preventScroll:true});
    // Bring the matching column into view on the horizontally scrolling board.
    const board=card?.closest('.ordersKanban');
    if(board)board.scrollLeft+=card.getBoundingClientRect().left-board.getBoundingClientRect().left;
    filter?.scrollIntoView({block:'start',inline:'nearest'});
   }
  });
 }

 function navigation(board){
  if(boardControl?.board===board&&boardControl.bar.isConnected){boardControl.sync();return;}
  boardResize?.disconnect();
  boardControl?.bar.remove();
  const bar=document.createElement('div');bar.className='ca-board-scroll';
  bar.setAttribute('role','group');bar.setAttribute('aria-label','Rolagem horizontal dos pedidos');
  bar.innerHTML='<div class="ca-board-scroll-label"><b>Mover entre etapas</b><small>Arraste a barra ou use as setas</small></div><button type="button" data-ca-left aria-label="Rolar pedidos para a esquerda">‹</button><input type="range" min="0" max="1000" step="1" value="0" aria-label="Posição horizontal das colunas de pedidos"><button type="button" data-ca-right aria-label="Rolar pedidos para a direita">›</button>';
  const left=bar.querySelector('[data-ca-left]'),right=bar.querySelector('[data-ca-right]'),slider=bar.querySelector('input');
  const max=()=>Math.max(0,board.scrollWidth-board.clientWidth);
  const sync=()=>{const limit=max(),offset=Math.max(0,Math.min(limit,board.scrollLeft));bar.hidden=limit<=1;slider.value=limit?String(Math.round(offset/limit*1000)):'0';slider.disabled=limit<=1;left.disabled=offset<=1;right.disabled=offset>=limit-1;slider.setAttribute('aria-valuetext',Math.round(Number(slider.value)/10)+'% da rolagem horizontal');};
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
  if(currentBox!==box){currentBox=box;cachedAlert=null;cachedSummary=null;cachedTools=null;cachedTitle=null;cachedManual=null;selectedShortcut='';}
  cachedAlert=box.querySelector('.alertControl')||cachedAlert;
  cachedSummary=box.querySelector('.ordersSummary')||cachedSummary;
  cachedTools=box.querySelector('.ordersTools')||cachedTools;
  const toolbar=box.querySelector('.proToolbar');
  const alert=box.querySelector('.alertControl')||cachedAlert;
  if(toolbar&&alert&&!toolbar.contains(alert))toolbar.append(alert);
  const heading=root.querySelector('.proPageTitle');
  const title=heading?.querySelector('h1')||cachedTitle;
  const manual=root.querySelector('#proManualOrder')||cachedManual;
  cachedTitle=title;cachedManual=manual;
  if(toolbar&&title&&title.parentElement!==toolbar)toolbar.prepend(title);
  if(toolbar&&manual&&manual.parentElement!==toolbar)toolbar.append(manual);
  if(heading)heading.hidden=Boolean(toolbar);
  const input=box.querySelector('#orderSearch');
  if(input&&!input.hasAttribute('aria-label')){input.setAttribute('aria-label','Buscar pedido por número, nome ou telefone');input.placeholder='Buscar por número, nome ou telefone';}
  const folder=box.querySelector('#caseiraoV11Settings');
  const target=folder?.querySelector('.caseiraoV11SettingsBody');
  if(cachedSummary&&!box.contains(cachedSummary))box.insertBefore(cachedSummary,folder||null);
  if(target){
   if(cachedSummary&&!target.contains(cachedSummary))target.prepend(cachedSummary);
   const tools=box.querySelector('.ordersTools')||cachedTools;if(tools&&!target.contains(tools))target.prepend(tools);
   const hint=box.querySelector('.operationHint');if(hint&&!target.contains(hint))target.append(hint);
   const summary=folder.querySelector(':scope > summary');
   if(summary&&!summary.dataset.caOrganized){summary.dataset.caOrganized='1';summary.innerHTML='<span>Mais opções</span><span class="caseiraoV11SettingsHint">Exportar · sincronizar · equipamentos e alertas <span aria-hidden="true">⌄</span></span>';}
  }
  const board=box.querySelector('.ordersKanban');
  if(board)navigation(board);else{boardControl?.bar.remove();boardResize?.disconnect();boardControl=null;}
  const orders=typeof shiftOrders==='function'?shiftOrders():[];
  if(cachedSummary)refreshShortcuts(box,cachedSummary,orders);
  box.querySelectorAll('[data-ofilter]').forEach(button=>{
   const key=button.dataset.ofilter;
   const count=orders.filter(order=>orderMatchesBoardFilter(order,key)).length;
   let badge=button.querySelector('.ca-filter-count');
   if(!badge){badge=document.createElement('span');badge.className='ca-filter-count';button.append(badge);}
   if(badge.textContent!==String(count))badge.textContent=String(count);
   const selected=button.classList.contains('on');
   if(button.getAttribute('aria-pressed')!==String(selected))button.setAttribute('aria-pressed',String(selected));
  });
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('.ca-orders-page #admContent button');
  if(button?.hasAttribute('data-order-shortcut'))openShortcut(button);
  else if(button?.hasAttribute('data-ofilter')){
   selectedShortcut='';
   requestAnimationFrame(organize);
  }
 },true);
 window.addEventListener('input',event=>{
  if(event.target.id==='orderSearch')requestAnimationFrame(organize);
 },true);
 setInterval(()=>{
  if(!document.hidden&&currentBox?.isConnected&&adminTab==='pedidos'&&cachedSummary?.isConnected){
   refreshShortcuts(currentBox,cachedSummary,shiftOrders());
  }
 },10000);
 const previous=window.renderAdmin;
 window.renderAdmin=function(...args){const result=previous.apply(this,args);organize();return result};
 new MutationObserver(records=>{
  if(queued||!records.some(r=>r.addedNodes.length||r.removedNodes.length))return;
  queued=true;requestAnimationFrame(()=>{queued=false;organize()});
 }).observe(document.querySelector('#modalRoot')||document.body,{childList:true,subtree:true});
 organize();
})();
