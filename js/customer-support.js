'use strict';

(() => {
  let activeThread;
  let inboxBusy = false;
  let previousUnread = new Map();
  let orderThreads = new Map();
  let inboxRevision = 0;
  const trackingMessage = 'Para ver o status, abra Acompanhar pedido no cardápio do Caseirão.';

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
        summary.parentElement.querySelector('[data-open-order-chat]')?.remove();
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
    panel.threads = threads;
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
    const revision = inboxRevision;
    try {
      const {threads} = await request(mode,'staff_inbox');
      if (accessMode() !== mode || revision !== inboxRevision) return;
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
      const thread = threads.find(item => item.id === activeThread);
      if (thread) {
        if (panel.dataset.openThread === activeThread) void panel.refreshThread();
        else openThread(panel,thread);
      } else if (activeThread || panel.dataset.openThread) {
        activeThread = null;
        clearThread(panel);
      }
      drawThreads(panel,threads);
    } catch(error) {
      const list = document.querySelector('.customerSupportStaff .supportThreads');
      if (list && !list.dataset.signature) list.textContent = error.message || 'Falha ao carregar o atendimento.';
    } finally {
      inboxBusy = false;
    }
  }

  function clearThread(panel) {
    delete panel.dataset.openThread;
    delete panel.refreshThread;
    panel.querySelector('.supportConversation').innerHTML = '<p class="supportPlaceholder">Selecione uma conversa para responder.</p>';
  }

  function openThread(panel, thread) {
    const id = thread.id;
    const mode = panel.dataset.mode;
    panel.dataset.openThread = id;
    const conversation = panel.querySelector('.supportConversation');
    conversation.innerHTML = `<header class="supportConversationHeader">
      <span class="supportConversationIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 11a8 8 0 0 1-8 8H4l2-4a8 8 0 1 1 15-4Z"/></svg></span>
      <div><h3>${esc(threadName(thread))}</h3>
      <small>${esc(thread.customer_name || (thread.order_number ? 'Acompanhamento do pedido' : 'Antes do pedido'))}</small></div>
      ${mode === 'admin' ? '<button class="supportDelete" type="button">Apagar conversa</button>' : ''}
      </header>
      <div class="supportMessages" role="log" aria-label="Mensagens da conversa"></div>
      <form class="supportComposer">
        <label for="supportReply">Responder ao cliente</label>
        <div class="supportComposerControls">
          <textarea id="supportReply" name="message" rows="2" required maxlength="600" placeholder="Escreva sua mensagem"></textarea>
          <button class="supportSend" type="submit">Enviar</button>
        </div>
        <button class="supportTrackingShare" type="button">Enviar acompanhamento</button>
        <p class="supportComposerFeedback" role="status"></p>
      </form>`;
    const messages = conversation.querySelector('.supportMessages');
    const form = conversation.querySelector('form');
    const input = form.elements.message;
    const send = form.querySelector('[type="submit"]');
    const share = form.querySelector('.supportTrackingShare');
    const remove = conversation.querySelector('.supportDelete');
    const feedback = conversation.querySelector('[role="status"]');
    let pending;
    let latest;
    let reading;
    let sending = false;
    let deleting = false;
    const isCurrent = () => form.isConnected && panel.dataset.openThread === id;
    function setBusy(busy) {
      send.disabled = share.disabled = busy;
      if (remove) remove.disabled = busy;
    }
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
      if (reading || sending || deleting || !isCurrent()) return;
      reading = (async () => {
        try {
          const data = await request(mode,'staff_read',{thread_id:id});
          render(data.messages);
          if (isCurrent() && !pending && !deleting) feedback.textContent = '';
        } catch (error) {
          if (isCurrent() && latest == null) feedback.textContent = error.message;
        }
      })();
      try { await reading; } finally { reading = null; }
    };
    async function sendMessage(body, clearInput) {
      if (!body || sending || deleting) return;
      if (pending?.body !== body) pending = {body,id:crypto.randomUUID()};
      sending = true;
      setBusy(true);
      feedback.textContent = 'Enviando…';
      try {
        if (reading) await reading;
        if (!isCurrent()) return;
        const data = await request(mode,'staff_send',{thread_id:id,message:body,request_id:pending.id});
        if (!isCurrent()) return;
        if (clearInput && input.value.trim() === body) input.value = '';
        pending = null;
        render(data.messages);
        messages.scrollTop = messages.scrollHeight;
        feedback.textContent = '';
      } catch (error) {
        if (isCurrent()) feedback.textContent = error.message;
      } finally {
        sending = false;
        setBusy(false);
      }
    }
    form.onsubmit = event => {
      event.preventDefault();
      void sendMessage(input.value.trim(), true);
    };
    share.onclick = () => void sendMessage(trackingMessage, false);
    if (remove) remove.onclick = async () => {
      if (sending || deleting || !confirm('Apagar esta conversa e todas as mensagens do atendimento?')) return;
      deleting = true;
      setBusy(true);
      feedback.textContent = 'Apagando conversa…';
      try {
        if (reading) await reading;
        await request(mode,'staff_delete',{thread_id:id});
        inboxRevision++;
        previousUnread.delete(id);
        updateBadge([...previousUnread.values()].reduce((sum, count) => sum + count, 0));
        if (orderThreads.get(thread.order_id)?.id === id) orderThreads.delete(thread.order_id);
        updateOrderCards();
        const currentPanel = document.querySelector('.customerSupportStaff');
        if (activeThread === id) activeThread = null;
        if (currentPanel?.dataset.openThread === id) clearThread(currentPanel);
        if (currentPanel?.threads) drawThreads(currentPanel,currentPanel.threads.filter(item => item.id !== id));
        void updateInbox();
      } catch (error) {
        if (isCurrent()) feedback.textContent = error.message || 'Não foi possível apagar a conversa.';
      } finally {
        deleting = false;
        setBusy(false);
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
  let focusedComposer;
  function fitComposerToKeyboard() {
    const viewport=window.visualViewport;
    const input=document.activeElement;
    const composer=input?.matches('.supportComposer textarea') ? input.closest('.supportComposer') : null;
    if (focusedComposer && focusedComposer !== composer) {
      focusedComposer.closest('.supportConversation')?.style.removeProperty('--support-visible-height');
    }
    focusedComposer=composer;
    if (!composer || !viewport || viewport.scale > 1.05) return;
    composer.closest('.supportConversation').style.setProperty('--support-visible-height',viewport.height+'px');
    const visibleBottom=viewport.offsetTop+viewport.height;
    if (composer.getBoundingClientRect().bottom > visibleBottom-8) {
      composer.scrollIntoView({block:'nearest'});
    }
  }
  window.visualViewport?.addEventListener('resize',fitComposerToKeyboard);
  document.addEventListener('focusin',fitComposerToKeyboard);
  document.addEventListener('focusout',()=>requestAnimationFrame(fitComposerToKeyboard));

  new MutationObserver(updateOrderCards).observe(modalRoot,{childList:true,subtree:true});
  setInterval(updateInbox,4500);
  document.addEventListener('visibilitychange',updateInbox);
})();
