'use strict';
/* CONTROLE FINANCEIRO DO ENTREGADOR — V25
 * Consolida o valor de troco que sai do caixa e o total que precisa voltar.
 * Usa os campos já persistidos pela API (change_float, cash_received e
 * change_given), sem criar dependência de uma migração adicional no banco. */
(()=>{
  const moneyNumber=value=>{
    if(typeof value==='number')return Number.isFinite(value)?value:0;
    const raw=String(value??'').trim().replace(/R\$|\s/g,'');
    if(!raw)return 0;
    const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;
    const parsed=Number(normalized.replace(/[^0-9.-]/g,''));
    return Number.isFinite(parsed)?parsed:0;
  };
  const isCashOrder=order=>String(order?.payment||'').trim().toLocaleLowerCase('pt-BR')==='dinheiro';
  const suggestedChange=order=>isCashOrder(order)?Math.max(0,moneyNumber(order?.change_for)-moneyNumber(order?.total)):0;
  const expectedReturn=assignment=>{
    const order=assignment?.orders||{};
    const float=Math.max(0,moneyNumber(assignment?.change_float));
    return isCashOrder(order)?float+Math.max(0,moneyNumber(order.total)):float;
  };
  const assignmentFinished=assignment=>['delivered','returned','settled'].includes(assignment?.status);

  const cashControlStyle=document.createElement('style');
  cashControlStyle.textContent=`
    .cashControlHint{margin:9px 0;padding:10px 11px;border:1px solid #cfe1ee;border-radius:11px;background:#f1f8fd;color:#31566f;font-size:11px;line-height:1.45}
    .cashControlHint b{color:#173f59}.cashControlGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:9px 0}
    .cashControlBox{padding:10px;border:1px solid #dce2e7;border-radius:11px;background:#f7f9fa}.cashControlBox small{display:block;color:#68727c;font-size:9px;font-weight:900;text-transform:uppercase}.cashControlBox b{display:block;margin-top:4px;color:#1f252b;font-size:16px}.cashControlBox.return b{color:#147342}
    .cashControlTotals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:11px 0}.cashControlTotal{padding:12px;border:1px solid #dce2e7;border-radius:13px;background:#fff}.cashControlTotal small{display:block;color:#68727c;font-size:9px;font-weight:900;text-transform:uppercase}.cashControlTotal b{display:block;margin-top:5px;font-size:17px}.cashControlTotal.return{border-color:#bcdcc8;background:#f2fbf5}.cashControlTotal.return b{color:#147342}
    @media(max-width:480px){.cashControlTotals{grid-template-columns:1fr 1fr}.cashControlTotal.return{grid-column:1/-1}}
  `;
  document.head.appendChild(cashControlStyle);

  function enhanceAvailableCashFields(root=document){
    root.querySelectorAll('[data-change-float]').forEach(input=>{
      const id=input.dataset.changeFloat;
      const order=(deliveryHub?.orders||[]).find(item=>String(item.id)===String(id));
      if(!order||input.dataset.cashReady==='1')return;
      input.dataset.cashReady='1';
      const suggestion=suggestedChange(order);
      if(suggestion>0&&!input.value)input.value=suggestion.toFixed(2).replace('.',',');
      input.placeholder='R$ 0,00';
      const field=input.closest('.field');
      const label=field?.querySelector('label');
      if(label)label.textContent='Troco que o entregador levará';
      const hint=document.createElement('div');
      hint.className='cashControlHint';
      hint.innerHTML=isCashOrder(order)
        ? `Cliente pediu troco para <b>${fmt(moneyNumber(order.change_for))}</b>. Sugestão de saída: <b>${fmt(suggestion)}</b>. O entregador deverá trazer <b>${fmt(moneyNumber(order.total)+suggestion)}</b>.`
        : 'Pagamento sem dinheiro: deixe o troco em R$ 0,00.';
      field?.appendChild(hint);
    });
  }

  const originalDeliveryAdminCard=deliveryAdminCard;
  deliveryAdminCard=function(assignment){
    const order=assignment?.orders||{};
    const taken=Math.max(0,moneyNumber(assignment?.change_float));
    const expected=expectedReturn(assignment);
    const informed=Math.max(0,moneyNumber(assignment?.cash_received));
    let html=originalDeliveryAdminCard(assignment);
    const label=assignmentFinished(assignment)&&informed>0?'Valor trazido/informado':'Deve trazer ao caixa';
    html=html.replace('<small>Dinheiro a acertar</small><b>'+fmt(informed)+'</b>',`<small>${label}</small><b>${fmt(assignmentFinished(assignment)&&informed>0?informed:expected)}</b>`);
    const details=`<div class="cashControlGrid"><div class="cashControlBox"><small>Saiu para troco</small><b>${fmt(taken)}</b></div><div class="cashControlBox return"><small>${label}</small><b>${fmt(assignmentFinished(assignment)&&informed>0?informed:expected)}</b></div></div>`;
    return html.replace('<div class="mini">',details+'<div class="mini">');
  };

  const deliveryHubCashBase=renderDeliveryHub;
  renderDeliveryHub=async function(box){
    const result=await deliveryHubCashBase(box);
    enhanceAvailableCashFields(box||document);
    if(box&&deliveryHub){
      const assignments=deliveryHub.assignments||[];
      const active=assignments.filter(item=>item.status!=='settled');
      const taken=active.reduce((sum,item)=>sum+Math.max(0,moneyNumber(item.change_float)),0);
      const expected=active.reduce((sum,item)=>sum+expectedReturn(item),0);
      const informed=active.filter(assignmentFinished).reduce((sum,item)=>sum+Math.max(0,moneyNumber(item.cash_received)),0);
      const hero=box.querySelector('.deliveryProHero');
      if(hero&&!hero.nextElementSibling?.classList.contains('cashControlTotals'))hero.insertAdjacentHTML('afterend',`<div class="cashControlTotals"><div class="cashControlTotal"><small>Troco com entregadores</small><b>${fmt(taken)}</b></div><div class="cashControlTotal return"><small>Previsto para retornar</small><b>${fmt(expected)}</b></div><div class="cashControlTotal"><small>Já informado nas entregas</small><b>${fmt(informed)}</b></div></div>`);
    }
    return result;
  };

  async function finishDeliveryWithCash(id,button){
    const assignment=(driverSnapshot?.assignments||[]).find(item=>String(item.id)===String(id));
    if(!assignment||assignmentFinished(assignment))return;
    const order=assignment.orders||{};
    const taken=Math.max(0,moneyNumber(assignment.change_float));
    const expected=expectedReturn(assignment);
    button.disabled=true;button.textContent='CONFIRMANDO ENTREGA...';
    try{
      let current=assignment.status;
      if(current==='assigned'||current==='problem'){await driverAppApi('status',{assignment_id:id,status:'route'});current='route'}
      if(current==='route'){await driverAppApi('status',{assignment_id:id,status:'arrived'});current='arrived'}
      if(current==='arrived'){
        const payload={assignment_id:id,status:'delivered',payment_confirmed:true};
        if(isCashOrder(order)){
          const answer=prompt(`CONFERÊNCIA DO DINHEIRO\n\nTroco levado: ${fmt(taken)}\nValor do pedido: ${fmt(order.total)}\nPrevisto para trazer: ${fmt(expected)}\n\nQuanto o entregador está trazendo ao caixa?`,expected.toFixed(2).replace('.',','));
          if(answer===null){button.disabled=false;button.textContent='✓ MARCAR COMO ENTREGUE';return}
          const actual=moneyNumber(answer);
          if(actual<0)throw new Error('Informe um valor válido.');
          payload.cash_received=actual;
          payload.change_given=suggestedChange(order);
        }
        await driverAppApi('status',payload);
      }
      stopDriverAreaGps();
      showAppToast('Entrega e dinheiro registrados.','ok');
      await renderDriverArea();
    }catch(error){button.disabled=false;button.textContent='✓ MARCAR COMO ENTREGUE';alert(error.message||'Não foi possível confirmar a entrega.')}
  }

  const driverCashBase=renderDriverArea;
  renderDriverArea=async function(){
    const result=await driverCashBase();
    document.querySelectorAll('[data-driver-deliver]').forEach(button=>{
      const id=button.dataset.driverDeliver;
      const assignment=(driverSnapshot?.assignments||[]).find(item=>String(item.id)===String(id));
      const content=button.closest('.driverOrder')?.querySelector('.driverDeliveryInfo');
      if(assignment&&content&&!content.querySelector('.cashControlGrid')){
        const taken=Math.max(0,moneyNumber(assignment.change_float)),expected=expectedReturn(assignment);
        content.insertAdjacentHTML('beforeend',`<div class="cashControlGrid"><div class="cashControlBox"><small>Troco que você levou</small><b>${fmt(taken)}</b></div><div class="cashControlBox return"><small>Valor para trazer</small><b>${fmt(expected)}</b></div></div>`);
      }
      button.onclick=()=>finishDeliveryWithCash(id,button);
    });
    return result;
  };
})();

