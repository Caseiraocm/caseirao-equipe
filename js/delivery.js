'use strict';
/* CASEIRÃO ENTREGAS — área autenticada, pagamentos, troco e acerto */
const driverAppStyle=document.createElement('style');driverAppStyle.textContent=`
.driverAccessChoice{border-color:#b8d9ee!important;background:#f1f9ff!important;color:#175f8f!important}.deliveryHubGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.deliveryPanel,.deliveryCard{border:1px solid #dfe3e7;background:#fff;border-radius:17px;padding:14px;color:#25292e}.deliveryPanel h3,.deliveryCard h3{margin:0 0 8px}.deliveryCard{margin:10px 0}.deliveryMeta{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:10px 0}.deliveryMeta>div{border:1px solid #e3e6e9;background:#f7f8f9;border-radius:11px;padding:9px}.deliveryMeta small{display:block;color:#717981}.deliveryActions{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.deliveryActions button{min-height:46px}.driverScreenNew{max-width:680px;margin:auto}.driverOrder{border:1px solid #dfe3e7;background:#fff;color:#24282d;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 5px 16px rgba(28,34,41,.05)}.driverOrder .addressBoxAdmin{background:#f6f8fa;color:#25292e;border-color:#dfe3e7}.driverMoney{border:1px solid #cce5d4;background:#effaf2;border-radius:13px;padding:12px;margin:10px 0;color:#176b3b}.driverPremiumHero{position:relative;overflow:hidden;border-radius:22px;padding:18px;margin:0 0 13px;background:linear-gradient(135deg,#20252a,#343a40);color:#fff;box-shadow:0 12px 30px rgba(20,24,28,.18);border:1px solid rgba(255,255,255,.06)}.driverPremiumHero:after{content:'🛵';position:absolute;right:12px;top:7px;font-size:58px;opacity:.12;transform:rotate(-7deg)}.driverPremiumHead{display:flex;align-items:center;gap:11px;position:relative;z-index:1}.driverPremiumIcon{width:45px;height:45px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.12);font-size:23px}.driverPremiumHead h2{margin:0;font-size:18px}.driverPremiumHead small{display:block;margin-top:2px;color:#cfd4d9}.driverPremiumStats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:15px;position:relative;z-index:1}.driverPremiumStat{background:rgba(255,255,255,.095);border:1px solid rgba(255,255,255,.11);border-radius:13px;padding:10px}.driverPremiumStat small{display:block;font-size:9px;text-transform:uppercase;font-weight:850;color:#cfd4d9}.driverPremiumStat b{display:block;margin-top:3px;font-size:15px}.driverPremiumStat.total b{color:#ffd2b9}.driverSectionHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 2px 7px}.driverSectionHead h3{margin:0;font-size:15px;color:#2d3238}.driverSectionHead span{font-size:10px;font-weight:900;color:#8a4a27;background:#fff1e8;border:1px solid #f0cfbd;border-radius:999px;padding:5px 8px}.driverQuickTop{display:flex;align-items:flex-start;gap:10px}.driverQuickTop .grow{min-width:0}.driverQuickTop h3{margin:0;font-size:17px}.driverQuickTop .driverFee{font-size:18px;color:#b94716;white-space:nowrap}.driverQuickLine{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:8px 0 10px}.driverQuickChip{display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border-radius:999px;background:#f4f6f8;border:1px solid #e3e6e9;font-size:11px;font-weight:800;color:#4a5159}.driverNextAction{margin-top:8px}.driverNextAction .primary,.driverNextAction .secondary{min-height:48px}.driverDetails{margin-top:9px;border-top:1px solid #eceff1;padding-top:8px}.driverDetails>summary{list-style:none;cursor:pointer;font-size:12px;font-weight:900;color:#6a7179;padding:8px 0}.driverDetails>summary::-webkit-details-marker{display:none}.driverDetails>summary:after{content:'＋';float:right;color:#a64a1c}.driverDetails[open]>summary:after{content:'−'}.driverDetailsContent{padding-top:4px}.driverMiniMapBtn{display:block;text-align:center;text-decoration:none;margin:8px 0;padding:11px 12px!important;min-height:auto!important;font-size:12px}.driverCompactMeta{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin:8px 0}.driverCompactMeta>div{background:#f6f7f8;border:1px solid #e5e8eb;border-radius:10px;padding:8px}.driverCompactMeta small{display:block;color:#7a8188;font-size:9px;text-transform:uppercase;font-weight:850}.driverCompactMeta b{display:block;margin-top:3px;font-size:12px}.driverStatus{font-size:12px;font-weight:900;color:#b24b18;text-transform:uppercase}.deliveryLogin{max-width:430px;margin:25px auto}.gpsActive{background:#157347!important;color:#fff!important}.settled{opacity:.7}.deliveryPanel .in,.deliveryPanel .sel,.deliveryCard .in,.deliveryCard .sel,.driverOrder .in{color:#20242a!important;background:#fff!important}
.driverDaySummary{margin:0 0 14px;border:1px solid #d8dce1;background:#fff;color:#20242a;border-radius:18px;padding:15px;box-shadow:0 7px 22px rgba(28,34,41,.06)}.driverDaySummaryHead{display:flex;align-items:center;justify-content:space-between;gap:12px}.driverDaySummaryHead h3{margin:0;font-size:18px}.driverDaySummaryHead strong{font-size:20px;color:#bd4715}.driverDayStats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:11px}.driverDayStats>div{background:#f5f7f8;border-radius:12px;padding:10px}.driverDayStats small{display:block;color:#747c84;font-size:9px;font-weight:900;text-transform:uppercase}.driverDayStats b{display:block;margin-top:4px;font-size:16px}.driverHoodList{margin-top:11px;border:1px solid #e4e7ea;border-radius:13px;overflow:hidden}.driverHoodRow{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:10px 11px;border-bottom:1px solid #e8eaed}.driverHoodRow:last-child{border-bottom:0}.driverHoodRow small{color:#707780}.driverHoodRow>strong{min-width:72px;text-align:right}
@media(max-width:620px){.deliveryHubGrid,.deliveryActions{grid-template-columns:1fr}.deliveryMeta{grid-template-columns:1fr 1fr}.driverDayStats{grid-template-columns:1fr 1fr}.driverHoodRow{grid-template-columns:1fr auto}.driverHoodRow small{grid-column:1/-1}}
`;document.head.appendChild(driverAppStyle);

