/* Central compacta v2.4 — preserva os recursos e reduz a rolagem operacional. */
(()=>{
  'use strict';
  let lastAction={id:'',at:0};

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
    dock.innerHTML=`<div class="statusDockTop"><div class="statusNow"><small>STATUS ATUAL</small><b><i>${statusMeta[current]?.icon||'●'}</i>${statusMeta[current]?.label||current}</b></div><button type="button" class="statusDockMenu" aria-expanded="false">•••</button></div><div class="statusProgress">${operationalFlow.map((status,i)=>`<span class="${i<index?'done':i===index?'current':''}" title="${statusMeta[status].label}"><i>${statusMeta[status].icon}</i><small>${statusMeta[status].label}</small></span>`).join('')}</div>${next?`<button type="button" class="statusNext" data-status-proxy="${next}"><span>PRÓXIMA ETAPA</span><b>${statusMeta[next].icon} ${statusMeta[next].label.toUpperCase()}</b></button>`:`<div class="statusCompleted">✓ PEDIDO FINALIZADO</div>`}<div class="statusDockOptions" hidden><b>CORRIGIR STATUS</b><div>${operationalFlow.filter(status=>status!==current).map(status=>`<button type="button" data-status-proxy="${status}">${statusMeta[status].icon} ${statusMeta[status].label}</button>`).join('')}</div>${current!=='cancelado'&&current!=='entregue'?'<button type="button" class="statusCancel" data-status-proxy="cancelado">× Cancelar pedido</button>':''}</div>`;
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
      const target=statusButton(card,button.dataset.statusProxy);
      if(!target||target.disabled)return;
      button.disabled=true;dock.classList.add('updating');
      target.click();
    });
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

  function enhance(root=document){
    const content=root.matches?.('#admContent')?root:root.querySelector?.('#admContent');
    if(!content)return;
    content.querySelectorAll('details.orderDetailed').forEach(compactCard);
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

  const observer=new MutationObserver(records=>{
    if(records.some(record=>record.addedNodes.length))requestAnimationFrame(()=>enhance(document));
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  enhance(document);
})();
