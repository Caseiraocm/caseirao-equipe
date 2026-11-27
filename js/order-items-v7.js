'use strict';
/* Caseirão 7.0 • Acrescentar produtos ao pedido original sem recriar a comanda.
   O servidor calcula preços, preserva adicionais existentes e registra auditoria. */
(() => {
  const oldPaymentCheck = orderPaymentConfirmed;
  orderPaymentConfirmed = function (o) {
    return oldPaymentCheck(o) && Math.round(Number(o?.additional_payment_due || 0) * 100) === 0;
  };

  async function updateOrderItems(action, order, items = [], requestId = crypto.randomUUID()) {
    const pin = sessionStorage.getItem('caseirao_admin_pin') || '';
    if (!pin) throw new Error('Faça login na Central ADM antes de editar pedidos.');
    return api('caseirao-order-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, action, order_id: order.id, request_id: requestId, items })
    });
  }
  const availableProducts = () => (admin?.products || data.products || [])
    .filter(p => p.active !== false && !p.sold_out);
  const allowedAddons = productId => {
    const links = admin?.product_addons || data.product_addons || [];
    const permitted = new Set(links.filter(x => String(x.product_id) === String(productId)).map(x => String(x.addon_id)));
    return (admin?.addons || data.addons || []).filter(x => permitted.has(String(x.id)) && x.active !== false && !x.sold_out);
  };
  function orderLabel(order) {
    return order.table_number ? 'Mesa ' + String(order.table_number).padStart(2, '0')
      : order.type === 'delivery' ? 'Entrega' : order.type === 'pickup' ? 'Retirada'
      : order.type === 'counter' ? 'Balcão' : 'Consumo no local';
  }
  const payExtraNotice = order => String(order.payment || '').toLowerCase() === 'pix'
    ? '<div class="caseiraoNewPixNotice"><b>Complemento Pix</b><span>Itens adicionados depois da geração do Pix não entram no QR Code antigo. Cobre a diferença separadamente e confirme o recebimento na Central apenas depois de conferir o comprovante.</span></div>' : '';

  function openOrderItems(order) {
    if (!order || ['cancelado', 'entregue'].includes(String(order.status))) return alert('Esse pedido já foi finalizado.');
    const products = availableProducts();
    if (!products.length) return alert('Nenhum produto disponível para acrescentar.');
    const quantities = new Map(), notes = new Map(), extras = new Map();
    const productPrice = order.source === 'manual' ? counterPriceOf : priceOf;
    const subtotal = () => products.reduce((sum, p) => {
      const id = String(p.id), q = quantities.get(id) || 0;
      const addonTotal = allowedAddons(id).filter(a => (extras.get(id) || new Set()).has(String(a.id)))
        .reduce((a, b) => a + Number(b.price || 0), 0);
      return sum + q * (productPrice(p) + addonTotal);
    }, 0);
    const show = () => {
      const n = subtotal();
      if ($('#caseiraoExtraTotal')) $('#caseiraoExtraTotal').textContent = fmt(n);
      if ($('#caseiraoUpdatedTotal')) $('#caseiraoUpdatedTotal').textContent = fmt(Number(order.total || 0) + n);
    };
    modal(`<div class="sheeth"><div><h2>+ Adicionar itens • #${esc(order.order_number)}</h2><div class="adminSub">${esc(orderLabel(order))} • mesma comanda</div></div><button class="x" id="caseiraoBackToOrders" aria-label="Voltar">×</button></div>
      <div class="caseiraoAddHint"><b>Pedido original: ${fmt(order.total)}</b><br>Escolha os novos produtos. Os itens já cadastrados, os adicionais e os descontos do pedido serão preservados.</div>
      ${payExtraNotice(order)}
      <div class="employeeProductSearch"><span>⌕</span><input id="caseiraoItemSearch" class="in" placeholder="Buscar produto, bebida ou combo…"></div>
      <div class="employeeCatalog">${operationalCatalogHtml(products, productPrice)}</div>
      <div class="caseiraoAddSummary"><span>Valor a acrescentar <b id="caseiraoExtraTotal">${fmt(0)}</b></span><span>Novo total do pedido <b id="caseiraoUpdatedTotal">${fmt(order.total)}</b></span></div>
      <div class="manualFooter"><button id="caseiraoSaveExtra" class="primary">CONFIRMAR NOVOS ITENS</button></div>`, true);
    $('#caseiraoBackToOrders').onclick = () => renderAdmin();
    $('#caseiraoItemSearch').oninput = e => filterOperationalCatalog(e.target.value);
    products.forEach(p => {
      const id = String(p.id), card = document.querySelector(`[data-rqty="${CSS.escape(id)}"]`)?.closest('.employeeProductCard');
      const addons = allowedAddons(id);
      if (!card || !addons.length) return;
      card.insertAdjacentHTML('beforeend', `<div class="caseiraoEditAddons" data-extra-for="${esc(id)}"><b>ADICIONAIS (por unidade)</b>${addons.map(a => `<label><input type="checkbox" data-extra-product="${esc(id)}" value="${esc(a.id)}"><span>${esc(a.name)}</span><strong>+ ${fmt(a.price)}</strong></label>`).join('')}</div>`);
    });
    document.querySelectorAll('[data-rproduct]').forEach(button => button.onclick = () => {
      const id = String(button.dataset.rproduct), p = products.find(x => String(x.id) === id);
      const q = Math.max(0, Math.min(50, (quantities.get(id) || 0) + Number(button.dataset.d)));
      quantities.set(id, q);
      const counter = document.querySelector(`[data-rqty="${CSS.escape(id)}"]`);
      if (counter) {
        counter.textContent = q;
        counter.closest('.employeeProductCard')?.classList.toggle('selected', q > 0);
        counter.closest('.employeeProductCard')?.querySelector('.caseiraoEditAddons')?.classList.toggle('visible', q > 0);
      }
      renderUnitNotes(id, p?.name || 'Produto', q, notes);
      show();
    });
    document.querySelectorAll('[data-extra-product]').forEach(input => input.onchange = () => {
      const id = String(input.dataset.extraProduct), set = extras.get(id) || new Set();
      if (input.checked) {
        if (set.size >= 10) { input.checked = false; return alert('Máximo de 10 adicionais por produto.'); }
        set.add(String(input.value));
      } else set.delete(String(input.value));
      extras.set(id, set);
      show();
    });
    const save = $('#caseiraoSaveExtra');
    const requestId = crypto.randomUUID(); // Reutilizado em tentativas para evitar duplicação.
    save.onclick = async () => {
      const items = [];
      products.forEach(p => {
        const id = String(p.id), q = quantities.get(id) || 0;
        const itemNotes = notes.get(id) || [], addon_ids = [...(extras.get(id) || new Set())];
        for (let i = 0; i < q; i++) items.push({ product_id: p.id, qty: 1, addon_ids, note: String(itemNotes[i] || '').trim() });
      });
      if (!items.length) return alert('Selecione pelo menos um produto.');
      if (items.length > 60) return alert('Acrescente até 60 unidades de cada vez.');
      try {
        save.disabled = true; save.textContent = 'SALVANDO NA COMANDA…';
        const result = await updateOrderItems('append', order, items, requestId);
        admin = await adminCall('snapshot', {}, false);
        adminTab = 'pedidos'; renderAdmin();
        showAppToast(`Pedido #${order.order_number}: +${fmt(result.added || 0)}. Novo total ${fmt(result.total)}.`, 'ok');
        if (Number(result.additional_payment_due || 0) > 0)
          alert(`Novos itens adicionados. Falta receber ${fmt(result.additional_payment_due)} do complemento Pix. Confirme o recebimento na Central após conferir o comprovante.`);
      } catch (error) {
        alert(error.message || String(error));
        save.disabled = false; save.textContent = 'TENTAR SALVAR NOVAMENTE';
      }
    };
  }


  function reducedTotals(order,quantities){
    const sub=(order.order_items||[]).reduce((sum,item)=>sum+Math.round(Math.round(Number(item.line_total||0)*100)*(quantities.get(String(item.id))||0)/Number(item.quantity)),0);
    const cents=n=>Math.round(Number(n||0)*100);
    const discount=Math.min(cents(order.discount),sub),fee=cents(order.delivery_fee),deliveryDiscount=cents(order.delivery_discount);
    const cashback=Math.min(cents(order.cashback_used),Math.max(0,sub-discount+fee-deliveryDiscount));
    const total=Math.max(0,sub-discount+fee-deliveryDiscount-cashback),reduced=cents(order.total)-total;
    return {subtotal:sub/100,discount:discount/100,cashback:cashback/100,total:total/100,
      refund:order.payment_status==='confirmed'?Math.max(0,reduced-cents(order.additional_payment_due))/100:0,
      cashbackReturned:(cents(order.cashback_used)-cashback)/100};
  }
  const reduceStorage=id=>'caseirao_reduce_items_'+id;
  async function itemRequest(body){
    return api('caseirao-order-items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      ...body,pin:sessionStorage.getItem('caseirao_admin_pin')||''
    })});
  }
  function openReduceItems(order){
    if(!order||order.archived_at||['cancelado','entregue'].includes(order.status))return showAppToast('Este pedido já foi finalizado.','err');
    const items=order.order_items||[],quantities=new Map(items.map(i=>[String(i.id),Number(i.quantity)]));
    let attempt=null,busy=false,finished=false;
    try{attempt=JSON.parse(sessionStorage.getItem(reduceStorage(order.id))||'null')}catch{}
    if(attempt)for(const item of attempt.items)quantities.set(String(item.item_id),Number(item.qty));
    modal(`<div class="sheeth"><div><h2>Editar itens · #${esc(order.order_number)}</h2><div class="adminSub">Diminuir quantidade ou remover da comanda</div></div><button class="x" id="backReduceItems" aria-label="Voltar">×</button></div>
      <p class="caseiraoAddHint">Os preços e adicionais originais são preservados. Descontos já concedidos são mantidos até o limite do novo valor; o frete permanece. Para acrescentar produtos, use “Adicionar itens”.</p>
      <div class="caseiraoReduceList">${items.map((i,index)=>`<article class="caseiraoReduceRow" data-reduce-row="${index}"><div><b>${esc(i.product_name)}</b><small>${(i.order_item_addons||[]).map(a=>'+ '+esc(a.addon_name)).join(' · ')}${i.note?'<br>Obs.: '+esc(i.note):''}</small><strong data-reduce-price="${index}">${fmt(i.line_total)}</strong></div><div class="caseiraoReduceControls"><button type="button" data-reduce-step="-1" data-index="${index}" aria-label="Diminuir ${esc(i.product_name)}">−</button><b data-reduce-qty="${index}">${Number(i.quantity)}</b><button type="button" data-reduce-step="1" data-index="${index}" aria-label="Restaurar unidade de ${esc(i.product_name)}">+</button><button type="button" data-reduce-remove="${index}" class="caseiraoRemoveLine">Remover</button></div></article>`).join('')}</div>
      <div class="caseiraoAddSummary"><span>Total anterior <b>${fmt(order.total)}</b></span><span>Novo total <b id="reducedOrderTotal"></b></span><span>Redução <b id="reducedOrderDifference"></b></span></div>
      <div id="reducedRefundNotice" class="caseiraoNewPixNotice" hidden></div><div id="reduceFeedback" role="status"></div>
      <button type="button" id="saveReducedItems" class="primary">SALVAR ALTERAÇÕES</button>`,true);
    const root=$('#saveReducedItems').closest('.sheet'),save=$('#saveReducedItems');
    const controls=root.querySelectorAll('[data-reduce-step],[data-reduce-remove]');
    const feedback=$('#reduceFeedback');
    const draw=()=>{
      const totals=reducedTotals(order,quantities),changed=items.some(i=>quantities.get(String(i.id))!==Number(i.quantity)),remaining=[...quantities.values()].reduce((a,b)=>a+b,0);
      $('#reducedOrderTotal').textContent=fmt(totals.total);
      $('#reducedOrderDifference').textContent=fmt(Number(order.total)-totals.total);
      items.forEach((i,index)=>{
        const q=quantities.get(String(i.id))||0;
        root.querySelector('[data-reduce-qty="'+index+'"]').textContent=q;
        root.querySelector('[data-reduce-price="'+index+'"]').textContent=q?fmt(Math.round(Number(i.line_total)*100*q/Number(i.quantity))/100):'Será removido';
        root.querySelector('[data-reduce-row="'+index+'"]').classList.toggle('removed',q===0);
      });
      const notice=$('#reducedRefundNotice'),parts=[];
      if(totals.refund>0)parts.push('Pagamento já confirmado: '+fmt(totals.refund)+' a devolver ao cliente. O sistema não faz estorno automático.');
      if(totals.cashbackReturned>0)parts.push(fmt(totals.cashbackReturned)+' de cashback será devolvido ao saldo do cliente.');
      notice.hidden=!parts.length;notice.textContent=parts.join(' ');
      controls.forEach(b=>{
        const index=Number(b.dataset.index??b.dataset.reduceRemove),q=quantities.get(String(items[index].id))||0;
        b.disabled=busy||!!attempt||finished||(b.dataset.reduceStep==='1'?q>=Number(items[index].quantity):q===0);
      });
      save.disabled=busy||finished||(!attempt&&(!changed||remaining===0));
      save.textContent=finished?'ALTERAÇÃO SALVA':busy?'SALVANDO…':attempt?'CONFERIR ALTERAÇÃO ANTERIOR':'SALVAR ALTERAÇÕES';
      if(!remaining&&!attempt)feedback.textContent='Para remover todos os itens, use Cancelar pedido.';
    };
    $('#backReduceItems').onclick=()=>{if(!busy)renderAdmin()};
    controls.forEach(button=>button.onclick=()=>{
      const index=Number(button.dataset.index??button.dataset.reduceRemove),item=items[index],id=String(item.id);
      quantities.set(id,button.hasAttribute('data-reduce-remove')?0:Math.max(0,Math.min(Number(item.quantity),(quantities.get(id)||0)+Number(button.dataset.reduceStep))));
      feedback.textContent='';draw();
    });
    save.onclick=async()=>{
      if(busy||finished)return;
      if(!attempt){
        attempt={action:'reduce',order_id:order.id,request_id:crypto.randomUUID(),expected_updated_at:order.updated_at,
          items:items.map(i=>({item_id:i.id,qty:quantities.get(String(i.id))||0}))};
        try{sessionStorage.setItem(reduceStorage(order.id),JSON.stringify(attempt))}catch{attempt=null;feedback.textContent='Não foi possível preservar esta tentativa. Verifique o armazenamento do navegador.';return}
      }
      busy=true;draw();feedback.textContent='';
      let result;
      try{result=await itemRequest(attempt)}
      catch(error){
        busy=false;
        if(error.httpStatus&&error.httpStatus<500){sessionStorage.removeItem(reduceStorage(order.id));attempt=null}
        feedback.textContent=(error.message||String(error))+(!attempt?'':' Use “Conferir alteração anterior” para consultar a mesma tentativa sem repetir a redução.');
        draw();return;
      }
      sessionStorage.removeItem(reduceStorage(order.id));finished=true;busy=false;draw();
      try{
        admin=await adminCall('snapshot',{},false);renderAdmin();
        showAppToast('Itens atualizados. Novo total: '+fmt(result.total)+(Number(result.item_refund_due)>0?' · Devolver '+fmt(result.item_refund_due)+' ao cliente.':''),'ok');
      }catch{
        feedback.textContent='Alteração SALVA. Novo total '+fmt(result.total)+'. Volte à Central e use Atualizar para renovar a lista.';
      }
    };
    draw();
  }
  async function acknowledgeRefund(order){
    const amount=Number(order.item_refund_due||0);
    if(!amount||!confirm('Você já devolveu '+fmt(amount)+' ao cliente do pedido #'+order.order_number+'? Confirme somente depois de conferir a devolução. Este botão apenas registra o estorno já realizado.'))return;
    try{
      await itemRequest({action:'ack_refund',order_id:order.id,request_id:crypto.randomUUID(),expected_refund:amount});
      admin=await adminCall('snapshot',{},false);renderAdmin();showAppToast('Devolução registrada.','ok');
    }catch(e){showAppToast(e.message||String(e),'err')}
  }

  async function settleExtra(order) {
    const due = Number(order.additional_payment_due || 0);
    if (!due) return;
    if (!confirm(`Você conferiu o comprovante do Pix adicional de ${fmt(due)} do pedido #${order.order_number}?\n\nSó confirme se esse valor realmente entrou na conta.`)) return;
    try {
      await updateOrderItems('settle_extra', order);
      admin = await adminCall('snapshot', {}, false);
      adminTab = 'pedidos'; renderAdmin();
      showAppToast('Complemento Pix registrado no pedido #' + order.order_number, 'ok');
    } catch (error) { alert(error.message || String(error)); }
  }

  const oldRenderOrders = renderOrders;
  const decorateOrderCards = box => {
    if (!box?.isConnected) return;
    (admin?.orders || []).filter(o => !o.archived_at && !['entregue', 'cancelado'].includes(String(o.status))).forEach(order => {
      const marker = box.querySelector(`[data-oid="${CSS.escape(String(order.id))}"]`), card = marker?.closest('.orderDetailed');
      if (!card) return;
      let button = card.querySelector('.caseiraoAddToOrder');
      if (!button) {
        button = document.createElement('button'); button.type = 'button';
        button.className = 'caseiraoAddToOrder';
        card.querySelector('.orderSummary')?.insertAdjacentElement('afterend', button);
      }
      if (button.textContent !== '+ ADICIONAR ITENS AO PEDIDO')
        button.textContent = '+ ADICIONAR ITENS AO PEDIDO';
      button.onclick = () => openOrderItems(order);
      let edit=card.querySelector('.caseiraoReduceOrder');
      if(!edit){edit=document.createElement('button');edit.type='button';edit.className='caseiraoReduceOrder';edit.textContent='✎ EDITAR / REMOVER ITENS';button.insertAdjacentElement('afterend',edit)}
      edit.onclick=()=>openReduceItems(order);
      const due = Number(order.additional_payment_due || 0);
      if (due > 0) {
        if (!card.querySelector('.caseiraoPixExtraPending')) {
          const warning = document.createElement('div'); warning.className = 'caseiraoPixExtraPending';
          warning.innerHTML = `<b>COMPLEMENTO PIX PENDENTE: ${fmt(due)}</b><span>Valor adicional não coberto pelo Pix original.</span>`;
          const pay = document.createElement('button'); pay.type = 'button';
          pay.className = 'caseiraoSettleExtra'; pay.textContent = '✓ CONFIRMAR RECEBIMENTO DO COMPLEMENTO';
          pay.onclick = () => settleExtra(order); warning.appendChild(pay);
          button.insertAdjacentElement('afterend', warning);
        }
        card.querySelectorAll('[data-st]').forEach(el => { if (!['novo', 'cancelado'].includes(el.dataset.st)) el.disabled = true; });
        card.querySelectorAll('[data-webprint],[data-btprint]').forEach(el => el.disabled = true);
      }
    });
  };
  const decorateRefunds=box=>{
    (admin?.orders||[]).filter(o=>Number(o.item_refund_due)>0).forEach(order=>{
      const marker=box?.querySelector('[data-oid="'+CSS.escape(String(order.id))+'"]'),card=marker?.closest('.orderDetailed');
      if(!card)return;
      let notice=card.querySelector('.caseiraoItemRefund');
      if(!notice){notice=document.createElement('div');notice.className='caseiraoItemRefund caseiraoPixExtraPending';card.querySelector('.orderSummary')?.insertAdjacentElement('afterend',notice)}
      const label='DEVOLUÇÃO PENDENTE: '+fmt(order.item_refund_due);
      if(notice.querySelector('b')?.textContent!==label){notice.innerHTML='<b>'+esc(label)+'</b><span>Itens reduzidos após o pagamento. Devolva a diferença ao cliente.</span><button type="button" class="caseiraoSettleExtra">CONFIRMAR DEVOLUÇÃO REALIZADA</button>';}
      notice.querySelector('button').onclick=()=>acknowledgeRefund(order);
    });
  };
  renderOrders = function (box) {
    const result = oldRenderOrders(box);
    decorateOrderCards(box);decorateRefunds(box);
    // O filtro e a busca refazem as listas sem chamar renderOrders: observar mudanças
    // preserva a ação "Adicionar itens" mesmo após pesquisar/filtrar pedidos.
    if (box && !box.caseiraoOrdersObserver) {
      box.caseiraoOrdersObserver = new MutationObserver(() => {decorateOrderCards(box);decorateRefunds(box)});
      box.caseiraoOrdersObserver.observe(box, { childList: true, subtree: true });
    }
    return result;
  };

  const oldEligibleForAutoPrint = typeof eligibleForAutoPrint === 'function' ? eligibleForAutoPrint : null;
  if (oldEligibleForAutoPrint) eligibleForAutoPrint = o =>
    Number(o?.additional_payment_due || 0) <= 0 && oldEligibleForAutoPrint(o);
})();
