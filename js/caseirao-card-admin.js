(() => {
  'use strict';
  const entry='cartao_caseirao';
  const simulator=renderAdminTab;
  let selected='';
  const money=value=>fmt(value/100);
  const date=value=>String(value||'').split('-').reverse().join('/');
  const timestamp=value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}):'';
  const number=value=>String(value??'').trim().replace(',','.');
  const call=(action,payload={})=>api('caseirao-card',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,payload,pin:sessionStorage.getItem('caseirao_admin_pin')||''})
  });
  const profileAddress=charge=>{
    const order=charge.orders||{};
    return [order.address_street,order.address_number,order.address_complement,order.neighborhood_name].filter(Boolean).join(', ');
  };

  async function draw(box){
    box.innerHTML=`<section class="admCardCaseirao">
      <div class="admCardActions"><button type="button" class="secondary" data-card-manage>Clientes e compras</button>
      <button type="button" class="secondary" data-card-simulator>Simular taxa</button></div>
      <div data-card-body></div>
    </section>`;
    const body=box.querySelector('[data-card-body]');
    box.querySelector('[data-card-simulator]').onclick=()=>{
      const scaffold=body.cloneNode(false);
      body.replaceWith(scaffold);
      // The simulator is also available as an independent returnable view.
      simulator();
      const back=document.createElement('button');
      back.type='button';back.className='secondary';back.textContent='Voltar a clientes e compras';
      back.onclick=()=>draw(box);box.prepend(back);
    };
    box.querySelector('[data-card-manage]').onclick=()=>draw(box);
    body.innerHTML='<p role="status">Consultando cartões…</p>';
    try{
      const {accounts}=await call('accounts');
      if(!body.isConnected)return;
      body.innerHTML=`<details class="admCardPanel"><summary><b>Liberar cartão para um cliente</b></summary>
        <form data-card-approve>
          <label>Nome completo<input class="in" name="name" maxlength="150" required></label>
          <label>WhatsApp com DDD<input class="in" name="phone" type="tel" required></label>
          <label class="admCardWide">Endereço residencial<input class="in" name="address" maxlength="350" placeholder="Rua, número, bairro, cidade e complemento" required></label>
          <label>Limite em reais<input class="in" name="limit" inputmode="decimal" required></label>
          <label>Taxa para 30 dias (%)<input class="in" name="rate" inputmode="decimal" required></label>
          <label>Prazo por compra, em dias<input class="in" name="days" type="number" min="1" max="30" value="30" required></label>
          <button class="primary">Liberar cartão</button>
          <p class="admCardWide" data-card-approve-status role="status"></p>
        </form></details>
        <div class="admCardPanel">
          <label>Cliente<select class="in" data-card-client><option value="">Escolher cliente</option>${accounts.map(item=>`<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.phone)}</option>`).join('')}</select></label>
          <div data-card-detail></div>
        </div>`;

      const chooser=body.querySelector('[data-card-client]');
      const detail=body.querySelector('[data-card-detail]');
      const form=body.querySelector('[data-card-approve]');
      chooser.value=selected;
      form.onsubmit=async event=>{
        event.preventDefault();
        const button=form.querySelector('button');
        const status=form.querySelector('[data-card-approve-status]');
        const data=Object.fromEntries(new FormData(form));
        if(!/^\d+([.,]\d{1,2})?$/.test(data.limit.trim())||!/^\d+([.,]\d{1,4})?$/.test(data.rate.trim())){
          status.textContent='Informe limite e taxa em números, usando vírgula ou ponto para decimais.';
          return;
        }
        button.disabled=true;
        try{
          const result=await call('approve',{...data,limit:Math.round(Number(number(data.limit))*100),rate:Number(number(data.rate)),days:Number(data.days)});
          selected=result.account.id;
          accounts.push(result.account);
          chooser.add(new Option(result.account.name+' · '+result.account.phone,selected));
          chooser.value=selected;
          form.reset();
          showCode(status,result.token);
          await loadDetail();
        }catch(error){status.textContent=error.message;}
        finally{button.disabled=false;}
      };
      chooser.onchange=loadDetail;
      await loadDetail();

      async function loadDetail(){
        const id=chooser.value;
        selected=id;
        const account=accounts.find(item=>item.id===id);
        if(!account){detail.replaceChildren();return;}
        detail.textContent='Consultando compras…';
        try{
          const result=await call('detail',{account:id});
          if(!detail.isConnected||chooser.value!==id)return;
          renderDetail(detail,account,result.charges,loadDetail);
        }catch(error){if(chooser.value===id)detail.textContent=error.message;}
      }
    }catch(error){body.textContent=error.message;}
  }

  function showCode(container,token){
    const link='https://caseiraopedidos.api.br/#cartao-caseirao='+token;
    const label=document.createElement('label');label.textContent='Link privado. Entregue apenas ao titular.';
    const input=document.createElement('input');input.className='in';input.readOnly=true;input.value=link;
    const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Copiar link privado';
    button.onclick=async()=>{
      input.select();
      try{await navigator.clipboard.writeText(link);button.textContent='Link copiado';}
      catch{button.textContent='Copie o link selecionado';}
    };
    label.append(input);container.replaceChildren(label,button);
  }

  function renderDetail(detail,account,charges,refresh){
    const active=charges.filter(c=>!c.cancelled_at&&!c.payment_id);
    const balance=active.reduce((sum,c)=>sum+c.principal+c.interest,0);
    const invoices=Array.from(new Set(active.map(c=>c.due_date))).sort();
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    detail.innerHTML=`<dl class="admCardSummary">
      <div><dt>Nome</dt><dd>${esc(account.name)}</dd></div>
      <div><dt>WhatsApp</dt><dd>${esc(account.phone)}</dd></div>
      <div><dt>Endereço residencial cadastrado</dt><dd>${esc(account.address)}</dd></div>
      <div><dt>Limite disponível</dt><dd>${money(Math.max(0,account.credit_limit-balance))} de ${money(account.credit_limit)}</dd></div>
      <div><dt>A receber</dt><dd>${money(balance)}</dd></div>
      <div><dt>Situação</dt><dd>${account.active?'Ativo':'Bloqueado'}${invoices.some(day=>day<today)?' · fatura vencida':''}</dd></div>
    </dl>
    <div class="admCardActions"><button type="button" class="secondary" data-card-toggle>${account.active?'Bloquear novas compras':'Reativar compras'}</button>
    <button type="button" class="secondary" data-card-code>Gerar novo link privado</button></div>
    <div data-card-feedback role="status"></div>
    <h3>Faturas em aberto</h3>
    <div class="admCardActions">${invoices.map(due=>`<button type="button" class="secondary" data-card-invoice="${esc(due)}">${due<today?'Vencida · ':''}${date(due)}</button>`).join('')||'<p>Nenhuma fatura em aberto.</p>'}</div>
    <div data-card-settlement></div>
    <h3>Histórico de compras</h3>
    <div class="admCardTable"><table><thead><tr><th>Pedido e data</th><th>Valor usado</th><th>Vencimento</th><th>Endereço da entrega</th><th>Situação</th></tr></thead><tbody>
      ${charges.map(c=>`<tr><td>#${esc(c.order_number)}<br>${esc(timestamp(c.purchased_at))}</td><td>${money(c.principal+c.interest)}<br><small>${money(c.interest)} de acréscimo</small></td><td>${date(c.due_date)}</td><td>${esc(profileAddress(c)||'Retirada ou consumo local')}</td>
      <td>${c.cancelled_at?'Estornado':c.payment_id?`Pago · ${esc(c.caseirao_card_payments?.method||'')}<br>${esc(timestamp(c.caseirao_card_payments?.paid_at))}`:c.due_date<today?'Vencido':'A receber'}</td></tr>`).join('')}
      ${charges.length?'':'<tr><td colspan="5">Nenhuma compra registrada.</td></tr>'}
    </tbody></table></div>`;
    const feedback=detail.querySelector('[data-card-feedback]');
    const toggle=detail.querySelector('[data-card-toggle]');
    toggle.onclick=async()=>{
      toggle.disabled=true;
      try{const result=await call('toggle',{account:account.id,active:!account.active});Object.assign(account,result.account);await refresh();}
      catch(error){feedback.textContent=error.message;toggle.disabled=false;}
    };
    const reset=detail.querySelector('[data-card-code]');
    reset.onclick=async()=>{
      if(!confirm('Gerar um novo link e invalidar o acesso anterior deste cliente?'))return;
      reset.disabled=true;
      try{const result=await call('reset_code',{account:account.id});showCode(feedback,result.token);}
      catch(error){feedback.textContent=error.message;}
      finally{reset.disabled=false;}
    };
    const settlement=detail.querySelector('[data-card-settlement]');
    detail.querySelectorAll('[data-card-invoice]').forEach(button=>button.onclick=()=>openInvoice(settlement,account.id,button.dataset.cardInvoice,refresh));
  }

  async function openInvoice(box,account,due,refresh){
    box.textContent='Conferindo o total da fatura…';
    try{
      const invoice=await call('invoice',{account,due});
      if(!box.isConnected)return;
      box.innerHTML=`<form class="admCardPanel" data-card-settle>
      <p><b>Fatura de ${date(due)} · ${money(invoice.amount)}</b></p>
      <label>Como recebeu<select class="in" name="method"><option>Dinheiro</option><option>Débito</option><option>Crédito</option><option>Pix</option></select></label>
      <button class="primary" ${invoice.ready?'':'disabled'}>Confirmar recebimento</button>
      <p role="status">${invoice.ready?'Registre depois de conferir o recebimento integral.':'Finalize as comandas desta fatura antes de dar baixa.'}</p></form>`;
      const form=box.querySelector('form');
      const request=crypto.randomUUID();
      form.onsubmit=async event=>{
        event.preventDefault();
        const method=form.elements.namedItem('method').value;
        if(!confirm(`Você já recebeu ${money(invoice.amount)} via ${method}?`))return;
        const button=form.querySelector('button');
        button.disabled=true;
        try{await call('settle',{account,due,method,amount:invoice.amount,request});await refresh();}
        catch(error){form.querySelector('[role="status"]').textContent=error.message;button.disabled=false;}
      };
    }catch(error){box.textContent=error.message;}
  }

  renderAdminTab=function(...args){
    if(adminTab!==entry)return simulator.apply(this,args);
    const box=document.querySelector('#admContent');
    if(box)draw(box);
  };
})();
