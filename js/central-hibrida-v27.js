/* O Caseirão Burger — Central Híbrida iFood + Saipos v2.7
   Camada visual/operacional. Preserva as funções e integrações já existentes. */
(()=>{
  'use strict';

  const columnMeta={
    novos:{label:'Novos',hint:'Recebidos e confirmados',statuses:['novo','confirmado']},
    preparo:{label:'Em preparo',hint:'Na chapa / cozinha',statuses:['preparando']},
    prontos:{label:'Prontos',hint:'Aguardando retirada ou saída',statuses:['pronto']},
    expedicao:{label:'Entrega / Retirada',hint:'Em rota e expedição',statuses:['em_rota']}
  };
  const finalStatuses=new Set(['entregue','cancelado']);
  const statusByLabel={
    'recebido':'novo','novo':'novo','confirmado':'confirmado','em preparo':'preparando','preparando':'preparando',
    'pronto':'pronto','em rota':'em_rota','entregue':'entregue','cancelado':'cancelado'
  };
  let filters={mode:'all',search:''};

  function orders(){
    try{return typeof shiftOrders==='function'?shiftOrders():(window.admin?.orders||[])}catch{return window.admin?.orders||[]}
  }
  function idOf(card){return String(card.querySelector('[data-oid]')?.dataset.oid||'')}
  function orderOf(card){const id=idOf(card);return orders().find(o=>String(o.id)===id)||null}
  function currentStatus(card){
    const order=orderOf(card); if(order?.status)return String(order.status);
    const badge=card.querySelector('.statusBadge')?.textContent?.trim().toLocaleLowerCase('pt-BR')||'';
    return statusByLabel[badge]||card.dataset.hybridStatus||'novo';
  }
  function bucket(status){
    if(columnMeta.novos.statuses.includes(status))return 'novos';
    if(columnMeta.preparo.statuses.includes(status))return 'preparo';
    if(columnMeta.prontos.statuses.includes(status))return 'prontos';
    if(columnMeta.expedicao.statuses.includes(status))return 'expedicao';
    return finalStatuses.has(status)?'finalizados':'novos';
  }
  function paymentIsPixPending(order){return String(order?.payment||'').toLowerCase()==='pix'&&String(order?.payment_status||'').toLowerCase()!=='confirmed'}
  function ageMinutes(order){
    const t=Date.parse(order?.created_at||'');
    return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/60000)):0;
  }
  function decorateCard(card){
    if(!card||card.dataset.hybridReady==='1')return;
    const order=orderOf(card),summary=card.querySelector('.orderSummary');
    if(!summary)return;
    card.dataset.hybridReady='1';
    card.dataset.hybridStatus=String(order?.status||currentStatus(card));
    card.dataset.hybridType=String(order?.type||'');
    card.dataset.hybridPayment=String(order?.payment||'').toLowerCase();
    card.dataset.hybridPixPending=paymentIsPixPending(order)?'1':'0';
    card.dataset.hybridAge=String(ageMinutes(order));

    const main=summary.querySelector('.summaryMain');
    if(main&&!main.querySelector('.hybridMeta')){
      const meta=document.createElement('div');meta.className='hybridMeta';
      const age=ageMinutes(order);
      const type=typeof orderTypeLabel==='function'?orderTypeLabel(order?.type):String(order?.type||'Pedido');
      const payment=typeof paymentLabel==='function'?paymentLabel(order?.payment):String(order?.payment||'');
      meta.innerHTML=`<span class="hybridType">${escapeHtml(type)}</span><span class="hybridPayment ${paymentIsPixPending(order)?'pending':''}">${paymentIsPixPending(order)?'PIX PENDENTE':escapeHtml(payment)}</span><span class="hybridAge ${age>=35?'late':age>=25?'warn':''}">${age} min</span>`;
      main.appendChild(meta);
    }

    const right=summary.querySelector('.summaryRight');
    if(right&&!right.querySelector('.hybridQuick')){
      const quick=document.createElement('button');quick.type='button';quick.className='hybridQuick';quick.dataset.hybridNext='1';
      right.appendChild(quick);
    }
    refreshQuick(card);
  }
  function escapeHtml(value){
    const div=document.createElement('div');div.textContent=String(value??'');return div.innerHTML;
  }
  function nextFor(order,status){
    if(status==='novo')return ['confirmado','Aceitar'];
    if(status==='confirmado')return ['preparando','Preparar'];
    if(status==='preparando')return ['pronto','Pronto'];
    if(status==='pronto')return order?.type==='delivery'?['em_rota','Despachar']:['entregue','Finalizar'];
    if(status==='em_rota')return ['entregue','Entregue'];
    return [null,'Concluído'];
  }
  function refreshQuick(card){
    const quick=card.querySelector('.hybridQuick');if(!quick)return;
    const order=orderOf(card),status=currentStatus(card),[next,label]=nextFor(order,status);
    quick.dataset.nextStatus=next||'';
    quick.textContent=next?label:'✓ Concluído';
    quick.disabled=!next;
  }
  function makeBoard(box,cards){
    if(box.querySelector('.hybridOrdersShell'))return;
    const shell=document.createElement('section');shell.className='hybridOrdersShell';
    shell.innerHTML=`
      <div class="hybridTopbar">
        <div class="hybridSearchWrap"><span>⌕</span><input class="hybridSearch" type="search" placeholder="Buscar pedido, cliente ou telefone" autocomplete="off"></div>
        <div class="hybridFilters" role="group" aria-label="Filtros rápidos">
          <button class="on" data-hybrid-filter="all">Todos</button>
          <button data-hybrid-filter="delivery">Entrega</button>
          <button data-hybrid-filter="pickup">Retirada</button>
          <button data-hybrid-filter="local">Mesa / local</button>
          <button data-hybrid-filter="pix">Pix pendente</button>
          <button data-hybrid-filter="late">Atrasados</button>
        </div>
      </div>
      <div class="hybridBoardViewport"><div class="hybridBoard">
        ${Object.entries(columnMeta).map(([key,meta])=>`<section class="hybridColumn" data-hybrid-column="${key}"><header><div><b>${meta.label}</b><small>${meta.hint}</small></div><span class="hybridCount">0</span></header><div class="hybridColumnBody"></div></section>`).join('')}
      </div></div>
      <details class="hybridFinished"><summary>Finalizados neste caixa <span data-hybrid-finished-count>0</span></summary><div class="hybridFinishedBody"></div></details>`;

    const firstCard=cards[0];
    if(firstCard)firstCard.before(shell);else box.appendChild(shell);
    cards.forEach(card=>placeCard(card,shell));

    const search=shell.querySelector('.hybridSearch');
    search.addEventListener('input',()=>{filters.search=search.value.trim().toLocaleLowerCase('pt-BR');applyFilters(shell)});
    shell.querySelectorAll('[data-hybrid-filter]').forEach(button=>button.addEventListener('click',()=>{
      filters.mode=button.dataset.hybridFilter;
      shell.querySelectorAll('[data-hybrid-filter]').forEach(b=>b.classList.toggle('on',b===button));
      applyFilters(shell);
    }));
    updateCounts(shell);applyFilters(shell);
  }
  function placeCard(card,shell=document.querySelector('.hybridOrdersShell')){
    if(!shell||!card)return;
    decorateCard(card);
    const status=currentStatus(card);card.dataset.hybridStatus=status;
    const dest=status==='entregue'||status==='cancelado'
      ?shell.querySelector('.hybridFinishedBody')
      :shell.querySelector(`[data-hybrid-column="${bucket(status)}"] .hybridColumnBody`);
    if(dest&&card.parentElement!==dest)dest.appendChild(card);
    card.classList.toggle('hybridFinal',finalStatuses.has(status));
    refreshQuick(card);updateCounts(shell);applyFilters(shell);
  }
  function matches(card){
    const order=orderOf(card)||{};
    const status=currentStatus(card),age=ageMinutes(order);
    const type=String(order.type||card.dataset.hybridType||'');
    const modeOk=filters.mode==='all'||
      (filters.mode==='delivery'&&type==='delivery')||
      (filters.mode==='pickup'&&['pickup','counter'].includes(type))||
      (filters.mode==='local'&&['local','table','mesa'].includes(type))||
      (filters.mode==='pix'&&paymentIsPixPending(order))||
      (filters.mode==='late'&&!finalStatuses.has(status)&&age>=35);
    if(!modeOk)return false;
    if(!filters.search)return true;
    const hay=[order.order_number,order.customer_name,order.customer_phone,order.type,order.payment].join(' ').toLocaleLowerCase('pt-BR');
    return hay.includes(filters.search);
  }
  function applyFilters(shell=document.querySelector('.hybridOrdersShell')){
    if(!shell)return;
    shell.querySelectorAll('.orderDetailed').forEach(card=>card.hidden=!matches(card));
    shell.querySelectorAll('.hybridColumn').forEach(col=>{
      const visible=[...col.querySelectorAll(':scope .hybridColumnBody > .orderDetailed')].filter(c=>!c.hidden).length;
      col.classList.toggle('hybridEmptyColumn',visible===0);
    });
  }
  function updateCounts(shell=document.querySelector('.hybridOrdersShell')){
    if(!shell)return;
    shell.querySelectorAll('.hybridColumn').forEach(col=>{
      const count=col.querySelectorAll(':scope .hybridColumnBody > .orderDetailed').length;
      const el=col.querySelector('.hybridCount');if(el)el.textContent=String(count);
    });
    const f=shell.querySelector('[data-hybrid-finished-count]');if(f)f.textContent=String(shell.querySelectorAll('.hybridFinishedBody > .orderDetailed').length);
  }
  function cleanupLegacy(box,shell){
    [...box.children].forEach(node=>{
      if(node===shell)return;
      if(node.matches?.('.sectionTitle'))node.remove();
      if(node.matches?.('.empty.cleanEmpty')&&shell.querySelectorAll('.orderDetailed').length)node.remove();
    });
  }
  function enhance(box=document.querySelector('#admContent')){
    if(!box||(typeof adminTab!=='undefined'&&adminTab!=='pedidos'))return;
    const cards=[...box.querySelectorAll(':scope > .orderDetailed')];
    let shell=box.querySelector('.hybridOrdersShell');
    if(!cards.length){
      const storeOpen=!!(window.admin?.settings?.store_open);
      if(!shell&&storeOpen&&box.querySelector('.orderToolbar'))makeBoard(box,[]);
      shell=box.querySelector('.hybridOrdersShell');
      if(shell){
        [...box.children].forEach(node=>{
          if(node!==shell&&node.matches?.('.sectionTitle,.empty.cleanEmpty'))node.remove();
        });
        updateCounts(shell);applyFilters(shell);
      }
      return;
    }
    cards.forEach(decorateCard);makeBoard(box,cards);
    shell=box.querySelector('.hybridOrdersShell');
    cards.forEach(card=>placeCard(card,shell));cleanupLegacy(box,shell);
  }

  document.addEventListener('click',event=>{
    const quick=event.target.closest('.hybridQuick');
    if(quick){
      event.preventDefault();event.stopPropagation();
      const card=quick.closest('.orderDetailed'),next=quick.dataset.nextStatus;if(!card||!next)return;
      const dockAction=card.querySelector(`.statusNext[data-status-proxy="${CSS.escape(next)}"]`);
      if(dockAction){dockAction.click();waitForStatus(card,next)}
      else{card.open=true;requestAnimationFrame(()=>{const fallback=card.querySelector(`.statusNext[data-status-proxy="${CSS.escape(next)}"]`);if(fallback){fallback.click();waitForStatus(card,next)}})}
      return;
    }
    const proxy=event.target.closest('[data-status-proxy]');
    if(proxy){const card=proxy.closest('.orderDetailed'),next=proxy.dataset.statusProxy;if(card&&next)waitForStatus(card,next)}
    const correction=event.target.closest('.statusApplyCorrection');
    if(correction){const card=correction.closest('.orderDetailed');setTimeout(()=>card&&placeCard(card),450)}
    const cancel=event.target.closest('.statusCancel');
    if(cancel){const card=cancel.closest('.orderDetailed');setTimeout(()=>card&&placeCard(card),450)}
  },true);
  function waitForStatus(card,next,attempt=0){
    if(!card)return;
    setTimeout(()=>{
      const order=orderOf(card);const status=String(order?.status||currentStatus(card));
      if(status===next||attempt>15){card.dataset.hybridStatus=status;placeCard(card);return}
      waitForStatus(card,next,attempt+1);
    },180);
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(()=>enhance()));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  requestAnimationFrame(()=>enhance());
})();
