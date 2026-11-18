/* Simulação do Cartão Caseirão na Central ADM. */
(() => {
  'use strict';

  const currency = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
  const localDate = new Intl.DateTimeFormat('pt-BR', {timeZone: 'America/Fortaleza'});
  const localDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const dayInMilliseconds = 86_400_000;
  const draft = {amount: '100,00', limit: '150,00', rate: '', days: '30'};

  function parseDecimal(value, decimalPlaces) {
    const pattern = new RegExp(`^\\d+(?:[,.]\\d{1,${decimalPlaces}})?$`);
    const trimmed = value.trim();
    return pattern.test(trimmed) ? Number(trimmed.replace(',', '.')) : NaN;
  }

  function quote(input) {
    const amount = Math.round(parseDecimal(input.amount, 2) * 100);
    const limit = Math.round(parseDecimal(input.limit, 2) * 100);
    // One rate unit is one ten-thousandth of a percentage point.
    const rate = Math.round(parseDecimal(input.rate, 4) * 10_000);
    const days = Number(input.days);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000) {
      return {error: 'Informe um valor de compra válido, maior que zero.'};
    }
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100_000_000) {
      return {error: 'Informe um limite disponível válido.'};
    }
    if (!Number.isSafeInteger(rate) || rate < 0 || rate > 1_000_000) {
      return {error: 'Informe a taxa para simular, com até quatro casas decimais.'};
    }
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      return {error: 'Informe um prazo de 1 a 30 dias.'};
    }
    const denominator = 30_000_000n;
    const extra = Number((BigInt(amount) * BigInt(rate * days) + denominator / 2n) / denominator);
    const total = amount + extra;
    return {amount, extra, total, days, remaining: Math.max(0, limit - total), missing: Math.max(0, total - limit)};
  }

  function dueDate(days, now = new Date()) {
    const parts = Object.fromEntries(localDateParts.formatToParts(now).map(part => [part.type, part.value]));
    const localNoon = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12);
    return localDate.format(localNoon + days * dayInMilliseconds);
  }

  function draw(box) {
    box.innerHTML = `<section class="cardPilot" aria-label="Simulador do Cartão Caseirão">
      <header class="cardPilotIntro">
        <h2>Simular compra a prazo</h2>
        <p>Compare o preço à vista com o total a prazo antes de definir a taxa do crediário.</p>
      </header>
      <div class="cardPilotLayout">
        <form class="cardPilotForm" novalidate>
          <label>Valor à vista (R$)<input class="in" name="amount" type="text" inputmode="decimal" maxlength="12"></label>
          <label>Limite disponível (R$)<input class="in" name="limit" type="text" inputmode="decimal" maxlength="12"></label>
          <label>Taxa de simulação a cada 30 dias (%)<input class="in" name="rate" type="text" inputmode="decimal" maxlength="8" aria-describedby="cardPilotRateHelp"></label>
          <label>Dias até o vencimento<input class="in" name="days" type="number" min="1" max="30" step="1"></label>
          <p id="cardPilotRateHelp">Digite a taxa que deseja avaliar. O acréscimo é proporcional aos dias do prazo.</p>
        </form>
        <section class="cardPilotPreview" aria-label="Prévia para o cliente">
          <h3>Prévia para o cliente</h3>
          <dl>
            <div><dt>Preço à vista</dt><dd data-pilot-price>—</dd></div>
            <div><dt>Acréscimo pelo prazo</dt><dd data-pilot-extra>—</dd></div>
            <div class="cardPilotTotal"><dt>Total na fatura</dt><dd data-pilot-total>—</dd></div>
            <div><dt>Vencimento</dt><dd data-pilot-due>—</dd></div>
            <div><dt>Limite após a compra</dt><dd data-pilot-limit>—</dd></div>
          </dl>
          <p class="cardPilotStatus" role="status"></p>
          <p class="cardPilotMethods">Meios previstos para a fatura: dinheiro, maquininha e Pix.</p>
        </section>
      </div>
    </section>`;

    const form = box.querySelector('form');
    for (const [name, value] of Object.entries(draft)) form.elements.namedItem(name).value = value;
    const outputs = {
      price: box.querySelector('[data-pilot-price]'),
      extra: box.querySelector('[data-pilot-extra]'),
      total: box.querySelector('[data-pilot-total]'),
      due: box.querySelector('[data-pilot-due]'),
      limit: box.querySelector('[data-pilot-limit]')
    };
    const status = box.querySelector('.cardPilotStatus');

    function update() {
      for (const name of Object.keys(draft)) draft[name] = form.elements.namedItem(name).value;
      const result = quote(draft);
      if (result.error) {
        for (const output of Object.values(outputs)) output.textContent = '—';
        status.dataset.tone = draft.rate.trim() ? 'warning' : 'neutral';
        status.textContent = draft.rate.trim() ? result.error : 'Digite uma taxa para calcular.';
        return;
      }

      outputs.price.textContent = currency.format(result.amount / 100);
      outputs.extra.textContent = currency.format(result.extra / 100);
      outputs.total.textContent = currency.format(result.total / 100);
      outputs.due.textContent = dueDate(result.days);
      outputs.limit.textContent = result.missing ? '—' : currency.format(result.remaining / 100);
      status.dataset.tone = result.missing ? 'warning' : 'neutral';
      status.textContent = result.missing
        ? `O total a prazo supera o limite disponível em ${currency.format(result.missing / 100)}.`
        : 'Simulação. Nenhuma cobrança gerada.';
    }

    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('input', update);
    update();
  }

  const previous = renderAdminTab;
  renderAdminTab = function (...args) {
    if (adminTab !== 'cartao_caseirao') return previous.apply(this, args);
    const box = document.querySelector('#admContent');
    if (box) draw(box);
  };
})();
