'use strict';
(()=>{
 const POLL_INTERVAL=5000;
 const REMINDER_WINDOW=15*60*1000;
 let reservations=[],lastSignature='',lastRefresh=0,fetching,changing=false,initialized=false;
 let shortcut,openOrderId,alertOrderId;
 const announced=new Set();
 const reminderKey='caseirao_schedule_reminders';
 let reminded=new Map();
 try{reminded=new Map(JSON.parse(sessionStorage.getItem(reminderKey)||'[]'));}catch{}
 const pending=o=>['agendado','agendado_confirmado'].includes(o?.status);
 const centralIsOpen=()=>shortcut?.isConnected||operationalMode==='admin'&&Boolean(modalRoot.firstElementChild);
 const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Fortaleza',dateStyle:'short',timeStyle:'short'});
 const time=value=>new Date(value).toLocaleTimeString('pt-BR',{timeZone:'America/Fortaleza',hour:'2-digit',minute:'2-digit'}).replace(':','h');
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
 function updateShortcut(){
   if(!shortcut?.isConnected)return;
   const count=reservations.filter(o=>o.status==='agendado').length;
   const badge=shortcut.querySelector('strong');
   if(badge.textContent!==String(count))badge.textContent=String(count);
   if(badge.hidden!==(count===0))badge.hidden=count===0;
   const label=count===1?'1 agendamento pendente':count>1?count+' agendamentos pendentes':'Ver agendamentos';
   if(shortcut.title!==label){
     shortcut.title=label;
     shortcut.setAttribute('aria-label',label);
   }
 }
 function announceReservations(){
   const now=Date.now();
   const newOrders=reservations.filter(o=>o.status==='agendado'&&!announced.has(o.id));
   reservations.forEach(o=>announced.add(o.id));
   const due=reservations.filter(o=>{
     const minutes=Date.parse(o.scheduled_for)-now;
     return minutes>0&&minutes<=REMINDER_WINDOW&&!reminded.has(o.id+'|'+o.scheduled_for);
   });
   if(due.length){
     for(const [key,expires] of reminded)if(expires<=now)reminded.delete(key);
     due.forEach(o=>reminded.set(o.id+'|'+o.scheduled_for,Date.parse(o.scheduled_for)));
     try{sessionStorage.setItem(reminderKey,JSON.stringify([...reminded]));}catch{}
   }
   const arrivals=initialized?newOrders:[];
   const arrivalIds=new Set(arrivals.map(o=>o.id));
   for(const order of arrivals){
     alertOrderId=order.id;
     showPassiveNotice('Novo agendamento #'+order.order_number+' · '+date(order.scheduled_for)+' · Aguardando confirmação','schedule','schedule-new:'+order.id);
   }
   for(const order of due){
     if(arrivalIds.has(order.id))continue;
     alertOrderId=order.id;
     const minutes=Math.ceil((Date.parse(order.scheduled_for)-now)/60000);
     const status=order.status==='agendado'?' · Aguardando confirmação':'';
     showPassiveNotice('Agendamento #'+order.order_number+' às '+time(order.scheduled_for)+' · Faltam '+minutes+' min'+status,'schedule','schedule-due:'+order.id);
   }
   if(arrivals.length||due.length)window.CaseiraoSoundV8?.play('agendamento');
   initialized=true;
 }
 function fetchReservations(){
   if(fetching)return fetching;
   const pin=sessionStorage.getItem('caseirao_admin_pin');
   lastRefresh=Date.now();
   // A sincronização em segundo plano não pode abrir o prompt de PIN.
   fetching=adminCall('scheduled_orders',{},false).then(result=>{
     if(!centralIsOpen()||sessionStorage.getItem('caseirao_admin_pin')!==pin)return;
     reservations=(result.orders||[]).filter(pending);
     updateShortcut();
     announceReservations();
   }).finally(()=>{fetching=null;});
   return fetching;
 }
 async function refreshReservations(box,quiet=false){
   if(changing||!centralIsOpen()||!sessionStorage.getItem('caseirao_admin_pin'))return;
   try{
     await fetchReservations();
     if(changing||!box?.isConnected||adminTab!=='agendados')return;
     const signature=JSON.stringify(reservations);
     if(quiet&&(signature===lastSignature||box.contains(document.activeElement)))return;
     lastSignature=signature;
     paint(box);
   }catch(error){
     if(!box?.isConnected||adminTab!=='agendados'||quiet)return;
     if(box.querySelector('.scheduleGrid')){
       showPassiveNotice(error.message||String(error),'err','schedule-refresh-error');
       return;
     }
     box.innerHTML='<div class="empty">'+esc(error.message||String(error))+'</div><button id="retrySchedules" class="secondary">Tentar novamente</button>';
     box.querySelector('#retrySchedules').onclick=()=>refreshReservations(box);
   }
 }
 function paint(box){
   box.innerHTML=`<div class="notice"><b>Reservas sob sua confirmação</b><br>Confirmar reserva mantém o pedido nesta aba. Use “Liberar para preparo” quando for iniciar. A liberação exige expediente aberto e Pix quitado.</div><div class="orderToolbar"><b>${reservations.length} agendamento(s)</b><button id="refreshSchedules" class="secondary">Atualizar</button></div><div class="scheduleGrid">${reservations.map(o=>`<article class="scheduleCard"><div class="scheduleCardTop"><div><small>AGENDADO PARA</small><h2>${esc(date(o.scheduled_for))}</h2></div><span class="scheduleState ${o.status==='agendado_confirmado'?'accepted':''}">${o.status==='agendado'?'Aguardando confirmação':'Reserva confirmada'}</span></div><b>#${esc(o.order_number)} · ${esc(o.customer_name)}</b><p>${esc(o.customer_phone)} · ${o.type==='delivery'?'Entrega':o.type==='pickup'?'Retirada':'No local'}</p>${o.type==='delivery'?`<p>${esc([o.address_street,o.address_number,o.neighborhood_name,o.address_complement,o.address_reference].filter(Boolean).join(' · '))}</p>`:''}<div class="scheduleItems">${(o.order_items||[]).map(i=>`<p><b>${Number(i.quantity)}× ${esc(i.product_name)}</b>${(i.order_item_addons||[]).map(a=>'<br>+ '+esc(a.addon_name)).join('')}${i.note?'<br>Obs.: '+esc(i.note):''}</p>`).join('')}</div>${o.notes?`<p><b>Observação:</b> ${esc(o.notes)}</p>`:''}<p><b>${fmt(o.total)}</b> · ${esc(o.payment)} ${o.payment==='Pix'?(o.payment_status==='confirmed'?'<strong class="green">PAGO</strong>':'<strong class="red">PIX PENDENTE</strong>'):''}</p><div class="scheduleActions"><button data-schedule-print="${o.id}" class="secondary">Bluetooth · Imprimir comanda</button>${o.status==='agendado'?`<button data-schedule-action="confirm_schedule" data-id="${o.id}" class="primary">Confirmar reserva</button>`:`<button data-schedule-action="release_schedule" data-id="${o.id}" class="primary">Liberar para preparo</button>`}<button data-schedule-action="reject_schedule" data-id="${o.id}" class="secondary">Recusar</button></div>${o.payment==='Pix'&&o.payment_status==='confirmed'?'<small>Se recusar um Pix já pago, providencie o estorno ao cliente.</small>':''}</article>`).join('')||'<div class="empty">Nenhuma reserva aguardando confirmação ou liberação.</div>'}</div>`;
   $('#refreshSchedules').onclick=()=>refreshReservations(box);
   if(openOrderId){
     const card=[...box.querySelectorAll('[data-schedule-print]')].find(button=>button.dataset.schedulePrint===openOrderId)?.closest('.scheduleCard');
     card?.scrollIntoView({block:'nearest'});
     openOrderId=null;
   }
   box.querySelectorAll('[data-schedule-print]').forEach(button=>button.onclick=async()=>{try{button.disabled=true;await printOrderBluetooth(button.dataset.schedulePrint,reservations);}catch(e){alert(e.message||String(e));}finally{button.disabled=false;}});
   box.querySelectorAll('[data-schedule-action]').forEach(button=>button.onclick=async()=>{
     const action=button.dataset.scheduleAction;let reason='';
     if(action==='reject_schedule'){const answer=prompt('Motivo da recusa (será exibido ao cliente):');if(!answer?.trim())return;reason=answer.trim();}
     if(action==='release_schedule'&&!confirm('Liberar esta reserva para o fluxo normal de preparo agora?'))return;
     if(changing)return;
     changing=true;
     try{
       button.disabled=true;
       await fetching?.catch(()=>{});
       await adminCall(action,{order_id:button.dataset.id,reason});
       admin=await adminCall('snapshot');
       changing=false;
       await refreshReservations(box);
     }
     catch(error){alert(error.message||String(error));button.disabled=false;}
     finally{changing=false;}
   });
 }
 const tab=renderAdminTab;
 renderAdminTab=function(){if(adminTab!=='agendados')return tab();const box=$('#admContent');if(!box)return;box.innerHTML='<div class="empty">Carregando agendamentos…</div>';refreshReservations(box);};
 window.caseiraoMountScheduleAlerts=function(button){
   shortcut=button;
   updateShortcut();
   button.onclick=()=>{
     openOrderId=reservations.some(o=>o.id===alertOrderId)?alertOrderId:null;
     adminTab='agendados';
     renderAdmin();
   };
   if(adminTab!=='agendados'&&Date.now()-lastRefresh>=POLL_INTERVAL)refreshReservations(null,true);
 };
 function poll(){
   if(Date.now()-lastRefresh<POLL_INTERVAL)return;
   refreshReservations(adminTab==='agendados'?$('#admContent'):null,true);
 }
 setInterval(poll,POLL_INTERVAL+100);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')poll();});
})();
