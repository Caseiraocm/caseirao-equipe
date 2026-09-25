'use strict';
/* MELHORIAS CONSOLIDADAS NO NÚCLEO — V21 */
/* Troca apenas os rótulos decorativos do resumo financeiro. */
(()=>{
  const polishAdminLabels=()=>{
    const head=document.querySelector('.sheet.full .adminHead h2');
    if(!head||!/^Central Caseirão$/i.test(head.textContent.trim()))return;
    document.querySelectorAll('.sheet.full .paymentMetric span').forEach((label,index)=>{
      const desired=['Cartão','Pix','Dinheiro'][index];
      if(desired&&label.textContent!==desired)label.textContent=desired;
    });
    const nav=document.querySelector('.sheet.full>.admbar');
    if(nav){nav.setAttribute('aria-label','Áreas da Central Caseirão');nav.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('on'))));}
  };
  /* Rótulos aplicados sem observer global. */
  polishAdminLabels();
})();

/* Mantém todas as ações existentes, mas apresenta somente a próxima etapa como destaque. */
(()=>{
  const flow=['confirmado','preparando','pronto','em_rota','entregue'];
  const nextFor=order=>{
    if(!order)return null;
    if(order.status==='novo'||order.status==='confirmado')return'preparando';
    if(order.status==='preparando')return'pronto';
    if(order.status==='pronto')return order.type==='delivery'?'em_rota':'entregue';
    if(order.status==='em_rota')return'entregue';
    return null;
  };
  const actionLabel=(order,next)=>({
    preparando:'🔥 INICIAR PREPARO',
    pronto:'✓ MARCAR COMO PRONTO',
    em_rota:'🛵 ENVIAR PARA ROTA',
    entregue:isCounterOrder(order)?'✓ FINALIZAR BALCÃO':order?.type==='pickup'?'✓ CONFIRMAR RETIRADA':order?.type==='local'?'✓ FINALIZAR CONSUMO':'✓ CONFIRMAR ENTREGA'
  }[next]||'AVANÇAR PEDIDO');
  const ageLabel=order=>{
    const minutes=Math.max(0,Math.floor((Date.now()-new Date(order.created_at).getTime())/60000));
    return minutes<1?'chegou agora':`há ${minutes} min`;
  };
  const enhance=box=>{
    box.querySelectorAll('.orderactions.statusWorkflow').forEach(actions=>{
      if(actions.closest('.finishedOrder')||actions.closest('.smartOrderFlow'))return;
      const id=actions.querySelector('[data-oid]')?.dataset.oid;
      const order=(admin?.orders||[]).find(item=>String(item.id)===String(id));
      const next=nextFor(order);
      if(!order||!next)return;
      const target=actions.querySelector(`[data-st="${next}"]`);
      if(!target)return;
      actions.previousElementSibling?.classList.contains('statusSectionTitle')&&actions.previousElementSibling.remove();
      const currentIndex=Math.max(0,flow.indexOf(order.status));
      const guide=document.createElement('div');
      guide.className='smartOrderFlow';
      guide.innerHTML=`<div class="smartFlowTop"><b>PRÓXIMA AÇÃO</b><span>Pedido ${ageLabel(order)}</span></div><div class="smartFlowSteps" aria-label="Progresso do pedido">${[0,1,2,3].map((_,i)=>`<span class="smartFlowStep ${i<currentIndex?'done':''}"></span>`).join('')}</div><button type="button" class="smartNextAction" data-next="${next}">${actionLabel(order,next)}</button><details class="statusAdvancedOptions"><summary>Corrigir status ou cancelar</summary></details>`;
      const advanced=guide.querySelector('.statusAdvancedOptions');
      actions.parentNode.insertBefore(guide,actions);
      advanced.appendChild(actions);
      guide.querySelector('.smartNextAction').onclick=event=>{
        const button=event.currentTarget;
        button.disabled=true;
        button.textContent='ATUALIZANDO...';
        target.click();
      };
    });
  };
  const base=renderOrders;
  renderOrders=function(box){const result=base(box);enhance(box);return result};
})();

/*
 * Entrega em um toque. O sistema percorre internamente as etapas exigidas pela
 * API, registra o horário final e evita que dois toques contabilizem o pedido.
 */
