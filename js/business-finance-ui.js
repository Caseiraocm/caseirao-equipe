(() => {
  'use strict';
  const { calculate, categories, categoryLabels, accountLabels, shopDay, brl, moneyInput } = window.CaseiraoBusinessFinance;
  const call = (action, data) => api('caseirao-business-finance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: sessionStorage.getItem('caseirao_admin_pin') || '', action, ...data }),
  });
  const isoToday = () => shopDay();
  const prettyDate = value => value ? value.split('-').reverse().join('/') : '—';
  const monthLabel = value => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(value + '-01T12:00:00Z'));
  const inputMoney = cents => cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',');
  const percent = value => value == null ? '—' : value.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
  const options = choices => Object.entries(choices).map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
  const accounts = Object.fromEntries(Object.entries(accountLabels).filter(([key]) => key !== 'pix'));
  const kinds = {
    expense: 'Despesa', revenue: 'Outra receita', settlement: 'Repasse de cartão',
    transfer: 'Transferência', capital_in: 'Aporte de capital', capital_out: 'Retirada de capital',
  };
  const fixedCategory = { revenue: 'outras_receitas', settlement: 'repasse', transfer: 'transferencia', capital_in: 'capital', capital_out: 'capital' };
  const hints = {
    expense: 'Lance aqui as contas da loja. Pagamentos da equipe registrados por recibo e taxas já descontadas no repasse entram automaticamente.',
    revenue: 'Registre uma receita por fora dos pedidos e do consumo da equipe.',
    settlement: 'Use o extrato da maquininha. Informe o bruto dos pagamentos repassados, já descontadas eventuais devoluções, e o líquido creditado. A diferença deve corresponder à taxa.',
    transfer: 'Use para movimentações entre contas da empresa. As transferências da Reserva de Impostos já aparecem no resumo.',
    capital_in: 'Registre dinheiro dos sócios colocado na empresa.',
    capital_out: 'Registre retiradas de capital dos sócios. Para remuneração do trabalho do sócio, use a categoria Pró-labore.',
  };
  let selectedMonth = '';
  let selectedView = 'overview';

  function tile(label, value, hint, style = '') {
    return `<article class="bf-tile ${style}"><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`;
  }

  function chart(data) {
    const rows = data.days;
    const max = Math.max(1, ...rows.flatMap(row => [Math.abs(row.in), Math.abs(row.out)]));
    const height = value => value === 0 ? 0 : Math.max(2, Math.abs(value) / max * 100);
    return `<section class="bf-card"><h3>Fluxo de caixa diário</h3>
      <div class="bf-legend"><span>Entradas</span><span>Saídas</span></div>
      <div class="bf-chart-scroll"><div class="bf-chart" style="--bf-days:${Math.max(rows.length, 1)}" aria-hidden="true">
      ${rows.map(row => `<div class="bf-day" title="${prettyDate(row.day)} · Entradas ${brl(row.in)} · Saídas ${brl(row.out)}">
        <div class="bf-day-bars"><i style="height:${height(row.in)}%" class="${row.in < 0 ? 'bf-reversal' : ''}"></i><i style="height:${height(row.out)}%" class="${row.out < 0 ? 'bf-reversal' : ''}"></i></div><span>${row.day.slice(-2)}</span></div>`).join('')}
      </div></div><details><summary>Ver valores por dia</summary><div class="bf-table-scroll"><table><thead><tr><th>Dia</th><th>Vendas</th><th>Entradas</th><th>Saídas</th></tr></thead>
      <tbody>${rows.map(row => `<tr><td>${prettyDate(row.day)}</td><td>${brl(row.sales)}</td><td>${brl(row.in)}</td><td>${brl(row.out)}</td></tr>`).join('')}</tbody></table></div></details></section>`;
  }

  function expenseChart(data) {
    const rows = [['Insumos e embalagens usados', data.cost], ['Imposto do mês', data.taxExpense],
      ...Object.entries(data.expenses).map(([key, value]) => [categories[key], value])]
      .filter(([, value]) => value !== 0).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map(([, value]) => Math.abs(value)));
    return `<section class="bf-card"><h3>Custos por categoria</h3>
      ${rows.length ? `<ul class="bf-costs">${rows.map(([label, value]) => `<li>
      <div><span>${label}</span><strong>${brl(value)}</strong></div>
      <i aria-hidden="true"><b style="width:${Math.abs(value) / max * 100}%" class="${value < 0 ? 'bf-reversal' : ''}"></b></i></li>`).join('')}</ul>` : '<p>Nenhum custo registrado neste mês.</p>'}</section>`;
  }

  function lines(rows) {
    return `<dl class="bf-lines">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${brl(value)}</dd></div>`).join('')}</dl>`;
  }

  function overview(data) {
    return `<div class="bf-charts">${chart(data)}${expenseChart(data)}</div>
      <div class="bf-columns">
      <section class="bf-card"><h3>Contas a pagar e a receber</h3>${lines([
        ['Despesas em aberto', data.payables], ['Despesas vencidas', data.overdue],
        ['Outras receitas em aberto', data.receivables], ['Saldo das vendas do mês a receber', data.orderDue],
      ])}</section>
      <section class="bf-card"><h3>Conciliação dos recebimentos</h3>${lines([
        ['Pagamentos dos clientes em cartão', data.cardPaid], ['Devoluções em cartão', data.cardRefunds],
        ['Repasses informados, valor bruto', data.cardSettled], ['Recebimentos sem data no relatório', data.undated],
        ['Recebimentos ou devoluções sem modalidade', data.unidentified],
      ])}<p>Os repasses podem cair em outro mês. Confira o extrato da Ton e do Mercado Pago antes de lançar o líquido creditado.</p>
      ${data.issues ? `<p>${data.issues} ocorrência(s) para conferir em Relatórios.</p>` : ''}</section>
      <section class="bf-card"><h3>Movimento por conta</h3>
      ${Object.keys(data.byAccount).length ? lines(Object.entries(data.byAccount).map(([key, value]) => [accountLabels[key], value])) : '<p>Nenhum movimento no período.</p>'}
      <p>Variação registrada no mês. Os Pix recebidos nos pedidos ficam em Pix a conciliar. Folha e vales seguem as modalidades disponíveis no relatório.</p></section>
      <section class="bf-card"><h3>Impostos</h3>${lines([
        ['DAS do mês (' + (data.tax == null ? 'estimado' : 'informado') + ')', data.taxExpense],
        ['Reservado na caixinha', data.reserved], ['DAS pago no período', data.taxesPaid],
      ])}<p>Informe a guia em Reserva de impostos. Registre o pagamento no Financeiro na data da saída.</p></section>
      </div>`;
  }

  function ledger(data) {
    return `<section class="bf-card"><div class="bf-section-head"><h3>Lançamentos manuais</h3><label>Exibir
      <select data-bf-filter><option value="all">Todos</option><option value="open">Em aberto</option><option value="paid">Liquidados</option><option value="void">Anulados</option></select></label></div>
      <p>As vendas e os pagamentos já registrados no sistema aparecem nos totais da visão geral.</p>
      ${data.entries.length ? `<div class="bf-table-scroll" tabindex="0" aria-label="Tabela de lançamentos">
      <table><thead><tr><th>Descrição</th><th>Competência</th><th>Vencimento</th><th>Pagamento</th><th>Valor</th><th>Ações</th></tr></thead>
      <tbody>${data.entries.map(row => {
        const state = row.voided_at ? 'void' : row.paid_on ? 'paid' : 'open';
        return `<tr data-bf-state="${state}"><td><b>${esc(row.description)}</b><small>${kinds[row.kind]} · ${categoryLabels[row.category]}</small>
          ${row.voided_at ? `<small>Anulado · ${esc(row.void_reason)}</small>` : ''}</td>
          <td>${prettyDate(row.competence)}</td><td>${prettyDate(row.due_on)}</td><td>${prettyDate(row.paid_on)}
          ${row.account ? `<small>${accountLabels[row.account]}${row.destination ? ' → ' + accountLabels[row.destination] : ''}</small>` : ''}</td>
          <td>${brl(row.net_cents ?? row.amount_cents)}${row.kind === 'settlement' ? `<small>Bruto ${brl(row.amount_cents)}</small>` : ''}</td>
          <td class="bf-row-buttons">${state === 'open' ? `<button type="button" data-bf-pay="${row.id}">Dar baixa</button>` : ''}
          ${state !== 'void' ? `<button type="button" data-bf-void="${row.id}">Anular</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div><p data-bf-empty hidden>Nenhum lançamento com esse filtro.</p>` : '<p>Nenhum lançamento manual no período.</p>'}</section>`;
  }

  function closing(data) {
    return `<div class="bf-columns"><section class="bf-card"><h3>Resultado de ${monthLabel(data.start.slice(0, 7))}</h3>
      ${lines([['Vendas e consumo da equipe', data.sales], ['Outras receitas', data.extra],
        ['Custo dos insumos e embalagens', data.cost], ['Despesas da operação', data.operating],
        ['Imposto do mês', data.taxExpense], [data.result < 0 ? 'Prejuízo' : 'Lucro', data.result]])}
      <p>Margem ${percent(data.margin)}. A folha acompanha os recibos pagos no mês. Registre as demais contas na data em que a despesa pertence à operação.</p>
      ${data.preliminary ? '<p class="bf-note">Resultado provisório enquanto o mês estiver em andamento, o estoque precisar de conferência ou o DAS estiver pendente.</p>' : ''}
      </section><section class="bf-card"><h3>Conferência do estoque</h3>
      ${lines([['Compras de insumos e embalagens', data.purchases]])}
      <p>Informe o valor de compra dos insumos e embalagens que estavam guardados no início e no fim do mês.</p>
      ${data.inventory && !data.stockValid ? '<p class="bf-error">O estoque final supera o estoque inicial mais as compras. Confira os valores antes de usar o resultado.</p>' : ''}
      ${data.inventory && data.priorInventory != null && data.inventory.opening_cents !== data.priorInventory ? '<p class="bf-note">O estoque inicial difere do fechamento do mês anterior.</p>' : ''}
      <form data-bf-inventory class="bf-form">
        <label>Estoque inicial (R$)<input name="opening" inputmode="decimal" required value="${inputMoney(data.inventory?.opening_cents ?? data.priorInventory)}"></label>
        <label>Estoque final (R$)<input name="closing" inputmode="decimal" required value="${inputMoney(data.inventory?.closing_cents)}"></label>
        <p class="bf-error" data-bf-error role="alert" hidden></p>
        <button class="bf-primary" type="submit">Salvar estoque</button>
      </form></section></div>`;
  }

  function exportReport(data) {
    const decimal = window.CaseiraoFinance.decimal;
    const csv = window.CaseiraoFinance.csv([
      ['Financeiro Caseirão', data.start, data.end],
      ['Resultado', data.preliminary ? 'Provisório' : 'Apurado'],
      ['Receita', decimal(data.revenue)], ['Insumos e embalagens', decimal(data.cost)],
      ...Object.entries(data.expenses).map(([key, value]) => [categories[key], decimal(value)]),
      ['Impostos', decimal(data.taxExpense)], ['Lucro ou prejuízo', decimal(data.result)],
      ['Entradas', decimal(data.incoming)], ['Saídas', decimal(data.outgoing)], ['Movimento líquido', decimal(data.cashChange)],
      [], ['Dia', 'Vendas', 'Entradas', 'Saídas'],
      ...data.days.map(row => [row.day, decimal(row.sales), decimal(row.in), decimal(row.out)]),
      [], ['Tipo', 'Categoria', 'Descrição', 'Competência', 'Vencimento', 'Liquidação', 'Valor bruto', 'Líquido do repasse', 'Conta', 'Destino', 'Anulado'],
      ...data.entries.map(row => [kinds[row.kind], categoryLabels[row.category], row.description, row.competence, row.due_on,
        row.paid_on, decimal(row.amount_cents), row.net_cents == null ? '' : decimal(row.net_cents),
        accountLabels[row.account], accountLabels[row.destination], row.void_reason || '']),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Caseirao-Financeiro-${data.start.slice(0, 7)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function formatError(form, message) {
    const box = form.querySelector('[data-bf-error]');
    box.hidden = false;
    box.textContent = message;
  }

  async function submit(form, fn, success) {
    const button = form.querySelector('button[type="submit"]');
    const errorBox = form.querySelector('[data-bf-error]');
    errorBox.hidden = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      await fn(new FormData(form));
      if (form.isConnected) success();
    } catch (error) {
      if (form.isConnected) formatError(form, error.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  }

  function dialog(panel, title, fields, button, save, success) {
    const el = document.createElement('dialog');
    el.className = 'bf-dialog';
    el.setAttribute('aria-labelledby', 'bf-dialog-title');
    el.innerHTML = `<form class="bf-form"><header><h3 id="bf-dialog-title">${title}</h3>
      <button data-bf-close type="button" aria-label="Fechar">×</button></header>
      <div class="bf-form-fields">${fields}</div><p class="bf-error" data-bf-error role="alert" hidden></p>
      <button class="bf-primary" type="submit">${button}</button></form>`;
    panel.append(el);
    const form = el.querySelector('form');
    el.querySelector('[data-bf-close]').onclick = () => { if (!form.hasAttribute('aria-busy')) el.close(); };
    el.addEventListener('cancel', event => { if (form.hasAttribute('aria-busy')) event.preventDefault(); });
    el.addEventListener('close', () => el.remove(), { once: true });
    form.onsubmit = event => {
      event.preventDefault();
      submit(form, save, () => { el.close(); success(); });
    };
    el.showModal();
    return form;
  }

  function accountField(name, label = 'Conta') {
    return `<label>${label}<select name="${name}" required><option value="">Selecione</option>${options(accounts)}</select></label>`;
  }

  function newEntry(panel, data, reload) {
    let id = crypto.randomUUID();
    let submitted = '';
    const defaultDay = data.today.slice(0, 7) === selectedMonth ? data.today : data.end;
    const form = dialog(panel, 'Novo lançamento', `
      <label>Tipo<select name="kind">${options(kinds)}</select></label>
      <p class="bf-note bf-wide" data-bf-hint></p>
      <label data-bf-field="category">Categoria<select name="category"><option value="">Selecione</option>${options(categories)}</select></label>
      <label class="bf-wide">Descrição<input name="description" maxlength="180" required placeholder="Ex.: Compra de insumos"></label>
      <label data-bf-field="competence">Data de competência<input type="date" name="competence" required value="${defaultDay}" min="2000-01-01" max="2099-12-31"></label>
      <label><span data-bf-amount>Valor (R$)</span><input name="amount" inputmode="decimal" required placeholder="0,00"></label>
      <label data-bf-field="net">Valor líquido creditado (R$)<input name="net" inputmode="decimal" required placeholder="0,00"></label>
      <label data-bf-field="due">Vencimento<input type="date" name="due" min="2000-01-01" max="2099-12-31"></label>
      <label data-bf-field="status">Situação<select name="status"><option value="paid">Já liquidado</option><option value="open">Em aberto</option></select></label>
      <label data-bf-field="paid">Data da movimentação<input type="date" name="paid" value="${defaultDay}" min="2000-01-01" max="${data.today}" required></label>
      <div data-bf-field="account">${accountField('account')}</div>
      <div data-bf-field="destination">${accountField('destination', 'Conta de destino')}</div>
    `, 'Salvar lançamento', fields => {
      const kind = fields.get('kind');
      const amount = moneyInput(fields.get('amount'));
      const net = kind === 'settlement' ? moneyInput(fields.get('net')) : null;
      if (!amount || (kind === 'settlement' && (net == null || net > amount))) throw new Error('Confira os valores em reais.');
      const account = fields.get('account');
      const destination = fields.get('destination');
      if (destination && destination === account) throw new Error('Escolha contas diferentes para a transferência.');
      const entry = {
        kind, category: fields.get('category') || fixedCategory[kind], description: fields.get('description'),
        competence: fields.get('competence') || fields.get('paid'), paid_on: fields.get('paid'),
        due_on: fields.get('due') || null, account, destination, amount_cents: amount, net_cents: net,
      };
      const payload = JSON.stringify(entry);
      if (submitted && payload !== submitted) id = crypto.randomUUID();
      submitted = payload;
      return call('entry', { entry: { ...entry, id } });
    }, () => reload('Lançamento salvo.'));
    const sync = () => {
      const kind = form.elements.kind.value;
      const regular = kind === 'expense' || kind === 'revenue';
      const paid = !regular || form.elements.status.value === 'paid';
      const visible = {
        category: kind === 'expense', competence: regular || kind === 'settlement', net: kind === 'settlement',
        due: regular, status: regular, paid, account: paid, destination: kind === 'transfer',
      };
      for (const [key, show] of Object.entries(visible)) {
        const group = form.querySelector(`[data-bf-field="${key}"]`);
        group.hidden = !show;
        group.querySelector('input, select').disabled = !show;
      }
      form.querySelector('[data-bf-amount]').textContent = kind === 'settlement' ? 'Valor bruto do repasse (R$)' : 'Valor (R$)';
      form.querySelector('[data-bf-hint]').textContent = hints[kind];
    };
    form.elements.kind.onchange = form.elements.status.onchange = sync;
    sync();
  }

  function draw(panel, data, load, message) {
    const views = { overview: 'Visão geral', ledger: 'Lançamentos', closing: 'Fechamento mensal' };
    panel.innerHTML = `<header class="bf-header"><div><h2>Financeiro do Caseirão</h2>
      <p>${monthLabel(selectedMonth)} · Valores em reais</p></div>
      <div class="bf-actions"><label>Mês<input type="month" aria-label="Mês do relatório" value="${selectedMonth}" min="2000-01" max="${data.today.slice(0, 7)}"></label>
      <button type="button" data-bf-export>Baixar CSV</button><button type="button" class="bf-primary" data-bf-new>+ Novo lançamento</button></div></header>
      <div class="bf-status" role="status">${message}</div>
      <div class="bf-summary">
      ${tile('Faturamento', brl(data.revenue), 'Vendas e outras receitas')}
      ${tile('Custo da operação', brl(data.cost + data.operating + data.taxExpense), data.stockValid ? 'Inclui estoque e imposto' : 'Inclui as compras registradas')}
      ${tile(data.result < 0 ? 'Prejuízo' : 'Lucro', brl(data.result), (data.preliminary ? 'Provisório' : 'Apurado') + ' · Margem ' + percent(data.margin), data.result < 0 ? 'bf-loss' : 'bf-profit')}
      ${tile('Variação de caixa', brl(data.cashChange), brl(data.incoming) + ' entrou · ' + brl(data.outgoing) + ' saiu')}
      </div><nav class="bf-tabs" aria-label="Seções do financeiro">${Object.entries(views).map(([key, label]) => `<button type="button" data-bf-view="${key}" aria-pressed="${key === selectedView}">${label}</button>`).join('')}</nav>
      ${{ overview, ledger, closing }[selectedView](data)}`;
    panel.querySelector('input[type=month]').onchange = event => {
      const input = event.target;
      if (!input.value || !input.checkValidity()) { input.value = selectedMonth; return; }
      selectedMonth = input.value;
      load();
    };
    panel.querySelector('[data-bf-export]').onclick = () => exportReport(data);
    panel.querySelector('[data-bf-new]').onclick = () => newEntry(panel, data, load);
    panel.querySelectorAll('[data-bf-view]').forEach(button => {
      button.onclick = () => {
        selectedView = button.dataset.bfView;
        draw(panel, data, load, '');
        panel.querySelector(`[data-bf-view="${selectedView}"]`).focus({ preventScroll: true });
      };
    });
    const filter = panel.querySelector('[data-bf-filter]');
    if (filter) filter.onchange = () => {
      let visible = 0;
      for (const row of panel.querySelectorAll('[data-bf-state]')) {
        row.hidden = filter.value !== 'all' && row.dataset.bfState !== filter.value;
        if (!row.hidden) visible++;
      }
      const empty = panel.querySelector('[data-bf-empty]');
      if (empty) empty.hidden = visible !== 0;
    };
    for (const button of panel.querySelectorAll('[data-bf-pay]')) {
      button.onclick = () => dialog(panel, 'Dar baixa no lançamento', `
        <label>Data da movimentação<input name="day" type="date" min="2000-01-01" max="${data.today}" value="${data.today}" required></label>
        ${accountField('account')}`, 'Confirmar baixa', fields =>
        call('pay', { id: button.dataset.bfPay, payment: { day: fields.get('day'), account: fields.get('account') } }),
      () => load('Baixa registrada.'));
    }
    for (const button of panel.querySelectorAll('[data-bf-void]')) {
      button.onclick = () => dialog(panel, 'Anular lançamento', `<p class="bf-note bf-wide">O lançamento fica no histórico e deixa de compor os totais.</p>
        <label class="bf-wide">Motivo<input name="reason" minlength="3" maxlength="180" required></label>`, 'Anular lançamento',
      fields => call('void', { id: button.dataset.bfVoid, reason: fields.get('reason') }),
      () => load('Lançamento anulado.'));
    }
    const inventory = panel.querySelector('[data-bf-inventory]');
    if (inventory) inventory.onsubmit = event => {
      event.preventDefault();
      submit(inventory, fields => {
        const opening = moneyInput(fields.get('opening'));
        const closing = moneyInput(fields.get('closing'));
        if (opening == null || closing == null) throw new Error('Informe os valores do estoque em reais.');
        if (closing > opening + data.purchases) throw new Error('O estoque final supera o estoque inicial mais as compras registradas.');
        return call('inventory', { month: data.start, inventory: {
          revision: data.inventory?.revision || 0, opening_cents: opening, closing_cents: closing,
        } });
      }, () => load('Estoque salvo.'));
    };
  }

  window.renderBusinessFinance = box => {
    const panel = document.createElement('div');
    panel.className = 'bf-panel';
    box.replaceChildren(panel);
    selectedMonth ||= isoToday().slice(0, 7);
    let requestIndex = 0;
    async function load(message = '') {
      const request = ++requestIndex;
      const wanted = selectedMonth;
      panel.innerHTML = '<p class="bf-loading" role="status">Carregando o financeiro…</p>';
      try {
        const snapshot = await call('month', { month: wanted + '-01' });
        if (panel.isConnected && request === requestIndex) {
          draw(panel, calculate(snapshot, window.CaseiraoFinance), load, message);
        }
      } catch (error) {
        if (!panel.isConnected || request !== requestIndex) return;
        panel.innerHTML = `<p class="bf-error" role="alert">${esc(error.message)}</p><button type="button" class="bf-primary">Tentar novamente</button>`;
        panel.querySelector('button').onclick = () => load(message);
      }
    }
    load();
  };
})();