let deliveryHub=null,driverSnapshot=null,driverLocationWatch=null,driverLocationTimer=null;
const driverTokenKey='caseirao_driver_token';
const internalResumeKey='caseirao_internal_resume';
const deliveryClearedKey='caseirao_delivery_cleared_records_v33';
function setInternalResume(area){try{sessionStorage.setItem(internalResumeKey,area)}catch{}}
function clearInternalResume(){try{sessionStorage.removeItem(internalResumeKey)}catch{}}
function deliveryClearedRecords(){try{const saved=JSON.parse(localStorage.getItem(deliveryClearedKey)||'{}');return{orders:Array.isArray(saved.orders)?saved.orders.map(String):[],assignments:Array.isArray(saved.assignments)?saved.assignments.map(String):[],cleared_at:saved.cleared_at||''}}catch{return{orders:[],assignments:[],cleared_at:''}}}
function saveDeliveryClearedRecords(records){try{localStorage.setItem(deliveryClearedKey,JSON.stringify(records))}catch{}}
function visibleDeliverySnapshot(snapshot){const cleared=deliveryClearedRecords(),orders=new Set(cleared.orders),assignments=new Set(cleared.assignments);return{...snapshot,orders:(snapshot.orders||[]).filter(o=>!orders.has(String(o.id))),assignments:(snapshot.assignments||[]).filter(a=>!assignments.has(String(a.id))&&!orders.has(String(a.order_id)))}}
async function driverAppApi(action,payload={},adminMode=false){const body={action,payload};if(adminMode)body.pin=sessionStorage.getItem('caseirao_admin_pin')||'';else body.token=localStorage.getItem(driverTokenKey)||'';return api('driver-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
const deliveryStatusLabel=s=>({assigned:'Aguardando saída',route:'Em rota',arrived:'No cliente',delivered:'Entregue',problem:'Problema',returned:'Retornou',settled:'Acertado'}[s]||s);
const safeMapsLink=o=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orderAddress(o))}`;
const deliveryClock=v=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
function deliveryTimesHtml(a){
  const sent=deliveryClock(a.assigned_at),route=deliveryClock(a.route_started_at),delivered=deliveryClock(a.delivered_at);
  const parts=[];
  if(sent)parts.push(`<span><small>Enviado</small><b>${sent}</b></span>`);
  if(route)parts.push(`<span><small>Saiu</small><b>${route}</b></span>`);
  if(delivered)parts.push(`<span><small>Entregue</small><b>${delivered}</b></span>`);
  return parts.length?`<div class="deliveryTimes">${parts.join('')}</div>`:'';
}

async function loadDeliveryHub(){deliveryHub=visibleDeliverySnapshot(await driverAppApi('admin_snapshot',{},true));return deliveryHub}
async function renderDeliveryHub(box){
  try{box.innerHTML='<div class="notice">Carregando controle de entregas...</div>';await loadDeliveryHub();
    const active=(deliveryHub.assignments||[]).filter(a=>a.status!=='settled'),settled=(deliveryHub.assignments||[]).filter(a=>a.status==='settled').slice(0,10),assignedIds=new Set(active.map(a=>a.order_id));
    const available=(deliveryHub.orders||[]).filter(o=>!assignedIds.has(o.id));
    box.innerHTML=`<div class="operationHint">Acompanhe quem está com cada pedido, localização, pagamento, troco e acerto com o caixa.</div><div class="deliveryHubGrid"><details class="deliveryPanel deliveryManageFold"><summary><span><b>Entregadores</b><small>Cadastro e acesso da equipe</small></span><span>⌄</span></summary><div class="deliveryManageBody"><button id="newDriverAccount" class="primary">+ CADASTRAR ENTREGADOR</button>${(deliveryHub.drivers||[]).map(d=>`<div class="tableitem"><div class="grow"><b>${esc(d.name)}</b><div class="mini">Login: ${esc(d.username||'não criado')} • ${d.active?'Ativo':'Bloqueado'}</div></div><button class="editbtn" data-edit-driver="${d.id}">EDITAR</button></div>`).join('')||'<div class="empty">Cadastre o primeiro entregador.</div>'}</div></details><section class="deliveryPanel deliveryAvailablePanel"><h3>Pedidos aguardando entregador</h3>${available.map(o=>`<div class="deliveryCard"><b>#${o.order_number} • ${esc(o.customer_name)}</b><div class="mini">${esc(orderAddress(o))}<br>${esc(paymentLabel(o.payment))} • ${fmt(o.total)}</div><div class="field"><label>Entregador</label><select class="sel" data-driver-select="${o.id}"><option value="">Selecione</option>${(deliveryHub.drivers||[]).filter(d=>d.active).map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div><div class="field"><label>Troco levado pelo entregador</label><input class="in" data-change-float="${o.id}" inputmode="decimal" placeholder="R$ 0,00"></div><button class="primary" data-assign-order="${o.id}">ENTREGAR PEDIDO AO MOTOBOY</button></div>`).join('')||'<div class="empty">Nenhum pedido aguardando entregador.</div>'}</section></div><div class="sectionTitle">Entregas em andamento</div>${active.map(deliveryAdminCard).join('')||'<div class="empty">Nenhuma entrega em andamento.</div>'}${settled.length?`<div class="sectionTitle">Acertos concluídos</div>${settled.map(deliveryAdminCard).join('')}`:''}`;
    $('#newDriverAccount').onclick=()=>openDriverEditor();box.querySelectorAll('[data-edit-driver]').forEach(b=>b.onclick=()=>openDriverEditor((deliveryHub.drivers||[]).find(d=>d.id===b.dataset.editDriver)));
    box.querySelectorAll('[data-assign-order]').forEach(b=>b.onclick=async()=>{const id=b.dataset.assignOrder,driverId=box.querySelector(`[data-driver-select="${CSS.escape(id)}"]`).value,change=num(box.querySelector(`[data-change-float="${CSS.escape(id)}"]`).value);if(!driverId)return alert('Selecione o entregador.');try{b.disabled=true;b.textContent='ATRIBUINDO...';await driverAppApi('admin_assign',{order_id:id,driver_id:driverId,change_float:change},true);await renderDeliveryHub(box);showAppToast('Pedido enviado para o entregador.','ok')}catch(e){alert(e.message);b.disabled=false}});
    box.querySelectorAll('[data-settle-delivery]').forEach(b=>b.onclick=async()=>{if(!confirm('Confirmar que o entregador prestou contas deste pedido?'))return;try{b.disabled=true;b.textContent='CONFIRMANDO...';await driverAppApi('admin_settle',{assignment_id:b.dataset.settleDelivery},true);await renderDeliveryHub(box)}catch(e){alert(e.message);b.disabled=false;b.textContent='CONFIRMAR ACERTO'}});
    box.querySelectorAll('[data-unassign-delivery]').forEach(b=>b.onclick=async()=>{if(!confirm('Remover esta entrega da rota do entregador?\n\nO pedido voltará para a lista de entregas disponíveis e o histórico já registrado será preservado.'))return;try{b.disabled=true;b.textContent='REMOVENDO...';await driverAppApi('admin_unassign',{assignment_id:b.dataset.unassignDelivery},true);await renderDeliveryHub(box);showAppToast('Entrega removida da rota.','ok')}catch(e){alert(e.message);b.disabled=false;b.textContent='REMOVER DA ROTA'}});
    box.querySelectorAll('[data-delivery-print]').forEach(b=>b.onclick=()=>printOrderBrowser(b.dataset.deliveryPrint));
  }catch(e){box.innerHTML=`<div class="err">${esc(e.message||String(e))}</div>`}
}
function deliveryAdminCard(a){const o=a.orders||{},d=a.drivers||{},cash=Number(a.cash_received||0),float=Number(a.change_float||0),items=Array.isArray(o.order_items)?o.order_items:[],itemCount=items.reduce((sum,item)=>sum+Number(item.quantity||1),0),itemsSummary=items.slice(0,2).map(item=>`${Number(item.quantity||1)}x ${esc(item.product_name||'Item')}`).join(' • '),canRemove=!['delivered','returned','settled'].includes(a.status);return `<div class="deliveryCard deliveryOperationalCard ${a.status==='settled'?'settled':''}"><div class="ordertop deliveryCardTop"><div class="grow"><h3>#${o.order_number} • ${esc(o.customer_name||'Cliente')}</h3><div class="deliveryDriverLine">🛵 ${esc(d.name||'Sem entregador')}</div></div><span class="statusBadge st-${a.status==='delivered'||a.status==='settled'?'entregue':a.status==='route'?'em_rota':'preparando'}">${esc(deliveryStatusLabel(a.status))}</span></div><div class="deliveryAddressLine">📍 ${esc(orderAddress(o))}</div><div class="deliveryMeta"><div><small>Pagamento</small><b>${esc(paymentLabel(o.payment))}</b></div><div><small>Total final</small><b>${fmt(o.total)}</b></div><div><small>Troco levado</small><b>${fmt(float)}</b></div><div><small>Retorno</small><b>${fmt(cash)}</b></div></div><details class="deliveryOrderDetails"><summary><span>🍔 ${itemCount||items.length||0} ${itemCount===1?'item':'itens'}${itemsSummary?` • ${itemsSummary}`:''}</span><b>VER DETALHES</b></summary><div class="deliveryOrderDetailsBody"><div class="orderItemsBox">${orderItemsHtml(o)}</div>${o.notes?`<div class="notesBoxAdmin"><b>Observações</b>${esc(o.notes)}</div>`:''}</div></details><div class="mini">${a.problem_note?`<b style="color:#ff858b">Problema: ${esc(a.problem_note)}</b>`:''}</div>${deliveryTimesHtml(a)}<div class="deliveryActions">${['delivered','returned'].includes(a.status)?`<button class="primary" data-settle-delivery="${a.id}">CONFIRMAR ACERTO</button>`:''}${canRemove?`<button class="secondary danger" data-unassign-delivery="${a.id}">REMOVER DA ROTA</button>`:''}${o.id?`<button class="secondary" data-delivery-print="${o.id}">IMPRIMIR</button><button class="secondary" data-delivery-map="${o.id}" data-order-number="${o.order_number}">VER GPS</button>`:''}</div></div>`}
function openDriverEditor(d={}){modal(`<div class="sheeth"><div><h2>${d.id?'Editar entregador':'Novo entregador'}</h2><div class="adminSub">Acesso exclusivo às entregas</div></div><button class="x" id="backDeliveryHub">←</button></div><div class="field"><label>Nome</label><input id="driverName" class="in" value="${esc(d.name||'')}"></div><div class="field"><label>Telefone</label><input id="driverPhone" class="in" inputmode="tel" value="${esc(d.phone||'')}"></div><div class="field"><label>Login</label><input id="driverUsername" class="in" autocapitalize="none" value="${esc(d.username||'')}"></div><div class="field"><label>${d.id?'Nova senha (deixe vazia para manter)':'Senha — mínimo 6 caracteres'}</label><input id="driverPassword" class="in" type="password"></div><label class="addon"><input id="driverActive" type="checkbox" ${d.active!==false?'checked':''}><span><b>Acesso ativo</b></span></label><button id="saveDriverAccount" class="primary">SALVAR ENTREGADOR</button>${d.id?'<button id="deleteDriverAccount" class="secondary deleteDriverBtn">🗑 EXCLUIR ENTREGADOR</button>':''}`,true);$('#backDeliveryHub').onclick=()=>{adminTab='entregas';renderAdmin()};$('#saveDriverAccount').onclick=async()=>{const b=$('#saveDriverAccount');try{b.disabled=true;b.textContent='SALVANDO...';await driverAppApi('admin_save_driver',{id:d.id||'',name:$('#driverName').value,phone:$('#driverPhone').value,username:$('#driverUsername').value,password:$('#driverPassword').value,active:$('#driverActive').checked},true);adminTab='entregas';renderAdmin();showAppToast('Entregador salvo.','ok')}catch(e){alert(e.message);b.disabled=false;b.textContent='SALVAR ENTREGADOR'}};const del=$('#deleteDriverAccount');if(del)del.onclick=async()=>{if(!confirm(`Excluir ${d.name||'este entregador'} do aplicativo?\n\nO histórico das entregas antigas será preservado e o acesso dele será encerrado.`))return;try{del.disabled=true;del.textContent='EXCLUINDO...';await driverAppApi('admin_delete_driver',{id:d.id},true);adminTab='entregas';renderAdmin();showAppToast('Entregador excluído do aplicativo.','ok')}catch(e){alert(e.message);del.disabled=false;del.textContent='🗑 EXCLUIR ENTREGADOR'}}}