/* Correção segura de pedidos das mesas — disponível para Atendimento e ADM. */
const tableOrderEditStyle=document.createElement('style');tableOrderEditStyle.textContent=`
.tableOrderActions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}.tableOrderEdit{width:100%;min-height:43px;border:1px solid #d59a6d;border-radius:11px;background:#fff5ec;color:#9b4013;font-size:12px;font-weight:950}.tableOrderEdit:disabled{opacity:.55}.tableEditNotice{margin:10px 0;padding:11px 12px;border:1px solid #e8c69f;border-radius:12px;background:#fff8ee;color:#684226;font-size:12px;line-height:1.45}.tableEditTotal{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 0;font-size:14px}.tableEditTotal b{font-size:21px}.tableEditLocked{padding:9px 10px;border:1px solid #dfe3e7;border-radius:10px;background:#f5f6f7;color:#68717a;font-size:11px;font-weight:800}
`;document.head.appendChild(tableOrderEditStyle);

function editableTableOrder(order){return order&&!['entregue','cancelado'].includes(String(order.status||''))}
function tableOrderDetailsHtml(order,mode){
  const items=(order.order_items||[]).map(item=>`<div class="tableItemLine"><span>${Number(item.quantity||1)}x ${esc(item.product_name||'Item')}${item.note?`<small style="display:block">Obs.: ${esc(item.note)}</small>`:''}</span><b>${fmt(item.line_total||Number(item.unit_price||0)*Number(item.quantity||1))}</b></div>`).join('');
  const action=editableTableOrder(order)?`<div class="tableOrderActions"><button class="tableOrderEdit" data-edit-table-order="${esc(order.id)}" data-edit-mode="${mode}">CORRIGIR PEDIDO</button></div>`:`<div class="tableEditLocked">Pedido finalizado — edição bloqueada.</div>`;
  return `${items}${order.notes?`<div class="mini">${esc(order.notes)}</div>`:''}${action}`;
}
remoteOrdersHtml=function(session,mode='employee'){
  const orders=session.orders||[];
  return orders.length?orders.map(order=>`<details class="tableOrder"><summary><span><b>Pedido #${esc(order.order_number)}</b><small>${esc(statusLabel[order.status]||order.status)}${order.employee_id?' • funcionário':''}</small></span><b>${fmt(order.total)}</b></summary><div>${tableOrderDetailsHtml(order,mode)}</div></details>`).join(''):'<div class="empty cleanEmpty"><b>Comanda vazia</b><span>Aguardando lançamento.</span></div>';
};

