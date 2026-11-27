(() => {
  'use strict';

  const formatTotal = new Intl.NumberFormat('pt-BR');
  const formatClock = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hourCycle: 'h23'
  });
  let card;
  let timer;
  let lastSnapshot;
  let breadStock;

  function updateBreadStock(stock) {
    if (Number.isInteger(stock?.available) && stock.available >= 0 &&
        Number.isSafeInteger(stock.revision) && stock.revision >= 0 &&
        (!breadStock || stock.revision >= breadStock.revision)) {
      breadStock = stock;
    }
    if (!card) return;
    card.querySelector('.shiftBreadNumber').textContent = breadStock ? formatTotal.format(breadStock.available) : '—';
    card.querySelector('.shiftBreadEdit').disabled = !breadStock;
  }

  function bindBreadEditor() {
    const button = card.querySelector('.shiftBreadEdit');
    const dialog = card.querySelector('.shiftBreadDialog');
    const form = dialog.querySelector('form');
    const input = form.querySelector('input');
    const save = form.querySelector('[type="submit"]');
    const feedback = form.querySelector('[role="status"]');
    let revision;

    button.onclick = () => {
      if (!breadStock) return;
      revision = breadStock.revision;
      input.value = breadStock.available;
      feedback.textContent = '';
      dialog.showModal();
      input.select();
    };
    form.querySelector('.shiftBreadCancel').onclick = () => dialog.close();
    dialog.addEventListener('cancel', event => {
      if (save.disabled) event.preventDefault();
    });
    form.onsubmit = async event => {
      event.preventDefault();
      const available = input.valueAsNumber;
      if (save.disabled || !form.reportValidity()) return;
      const cancel = form.querySelector('.shiftBreadCancel');
      save.disabled = cancel.disabled = input.disabled = true;
      feedback.textContent = '';
      try {
        const result = await adminCall('set_bread_stock', {available, revision});
        updateBreadStock(result.bread_stock);
        dialog.close();
      } catch (error) {
        feedback.textContent = error.message || 'Não foi possível ajustar o saldo.';
        if (error.httpStatus === 409) {
          try {
            const fresh = await adminCall('snapshot');
            updateBreadStock(fresh.bread_stock);
            revision = breadStock.revision;
            feedback.textContent = 'Saldo atual: ' + formatTotal.format(breadStock.available) + '. Confira a quantidade antes de salvar.';
          } catch {
            feedback.textContent = 'O saldo mudou. Feche e abra o ajuste novamente.';
          }
        }
      } finally {
        save.disabled = cancel.disabled = input.disabled = false;
      }
    };
  }

  function formatHours(value, fallback) {
    const time = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(String(value ?? ''));
    return time ? time[1] + 'h' + time[2] : fallback;
  }

  function update() {
    if (!card?.isConnected || adminTab !== 'pedidos') {
      card?.remove();
      card = null;
      clearInterval(timer);
      return;
    }

    const now = new Date();
    const clock = card.querySelector('time');
    clock.firstChild.data = formatClock.format(now);
    clock.dateTime = now.toISOString();

    if (lastSnapshot === admin) return;
    lastSnapshot = admin;
    updateBreadStock(admin?.bread_stock);
    const rawTotal = admin?.shift_ready_lanches;
    const total = Number(rawTotal);
    const available = rawTotal != null && Number.isSafeInteger(total) && total >= 0;
    card.querySelector('.shiftLanchesNumber').firstChild.data = available ? formatTotal.format(total) : '—';
    const settings = admin?.settings;
    const hours = formatHours(settings?.open_time, '18h00') + ' às ' + formatHours(settings?.close_time, '23h20');
    card.querySelector('.shiftLanchesHours').firstChild.data = hours;
  }

  function mount(box) {
    if (adminTab !== 'pedidos' || box?.id !== 'admContent' || !box.closest('.proAdmin')) return;
    if (card?.isConnected && card.nextElementSibling === box) {
      update();
      return;
    }

    clearInterval(timer);
    card?.remove();
    card = document.createElement('section');
    card.className = 'shiftLanchesCounter';
    card.setAttribute('aria-label', 'Lanches do expediente e estoque de pães');
    card.innerHTML = `
      <div class="shiftLanchesCard">
        <span class="shiftLanchesIcon" aria-hidden="true">🍔</span>
        <div class="shiftLanchesMetric">
          <strong class="shiftLanchesNumber" aria-live="polite">—</strong>
          <span class="shiftLanchesLabel">Lanches que saíram<br>na noite</span>
        </div>
        <div class="shiftBreadMetric">
          <strong class="shiftLanchesNumber shiftBreadNumber" aria-live="polite">—</strong>
          <div class="shiftBreadDetails">
            <span class="shiftLanchesLabel">Pães disponíveis</span>
            <button class="shiftBreadEdit" type="button" disabled>Ajustar pães</button>
          </div>
        </div>
        <div class="shiftLanchesTime" aria-live="off">
          <span>Hora em Campo Maior</span>
          <time>—</time>
          <span class="shiftLanchesHours">18h00 às 23h20</span>
        </div>
      </div>
      <dialog class="shiftBreadDialog" aria-labelledby="shiftBreadTitle">
        <form>
          <h2 id="shiftBreadTitle">Ajustar pães</h2>
          <label for="shiftBreadAvailable">Total de pães disponíveis agora</label>
          <input id="shiftBreadAvailable" type="number" inputmode="numeric" min="0" max="2147483647" step="1" required autofocus>
          <p class="shiftBreadFeedback" role="status"></p>
          <div class="shiftBreadActions">
            <button class="shiftBreadCancel" type="button">Cancelar</button>
            <button type="submit">Salvar saldo</button>
          </div>
        </form>
      </dialog>`;
    box.before(card);
    bindBreadEditor();
    lastSnapshot = undefined;
    update();
    timer = setInterval(update, 1000);
  }

  const renderBase = renderOrders;
  renderOrders = function (box) {
    const result = renderBase.apply(this, arguments);
    mount(box);
    return result;
  };
})();
