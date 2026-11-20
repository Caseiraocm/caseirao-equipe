'use strict';

(() => {
  const displayDate = iso => iso.split('-').reverse().join('/');
  const report = (period = {}) => api('caseirao-driver-earnings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: sessionStorage.getItem('caseirao_admin_pin') || '', ...period }),
  });

  function showDriverEarnings() {
    modal(`<div class="sheeth">
      <h2>Ganhos por entrega</h2><button type="button" class="x" id="backDriverEarnings" aria-label="Voltar para Entregas">←</button>
      </div><p class="mini">Soma das taxas registradas nas entregas concluídas. Valores dos pedidos e ajuda de gasolina ficam fora desse total.</p>
      <form id="driverEarningsForm" class="finFilters">
        <label>Data inicial<input type="date" class="in" id="driverEarningsStart" required></label>
        <label>Data final<input type="date" class="in" id="driverEarningsEnd" required></label>
        <button type="submit" class="primary">Consultar</button>
      </form><div id="driverEarningsResults" aria-live="polite"></div>`);
    $('#backDriverEarnings').onclick = () => renderAdmin();
    const form = $('#driverEarningsForm');
    const start = $('#driverEarningsStart');
    const end = $('#driverEarningsEnd');
    const results = $('#driverEarningsResults');
    const button = form.querySelector('button');

    async function load(period) {
      button.disabled = true;
      results.innerHTML = '<div class="notice">Calculando as taxas…</div>';
      try {
        const data = await report(period);
        if (!form.isConnected) return;
        start.max = end.max = data.today;
        if (period) {
          const span = displayDate(data.start) + ' a ' + displayDate(data.end);
          const rows = data.drivers.map(driver => `<tr><td>${esc(driver.name)}</td>
            <td><b>${driver.delivery_count}</b></td><td><b>${fmt(driver.amount)}</b></td></tr>`);
          results.innerHTML = `<h3>${span}</h3>` + (rows.length
            ? `<div class="financeTableScroll"><table class="financeTable">
              <thead><tr><th>Entregador</th><th>Entregas</th><th>Total em taxas</th></tr></thead>
              <tbody>${rows.join('')}</tbody></table></div>`
            : '<div class="notice">Nenhum entregador no período.</div>');
          return;
        }
        if (!start.value) start.value = data.month_start;
        if (!end.value) end.value = data.today;
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
      if (button.disabled) return;
      if (!start.value || !end.value || start.value > end.value) {
        results.innerHTML = '<div class="err">Escolha uma data final igual ou posterior à inicial.</div>';
        return;
      }
      load({ start: start.value, end: end.value });
    };
    load();
  }

  const renderHub = renderDeliveryHub;
  renderDeliveryHub = function (box) {
    const heading = box?.closest('.proAdmin[data-pro-section="entregas"]')?.querySelector('.proPageTitle');
    if (heading && !heading.querySelector('#driverEarningsButton')) {
      const actions = document.createElement('div');
      actions.className = 'deliveryTitleActions';
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'driverEarningsButton';
      button.className = 'secondary';
      button.textContent = 'Ganhos por entrega';
      button.onclick = showDriverEarnings;
      const manual = heading.querySelector('#proManualOrder');
      actions.append(button);
      if (manual) actions.append(manual);
      heading.append(actions);
    }
    return renderHub(box);
  };
})();