function bindTableOrderEditButtons(table,session,adminMode){
  document.querySelectorAll('[data-edit-table-order]').forEach(button=>button.onclick=()=>{
    const order=(session.orders||[]).find(item=>String(item.id)===String(button.dataset.editTableOrder));
    if(order)openTableOrderEditor(table,session,order,adminMode);
  });
}

function tableOrderItemsPayload(products,quantities,unitNotes){
  return products.flatMap(product=>{
    const quantity=quantities.get(String(product.id))||0,notes=unitNotes.get(String(product.id))||[];
    return Array.from({length:quantity},(_,index)=>({product_id:product.id,qty:1,addon_ids:[],note:String(notes[index]||'').trim()}));
  });
}

function openTableOrderEditor(table,session,order,adminMode){
  if(!editableTableOrder(order))return alert('Esse pedido já foi finalizado e não pode mais ser alterado.');
  const products=(adminMode?(admin?.products||data.products||[]):(employeeSnapshot?.products||[])).filter(product=>product.active!==false),quantities=new Map(),unitNotes=new Map();
  (order.order_items||[]).forEach(item=>{
    const id=String(item.product_id||''),product=products.find(entry=>String(entry.id)===id);if(!product)return;
    const quantity=Math.max(1,Number(item.quantity)||1),current=quantities.get(id)||0,notes=unitNotes.get(id)||[];
    quantities.set(id,current+quantity);for(let index=0;index<quantity;index++)notes.push(index===0?String(item.note||''):'');unitNotes.set(id,notes);
  });
  const total=()=>products.reduce((sum,product)=>sum+(quantities.get(String(product.id))||0)*priceOf(product),0);
  modal(`<div class="sheeth"><div><h2>Corrigir pedido #${esc(order.order_number)}</h2><div class="adminSub">Mesa ${String(table.table_number).padStart(2,'0')} • ${adminMode?'Administrador':'Atendimento'}</div></div><button class="x" id="backTableEdit">←</button></div><div class="tableEditNotice"><b>Atenção:</b> ao salvar, a comanda e o total da mesa serão atualizados. Confira os itens antes de confirmar.</div><div class="employeeProductSearch"><span>⌕</span><input id="tableEditSearch" class="in" placeholder="Buscar produto..."></div><div class="employeeCatalog">${operationalCatalogHtml(products)}</div><div class="field"><label>Observação geral do pedido</label><textarea id="tableEditNotes" class="ta" placeholder="Opcional">${esc(order.notes||'')}</textarea></div><div class="manualFooter"><div><span>Novo total</span><b id="tableEditTotal">${fmt(total())}</b></div><button id="saveTableEdit" class="primary">SALVAR CORREÇÃO</button></div>`,true);
  const refresh=()=>{products.forEach(product=>{const id=String(product.id),quantity=quantities.get(id)||0,counter=$(`[data-rqty="${CSS.escape(id)}"]`);if(counter){counter.textContent=quantity;counter.closest('.employeeProductCard')?.classList.toggle('selected',quantity>0)}if(quantity)renderUnitNotes(id,product.name||'Item',quantity,unitNotes)});$('#tableEditTotal').textContent=fmt(total())};
  $('#backTableEdit').onclick=()=>adminMode?renderRemoteAdminAccount(table,session):openEmployeeTable(table.id);
  $('#tableEditSearch').oninput=event=>filterOperationalCatalog(event.target.value);
  document.querySelectorAll('[data-rproduct]').forEach(button=>button.onclick=()=>{const id=String(button.dataset.rproduct),next=Math.max(0,(quantities.get(id)||0)+Number(button.dataset.d)),product=products.find(entry=>String(entry.id)===id);quantities.set(id,next);renderUnitNotes(id,product?.name||'Item',next,unitNotes);const counter=$(`[data-rqty="${CSS.escape(id)}"]`);if(counter){counter.textContent=next;counter.closest('.employeeProductCard')?.classList.toggle('selected',next>0)}$('#tableEditTotal').textContent=fmt(total())});
  refresh();
  $('#saveTableEdit').onclick=async()=>{const button=$('#saveTableEdit'),items=tableOrderItemsPayload(products,quantities,unitNotes);if(!items.length)return alert('O pedido precisa ter pelo menos um item. Para cancelar, use o fluxo de cancelamento.');if(!confirm(`Salvar a correção do pedido #${order.order_number}?`))return;try{button.disabled=true;button.textContent='SALVANDO...';await employeeApi('update_table_order',{table_session_id:session.id,order_id:order.id,items,notes:$('#tableEditNotes').value.trim()},adminMode);if(adminMode){await loadEmployeeAdmin();const fresh=remoteSessionForTable(table.id);if(!fresh)throw new Error('A mesa não está mais aberta.');showAppToast(`Pedido #${order.order_number} corrigido pelo ADM.`,'ok');renderRemoteAdminAccount(table,fresh)}else{employeeSnapshot=await employeeApi('employee_snapshot');showAppToast(`Pedido #${order.order_number} corrigido.`,'ok');openEmployeeTable(table.id)}}catch(error){alert(error.message||String(error));button.disabled=false;button.textContent='SALVAR CORREÇÃO'}};
}

