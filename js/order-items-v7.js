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
    const subtotal = () => products.reduce((sum, p) => {
      const id = String(p.id), q = quantities.get(id) || 0;
      const addonTotal = allowedAddons(id).filter(a => (extras.get(id) || new Set()).has(String(a.id)))
        .reduce((a, b) => a + Number(b.price || 0), 0);
      return sum + q * (priceOf(p) + addonTotal);
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
      <div class="employeeCatalog">${operationalCatalogHtml(products)}</div>
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
  renderOrders = function (box) {
    const result = oldRenderOrders(box);
    decorateOrderCards(box);
    // O filtro e a busca refazem as listas sem chamar renderOrders: observar mudanças
    // preserva a ação "Adicionar itens" mesmo após pesquisar/filtrar pedidos.
    if (box && !box.caseiraoOrdersObserver) {
      box.caseiraoOrdersObserver = new MutationObserver(() => decorateOrderCards(box));
      box.caseiraoOrdersObserver.observe(box, { childList: true, subtree: true });
    }
    return result;
  };

  const oldEligibleForAutoPrint = typeof eligibleForAutoPrint === 'function' ? eligibleForAutoPrint : null;
  if (oldEligibleForAutoPrint) eligibleForAutoPrint = o =>
    Number(o?.additional_payment_due || 0) <= 0 && oldEligibleForAutoPrint(o);
})();