function openDriverLogin(){modal(`<div class="sheeth"><div><h2>Área do entregador</h2><div class="adminSub">Entregas, GPS e pagamentos</div></div><button class="x" data-close>×</button></div><div class="deliveryLogin"><div class="field"><label>Login</label><input id="driverLoginUser" class="in" autocapitalize="none"></div><div class="field"><label>Senha</label><input id="driverLoginPassword" class="in" type="password"></div><button id="driverLoginButton" class="primary">ENTRAR</button><div id="driverLoginError"></div></div>`,true);bindClose();$('#driverLoginButton').onclick=async()=>{const b=$('#driverLoginButton');try{b.disabled=true;b.textContent='ENTRANDO...';const r=await api('driver-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',payload:{username:$('#driverLoginUser').value,password:$('#driverLoginPassword').value}})});localStorage.setItem(driverTokenKey,r.token);renderDriverArea()}catch(e){$('#driverLoginError').innerHTML=`<div class="err" style="margin-top:10px">${esc(e.message)}</div>`;b.disabled=false;b.textContent='ENTRAR'}}}

function driverPremiumHeroHtml(){
  const all=driverSnapshot?.assignments||[];
  const completed=all.filter(a=>['delivered','returned','settled'].includes(a.status));
  const active=all.filter(a=>['assigned','route','arrived','problem'].includes(a.status)).length;
  const fees=completed.reduce((sum,a)=>sum+Number(a.driver_fee||0),0);
  const gas=completed.length?Number(driverSnapshot?.driver_gas_allowance??driverSnapshot?.gas_allowance??10):0;
  const total=fees+gas;
  const name=driverSnapshot?.driver?.name||driverSnapshot?.name||'Entregador';
  return `<section class="driverPremiumHero">
    <div class="driverPremiumHead"><div class="driverPremiumIcon">🛵</div><div><h2>${esc(name)}</h2><small>Painel do Entregador • Hoje</small></div></div>
    <div class="driverPremiumStats">
      <div class="driverPremiumStat"><small>Concluídas</small><b>${completed.length}</b></div>
      <div class="driverPremiumStat"><small>Em andamento</small><b>${active}</b></div>
      <div class="driverPremiumStat total"><small>A receber</small><b>${fmt(total)}</b></div>
    </div>
  </section>`;
}

