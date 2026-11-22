'use strict';
/* CASEIRÃO ENTREGAS — área autenticada, pagamentos, troco e acerto */
const driverAppStyle=document.createElement('style');driverAppStyle.textContent=`
.driverPreparing{font-size:13px;color:#565b59}

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
const driverFinishedStatuses=new Set(['delivered','returned','settled','entregue','finalizado','concluido','concluído']);
function isDriverAssignmentFinished(assignment){return driverFinishedStatuses.has(String(assignment?.status||'').trim().toLowerCase())}
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
const deliveryHubRequests=new WeakMap();
async function renderDeliveryHub(box){
  if(!box?.isConnected)return false;
  const request={};
  deliveryHubRequests.set(box,request);
  const isCurrent=()=>box.isConnected&&deliveryHubRequests.get(box)===request;
  const openPanels=[...box.querySelectorAll('details[data-delivery-panel][open]')].map(panel=>panel.dataset.deliveryPanel);
  try{
    if(!box.hasChildNodes())box.innerHTML='<div class="notice" role="status">Carregando entregas…</div>';
    const snapshot=visibleDeliverySnapshot(await driverAppApi('admin_snapshot',{},true));
    if(!isCurrent())return false;
    deliveryHub=snapshot;
    const active=(deliveryHub.assignments||[]).filter(a=>a.status!=='settled'),settled=(deliveryHub.assignments||[]).filter(a=>a.status==='settled').slice(0,10),assignedIds=new Set(active.map(a=>a.order_id));
    const available=(deliveryHub.orders||[]).filter(o=>!assignedIds.has(o.id));
    box.innerHTML=`
      <div class="deliveryHubGrid">
        <section class="deliveryPanel deliveryAvailablePanel"><h2>Pedidos aguardando entregador <span class="deliveryCount">${available.length}</span></h2>${available.map(o=>`<div class="deliveryCard"><b>#${o.order_number} • ${esc(o.customer_name)}</b><div class="mini">${esc(orderAddress(o))}<br>${esc(paymentLabel(o.payment))} • ${fmt(o.total)}</div><div class="field"><label>Entregador</label><select class="sel" data-driver-select="${o.id}"><option value="">Selecione</option>${(deliveryHub.drivers||[]).filter(d=>d.active).map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div><div class="field"><label>Troco levado pelo entregador</label><input class="in" data-change-float="${o.id}" inputmode="decimal" placeholder="R$ 0,00"></div><button class="primary" data-assign-order="${o.id}">ENTREGAR PEDIDO AO MOTOBOY</button></div>`).join('')||'<div class="empty">Nenhum pedido aguardando entregador.</div>'}</section>
        <section class="deliveryPanel deliveryActivePanel">
          <h2>Entregas em andamento <span class="deliveryCount">${active.length}</span></h2>
          ${active.map(deliveryAdminCard).join('')||'<div class="empty">Nenhuma entrega em andamento.</div>'}
        </section>
      </div>
      ${settled.length?`<section class="deliveryPanel deliveryHistoryPanel">
        <h2>Acertos concluídos</h2>
        ${settled.map(deliveryAdminCard).join('')}
      </section>`:''}
      <details class="deliveryPanel deliveryManageFold" data-delivery-panel="drivers"><summary><span><b>Entregadores</b><small>Cadastro e acesso da equipe</small></span><span class="deliveryClosingChevron" aria-hidden="true"></span></summary><div class="deliveryManageBody"><button id="newDriverAccount" class="primary">+ CADASTRAR ENTREGADOR</button>${(deliveryHub.drivers||[]).map(d=>`<div class="tableitem"><div class="grow"><b>${esc(d.name)}</b><div class="mini">Login: ${esc(d.username||'não criado')} • ${d.active?'Ativo':'Bloqueado'}</div></div><button class="editbtn" data-edit-driver="${d.id}">EDITAR</button></div>`).join('')||'<div class="empty">Cadastre o primeiro entregador.</div>'}</div></details>`;
    box.querySelector('.deliveryManageFold').open=openPanels.includes('drivers');
    $('#newDriverAccount').onclick=()=>openDriverEditor();box.querySelectorAll('[data-edit-driver]').forEach(b=>b.onclick=()=>openDriverEditor((deliveryHub.drivers||[]).find(d=>d.id===b.dataset.editDriver)));
    box.querySelectorAll('[data-assign-order]').forEach(b=>b.onclick=async()=>{const id=b.dataset.assignOrder,driverId=box.querySelector(`[data-driver-select="${CSS.escape(id)}"]`).value,change=num(box.querySelector(`[data-change-float="${CSS.escape(id)}"]`).value);if(!driverId)return alert('Selecione o entregador.');try{b.disabled=true;b.textContent='ATRIBUINDO...';await driverAppApi('admin_assign',{order_id:id,driver_id:driverId,change_float:change},true);await renderDeliveryHub(box);showAppToast('Pedido enviado para o entregador.','ok')}catch(e){alert(e.message);b.disabled=false}});
    box.querySelectorAll('[data-settle-delivery]').forEach(b=>b.onclick=async()=>{if(!confirm('Confirmar que o entregador prestou contas deste pedido?'))return;try{b.disabled=true;b.textContent='CONFIRMANDO...';await driverAppApi('admin_settle',{assignment_id:b.dataset.settleDelivery},true);await renderDeliveryHub(box)}catch(e){alert(e.message);b.disabled=false;b.textContent='CONFIRMAR ACERTO'}});
    box.querySelectorAll('[data-unassign-delivery]').forEach(b=>b.onclick=async()=>{if(!confirm('Remover esta entrega da rota do entregador?\n\nO pedido voltará para a lista de entregas disponíveis e o histórico já registrado será preservado.'))return;try{b.disabled=true;b.textContent='REMOVENDO...';await driverAppApi('admin_unassign',{assignment_id:b.dataset.unassignDelivery},true);await renderDeliveryHub(box);showAppToast('Entrega removida da rota.','ok')}catch(e){alert(e.message);b.disabled=false;b.textContent='REMOVER DA ROTA'}});
    box.querySelectorAll('[data-delivery-print]').forEach(b=>b.onclick=()=>printOrderBrowser(b.dataset.deliveryPrint));
    return openPanels;
  }catch(e){
    if(!isCurrent())return false;
    box.innerHTML=`<div class="err" role="alert">${esc(e.message||String(e))}</div>
      <button type="button" class="secondary" data-delivery-retry>Tentar novamente</button>`;
    box.querySelector('[data-delivery-retry]').onclick=()=>renderDeliveryHub(box);
    return false;
  }
}
function deliveryAdminCard(a){const o=a.orders||{},d=a.drivers||{},cash=Number(a.cash_received||0),float=Number(a.change_float||0),items=Array.isArray(o.order_items)?o.order_items:[],itemCount=items.reduce((sum,item)=>sum+Number(item.quantity||1),0),itemsSummary=items.slice(0,2).map(item=>`${Number(item.quantity||1)}x ${esc(item.product_name||'Item')}`).join(' • '),canRemove=!['delivered','returned','settled'].includes(a.status);return `<div class="deliveryCard deliveryOperationalCard ${a.status==='settled'?'settled':''}"><div class="ordertop deliveryCardTop"><div class="grow"><h3>#${o.order_number} • ${esc(o.customer_name||'Cliente')}</h3><div class="deliveryDriverLine">🛵 ${esc(d.name||'Sem entregador')}</div></div><span class="statusBadge st-${a.status==='delivered'||a.status==='settled'?'entregue':a.status==='route'?'em_rota':'preparando'}">${esc(deliveryStatusLabel(a.status))}</span></div><div class="deliveryAddressLine">📍 ${esc(orderAddress(o))}</div><div class="deliveryMeta"><div><small>Pagamento</small><b>${esc(paymentLabel(o.payment))}</b></div><div><small>Total final</small><b>${fmt(o.total)}</b></div><div><small>Troco levado</small><b>${fmt(float)}</b></div><div><small>Retorno</small><b>${fmt(cash)}</b></div></div><details class="deliveryOrderDetails"><summary><span>🍔 ${itemCount||items.length||0} ${itemCount===1?'item':'itens'}${itemsSummary?` • ${itemsSummary}`:''}</span><b>VER DETALHES</b></summary><div class="deliveryOrderDetailsBody"><div class="orderItemsBox">${orderItemsHtml(o)}</div>${o.notes?`<div class="notesBoxAdmin"><b>Observações</b>${esc(o.notes)}</div>`:''}</div></details><div class="mini">${a.problem_note?`<b style="color:#ff858b">Problema: ${esc(a.problem_note)}</b>`:''}</div>${deliveryTimesHtml(a)}<div class="deliveryActions">${['delivered','returned'].includes(a.status)?`<button class="primary" data-settle-delivery="${a.id}">CONFIRMAR ACERTO</button>`:''}${canRemove?`<button class="secondary danger" data-unassign-delivery="${a.id}">REMOVER DA ROTA</button>`:''}${o.id?`<button class="secondary" data-delivery-print="${o.id}">IMPRIMIR</button><button class="secondary" data-delivery-map="${o.id}" data-order-number="${o.order_number}">VER GPS</button>`:''}</div></div>`}
function openDriverEditor(d={}){modal(`<div class="sheeth"><div><h2>${d.id?'Editar entregador':'Novo entregador'}</h2><div class="adminSub">Acesso exclusivo às entregas</div></div><button class="x" id="backDeliveryHub">←</button></div><div class="field"><label>Nome</label><input id="driverName" class="in" value="${esc(d.name||'')}"></div><div class="field"><label>Telefone</label><input id="driverPhone" class="in" inputmode="tel" value="${esc(d.phone||'')}"></div><div class="field"><label>Login</label><input id="driverUsername" class="in" autocapitalize="none" value="${esc(d.username||'')}"></div><div class="field"><label>${d.id?'Nova senha (deixe vazia para manter)':'Senha — mínimo 6 caracteres'}</label><input id="driverPassword" class="in" type="password"></div><label class="addon"><input id="driverActive" type="checkbox" ${d.active!==false?'checked':''}><span><b>Acesso ativo</b></span></label><button id="saveDriverAccount" class="primary">SALVAR ENTREGADOR</button>${d.id?'<button id="deleteDriverAccount" class="secondary deleteDriverBtn">🗑 EXCLUIR ENTREGADOR</button>':''}`,true);$('#backDeliveryHub').onclick=()=>{adminTab='entregas';renderAdmin()};$('#saveDriverAccount').onclick=async()=>{const b=$('#saveDriverAccount');try{b.disabled=true;b.textContent='SALVANDO...';await driverAppApi('admin_save_driver',{id:d.id||'',name:$('#driverName').value,phone:$('#driverPhone').value,username:$('#driverUsername').value,password:$('#driverPassword').value,active:$('#driverActive').checked},true);adminTab='entregas';renderAdmin();showAppToast('Entregador salvo.','ok')}catch(e){alert(e.message);b.disabled=false;b.textContent='SALVAR ENTREGADOR'}};const del=$('#deleteDriverAccount');if(del)del.onclick=async()=>{if(!confirm(`Excluir ${d.name||'este entregador'} do aplicativo?\n\nO histórico das entregas antigas será preservado e o acesso dele será encerrado.`))return;try{del.disabled=true;del.textContent='EXCLUINDO...';await driverAppApi('admin_delete_driver',{id:d.id},true);adminTab='entregas';renderAdmin();showAppToast('Entregador excluído do aplicativo.','ok')}catch(e){alert(e.message);del.disabled=false;del.textContent='🗑 EXCLUIR ENTREGADOR'}}}