const renderRemoteAdminAccountEditBase=renderRemoteAdminAccount;renderRemoteAdminAccount=function(table,session){
  renderRemoteAdminAccountEditBase(table,session);const list=[...document.querySelectorAll('.tableOrder')];list.forEach((card,index)=>{const order=(session.orders||[])[index],body=card.querySelector('summary+div');if(order&&body){body.innerHTML=tableOrderDetailsHtml(order,'admin')}});bindTableOrderEditButtons(table,session,true);
};
const openEmployeeTableEditBase=openEmployeeTable;openEmployeeTable=async function(tableId){await openEmployeeTableEditBase(tableId);const table=(employeeSnapshot?.tables||[]).find(item=>String(item.id)===String(tableId)),session=remoteSessionForTable(tableId,employeeSnapshot);if(table&&session){const list=[...document.querySelectorAll('.tableOrder')];list.forEach((card,index)=>{const order=(session.orders||[])[index],body=card.querySelector('summary+div');if(order&&body)body.innerHTML=tableOrderDetailsHtml(order,'employee')});bindTableOrderEditButtons(table,session,false)}};

/* Libera o lançamento pelo ADM usando a mesma API autenticada das mesas. */
const openRemoteOrderFormTableEditBase=openRemoteOrderForm;openRemoteOrderForm=function(table,session,adminMode){
  openRemoteOrderFormTableEditBase(table,session,adminMode);
  if(!adminMode)return;
  const oldButton=$('#saveRemoteOrder');if(!oldButton)return;
  const replacement=oldButton.cloneNode(true);oldButton.replaceWith(replacement);
  replacement.onclick=async()=>{
    const quantities=new Map();document.querySelectorAll('[data-rqty]').forEach(node=>quantities.set(String(node.dataset.rqty),Number(node.textContent)||0));
    const products=(admin?.products||data.products||[]).filter(product=>product.active!==false&&!product.sold_out),items=products.flatMap(product=>Array.from({length:quantities.get(String(product.id))||0},()=>({product_id:product.id,qty:1,addon_ids:[],note:''})));
    if(!items.length)return alert('Adicione pelo menos um item.');try{replacement.disabled=true;replacement.textContent='ENVIANDO...';await employeeApi('create_table_order',{table_session_id:session.id,items,notes:$('#remoteOrderNotes').value,phone:data.settings?.whatsapp||'86995653888'},true);await loadEmployeeAdmin();const fresh=remoteSessionForTable(table.id);showAppToast(`Itens lançados na Mesa ${table.table_number} pelo ADM.`,'ok');renderRemoteAdminAccount(table,fresh)}catch(error){alert(error.message||String(error));replacement.disabled=false;replacement.textContent='ENVIAR À PRODUÇÃO'};
  };
};