function driverDailySummaryHtml(){
  const all=driverSnapshot?.assignments||[];
  const completed=all.filter(a=>['delivered','returned','settled'].includes(a.status));
  const hoods=new Map();let fees=0;
  for(const a of completed){
    const hood=(a.neighborhood_name||a.orders?.neighborhood_name||'Bairro não informado').trim()||'Bairro não informado';
    const fee=Number(a.driver_fee||0);fees+=fee;
    if(!hoods.has(hood))hoods.set(hood,{count:0,fee,total:0});
    const h=hoods.get(hood);h.count++;h.total+=fee;if(!h.fee&&fee)h.fee=fee;
  }
  const gas=completed.length?Number(driverSnapshot?.driver_gas_allowance??driverSnapshot?.gas_allowance??10):0;
  const total=fees+gas;
  return `<section class="driverDaySummary"><div class="driverDaySummaryHead"><div><h3>🛵 Resumo de hoje</h3><div class="mini">${completed.length} ${completed.length===1?'entrega concluída':'entregas concluídas'}</div></div><strong>${fmt(total)}</strong></div>${completed.length?`<div class="driverHoodList">${[...hoods.entries()].map(([name,h])=>`<div class="driverHoodRow"><span><b>${esc(name)}</b></span><small>${h.count} × ${fmt(h.fee)}</small><strong>${fmt(h.total)}</strong></div>`).join('')}</div><div class="driverClosingSummary"><span>Entregas ${fmt(fees)} + gasolina ${fmt(gas)}</span><strong>Total ${fmt(total)}</strong></div>`:'<div class="mini" style="margin-top:10px">Nenhuma entrega concluída ainda.</div>'}</section>`;
}
async function renderDriverArea(){try{driverSnapshot=await driverAppApi('snapshot');setInternalResume('driver');modal(`<div class="sheeth"><div><h2>Olá, ${esc(driverSnapshot.driver.name)}</h2><div class="adminSub">Suas entregas de hoje</div></div><button id="driverLogout" class="secondary adminLogout">Sair</button></div><div class="driverScreenNew">${driverPremiumHeroHtml()}${driverDailySummaryHtml()}<div class="driverSectionHead"><h3>Entregas</h3><span>${(driverSnapshot?.assignments||[]).filter(a=>['assigned','route','arrived','problem'].includes(a.status)).length} ATIVAS</span></div>${(driverSnapshot.assignments||[]).map(driverOrderCard).join('')||'<div class="empty"><b>Nenhuma entrega atribuída.</b><span>Os pedidos aparecerão aqui quando o ADM enviar.</span></div>'}</div>`,true);$('#driverLogout').onclick=async()=>{await driverAppApi('logout').catch(()=>{});localStorage.removeItem(driverTokenKey);clearInternalResume();stopDriverAreaGps();openDriverLogin()};document.querySelectorAll('[data-driver-status]').forEach(b=>b.onclick=()=>updateDriverDelivery(b.dataset.driverAssignment,b.dataset.driverStatus));document.querySelectorAll('[data-driver-gps]').forEach(b=>b.onclick=()=>startDriverAreaGps(b.dataset.driverGps,b));}catch(e){if(/expirado/i.test(e.message)){localStorage.removeItem(driverTokenKey);clearInternalResume();openDriverLogin()}else modal(`<div class="err">${esc(e.message)}</div>`,true)}}
let automaticDriverSyncTimer=null,automaticDriverKnown=new Set();
function startAutomaticDriverSync(){
  if(automaticDriverSyncTimer)return;
  automaticDriverKnown=new Set((driverSnapshot?.assignments||[]).map(a=>String(a.id)));
  automaticDriverSyncTimer=setInterval(async()=>{
    if(!localStorage.getItem(driverTokenKey)||!document.querySelector('.driverScreenNew'))return;
    try{
      const fresh=await driverAppApi('snapshot');
      const active=(fresh.assignments||[]).filter(a=>['assigned','route','arrived','problem'].includes(a.status));
      const incoming=active.filter(a=>!automaticDriverKnown.has(String(a.id)));
      (fresh.assignments||[]).forEach(a=>automaticDriverKnown.add(String(a.id)));
      if(!incoming.length)return;
      driverSnapshot=fresh;
      playOrderSound();
      const first=incoming[0].orders||{};
      showAppToast(incoming.length===1?`Nova entrega #${first.order_number||'—'} recebida automaticamente.`:`${incoming.length} novas entregas recebidas automaticamente.`,'ok');
      if('Notification' in window&&Notification.permission==='granted'){
        try{new Notification('Nova rota • Caseirão',{body:incoming.length===1?`Pedido #${first.order_number||'—'} já está na sua tela.`:`${incoming.length} novos pedidos já estão nas suas rotas.`,tag:'caseirao-driver-auto-route',renotify:true,requireInteraction:true,vibrate:[250,120,350]})}catch{}
      }
      await renderDriverArea();
    }catch(e){console.warn('Falha temporária na atualização automática do entregador:',e)}
  },3500);
}
const automaticDriverUiObserver=new MutationObserver(()=>{
  if(document.querySelector('.driverScreenNew')){
    startAutomaticDriverSync();
    document.querySelectorAll('.driverScreenNew .empty span').forEach(span=>{
      if(span.textContent.includes('quando o ADM enviar'))span.textContent='Os novos pedidos aparecerão aqui automaticamente.';
    });
  }
  document.querySelectorAll('.deliveryPanel h3').forEach(title=>{
    if(title.textContent.trim()!=='Pedidos disponíveis')return;
    title.textContent='Distribuição automática';
    const panel=title.closest('.deliveryPanel'),empty=panel?.querySelector('.empty');
    if(empty)empty.innerHTML='<b>✓ Integração ativa</b><span>Todos os pedidos de entrega entram automaticamente nas rotas do entregador.</span>';
  });
});
automaticDriverUiObserver.observe(document.body,{childList:true,subtree:true});