(()=>{
  const deliveryLocks=new Set();

  /* A API do entregador pode devolver o pedido completo dentro da atribuição,
     na lista geral de pedidos ou os itens em uma lista separada. Unificamos
     esses formatos para o motoboy sempre receber a especificação disponível. */
  function driverFullOrder(assignment){
    const compact=assignment?.orders||{};
    const orderId=compact.id||assignment?.order_id;
    const full=(driverSnapshot?.orders||[]).find(order=>String(order.id)===String(orderId))||{};
    let directItems=assignment?.order_items||assignment?.items||compact.order_items||compact.items||full.order_items||full.items;
    if(typeof directItems==='string'){try{directItems=JSON.parse(directItems)}catch{directItems=[]}}
    const snapshotItems=(driverSnapshot?.order_items||[]).filter(item=>String(item.order_id)===String(orderId));
    const rawItems=Array.isArray(directItems)?directItems:(snapshotItems.length?snapshotItems:[]);
    const normalizedItems=rawItems.map(item=>({
      ...item,
      quantity:item.quantity??item.qty??1,
      product_name:item.product_name??item.name??item.product?.name??'Item',
      note:item.note??item.observation??item.notes??'',
      order_item_addons:item.order_item_addons??item.addons??item.item_addons??[]
    }));
    return {...compact,...full,order_items:normalizedItems};
  }

  driverOrderCard=function(a){
    const o=driverFullOrder(a),hood=a.neighborhood_name||o.neighborhood_name||'Bairro não informado',fee=Number(a.driver_fee||0);
    const finished=['delivered','returned','settled'].includes(a.status);
    const rawPhone=String(o.customer_phone||'').replace(/\D/g,'');
    const phoneHref=rawPhone?`tel:${rawPhone}`:'';
    const change=o.change_for?String(o.change_for):'';
    const street=[o.address_street,o.address_number].filter(Boolean).join(', ')||'Endereço não informado';
    const complement=o.address_complement?`Complemento: ${o.address_complement}`:'';
    const reference=o.address_reference?`Referência: ${o.address_reference}`:'';
    const action=finished
      ? `<button class="primary" disabled>✓ ENTREGA CONCLUÍDA</button>`
      : `<button class="primary driverDeliverButton" data-driver-deliver="${a.id}">✓ MARCAR COMO ENTREGUE</button><div class="driverOneTapHint">Um toque confirma a entrega, registra o horário e atualiza o fechamento.</div>`;
    return `<div class="driverOrder ${finished?'driverFinishedCard':''}">
      <div class="driverQuickTop">
        <div class="grow"><h3>Pedido #${esc(o.order_number||'—')}</h3><div class="driverStatus">${esc(deliveryStatusLabel(a.status))}</div></div>
        <b class="driverFee">${fee?fmt(fee):'—'}</b>
      </div>
      <div class="driverQuickLine"><span class="driverQuickChip">📍 ${esc(hood)}</span><span class="driverQuickChip">💳 ${esc(paymentLabel(o.payment))}</span></div>
      <div class="driverNextAction">${action}${!finished?`<button class="secondary danger" style="margin-top:7px" data-driver-status="problem" data-driver-assignment="${a.id}">PROBLEMA NA ENTREGA</button>`:''}</div>
      <details class="driverDetails" open><summary>Endereço e detalhes do pedido</summary><div class="driverDetailsContent">${deliveryTimesHtml(a)}
        <div class="driverDeliveryInfo">
          <div class="driverInfoBlock driverAddressBlock"><small>📍 Endereço da entrega</small><strong>${esc(street)}</strong><span class="driverReference">${esc(hood)}${complement?` • ${esc(complement)}`:''}${reference?`<br>${esc(reference)}`:''}</span></div>
          <a class="secondary driverMiniMapBtn" href="${esc(safeMapsLink(o))}" target="_blank" rel="noopener">🗺️ ABRIR ROTA NO MAPA</a>
          <div class="driverInfoBlock"><small>👤 Cliente</small><strong>${esc(o.customer_name||'Não informado')}</strong>${phoneHref?`<a class="driverPhoneLink" href="${esc(phoneHref)}">📞 LIGAR PARA ${esc(o.customer_phone)}</a>`:`<span class="driverReference">Telefone não informado</span>`}</div>
          <div class="driverPayGrid"><div class="driverInfoBlock driverPaymentBlock"><small>💳 Pagamento atual</small><strong>${esc(paymentLabel(o.payment))}</strong><span class="driverReference">${change?`Troco para ${esc(change)}`:'Sem troco informado'}</span>${!finished?`<button type="button" class="driverChangePaymentBtn" data-driver-payment="${a.id}">ALTERAR PAGAMENTO</button>`:''}</div><div class="driverInfoBlock"><small>💰 Total a receber</small><strong>${fmt(o.total)}</strong><span class="driverReference">Taxa do entregador: ${fee?fmt(fee):'não informada'}</span></div></div>
        </div>
        <div class="driverItemsTitle">🍔 ITENS DO PEDIDO</div><div class="orderItemsBox">${orderItemsHtml(o)}</div>
        ${o.notes?`<div class="notesBoxAdmin"><b>📝 Observações gerais</b>${esc(o.notes)}</div>`:''}
        <button class="secondary" data-driver-gps="${a.id}">📍 ATIVAR COMPARTILHAMENTO DE GPS</button>
      </div></details>
    </div>`;
  };

  async function deliverInOneTap(id,button){
    if(deliveryLocks.has(id))return;
    const assignment=(driverSnapshot?.assignments||[]).find(x=>String(x.id)===String(id));
    if(!assignment||['delivered','returned','settled'].includes(assignment.status))return;
    deliveryLocks.add(id);button.disabled=true;button.textContent='CONFIRMANDO ENTREGA...';
    try{
      let current=assignment.status;
      if(current==='assigned'||current==='problem'){
        await driverAppApi('status',{assignment_id:id,status:'route'});
        current='route';
      }
      if(current==='route'){
        await driverAppApi('status',{assignment_id:id,status:'arrived'});
        current='arrived';
      }
      if(current==='arrived'){
        const order=assignment.orders||{};
        const payload={assignment_id:id,status:'delivered',payment_confirmed:true};
        if(order.payment==='Dinheiro'){
          payload.cash_received=Number(order.total||0);
          payload.change_given=0;
        }
        await driverAppApi('status',payload);
      }
      stopDriverAreaGps();
      showAppToast('Entrega confirmada e contabilizada.','ok');
      await renderDriverArea();
    }catch(e){
      button.disabled=false;button.textContent='✓ MARCAR COMO ENTREGUE';
      alert(e.message||'Não foi possível confirmar a entrega.');
    }finally{deliveryLocks.delete(id)}
  }

  const baseRenderDriverArea=renderDriverArea;
  renderDriverArea=async function(){
    const result=await baseRenderDriverArea();
    document.querySelectorAll('[data-driver-deliver]').forEach(button=>{
      button.onclick=()=>deliverInOneTap(button.dataset.driverDeliver,button);
    });
    document.querySelectorAll('[data-driver-payment]').forEach(button=>{
      button.onclick=()=>openDriverPaymentChange(button.dataset.driverPayment);
    });
    return result;
  };

  function openDriverPaymentChange(id){
    const assignment=(driverSnapshot?.assignments||[]).find(x=>String(x.id)===String(id));
    const order=driverFullOrder(assignment||{});
    if(!assignment||!order?.id)return alert('Não foi possível localizar este pedido.');
    const current=String(order.payment||'');
    modal(`<div class="sheeth"><div><h2>Alterar pagamento</h2><div class="adminSub">Pedido #${esc(order.order_number||'—')} • ${fmt(order.total)}</div></div><button class="x" id="backDriverPayment">←</button></div><div class="driverPaymentChooser"><div class="operationHint">Selecione a forma que o cliente realmente usou na entrega. A mudança será salva no pedido e aparecerá no caixa/ADM.</div>${['Dinheiro','Pix','Cartão'].map(method=>`<button type="button" class="driverPaymentOption ${current===method?'selected':''}" data-payment-method="${method}"><span>${method==='Dinheiro'?'💵':method==='Pix'?'◆':'💳'}</span><b>${method}</b>${current===method?'<small>ATUAL</small>':''}</button>`).join('')}</div>`,true);
    $('#backDriverPayment').onclick=()=>renderDriverArea();
    document.querySelectorAll('[data-payment-method]').forEach(choice=>choice.onclick=async()=>{
      const payment=choice.dataset.paymentMethod;
      let changeFor='';
      if(payment==='Dinheiro'){
        const answer=prompt('Se precisar de troco, informe "troco para quanto?". Se não precisar, deixe vazio.',String(order.change_for||''));
        if(answer===null)return;
        changeFor=answer.trim();
      }
      try{
        document.querySelectorAll('[data-payment-method]').forEach(x=>x.disabled=true);
        choice.innerHTML='<b>SALVANDO...</b>';
        await driverAppApi('payment',{assignment_id:id,payment,change_for:changeFor});
        showAppToast(`Pagamento alterado para ${payment}.`,'ok');
        await renderDriverArea();
      }catch(e){alert(e.message||'Não foi possível alterar o pagamento.');await renderDriverArea()}
    });
  }

  /* O painel pode ter sido restaurado antes deste aprimoramento carregar. */
  if(document.querySelector('.driverScreenNew')&&localStorage.getItem(driverTokenKey)){
    setTimeout(()=>renderDriverArea(),0);
  }
})();