/* Detecta correções reais da comanda sem repetir avisos por simples mudança de updated_at. */
const tableOrderContentSignature=order=>JSON.stringify({
  total:Math.round(Number(order?.total||0)*100),
  notes:String(order?.notes||''),
  items:(order?.order_items||[]).map(item=>({
    id:String(item.id||''),product:String(item.product_id||item.product_name||''),quantity:Number(item.quantity||1),
    unit:Math.round(Number(item.unit_price||0)*100),line:Math.round(Number(item.line_total||0)*100),note:String(item.note||''),
    addons:(item.order_item_addons||[]).map(addon=>`${addon.addon_id||addon.addon_name||''}:${Math.round(Number(addon.price||0)*100)}`).sort()
  })).sort((a,b)=>(a.id+a.product+a.note).localeCompare(b.id+b.product+b.note))
});
const notifiedTableEdits=new Map();
const checkNewOrdersTableEditBase=checkNewOrders;checkNewOrders=async function(){
  const before=new Map((admin?.orders||[]).map(order=>[String(order.id),{signature:tableOrderContentSignature(order),status:String(order.status||'')}]))
  await checkNewOrdersTableEditBase();
  const edited=(admin?.orders||[]).filter(order=>{const id=String(order.id),old=before.get(id),signature=tableOrderContentSignature(order);if(!old||!order.table_session_id||signature===old.signature||String(order.status||'')!==old.status)return false;if(notifiedTableEdits.get(id)===signature)return false;notifiedTableEdits.set(id,signature);return true});
  if(!edited.length)return;
  const box=$('#admContent');
  if(box){if(adminTab==='pedidos')renderOrders(box);else if(adminTab==='producao')renderKitchen(box);else if(adminTab==='caixa')renderCash(box);else if(adminTab==='mesas')await renderRemoteTables(box)}
  const numbers=edited.slice(0,3).map(order=>`#${order.order_number}`).join(', '),extra=edited.length>3?` e mais ${edited.length-3}`:'';
  showAppToast(`${edited.length===1?'Pedido':'Pedidos'} ${numbers}${extra} ${edited.length===1?'foi corrigido':'foram corrigidos'}. Confira os itens.`,'ok');
};