function driverOrderCard(a){
  const o=a.orders||{},money=o.payment==='Dinheiro',
        hood=a.neighborhood_name||o.neighborhood_name||'Bairro não informado',
        fee=Number(a.driver_fee||0),
        nextAction=
          a.status==='assigned'?`<button class="primary" data-driver-status="route" data-driver-assignment="${a.id}">INICIAR ROTA</button>`:
          a.status==='route'?`<button class="primary" data-driver-status="arrived" data-driver-assignment="${a.id}">CHEGUEI AO CLIENTE</button>`:
          a.status==='arrived'?`<button class="primary" data-driver-status="delivered" data-driver-assignment="${a.id}">CONFIRMAR ENTREGA</button>`:
          a.status==='delivered'?`<button class="primary" data-driver-status="returned" data-driver-assignment="${a.id}">VOLTEI AO CASEIRÃO</button>`:
          '';
  return `<div class="driverOrder">
    <div class="driverQuickTop">
      <div class="grow">
        <h3>#${o.order_number} • ${esc(o.customer_name)}</h3>
        <div class="driverStatus">${esc(deliveryStatusLabel(a.status))}</div>
      </div>
      <b class="driverFee">${fee?fmt(fee):'—'}</b>
    </div>
    <div class="driverQuickLine">
      <span class="driverQuickChip">📍 ${esc(hood)}</span>
      <span class="driverQuickChip">💳 ${esc(paymentLabel(o.payment))}</span>
    </div>
    <div class="driverNextAction">${nextAction}${!['delivered','returned'].includes(a.status)?`<button class="secondary danger" style="margin-top:7px" data-driver-status="problem" data-driver-assignment="${a.id}">PROBLEMA NA ENTREGA</button>`:''}</div>
    <details class="driverDetails">
      <summary>VER DETALHES DA ENTREGA</summary>
      <div class="driverDetailsContent">
        ${deliveryTimesHtml(a)}
        <div class="addressBoxAdmin"><b>📍 Endereço</b>${esc(orderAddress(o))}</div>
        <a class="secondary driverMiniMapBtn" href="${esc(safeMapsLink(o))}" target="_blank">ABRIR MAPA</a>
        <div class="driverCompactMeta">
          <div><small>Valor pedido</small><b>${fmt(o.total)}</b></div>
          <div><small>Troco levado</small><b>${fmt(a.change_float)}</b></div>
        </div>
        <button class="secondary" data-driver-gps="${a.id}">📍 ATIVAR GPS</button>
        ${money&&a.status==='arrived'?'<div class="driverMoney">Ao confirmar a entrega, informe o dinheiro recebido e o troco devolvido.</div>':''}
      </div>
    </details>
  </div>`;
}
async function updateDriverDelivery(id,status){try{const payload={assignment_id:id,status};if(status==='problem'){const note=prompt('O que aconteceu na entrega?','Cliente não localizado');if(note===null)return;payload.problem_note=note}if(status==='delivered'){const a=(driverSnapshot.assignments||[]).find(x=>x.id===id),o=a?.orders||{};if(o.payment==='Dinheiro'){const cash=prompt('Quanto em dinheiro ficou com você após devolver o troco?',String(Number(o.total||0).toFixed(2)).replace('.',','));if(cash===null)return;const change=prompt('Quanto de troco você entregou ao cliente?','0,00');if(change===null)return;payload.cash_received=num(cash);payload.change_given=num(change)}payload.payment_confirmed=true}await driverAppApi('status',payload);if(status==='delivered')stopDriverAreaGps();renderDriverArea();showAppToast(deliveryStatusLabel(status),'ok')}catch(e){alert(e.message)}}
function stopDriverAreaGps(){if(driverLocationWatch!=null)navigator.geolocation.clearWatch(driverLocationWatch);driverLocationWatch=null;if(driverLocationTimer)clearInterval(driverLocationTimer);driverLocationTimer=null}
function startDriverAreaGps(assignmentId,button){if(!navigator.geolocation)return alert('GPS indisponível neste celular.');stopDriverAreaGps();button.disabled=true;button.textContent='SOLICITANDO LOCALIZAÇÃO...';let last=0;const send=async pos=>{if(Date.now()-last<5000)return;last=Date.now();try{await driverAppApi('location',{assignment_id:assignmentId,latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy});button.classList.add('gpsActive');button.textContent='● GPS ATIVO — MANTENHA A TELA ABERTA'}catch(e){button.textContent='FALHA NO GPS — TOQUE PARA TENTAR'}};driverLocationWatch=navigator.geolocation.watchPosition(send,()=>{button.disabled=false;button.textContent='PERMITA O GPS E TENTE NOVAMENTE'},{enableHighAccuracy:true,maximumAge:0,timeout:20000});button.disabled=false}

const renderAdminDeliveryBase=renderAdmin;renderAdmin=function(){if(admin&&adminTab)setInternalResume('admin:'+adminTab);const result=renderAdminDeliveryBase();const bar=document.querySelector('.admbar');if(bar&&!bar.querySelector('[data-tab="entregas"]')){const b=document.createElement('button');b.dataset.tab='entregas';b.className=adminTab==='entregas'?'on':'';b.textContent='Entregas';b.onclick=()=>{adminTab='entregas';renderAdmin()};const caixa=bar.querySelector('[data-tab="caixa"]');caixa?caixa.after(b):bar.appendChild(b)}if(adminTab==='entregas'){const box=$('#admContent');if(box)renderDeliveryHub(box)}return result};
const renderAdminTabDeliveryBase=renderAdminTab;renderAdminTab=function(){if(adminTab==='entregas'){const box=$('#admContent');if(box)renderDeliveryHub(box);return}return renderAdminTabDeliveryBase()};
const driverChoice=document.createElement('button');driverChoice.id='teamDriverBtn';driverChoice.className='teamChoice driverAccessChoice';driverChoice.type='button';driverChoice.innerHTML='<span class="teamChoiceIcon">🛵</span><span><strong>Acesso do entregador</strong><small>Rotas, GPS, pagamentos, troco e retorno.</small></span>';($('#teamDispatcherBtn')||$('#teamEmployeeBtn')).after(driverChoice);driverChoice.onclick=()=>localStorage.getItem(driverTokenKey)?renderDriverArea():openDriverLogin();

