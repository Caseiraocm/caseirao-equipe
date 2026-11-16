'use strict';
(()=>{
 let reservations=[],loading=false,lastSignature='';
 const pending=o=>['agendado','agendado_confirmado'].includes(o?.status);
 const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Fortaleza',dateStyle:'short',timeStyle:'short'});
 const baseShift=shiftOrders;
 shiftOrders=function(){return baseShift().filter(o=>!pending(o));};
 const baseSale=orderCountsAsSale;
 orderCountsAsSale=function(o){return !pending(o)&&baseSale(o);};
 const basePrint=eligibleForAutoPrint;
 eligibleForAutoPrint=function(o){return !pending(o)&&basePrint(o);};
 const plain=receiptPlain;
 receiptPlain=function(o){return (o?.scheduled_for?'AGENDADO: '+date(o.scheduled_for)+'\n'+(pending(o)?'RESERVA - NAO INICIAR PREPARO\n':''):'')+plain(o);};
 const html=receiptBrowserHtml;
 receiptBrowserHtml=function(o){return html(o).replace('</body>',(o?.scheduled_for?'<p><b>AGENDADO: '+esc(date(o.scheduled_for))+'</b></p>':'')+'</body>');};
 async function refreshReservations(box,quiet=false){
   if(loading)return;loading=true;
   try{const result=await adminCall('scheduled_orders');reservations=result.orders||[];const signature=JSON.stringify(reservations);
     if(box?.isConnected&&adminTab==='agendados'&&(!quiet||signature!==lastSignature)){lastSignature=signature;paint(box);}
   }catch(error){if(box?.isConnected&&adminTab==='agendados'&&!quiet)box.innerHTML='<div class="empty">'+esc(error.message||String(error))+'</div><button id="retrySchedules" class="secondary">Tentar novamente</button>';box?.querySelector('#retrySchedules')?.addEventListener('click',()=>refreshReservations(box));}
   finally{loading=false;}
 }
 function paint(box){
   box.innerHTML=`<div class="notice"><b>Reservas sob sua confirmação</b><br>Confirmar reserva mantém o pedido nesta aba. Use “Liberar para preparo” quando for iniciar. A liberação exige expediente aberto e Pix quitado.</div><div class="orderToolbar"><b>${reservations.length} agendamento(s)</b><button id="refreshSchedules" class="secondary">Atualizar</button></div><div class="scheduleGrid">${reservations.map(o=>`<article class="scheduleCard"><div class="scheduleCardTop"><div><small>AGENDADO PARA</small><h2>${esc(date(o.scheduled_for))}</h2></div><span class="scheduleState ${o.status==='agendado_confirmado'?'accepted':''}">${o.status==='agendado'?'Aguardando confirmação':'Reserva confirmada'}</span></div><b>#${esc(o.order_number)} · ${esc(o.customer_name)}</b><p>${esc(o.customer_phone)} · ${o.type==='delivery'?'Entrega':o.type==='pickup'?'Retirada':'No local'}</p>${o.type==='delivery'?`<p>${esc([o.address_street,o.address_number,o.neighborhood_name,o.address_complement,o.address_reference].filter(Boolean).join(' · '))}</p>`:''}<div class="scheduleItems">${(o.order_items||[]).map(i=>`<p><b>${Number(i.quantity)}× ${esc(i.product_name)}</b>${(i.order_item_addons||[]).map(a=>'<br>+ '+esc(a.addon_name)).join('')}${i.note?'<br>Obs.: '+esc(i.note):''}</p>`).join('')}</div>${o.notes?`<p><b>Observação:</b> ${esc(o.notes)}</p>`:''}<p><b>${fmt(o.total)}</b> · ${esc(o.payment)} ${o.payment==='Pix'?(o.payment_status==='confirmed'?'<strong class="green">PAGO</strong>':'<strong class="red">PIX PENDENTE</strong>'):''}</p><div class="scheduleActions"><button data-schedule-print="${o.id}" class="secondary">Bluetooth · Imprimir comanda</button>${o.status==='agendado'?`<button data-schedule-action="confirm_schedule" data-id="${o.id}" class="primary">Confirmar reserva</button>`:`<button data-schedule-action="release_schedule" data-id="${o.id}" class="primary">Liberar para preparo</button>`}<button data-schedule-action="reject_schedule" data-id="${o.id}" class="secondary">Recusar</button></div>${o.payment==='Pix'&&o.payment_status==='confirmed'?'<small>Se recusar um Pix já pago, providencie o estorno ao cliente.</small>':''}</article>`).join('')||'<div class="empty">Nenhuma reserva aguardando confirmação ou liberação.</div>'}</div>`;
   $('#refreshSchedules').onclick=()=>refreshReservations(box);
   box.querySelectorAll('[data-schedule-print]').forEach(button=>button.onclick=async()=>{try{button.disabled=true;await printOrderBluetooth(button.dataset.schedulePrint,reservations);}catch(e){alert(e.message||String(e));}finally{button.disabled=false;}});
   box.querySelectorAll('[data-schedule-action]').forEach(button=>button.onclick=async()=>{
     const action=button.dataset.scheduleAction;let reason='';
     if(action==='reject_schedule'){const answer=prompt('Motivo da recusa (será exibido ao cliente):');if(!answer?.trim())return;reason=answer.trim();}
     if(action==='release_schedule'&&!confirm('Liberar esta reserva para o fluxo normal de preparo agora?'))return;
     try{button.disabled=true;await adminCall(action,{order_id:button.dataset.id,reason});admin=await adminCall('snapshot');await refreshReservations(box);}
     catch(error){alert(error.message||String(error));button.disabled=false;}
   });
 }
 const tab=renderAdminTab;
 renderAdminTab=function(){if(adminTab!=='agendados')return tab();const box=$('#admContent');if(!box)return;box.innerHTML='<div class="empty">Carregando agendamentos…</div>';refreshReservations(box);};
 setInterval(()=>{if(adminTab==='agendados'&&sessionStorage.getItem('caseirao_admin_pin'))refreshReservations($('#admContent'),true);},15000);
})();
