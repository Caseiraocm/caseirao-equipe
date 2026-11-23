(() => {
  'use strict';

  const money = cents => fmt(cents / 100);
  const decimal = cents => (cents / 100).toFixed(2).replace('.', ',');
  const shortDate = day => day.split('-').reverse().join('/');
  const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' });
  let selectedDay = today();
  let pendingTransfer;

  function hundredths(input) {
    const normalized = input.trim().replace(/^R\$\s*/, '');
    if (normalized.includes(',') && !/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(normalized)) return null;
    const decimalInput = normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized;
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(decimalInput)) return null;
    const [whole, fraction = ''] = decimalInput.split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  }

  function call(action, parameters) {
    return api('caseirao-tax-reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: sessionStorage.getItem('caseirao_admin_pin') || '', action, ...parameters }),
    });
  }

  function metrics(values) {
    return '<div class="taxMetrics">' + values.map(([label, value]) =>
      `<div><span>${label}</span><strong>${value}</strong></div>`).join('') + '</div>';
  }

  function history(days) {
    if (!days.length) return '<p>Nenhuma venda finalizada ou transferência registrada neste mês.</p>';
    return `<div class="financeTableScroll" tabindex="0" aria-label="Histórico diário"><table class="financeTable">
      <thead><tr><th>Dia das vendas</th><th>Vendas</th><th>Estimativa</th><th>Reservado</th></tr></thead>
      <tbody>${days.map(row => `<tr><th scope="row"><button class="secondary" type="button" data-tax-day="${row.day}">${shortDate(row.day)}</button></th>
        <td>${money(row.sales_cents)}</td><td>${money(row.estimated_cents)}</td><td>${money(row.reserved_cents)}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }

  function draw(box, data) {
    const day = data.days.find(row => row.day === selectedDay) ||
      { sales_cents: 0, estimated_cents: 0, reserved_cents: 0, orders: 0, transfers: [] };
    const remainder = Math.max(0, day.estimated_cents - day.reserved_cents);
    const presets = [400, 500, 600];
    const das = data.das_cents == null ? 'A informar' : money(data.das_cents);
    const gap = data.das_cents == null ? 'Sem DAS informado' : money(Math.max(0, data.das_cents - data.reserved_cents));

    box.innerHTML = `<section class="taxPanel" aria-labelledby="taxDayTitle">
      <h2 id="taxDayTitle">Dia selecionado · ${shortDate(selectedDay)}</h2>
      ${metrics([['Vendas finalizadas', money(day.sales_cents)], ['Reserva sugerida', money(day.estimated_cents)],
        ['Transferido à caixinha', money(day.reserved_cents)], ['Falta reservar no dia', money(remainder)]])}
      <p>Comandas finalizadas no relatório: ${day.orders}.</p>
      <form data-tax-form="transfer" class="taxForm">
        <label>Valor já transferido (R$)<input name="amount" class="in" inputmode="decimal" required
          value="${remainder ? decimal(remainder) : ''}" placeholder="0,00"></label>
        <button class="primary" type="submit">Confirmar transferência</button>
      </form>
      ${day.transfers.length ? `<details><summary>Transferências registradas (${day.transfers.length})</summary>
        <ul>${day.transfers.map(row => `<li>${money(row.amount_cents)} · ${new Date(row.confirmed_at).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}</li>`).join('')}</ul></details>` : ''}
    </section>
    <section class="taxPanel" aria-labelledby="taxMonthTitle">
      <h2 id="taxMonthTitle">Resumo do mês · ${data.month.split('-').reverse().join('/')}</h2>
      ${metrics([['Vendas finalizadas', money(data.sales_cents)], ['Estimativa mensal', money(data.estimated_cents)],
        ['Transferido no mês', money(data.reserved_cents)], ['DAS efetivo', das], ['Falta para cobrir o DAS', gap]])}
      <div class="taxSettings">
        <form data-tax-form="rate" class="taxForm">
          <label>Percentual de reserva<select class="in" name="preset">
            ${presets.map(rate => `<option value="${rate}" ${rate === data.rate_bps ? 'selected' : ''}>${rate / 100}%</option>`).join('')}
            <option value="custom" ${presets.includes(data.rate_bps) ? '' : 'selected'}>Personalizado</option>
          </select></label>
          <label data-tax-custom>Percentual (%)<input name="rate" class="in" inputmode="decimal" value="${decimal(data.rate_bps)}"></label>
          <button type="submit" class="secondary">Salvar percentual</button>
        </form>
        <form data-tax-form="das" class="taxForm">
          <label>Valor da guia DAS (R$)<input name="amount" class="in" inputmode="decimal"
            value="${data.das_cents == null ? '' : decimal(data.das_cents)}" placeholder="A informar"></label>
          <button type="submit" class="secondary">Salvar DAS</button>
        </form>
      </div>
      <p>O percentual vale para o mês selecionado e atualiza as estimativas. Informe o DAS quando tiver o valor da guia.</p>
    </section>
    <section class="taxPanel"><h2>Histórico diário</h2>${history(data.days)}</section>`;

    const rateForm = box.querySelector('[data-tax-form="rate"]');
    const updateRate = () => {
      const custom = rateForm.elements.preset.value === 'custom';
      rateForm.elements.rate.closest('label').hidden = !custom;
      rateForm.elements.rate.required = custom;
    };
    rateForm.elements.preset.onchange = updateRate;
    updateRate();
    return day;
  }

  function render(box) {
    box.innerHTML = `<section class="finHero"><h2>Reserva de impostos</h2>
      <p>Estime quanto separar das vendas finalizadas e registre o dinheiro que já transferiu para a caixinha.</p></section>
      <div class="taxForm taxFilters"><label>Dia das vendas<input id="taxDate" class="in" type="date"
        min="2000-01-01" max="${today()}" value="${selectedDay}"></label>
        <button type="button" class="secondary" id="taxReload">Atualizar</button></div>
      <p id="taxMessage" role="status"></p><div id="taxContents"></div>`;
    const host = box.querySelector('#taxContents');
    const dateInput = box.querySelector('#taxDate');
    const reload = box.querySelector('#taxReload');
    const message = box.querySelector('#taxMessage');
    let day;
    let busy = false;

    async function run(action, extra = {}) {
      if (busy) return;
      busy = true;
      const controls = [dateInput, reload, ...host.querySelectorAll('button, input, select')];
      controls.forEach(control => { control.disabled = true; });
      if (action === 'month') host.replaceChildren();
      message.textContent = action === 'month' ? 'Consultando vendas e reservas…' : 'Salvando…';
      try {
        const data = await call(action, { day: selectedDay, ...extra });
        if (!host.isConnected) return;
        day = draw(host, data);
        if (action === 'transfer' || (action === 'month' && pendingTransfer &&
          pendingTransfer.day === selectedDay && pendingTransfer.expectedCents !== day.reserved_cents)) {
          pendingTransfer = undefined;
        }
        message.textContent = { month: '', transfer: 'Transferência registrada.', rate: 'Percentual salvo.', das: 'Valor do DAS atualizado.' }[action];
      } catch (error) {
        if (host.isConnected) message.textContent = error.message || 'Tente atualizar e confira o histórico.';
      } finally {
        controls.forEach(control => { control.disabled = false; });
        busy = false;
      }
    }

    function selectDate() {
      if (!dateInput.value || !dateInput.reportValidity()) return;
      selectedDay = dateInput.value;
      run('month');
    }

    dateInput.onchange = reload.onclick = selectDate;
    host.onclick = event => {
      const button = event.target.closest('[data-tax-day]');
      if (!button) return;
      dateInput.value = button.dataset.taxDay;
      selectDate();
    };
    host.onsubmit = event => {
      event.preventDefault();
      if (busy) return;
      const form = event.target;
      const action = form.dataset.taxForm;
      const input = form.elements;
      if (action === 'rate') {
        const value = input.preset.value === 'custom' ? hundredths(input.rate.value) : Number(input.preset.value);
        if (!value || value > 10000) {
          message.textContent = 'Informe um percentual entre 0,01% e 100%.';
          return;
        }
        run(action, { value });
        return;
      }
      const raw = input.amount.value.trim();
      const value = hundredths(raw);
      if ((action === 'das' && raw && value == null) || (action === 'transfer' && !value)) {
        message.textContent = 'Informe um valor válido em reais e centavos.';
        return;
      }
      if (action === 'das') {
        run(action, { value });
        return;
      }
      if (!confirm(`Confirma que já transferiu ${money(value)} para a caixinha, referente a ${shortDate(selectedDay)}?`)) return;
      if (pendingTransfer?.day !== selectedDay || pendingTransfer.value !== value ||
          pendingTransfer.expectedCents !== day.reserved_cents) {
        pendingTransfer = { day: selectedDay, value, requestId: crypto.randomUUID(), expectedCents: day.reserved_cents };
      }
      run(action, pendingTransfer);
    };
    run('month');
  }

  window.renderTaxReserve = render;
})();
