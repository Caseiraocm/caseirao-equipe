/* Central compacta v2.4 — preserva os recursos e reduz a rolagem operacional. */
(()=>{
  'use strict';
  let lastAction={id:'',at:0};

  const boardColumns=[
    {key:'received',title:'Recebidos',hint:'Novos pedidos',statuses:['novo','confirmado']},
    {key:'preparing',title:'Em preparo',hint:'Na cozinha',statuses:['preparando']},
    {key:'ready',title:'Prontos',hint:'Aguardando saída',statuses:['pronto']},
    {key:'delivery',title:'Entrega / final',hint:'Rota e concluídos',statuses:['em_rota','entregue','cancelado']}
  ];

  function orderId(card){
    return String(card.querySelector('[data-oid]')?.dataset.oid||'');
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
    if(!id||!target||target.disabled)return;
    let reason='';
    if(next==='cancelado'){
      reason=String(prompt('Informe o motivo do cancelamento:')||'').trim();
      if(!reason)return;
    }
    const dock=card.querySelector(':scope > .orderBody > .statusFloatDock');
    const scrollHost=document.querySelector('.admWorkspaceMain')||document.querySelector('.sheet.full');
    const scrollTop=scrollHost?.scrollTop||0;
    try{
      trigger.disabled=true;dock?.classList.add('updating');
      await adminCall('update_status',{order_id:id,status:next,reason});
      if(['entregue','cancelado'].includes(next))await deliveryApi('admin_stop',{order_id:id},true).catch(()=>{});
      const order=(typeof admin!=='undefined'&&admin?.orders||[]).find(item=>String(item.id)===id);
      if(order){order.status=next;order.cancel_reason=next==='cancelado'?reason:null;order.updated_at=new Date().toISOString()}
      if(typeof knownOrderStatuses!=='undefined')knownOrderStatuses.set(id,next);
      target.closest('.orderactions')?.querySelectorAll('[data-st]').forEach(button=>{
        const active=button.dataset.st===next;
        button.classList.toggle('selected',active);
        button.setAttribute('aria-pressed',String(active));
      });
      const badge=card.querySelector('.orderSummary .statusBadge');
      if(badge){badge.className=`statusBadge ${statusTone(next)}`;badge.textContent=statusMeta[next]?.label||next}
      dock?.remove();installStatusDock(card);card.open=true;
      moveCardToColumn(card,next);
      card.classList.add('recentlyUpdated');
      setTimeout(()=>card.classList.remove('recentlyUpdated'),3500);
      if(scrollHost)scrollHost.scrollTop=scrollTop;
      if(typeof showAppToast==='function')showAppToast(`Pedido atualizado: ${statusMeta[next]?.label||next}.`,'ok');
    }catch(error){
      trigger.disabled=false;dock?.classList.remove('updating');
      alert(error?.message||String(error));
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
    const id=orderId(card);
    const order=(typeof admin!=='undefined'&&admin?.orders||[]).find(item=>String(item.id)===id);
    if(order?.status)return String(order.status);
    return [...card.querySelectorAll('.orderactions [data-st]')].find(button=>button.classList.contains('selected'))?.dataset.st||'novo';
  }

  function updateBoardCounts(board){
    board.querySelectorAll('.kanbanColumn').forEach(column=>{
      const cards=[...column.querySelectorAll(':scope > .kanbanCards > .orderDetailed')].filter(card=>!card.classList.contains('hide'));
      const count=column.querySelector('.kanbanCount');
      if(count)count.textContent=String(cards.length);
      column.classList.toggle('isEmpty',cards.length===0);
    });
  }

  function moveCardToColumn(card,status){
    const board=card.closest('.ordersKanban');
    if(!board)return;
    const definition=boardColumns.find(column=>column.statuses.includes(status))||boardColumns[0];
    board.querySelector(`[data-kanban="${definition.key}"] .kanbanCards`)?.appendChild(card);
    card.dataset.kanbanStatus=status;
    updateBoardCounts(board);
  }

  function organizeKanban(content){
    const cards=[...content.querySelectorAll(':scope > details.orderDetailed')];
    if(!cards.length)return;
    let board=content.querySelector(':scope > .ordersKanban');
    if(!board){
      board=document.createElement('section');
      board.className='ordersKanban';
      board.setAttribute('aria-label','Fluxo dos pedidos');
      board.innerHTML=boardColumns.map(column=>`<section class="kanbanColumn kanban-${column.key}" data-kanban="${column.key}"><header><div><b>${column.title}</b><small>${column.hint}</small></div><span class="kanbanCount">0</span></header><div class="kanbanCards"></div></section>`).join('');
      const filters=content.querySelector(':scope > .proFilters');
      (filters||content.querySelector(':scope > .proToolbar'))?.after(board);
    }
    cards.forEach(card=>{
      const status=cardStatus(card);
      const definition=boardColumns.find(column=>column.statuses.includes(status))||boardColumns[0];
      board.querySelector(`[data-kanban="${definition.key}"] .kanbanCards`)?.appendChild(card);
      card.dataset.kanbanStatus=status;
    });
    updateBoardCounts(board);
  }

  function enhance(root=document){
    const content=root.matches?.('#admContent')?root:root.querySelector?.('#admContent');
    if(!content)return;
    content.querySelectorAll('details.orderDetailed').forEach(compactCard);
    organizeKanban(content);
    foldPrinter(content);

    if(lastAction.id&&Date.now()-lastAction.at<9000){
      const card=[...content.querySelectorAll('details.orderDetailed')].find(item=>orderId(item)===lastAction.id);
      if(card){
        card.open=true;
        card.classList.add('recentlyUpdated');
        requestAnimationFrame(()=>card.scrollIntoView({block:'center',behavior:'smooth'}));
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

  document.addEventListener('input',event=>{
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
  enhance(document);
})();