function openDriverLogin(){modal(`<div class="sheeth"><div><h2>Área do entregador</h2><div class="adminSub">Entregas, GPS e pagamentos</div></div><button class="x" data-close>×</button></div><div class="deliveryLogin"><div class="field"><label>Login</label><input id="driverLoginUser" class="in" autocapitalize="none"></div><div class="field"><label>Senha</label><input id="driverLoginPassword" class="in" type="password"></div><button id="driverLoginButton" class="primary">ENTRAR</button><div id="driverLoginError"></div></div>`,true);bindClose();$('#driverLoginButton').onclick=async()=>{const b=$('#driverLoginButton');try{b.disabled=true;b.textContent='ENTRANDO...';const r=await api('driver-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',payload:{username:$('#driverLoginUser').value,password:$('#driverLoginPassword').value}})});localStorage.setItem(driverTokenKey,r.token);renderDriverArea()}catch(e){$('#driverLoginError').innerHTML=`<div class="err" style="margin-top:10px">${esc(e.message)}</div>`;b.disabled=false;b.textContent='ENTRAR'}}}

function driverDeliveryTimerHtml(readyAt, finishedAt){
  const start=Date.parse(readyAt);
  const end=finishedAt===undefined?Date.now():Date.parse(finishedAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||(finishedAt!==undefined&&end<start))return '';
  const {time,late}=driverDeliveryElapsed(start,end);
  return `<span class="driverDeliveryTimer${late?' is-late':''}"${finishedAt===undefined?` data-driver-ready-at="${start}"`:''}>
    <span class="driverDeliveryTimerValue"><span class="driverTimerIcon" aria-hidden="true"></span><time>${time}</time></span>
    <small>Acima de 25 min</small>
  </span>`;
}