/* Alerta do ADM quando o entregador conclui uma entrega em outro aparelho. */
(()=>{
  let deliveryAlertTimer=null,deliveryAlertBusy=false,deliveryAlertReady=false;
  const knownDelivered=new Set();
  const deliveredKey=a=>`${a.id}:${a.delivered_at||'delivered'}`;
  const isDelivered=a=>['delivered','returned','settled'].includes(a.status)&&Boolean(a.delivered_at||a.status==='delivered');

  function nativeDeliveryNotification(assignment){
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    const order=assignment.orders||{},driver=assignment.drivers||{};
    try{
      const notification=new Notification(`Entrega concluída • Pedido #${order.order_number||'—'}`,{
        body:`${driver.name||'Entregador'} confirmou a entrega.`,
        tag:`caseirao-delivery-${assignment.id}`,
        renotify:true,
        requireInteraction:true,
        vibrate:[250,120,250]
      });
      notification.onclick=()=>{window.focus();notification.close();adminTab='entregas';renderAdmin()};
    }catch{}
  }

  async function checkDeliveredOrders(){
    if(deliveryAlertBusy||!sessionStorage.getItem('caseirao_admin_pin'))return;
    deliveryAlertBusy=true;
    try{
      const snapshot=await driverAppApi('admin_snapshot',{},true);
      const completed=(snapshot.assignments||[]).filter(isDelivered);
      if(!deliveryAlertReady){
        completed.forEach(a=>knownDelivered.add(deliveredKey(a)));
        deliveryAlertReady=true;
        return;
      }
      const fresh=completed.filter(a=>!knownDelivered.has(deliveredKey(a)));
      completed.forEach(a=>knownDelivered.add(deliveredKey(a)));
      if(!fresh.length)return;
      deliveryHub=snapshot;
      for(const assignment of fresh){
        const order=assignment.orders||{},driver=assignment.drivers||{};
        const message=`Pedido #${order.order_number||'—'} entregue por ${driver.name||'entregador'}.`;
        playOrderSound();
        showAppToast(message,'ok');
        nativeDeliveryNotification(assignment);
      }
      if(adminTab==='entregas'){
        const box=$('#admContent');
        if(box)await renderDeliveryHub(box);
      }
    }catch{}finally{deliveryAlertBusy=false}
  }

  function startDeliveryAlerts(){
    /* O detector principal agora usa a sincronização do ADM, que já roda a cada 2,5 s. */
    return;
  }

  const baseRenderAdminForDeliveryAlerts=renderAdmin;
  renderAdmin=function(){
    const result=baseRenderAdminForDeliveryAlerts();
    startDeliveryAlerts();
    return result;
  };
})();

/* Confirmação persistente na Central: o atendente precisa reconhecer o aviso. */
(()=>{
  const historyKey='caseirao_delivery_alert_history';
  const originalToast=showAppToast;
  let lastDeliveryMessage='',lastDeliveryMessageAt=0;
  const saveAlert=(message,id='')=>{
    try{
      const history=JSON.parse(localStorage.getItem(historyKey)||'[]');
      const now=Date.now(),duplicate=history.some(item=>(id&&String(item.id||'')===String(id))||(!id&&item.message===message&&now-new Date(item.time||0).getTime()<20000));
      if(duplicate)return;
      history.unshift({id:String(id||crypto.randomUUID?.()||now),message,time:new Date().toISOString(),read:false});
      localStorage.setItem(historyKey,JSON.stringify(history.slice(0,50)));
      window.dispatchEvent(new CustomEvent('caseirao-delivery-alert-saved'));
    }catch{}
  };
  window.caseiraoSaveDeliveryNotification=saveAlert;
  const centralAlert=message=>{
    saveAlert(message);
    document.querySelector('.deliveryCentralAlert')?.remove();
    const layer=document.createElement('div');
    layer.className='deliveryCentralAlert';
    layer.setAttribute('role','alertdialog');
    layer.setAttribute('aria-modal','true');
    layer.innerHTML=`<section class="deliveryCentralAlertCard"><div class="deliveryCentralAlertHead"><div class="deliveryCentralAlertIcon">✓</div><div><b>Entrega concluída!</b><span>Confirmação recebida do entregador</span></div></div><div class="deliveryCentralAlertBody"><div class="deliveryCentralAlertMessage">${esc(message)}</div><div class="deliveryCentralAlertTime">Recebido às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div><div class="deliveryCentralAlertActions"><button class="primary" data-open-deliveries>ABRIR ENTREGAS</button><button class="secondary" data-ack-delivery>OK, ENTENDI</button></div></div></section>`;
    document.body.appendChild(layer);
    try{navigator.vibrate?.([300,120,300,120,500])}catch{}
    if('Notification' in window&&Notification.permission==='granted'){
      try{new Notification('Entrega concluída • Caseirão',{body:message,tag:'caseirao-central-'+message,renotify:true,requireInteraction:true,vibrate:[300,120,400]})}catch{}
    }
    layer.querySelector('[data-ack-delivery]').onclick=()=>layer.remove();
    layer.querySelector('[data-open-deliveries]').onclick=()=>{layer.remove();adminTab='entregas';renderAdmin()};
  };
  showAppToast=function(message,type='info'){
    const isDelivery=/^Pedido #.+ entregue por .+\.$/i.test(String(message||''));
    if(isDelivery&&String(message)===lastDeliveryMessage&&Date.now()-lastDeliveryMessageAt<15000)return;
    if(isDelivery){lastDeliveryMessage=String(message);lastDeliveryMessageAt=Date.now()}
    originalToast(message,type);
    if(isDelivery)centralAlert(String(message));
  };
})();

/* Conclusões presenciais: Retirada, Balcão e Consumo no local não são entregas. */
(()=>{
  window.caseiraoShowOperationalCompletion=(order,message)=>{
    const type=operationalOrderType(order);
    if(type==='delivery')return;
    const copy=type==='counter'
      ?{title:'Pedido de balcão finalizado!',subtitle:'Atendimento concluído no balcão'}
      :type==='pickup'
        ?{title:'Pedido retirado!',subtitle:'Pedido retirado pelo cliente'}
        :{title:'Atendimento finalizado!',subtitle:'Consumo no local concluído'};
    document.querySelector('.operationalCompletionAlert')?.remove();
    const layer=document.createElement('div');
    layer.className='deliveryCentralAlert operationalCompletionAlert';
    layer.setAttribute('role','alertdialog');
    layer.setAttribute('aria-modal','true');
    layer.innerHTML=`<section class="deliveryCentralAlertCard"><div class="deliveryCentralAlertHead"><div class="deliveryCentralAlertIcon">✓</div><div><b>${esc(copy.title)}</b><span>${esc(copy.subtitle)}</span></div></div><div class="deliveryCentralAlertBody"><div class="deliveryCentralAlertMessage">${esc(message)}</div><div class="deliveryCentralAlertTime">Finalizado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div><div class="deliveryCentralAlertActions"><button class="secondary" data-ack-operation>OK, ENTENDI</button></div></div></section>`;
    document.body.appendChild(layer);
    layer.querySelector('[data-ack-operation]').onclick=()=>layer.remove();
    try{navigator.vibrate?.([250,100,350])}catch{}
    if('Notification'in window&&Notification.permission==='granted'){
      try{new Notification(`${copy.title} • Caseirão`,{body:message,tag:`caseirao-operation-${order?.id||order?.order_number||Date.now()}`,renotify:true,requireInteraction:true,vibrate:[250,100,350]})}catch{}
    }
  };
})();

