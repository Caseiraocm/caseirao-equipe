'use strict';

(() => {
  let activeThread;
  let inboxBusy = false;
  let previousUnread = new Map();
  let orderThreads = new Map();

  function accessMode() {
    if (document.querySelector('.proAdmin') && sessionStorage.getItem('caseirao_admin_pin')) return 'admin';
    if (operationalMode === 'employee' && employeeSnapshot?.employee?.role !== 'embalagem' &&
        document.querySelector('#employeeLogout, .customerSupportStaff') && employeeToken()) return 'employee';
    return null;
  }
  function request(mode, action, fields = {}) {
    const credentials = mode === 'admin'
      ? {pin:sessionStorage.getItem('caseirao_admin_pin')} : {employee_token:employeeToken()};
    return api('caseirao-chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      signal:AbortSignal.timeout(10000), body:JSON.stringify({action,...credentials,...fields}),
    });
  }
  function threadName(thread) {
    return thread.order_number ? 'Pedido #' + thread.order_number : 'Cliente do cardápio';
  }
  function updateBadge(unread) {
    document.querySelectorAll('[data-support-unread]').forEach(item => {
      item.textContent = unread ? String(unread) : '';
      item.hidden = !unread;
    });
  }
  function updateOrderCards() {
    document.querySelectorAll('.proAdmin details[data-order-id] .orderSummary').forEach(summary => {
      const thread = orderThreads.get(summary.closest('details').dataset.orderId);
      let badge = summary.querySelector('[data-order-chat-unread]');
      if (!thread) {
        badge?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.dataset.orderChatUnread = '';
        badge.className = 'supportBadge';
        (summary.querySelector('.summaryCustomer') || summary).append(badge);
      }
      const unread = Number(thread.unread);
      const label = unread === 1 ? '1 mensagem nova' : unread + ' mensagens novas';
      if (badge.textContent !== label) badge.textContent = label;
      badge.hidden = !unread;

      const body = summary.parentElement.querySelector('.orderBody');
      if (!body || body.querySelector('[data-open-order-chat]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary supportOrderButton';
      button.dataset.openOrderChat = '';
      button.textContent = 'Abrir conversa';
      button.onclick = () => {
        activeThread = thread.id;
        adminTab = 'atendimento_chat';
        renderAdmin();
      };
      body.prepend(button);
    });
  }
  function drawThreads(panel, threads) {
    const list = panel.querySelector('.supportThreads');
    const signature = JSON.stringify([activeThread,threads]);
    if (list.dataset.signature === signature) return;
    list.dataset.signature = signature;
    list.innerHTML = threads.length ? threads.map(thread =>
      `<button type="button" data-support-thread="${esc(thread.id)}" aria-pressed="${thread.id===activeThread}">
        <span><b>${esc(threadName(thread))}</b><small>${esc(thread.customer_name || (thread.order_number ? 'Acompanhamento do pedido' : 'Antes do pedido'))}</small></span>
        ${thread.unread ? `<strong class="supportBadge">${Number(thread.unread)} ${Number(thread.unread)===1?'nova':'novas'}</strong>` : ''}
      </button>`
    ).join('') : '<p class="supportPlaceholder">Nenhuma conversa por aqui.</p>';
    list.querySelectorAll('[data-support-thread]').forEach(button => {
      button.onclick = () => {
        activeThread = button.dataset.supportThread;
        drawThreads(panel, threads);
        openThread(panel, threads.find(item => item.id === activeThread));
      };
    });
  }
  async function updateInbox() {
    if (inboxBusy || document.hidden) return;
    const mode = accessMode();
    if (!mode) {
      previousUnread.clear();
      orderThreads.clear();
      activeThread = null;
      return;
    }
    inboxBusy = true;
    try {
      const {threads} = await request(mode,'staff_inbox');
      if (accessMode() !== mode) return;
      const unread = threads.reduce((total, thread) => total + Number(thread.unread || 0), 0);
      const hasNew = threads.some(thread => Number(thread.unread) > (previousUnread.get(thread.id) || 0));
      previousUnread = new Map(threads.map(thread => [thread.id, Number(thread.unread)]));
      updateBadge(unread);
      orderThreads = new Map(threads.filter(thread=>thread.order_id).map(thread=>[thread.order_id,thread]));
      updateOrderCards();
      if (hasNew) {
        playOrderSound();
        showPassiveNotice('Nova mensagem no Atendimento.','info','chat-new');
      }
      const panel = document.querySelector('.customerSupportStaff');
      if (!panel) return;
      drawThreads(panel,threads);
      const thread = threads.find(item => item.id === activeThread);
      if (thread) {
        if (panel.dataset.openThread === activeThread) void panel.refreshThread();
        else openThread(panel,thread);
      }
    } catch(error) {
      const list = document.querySelector('.customerSupportStaff .supportThreads');
      if (list && !list.dataset.signature) list.textContent = error.message || 'Falha ao carregar o atendimento.';
    } finally {
      inboxBusy = false;
    }
  }

  function openThread(panel, thread) {
    const id = thread.id;
    const mode = panel.dataset.mode;
    panel.dataset.openThread = id;
    const conversation = panel.querySelector('.supportConversation');
    conversation.innerHTML = `<header><h3>${esc(threadName(thread))}</h3>
      <small>${esc(thread.customer_name || (thread.order_number ? 'Acompanhamento do pedido' : 'Antes do pedido'))}</small></header>
      <div class="supportMessages" role="log" aria-label="Mensagens da conversa"></div>
      <form><textarea name="message" rows="2" required maxlength="600" placeholder="Responder ao cliente" aria-label="Responder ao cliente"></textarea>
      <button class="primary" type="submit">Enviar</button></form><p role="status"></p>`;
    const messages = conversation.querySelector('.supportMessages');
    const form = conversation.querySelector('form');
    const input = form.elements.message;
    const send = form.querySelector('button');
    const feedback = conversation.querySelector('[role="status"]');
    let pending;
    let latest;
    let reading;
    let sending = false;
    const isCurrent = () => form.isConnected && panel.dataset.openThread === id;
    function render(rows) {
      const last = rows.at(-1)?.id || 0;
      if (!isCurrent() || latest === last) return;
      const atBottom = latest == null || messages.scrollHeight - messages.scrollTop - messages.clientHeight < 65;
      latest = last;
      messages.innerHTML = rows.map(row =>
        `<div class="supportBubble ${row.actor==='staff'?'staff':''}"><strong>${row.actor==='staff'?'Equipe':'Cliente'}</strong><p>${esc(row.body)}</p></div>`
      ).join('');
      if (atBottom) messages.scrollTop = messages.scrollHeight;
    }
    panel.refreshThread = async () => {
      if (reading || sending || !isCurrent()) return;
      reading = (async () => {
        try {
          const data = await request(mode,'staff_read',{thread_id:id});
          render(data.messages);
          if (isCurrent() && !pending) feedback.textContent = '';
        } catch (error) {
          if (isCurrent() && latest == null) feedback.textContent = error.message;
        }
      })();
      try { await reading; } finally { reading = null; }
    };
    form.onsubmit = async event => {
      event.preventDefault();
      const body = input.value.trim();
      if (!body || sending) return;
      if (pending?.body !== body) pending = {body,id:crypto.randomUUID()};
      sending = true;
      send.disabled = true;
      feedback.textContent = 'Enviando…';
      try {
        if (reading) await reading;
        if (!isCurrent()) return;
        const data = await request(mode,'staff_send',{thread_id:id,message:body,request_id:pending.id});
        if (!isCurrent()) return;
        if (input.value.trim() === body) input.value = '';
        pending = null;
        render(data.messages);
        messages.scrollTop = messages.scrollHeight;
        feedback.textContent = '';
      } catch (error) {
        if (isCurrent()) feedback.textContent = error.message;
      } finally {
        sending = false;
        send.disabled = false;
      }
    };
    void panel.refreshThread();
  }

  window.renderCustomerSupportInbox = (container,mode='admin') => {
    container.innerHTML = `<section class="customerSupportStaff" data-mode="${mode}">
      <div class="supportThreads" aria-label="Conversas">Carregando conversas…</div>
      <div class="supportConversation"><p class="supportPlaceholder">Selecione uma conversa para responder.</p></div>
    </section>`;
    void updateInbox();
  };
  window.openEmployeeCustomerSupport = () => {
    modal('<div class="sheeth"><h2>Atendimento online</h2><button id="supportGoBack" class="secondary" type="button">Voltar</button></div><div id="employeeSupportInbox"></div>',true);
    $('#supportGoBack').onclick = () => renderEmployeePanel();
    renderCustomerSupportInbox($('#employeeSupportInbox'),'employee');
  };
  new MutationObserver(updateOrderCards).observe(modalRoot,{childList:true,subtree:true});
  setInterval(updateInbox,4500);
  document.addEventListener('visibilitychange',updateInbox);
})();
