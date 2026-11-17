'use strict';

(() => {
  const displayDate = iso => iso.split('-').reverse().join('/');
  const report = reference => api('caseirao-driver-earnings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: sessionStorage.getItem('caseirao_admin_pin') || '', reference }),
  });

  function showDriverEarnings() {
    modal(`<div class="sheeth">
      <h2>Ganhos por entrega</h2><button type="button" class="x" data-close aria-label="Fechar">×</button>
      </div><p class="mini">Soma das taxas registradas nas entregas concluídas. Valores dos pedidos e ajuda de gasolina ficam fora desse total.</p>
      <form id="driverEarningsForm" class="finFilters">
        <label>Data de referência<input type="date" class="in" id="driverEarningsDate" required></label>
        <button type="submit" class="primary">Consultar</button>
      </form><div id="driverEarningsResults" aria-live="polite"></div>`);
    bindClose();
    const form = $('#driverEarningsForm');
    const date = $('#driverEarningsDate');
    const results = $('#driverEarningsResults');
    const button = form.querySelector('button');

    async function load(reference) {
      button.disabled = true;
      results.innerHTML = '<div class="notice">Calculando as taxas…</div>';
      try {
        const data = await report(reference);
        if (!form.isConnected) return;
        date.max = data.today;
        date.value = data.reference;
        const week = displayDate(data.week_start) + ' a ' + displayDate(data.week_end);
        const month = displayDate(data.month_start) + ' a ' + displayDate(data.month_end);
        const rows = data.drivers.map(driver => `<tr><td>${esc(driver.name)}</td>
          <td><b>${fmt(driver.week_amount)}</b><br>${driver.week_count} entrega(s)</td>
          <td><b>${fmt(driver.month_amount)}</b><br>${driver.month_count} entrega(s)</td></tr>`);
        results.innerHTML = rows.length ? `<div class="financeTableScroll"><table class="financeTable">
          <thead><tr><th>Entregador</th><th>Semana<br>${week}</th><th>Mês<br>${month}</th></tr></thead>
          <tbody>${rows.join('')}</tbody></table></div>` : '<div class="notice">Nenhum entregador no período.</div>';
      } catch (error) {
        if (form.isConnected) results.innerHTML = `<div class="err">${esc(error.message || String(error))}</div>`;
      } finally {
        button.disabled = false;
      }
    }

    form.onsubmit = event => {
      event.preventDefault();
      load(date.value || null);
    };
    load(null);
  }

  const renderHub = renderDeliveryHub;
  renderDeliveryHub = async function (box) {
    await renderHub(box);
    if (!box?.isConnected || adminTab !== 'entregas' || box.querySelector('#driverEarningsButton')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'driverEarningsButton';
    button.className = 'primary';
    button.textContent = 'Ganhos por entrega';
    button.onclick = showDriverEarnings;
    const actions = document.createElement('div');
    actions.className = 'finPaymentActions';
    actions.append(button);
    box.prepend(actions);
  };
})();