/* Detector redundante: acompanha Entregas e Pedidos para não depender de uma única resposta da API. */
(()=>{
  if(window.__caseiraoDeliveryFallback)return;
  window.__caseiraoDeliveryFallback=true;
  /* Mantido apenas como histórico de compatibilidade. A sincronização central é a fonte única. */
  return;
  const seenKey='caseirao_seen_delivered_orders_v2';
  let busy=false,initialized=false;
  const seen=new Set();
  try{JSON.parse(localStorage.getItem(seenKey)||'[]').forEach(id=>seen.add(String(id)))}catch{}
  const persist=()=>{try{localStorage.setItem(seenKey,JSON.stringify([...seen].slice(-300)))}catch{}};
  const assignmentRows=snapshot=>snapshot?.assignments||snapshot?.deliveries||snapshot?.data?.assignments||snapshot?.data?.deliveries||[];
  const orderRows=snapshot=>snapshot?.orders||snapshot?.data?.orders||[];
  const completedAssignment=a=>['delivered','returned','settled','entregue'].includes(String(a.status||'').toLowerCase())||Boolean(a.delivered_at);
  const recent=date=>{const time=new Date(date||0).getTime();return Number.isFinite(time)&&time>0&&Date.now()-time<120000};
  function emit(orderId,number,driverName,deliveredAt){
    const id=String(orderId||number||'');
    if(!id||seen.has(id))return;
    seen.add(id);persist();
    const message=`Pedido #${number||'—'} entregue por ${driverName||'entregador'}.`;
    playOrderSound();
    showAppToast(message,'ok');
    if('Notification' in window&&Notification.permission==='granted'){
      try{new Notification(`Entrega concluída • Pedido #${number||'—'}`,{body:message,tag:`caseirao-delivered-${id}`,renotify:true,requireInteraction:true,vibrate:[300,120,400],timestamp:new Date(deliveredAt||Date.now()).getTime()})}catch{}
    }
  }
  async function poll(){
    if(busy||!sessionStorage.getItem('caseirao_admin_pin'))return;
    busy=true;
    try{
      let deliverySnapshot=null,adminSnapshot=null;
      try{deliverySnapshot=await driverAppApi('admin_snapshot',{},true)}catch{}
      try{adminSnapshot=await adminCall('snapshot')}catch{}
      const completed=assignmentRows(deliverySnapshot).filter(completedAssignment);
      const deliveredOrders=orderRows(adminSnapshot).filter(o=>String(o.status||'').toLowerCase()==='entregue');
      if(!initialized&&seen.size===0){
        completed.filter(a=>!recent(a.delivered_at)).forEach(a=>seen.add(String(a.order_id||a.orders?.id||a.id)));
        deliveredOrders.filter(o=>!recent(o.updated_at||o.delivered_at)).forEach(o=>seen.add(String(o.id||o.order_number)));
        persist();
      }
      completed.forEach(a=>{const o=a.orders||{};emit(a.order_id||o.id||a.id,o.order_number||a.order_number,a.drivers?.name||a.driver_name,a.delivered_at)});
      deliveredOrders.forEach(o=>emit(o.id||o.order_number,o.order_number,'entregador',o.delivered_at||o.updated_at));
      initialized=true;
    }finally{busy=false}
  }
  /* Poll duplicado removido: o watcher principal já detecta entregas concluídas. */
})();

/* Caixa de notificações das entregas, com histórico e contador de não lidas. */
(()=>{
  const key='caseirao_delivery_alert_history';
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const write=value=>{try{localStorage.setItem(key,JSON.stringify(value.slice(0,50)))}catch{}};
  const timeLabel=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Horário não informado':date.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})};
  function updateBadge(){const badge=document.querySelector('.deliveryNotificationBadge');if(!badge)return;const count=read().filter(item=>!item.read).length,label=count>99?'99+':String(count);if(badge.textContent!==label)badge.textContent=label;badge.classList.toggle('hide',count===0);badge.closest('button')?.setAttribute('aria-label',count?`${count} notificações de entrega não lidas`:'Notificações de entrega')}
  function openCenter(){
    document.querySelector('.deliveryNotificationLayer')?.remove();
    const history=read(),layer=document.createElement('div');
    layer.className='deliveryNotificationLayer';
    layer.innerHTML=`<aside class="deliveryNotificationPanel" role="dialog" aria-modal="true" aria-label="Notificações de entrega"><div class="deliveryNotificationPanelHead"><div><h2>🔔 Entregas</h2><span>${history.length?`${history.length} avisos guardados`:'Nenhum aviso recebido'}</span></div><button data-close-notifications aria-label="Fechar">×</button></div><div class="deliveryNotificationList">${history.length?history.map((item,index)=>`<article class="deliveryNotificationItem ${item.read?'':'unread'}"><div class="deliveryNotificationItemIcon">✓</div><div><b>${esc(item.message||'Entrega concluída.')}</b><time>${esc(timeLabel(item.time))}</time></div><button class="deliveryNotificationDelete" data-delete-notification="${index}" aria-label="Apagar esta notificação">🗑</button></article>`).join(''):'<div class="deliveryNotificationEmpty"><b>Nenhuma entrega notificada</b>As confirmações dos entregadores aparecerão aqui.</div>'}</div>${history.length?'<div class="deliveryNotificationFooter"><button data-clear-history>APAGAR TODO O HISTÓRICO</button></div>':''}</aside>`;
    document.body.appendChild(layer);
    write(history.map(item=>({...item,read:true})));updateBadge();
    layer.querySelector('[data-close-notifications]').onclick=()=>layer.remove();
    layer.onclick=event=>{if(event.target===layer)layer.remove()};
    layer.querySelectorAll('[data-delete-notification]').forEach(button=>button.onclick=()=>{const current=read();current.splice(Number(button.dataset.deleteNotification),1);write(current);layer.remove();openCenter()});
    layer.querySelector('[data-clear-history]')?.addEventListener('click',()=>{if(!confirm('Apagar todas as notificações de entrega?'))return;write([]);layer.remove();openCenter()});
  }
  function mount(){
    return;
    if(!sessionStorage.getItem('caseirao_admin_pin'))return;
    const head=document.querySelector('.sheet.full .adminHead');if(!head)return;
    let bell=head.querySelector('.deliveryNotificationBell');
    if(!bell){bell=document.createElement('button');bell.type='button';bell.className='deliveryNotificationBell';bell.innerHTML='🔔<span class="deliveryNotificationBadge hide">0</span>';bell.onclick=openCenter;const logout=head.querySelector('#adminLogout');logout?head.insertBefore(bell,logout):head.appendChild(bell)}
    updateBadge();
  }
  /* Observer morto removido: mount() está desativado. */
  window.addEventListener('caseirao-delivery-alert-saved',()=>updateBadge());
})();

