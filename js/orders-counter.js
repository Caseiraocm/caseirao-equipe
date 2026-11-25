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
    card.setAttribute('aria-label', 'Contador de lanches do expediente');
    card.innerHTML = `
      <div class="shiftLanchesCard">
        <span class="shiftLanchesIcon" aria-hidden="true">🍔</span>
        <div class="shiftLanchesMetric">
          <strong class="shiftLanchesNumber" aria-live="polite">—</strong>
          <span class="shiftLanchesLabel">Lanches que saíram<br>na noite</span>
        </div>
        <div class="shiftLanchesTime" aria-live="off">
          <span>Hora em Campo Maior</span>
          <time>—</time>
          <span class="shiftLanchesHours">18h00 às 23h20</span>
        </div>
      </div>`;
    box.before(card);
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