function driverDeliveryElapsed(start,end){
  const seconds=Math.max(0,Math.floor((end-start)/1000));
  const minutes=String(Math.floor(seconds/60)).padStart(2,'0');
  return {time:`${minutes}:${String(seconds%60).padStart(2,'0')}`,late:seconds>25*60};
}

let driverClockInterval=null;
function startDriverDeliveryClock(){
  if(driverClockInterval!==null)return;
  const tick=()=>{
    const timers=document.querySelectorAll('.driverDashboard [data-driver-ready-at]');
    if(!timers.length){
      clearInterval(driverClockInterval);
      driverClockInterval=null;
      return;
    }
    const now=Date.now();
    timers.forEach(timer=>{
      const {time,late}=driverDeliveryElapsed(Number(timer.dataset.driverReadyAt),now);
      const display=timer.querySelector('time');
      if(display.textContent!==time)display.textContent=time;
      timer.classList.toggle('is-late',late);
    });
  };
  driverClockInterval=setInterval(tick,1000);
  tick();
}

function driverDailySummaryHtml(assignments){
  const completed=assignments.filter(a=>['delivered','returned','settled'].includes(a.status));
  const hoods=new Map();let fees=0;
  for(const a of completed){
    const hood=(a.neighborhood_name||a.orders?.neighborhood_name||'Bairro não informado').trim()||'Bairro não informado';
    const fee=Number(a.driver_fee||0);fees+=fee;
    if(!hoods.has(hood))hoods.set(hood,{count:0,total:0});
    const h=hoods.get(hood);h.count++;h.total+=fee;
  }
  const gas=completed.length?Number(driverSnapshot?.driver_gas_allowance??driverSnapshot?.gas_allowance??10):0;
  const total=fees+gas;
  const deliveryTimes=completed.filter(a=>a.delivered_at&&localDay(a.delivered_at)===todayKey())
    .sort((a,b)=>Date.parse(b.delivered_at)-Date.parse(a.delivered_at))
    .map(a=>{
      const timer=driverDeliveryTimerHtml(a.orders?.ready_at,a.delivered_at);
      return timer?`<li><span>Pedido #${esc(a.orders?.order_number||'—')}</span>${timer}</li>`:'';
    }).join('');
  return `<details class="driverOverview" data-driver-detail="overview">
    <summary>
      <span class="driverSummaryLabel">Resumo do dia${gas>0?'<small>Com gasolina</small>':''}</span>
      <strong class="driverSummaryTotal">${fmt(total)}</strong>
    </summary>
    <dl class="driverOverviewStats">
      <div><dt>Concluídas</dt><dd>${completed.length}</dd></div>
      <div><dt>A receber</dt><dd>${fmt(total)}</dd></div>
    </dl>
    ${deliveryTimes?`<details class="driverBreakdown" data-driver-detail="delivery-times">
      <summary>Tempos das entregas</summary>
      <ul class="driverCompletedTimes">${deliveryTimes}</ul>
    </details>`:''}
    ${completed.length?`<details class="driverBreakdown" data-driver-detail="breakdown">
      <summary>Ver valores por bairro</summary>
      <div class="driverHoodList">${[...hoods.entries()].map(([name,h])=>`<div class="driverHoodRow"><span><b>${esc(name)}</b></span><small>${h.count} ${h.count===1?'entrega':'entregas'}</small><strong>${fmt(h.total)}</strong></div>`).join('')}</div>
      <div class="driverClosingSummary"><span>Entregas ${fmt(fees)} + gasolina ${fmt(gas)}</span><strong>Total ${fmt(total)}</strong></div>
    </details>`:''}
    <button type="button" id="driverReadySound" aria-pressed="${localStorage.getItem(driverReadySoundKey)==='on'}">Alerta sonoro <span aria-hidden="true"></span></button>
  </details>`;
}
const driverReadySoundKey='caseirao_driver_ready_sound';
let automaticDriverSyncTimer=null;
let driverSyncBusy=false;
let driverReadySeen=new Set();
let driverDashboardView='ready';