/* CASEIRÃO ENTREGAS PRO — tabela própria por bairro, gasolina e fechamento */
const deliveryProStyle=document.createElement('style');deliveryProStyle.textContent=`
.deliveryProHero{position:relative;overflow:hidden;margin:2px 0 15px;padding:20px;border-radius:22px;background:linear-gradient(135deg,#22272d,#111418 65%,#9e3d10);color:#fff;box-shadow:0 14px 30px rgba(28,33,39,.16)}.deliveryProHero:after{content:'🛵';position:absolute;right:16px;bottom:-15px;font-size:76px;opacity:.12;transform:rotate(-8deg)}.deliveryProHero h2{margin:0;font-size:25px}.deliveryProHero p{margin:7px 0 15px;color:#c9ced4;font-size:12px}.deliveryHeroMetrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.deliveryHeroMetric{padding:11px;border:1px solid rgba(255,255,255,.13);border-radius:13px;background:rgba(255,255,255,.07)}.deliveryHeroMetric small{display:block;color:#c5cbd1;font-size:9px;font-weight:900;text-transform:uppercase}.deliveryHeroMetric b{display:block;margin-top:5px;font-size:17px}.driverClosingCard{border:1px solid #dfe3e7;border-left:4px solid #dc5b19;border-radius:17px;background:#fff;padding:14px;margin:10px 0;color:#25292e;box-shadow:0 5px 16px rgba(30,36,42,.045)}.driverClosingHead{display:flex;gap:9px;align-items:center}.driverAvatar{width:38px;height:38px;border-radius:12px;background:#fff0e7;display:grid;place-items:center;font-size:18px}.driverClosingHead h3{margin:0;font-size:17px}.driverClosingHead>strong{margin-left:auto;font-size:19px;color:#bf4713}.neighborhoodBreakdown{margin-top:10px;border-top:1px solid #eceef0}.neighborhoodPayRow{display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px 2px;border-bottom:1px solid #eceef0;align-items:center}.neighborhoodPayRow:last-child{border-bottom:0}.neighborhoodPayRow small{display:block;color:#7a8189;font-size:10px;margin-top:2px}.neighborhoodPayRow b{min-width:64px;text-align:right}.driverClosingSummary{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;padding:10px 11px;border-radius:11px;background:#f5f7f8}.driverClosingSummary span{font-size:11px;color:#6d747c}.driverClosingSummary strong{font-size:16px;color:#25292e}.deliveryTimes{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0}.deliveryTimes span{display:flex;align-items:center;gap:5px;padding:6px 8px;border-radius:9px;background:#f4f6f8;border:1px solid #e4e7ea;color:#31363c}.deliveryTimes small{font-size:9px;color:#737b84;text-transform:uppercase;font-weight:850}.deliveryTimes b{font-size:11px}.ratesGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.rateRow{border:1px solid #dfe3e7;background:#fff;border-radius:14px;padding:11px}.rateRow label{display:block;color:#333;font-weight:850;margin-bottom:6px}.rateCompare{display:flex;justify-content:space-between;color:#737b84;font-size:10px;margin-bottom:7px}.rateRow .in{color:#222!important;background:#f8f9fa!important}.gasCard{border:1px solid #e7c9b4;background:#fff7f1;border-radius:15px;padding:14px;margin-bottom:12px}.driverNeighborhoodBadge{display:flex;justify-content:space-between;gap:10px;margin:10px 0;padding:11px 12px;border:1px solid #f0c6aa;border-radius:12px;background:#fff5ed;color:#9e3f13}.driverNeighborhoodBadge b:last-child{white-space:nowrap}.closingTitle{display:flex;align-items:center;justify-content:space-between;gap:10px}.closingActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.closingTitle button{width:auto;padding:8px 10px;font-size:11px;min-height:38px}.resetDeliveriesBtn{background:#fff!important;color:#9d3d14!important;border-color:#e7bda8!important}.refreshDeliveriesBtn{background:#eef6ff!important;color:#245f91!important;border-color:#bad6ee!important}.newHoodCard{border:1px dashed #d7b39f;background:#fffaf7;border-radius:15px;padding:13px;margin:0 0 14px}.newHoodCard h3{margin:0 0 4px;color:#7e3516;font-size:15px}.newHoodFields{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:8px;align-items:end}.newHoodFields .field{margin:6px 0}.newHoodFields button{min-height:48px}.deleteDriverBtn{margin-top:9px;background:#fff0f0!important;color:#a52d35!important;border-color:#e6b5b8!important}.deliveryEmptyRate{color:#b73138;font-weight:850}
@media(max-width:620px){.deliveryHeroMetrics{grid-template-columns:1fr 1fr}.driverClosingTotals{grid-template-columns:1fr 1fr}.ratesGrid{grid-template-columns:1fr}.neighborhoodPayRow{grid-template-columns:1fr auto}.neighborhoodPayRow small{grid-column:1/-1}.closingTitle{align-items:flex-start}.closingActions{max-width:205px}.closingTitle button{padding:7px 9px;font-size:10px;min-height:35px}.newHoodFields{grid-template-columns:1fr 1fr}.newHoodFields .field:first-child{grid-column:1/-1}.newHoodFields button{grid-column:1/-1}}
`;document.head.appendChild(deliveryProStyle);
function completedDriverAssignments(){return (deliveryHub?.assignments||[]).filter(a=>['delivered','returned','settled'].includes(a.status)&&(!a.delivered_at||localDay(a.delivered_at)===todayKey()))}
function driverClosingData(){const gas=Number(deliveryHub?.driver_gas_allowance||10),completed=completedDriverAssignments(),drivers=new Map();for(const a of completed){const d=a.drivers||{},id=d.id||a.driver_id;if(!drivers.has(id))drivers.set(id,{id,name:d.name||'Entregador',count:0,fees:0,cash:0,gas,hoods:new Map()});const x=drivers.get(id),hood=a.neighborhood_name||a.orders?.neighborhood_name||'Bairro não informado',fee=Number(a.driver_fee||0);x.count++;x.fees+=fee;x.cash+=Number(a.cash_received||0);if(!x.hoods.has(hood))x.hoods.set(hood,{count:0,fee,total:0});const h=x.hoods.get(hood);h.count++;h.total+=fee;if(!h.fee&&fee)h.fee=fee}return[...drivers.values()]}
function closingDriverCard(d){const total=d.fees+d.gas;return `<article class="driverClosingCard"><div class="driverClosingHead"><div class="driverAvatar">🛵</div><div><h3>${esc(d.name)}</h3><div class="mini">${d.count} ${d.count===1?'entrega':'entregas'} hoje</div></div><strong>${fmt(total)}</strong></div>${d.hoods.size?`<div class="neighborhoodBreakdown">${[...d.hoods.entries()].map(([name,h])=>`<div class="neighborhoodPayRow"><span><b>${esc(name)}</b><small>${h.count} × ${fmt(h.fee)}</small></span><b>${fmt(h.total)}</b></div>`).join('')}</div>`:''}<div class="driverClosingSummary"><span>Entregas ${fmt(d.fees)} + gasolina ${fmt(d.gas)}</span><strong>Total ${fmt(total)}</strong></div></article>`}
function deliveryClosingHtml(){const rows=driverClosingData(),deliveries=rows.reduce((s,d)=>s+d.count,0),fees=rows.reduce((s,d)=>s+d.fees,0),gas=rows.reduce((s,d)=>s+d.gas,0),total=fees+gas;return `<section class="deliveryProHero"><div class="deliveryProHeroHead"><div><h2>Controle de Entregas</h2><p>Operação do expediente</p></div><span class="deliveryLiveTag">● AO VIVO</span></div><div class="deliveryHeroMetrics"><div class="deliveryHeroMetric"><small>Hoje</small><b>${deliveries}</b></div><div class="deliveryHeroMetric"><small>Entregas</small><b>${fmt(fees)}</b></div><div class="deliveryHeroMetric"><small>+ gasolina</small><b>${fmt(total)}</b></div></div></section><details class="deliveryClosingFold"><summary><span><b>Fechamento dos entregadores</b><small>Valores, gasolina e acertos do expediente</small></span><span class="deliveryClosingChevron">⌄</span></summary><div class="deliveryClosingBody"><div class="closingActions"><button id="refreshDriverDeliveries" class="secondary refreshDeliveriesBtn">⟳ ATUALIZAR</button><button id="resetDriverDeliveries" class="secondary resetDeliveriesBtn">↺ ZERAR</button><button id="configureDriverRates" class="secondary">⚙️ VALORES</button></div>${rows.length?rows.map(closingDriverCard).join(''):'<div class="empty"><b>Nenhuma entrega concluída hoje.</b><span>O resumo será montado automaticamente.</span></div>'}</div></details>`}
const renderDeliveryHubProBase=renderDeliveryHub;renderDeliveryHub=async function(box){await renderDeliveryHubProBase(box);if(!deliveryHub||!box)return;box.insertAdjacentHTML('afterbegin',deliveryClosingHtml());const cfg=$('#configureDriverRates');if(cfg)cfg.onclick=openDriverRateSettings;const reset=$('#resetDriverDeliveries');if(reset)reset.onclick=resetDriverDeliveries;const refresh=$('#refreshDriverDeliveries');if(refresh)refresh.onclick=()=>refreshDriverDeliveries(box,refresh)};
async function refreshDriverDeliveries(box,button){try{button.disabled=true;button.textContent='ATUALIZANDO...';await loadDeliveryHub();await renderDeliveryHub(box);showAppToast('Entregas atualizadas.','ok')}catch(e){alert(e.message)}finally{const b=$('#refreshDriverDeliveries');if(b){b.disabled=false;b.textContent='⟳ ATUALIZAR'}}}
async function resetDriverDeliveries(){if(!confirm('Zerar a contagem das entregas agora?\n\nO histórico antigo será preservado, mas o fechamento e a contagem começarão do zero a partir deste momento.'))return;const b=$('#resetDriverDeliveries');try{b.disabled=true;b.textContent='ZERANDO...';await driverAppApi('admin_reset_deliveries',{},true);await loadDeliveryHub();const box=$('#admContent');if(box)await renderDeliveryHub(box);showAppToast('Entregas zeradas. Novo fechamento iniciado.','ok')}catch(e){alert(e.message);if(b){b.disabled=false;b.textContent='↺ ZERAR'}}}
function openDriverRateSettings(){
  const hoods=(deliveryHub?.neighborhoods||[]).filter(n=>n.active!==false);
  modal(`<div class="sheeth"><div><h2>Valores do entregador</h2><div class="adminSub">Tabela por bairro e ajuda de gasolina</div></div><button class="x" id="backRates">←</button></div>
  <div class="newHoodCard">
    <h3>+ Adicionar novo bairro</h3>
    <div class="mini">Cadastre aqui um bairro que ainda não existe no sistema.</div>
    <div class="newHoodFields">
      <div class="field"><label>Nome do bairro</label><input id="newDriverHoodName" class="in" placeholder="Ex.: Novo Horizonte"></div>
      <div class="field"><label>Cliente paga</label><input id="newDriverHoodFee" class="in" inputmode="decimal" placeholder="R$ 0,00"></div>
      <div class="field"><label>Entregador recebe</label><input id="newDriverHoodDriverFee" class="in" inputmode="decimal" placeholder="R$ 0,00"></div>
      <button id="addDriverHood" class="primary">ADICIONAR BAIRRO</button>
    </div>
  </div>
  <div class="gasCard"><div class="field"><label>Ajuda de gasolina por entregador no expediente</label><input id="driverGasRate" class="in" inputmode="decimal" value="${String(Number(deliveryHub.driver_gas_allowance||10).toFixed(2)).replace('.',',')}"></div><div class="mini">A gasolina é adicionada uma única vez para cada entregador que realizou entrega no dia.</div></div>
  <div class="ratesGrid">${hoods.map(n=>`<div class="rateRow"><label>${esc(n.name)}</label><div class="rateCompare"><span>Cliente paga ${fmt(n.fee)}</span><span>Entregador recebe</span></div><input class="in" data-driver-rate="${n.id}" inputmode="decimal" value="${Number(n.driver_fee||0)?String(Number(n.driver_fee).toFixed(2)).replace('.',','):''}" placeholder="R$ 0,00"></div>`).join('')}</div>
  <button id="saveDriverRates" class="primary" style="margin-top:14px">SALVAR TABELA DOS ENTREGADORES</button>`,true);

  $('#backRates').onclick=()=>{adminTab='entregas';renderAdmin()};

  $('#addDriverHood').onclick=async()=>{
    const b=$('#addDriverHood');
    try{
      const name=$('#newDriverHoodName').value.trim();
      const fee=num($('#newDriverHoodFee').value);
      const driverFee=num($('#newDriverHoodDriverFee').value);
      if(name.length<2)throw new Error('Informe o nome do bairro.');
      if(fee<0||driverFee<0)throw new Error('Informe valores válidos.');
      if(hoods.some(n=>String(n.name||'').trim().toLowerCase()===name.toLowerCase()))throw new Error('Esse bairro já está cadastrado.');
      b.disabled=true;b.textContent='ADICIONANDO...';
      await adminCall('upsert_neighborhood',{name,fee,active:true});
      admin=await adminCall('snapshot');
      const created=(admin.neighborhoods||[]).find(n=>String(n.name||'').trim().toLowerCase()===name.toLowerCase());
      if(created)await driverAppApi('admin_save_rates',{gas:num($('#driverGasRate').value),rates:[{id:created.id,driver_fee:driverFee}]},true);
      await loadDeliveryHub();
      openDriverRateSettings();
      showAppToast('Novo bairro adicionado.','ok');
    }catch(e){alert(e.message);b.disabled=false;b.textContent='ADICIONAR BAIRRO'}
  };

  $('#saveDriverRates').onclick=async()=>{
    const b=$('#saveDriverRates');
    try{
      b.disabled=true;b.textContent='SALVANDO...';
      const rates=[...document.querySelectorAll('[data-driver-rate]')].map(i=>({id:i.dataset.driverRate,driver_fee:num(i.value)}));
      await driverAppApi('admin_save_rates',{gas:num($('#driverGasRate').value),rates},true);
      adminTab='entregas';renderAdmin();
      showAppToast('Tabela dos entregadores salva.','ok')
    }catch(e){alert(e.message);b.disabled=false;b.textContent='SALVAR TABELA DOS ENTREGADORES'}
  }
}