/* Histórico oficial no Supabase: compartilhado entre aparelhos e apagado somente pelo ADM. */
(()=>{
  let dbHistory=[],syncBusy=false;
  const notificationAdminApi=async(action,payload={})=>{const response=await fetch('https://jhvtjhjzlljqfzdccrxc.supabase.co/functions/v1/driver-api',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:sessionStorage.getItem('caseirao_admin_pin')||'',action,payload})});let result={};try{result=await response.json()}catch{}if(!response.ok||result.error)throw new Error(result.error||result.detail||`Erro ${response.status}`);return result};
  const normalize=row=>({id:row.id,message:row.message||`Pedido #${row.order_number||'—'} entregue por ${row.driver_name||'entregador'}.`,time:row.created_at,read:Boolean(row.read_at)});
  const updateDbBadge=()=>{const badge=document.querySelector('.deliveryNotificationBadge');if(!badge)return;const count=dbHistory.filter(item=>!item.read).length,label=count>99?'99+':String(count);if(badge.textContent!==label)badge.textContent=label;badge.classList.toggle('hide',count===0)};
  async function syncDbHistory(){if(syncBusy||!sessionStorage.getItem('caseirao_admin_pin'))return dbHistory;syncBusy=true;try{const snapshot=await notificationAdminApi('admin_snapshot');dbHistory=(snapshot.notifications||[]).map(normalize);updateDbBadge();return dbHistory}finally{syncBusy=false}}
  async function openDbCenter(){
    document.querySelector('.deliveryNotificationLayer')?.remove();
    const loading=document.createElement('div');loading.className='deliveryNotificationLayer';loading.innerHTML='<aside class="deliveryNotificationPanel"><div class="deliveryNotificationPanelHead"><div><h2>🔔 Entregas</h2><span>Carregando histórico do banco...</span></div><button data-close-db-notifications>×</button></div></aside>';document.body.appendChild(loading);loading.querySelector('[data-close-db-notifications]').onclick=()=>loading.remove();
    try{await syncDbHistory()}catch(e){loading.querySelector('span').textContent='Falha ao carregar: '+(e.message||e);return}
    loading.remove();const history=dbHistory,layer=document.createElement('div');layer.className='deliveryNotificationLayer';
    layer.innerHTML=`<aside class="deliveryNotificationPanel" role="dialog" aria-modal="true"><div class="deliveryNotificationPanelHead"><div><h2>🔔 Entregas</h2><span>${history.length?`${history.length} notificações salvas no banco`:'Nenhuma notificação salva'}</span></div><button data-close-db-notifications>×</button></div><div class="deliveryNotificationList">${history.length?history.map(item=>`<article class="deliveryNotificationItem ${item.read?'':'unread'}"><div class="deliveryNotificationItemIcon">✓</div><div><b>${esc(item.message)}</b><time>${new Date(item.time).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time></div><button class="deliveryNotificationDelete" data-db-delete="${esc(item.id)}" aria-label="Apagar esta notificação">🗑</button></article>`).join(''):'<div class="deliveryNotificationEmpty"><b>Nenhuma entrega notificada</b>As próximas confirmações ficarão salvas aqui.</div>'}</div>${history.length?'<div class="deliveryNotificationFooter"><button data-db-clear>APAGAR TODO O HISTÓRICO</button></div>':''}</aside>`;document.body.appendChild(layer);
    const unread=history.filter(item=>!item.read).map(item=>item.id);if(unread.length){notificationAdminApi('admin_read_notifications',{ids:unread}).then(()=>{dbHistory=dbHistory.map(item=>({...item,read:true}));updateDbBadge()}).catch(()=>{})}
    layer.querySelector('[data-close-db-notifications]').onclick=()=>layer.remove();layer.onclick=event=>{if(event.target===layer)layer.remove()};
    layer.querySelectorAll('[data-db-delete]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await notificationAdminApi('admin_delete_notification',{id:button.dataset.dbDelete});dbHistory=dbHistory.filter(item=>String(item.id)!==String(button.dataset.dbDelete));layer.remove();openDbCenter()}catch(e){button.disabled=false;alert(e.message||e)}});
    layer.querySelector('[data-db-clear]')?.addEventListener('click',async()=>{if(!confirm('Apagar definitivamente todas as notificações de entrega?'))return;try{await notificationAdminApi('admin_clear_notifications');dbHistory=[];layer.remove();openDbCenter()}catch(e){alert(e.message||e)}})
  }
  document.addEventListener('click',event=>{const bell=event.target.closest?.('.deliveryNotificationBell');if(!bell)return;event.preventDefault();event.stopImmediatePropagation();openDbCenter()},true);
  window.addEventListener('caseirao-delivery-alert-saved',()=>setTimeout(syncDbHistory,700));
  /* Central de histórico desativada a pedido do proprietário; alertas operacionais permanecem ativos. */
})();

/* Mantém o teclado aberto: a busca filtra os cartões existentes sem recriar a tela. */
document.addEventListener('input',event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||input.id!=='orderSearch')return;
  event.stopImmediatePropagation();
  const term=input.value.trim().toLocaleLowerCase('pt-BR');
  const content=input.closest('#admContent')||document;
  content.querySelectorAll('.orderDetailed').forEach(card=>{
    card.classList.toggle('hide',Boolean(term)&&!card.textContent.toLocaleLowerCase('pt-BR').includes(term));
  });
},true);