function driverReadyForPickup(assignment){
  const order=assignment.orders;
  return assignment.status==='assigned' && !assignment.route_started_at && !order?.archived_at
    && ['pronto','em_rota'].includes(order?.status);
}
function driverReadyNotice(count){
  return count===1?'1 entrega pronta para retirada.':`${count} entregas prontas para retirada.`;
}
function showDriverDashboardView(screen,view){
  driverDashboardView=view;
  screen.querySelectorAll('[data-driver-view]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.driverView===view));
  });
  screen.querySelectorAll('[data-driver-panel]').forEach(panel=>{
    panel.hidden=panel.dataset.driverPanel!==view;
  });
}

async function renderDriverArea(snapshot=null,{returnedFromDelivery=false}={}){
  try{
    const token=localStorage.getItem(driverTokenKey);
    const fresh=snapshot||await driverAppApi('snapshot');
    if(!token||token!==localStorage.getItem(driverTokenKey))return;
    driverSnapshot=fresh;
    setInternalResume('driver');
    const active=(fresh.assignments||[]).filter(a=>!isDriverAssignmentFinished(a)
      && ['assigned','route','arrived','problem'].includes(a.status));
    const ready=active.filter(driverReadyForPickup)
      .sort((a,b)=>Number(a.orders?.order_number)-Number(b.orders?.order_number));
    const enRoute=active.filter(a=>['route','arrived'].includes(a.status));
    const other=active.filter(a=>['assigned','problem'].includes(a.status)&&!driverReadyForPickup(a));
    const oldScreen=document.querySelector('.driverScreenNew');
    const oldSheet=oldScreen?.closest('.sheet');
    const scrollTop=oldSheet?.scrollTop||0;
    const details=new Set([...oldScreen?.querySelectorAll('details[open]')||[]].map(item=>item.dataset.driverDetail));
    if(returnedFromDelivery&&ready.length)driverDashboardView='ready';
    modal(`<header class="driverDashboardBar">
      <div class="driverBarNav">
        <button type="button" id="driverBack" aria-label="Voltar aos acessos">‹</button>
        <strong>Caseirão Burger</strong>
        <button type="button" id="driverLogout">Sair</button>
      </div>
    </header>
    <div class="driverScreenNew driverDashboard">
      <div class="driverGreeting"><p>Central do entregador</p><h1>Olá, ${esc(fresh.driver.name)}</h1></div>
      <section class="driverPickupBanner${ready.length?' has-ready':''}" aria-label="Retirada no Caseirão">
        <div class="driverPickupHeadline" role="status">
          <span class="driverPickupCount">${ready.length}</span>
          <div class="driverPickupCopy">
            <h2>${ready.length===1?'Entrega pronta':'Entregas prontas'}</h2>
            <p>${ready.length?'Japopo, por favor, não demore quando tiver entregas te esperando! 😂':'Nenhum pedido esperando na loja'}</p>
          </div>
          <span class="driverPickupIcon" aria-hidden="true"></span>
        </div>
      </section>
      <div class="driverDashboardNav" role="group" aria-label="Listas de entregas">
        <button type="button" data-driver-view="ready" aria-controls="driverReadyPanel">Prontas <span>${ready.length}</span></button>
        <button type="button" data-driver-view="route" aria-controls="driverRoutePanel">Em rota <span>${enRoute.length}</span></button>
      </div>
      <section id="driverReadyPanel" data-driver-panel="ready" aria-label="Entregas prontas">
        <div class="driverDashboardList">${ready.map(driverOrderCard).join('')||'<p class="driverRouteEmpty">As entregas liberadas aparecem aqui.</p>'}</div>
      </section>
      <section id="driverRoutePanel" data-driver-panel="route" aria-label="Entregas em andamento" hidden>
        <div class="driverDashboardList">${enRoute.map(driverOrderCard).join('')||'<p class="driverRouteEmpty">Nenhuma entrega em rota.</p>'}</div>
        ${other.length?`<details class="driverOverview driverOtherOrders" data-driver-detail="other">
          <summary>Outras entregas <span>${other.length}</span></summary>
          <div class="driverDashboardList">${other.map(driverOrderCard).join('')}</div>
        </details>`:''}
      </section>
      ${driverDailySummaryHtml(fresh.assignments||[])}
    </div>`,true);
    const screen=document.querySelector('.driverDashboard');
    const sheet=screen.closest('.sheet');
    sheet.classList.add('driverDashboardSheet');
    sheet.querySelector('.modalNav')?.remove();
    if(!oldScreen)driverDashboardView=!ready.length&&enRoute.length?'route':'ready';
    showDriverDashboardView(screen,driverDashboardView);
    screen.querySelectorAll('[data-driver-view]').forEach(button=>{
      button.onclick=()=>showDriverDashboardView(screen,button.dataset.driverView);
    });
    $('#driverBack').onclick=()=>{
      driverDashboardView='ready';
      closeModal();
    };
    screen.querySelectorAll('details').forEach(item=>{item.open=details.has(item.dataset.driverDetail)});
    startDriverDeliveryClock();
    if(oldSheet&&scrollTop)screen.closest('.sheet')?.scrollTo({top:scrollTop});
    $('#driverLogout').onclick=async()=>{
      await driverAppApi('logout').catch(()=>{});
      localStorage.removeItem(driverTokenKey);
      driverReadySeen.clear();
      driverDashboardView='ready';
      clearInternalResume();
      stopDriverAreaGps();
      openDriverLogin();
    };
    const sound=$('#driverReadySound');
    sound.onclick=()=>{
      const enabled=sound.getAttribute('aria-pressed')!=='true';
      localStorage.setItem(driverReadySoundKey,enabled?'on':'off');
      sound.setAttribute('aria-pressed',String(enabled));
      if(enabled)playOrderSound();
      showAppToast(enabled?'Alerta sonoro ativado nesta tela.':'Alerta sonoro desativado.','ok');
    };
    screen.querySelectorAll('[data-driver-status]').forEach(b=>b.onclick=()=>updateDriverDelivery(b.dataset.driverAssignment,b.dataset.driverStatus));
    screen.querySelectorAll('[data-driver-gps]').forEach(b=>b.onclick=()=>startDriverAreaGps(b.dataset.driverGps,b));
    const incoming=ready.filter(a=>!driverReadySeen.has(String(a.id)));
    driverReadySeen=new Set(ready.map(a=>String(a.id)));
    if(ready.length&&(incoming.length||returnedFromDelivery)){
      if(localStorage.getItem(driverReadySoundKey)==='on')playOrderSound();
      showAppToast(`${driverReadyNotice(ready.length)}`,'ok');
    }else if(returnedFromDelivery){
      showAppToast('Entrega confirmada.','ok');
    }
  }catch(e){
    if(/expirado/i.test(e.message)){localStorage.removeItem(driverTokenKey);driverReadySeen.clear();clearInternalResume();openDriverLogin()}
    else modal(`<div class="err">${esc(e.message)}</div>`,true);
  }
}

