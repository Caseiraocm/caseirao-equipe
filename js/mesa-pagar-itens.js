'use strict';

(() => {
  const money = cents => fmt(Number(cents) / 100);
  function paymentRequestId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
  }

  // Keep the array accepted by older installations. Newer SQL also checks the full balance.
  function fullPaymentItems(items) {
    return items.map((item, index) => index === 0 ? { ...item, close_all: true } : item);
  }

  async function withResponseTimeout(request) {
    let timeout;
    try {
      return await Promise.race([request, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('O caixa demorou a responder.')), 15000);
      })]);
    } finally {
      clearTimeout(timeout);
    }
  }
  const consumed = session => (session.orders || [])
    .filter(order => order.status !== 'cancelado')
    .reduce((sum, order) => sum + Math.round(Number(order.total || 0) * 100), 0);
  const received = session => (session.table_item_payments || [])
    .reduce((sum, payment) => sum + Number(payment.amount_cents), 0);

  remoteSessionTotal = session => Math.max(0, consumed(session) - received(session)) / 100;
  const originalOrdersHtml = remoteOrdersHtml;
  remoteOrdersHtml = function (session) {
    if (!session.table_item_payments?.length) return originalOrdersHtml(session);
    const paid = new Map();
    for (const payment of session.table_item_payments) {
      for (const item of payment.items || []) {
        paid.set(item.item_id, (paid.get(item.item_id) || 0) + Number(item.qty));
      }
    }
    const orders = (session.orders || []).filter(order => order.status !== 'cancelado');
    return `<div class="itemPaymentSummary">
      <span>Consumo <b>${money(consumed(session))}</b></span>
      <span>Recebido <b class="green">${money(received(session))}</b></span>
      <span>Falta pagar <b>${fmt(remoteSessionTotal(session))}</b></span>
    </div>` + orders.map(order => `<div class="tableOrder">
      ${(order.order_items || []).map(item => {
        const paidQuantity = paid.get(item.id) || 0;
        return `<div class="tableItemLine"><span>${Number(item.quantity)}× ${esc(item.product_name)}
          ${item.note ? '<small>' + esc(item.note) + '</small>' : ''}
          <small class="${paidQuantity ? 'green' : ''}">${paidQuantity ? paidQuantity + ' PAGO · ' : ''}${Number(item.quantity) - paidQuantity} em aberto</small>
        </span><b>${fmt(item.line_total)}</b></div>`;
      }).join('')}
    </div>`).join('');
  };

  const paths = {
    pedidos: 'M6 3h8l4 4v14H6z M14 3v5h5 M9 12h6 M9 16h6',
    mesas: 'M3 6h18v7H3z M6 13l-2 7 M18 13l2 7',
    producao: 'M6 14a4 4 0 1 1 2-7 4 4 0 0 1 8 0 4 4 0 1 1 2 7v6H6z M6 17h12',
    entregas: 'M3 15h4l2-6h5l2 6h5 M14 6h3l3 8 M7 9H4 M8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M22 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    caixa: 'M5 10h14l3 10H2z M8 10V4h8v6 M8 14h8 M6 17h12',
    pix: 'M11 3a1.5 1.5 0 0 1 2 0l8 8a1.5 1.5 0 0 1 0 2l-8 8a1.5 1.5 0 0 1-2 0l-8-8a1.5 1.5 0 0 1 0-2z M6 8h2l3 3a1.4 1.4 0 0 0 2 0l3-3h2 M6 16h2l3-3a1.4 1.4 0 0 1 2 0l3 3h2',
    dinheiro: 'M2 5h20v14H2z M2 9a4 4 0 0 0 4-4 M18 5a4 4 0 0 0 4 4 M2 15a4 4 0 0 1 4 4 M18 19a4 4 0 0 1 4-4 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    cartao: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M2 10h20',
    check: 'm5 12 4 4L19 6'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
  const tabs = [['pedidos', 'Pedidos'], ['mesas', 'Mesas'], ['producao', 'Produção'], ['entregas', 'Entregas'], ['caixa', 'Caixa']];
  const methods = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao', 'Cartão']];

  openRemoteClose = (table, session) => openCheckoutForTable(table, session, true);
  openEmployeeClose = (table, session) => openCheckoutForTable(table, session, false);

  async function openCheckoutForTable(table, session, adminMode) {
    const name = 'Mesa ' + String(table.table_number).padStart(2, '0');
    const storageKey = 'caseirao_item_payment_' + session.id;
    let balance, busy = false, pending = null, closed = false, reloadError = '';

    try {
      pending = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    } catch {
      pending = null;
    }

    function clearPending() {
      pending = null;
      try { sessionStorage.removeItem(storageKey); } catch {}
    }

    modal(`<div class="tableCheckout">
      <aside class="tableCheckoutNav">
        <div class="tableCheckoutBrand"><span>CB</span><div><strong>Caseirão Burger</strong><small>${adminMode ? 'Central ADM' : 'Atendimento'}</small></div></div>
        <nav aria-label="Central">
          ${(adminMode ? tabs : tabs.filter(([tab]) => tab === 'mesas')).map(([tab, label]) =>
            `<button type="button" data-checkout-tab="${tab}" ${tab === 'mesas' ? 'aria-current="page"' : ''}>${icon(tab)}<span>${label}</span></button>`).join('')}
        </nav>
      </aside>
      <main class="tableCheckoutMain" aria-labelledby="tableCheckoutTitle">
        <p class="tableCheckoutCrumb">Mesas <span>/</span> <strong>${esc(name)}</strong></p>
        <h1 id="tableCheckoutTitle" tabindex="-1">Fechar ${esc(name.toLowerCase())}</h1>
        <div class="tableCheckoutGrid">
          <section class="tableCheckoutSummary" aria-labelledby="tableCheckoutSummaryTitle">
            <h2 id="tableCheckoutSummaryTitle">Resumo da mesa</h2>
            <div class="tableCheckoutLines"></div>
          </section>
          <section class="tableCheckoutPayment" aria-label="Pagamento">
            <div class="tableCheckoutTotal">
              <span>Total a receber</span>
              <strong id="tableCheckoutAmount">—</strong>
              <svg viewBox="0 0 230 180" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M2 181 115 34q8-10 22-10h94M44 181l89-109q8-10 22-10h76M86 181l65-70q8-10 22-10h58"/></svg>
            </div>
            <div id="tableCheckoutControls"></div>
            <p id="tableCheckoutNotice" role="status"></p>
            <button type="button" id="tableCheckoutBack">Voltar para a mesa</button>
          </section>
        </div>
      </main>
    </div>`, true);

    const view = $('.tableCheckout');
    const sheet = view.closest('.sheet');
    sheet.classList.add('tableCheckoutSheet');
    const notice = view.querySelector('#tableCheckoutNotice');
    const controls = view.querySelector('#tableCheckoutControls');
    const lines = view.querySelector('.tableCheckoutLines');
    const back = view.querySelector('#tableCheckoutBack');
    const navigation = [...view.querySelectorAll('[data-checkout-tab]')];
    view.querySelector('h1').focus();

    function showNotice(message, error = false) {
      notice.textContent = message;
      notice.classList.toggle('is-error', error);
    }

    async function refreshPanels() {
      if (adminMode) {
        const [snapshot] = await Promise.all([adminCall('snapshot'), loadEmployeeAdmin()]);
        admin = snapshot;
      } else {
        employeeSnapshot = await employeeApi('employee_snapshot');
      }
    }

    function goToTab(tab) {
      if (adminMode) {
        adminTab = tab;
        renderAdmin();
      } else {
        renderEmployeePanel();
      }
    }

    function setBusy(value) {
      busy = value;
      back.disabled = value;
      for (const button of navigation) button.disabled = value;
      for (const input of controls.querySelectorAll('input')) input.disabled = value;
      const action = controls.querySelector('button');
      if (action) action.disabled = value || (action.id === 'tableCheckoutConfirm' && !controls.querySelector('input:checked'));
    }

    function draw() {
      if (!view.isConnected) return;
      view.querySelector('#tableCheckoutAmount').textContent = balance ? money(balance.remaining_cents) : '—';
      lines.innerHTML = balance ? balance.items.map(item => `<div class="tableCheckoutLine">
        <span>${Number(item.quantity)}× ${esc(item.name)}
          ${item.addons?.length ? '<small>' + item.addons.map(esc).join(' · ') + '</small>' : ''}
          ${Number(item.paid_quantity) ? '<small>' + Number(item.paid_quantity) + ' já pago(s)</small>' : ''}
        </span><b>${money(item.total_cents)}</b>
      </div>`).join('') || '<p>Nenhum item lançado.</p>' : '<p>Consultando a comanda…</p>';
      if (Number(balance?.paid_cents) > 0) {
        lines.insertAdjacentHTML('beforeend', `<div class="tableCheckoutLine tableCheckoutPaid"><span>Já recebido</span><b>${money(balance.paid_cents)}</b></div>`);
      }
      if (closed || reloadError) {
        controls.innerHTML = `<button type="button" class="tableCheckoutAction">${closed ? 'Atualizar e voltar para mesas' : 'Atualizar saldo'}</button>`;
        controls.querySelector('button').onclick = closed ? finish : () => load();
      } else if (pending) {
        controls.innerHTML = '<button type="button" class="tableCheckoutAction">Conferir pagamento anterior</button>';
        controls.querySelector('button').onclick = () => submit(pending);
      } else if (Number(balance?.remaining_cents) > 0) {
        controls.innerHTML = `<fieldset class="tableCheckoutMethods"><legend>Forma de pagamento</legend>
          <div class="tableCheckoutChoices">${methods.map(([key, label]) => `<label>
            <input type="radio" name="tableCheckoutMethod" value="${label}">
            <span class="tableCheckoutChoice">${icon(key)}<b>${label}</b><span class="tableCheckoutCheck">${icon('check')}</span></span>
          </label>`).join('')}</div>
        </fieldset><button type="button" id="tableCheckoutConfirm" class="tableCheckoutAction" disabled>Confirmar e liberar mesa</button>`;
        controls.querySelector('fieldset').onchange = () => {
          controls.querySelector('#tableCheckoutConfirm').disabled = false;
        };
        controls.querySelector('#tableCheckoutConfirm').onclick = () => {
          const method = controls.querySelector('input:checked')?.value;
          if (!method || busy) return;
          const amount = Number(balance.remaining_cents);
          try {
            const items = balance.items.filter(item => Number(item.remaining_quantity) > 0)
              .map(item => ({ item_id: item.id, qty: Number(item.remaining_quantity) }));
            const payload = {
              table_session_id: session.id,
              client_request_id: paymentRequestId(),
              method,
              expected_cents: amount,
              cash_received_cents: amount,
              items: fullPaymentItems(items)
            };
            sessionStorage.setItem(storageKey, JSON.stringify(payload));
            pending = payload;
            void submit(payload);
          } catch {
            showNotice('O navegador não conseguiu preparar o recebimento. Reabra a Central e tente novamente.', true);
          }
        };
      } else {
        controls.replaceChildren();
      }
      back.textContent = closed ? 'Voltar para mesas' : 'Voltar para a mesa';
    }

    async function load(message = '') {
      if (busy) return;
      reloadError = '';
      setBusy(true);
      showNotice('Atualizando saldo…');
      try {
        const result = await withResponseTimeout(employeeApi('table_item_balance', { table_session_id: session.id }, adminMode));
        if (!Array.isArray(result.balance?.items)) throw new Error('O caixa não retornou os itens da comanda. Atualize o saldo.');
        if (!view.isConnected) return;
        balance = result.balance;
        closed = result.status !== 'open' && !pending;
        if (closed) {
          showNotice('Esta mesa já está fechada.');
        } else if (pending) {
          showNotice('Confira o recebimento anterior antes de registrar outro.');
        } else if (Number(balance.remaining_cents) <= 0) {
          showNotice('A mesa está sem saldo a receber.');
        } else {
          showNotice(message, Boolean(message));
        }
      } catch (error) {
        reloadError = error.message || String(error);
        showNotice(reloadError, true);
      } finally {
        draw();
        setBusy(false);
      }
    }

    async function finish() {
      if (busy) return;
      setBusy(true);
      try {
        await withResponseTimeout(refreshPanels());
        if (view.isConnected) goToTab('mesas');
      } catch {
        showNotice('Mesa fechada. Atualize a lista de mesas.', true);
      } finally {
        setBusy(false);
      }
    }

    async function submit(payload) {
      if (busy) return;
      setBusy(true);
      const action = controls.querySelector('button');
      if (action) action.textContent = 'Registrando…';
      showNotice('Registrando o recebimento…');
      let result;
      try {
        // Pending payments from the earlier version retain the original request ID.
        const request = Array.isArray(payload.items?.all)
          ? { ...payload, items: fullPaymentItems(payload.items.all) }
          : payload;
        result = await withResponseTimeout(employeeApi('pay_table_items', request, adminMode));
        if (result.ok !== true || typeof result.closed !== 'boolean' || !Array.isArray(result.balance?.items)) {
          throw new Error('Resposta do caixa incompleta.');
        }
      } catch (error) {
        setBusy(false);
        if (error.httpStatus >= 400 && error.httpStatus < 500 && error.httpStatus !== 429) {
          clearPending();
          const message = payload.method === 'Cartão' && /forma de pagamento inválida/i.test(error.message)
            ? 'O banco da Equipe precisa do ajuste para aceitar Cartão. Pix e Dinheiro continuam disponíveis.'
            : error.message || 'Confira a comanda e tente novamente.';
          await load(message);
        } else {
          draw();
          showNotice('Ainda falta confirmar a resposta do caixa. Confira o pagamento anterior para evitar duplicidade.', true);
        }
        return;
      }

      clearPending();
      balance = result.balance;
      closed = result.closed;
      draw();
      setBusy(false);
      if (closed) {
        showNotice('Pagamento registrado. Mesa liberada.');
        await finish();
        if (!view.isConnected) showAppToast('Conta quitada. Mesa liberada.', 'ok');
      } else {
        showNotice('Pagamento registrado. Ainda há saldo em aberto nesta mesa.');
      }
    }

    back.onclick = async () => {
      if (closed) return finish();
      if (busy) return;
      setBusy(true);
      try {
        if (adminMode) {
          await loadEmployeeAdmin();
          if (!view.isConnected) return;
          const current = remoteSessionForTable(table.id);
          if (current?.id === session.id) renderRemoteAdminAccount(table, current);
          else goToTab('mesas');
        } else {
          await refreshPanels();
          if (!view.isConnected) return;
          const current = remoteSessionForTable(table.id, employeeSnapshot);
          if (current?.id === session.id) await openEmployeeTable(table.id);
          else goToTab('mesas');
        }
      } catch (error) {
        showNotice(error.message || String(error), true);
      } finally {
        setBusy(false);
      }
    };
    for (const button of navigation) button.onclick = () => goToTab(button.dataset.checkoutTab);
    await load();
  }

  new MutationObserver(() => {
    for (const id of ['adminCloseRemote', 'employeeCloseTable']) {
      const button = $('#' + id);
      if (button && button.textContent !== 'FECHAR MESA') button.textContent = 'FECHAR MESA';
    }
  }).observe(document.querySelector('#modalRoot'), { childList: true, subtree: true });
})();
