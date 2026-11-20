(() => {
  'use strict';
  const entry='cartao_caseirao';
  const simulator=renderAdminTab;
  let selected='';
  const money=value=>fmt(value/100);
  const date=value=>String(value||'').split('-').reverse().join('/');
  const timestamp=value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}):'';
  const number=value=>String(value??'').trim().replace(',','.');
  const formatPercent=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:4});
  const readTerms=data=>{
    const rate=number(data.rate), days=Number(data.days);
    if(!/^\d+(?:\.\d{1,4})?$/.test(rate)||Number(rate)<=0||Number(rate)>100||!Number.isInteger(days)||days<1||days>30)return null;
    return {rate:Number(rate),days,rate_per_term:true};
  };
  const termFields=(days=7,rate='')=>`
    <label>Prazo por compra, em dias<input class="in" name="days" type="number" min="1" max="30" value="${days}" required></label>
    <label>Juros para o prazo escolhido (%)<input class="in" name="rate" inputmode="decimal" value="${esc(rate)}" required></label>
  `;

  const call=(action,payload={})=>api('caseirao-card',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,payload,pin:sessionStorage.getItem('caseirao_admin_pin')||''})
  });
  const profileAddress=charge=>{
    const order=charge.orders||{};
    return [order.address_street,order.address_number,order.address_complement,order.neighborhood_name].filter(Boolean).join(', ');
  };

  const searchKey=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const phoneDigits=value=>String(value??'').replace(/\D/g,'');
  const shortDate=value=>value?new Date(value).toLocaleDateString('pt-BR',{timeZone:'America/Fortaleza',day:'2-digit',month:'2-digit'}):'—';

  async function draw(box){
    box.innerHTML=`<section class="admCardCaseirao">
      <div class="admCardActions admCardToolbar">
        <button type="button" class="secondary" data-card-manage>Cartões e compras</button>
        <button type="button" class="secondary" data-card-simulator>Simular taxa</button>
        <button type="button" class="primary" data-card-release>+ Liberar cartão</button>
      </div>
      <div class="admCardWorkspace">
        <section class="admCardPanel admCardClients" aria-labelledby="admCardClientsTitle">
          <h2 id="admCardClientsTitle">Clientes</h2>
          <input type="search" class="in admCardSearch" aria-label="Buscar por nome ou telefone" placeholder="Buscar por nome ou telefone">
          <div class="admCardClientList" data-card-clients><p role="status">Consultando cartões…</p></div>
        </section>
        <section class="admCardPanel admCardClientDetail" data-card-detail></section>
      </div>
      <dialog class="admCardDialog" data-card-dialog aria-labelledby="admCardReleaseTitle">
        <section class="admCardPanel">
          <div class="admCardDialogHead"><h2 id="admCardReleaseTitle">Liberar cartão</h2><button type="button" class="secondary" data-card-close>Fechar</button></div>
          <form data-card-approve>
            <label>Nome completo<input class="in" name="name" maxlength="150" required></label>
            <label>WhatsApp com DDD<input class="in" name="phone" type="tel" required></label>
            <label class="admCardWide">Endereço residencial<input class="in" name="address" maxlength="350" placeholder="Rua, número, bairro, cidade e complemento" required></label>
            <label>Limite em reais<input class="in" name="limit" inputmode="decimal" required></label>
            ${termFields()}
            <p class="admCardWide">A taxa informada vale para o prazo escolhido acima.</p>
            <button class="primary">Liberar cartão</button>
          </form>
          <div data-card-approve-status role="status"></div>
        </section>
      </dialog>
    </section>`;
    const root=box.querySelector('.admCardCaseirao');
    const clients=root.querySelector('[data-card-clients]');
    const search=root.querySelector('.admCardSearch');
    const detail=root.querySelector('[data-card-detail]');
    const toolbar=root.querySelector('.admCardToolbar');
    const title=box.closest('.proAdmin')?.querySelector('.proPageTitle');
    if(title){
      title.querySelector('.admCardToolbar')?.remove();
      title.append(toolbar);
    }
    const dialog=root.querySelector('[data-card-dialog]');
    const form=root.querySelector('[data-card-approve]');
    const close=dialog.querySelector('[data-card-close]');
    const status=dialog.querySelector('[data-card-approve-status]');
    const approve=form.querySelector('button');
    const release=toolbar.querySelector('[data-card-release]');
    const manage=toolbar.querySelector('[data-card-manage]');
    const simulate=toolbar.querySelector('[data-card-simulator]');
    let accounts=[];
    let detailRequest=0;

    manage.onclick=()=>search.focus();
    simulate.onclick=()=>{
      toolbar.remove();
      simulator();
      const back=document.createElement('button');
      back.type='button';
      back.className='secondary admCardSimulatorBack';
      back.textContent='← Cartões e compras';
      back.onclick=()=>draw(box);
      box.prepend(back);
    };
    release.disabled=true;
    release.onclick=()=>{
      form.reset();
      form.hidden=false;
      status.replaceChildren();
      dialog.showModal();
    };
    close.onclick=()=>dialog.close();
    dialog.addEventListener('cancel',event=>{if(approve.disabled)event.preventDefault();});

    function reflectSelection(){
      clients.querySelectorAll('[data-card-client]').forEach(button=>{
        button.setAttribute('aria-pressed',String(button.dataset.cardClient===selected));
      });
    }

    function renderClients(){
      const query=searchKey(search.value.trim());
      const digits=phoneDigits(query);
      const searchesPhone=digits&&/^[+()\d\s.-]+$/.test(query);
      const visible=accounts.filter(account=>searchKey(account.name).includes(query)
        ||(searchesPhone&&phoneDigits(account.phone).includes(digits)));
      clients.innerHTML=visible.length?visible.map(account=>{
        const initials=String(account.name||'').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('pt-BR');
        return `<button type="button" data-card-client="${esc(account.id)}" aria-pressed="${String(account.id)===selected}">
          <span class="admCardAvatar" aria-hidden="true">${esc(initials)}</span>
          <span><b>${esc(account.name)}</b><small>${esc(account.phone||'')}</small></span>
        </button>`;
      }).join(''):`<p>${accounts.length?'Nenhum cliente encontrado.':'Nenhum cartão cadastrado.'}</p>`;
      clients.querySelectorAll('[data-card-client]').forEach(button=>button.onclick=()=>{
        if(selected===button.dataset.cardClient&&detail.querySelector('.admCardIdentity'))return;
        selected=button.dataset.cardClient;
        reflectSelection();
        loadDetail();
      });
    }

    async function loadDetail(){
      const request=++detailRequest;
      const id=selected,account=accounts.find(item=>String(item.id)===id);
      if(!account){
        detail.innerHTML='<p class="admCardEmpty">Selecione um cliente para consultar o cartão.</p>';
        return;
      }
      detail.innerHTML='<p role="status">Consultando compras…</p>';
      try{
        const {charges}=await call('detail',{account:account.id});
        if(!detail.isConnected||request!==detailRequest)return;
        renderDetail(detail,account,charges,()=>selected===id?loadDetail():undefined);
      }catch(error){
        if(detail.isConnected&&request===detailRequest)detail.textContent=error.message;
      }
    }

    form.onsubmit=async event=>{
      event.preventDefault();
      if(approve.disabled||form.hidden)return;
      const data=Object.fromEntries(new FormData(form));
      const terms=readTerms(data);
      if(!/^\d+([.,]\d{1,2})?$/.test(data.limit.trim())||!terms){
        status.textContent='Confira o limite, o prazo e os juros para o prazo escolhido.';
        return;
      }
      approve.disabled=close.disabled=true;
      status.textContent='Liberando cartão…';
      try{
        const result=await call('approve',{...data,limit:Math.round(Number(number(data.limit))*100),...terms});
        if(!root.isConnected)return;
        selected=String(result.account.id);
        const existing=accounts.findIndex(account=>String(account.id)===selected);
        if(existing<0)accounts.push(result.account);
        else accounts[existing]=result.account;
        search.value='';
        renderClients();
        form.hidden=true;
        showCode(status,result.token);
        close.disabled=false;
        close.focus();
        loadDetail();
      }catch(error){status.textContent=error.message;}
      finally{approve.disabled=close.disabled=false;}
    };
    search.oninput=renderClients;
    try{
      const result=await call('accounts');
      if(!root.isConnected)return;
      accounts=result.accounts;
      selected=String((accounts.find(account=>String(account.id)===selected)||accounts[0])?.id??'');
      release.disabled=false;
      renderClients();
      await loadDetail();
    }catch(error){
      if(root.isConnected)clients.textContent=error.message;
    }
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
    const recent=[...charges].sort((first,second)=>String(second.purchased_at||'').localeCompare(String(first.purchased_at||'')));
    detail.innerHTML=`
      <header class="admCardIdentity">
        <h2>${esc(account.name)}</h2>
        <span class="admCardBadge ${account.active?'is-active':'is-closed'}">${account.active?'Cartão ativo':'Cartão bloqueado'}</span>
        ${invoices.some(day=>day<today)?'<span class="admCardBadge is-overdue">Fatura vencida</span>':''}
      </header>
      <dl class="admCardSummary admCardBalances">
        <div><dt>Limite disponível</dt><dd>${money(Math.max(0,account.credit_limit-balance))}</dd><small>Limite total ${money(account.credit_limit)}</small></div>
        <div><dt>Valor em aberto</dt><dd>${money(balance)}</dd></div>
      </dl>
      <section class="admCardPurchases">
        <h3>Compras recentes</h3>
        <div class="admCardTable"><table>
          <thead><tr><th scope="col">Pedido</th><th scope="col">Data</th><th scope="col">Valor</th><th scope="col">Situação</th></tr></thead>
          <tbody>${recent.map(charge=>{
            const state=charge.cancelled_at?'Estornado':charge.payment_id?'Pago':charge.due_date<today?'Vencido':'Em aberto';
            const tone=charge.cancelled_at?'is-closed':charge.payment_id?'is-active':charge.due_date<today?'is-overdue':'is-open';
            return `<tr><td><details class="admCardPurchaseInfo"><summary>#${esc(charge.order_number)}</summary>
              <small>${esc(timestamp(charge.purchased_at))}</small>
              <small>Vencimento ${esc(date(charge.due_date))}</small>
              <small>${esc(profileAddress(charge)||'Retirada ou consumo local')}</small>
              ${charge.payment_id?`<small>${esc(charge.caseirao_card_payments?.method||'')} ${esc(timestamp(charge.caseirao_card_payments?.paid_at))}</small>`:''}
              </details></td><td>${esc(shortDate(charge.purchased_at))}</td>
              <td class="admCardAmount">${money(charge.principal+charge.interest)}${charge.interest?`<small>${money(charge.interest)} de acréscimo</small>`:''}</td>
              <td><span class="admCardBadge ${tone}">${state}</span></td></tr>`;
          }).join('')||'<tr><td colspan="4">Nenhuma compra registrada.</td></tr>'}</tbody>
        </table></div>
      </section>
      <section class="admCardInvoices">
        <h3>Faturas em aberto</h3>
        <div class="admCardActions">${invoices.map(due=>`<button type="button" class="secondary" data-card-invoice="${esc(due)}">${due<today?'Vencida · ':''}${esc(date(due))}</button>`).join('')||'<p>Nenhuma fatura em aberto.</p>'}</div>
        <div data-card-settlement></div>
      </section>
      <details class="admCardPanel admCardAccountSettings">
        <summary>Gerenciar cartão</summary>
        <dl class="admCardSummary">
          <div><dt>WhatsApp</dt><dd>${esc(account.phone)}</dd></div>
          <div><dt>Endereço residencial</dt><dd>${esc(account.address)}</dd></div>
          <div><dt>Prazo atual</dt><dd>${account.term_days} dias por compra</dd></div>
          <div><dt>Juros atuais</dt><dd>${formatPercent(account.rate)}% ${account.rate_per_term?'no prazo acima':'por 30 dias, proporcional ao prazo'}</dd></div>
        </dl>
        <div class="admCardActions"><button type="button" class="secondary" data-card-toggle>${account.active?'Bloquear novas compras':'Reativar compras'}</button>
          <button type="button" class="secondary" data-card-code>Gerar novo link privado</button></div>
        <div data-card-feedback role="status"></div>
        <h3>Editar prazo e juros reais</h3>
        <form data-card-terms>
          ${termFields(account.term_days,account.rate_per_term?formatPercent(account.rate):'')}
          <p class="admCardWide">O prazo e os juros salvos valem para as próximas compras.</p>
          <button class="primary">Salvar prazo e juros</button>
          <p class="admCardWide" role="status"></p>
        </form>
      </details>`;
    const feedback=detail.querySelector('[data-card-feedback]');
    const termsForm=detail.querySelector('[data-card-terms]');
    termsForm.onsubmit=async event=>{
      event.preventDefault();
      const terms=readTerms(Object.fromEntries(new FormData(termsForm)));
      const status=termsForm.querySelector('[role="status"]');
      if(!terms){status.textContent='Informe o prazo de 1 a 30 dias e a taxa para esse prazo.';return;}
      const button=termsForm.querySelector('button');
      button.disabled=true;
      try{
        const result=await call('update_terms',{account:account.id,...terms});
        Object.assign(account,result.account);
        if(detail.isConnected&&detail.contains(termsForm)){
          renderDetail(detail,account,charges,refresh);
          detail.querySelector('.admCardAccountSettings').open=true;
          detail.querySelector('[data-card-terms] [role="status"]').textContent='Prazo e juros salvos para as próximas compras.';
        }
      }catch(error){status.textContent=error.message;}
      finally{button.disabled=false;}
    };
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
