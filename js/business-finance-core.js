(function (root) {
  'use strict';
  const categories = {
    insumos: 'Insumos', embalagens: 'Embalagens', equipe: 'Funcionários', entregas: 'Entregas',
    aluguel: 'Aluguel', agua: 'Água', energia: 'Energia', internet: 'Internet', limpeza: 'Limpeza',
    contador: 'Contador', impostos: 'Pagamento do DAS', outros_impostos: 'Outros impostos', taxas: 'Taxas de maquininha',
    prolabore: 'Pró-labore', marketing: 'Marketing', manutencao: 'Manutenção', outros: 'Outras despesas',
  };
  const accountLabels = {
    caixa: 'Caixa físico', mercado_pago: 'Mercado Pago PJ', ton: 'Ton PJ', banco: 'Outra conta bancária',
    reserva: 'Reserva', outro: 'Outra conta', pix: 'Pix a conciliar',
  };
  const categoryLabels = {
    ...categories, outras_receitas: 'Outras receitas', transferencia: 'Transferência',
    repasse: 'Repasse de cartão', capital: 'Aporte ou retirada de capital',
  };
  const ingredients = new Set(['insumos', 'embalagens']);
  const add = (target, key, value) => { target[key] = (target[key] || 0) + value; };
  const card = method => ['Cartão', 'Cartão de débito', 'Cartão de crédito'].includes(method);
  const shopDay = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value || new Date());
  const number = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brl = cents => number.format(cents / 100);
  const moneyInput = value => {
    const raw = String(value).trim();
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw)) return null;
    const [whole, fraction = ''] = raw.replaceAll('.', '').split(',');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(cents) && cents <= 99999999999 ? cents : null;
  };

  function calculate(snapshot, reportCore) {
    const { inventory, prior_inventory, entries, staff_members = [], today, tax, rate_bps, reserved, finance_start: financeStart } = snapshot.operation;
    const { start: monthStart, end } = snapshot.report;
    const start = financeStart && financeStart > monthStart ? financeStart : monthStart;
    const through = end < today ? end : today;
    const report = reportCore.build({ ...snapshot.report, start, end: through });
    const inside = date => date && date >= start && date <= through;
    const days = new Map();
    for (let i = Number(start.slice(-2)); i <= Number(through.slice(-2)); i++) {
      const day = start.slice(0, 8) + String(i).padStart(2, '0');
      days.set(day, { day, sales: 0, in: 0, out: 0 });
    }
    let sales = 0, extra = 0, purchases = 0, incoming = 0, outgoing = 0;
    let paidExpenses = 0;
    let cardPaid = 0, cardRefunds = 0, cardSettled = 0, unidentified = 0, taxesPaid = 0;
    let payables = 0, receivables = 0, overdue = 0, transfers = 0;
    const expenses = {}, byAccount = {};
    const cash = (date, account, value, direction) => {
      if (direction === 'in') incoming += value;
      else outgoing += value;
      if (days.has(date)) days.get(date)[direction] += value;
      add(byAccount, account, direction === 'in' ? value : -value);
    };
    for (const row of report.daily) {
      const value = row.sales + (row.staffSales || 0);
      sales += value;
      if (days.has(row.day)) days.get(row.day).sales += value;
    }
    for (const receipt of report.receipts) {
      if (!receipt.at) continue;
      const date = reportCore.day(receipt.at);
      if (card(receipt.method)) {
        if (receipt.kind === 'refund') cardRefunds += receipt.amount;
        else cardPaid += receipt.kind === 'correction' ? -receipt.amount : receipt.amount;
      } else if (receipt.method === 'Pix' || receipt.method === 'Dinheiro') {
        cash(date, receipt.method === 'Pix' ? 'pix' : 'caixa',
          receipt.kind === 'correction' ? -receipt.amount : receipt.amount,
          receipt.kind === 'refund' ? 'out' : 'in');
      } else {
        unidentified += receipt.kind === 'receipt' ? receipt.amount : -receipt.amount;
      }
    }
    for (const payroll of report.payrollOutflows) {
      const sign = payroll.event_label === 'Pagamento ao funcionário' ? 1 : -1;
      add(expenses, 'equipe', payroll.signed_cents + sign * Number(payroll.staff_discount_cents || 0));
      paidExpenses += payroll.signed_cents;
      cash(reportCore.day(payroll.event_at), payroll.payment_method === 'Dinheiro' ? 'caixa' : 'outro', payroll.signed_cents, 'out');
    }
    for (const advance of report.staffOutflows) {
      cash(reportCore.day(advance.created_at), advance.method === 'Dinheiro' ? 'caixa' : 'outro', advance.signed_cents, 'out');
    }
    for (const entry of entries) {
      if (entry.voided_at) continue;
      const { kind, category, competence, paid_on, due_on, account, destination, amount_cents: amount, net_cents: net } = entry;
      if (!paid_on && (competence <= through)) {
        if (kind === 'expense') {
          payables += amount;
          if (due_on && due_on < today && due_on <= end) overdue += amount;
        }
        if (kind === 'revenue') receivables += amount;
      }
      if (inside(competence)) {
        if (kind === 'revenue') extra += amount;
        if (kind === 'settlement') add(expenses, 'taxas', amount - net);
        if (kind === 'expense') {
          if (ingredients.has(category)) purchases += amount;
          else if (category !== 'impostos') add(expenses, category, amount);
        }
      }
      if (!inside(paid_on)) continue;
      if (kind === 'transfer') {
        transfers += amount;
        add(byAccount, account, -amount);
        add(byAccount, destination, amount);
      } else if (kind === 'settlement') {
        cardSettled += amount;
        paidExpenses += amount - net;
        cash(paid_on, account, net, 'in');
      } else {
        if (kind === 'expense') paidExpenses += amount;
        if (category === 'impostos') taxesPaid += amount;
        cash(paid_on, account, amount, kind === 'expense' || kind === 'capital_out' ? 'out' : 'in');
      }
    }
    const estimatedTax = report.daily.reduce((total, row) => total + Math.round(row.sales * rate_bps / 10000), 0);
    const inventoryCost = inventory ? inventory.opening_cents + purchases - inventory.closing_cents : null;
    const stockValid = inventoryCost != null && inventoryCost >= 0;
    const cost = stockValid ? inventoryCost : purchases;
    const operating = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
    const taxExpense = tax ?? estimatedTax;
    const revenue = sales + extra;
    const totalCosts = cost + operating + taxExpense;
    const result = revenue - totalCosts;
    return {
      start, end, through, today, financeStart, days: [...days.values()], sales, customerSales: report.totals.sales,
      staffSales: report.totals.staffSales, extra, revenue, purchases, cost, stockValid, inventory,
      priorInventory: prior_inventory, expenses, operating, tax, taxExpense, taxesPaid, reserved,
      totalCosts, paidExpenses, result, margin: revenue > 0 ? result / revenue : null,
      preliminary: !stockValid || tax == null || today <= end,
      incoming, outgoing, cashChange: incoming - outgoing, byAccount, transfers,
      cardPaid, cardRefunds, cardSettled, unidentified, undated: report.totals.undated,
      payables, overdue, receivables, orderDue: report.totals.due, issues: report.issues.length, entries, staffMembers: staff_members,
    };
  }
  const api = { calculate, categories, categoryLabels, accountLabels, shopDay, brl, moneyInput };
  root.CaseiraoBusinessFinance = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