/*
 * Pedido de balcão é presencial: exige apenas o nome do cliente.
 * A tela, a validação e o payload enviado à API seguem a mesma regra.
 * Os demais tipos de pedido continuam exigindo telefone normalmente.
 */
(() => {
  const adminCallWithRequiredPhone = adminCall;

  adminCall = async function(action = 'snapshot', payload = {}, allowRetry = true) {
    if (action === 'create_manual_order' && payload?.type === 'counter') {
      payload = {
        ...payload,
        customer: {
          ...(payload.customer || {}),
          phone: ''
        }
      };
    }

    try {
      return await adminCallWithRequiredPhone(action, payload, allowRetry);
    } finally {
      if (action === 'create_manual_order' && payload?.type === 'counter') {
        const field = document.querySelector('#mPhone');
        if (field) {
          field.value = '';
          field.disabled = true;
        }
      }
    }
  };

  const openManualOrderWithRequiredPhone = openManualOrder;

  openManualOrder = function() {
    openManualOrderWithRequiredPhone();

    const phoneInput = document.querySelector('#mPhone');
    const phoneField = phoneInput?.closest('.field');
    const nameField = document.querySelector('#mName')?.closest('.field');
    const saveButton = document.querySelector('#saveManual');
    const typeButtons = [...document.querySelectorAll('.manualOrderTypes button')];

    if (!phoneInput || !phoneField || !saveButton) return;

    const syncCounterPhoneRule = () => {
      const isCounter = document.querySelector('[data-counter-order]')?.classList.contains('on');

      phoneField.hidden = Boolean(isCounter);
      phoneField.setAttribute('aria-hidden', String(Boolean(isCounter)));
      if (nameField) nameField.style.gridColumn = isCounter ? '1 / -1' : '';

      if (isCounter) {
        phoneInput.value = '';
        phoneInput.required = false;
        phoneInput.disabled = true;
      } else {
        phoneInput.disabled = false;
        phoneInput.required = true;
      }
    };

    typeButtons.forEach(button => {
      button.addEventListener('click', () => queueMicrotask(syncCounterPhoneRule));
    });

    /*
     * O manipulador original valida o telefone antes de montar o payload.
     * Um valor técnico existe somente durante essa validação; o interceptor
     * acima sempre remove esse valor antes da chamada à API e ao banco.
     */
    saveButton.addEventListener('click', () => {
      if (document.querySelector('[data-counter-order]')?.classList.contains('on')) {
        phoneInput.disabled = false;
        phoneInput.value = '86900000000';
      }
    }, true);

    syncCounterPhoneRule();
  };
})();