/* CASEIRÃO PROFESSIONAL FINAL — inteligência operacional sem alterar contratos do backend. */
(()=>{
  const finalBuild='2026.09.13-final';
  let lastSyncAt=new Date(),syncTimer=null;
  const finalShiftOrders=()=>typeof shiftOrders==='function'?shiftOrders():(admin?.orders||[]).filter(o=>localDay(o.created_at)===todayKey()&&!o.archived_at);
  const liveOrders=()=>finalShiftOrders().filter(o=>!['entregue','cancelado'].includes(String(o.status||'')));
  const money=n=>fmt(Number(n||0));
  const minutes=o=>Math.max(0,Math.floor((Date.now()-new Date(o.created_at).getTime())/60000));
  const csvCell=value=>`"${String(value??'').replace(/"/g,'""')}"`;
  const download=(name,content,type='text/plain;charset=utf-8')=>{const blob=new Blob(['\ufeff',content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const statusName=status=>statusLabel?.[status]||status||'Não informado';

  function syncLabel(){
    const head=document.querySelector('.sheet.full .adminHead .grow');if(!head)return;
    let label=head.querySelector('.opsSync');if(!label){label=document.createElement('div');label.className='opsSync';head.appendChild(label)}
    label.textContent=`Sincronizado às ${lastSyncAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
  }
  function connectionState(){
    document.querySelector('.opsConnection')?.remove();
    if(navigator.onLine)return;
    const el=document.createElement('div');el.className='opsConnection';el.innerHTML='● SEM INTERNET — os dados podem não atualizar';document.body.appendChild(el);
  }
  window.addEventListener('online',()=>{connectionState();showAppToast('Internet restabelecida. Atualizando a central…','ok');safeRefresh()});
  window.addEventListener('offline',connectionState);connectionState();

  function exportOrdersCsv(){
    const rows=finalShiftOrders(),header=['Pedido','Data','Cliente','Telefone','Tipo','Bairro','Pagamento','Status','Subtotal','Entrega','Desconto','Total','Itens'];
    const lines=rows.map(o=>[o.order_number,new Date(o.created_at).toLocaleString('pt-BR'),o.customer_name,o.customer_phone,orderTypeLabel(o.type),o.neighborhood_name||'',paymentLabel(o.payment),statusName(o.status),Number(o.subtotal||0).toFixed(2),Number(o.delivery_fee||0).toFixed(2),Number(o.discount||0).toFixed(2),Number(o.total||0).toFixed(2),(o.order_items||[]).map(i=>`${i.quantity||1}x ${i.product_name||'Item'}`).join(' | ')].map(csvCell).join(';'));
    download(`caseirao-pedidos-${todayKey()}.csv`,[header.map(csvCell).join(';'),...lines].join('\n'),'text/csv;charset=utf-8');showAppToast('Relatório CSV gerado.','ok');
  }
  function backupOperational(){
    const payload={gerado_em:new Date().toISOString(),versao:finalBuild,settings:admin?.settings||{},orders:finalShiftOrders(),products:admin?.products||[],neighborhoods:admin?.neighborhoods||[],addons:admin?.addons||[],coupons:admin?.coupons||[]};
    download(`caseirao-backup-${todayKey()}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');showAppToast('Backup operacional gerado.','ok');
  }
  function productRanking(orders){
    const map=new Map();orders.filter(o=>o.status!=='cancelado').forEach(o=>(o.order_items||[]).forEach(i=>{const key=i.product_name||'Item';map.set(key,(map.get(key)||0)+Number(i.quantity||1))}));return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  }
  function shareShift(){
    const rows=finalShiftOrders().filter(o=>o.status!=='cancelado'),sales=rows.reduce((s,o)=>s+Number(o.total||0),0),done=rows.filter(o=>o.status==='entregue').length;
    const text=`Fechamento parcial • O Caseirão Burger\n${rows.length} pedidos • ${done} concluídos\nVendas: ${money(sales)}\nAtualizado: ${new Date().toLocaleString('pt-BR')}`;
    if(navigator.share)navigator.share({title:'Resumo do Caseirão',text}).catch(()=>{});else copyText(text).then(()=>showAppToast('Resumo copiado.','ok'));
  }
  async function safeRefresh(){
    if(!sessionStorage.getItem('caseirao_admin_pin')||!navigator.onLine)return;
    const label=document.querySelector('.opsSync');label?.classList.add('busy');if(label)label.textContent='Sincronizando…';
    try{admin=await adminCall('snapshot');lastSyncAt=new Date();renderAdmin()}catch(e){showAppToast('Não foi possível atualizar agora.','err')}finally{syncLabel()}
  }
  function renderCommandCenter(box){
    const all=finalShiftOrders(),valid=all.filter(o=>o.status!=='cancelado'),active=liveOrders(),sales=valid.reduce((s,o)=>s+Number(o.total||0),0),ticket=valid.length?sales/valid.length:0,late=active.filter(o=>minutes(o)>=35),ready=active.filter(o=>o.status==='pronto'),newOnes=active.filter(o=>['novo','confirmado'].includes(o.status));
    const types=['delivery','pickup','counter','local'].map(type=>({name:orderTypeLabel(type),value:valid.filter(o=>o.type===type).length})),maxType=Math.max(1,...types.map(x=>x.value));
    const pays=['Pix','Dinheiro','Cartão'].map(name=>({name,value:valid.filter(o=>String(o.payment||'').toLowerCase().includes(name.toLowerCase())).reduce((s,o)=>s+Number(o.total||0),0)})),maxPay=Math.max(1,...pays.map(x=>x.value));
    const queue=[...active].sort((a,b)=>(minutes(b)>=35)-(minutes(a)>=35)||new Date(a.created_at)-new Date(b.created_at)).slice(0,7),ranking=productRanking(valid);
    box.innerHTML=`<section class="commandHero"><div class="commandHeroTop"><div><h2>Visão geral do turno</h2><p>Decisões rápidas com os dados da operação de hoje</p></div><span class="commandLive">AO VIVO</span></div><div class="commandKpis"><div class="commandKpi"><span>VENDAS</span><b>${money(sales)}</b></div><div class="commandKpi"><span>PEDIDOS</span><b>${valid.length}</b></div><div class="commandKpi"><span>TICKET MÉDIO</span><b>${money(ticket)}</b></div><div class="commandKpi"><span>EM ANDAMENTO</span><b>${active.length}</b></div></div></section><div class="slaStrip"><div class="slaCard"><span>Novos</span><b>${newOnes.length}</b></div><div class="slaCard"><span>Prontos</span><b>${ready.length}</b></div><div class="slaCard ${late.length?'danger':''}"><span>Atrasados +35 min</span><b>${late.length}</b></div><div class="slaCard"><span>Cancelados</span><b>${all.filter(o=>o.status==='cancelado').length}</b></div></div><div class="commandGrid"><section class="commandPanel"><div class="commandPanelHead"><b>Fila por prioridade</b><small>MAIS URGENTES PRIMEIRO</small></div><div class="commandQueue">${queue.length?queue.map(o=>`<button class="commandOrder ${minutes(o)>=35?'critical':''}" data-command-order="${esc(o.id)}"><strong>#${esc(o.order_number)}</strong><div><strong>${esc(o.customer_name||'Cliente')}</strong><span>${esc(statusName(o.status))} • ${esc(orderTypeLabel(o.type))}</span></div><b class="commandAge">${minutes(o)} min</b></button>`).join(''):'<div class="commandEmpty">✓ Nenhum pedido aguardando. Operação em dia.</div>'}</div></section><section class="commandPanel"><div class="commandPanelHead"><b>Canais de venda</b><small>PEDIDOS</small></div><div class="commandBars">${types.map(x=>`<div><div class="commandBarTop"><span>${esc(x.name)}</span><b>${x.value}</b></div><div class="commandTrack"><div class="commandFill" style="width:${x.value/maxType*100}%"></div></div></div>`).join('')}</div><div class="commandPanelHead" style="margin-top:18px"><b>Recebimentos</b><small>VALOR</small></div><div class="commandBars">${pays.map(x=>`<div><div class="commandBarTop"><span>${x.name}</span><b>${money(x.value)}</b></div><div class="commandTrack"><div class="commandFill" style="width:${x.value/maxPay*100}%"></div></div></div>`).join('')}</div></section><section class="commandPanel"><div class="commandPanelHead"><b>Mais vendidos</b><small>UNIDADES</small></div>${ranking.length?ranking.map(([name,count],i)=>`<div class="commandRank"><i>${i+1}</i><b>${esc(name)}</b><strong>${count}</strong></div>`).join(''):'<div class="commandEmpty">O ranking aparecerá após as vendas.</div>'}</section><section class="commandPanel"><div class="commandPanelHead"><b>Ferramentas do turno</b><small>${esc(finalBuild)}</small></div><p class="mini">Exporte os pedidos para Excel, gere uma cópia de segurança ou compartilhe o resumo parcial.</p><div class="commandActions"><button data-export-csv>BAIXAR RELATÓRIO CSV</button><button data-backup-ops>GERAR BACKUP</button><button data-share-shift>COMPARTILHAR RESUMO</button></div></section></div>`;
    box.querySelectorAll('[data-command-order]').forEach(button=>button.onclick=()=>{adminTab='pedidos';renderAdmin();requestAnimationFrame(()=>{const target=[...document.querySelectorAll('[data-oid]')].find(x=>String(x.dataset.oid)===String(button.dataset.commandOrder))?.closest('details');if(target){target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'})}})});
    box.querySelector('[data-export-csv]')?.addEventListener('click',exportOrdersCsv);box.querySelector('[data-backup-ops]')?.addEventListener('click',backupOperational);box.querySelector('[data-share-shift]')?.addEventListener('click',shareShift);
  }
  function addOrderTools(box){
    const active=liveOrders(),ages=active.map(minutes),average=ages.length?Math.round(ages.reduce((a,b)=>a+b,0)/ages.length):0;
    const strip=document.createElement('div');strip.className='slaStrip';strip.innerHTML=`<div class="slaCard"><span>Fila ativa</span><b>${active.length}</b></div><div class="slaCard"><span>Espera média</span><b>${average} min</b></div><div class="slaCard ${active.some(o=>minutes(o)>=35)?'danger':''}"><span>Acima de 35 min</span><b>${active.filter(o=>minutes(o)>=35).length}</b></div><div class="slaCard"><span>Prontos / rota</span><b>${active.filter(o=>['pronto','em_rota'].includes(o.status)).length}</b></div>`;box.prepend(strip);
    const tools=document.createElement('div');tools.className='opsTools';tools.innerHTML='<button data-orders-export>⬇ EXPORTAR PEDIDOS DO TURNO</button><button data-orders-refresh>↻ SINCRONIZAR AGORA</button>';strip.after(tools);tools.querySelector('[data-orders-export]').onclick=exportOrdersCsv;tools.querySelector('[data-orders-refresh]').onclick=safeRefresh;
    finalShiftOrders().forEach(o=>{const marker=box.querySelector(`[data-oid="${CSS.escape(String(o.id))}"]`),card=marker?.closest('.orderDetailed');if(!card)return;const summary=card.querySelector('.summaryCustomer')||card.querySelector('.ordertop>div');if(summary&&!summary.querySelector('.opsSlaBadge')){const age=minutes(o),badge=document.createElement('span');badge.className=`opsSlaBadge ${['entregue','cancelado'].includes(o.status)?'ok':age>=35?'late':age>=25?'warn':''}`;badge.textContent=['entregue','cancelado'].includes(o.status)?statusName(o.status):`${age} min de espera`;summary.appendChild(badge)}const body=card.querySelector('.orderBody')||card;if(body&&!body.querySelector('.opsContactRow')){const row=document.createElement('div');row.className='opsContactRow';const phone=String(o.customer_phone||'').replace(/\D/g,'');row.innerHTML=`${phone?`<a href="https://wa.me/55${esc(phone.replace(/^55/,''))}" target="_blank" rel="noopener">WHATSAPP DO CLIENTE</a>`:'<button disabled>SEM TELEFONE</button>'}<button data-copy-order="${esc(o.id)}">COPIAR RESUMO</button>`;body.appendChild(row);row.querySelector('[data-copy-order]')?.addEventListener('click',()=>copyText(receiptPlain(o)).then(()=>showAppToast('Resumo do pedido copiado.','ok')))}});
  }

  const adminBase=renderAdmin;
  renderAdmin=function(){const result=adminBase();const bar=document.querySelector('.sheet.full>.admbar');if(bar&&!bar.querySelector('[data-tab="visao"]')){const button=document.createElement('button');button.dataset.tab='visao';button.textContent='Visão geral';button.className=adminTab==='visao'?'on':'';button.onclick=()=>{adminTab='visao';renderAdmin()};bar.prepend(button)}if(adminTab==='visao'){const box=$('#admContent');if(box)renderCommandCenter(box)}syncLabel();return result};
  const tabBase=renderAdminTab;
  renderAdminTab=function(){if(adminTab==='visao'){const box=$('#admContent');if(box)renderCommandCenter(box);return}return tabBase()};
  const ordersBase=renderOrders;
  renderOrders=function(box){const result=ordersBase(box);addOrderTools(box);return result};

  const adminCallBase=adminCall;
  adminCall=async function(...args){const value=await adminCallBase(...args);lastSyncAt=new Date();queueMicrotask(syncLabel);return value};
  clearInterval(syncTimer);syncTimer=setInterval(()=>{if(document.visibilityState==='visible'&&sessionStorage.getItem('caseirao_admin_pin'))syncLabel()},1000);
  const validTabsFinal=new Set(['visao','pedidos','producao','caixa','gestao','fidelidade','relatorios','produtos','bairros','adicionais','cupons','banner','loja','mesas','funcionarios','promocoes','entregas']);
  try{const area=sessionStorage.getItem(internalResumeKey)||'';if(area.startsWith('admin:')&&!validTabsFinal.has(area.slice(6)))sessionStorage.setItem(internalResumeKey,'admin:pedidos')}catch{}
})();

/* Filtra os cartões sem reconstruir o campo e sem fechar o teclado. */
document.addEventListener('input',event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||input.id!=='loyaltySearch')return;
  event.stopImmediatePropagation();
  const term=input.value.trim().toLocaleLowerCase('pt-BR');
  const root=input.closest('#admContent')||document;
  root.querySelectorAll('.loyaltyCard').forEach(card=>{
    if(card.querySelector('#loyaltyTarget'))return;
    card.classList.toggle('hide',Boolean(term)&&!card.textContent.toLocaleLowerCase('pt-BR').includes(term));
  });
},true);

(()=>{
  const phone=value=>typeof phoneMask==='function'?phoneMask(value):String(value||'');
  async function openLoyaltyParticipants(){
    document.querySelector('.loyaltyParticipantsLayer')?.remove();
    const layer=document.createElement('div');layer.className='loyaltyParticipantsLayer';
    layer.innerHTML='<section class="loyaltyParticipantsPanel"><div class="loyaltyParticipantsHead"><div><h2>Clientes participantes</h2><p>Nome, WhatsApp e quantidade contabilizada</p></div><button class="loyaltyParticipantsClose" aria-label="Fechar">×</button></div><div class="notice">Carregando participantes...</div></section>';
    document.body.appendChild(layer);layer.querySelector('.loyaltyParticipantsClose').onclick=()=>layer.remove();layer.onclick=event=>{if(event.target===layer)layer.remove()};
    try{
      const result=await loyaltyAdmin('snapshot'),customers=(result.customers||[]).slice().sort((a,b)=>Number(b.order_count||0)-Number(a.order_count||0));
      const panel=layer.querySelector('.loyaltyParticipantsPanel');
      panel.innerHTML=`<div class="loyaltyParticipantsHead"><div><h2>Clientes participantes</h2><p>${customers.length} clientes participando da fidelidade</p></div><button class="loyaltyParticipantsClose" aria-label="Fechar">×</button></div><input class="loyaltyParticipantsSearch" placeholder="Buscar nome ou WhatsApp..." autocomplete="off"><div class="loyaltyParticipantsList">${customers.map(customer=>{const name=String(customer.display_name||customer.name||'Cliente sem nome').trim(),number=String(customer.phone||''),count=Number(customer.order_count||0),search=`${name} ${number}`.toLocaleLowerCase('pt-BR');return `<article class="loyaltyParticipant" data-participant data-search="${esc(search)}"><div><strong>${esc(name)}</strong><span>${esc(phone(number))}</span></div><div class="loyaltyParticipantCount"><b>${count}</b><small>${count===1?'pedido':'pedidos'}</small></div></article>`}).join('')||'<div class="loyaltyParticipantsEmpty">Nenhum cliente participante.</div>'}</div>`;
      panel.querySelector('.loyaltyParticipantsClose').onclick=()=>layer.remove();
      panel.querySelector('.loyaltyParticipantsSearch').addEventListener('input',event=>{const term=event.target.value.trim().toLocaleLowerCase('pt-BR');panel.querySelectorAll('[data-participant]').forEach(card=>card.classList.toggle('hide',Boolean(term)&&!card.dataset.search.includes(term)))});
    }catch(error){layer.querySelector('.loyaltyParticipantsPanel').innerHTML=`<div class="loyaltyParticipantsHead"><div><h2>Clientes participantes</h2><p>Não foi possível carregar agora</p></div><button class="loyaltyParticipantsClose">×</button></div><div class="err">${esc(error.message||String(error))}</div>`;layer.querySelector('.loyaltyParticipantsClose').onclick=()=>layer.remove()}
  }
  const mountButton=()=>{if(typeof adminTab==='undefined'||adminTab!=='fidelidade')return;const box=document.querySelector('#admContent');if(!box||box.querySelector('.loyaltyParticipantsButton'))return;const button=document.createElement('button');button.type='button';button.className='loyaltyParticipantsButton';button.textContent='👥 VER CLIENTES PARTICIPANTES';button.onclick=openLoyaltyParticipants;box.prepend(button)};
  /* Sem observer global e sem timer duplicado. */
  queueMicrotask(mountButton);
})();

/* Mantém a aba ativa visível e alinhada ao conteúdo selecionado. */
(()=>{
  let requestedTab='';
  function centerActiveAdminTab(smooth=false){
    const bar=document.querySelector('.sheet.full>.admbar');
    if(!bar)return;
    const active=(requestedTab&&bar.querySelector(`[data-tab="${CSS.escape(requestedTab)}"]`))||bar.querySelector('button.on');
    if(!active)return;
    bar.querySelectorAll('button[data-tab]').forEach(button=>button.classList.toggle('on',button===active));
    const left=Math.max(0,active.offsetLeft-(bar.clientWidth-active.offsetWidth)/2);
    bar.scrollTo({left,behavior:smooth?'smooth':'auto'});
    requestedTab=active.dataset.tab||requestedTab;
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.sheet.full>.admbar button[data-tab]');
    if(!button)return;
    requestedTab=button.dataset.tab||'';
    setTimeout(()=>centerActiveAdminTab(true),20);
    setTimeout(()=>centerActiveAdminTab(false),140);
  },true);
  /* Sem observar document.body a cada reconstrução do ADM. */
  window.addEventListener('resize',()=>centerActiveAdminTab(false));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)centerActiveAdminTab(false)});
})();



/* Central do entregador — contraste e troca rápida de pagamento */
(()=>{const style=document.createElement('style');style.textContent=`
.driverScreenNew{color:#15191e!important}.driverScreenNew .driverDaySummary{background:#fff!important;border:1px solid #d7dce1!important;box-shadow:0 5px 18px rgba(20,24,28,.07)!important}.driverScreenNew .driverDaySummary h3,.driverScreenNew .driverDaySummary strong{color:#1b2026!important}.driverScreenNew .mini{color:#59616a!important}.driverOrder{border-color:#cfd5db!important;box-shadow:0 7px 22px rgba(25,30,36,.09)!important}.driverOrder h3{color:#171b20!important}.driverQuickChip{background:#eef1f4!important;border-color:#d3d8de!important;color:#242a31!important}.driverStatus{color:#9a3d13!important}.driverInfoBlock{background:#f4f6f8!important;border:1px solid #d7dce1!important}.driverInfoBlock small{color:#5d6670!important}.driverInfoBlock strong{color:#151a20!important}.driverReference{color:#4e5862!important}.driverPaymentBlock{border:2px solid #d8a07d!important;background:#fff8f3!important}.driverChangePaymentBtn{width:100%;margin-top:10px;min-height:42px;border:1px solid #b94d19;border-radius:11px;background:#fff;color:#a13d10;font-weight:900}.driverPaymentChooser{display:grid;gap:10px;margin-top:10px}.driverPaymentOption{display:grid;grid-template-columns:42px 1fr auto;align-items:center;text-align:left;gap:10px;min-height:64px;padding:11px 13px;border:1px solid #d5dbe1;border-radius:14px;background:#fff;color:#1b2026}.driverPaymentOption>span{font-size:23px}.driverPaymentOption>b{font-size:16px}.driverPaymentOption small{font-size:9px;font-weight:900;color:#a13d10}.driverPaymentOption.selected{border:2px solid #b94d19;background:#fff5ee}
`;document.head.appendChild(style)})();
