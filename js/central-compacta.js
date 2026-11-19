/* Central compacta v2.4 — preserva os recursos e reduz a rolagem operacional. */
(()=>{
  'use strict';
  let lastAction={id:'',at:0};

  const boardColumns=[
    {key:'received',title:'Recebidos',hint:'Novos pedidos',statuses:['novo','confirmado']},
    {key:'preparing',title:'Em preparo',hint:'Na cozinha',statuses:['preparando']},
    {key:'ready',title:'Prontos',hint:'Aguardando saída',statuses:['pronto']},
    {key:'delivery',title:'Em rota',statuses:['em_rota']}
  ];

  const historyColumn={key:'finished',title:'Finalizados',statuses:['entregue','cancelado']};
  const pendingUpdates=new Set();
  const stageStarts=new Map();

  function orderId(card){
    return card.dataset.orderId || String(card.querySelector('[data-oid]')?.dataset.oid||'');
  }

  function orderForCard(card){
    const orders=typeof admin!=='undefined' ? admin?.orders : null;
    return orders?.find(order=>String(order.id)===orderId(card));
  }

  function stageTiming(order,now){
    const status=order.status;
    if(status==='novo'||status==='confirmado'){
      return {start:Date.parse(order.created_at),label:'aguardando'};
    }
    const labels={preparando:'em preparo',pronto:'aguardando saída',em_rota:'em rota'};
    if(!labels[status])return null;
    const entries=Array.isArray(order.order_status_history)?order.order_status_history:[];
    const since=entries.reduce((latest,entry)=>{
      if(entry.status!==status)return latest;
      const time=Date.parse(entry.created_at||entry.changed_at);
      return time<=now&&time>latest?time:latest;
    },0);
    const observed=stageStarts.get(String(order.id));
    const change=observed?.status===status?observed.time:0;
    const start=Math.max(since,change);
    return start
      ? {start,label:status==='pronto'&&operationalOrderType(order)==='pickup'?'aguardando retirada':labels[status]}
      : {start:Date.parse(order.created_at),label:'desde o pedido'};
  }

  function updateStageTimer(timer,order,now){
    const timing=stageTiming(order,now);
    const label=Number.isFinite(timing?.start)
      ? Math.max(0,Math.floor((now-timing.start)/60000))+' min '+timing.label
      : '';
    if(timer.textContent!==label)timer.textContent=label;
  }

  function syncCardSummary(card,order){
    const summary=card.querySelector(':scope > .orderSummary');
    const customer=summary?.querySelector('.summaryCustomer');
    if(!customer||!order)return;
    let meta=customer.querySelector('.centralOrderMeta');
    if(!meta){
      meta=document.createElement('div');
      meta.className='centralOrderMeta';
      meta.innerHTML='<span class="centralOrderType"></span><span class="centralStageTime"></span>';
      customer.append(meta);
    }
    const type=operationalOrderTypeLabel(order);
    if(meta.firstElementChild.textContent!==type)meta.firstElementChild.textContent=type;
    updateStageTimer(meta.lastElementChild,order,Date.now());

    const status=order.status;
    const canPay=orderPaymentConfirmed(order);
    const progress={
      novo:['confirmado','Aceitar pedido'],
      confirmado:['preparando','Iniciar preparo'],
      preparando:['pronto','Marcar pronto'],
      pronto:order.type==='delivery'?['em_rota','Enviar para entrega']:['entregue',operationalOrderType(order)==='pickup'?'Finalizar retirada':'Finalizar pedido'],
      em_rota:['entregue','Finalizar entrega']
    };
    const next=canPay && progress[status];
    let action=summary.querySelector(':scope > .centralOrderNext');
    if(!next)action?.remove();
    else {
      if(!action){
        action=document.createElement('button');
        action.type='button';
        action.className='centralOrderNext';
        const quick=summary.querySelector(':scope > .premiumQuick');
        if(quick)quick.before(action);
        else summary.append(action);
        action.onclick=event=>{
          event.preventDefault();
          event.stopPropagation();
          updateStatusInPlace(card,action.dataset.next,action);
        };
      }
      action.dataset.next=next[0];
      action.disabled=pendingUpdates.has(orderId(card));
      if(action.textContent!==next[1])action.textContent=next[1];
    }
    const printer=summary.querySelector('.premiumPrint');
    if(printer){
      if(printer.textContent!=='Imprimir')printer.textContent='Imprimir';
      if(!canPay)printer.disabled=true;
    }
    card.classList.toggle('centralPaymentPending',!canPay);
  }

  const deliveryRouteMarkup = `
    <div class="centralDeliveryRoute" aria-hidden="true">
      <div class="centralDeliveryRouteTrack">
        <svg class="centralDeliveryRouteStop" viewBox="0 0 32 32" fill="none" focusable="false">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#dceffd"/>
          <path d="M8 15v10h16V15M17 25v-6h4v6M11 19h3v3h-3z" stroke="#215980" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M7 15l2-6h14l2 6z" fill="#2e7db8" stroke="#215980" stroke-width="1.2" stroke-linejoin="round"/>
          <path d="M13 10l-1 4m7-4 1 4" stroke="#dceffd" stroke-width="1.5"/>
        </svg>
        <div class="centralDeliveryRouteLane">
          <div class="centralDeliveryRouteProgress"></div>
          <div class="centralDeliveryRouteMotion">
            <svg class="centralDeliveryRouteBike" viewBox="0 0 44 26" fill="none" focusable="false">
              <path d="M2 13h5m-7 4h4" stroke="#67a2c8" stroke-width="1.4" stroke-linecap="round"/>
              <g stroke="#194e76" stroke-width="1.8" fill="#f3f9ff">
                <circle cx="12" cy="19" r="4.5"/>
                <circle cx="35" cy="19" r="4.5"/>
              </g>
              <g fill="#194e76">
                <circle cx="12" cy="19" r="1.3"/>
                <circle cx="35" cy="19" r="1.3"/>
              </g>
              <path d="M8 13h11l4 5h4l4-9 5 2-5 9H20l-4-3H8z" fill="#2e7db8" stroke="#194e76" stroke-width="1.4" stroke-linejoin="round"/>
              <path d="M14 11h8m8-5h3l2 4" stroke="#194e76" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="6" y="5" width="8" height="7" rx="1.5" fill="#2e7db8" stroke="#194e76" stroke-width="1.2"/>
              <circle cx="35" cy="11" r="1.4" fill="#f0b940"/>
            </svg>
          </div>
        </div>
        <svg class="centralDeliveryRouteStop" viewBox="0 0 32 32" fill="none" focusable="false">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#dceffd"/>
          <path d="M9 15v10h14V15M14 25v-7h4v7" fill="#fff" stroke="#215980" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M6 16l10-8 10 8z" fill="#215980" stroke="#215980" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="centralDeliveryRouteLabels"><span>Caseirão</span><span>Casa do cliente</span></div>
    </div>`;

  function syncDeliveryRoute(card,status){
    const summary=card.querySelector(':scope > .orderSummary');
    if(!summary)return;
    const route=summary.querySelector(':scope > .centralDeliveryRoute');
    const order=status==='em_rota' && orderForCard(card);
    if(order?.type!=='delivery'){
      route?.remove();
      return;
    }
    if(route)return;
    const quick=summary.querySelector(':scope > .centralOrderNext, :scope > .premiumQuick');
    if(quick)quick.insertAdjacentHTML('beforebegin',deliveryRouteMarkup);
    else summary.insertAdjacentHTML('beforeend',deliveryRouteMarkup);
  }

  function compactCard(card){
    const body=card.querySelector(':scope > .orderBody');
    if(!body)return;
    const keep=new Set(['orderInfoGrid','orderItemsBox','orderTotalsBox','pixPendingWarning','smartOrderFlow','orderactions','statusFloatDock']);
    let more=body.querySelector(':scope > .centralMore');
    let content=more?.querySelector(':scope > .centralMoreBody');
    const movable=[...body.children].filter(node=>{
      if(node===more||node.matches('script,style'))return false;
      return ![...keep].some(name=>node.classList?.contains(name));
    });

    if(movable.length){
      if(!more){
        more=document.createElement('details');
        more.className='centralMore';
        const summary=document.createElement('summary');
        summary.textContent='MAIS INFORMAÇÕES E AÇÕES';
        content=document.createElement('div');
        content.className='centralMoreBody';
        more.append(summary,content);
        body.appendChild(more);
      }
      movable.forEach(node=>content.appendChild(node));
    }
    card.dataset.compactReady='1';
    installStatusDock(card);
  }

  const statusMeta={
    novo:{label:'Recebido',icon:'●'},
    confirmado:{label:'Confirmado',icon:'✓'},
    preparando:{label:'Em preparo',icon:'♨'},
    pronto:{label:'Pronto',icon:'✓'},
    em_rota:{label:'Em rota',icon:'➜'},
    entregue:{label:'Entregue',icon:'✓'},
    cancelado:{label:'Cancelado',icon:'×'}
  };
  const flow=['novo','confirmado','preparando','pronto','em_rota','entregue'];

  function statusButton(card,status){
    return [...card.querySelectorAll('.orderactions [data-st]')].find(button=>button.dataset.st===status);
  }

  function installStatusDock(card){
    const body=card.querySelector(':scope > .orderBody');
    const original=body?.querySelector(':scope > .orderactions');
    if(!body||!original||body.querySelector(':scope > .statusFloatDock'))return;
    const id=orderId(card),order=(typeof admin!=='undefined'&&admin?.orders||[]).find(item=>String(item.id)===id);
    const selected=original.querySelector('[data-st].selected');
    const current=String(order?.status||selected?.dataset.st||'novo');
    const isDelivery=String(order?.type||'')==='delivery';
    const operationalFlow=isDelivery?flow:flow.filter(status=>status!=='em_rota');
    const index=operationalFlow.indexOf(current);
    const next=index>=0?operationalFlow[index+1]:null;
    const dock=document.createElement('section');
    dock.className=`statusFloatDock tone-${current}`;
    dock.setAttribute('aria-label','Controle rápido do status do pedido');
    const nextCopy={confirmado:'ACEITAR PEDIDO',preparando:'INICIAR PREPARO',pronto:'MARCAR COMO PRONTO',em_rota:'ENVIAR PARA ENTREGA',entregue:isDelivery?'FINALIZAR ENTREGA':'FINALIZAR PEDIDO'};
    dock.innerHTML=`<div class="statusDockTop"><div class="statusNow"><small>STATUS ATUAL</small><b><i>${statusMeta[current]?.icon||'●'}</i>${statusMeta[current]?.label||current}</b></div><button type="button" class="statusDockMenu" aria-expanded="false" aria-label="Outras ações">•••</button></div><div class="statusProgress">${operationalFlow.map((status,i)=>`<span class="${i<index?'done':i===index?'current':''}" title="${statusMeta[status].label}"><i>${statusMeta[status].icon}</i><small>${statusMeta[status].label}</small></span>`).join('')}</div>${next?`<button type="button" class="statusNext" data-status-proxy="${next}"><span>PRÓXIMA AÇÃO</span><b>${statusMeta[next].icon} ${nextCopy[next]||statusMeta[next].label.toUpperCase()}</b></button>`:`<div class="statusCompleted">✓ PEDIDO FINALIZADO</div>`}<div class="statusDockOptions" hidden><b>OUTRAS AÇÕES</b><label class="statusCorrection"><span>Corrigir etapa do pedido</span><select>${operationalFlow.filter(status=>status!==current).map(status=>`<option value="${status}">${statusMeta[status].label}</option>`).join('')}</select></label><button type="button" class="statusApplyCorrection">APLICAR CORREÇÃO</button>${current!=='cancelado'&&current!=='entregue'?'<button type="button" class="statusCancel">× CANCELAR PEDIDO</button>':''}</div>`;
    original.hidden=true;
    body.appendChild(dock);
    dock.querySelector('.statusDockMenu').onclick=event=>{
      event.stopPropagation();
      const options=dock.querySelector('.statusDockOptions'),open=options.hidden;
      options.hidden=!open;event.currentTarget.setAttribute('aria-expanded',String(open));
      event.currentTarget.textContent=open?'×':'•••';
    };
    dock.querySelectorAll('[data-status-proxy]').forEach(button=>button.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      updateStatusInPlace(card,button.dataset.statusProxy,button);
    });
    dock.querySelector('.statusApplyCorrection')?.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      const value=dock.querySelector('.statusCorrection select')?.value;
      if(value&&confirm(`Corrigir este pedido para “${statusMeta[value]?.label||value}”?`))updateStatusInPlace(card,value,event.currentTarget);
    });
    dock.querySelector('.statusCancel')?.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      updateStatusInPlace(card,'cancelado',event.currentTarget);
    });
  }

  async function updateStatusInPlace(card,next,trigger){
    const id=orderId(card),target=statusButton(card,next);
    const currentOrder=orderForCard(card);
    if(!currentOrder||pendingUpdates.has(id)||next===currentOrder.status)return;
    if(next!=='confirmado'&&(!target||target.disabled))return;
    if(next!=='cancelado'&&!orderPaymentConfirmed(currentOrder))return;
    if(next==='pronto'&&currentOrder.type==='delivery')next='em_rota';
    if(next==='entregue'&&!confirm(completionConfirmText(id)))return;
    let reason='';
    if(next==='cancelado'){
      reason=String(prompt('Informe o motivo do cancelamento:')||'').trim();
      if(!reason)return;
    }
    const before=currentOrder.status;
    const dock=card.querySelector(':scope > .orderBody > .statusFloatDock');
    const scrollHost=document.querySelector('.admWorkspaceMain')||document.querySelector('.sheet.full');
    const scrollTop=scrollHost?.scrollTop||0;
    pendingUpdates.add(id);
    try{
      trigger.disabled=true;
      dock?.classList.add('updating');
      await adminCall('update_status',{order_id:id,status:next,reason});
      const time=Date.now(),order=orderForCard(card);
      stageStarts.set(id,{status:next,time});
      if(order){order.status=next;order.cancel_reason=next==='cancelado'?reason:null;order.updated_at=new Date(time).toISOString()}
      if(typeof knownOrderStatuses!=='undefined')knownOrderStatuses.set(id,next);
      if((next==='pronto'||next==='em_rota')&&before==='preparando')savePreparationStop(id,time);
      if(['entregue','cancelado'].includes(next))deliveryApi('admin_stop',{order_id:id},true).catch(()=>{});
      card.querySelectorAll('.orderactions [data-st]').forEach(button=>{
        const active=button.dataset.st===next;
        button.classList.toggle('selected',active);
        button.setAttribute('aria-pressed',String(active));
      });
      const badge=card.querySelector('.orderSummary .statusBadge');
      if(badge){badge.className=`statusBadge ${statusTone(next)}`;badge.textContent=statusMeta[next]?.label||next}
      dock?.remove();installStatusDock(card);card.open=false;
      if(card.isConnected)moveCardToColumn(card,next);
      else if(adminTab==='pedidos'){
        const box=document.querySelector('#admContent');
        if(box)renderOrders(box);
      }
      card.classList.add('recentlyUpdated');
      setTimeout(()=>card.classList.remove('recentlyUpdated'),3500);
      if(scrollHost)scrollHost.scrollTop=scrollTop;
      if(typeof showAppToast==='function')showAppToast(`Pedido atualizado: ${statusMeta[next]?.label||next}.`,'ok');
    }catch(error){
      dock?.classList.remove('updating');
      alert(error?.message||String(error));
    }finally{
      pendingUpdates.delete(id);
      trigger.disabled=false;
      syncCardSummary(card,orderForCard(card));
    }
  }

  function foldPrinter(root){
    const panel=root.querySelector('#caseiraoPrinterPanel');
    if(!panel||panel.closest('.centralPrinterFold'))return;
    const fold=document.createElement('details');
    fold.className='centralPrinterFold';
    const summary=document.createElement('summary');
    summary.textContent='🖨️ IMPRESSORA E CONFIGURAÇÕES';
    panel.before(fold);fold.append(summary,panel);
  }

  function cardStatus(card){
    const order=orderForCard(card);
    if(order?.status)return String(order.status);
    return [...card.querySelectorAll('.orderactions [data-st]')].find(button=>button.classList.contains('selected'))?.dataset.st||'novo';
  }

  function updateBoardCounts(board){
    board.querySelectorAll('.kanbanColumn').forEach(column=>{
      const cards=[...column.querySelectorAll(':scope > .kanbanCards > .orderDetailed')].filter(card=>!card.matches('.hide,.ca-shortcut-hidden'));
      const count=column.querySelector('.kanbanCount');
      if(count&&count.textContent!==String(cards.length))count.textContent=String(cards.length);
      column.classList.toggle('isEmpty',cards.length===0);
    });
  }

  function moveCardToColumn(card,status){
    const board=card.closest('.ordersKanban');
    if(!board)return;
    const content=board.closest('#admContent');
    const filter=content?.dataset.orderFilter||'active';
    if(!orderMatchesBoardFilter({status},filter)){
      card.remove();
    }else{
      const definition=boardColumns.find(column=>column.statuses.includes(status))||boardColumns[0];
      board.querySelector(`[data-kanban="${definition.key}"] .kanbanCards`)?.appendChild(card);
      card.dataset.kanbanStatus=status;
      card.dataset.premiumTone={novo:'received',confirmado:'received',preparando:'preparing',pronto:'ready',em_rota:'route'}[status]||'received';
      syncDeliveryRoute(card,status);
      syncCardSummary(card,orderForCard(card));
    }
    updateBoardCounts(board);
  }

  function organizeKanban(content){
    const filters=content.querySelector(':scope > .proFilters');
    if(!filters)return;
    const history=content.dataset.orderFilter==='finished';
    const cards=[...content.querySelectorAll(':scope > details.orderDetailed')];
    let board=content.querySelector(':scope > .ordersKanban');
    if(!board&&!history){
      content.querySelector(':scope > .cleanEmpty')?.remove();
    }
    if(!board){
      if(history&&!cards.length)return;
      board=document.createElement('section');
      board.className='ordersKanban'+(history?' centralOrderHistory':'');
      board.setAttribute('aria-label',history?'Pedidos finalizados do expediente':'Fluxo dos pedidos');
      board.innerHTML=(history?[historyColumn]:boardColumns).map(column=>`
        <section class="kanbanColumn kanban-${column.key}" data-kanban="${column.key}">
          <header><b>${column.title}</b><span class="kanbanCount">0</span></header>
          <div class="kanbanCards"></div>
        </section>`).join('');
      filters.after(board);
    }
    cards.forEach(card=>{
      const status=cardStatus(card);
      const definition=history?historyColumn:boardColumns.find(column=>column.statuses.includes(status))||boardColumns[0];
      board.querySelector(`[data-kanban="${definition.key}"] .kanbanCards`)?.appendChild(card);
      card.dataset.kanbanStatus=status;
    });
    board.querySelectorAll('details.orderDetailed').forEach(card=>{
      syncDeliveryRoute(card,cardStatus(card));
      syncCardSummary(card,orderForCard(card));
    });
    updateBoardCounts(board);
  }

  function enhance(root=document){
    const content=root.matches?.('#admContent')?root:root.querySelector?.('#admContent');
    if(!content||typeof adminTab!=='undefined'&&adminTab!=='pedidos')return;
    content.querySelectorAll('details.orderDetailed').forEach(compactCard);
    organizeKanban(content);
    foldPrinter(content);

    if(lastAction.id&&Date.now()-lastAction.at<9000){
      const card=[...content.querySelectorAll('details.orderDetailed')].find(item=>orderId(item)===lastAction.id);
      if(card){
        card.open=false;
        card.classList.add('recentlyUpdated');
        setTimeout(()=>card.classList.remove('recentlyUpdated'),7000);
        lastAction={id:'',at:0};
      }
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-st][data-oid]');
    if(!button)return;
    lastAction={id:String(button.dataset.oid||''),at:Date.now()};
  },true);

  window.addEventListener('input',event=>{
    if(event.target?.id!=='orderSearch')return;
    requestAnimationFrame(()=>{
      const board=event.target.closest('#admContent')?.querySelector('.ordersKanban');
      if(board)updateBoardCounts(board);
    });
  },true);

  const observer=new MutationObserver(records=>{
    if(records.some(record=>record.addedNodes.length))requestAnimationFrame(()=>enhance(document));
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>{
    if(document.hidden)return;
    const now=Date.now();
    document.querySelectorAll('.ordersKanban .centralStageTime').forEach(timer=>{
      const order=orderForCard(timer.closest('.orderDetailed'));
      if(order)updateStageTimer(timer,order,now);
    });
  },10000);
  enhance(document);
})();