/* Pedido Premiado: compartilha o escopo do ADM e sua API. */
{
  const prizeApi=async(action,payload={})=>api('nightly-prize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:sessionStorage.getItem('caseirao_admin_pin')||'',action,payload})});
  const originalRenderAdminTab=renderAdminTab;
  renderAdminTab=function(){if(adminTab==='premiado')return renderNightlyPrizeAdmin(document.querySelector('#admContent'));return originalRenderAdminTab()};
  async function renderNightlyPrizeAdmin(box){
    if(!box)return;box.innerHTML='<div class="notice" style="margin-top:12px">Carregando o Pedido Premiado da Noite...</div>';
    try{
      const result=await prizeApi('admin_snapshot'),c=result.campaign,w=result.winner;
      const locked=Boolean(c?.winner_order_id),active=Boolean(c?.active&&!locked);
      box.innerHTML=`<div class="prizeAdmin"><div class="prizeHero"><h3>🎁 Pedido Premiado da Noite</h3><div class="mini">Você configura o brinde e autoriza. O sistema sorteia secretamente qual pedido válido será o ganhador.</div></div>${c?`<div class="prizeStatus"><div class="prizeMetric"><span>Situação</span><b>${locked?'Ganhador escolhido':active?'Sorteio ativo':'Pausado'}</b></div><div class="prizeMetric"><span>Pedidos participantes</span><b>${Number(c.eligible_count||0)} de até ${Number(c.max_position||0)}</b></div><div class="prizeMetric"><span>Brinde</span><b>${esc(c.prize_name)}</b></div></div>`:''}${w?`<div class="prizeWinner"><h3>🏆 Pedido premiado encontrado</h3><b>${esc(w.customer_name)} • Pedido #${w.order_number}</b><div class="mini" style="margin-top:5px">${esc(phoneMask(w.customer_phone))} • ${esc(paymentLabel(w.payment))} • ${fmt(w.total)}<br>Código: <b>${esc(c.winner_code||'—')}</b>${c.redeemed_at?'<br>Brinde marcado como entregue.':''}</div>${!c.redeemed_at?'<button id="redeemNightlyPrize" class="primary" style="margin-top:12px">MARCAR BRINDE ENTREGUE</button>':''}</div>`:''}<div class="loyaltyCard"><div class="sectionTitle" style="margin-top:0">Configurar a premiação</div><div class="field"><label>Qual será o brinde?</label><input id="nightPrizeName" class="in" maxlength="120" value="${esc(c?.prize_name||'')}" placeholder="Ex.: Batata pequena"></div><div class="row"><div class="field"><label>Sortear entre os primeiros</label><input id="nightPrizeMax" class="in" type="number" inputmode="numeric" min="1" max="100" value="${Number(c?.max_position||10)}"></div><div class="field"><label>Pedido mínimo</label><input id="nightPrizeMin" class="in" inputmode="decimal" value="${Number(c?.min_order||0).toFixed(2).replace('.',',')}"></div></div><div class="field"><label>Tipos de pedido participantes</label><div class="prizeChecks"><label class="prizeCheck"><input type="checkbox" data-prize-type value="delivery" ${(c?.eligible_types||['delivery','pickup']).includes('delivery')?'checked':''}> Entrega</label><label class="prizeCheck"><input type="checkbox" data-prize-type value="pickup" ${(c?.eligible_types||['delivery','pickup']).includes('pickup')?'checked':''}> Retirada</label></div></div><div class="field"><label>Pagamentos participantes</label><div class="prizeChecks">${['Pix','Dinheiro','Cartão'].map(p=>`<label class="prizeCheck"><input type="checkbox" data-prize-payment value="${p}" ${(c?.eligible_payments||['Pix','Dinheiro','Cartão']).includes(p)?'checked':''}> ${p}</label>`).join('')}</div></div><div class="field"><label>Mensagem para o ganhador</label><textarea id="nightPrizeMessage" class="ta" maxlength="500">${esc(c?.winner_message||'Você ganhou um brinde do Caseirão Burger! Tire um print desta tela e envie para o estabelecimento.')}</textarea></div><div class="prizeActions"><button id="saveNightlyPrize" class="primary" ${locked?'disabled':''}>${c?'SALVAR E REINICIAR SORTEIO':'AUTORIZAR SORTEIO'}</button>${c&&!locked?'<button id="stopNightlyPrize" class="secondary">PAUSAR SORTEIO</button>':''}</div><div class="mini">A posição sorteada fica secreta. Somente pedidos feitos pelo cardápio depois da autorização participam. Existe no máximo um ganhador por noite.</div></div></div>`;
      const save=document.querySelector('#saveNightlyPrize');if(save)save.onclick=async()=>{try{const types=[...document.querySelectorAll('[data-prize-type]:checked')].map(x=>x.value),payments=[...document.querySelectorAll('[data-prize-payment]:checked')].map(x=>x.value);if(!types.length)throw new Error('Marque Entrega ou Retirada.');if(!payments.length)throw new Error('Marque pelo menos uma forma de pagamento.');save.disabled=true;save.textContent='AUTORIZANDO...';await prizeApi('admin_save',{prize_name:document.querySelector('#nightPrizeName').value.trim(),max_position:Number(document.querySelector('#nightPrizeMax').value),min_order:num(document.querySelector('#nightPrizeMin').value),eligible_types:types,eligible_payments:payments,winner_message:document.querySelector('#nightPrizeMessage').value.trim()});showAppToast('Pedido Premiado autorizado para esta noite.','ok');await renderNightlyPrizeAdmin(box)}catch(e){alert(e.message||String(e));save.disabled=false;save.textContent='TENTAR NOVAMENTE'}};
      const stop=document.querySelector('#stopNightlyPrize');if(stop)stop.onclick=async()=>{if(!confirm('Pausar o Pedido Premiado desta noite?'))return;try{stop.disabled=true;await prizeApi('admin_stop',{campaign_id:c.id});await renderNightlyPrizeAdmin(box)}catch(e){alert(e.message||String(e));stop.disabled=false}};
      const redeem=document.querySelector('#redeemNightlyPrize');if(redeem)redeem.onclick=async()=>{if(!confirm('Confirmar que o brinde foi entregue ao ganhador?'))return;try{redeem.disabled=true;await prizeApi('admin_redeem',{campaign_id:c.id});await renderNightlyPrizeAdmin(box)}catch(e){alert(e.message||String(e));redeem.disabled=false}};
    }catch(e){box.innerHTML=`<div class="err" style="margin-top:12px">${esc(e.message||String(e))}</div>`}
  }
}