function driverAssignmentSignature(snapshot){
  return JSON.stringify([snapshot?.driver_gas_allowance,(snapshot?.assignments||[]).map(a=>[a.id,a.status,a.updated_at,a.route_started_at,a.delivered_at,a.orders?.status,a.orders?.archived_at,a.orders?.updated_at,a.orders?.ready_at])]);
}
async function refreshAutomaticDriver(){
  if(driverSyncBusy||document.hidden||!localStorage.getItem(driverTokenKey)||!document.querySelector('.driverScreenNew'))return;
  const previous=driverSnapshot;
  driverSyncBusy=true;
  try{
    const fresh=await driverAppApi('snapshot');
    if(driverSnapshot===previous&&document.querySelector('.driverScreenNew')&&
      driverAssignmentSignature(fresh)!==driverAssignmentSignature(previous))await renderDriverArea(fresh);
  }catch(e){console.warn('Falha temporária na atualização automática do entregador:',e)}
  finally{driverSyncBusy=false;}
}
function startAutomaticDriverSync(){
  if(automaticDriverSyncTimer)return;
  automaticDriverSyncTimer=setInterval(refreshAutomaticDriver,3500);
  document.addEventListener('visibilitychange',refreshAutomaticDriver);
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

/* A API do entregador pode devolver o pedido completo dentro da atribuição,
   na lista geral de pedidos ou os itens em uma lista separada. Unificamos
   esses formatos para o motoboy sempre receber a especificação disponível. */
function driverFullOrder(assignment){
  const compact=assignment?.orders||{};
  const orderId=compact.id||assignment?.order_id;
  const full=(driverSnapshot?.orders||[]).find(order=>String(order.id)===String(orderId))||{};
  let directItems=assignment?.order_items||assignment?.items||compact.order_items||compact.items||full.order_items||full.items;
  if(typeof directItems==='string'){try{directItems=JSON.parse(directItems)}catch{directItems=[]}}
  const snapshotItems=(driverSnapshot?.order_items||[]).filter(item=>String(item.order_id)===String(orderId));
  const rawItems=Array.isArray(directItems)?directItems:(snapshotItems.length?snapshotItems:[]);
  const normalizedItems=rawItems.map(item=>({
    ...item,
    quantity:item.quantity??item.qty??1,
    product_name:item.product_name??item.name??item.product?.name??'Item',
    note:item.note??item.observation??item.notes??'',
    order_item_addons:item.order_item_addons??item.addons??item.item_addons??[]
  }));
  return {...compact,...full,order_items:normalizedItems};
}

function driverOrderCard(a){
  if(isDriverAssignmentFinished(a))return '';
  const order=driverFullOrder(a);
  const id=esc(a.id),number=esc(order.order_number||'—');
  const hood=esc(a.neighborhood_name||order.neighborhood_name||'Bairro não informado');
  const phone=String(order.customer_phone||'').replace(/\D/g,'');
  const ready=driverReadyForPickup(a);
  const pending=a.status==='assigned'&&!ready;
  const timer=pending?'':driverDeliveryTimerHtml(order.ready_at);
  const action=ready
    ? `<button type="button" class="primary" data-driver-status="route" data-driver-assignment="${id}">Retirei · iniciar rota</button>`
    : pending
      ? ''
      : `<button type="button" class="primary driverDeliverButton" data-driver-deliver="${id}">Marcar como entregue</button>`;
  return `<details class="driverOrder driverQueueOrder" name="caseirao-driver-order" data-driver-detail="${id}">
    <summary${timer?' class="has-driver-timer"':''}>
      <span class="driverOrderMarker" aria-hidden="true"></span>
      <span class="driverOrderCaption"><strong>Pedido #${number}</strong><small>${hood}</small></span>
      ${timer}
      <span class="driverOrderChevron" aria-hidden="true"></span>
    </summary>
    <div class="driverOrderExpanded">
      ${action?`<div class="driverNextAction">${action}</div>`:''}
      ${pending||a.status==='problem'? `<p class="driverOrderStatus">${esc(pending?(order.status==='preparando'?'Em preparo':'Aguardando preparo'):(a.problem_note||deliveryStatusLabel(a.status)))}</p>` : ''}
      <div class="driverDeliveryInfo">
        <div class="driverInfoBlock">
          <small>Endereço</small><strong>${esc(orderAddress(order))}</strong>
          <a class="driverInlineLink" href="${esc(safeMapsLink(order))}" target="_blank" rel="noopener">Abrir no mapa</a>
        </div>
        <div class="driverInfoBlock">
          <small>Cliente</small><strong>${esc(order.customer_name||'Não informado')}</strong>
          ${phone?`<a class="driverInlineLink" href="tel:${phone}">Ligar para o cliente</a>`:''}
        </div>
        <div class="driverInfoBlock">
          <small>Pagamento</small><strong>${esc(paymentLabel(order.payment))} · ${fmt(order.total)}</strong>
          ${order.change_for?`<span class="driverReference">Troco para ${esc(order.change_for)}</span>`:''}
          ${a.driver_fee?`<span class="driverReference">Taxa da entrega ${fmt(a.driver_fee)}</span>`:''}
          <button type="button" class="driverInlineLink" data-driver-payment="${id}">Alterar pagamento</button>
        </div>
      </div>
      <details class="driverOrderExtras" data-driver-detail="extras-${id}">
        <summary>Itens e mais ações</summary>
        <div class="orderItemsBox">${orderItemsHtml(order)}</div>
        ${order.notes?`<p class="driverOrderStatus">${esc(order.notes)}</p>`:''}
        ${deliveryTimesHtml(a)}
        <button type="button" class="secondary" data-driver-gps="${id}">Compartilhar GPS</button>
        ${a.status!=='assigned'?`<button type="button" class="secondary danger" data-driver-status="problem" data-driver-assignment="${id}">Informar problema</button>`:''}
      </details>
    </div>
  </details>`;
}

async function updateDriverDelivery(id,status){try{const payload={assignment_id:id,status};if(status==='problem'){const note=prompt('O que aconteceu na entrega?','Cliente não localizado');if(note===null)return;payload.problem_note=note}if(status==='delivered'){const a=(driverSnapshot.assignments||[]).find(x=>x.id===id),o=a?.orders||{};if(o.payment==='Dinheiro'){const cash=prompt('Quanto em dinheiro ficou com você após devolver o troco?',String(Number(o.total||0).toFixed(2)).replace('.',','));if(cash===null)return;const change=prompt('Quanto de troco você entregou ao cliente?','0,00');if(change===null)return;payload.cash_received=num(cash);payload.change_given=num(change)}payload.payment_confirmed=true}await driverAppApi('status',payload);if(status==='delivered'){stopDriverAreaGps();await renderDriverArea(null,{returnedFromDelivery:true})}else{await renderDriverArea();showAppToast(deliveryStatusLabel(status),'ok')}}catch(e){alert(e.message)}}
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
function deliveryClosingHtml(){
  const rows=driverClosingData();
  const deliveries=rows.reduce((sum,driver)=>sum+driver.count,0);
  const fees=rows.reduce((sum,driver)=>sum+driver.fees,0);
  const gas=rows.reduce((sum,driver)=>sum+driver.gas,0);
  return `
    <section class="deliveryProHero" aria-label="Resumo das entregas">
      <div class="deliveryHeroMetrics">
        <div class="deliveryHeroMetric"><small>Entregas hoje</small><b>${deliveries}</b></div>
        <div class="deliveryHeroMetric"><small>Valor das entregas</small><b>${fmt(fees)}</b></div>
        <div class="deliveryHeroMetric"><small>Total com gasolina</small><b>${fmt(fees+gas)}</b></div>
      </div>
    </section>
    <details class="deliveryClosingFold" data-delivery-panel="closing">
      <summary>
        <span><b>Fechamento dos entregadores</b><small>Taxas, gasolina e totais por entregador</small></span>
        <span class="deliveryClosingChevron" aria-hidden="true"></span>
      </summary>
      <div class="deliveryClosingBody">
        <div class="closingActions"><button type="button" id="refreshDriverDeliveries" class="secondary refreshDeliveriesBtn">Atualizar fechamento</button></div>
        ${rows.length?rows.map(closingDriverCard).join(''):'<div class="empty">Nenhuma entrega concluída hoje.</div>'}
      </div>
    </details>`;
}
const renderDeliveryHubProBase=renderDeliveryHub;
renderDeliveryHub=async function(box){
  const openPanels=await renderDeliveryHubProBase(box);
  if(!openPanels||!box.isConnected)return false;
  box.insertAdjacentHTML('afterbegin',deliveryClosingHtml());
  box.querySelector('.deliveryClosingFold').open=openPanels.includes('closing');
  const refresh=box.querySelector('#refreshDriverDeliveries');
  refresh.onclick=async()=>{
    refresh.disabled=true;
    refresh.textContent='Atualizando…';
    const rendered=await renderDeliveryHub(box);
    if(rendered&&box.isConnected){
      showAppToast('Entregas atualizadas.','ok');
      box.querySelector('#refreshDriverDeliveries')?.focus({preventScroll:true});
    }
    if(refresh.isConnected){
      refresh.disabled=false;
      refresh.textContent='Atualizar fechamento';
    }
  };
  return openPanels;
};
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

async function clearDeliveryCenterV33(event){
  const box=event.currentTarget.closest('#admContent');
  const snapshot=deliveryHub||{orders:[],assignments:[]},orderCount=(snapshot.orders||[]).length,assignmentCount=(snapshot.assignments||[]).length;
  if(!orderCount&&!assignmentCount)return alert('A central já está vazia.');
  if(!confirm(`APAGAR E ZERAR TODA A CENTRAL?\n\nSerão retiradas da tela ${orderCount} comandas e ${assignmentCount} registros de rota atuais. Pedidos novos continuarão aparecendo normalmente.`))return;
  if(!confirm('Confirme mais uma vez: deseja iniciar um novo expediente com a tela de entregas vazia?'))return;
  const buttons=[...box.querySelectorAll('[data-clear-delivery-center]')];
  try{
    buttons.forEach(b=>{b.disabled=true;b.textContent='LIMPANDO TUDO...'});
    for(const assignment of snapshot.assignments||[]){
      if(!['delivered','returned','settled'].includes(assignment.status)){try{await driverAppApi('admin_unassign',{assignment_id:assignment.id},true)}catch{}}
    }
    try{await driverAppApi('admin_reset_deliveries',{},true)}catch{}
    const previous=deliveryClearedRecords();
    saveDeliveryClearedRecords({orders:[...new Set([...previous.orders,...(snapshot.orders||[]).map(o=>String(o.id))])],assignments:[...new Set([...previous.assignments,...(snapshot.assignments||[]).map(a=>String(a.id))])],cleared_at:new Date().toISOString()});
    if(box?.isConnected)await renderDeliveryHub(box);
    showAppToast('Central zerada. Novo expediente iniciado.','ok');
  }catch(error){alert(error.message||'Não foi possível limpar a central.');buttons.forEach(b=>{b.disabled=false;b.textContent='Apagar e zerar tudo'})}
}

const renderDeliveryHubControlBase=renderDeliveryHub;
renderDeliveryHub=async function(box){
  const openPanels=await renderDeliveryHubControlBase(box);
  if(!openPanels||!box.isConnected)return false;
  box.insertAdjacentHTML('beforeend',`
    <details class="deliveryControlPanel" data-delivery-panel="settings">
      <summary>
        <span><b>Configurações das entregas</b><small>Taxas, gasolina e limpeza do expediente</small></span>
        <span class="deliveryClosingChevron" aria-hidden="true"></span>
      </summary>
      <div class="deliverySettingsActions">
        <button type="button" id="configureDriverRates" class="secondary">Valores por bairro e gasolina</button>
        <button type="button" class="secondary deliveryControlDanger" data-clear-delivery-center>Apagar e zerar tudo</button>
      </div>
    </details>`);
  box.querySelector('.deliveryControlPanel').open=openPanels.includes('settings');
  box.querySelector('#configureDriverRates').onclick=openDriverRateSettings;
  box.querySelector('[data-clear-delivery-center]').onclick=clearDeliveryCenterV33;
  const visibleAssignments=[...(deliveryHub.assignments||[]).filter(a=>a.status!=='settled'),...(deliveryHub.assignments||[]).filter(a=>a.status==='settled').slice(0,10)];
  box.querySelectorAll('.deliveryOperationalCard').forEach((card,index)=>{const assignment=visibleAssignments[index];if(!assignment||['delivered','returned','settled'].includes(assignment.status))return;const actions=card.querySelector('.deliveryActions');if(!actions||actions.querySelector('[data-edit-delivery-control]'))return;const button=document.createElement('button');button.type='button';button.className='primary';button.dataset.editDeliveryControl=assignment.id;button.textContent='✎ EDITAR ENTREGA';button.onclick=()=>openDeliveryControlEditor(assignment);actions.prepend(button)});
  return openPanels;
};

const driverToken=decodeURIComponent((location.hash.match(/^#entregador=([^&]+)/)||[])[1]||'');if(driverToken)setTimeout(()=>openDriverTracking(driverToken),100);