const caseiraoClosingAlertBase=window.alert;window.alert=function(message,...rest){const result=caseiraoClosingAlertBase(message,...rest);if(/^Caixa fechado/i.test(String(message||'')))setTimeout(async()=>{try{admin=await adminCall('snapshot');adminTab='entregas';renderAdmin()}catch{}},100);return result};

async function restoreInternalAreaAfterReload(){
  // Não sobrescreve links públicos de rastreamento abertos pelo usuário.
  if(/^#entregador=/.test(location.hash||''))return;

  let area='';
  try{area=sessionStorage.getItem(internalResumeKey)||''}catch{}

  if(area==='driver'){
    if(localStorage.getItem(driverTokenKey)){
      try{await renderDriverArea();return}catch{}
    }
    clearInternalResume();
    return;
  }

  if(area.startsWith('admin:') || area==='admin-entregas'){
    const pin=sessionStorage.getItem('caseirao_admin_pin')||'';
    if(!pin){clearInternalResume();return}

    const requestedTab=area==='admin-entregas'?'entregas':area.slice(6);
    const validTabs=new Set(['visao','pedidos','producao','caixa','gestao','fidelidade','relatorios','produtos','adicionais','bairros','promocoes','cupons','banner','loja','mesas','funcionarios','entregas']);

    try{
      admin=await adminCall('snapshot',{},false);
      adminTab=validTabs.has(requestedTab)?requestedTab:'pedidos';
      startOrderWatcher();
      renderAdmin();
      return;
    }catch{
      sessionStorage.removeItem('caseirao_admin_pin');
      clearInternalResume();
    }
  }
}

setTimeout(restoreInternalAreaAfterReload,180);

/* CASEIRÃO ENTREGAS — CONTROLE TOTAL DO EXPEDIENTE 3.3 */
const deliveryControlStyle=document.createElement('style');deliveryControlStyle.textContent=`
.deliveryControlPanel{margin:12px 0;border:1px solid #efc9bd;background:#fff8f5;border-radius:17px;padding:14px}.deliveryControlPanelHead{display:flex;align-items:center;gap:10px;margin-bottom:9px}.deliveryControlPanelIcon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#fff0e9}.deliveryControlPanel h3{margin:0;font-size:16px}.deliveryControlPanel p{margin:3px 0 0;color:#6d747c;font-size:11px}.deliveryControlPanel button{margin-top:8px}.deliveryEditHint{margin:10px 0;color:#68717a;font-size:11px;line-height:1.45}.deliveryControlDanger{background:#fff!important;color:#a72d35!important;border-color:#e4aeb2!important}.deliveryControlDanger:hover{background:#fff1f1!important}
`;document.head.appendChild(deliveryControlStyle);

function openDeliveryControlEditor(assignment){
  if(!assignment)return;
  const order=assignment.orders||{},drivers=(deliveryHub?.drivers||[]).filter(d=>d.active||String(d.id)===String(assignment.driver_id));
  modal(`<div class="sheeth"><div><h2>Editar entrega #${esc(order.order_number||'')}</h2><div class="adminSub">Controle antes da saída do entregador</div></div><button class="x" id="backDeliveryControl">←</button></div>
  <div class="notice"><b>${esc(order.customer_name||'Cliente')}</b><br>${esc(orderAddress(order))}<br>${esc(paymentLabel(order.payment))} • ${fmt(order.total)}</div>
  <div class="field"><label>Entregador responsável</label><select id="deliveryControlDriver" class="sel">${drivers.map(d=>`<option value="${d.id}" ${String(d.id)===String(assignment.driver_id)?'selected':''}>${esc(d.name)}</option>`).join('')}</select></div>
  <div class="field"><label>Troco que o entregador vai levar</label><input id="deliveryControlChange" class="in" inputmode="decimal" value="${Number(assignment.change_float||0).toFixed(2).replace('.',',')}"></div>
  <details class="deliveryOrderDetails" open><summary><span>Comanda completa</span><b>CONFERIR</b></summary><div class="deliveryOrderDetailsBody"><div class="orderItemsBox">${orderItemsHtml(order)}</div>${order.notes?`<div class="notesBoxAdmin"><b>Observações</b>${esc(order.notes)}</div>`:'<div class="mini">Sem observações.</div>'}</div></details>
  <button id="saveDeliveryControl" class="primary">SALVAR ALTERAÇÕES</button>
  <div class="deliveryEditHint">Esta alteração troca o entregador e o valor de troco da rota sem modificar o valor original da venda.</div>`,true);
  $('#backDeliveryControl').onclick=()=>{adminTab='entregas';renderAdmin()};
  $('#saveDeliveryControl').onclick=async()=>{
    const button=$('#saveDeliveryControl'),driverId=$('#deliveryControlDriver').value,change=Math.max(0,num($('#deliveryControlChange').value));
    if(!driverId)return alert('Selecione o entregador.');
    if(!confirm('Salvar o novo entregador e o novo valor de troco?'))return;
    try{
      button.disabled=true;button.textContent='SALVANDO...';
      await driverAppApi('admin_unassign',{assignment_id:assignment.id},true);
      await driverAppApi('admin_assign',{order_id:assignment.order_id||order.id,driver_id:driverId,change_float:change},true);
      adminTab='entregas';renderAdmin();showAppToast('Entrega atualizada.','ok');
    }catch(error){button.disabled=false;button.textContent='SALVAR ALTERAÇÕES';alert(`Não foi possível concluir a alteração: ${error.message}`)}
  };
}

async function clearDeliveryCenterV33(){
  const snapshot=deliveryHub||{orders:[],assignments:[]},orderCount=(snapshot.orders||[]).length,assignmentCount=(snapshot.assignments||[]).length;
  if(!orderCount&&!assignmentCount)return alert('A central já está vazia.');
  if(!confirm(`APAGAR E ZERAR TODA A CENTRAL?\n\nSerão retiradas da tela ${orderCount} comandas e ${assignmentCount} registros de rota atuais. Pedidos novos continuarão aparecendo normalmente.`))return;
  if(!confirm('Confirme mais uma vez: deseja iniciar um novo expediente com a tela de entregas vazia?'))return;
  const buttons=[...document.querySelectorAll('[data-clear-delivery-center],#resetDriverDeliveries')];
  try{
    buttons.forEach(b=>{b.disabled=true;b.textContent='LIMPANDO TUDO...'});
    for(const assignment of snapshot.assignments||[]){
      if(!['delivered','returned','settled'].includes(assignment.status)){try{await driverAppApi('admin_unassign',{assignment_id:assignment.id},true)}catch{}}
    }
    try{await driverAppApi('admin_reset_deliveries',{},true)}catch{}
    const previous=deliveryClearedRecords();
    saveDeliveryClearedRecords({orders:[...new Set([...previous.orders,...(snapshot.orders||[]).map(o=>String(o.id))])],assignments:[...new Set([...previous.assignments,...(snapshot.assignments||[]).map(a=>String(a.id))])],cleared_at:new Date().toISOString()});
    await loadDeliveryHub();const box=$('#admContent');if(box)await renderDeliveryHub(box);
    showAppToast('Central zerada. Novo expediente iniciado.','ok');
  }catch(error){alert(error.message||'Não foi possível limpar a central.');buttons.forEach(b=>b.disabled=false)}
}

resetDriverDeliveries=clearDeliveryCenterV33;
const renderDeliveryHubControlBase=renderDeliveryHub;
renderDeliveryHub=async function(box){
  await renderDeliveryHubControlBase(box);if(!box||!deliveryHub)return;
  const settings=document.createElement('section');settings.className='deliveryControlPanel';settings.innerHTML=`<div class="deliveryControlPanelHead"><span class="deliveryControlPanelIcon">⚙️</span><div><h3>Configurações das entregas</h3><p>Editar rotas, controlar troco e limpar o expediente.</p></div></div><button class="secondary deliveryControlDanger" data-clear-delivery-center>🗑 APAGAR E ZERAR TUDO</button>`;
  const hint=box.querySelector('.operationHint');hint?hint.after(settings):box.prepend(settings);
  settings.querySelector('[data-clear-delivery-center]').onclick=clearDeliveryCenterV33;
  const visibleAssignments=[...(deliveryHub.assignments||[]).filter(a=>a.status!=='settled'),...(deliveryHub.assignments||[]).filter(a=>a.status==='settled').slice(0,10)];
  box.querySelectorAll('.deliveryOperationalCard').forEach((card,index)=>{const assignment=visibleAssignments[index];if(!assignment||['delivered','returned','settled'].includes(assignment.status))return;const actions=card.querySelector('.deliveryActions');if(!actions||actions.querySelector('[data-edit-delivery-control]'))return;const button=document.createElement('button');button.type='button';button.className='primary';button.dataset.editDeliveryControl=assignment.id;button.textContent='✎ EDITAR ENTREGA';button.onclick=()=>openDeliveryControlEditor(assignment);actions.prepend(button)});
};

const driverToken=decodeURIComponent((location.hash.match(/^#entregador=([^&]+)/)||[])[1]||'');if(driverToken)setTimeout(()=>openDriverTracking(driverToken),100);
