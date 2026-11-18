'use strict';

(() => {
  const payroll = window.CaseiraoPayroll;
  const money = value => fmt(Number(value));
  const date = value => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
  const singleLine = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const companyId = value => value.toUpperCase().replace(/[.\/\s-]/g, '');
  function validCompanyId(value) {
    if (/^\d{14}$/.test(value)) return payroll.validCnpj(value);
    if (!/^[A-Z0-9]{12}\d{2}$/.test(value)) return false;
    const digit = length => {
      let sum = 0;
      for (let i = 0; i < length; i++) {
        const weight = 2 + (length - i - 1) % 8;
        sum += (value.charCodeAt(i) - 48) * weight;
      }
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
  }
  const formattedCompanyId = value => value.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
  const request = id => api('caseirao-sale-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: sessionStorage.getItem('caseirao_admin_pin') || '', order_id: id }),
  });

  function receiptLines(sale, buyer, cnpj) {
    const company = sale.company;
    const itemCents = sale.items.reduce((sum, item) => sum + Math.round(Number(item.total) * 100), 0);
    const adjustment = Math.round(Number(sale.total) * 100) - itemCents;
    const lines = [
      company.trade_name,
      company.legal_name,
      'CNPJ ' + payroll.cnpj(company.cnpj),
      [company.address, company.city].filter(Boolean).join(' · '),
      '',
      'RECIBO DE VENDA',
      'DOCUMENTO NÃO FISCAL',
      '',
      sale.reference,
      (sale.is_table ? 'Mesa fechada em ' : 'Pedido em ') + date(sale.sale_date),
      sale.paid_date ? 'Pagamento em ' + date(sale.paid_date) : 'Pagamento confirmado · data não registrada',
      'Recebemos de ' + buyer,
      cnpj ? 'CNPJ do cliente ' + formattedCompanyId(cnpj) : '',
      '',
      'ITENS E VALORES DA COMANDA',
      ...sale.items.flatMap(item => [
        item.quantity + ' × ' + item.name + ' · ' + money(item.total),
        ...(item.addons.length ? ['  + ' + item.addons.join(', ')] : []),
      ]),
      '',
      ...(adjustment ? ['Ajustes da venda: ' + money(adjustment / 100)] : []),
      ...sale.payments.map(payment => payment.method + ' · ' + money(payment.amount)),
      'TOTAL PAGO ' + money(sale.total),
      '',
      'Emitido em ' + date(new Date()),
    ];
    return lines.map(singleLine);
  }

  function receiptCanvas(lines) {
    const canvas = document.createElement('canvas');
    canvas.width = 576;
    canvas.height = 46 + lines.length * 29;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#151515';
    ctx.textBaseline = 'middle';
    lines.forEach((line, index) => {
      ctx.font = (line === 'RECIBO DE VENDA' || line.startsWith('TOTAL PAGO ') ? 'bold ' : '') + '22px monospace';
      ctx.fillText(line, 22, 28 + index * 29, 532);
    });
    return canvas;
  }

  function download(receipt, orderId) {
    const url = URL.createObjectURL(new Blob([payroll.pdf(receipt)], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'caseirao-recibo-' + orderId.slice(0, 8) + '.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function open(id) {
    modal(`<div class="sheeth"><h2>Recibo da venda</h2><button type="button" class="x" data-close aria-label="Fechar">×</button></div>
      <div id="saleReceiptBody" aria-live="polite">Conferindo o pagamento…</div>`);
    bindClose();
    const body = $('#saleReceiptBody');
    try {
      const sale = await request(id);
      if (!body.isConnected) return;
      if (!sale.company?.legal_name || !payroll.validCnpj(sale.company.cnpj)) {
        throw new Error('Confira os dados da empresa em Gestão → Pagamentos da equipe → Dados da empresa.');
      }
      body.innerHTML = `<p><b>${esc(sale.reference)}</b> · ${esc(money(sale.total))}</p>
        ${sale.is_table ? '<p class="mini">Este recibo inclui todas as comandas da mesa fechada.</p>' : ''}
        <p class="mini">${esc(sale.company.trade_name)} · CNPJ ${esc(payroll.cnpj(sale.company.cnpj))} · Documento não fiscal</p>
        <form id="saleReceiptForm">
          <div class="field"><label for="saleReceiptBuyer">Nome da empresa ou do cliente</label>
            <input class="in" id="saleReceiptBuyer" maxlength="150" required></div>
          <div class="field"><label for="saleReceiptCnpj">CNPJ da empresa cliente (opcional)</label>
            <input class="in" id="saleReceiptCnpj" autocapitalize="characters" maxlength="18"></div>
          <div class="finPaymentActions">
            <button type="submit" class="primary" value="print">Imprimir rápido · Bluetooth 80 mm</button>
            <button type="submit" class="secondary" value="pdf">Baixar PDF · 80 mm</button>
          </div>
          <p id="saleReceiptStatus" role="status"></p>
        </form>`;
      const form = body.querySelector('#saleReceiptForm');
      const status = body.querySelector('#saleReceiptStatus');
      form.onsubmit = async event => {
        event.preventDefault();
        const buyer = singleLine(form.querySelector('#saleReceiptBuyer').value);
        const cnpj = companyId(form.querySelector('#saleReceiptCnpj').value.trim());
        if (buyer.length < 2 || (cnpj && !validCompanyId(cnpj))) {
          status.textContent = buyer.length < 2 ? 'Informe o nome de quem pagou.' : 'Confira o CNPJ da empresa cliente.';
          return;
        }
        const printing = event.submitter?.value !== 'pdf';
        if (printing && !window.confirm('Imprimir o recibo para ' + buyer + '?')) return;
        const buttons = Array.from(form.querySelectorAll('button'));
        buttons.forEach(button => { button.disabled = true; });
        try {
          if (printing && !printerConnected()) await connectBluetoothPrinter();
          status.textContent = 'Conferindo o pagamento…';
          const currentSale = await request(id);
          if (!form.isConnected) return;
          const lines = receiptLines(currentSale, buyer, cnpj);
          if (printing) {
            status.textContent = 'Enviando para a impressora…';
            await btWrite(payroll.thermalTextBytes(lines, printerTextWidth()));
            status.textContent = 'Recibo enviado para a impressora.';
          } else {
            download(receiptCanvas(lines.flatMap(line => wrapReceipt(line, 40))), id);
            status.textContent = 'PDF do recibo gerado.';
          }
        } catch (error) {
          status.textContent = error.message || String(error);
        } finally {
          buttons.forEach(button => { button.disabled = false; });
        }
      };
    } catch (error) {
      body.textContent = error.message || String(error);
    }
  }

  window.CaseiraoSaleReceipt = { open };
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-sale-receipt]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    open(button.dataset.saleReceipt);
  });
})();
