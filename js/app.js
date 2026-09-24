/* ===== core-script-1 ===== */
(()=>{
'use strict';
/* Normaliza texto para impressoras ESC/POS simples sem depender de helper externo. */
function stripAccents(value){
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'\"').replace(/[\u2013\u2014]/g,'-');
}
const FN=window.CASEIRAO_CONFIG?.FUNCTIONS_URL||'https://jhvtjhjzlljqfzdccrxc.supabase.co/functions/v1/';
const $=s=>document.querySelector(s), fmt=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}), esc=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]));
let data={settings:{},products:[],neighborhoods:[],addons:[],product_addons:[],coupons:[]},cart=[],cat='Todos',search='',orderType='delivery',admin=null,adminTab='pedidos';
let audioCtx=null,orderWatcher=null,knownOrderIds=new Set(),knownOrderStatuses=new Map();
let btDevice=null,btWriteChar=null,btPrinterName='',deliveryPoll=null,driverWatch=null,driverWakeLock=null,driverGpsTimer=null,driverVisibilityHandler=null,driverSending=false;
function unlockOrderSound(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!audioCtx)audioCtx=new AC();if(audioCtx.state==='suspended')audioCtx.resume()}catch{}}
function playOrderSound(){try{unlockOrderSound();if(audioCtx){const now=audioCtx.currentTime;[880,1175,880].forEach((f,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.0001,now+i*.22);g.gain.exponentialRampToValueAtTime(.22,now+i*.22+.02);g.gain.exponentialRampToValueAtTime(.0001,now+i*.22+.18);o.connect(g);g.connect(audioCtx.destination);o.start(now+i*.22);o.stop(now+i*.22+.2)})}}catch{}try{navigator.vibrate?.([260,120,260])}catch{}}
function showOrderToast(o){document.querySelector('.orderToast')?.remove();const t=document.createElement('div');t.className='orderToast';t.textContent=`🔔 NOVO PEDIDO #${o.order_number} • ${o.customer_name||'Cliente'} • ${fmt(o.total)}`;document.body.appendChild(t);setTimeout(()=>t.remove(),7000)}
function showReadyToast(o){document.querySelector('.orderToast')?.remove();const t=document.createElement('div');t.className='orderToast readyToast';t.textContent=`✅ PEDIDO #${o.order_number} ESTÁ NO PONTO`;document.body.appendChild(t);setTimeout(()=>t.remove(),10000)}
function startOrderWatcher(){if(orderWatcher)clearInterval(orderWatcher);knownOrderIds=new Set((admin?.orders||[]).map(o=>o.id));knownOrderStatuses=new Map((admin?.orders||[]).map(o=>[String(o.id),o.status]));orderWatcher=setInterval(checkNewOrders,5000)}
async function checkNewOrders(){if(!sessionStorage.getItem('caseirao_admin_pin'))return;try{const fresh=await adminCall('snapshot');const novos=(fresh.orders||[]).filter(o=>!knownOrderIds.has(o.id)&&o.source!=='manual');const prontos=(fresh.orders||[]).filter(o=>o.status==='pronto'&&knownOrderStatuses.has(String(o.id))&&knownOrderStatuses.get(String(o.id))!=='pronto');(fresh.orders||[]).forEach(o=>{knownOrderIds.add(o.id);knownOrderStatuses.set(String(o.id),o.status)});admin=fresh;if(prontos.length){playOrderSound();showReadyToast(prontos[0])}else if(novos.length){playOrderSound();showOrderToast(novos[0])}const box=$('#admContent');if(box&&adminTab==='pedidos'&&(novos.length||prontos.length))renderOrders(box)}catch{}}
const modalRoot=$('#modalRoot');
async function api(slug,opts={}){const r=await fetch(FN+slug,{cache:'no-store',...opts});let j={};try{j=await r.json()}catch{}if(!r.ok||j.error)throw new Error(j.error||j.detail||('Erro '+r.status));return j}
async function loyaltyStatus(trackingCodeOrPhone,phone){const customerPhone=phone||trackingCodeOrPhone;return api('loyalty-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:customerPhone})})}
async function loyaltyAdmin(action='snapshot',payload={}){const pin=sessionStorage.getItem('caseirao_admin_pin')||'';return api('loyalty-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,action,payload})})}
/* A API de fidelidade de versões antigas pode devolver o nome com outra chave
   ou somente o telefone. Unificamos os campos e recuperamos o nome pelo
   histórico de pedidos, que é a fonte original informada pelo cliente. */
function loyaltyCustomerName(customer){
  const direct=[customer?.name,customer?.customer_name,customer?.full_name,customer?.customerName,customer?.nome]
    .map(value=>String(value||'').trim())
    .find(value=>value&&value.toLowerCase()!=='cliente');
  if(direct)return direct;
  const phone=digits(customer?.phone||customer?.customer_phone||customer?.whatsapp||'');
  if(phone){
    const order=[...(admin?.orders||[])]
      .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))
      .find(item=>digits(item.customer_phone||item.phone||'')===phone&&String(item.customer_name||item.name||'').trim());
    if(order)return String(order.customer_name||order.name).trim();
  }
  return 'Nome não informado';
}
const loyaltyAdminRequest=loyaltyAdmin;
loyaltyAdmin=async function(action='snapshot',payload={}){
  const normalize=result=>{
    if(action!=='snapshot')return result;
    const source=Array.isArray(result?.customers)?result.customers:Array.isArray(result?.participants)?result.participants:Array.isArray(result?.data?.customers)?result.data.customers:[];
    result={...(result||{}),customers:source.map(customer=>({
      ...customer,
      phone:customer.phone||customer.customer_phone||customer.whatsapp||'',
      name:loyaltyCustomerName(customer)
    }))};
    try{localStorage.setItem('caseirao_loyalty_snapshot_v22',JSON.stringify({saved_at:Date.now(),result}))}catch{}
    return result;
  };
  const timeout=ms=>new Promise((_,reject)=>setTimeout(()=>reject(new Error('A fidelidade demorou para responder.')),ms));
  try{return normalize(await Promise.race([loyaltyAdminRequest(action,payload),timeout(10000)]))}
  catch(firstError){
    if(action!=='snapshot')throw firstError;
    try{return normalize(await Promise.race([loyaltyAdminRequest(action,payload),timeout(10000)]))}
    catch(secondError){
      try{const cached=JSON.parse(localStorage.getItem('caseirao_loyalty_snapshot_v22')||'null');if(Array.isArray(cached?.result?.customers))return {...cached.result,offline_cache:true}}
      catch{}
      throw secondError;
    }
  }
};
function loyaltyTarget(source){const raw=source?.orders_required??source?.target??source?.loyalty_orders_required??source?.rule?.orders_required??data?.settings?.loyalty_orders_required??10;return Math.max(1,Math.min(100,Math.round(Number(raw)||10)))}
function loyaltyHtml(l){const target=loyaltyTarget(l),progress=Math.max(0,Math.min(target,Number(l?.progress||0))),balance=Number(l?.reward_balance||0),remaining=Number.isFinite(Number(l?.remaining))?Math.max(0,Number(l.remaining)):Math.max(0,target-progress);return `<div class="loyaltyBox ${balance>0?'loyaltyReward':''}"><div class="loyaltyTitle"><b>${balance>0?'🎁 Brinde liberado!':'🍔 Fidelidade Caseirão'}</b><span class="loyaltyCount">${progress}/${target} pedidos</span></div><div class="loyaltyTrack"><div class="loyaltyFill" style="width:${Math.min(100,(progress/target)*100)}%"></div></div><div class="mini">${balance>0?`Você possui ${balance} ${balance===1?'brinde disponível':'brindes disponíveis'}. Avise a equipe ao receber o pedido.`:`Faltam ${remaining} ${remaining===1?'pedido':'pedidos'} para ganhar um brinde.`}</div></div>`}
async function loadLoyalty(boxId,trackingCode,phone){const box=$('#'+boxId);if(!box)return;try{const result=await loyaltyStatus(trackingCode,phone);if(box)box.innerHTML=loyaltyHtml(result.loyalty)}catch{if(box)box.innerHTML=''}}
async function catalog(){try{data=await api('catalog');renderCatalog()}catch(e){$('#storeStatus').textContent='Erro ao carregar';$('#storeStatus').className='status closed';$('#products').innerHTML=`<div class="empty"><b>Não foi possível carregar.</b><br>${esc(e.message)}<br><br><button class="secondary" onclick="location.reload()">Tentar novamente</button></div>`}}
function priceOf(p){return Number(p.promo_price)>0?Number(p.promo_price):Number(p.price||0)}
function allowedAddons(p){const ids=new Set(data.product_addons.filter(x=>x.product_id===p.id).map(x=>x.addon_id));return data.addons.filter(a=>a.active!==false&&ids.has(a.id))}
function cartCount(){return cart.reduce((s,x)=>s+x.qty,0)}function cartSubtotal(){return cart.reduce((s,x)=>s+(priceOf(x.product)+x.addons.reduce((a,b)=>a+Number(b.price||0),0))*x.qty,0)}
function renderCatalog(){const st=data.settings||{};$('#storeName').textContent=st.store_name||'O Caseirão Burger';const open=!!st.store_open;$('#storeStatus').textContent=open?(st.status_text||'Aberto'):'Fechado no momento';$('#storeStatus').className='status '+(open?'open':'closed');{const bn=$('#banner'),img=String(st.banner_image_url||''),txt=String(st.banner_text||'');if(st.banner_active&&(img||txt)){bn.innerHTML=img?`<img src="${esc(img)}" alt="Banner O Caseirão Burger" onerror="this.style.display='none'">${txt?`<div class="bannerCaption">${esc(txt)}</div>`:''}`:`<div>${esc(txt)}</div>`;bn.className='banner'+(img?' hasimg':'');bn.classList.remove('hide')}else{bn.className='banner hide';bn.innerHTML=''}}const cats=['Todos',...new Set(data.products.filter(p=>p.active!==false).map(p=>p.category||'Outros'))];$('#cats').innerHTML=cats.map(c=>`<button class="chip ${c===cat?'on':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{cat=b.dataset.cat;renderCatalog()});const q=search.trim().toLowerCase();const arr=data.products.filter(p=>p.active!==false&&(cat==='Todos'||(p.category||'Outros')===cat)&&(!q||(p.name+' '+(p.description||'')).toLowerCase().includes(q)));$('#products').innerHTML=arr.length?arr.map(p=>{const promo=Number(p.promo_price)>0;return `<article class="card"><div class="pic">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentNode.innerHTML='SEM FOTO'">`:'SEM FOTO'}</div><div class="pc"><div class="name">${esc(p.name)}</div><div class="desc">${esc(p.description||p.category||'')}</div><div class="price">${promo?`<span class="old">${fmt(p.price)}</span>`:''}${fmt(priceOf(p))}</div><button class="add" data-add="${p.id}">Adicionar</button></div></article>`}).join(''):'<div class="empty">Nenhum item encontrado.</div>';document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>openProduct(b.dataset.add));updateCartBar()}
function openProduct(id){const p=data.products.find(x=>x.id===id);if(!p)return;const adds=allowedAddons(p);modal(`<div class="sheeth"><h2>${esc(p.name)}</h2><button class="x" data-close>×</button></div><div class="notice">${esc(p.description||'Escolha os adicionais e observações.')}</div><div class="field"><label>Adicionais</label>${adds.length?adds.map(a=>`<label class="addon"><input type="checkbox" data-addon="${a.id}"><span class="grow">${esc(a.name)}</span><b>+ ${fmt(a.price)}</b></label>`).join(''):'<div class="mini">Este produto não possui adicionais cadastrados.</div>'}</div><div class="field"><label>Observação do item</label><textarea id="itemNote" class="ta" placeholder="Ex.: sem cebola, caprichar no molho..."></textarea></div><button id="confirmAdd" class="primary">Adicionar ao carrinho • ${fmt(priceOf(p))}</button>`);bindClose();$('#confirmAdd').onclick=()=>{const selected=[...document.querySelectorAll('[data-addon]:checked')].map(i=>data.addons.find(a=>a.id===i.dataset.addon)).filter(Boolean);cart.push({key:crypto.randomUUID(),product:p,addons:selected,note:$('#itemNote').value.trim(),qty:1});closeModal();updateCartBar()}}
function updateCartBar(){const n=cartCount();$('#cartLabel').textContent=`Carrinho • ${n} ${n===1?'item':'itens'}`;$('#cartTotal').textContent=fmt(cartSubtotal())}
function modal(html,full=false){modalRoot.innerHTML=`<div class="overlay"><section class="sheet ${full?'full':''}">${html}</section></div>`;modalRoot.querySelector('.overlay').addEventListener('click',e=>{if(e.target.classList.contains('overlay'))closeModal()})}function closeModal(){if(deliveryPoll){clearInterval(deliveryPoll);deliveryPoll=null}modalRoot.innerHTML=''}function bindClose(){document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal)}
function renderCart(){modal(`<div class="sheeth"><h2>Seu pedido</h2><button class="x" data-close>×</button></div><div id="cartLines"></div><div class="sum"><div class="sumrow"><span>Subtotal</span><b>${fmt(cartSubtotal())}</b></div></div><div class="twoBtns"><button class="secondary" data-close>Continuar comprando</button><button id="goCheckout" class="primary" ${cart.length?'':'disabled'}>Continuar</button></div>`);bindClose();const box=$('#cartLines');box.innerHTML=cart.length?cart.map(x=>`<div class="lineitem"><div class="grow"><b>${esc(x.product.name)}</b><div class="mini">${x.addons.map(a=>esc(a.name)).join(', ')||'Sem adicionais'}${x.note?'<br>'+esc(x.note):''}</div><div class="mini">${fmt((priceOf(x.product)+x.addons.reduce((s,a)=>s+Number(a.price||0),0))*x.qty)}</div></div><div class="qty"><button data-q="${x.key}" data-d="-1">−</button><b>${x.qty}</b><button data-q="${x.key}" data-d="1">+</button></div></div>`).join(''):'<div class="empty">Seu carrinho está vazio.</div>';document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const x=cart.find(i=>i.key===b.dataset.q);if(!x)return;x.qty+=Number(b.dataset.d);if(x.qty<=0)cart=cart.filter(i=>i.key!==x.key);updateCartBar();renderCart()});if($('#goCheckout'))$('#goCheckout').onclick=openCheckout}
function checkoutFee(){if(orderType!=='delivery')return 0;const id=$('#neighborhood')?.value;return Number(data.neighborhoods.find(n=>n.id===id)?.fee||0)}
function openCheckout(){const ns=data.neighborhoods.filter(n=>n.active!==false);const st=data.settings||{};modal(`<div class="sheeth"><h2>Finalizar pedido</h2><button class="x" data-close>×</button></div><div class="seg"><button data-type="delivery" class="${orderType==='delivery'?'on':''}">Entrega</button><button data-type="pickup" class="${orderType==='pickup'?'on':''}">Retirada</button><button data-type="local" class="${orderType==='local'?'on':''}">No local</button></div><div class="row"><div class="field"><label>Seu nome</label><input id="custName" class="in" autocomplete="name"></div><div class="field"><label>WhatsApp</label><input id="custPhone" class="in" inputmode="tel" placeholder="(86) 99999-9999"></div></div><div id="addressBox"></div><div class="row"><div class="field"><label>Pagamento</label><select id="payment" class="sel"><option value="Pix">Pix</option><option value="Dinheiro">Dinheiro</option><option value="Cartão">Cartão</option></select></div><div class="field"><label>Troco para</label><input id="changeFor" class="in" placeholder="Ex.: 50,00"></div></div><div class="field"><label>Cupom</label><input id="coupon" class="in" placeholder="Opcional"></div><div class="field"><label>Observações gerais</label><textarea id="orderNotes" class="ta" placeholder="Alguma observação sobre o pedido?"></textarea></div>${st.pix_text?`<div class="notice">${esc(st.pix_text)}</div>`:''}<div id="checkoutSum" class="sum"></div><button id="sendOrder" class="primary">Enviar pedido</button>`);bindClose();document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{orderType=b.dataset.type;openCheckout()});renderAddress();renderCheckoutSum();$('#neighborhood')?.addEventListener('change',renderCheckoutSum);$('#sendOrder').onclick=sendOrder}
function renderAddress(){const box=$('#addressBox');if(!box)return;if(orderType!=='delivery'){box.innerHTML=`<div class="notice">${orderType==='pickup'?'Você retira no Caseirão.':'Pedido para consumo no local.'}</div>`;return}box.innerHTML=`<div class="row"><div class="field"><label>Rua / Avenida</label><input id="street" class="in"></div><div class="field"><label>Número</label><input id="number" class="in"></div></div><div class="row"><div class="field"><label>Bairro</label><select id="neighborhood" class="sel"><option value="">Selecione</option>${data.neighborhoods.filter(n=>n.active!==false).map(n=>`<option value="${n.id}">${esc(n.name)} • ${fmt(n.fee)}</option>`).join('')}</select></div><div class="field"><label>Complemento</label><input id="complement" class="in" placeholder="Casa, apto..."></div></div><div class="field"><label>Referência</label><input id="reference" class="in"></div>`}
function renderCheckoutSum(){const subtotal=cartSubtotal(),fee=checkoutFee();$('#checkoutSum').innerHTML=`<div class="sumrow"><span>Subtotal</span><b>${fmt(subtotal)}</b></div><div class="sumrow"><span>Entrega</span><b>${fmt(fee)}</b></div><div class="sumrow total"><span>Total estimado</span><b>${fmt(subtotal+fee)}</b></div>`}
async function sendOrder(){try{const btn=$('#sendOrder');btn.disabled=true;btn.textContent='Enviando...';const customer={name:$('#custName').value.trim(),phone:$('#custPhone').value.trim()};const payload={customer,type:orderType,payment:$('#payment').value,change_for:$('#changeFor').value.trim(),coupon_code:$('#coupon').value.trim(),notes:$('#orderNotes').value.trim(),items:cart.map(x=>({product_id:x.product.id,qty:x.qty,addon_ids:x.addons.map(a=>a.id),note:x.note}))};if(orderType==='delivery')payload.address={street:$('#street').value.trim(),number:$('#number').value.trim(),neighborhood_id:$('#neighborhood').value,complement:$('#complement').value.trim(),reference:$('#reference').value.trim()};const j=await api('create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:j.tracking_code,phone:customer.phone}));cart=[];updateCartBar();modal(`<div class="sheeth"><h2>Pedido recebido ✅</h2><button class="x" data-close>×</button></div><div class="success"><b>Pedido #${j.order_number}</b><br>Código: <b>${esc(j.tracking_code)}</b><br>Total: <b>${fmt(j.total)}</b></div><br><button id="trackNow" class="primary">Acompanhar pedido</button>`);bindClose();$('#trackNow').onclick=()=>openTracking(j.tracking_code,customer.phone)}catch(e){alert(e.message);if($('#sendOrder')){$('#sendOrder').disabled=false;$('#sendOrder').textContent='Enviar pedido'}}}
function openTracking(code='',phone=''){const saved=(()=>{try{return JSON.parse(localStorage.getItem('caseirao_last_tracking')||'{}')}catch{return{}}})();modal(`<div class="sheeth"><h2>Acompanhar pedido</h2><button class="x" data-close>×</button></div><div class="field"><label>Código do pedido</label><input id="trackCode" class="in" value="${esc(code||saved.tracking_code||'')}"></div><div class="field"><label>Seu telefone</label><input id="trackPhone" class="in" inputmode="tel" value="${esc(phone||saved.phone||'')}"></div><button id="doTrack" class="primary">Consultar</button><div id="trackResult" style="margin-top:12px"></div>`);bindClose();$('#doTrack').onclick=trackOrder;if(code||saved.tracking_code)trackOrder()}
const statusLabel={novo:'Pedido recebido',confirmado:'Confirmado',preparando:'Em preparo',pronto:'Pronto',em_rota:'Em rota',entregue:'Entregue',cancelado:'Cancelado'};
const statusFlow=['novo','confirmado','preparando','pronto','em_rota','entregue'];
const statusTone=s=>'st-'+String(s||'novo');
const localDay=d=>{const x=new Date(d),y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,'0'),day=String(x.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};
const todayKey=()=>localDay(new Date());
async function trackOrder(){try{const code=$('#trackCode').value.trim(),phone=$('#trackPhone').value.trim();const j=await api('track-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tracking_code:code,phone})});localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:code,phone}));const current=j.order.status;const currentIndex=statusFlow.indexOf(current);const steps=current==='cancelado'?[`<div class="step"><span class="dot done" style="background:#ff5a5f"></span><div><b style="color:#ff9ca0">Pedido cancelado</b><div class="mini">Consulte o estabelecimento se precisar de ajuda.</div></div></div>`]:statusFlow.map((st,i)=>`<div class="step"><span class="dot ${i<=currentIndex?'done':''}" style="${i<=currentIndex?(st==='em_rota'?'background:#4da3ff':st==='entregue'?'background:#2ecc71':''):''}"></span><div><b style="${i<=currentIndex?'color:#fff':'color:#6f7782'}">${esc(statusLabel[st]||st)}</b>${st===current?'<div class="mini">Status atual</div>':''}</div></div>`).join('');$('#trackResult').innerHTML=`<div class="trackbox"><b>Pedido #${j.order.order_number}</b><div style="margin:9px 0"><span class="statusBadge ${statusTone(current)}">${esc(statusLabel[current]||current)}</span></div><div class="mini">Total ${fmt(j.order.total)}</div></div><div id="trackingLoyalty"></div><div class="timeline">${steps}</div><div id="customerDeliveryMap"></div>`;loadLoyalty('trackingLoyalty',code,phone);loadCustomerDeliveryMap(code,phone)}catch(e){$('#trackResult').innerHTML=`<div class="err">${esc(e.message)}</div>`}}
function openAdmin(){modal(`<div class="sheeth"><h2>Área administrativa</h2><button class="x" data-close>×</button></div><div class="loginbox"><div class="field"><label>PIN do ADM</label><input id="adminPin" class="in" type="password" inputmode="numeric" autocomplete="off"></div><button id="adminLogin" class="primary">Entrar</button><div id="adminErr" style="margin-top:10px"></div></div>`,true);bindClose();$('#adminLogin').onclick=adminLogin}
async function adminCall(action='snapshot',payload={},allowRetry=true){const pin=sessionStorage.getItem('caseirao_admin_pin')||'';try{return await api('admin-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,action,payload})})}catch(e){if(/PIN incorreto/i.test(String(e?.message||e))&&allowRetry){sessionStorage.removeItem('caseirao_admin_pin');const fresh=(window.prompt('Sua sessão do ADM expirou. Digite o PIN novamente:')||'').trim();if(fresh){sessionStorage.setItem('caseirao_admin_pin',fresh);return adminCall(action,payload,false)}throw new Error('PIN do ADM necessário para continuar.')}throw e}}
async function archiveCall(action='archive_shift',payload={},allowRetry=true){const pin=sessionStorage.getItem('caseirao_admin_pin')||'';try{return await api('admin-archive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,action,payload})})}catch(e){if(/PIN incorreto/i.test(String(e?.message||e))&&allowRetry){sessionStorage.removeItem('caseirao_admin_pin');const fresh=(window.prompt('Sua sessão do ADM expirou. Digite o PIN novamente:')||'').trim();if(fresh){sessionStorage.setItem('caseirao_admin_pin',fresh);return archiveCall(action,payload,false)}throw new Error('PIN do ADM necessário para continuar.')}throw e}}
async function adminLogin(){try{unlockOrderSound();const pin=$('#adminPin').value.trim();sessionStorage.setItem('caseirao_admin_pin',pin);admin=await adminCall('snapshot',{},false);startOrderWatcher();renderAdmin()}catch(e){sessionStorage.removeItem('caseirao_admin_pin');$('#adminErr').innerHTML=`<div class="err">${esc(e.message)}</div>`}}
async function refreshAdmin(){admin=await adminCall('snapshot');renderAdmin()}
function renderAdmin(){if(!admin)return;const today=admin.orders.filter(o=>localDay(o.created_at)===todayKey()&&o.status!=='cancelado');const sales=today.reduce((s,o)=>s+Number(o.total||0),0);modal(`<div class="sheeth"><h2>ADM • O Caseirão</h2><button class="x" data-close>×</button></div><div class="admgrid"><div class="metric"><b>${today.length}</b><span>Pedidos hoje</span></div><div class="metric"><b>${fmt(sales)}</b><span>Vendas hoje</span></div><div class="metric"><b>${admin.products.filter(p=>p.active).length}</b><span>Produtos ativos</span></div><div class="metric"><b class="${admin.settings.store_open?'green':'red'}">${admin.settings.store_open?'ABERTO':'FECHADO'}</b><span>Loja agora</span></div></div><div class="admbar" style="margin-top:14px">${[['pedidos','Pedidos'],['relatorios','Relatórios'],['produtos','Produtos'],['bairros','Bairros'],['adicionais','Adicionais'],['cupons','Cupons'],['banner','Banner'],['loja','Loja']].map(([k,n])=>`<button data-tab="${k}" class="${adminTab===k?'on':''}">${n}</button>`).join('')}</div><div id="admContent"></div>`,true);bindClose();document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{adminTab=b.dataset.tab;renderAdmin()});renderAdminTab()}
function renderAdminTab(){const box=$('#admContent');if(!box)return;if(adminTab==='pedidos')renderOrders(box);if(adminTab==='relatorios')renderReportsAdmin(box);if(adminTab==='produtos')renderProductsAdmin(box);if(adminTab==='bairros')renderNeighborhoodsAdmin(box);if(adminTab==='adicionais')renderAddonsAdmin(box);if(adminTab==='cupons')renderCouponsAdmin(box);if(adminTab==='banner')renderBannerAdmin(box);if(adminTab==='loja')renderStoreAdmin(box)}
function orderTypeLabel(t){return t==='delivery'?'Entrega':t==='pickup'?'Retirada':t==='counter'?'Balcão':'Consumo no local'}
function paymentLabel(v){return String(v||'Não informado')}
function orderText(o){return `${orderTypeLabel(o.type)} • ${o.customer_name} • ${fmt(o.total)}`}
function orderAddress(o){if(o.type!=='delivery')return orderTypeLabel(o.type);const first=[o.address_street,o.address_number].filter(Boolean).join(', ');const parts=[first,o.neighborhood_name,o.address_complement?`Compl.: ${o.address_complement}`:'',o.address_reference?`Ref.: ${o.address_reference}`:''].filter(Boolean);return parts.join(' • ')||'Endereço não informado'}
function orderItemsHtml(o){const items=Array.isArray(o.order_items)?o.order_items:[];if(!items.length)return '<div class="orderItemRow mini">Carregando itens do pedido...</div>';return items.map(it=>{const adds=Array.isArray(it.order_item_addons)?it.order_item_addons:[];const addHtml=adds.map(a=>`<div class="orderAddonLine">+ ${esc(a.addon_name)} ${Number(a.price||0)>0?`(${fmt(a.price)})`:''}</div>`).join('');return `<div class="orderItemRow"><div class="orderItemHead"><div class="grow"><b>${Number(it.quantity||1)}x ${esc(it.product_name||'Item')}</b>${addHtml}${it.note?`<div class="orderItemNote">Obs. do item: ${esc(it.note)}</div>`:''}</div><div class="orderItemPrice">${fmt(it.line_total||Number(it.unit_price||0)*Number(it.quantity||1))}</div></div></div>`}).join('')}
function orderAdminCard(o,finished=false){const actions=[['confirmado','Confirmado'],['preparando','Preparando'],['pronto','Pronto'],['em_rota','Em rota'],['entregue','Entregue'],['cancelado','Cancelado']];const when=new Date(o.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});const delivery=Number(o.delivery_fee||0);const deliveryDiscount=Number(o.delivery_discount||0);const discount=Number(o.discount||0);const change=o.change_for?String(o.change_for):'';return `<div class="order orderDetailed ${finished?'finishedOrder':''}"><div class="ordertop"><div><div class="orderNumber">Pedido #${o.order_number}</div><div class="orderTime">${esc(when)}${o.archived_at?' • ARQUIVADO':''}</div></div><span class="statusBadge ${statusTone(o.status)}">${esc(statusLabel[o.status]||o.status)}</span><span class="grow"></span><b style="font-size:19px">${fmt(o.total)}</b></div><div class="orderInfoGrid"><div class="orderInfo"><span>Cliente</span><b>${esc(o.customer_name||'Não informado')}</b><small>${esc(o.customer_phone||'Sem telefone')}</small></div><div class="orderInfo"><span>Tipo / pagamento</span><b>${esc(orderTypeLabel(o.type))}</b><small>${esc(paymentLabel(o.payment))}${change?` • Troco para ${esc(change)}`:''}</small></div></div>${o.type==='delivery'?`<div class="addressBoxAdmin"><b>📍 Endereço completo</b>${esc(orderAddress(o))}</div>`:''}<div class="sectionTitle" style="margin-top:11px">Itens do pedido</div><div class="orderItemsBox">${orderItemsHtml(o)}</div>${o.notes?`<div class="notesBoxAdmin"><b>📝 Observações gerais</b>${esc(o.notes)}</div>`:''}<div class="orderTotalsBox"><div class="orderTotalLine"><span>Subtotal</span><b>${fmt(o.subtotal)}</b></div>${delivery?`<div class="orderTotalLine"><span>Taxa de entrega</span><b>${fmt(delivery)}</b></div>`:''}${deliveryDiscount?`<div class="orderTotalLine"><span>Desconto na entrega</span><b>- ${fmt(deliveryDiscount)}</b></div>`:''}${discount?`<div class="orderTotalLine"><span>Desconto${o.coupon_code?` (${esc(o.coupon_code)})`:''}</span><b>- ${fmt(discount)}</b></div>`:''}<div class="orderTotalLine grand"><span>TOTAL</span><b>${fmt(o.total)}</b></div></div><div class="orderMeta">Código: ${esc(o.tracking_code||'—')} • Origem: ${esc(o.source||'client')} • ID: ${esc(o.id)}</div><div class="printActions"><button data-webprint="${o.id}">🧾 Imprimir pedido</button><button class="bt" data-btprint="${o.id}">🖨️ Bluetooth</button></div>${finished?`<div class="orderactions"><button class="statusAction ${statusTone(o.status)} selected" disabled>${esc(statusLabel[o.status]||o.status)} ✓</button></div>`:`<div class="orderactions">${actions.map(([st,label])=>`<button data-st="${st}" data-oid="${o.id}" class="statusAction ${statusTone(st)} ${o.status===st?'selected':''}" aria-pressed="${o.status===st?'true':'false'}">${o.status===st?'✓ ':''}${label}</button>`).join('')}</div>`}</div>`}
const RECEIPT_LOGO_DATA_URL='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEnAQAAAAA7wUMbAAAMvklEQVRo3u2aPYwkRxWAq6+X7UOy6EUkBHC9RBdyyBKcJeM+SwREOCBF8kkXXMiiC7yI9XYfKzEElkbCAT7ZMGSENnIARNOrQV4sWR5LDmwJ66aHOTxG2Npe5rjpua2p4r3666qe7tlBckhJuztb/fWreq9evXpVNYRvUgryf+wiLCfEuxgDCspFWEFIwFPiX4BJICXxWqxQ3Ur9dVippZQkasdYbIRkYSu2nNHEvNGO5dG0+mfAOy2Y04GSj5sxGojWwLiih3GZNGKFUI6QqFTWjRqxDN/ORAUJZfeaMLQsJYlsGf8UTRgLhLJKAfyHJQ0Ydo0Z86b4q9eA5YnWwuhz0oDdVT+qoNzJKoZdo9YIofCHqxiFVorYMja+Eq9gaPNjKVcqeGQZuMIeGK9QWGU1GxuBwNjGaNyEwbOcO8/DBozBj3IwJbTNkZjqcKqmTdmMSf/q88x3G69hZ+J3j+cBp+pjEzZQHS9C1d50FUuUZqXPy1CMFOeLFYzprsCEQGnyc1OjpbbWWVdpY4bUxqSZwFEmJ7xI9MisYNIH2Qt8Oudz7upgYV0zGqacr2J6DOxCV7EqylSFxSvYlK8pFdbbDIubHi/rWDXDnc7VsSWrxHUrLqlhs1IbZHJ1qKEy7tWwKQy4skx3qu1VRMMaNswDVfPiiJ+qyvyb0xrWM65t6XLcmdWw+OiuMXyiyaPjhYuxJMiUblcOn9FYMKYuRlkgHZv3v22ksfBTHSgUtqC+DEfdfjW4NPprEjvYrPiGNFwk1EyU2bowbW1sWhQyBvYmMJDaWkmk/Fxjw7w8FIajt/KDQMXcnEXKhBrrZVQskkN6Mz3QGUFO42TuYP30MMLw+Ot9WLF8NQuOy8MaljwRh2i4oISUwFfed1RQNWsUxg6vRB2IguzH+TV/+46xrg4PGqNxOIA5vOTZXkD2tXUHMxdbPo46YxE40iIgKlzSqDOpYfBmgSvDPM0Dv4z70rrhYF7zEBB2GPL5NIUMqZBDVBxGndMaBsJiiDIcl/A06SuzhW6jcw7CIp8PKCG7gyMuYg0MTNR3sCkHYV/y+b8+vbR1Y3D1nM9hLDOoSxxsyOFNzIve2d4iNxNp0+zZ8tBtdLiEfmQBjz8iHilelFjuF7VZ32OgFcyt5ArxvLMF+AU4Zx6Mz2UvNRZxsFEessOQeMFkId2nCHAUzi0s5r3OOIsgjr9xHAxUeCqCzlRFG4nBxOgOCoLY7wbhAFekPi4R4XBuYzCFp2NM8ahPojBNhHxIXaK+MwowGycFRYyQw6+TO3Mxq6EiGdnYAj11nyQMntD9cC7XVLbzTOKMwhkO4PXdhB7o3HJ5itjX3Pg2Q3cg1zhVkNL+2k/daDnBVsgv3aAf852ZOwpTdNU0tZY8gV03nyU2RMdPV9Lzp1Yxvk1khqfWcinv1MFwbFKN4ZQQxYrtFZZpzKwQZrEbKQxfy1c2CSKZkn2qsDIc9+x8p8sXQ/XxVGKiGYoJl2yGKhG69amFqVR1emRWKpNF/0diyqqYptItv6sH40MHY8b4BBXxSYIxl1t53mOJ6dQKct38OiHb4JpqpB1MRzHw7rv0JoSHSKiioxZ0ArClwSaY7cIOStl5XsP0a3PEqNyMGUZj54nG4G+A24raXkxhRtpCJLq+XllNYRLTq9QSR3vecfdOGptbmQqDSHWaRs3Y0KoCJeXsSqzK58VgGawvjE+SmjQeuhiXGG/CTu30COSVK3td3hWv9pw6awro0mnAGorEzOu0BTtxsaL+PJo3YZMaRX1ZM0CsOXXDUpKsHetaJpQ2nDRh1S43dzCrMwdh/uWAxgaTph4jVpmB0T3v92nwocFyC1tWGLh4aPVtUUpHPqvt60UItwZFbdDOGtyhXvK4FVtaAmEGSaxcccTy+Up50FZiOZ5DaFYo5+zESFIILCUBsrAhAhRqIb7ue2IE4AGYOC4LwnDH70sWMJjNscZiPETJNMbEGQ6ygEFsiDQWMYlFAqOICTaHFwkJJZaSELHUwog4kUAMj3S0tEBhYYkqlEjQViwkId1TWCKwjMS5lxrMF1iUIbYErETsAC0R537uQ6wpvcLPBEYM5lEIy4RJLCg0Vvg4AmAfjQEhfmUk+jywHYml67DCY1/dAAPi8maY6lu6G+XgBe8Z7BKR2DUXuxnikZmRViqMORhHjNiYbzCuMfBPgliyCYbp2QYYJG3gAb7BkmaMga8rLG/CvoDYXiDdHzFwpDIw2DKxsCLA0xCNBUWF0cQ0yhDL0AMuxnKcgBILiyBtw0qcgBKLAItrfZMYLuKhtBtMYwtzpEHYYxWWtGAeRkeYgHIUSJKH7ViqsdRg1MGowMwETGMb4+uwLFLeW2HFgZf5lpM3YwzmPbGxLMpJClgeLuuY52AY21AaYKzC9gVWboa50kLVtwYsl1geXojR9RiB+IZh8GANtgfRAJaBINdYqjAZeyVGwY3AlSoM/CPKQ7SbhUFkLQKBhZmFBRhUKwxDNGKlg0GMTeuYh9iBXGUE5gssTMPHEqO4LuyCMRg5lEsbYiVgIDEg4b/l8lGKVcZHDEIhfxAoLEMMejE3qwxDDREzB0UnEsscDFbAMA/dNXqisEhjGCLdqwK5zidgZMBEIknFstucHIC+uPwqLOBtZVJiJi9ypHUYPlVNkYZuVQXPdVXmEK/B8OBI5iEev6DYGyiTxwTWlYGFWQUCPqbRgzFPk1aMRoBh1o9YdNaMFbHA4vymxIqgEYNEArD9OC8Q64wKrw2Lw/IgHkvMPmq3se2ghhWNWNipYY/1ePFGjP9vWLkhpixMG7D9VWlLB+t2EbumMJh8GltITGW5rwu7kWScSexhoXrmYg8igXGNPdJYqRwJ/7vL34gR87i22yMiroRAgcrf4HEqGv0JH5cSe3iHZzG2daZUkIp3haZ7iL0vNJ0rPccO9voHwiAVdiqqz2HDJLG+wlgcLveTM4XNJTYzWE/8f3rC4lMusJGFzWFmSGwkLfIBA7EC4xaGVwrVIQxXm/QXk4ePEHudz6U9T42H6tfQggl/FOJBTL/ag3Tr2Gfi9z84jfmfInUEMMI7GGJa06XPn8TdR19X93m05qb4DwZj6zDTRsLije6d6SYYwzOZi7ElHu1sghWb3Imf49nYJiqMN8Mmm2GDzbDO54qF3JqnrQUP9eyZJd7snMAcjcLuSQMWm7qrvZfvnrAfPHf1ZVNF41XsyV7/3pC9e/uFN00VRjl7Akqsd2/I3709nVUY11hX1dznT3ZO7h3z396eTs11cMG5OwGFtBlIe+b2sKoac+voVWN9wNjh7d5IVZyK1dCc96rynd6bAtMXWTD9TgxWXW0Gnc5gzMIw0CegfXGKIjHrUKBeEnEyak6220ZKHsCa4/SWspRnWeZwvqWci7HS2KgNm8uTVXMN0VJO5YGWuftoKSN5Sauw8zasL1MSfX3T5sGJPGk2GFTUUxkYaobnotydMq8ak6qCp2ryJMnGnqpjmNbIU3P7WxM/M5ZXBT1C3kZZGLWfmhp5vN2E6TLGoZZfHLCwpeV2oryDo35cx2hUO2h8Fz3iqI7xeOxib+GvYAXjb7tYbszmYvdcTJgtXsW+4t6LI6byH+d7Dr6LoeJKK0fapLxV/dMVhhw3YNOychJ2VSSqnQZsXnSMG7M74mPYgPF/B9rCDNZeXt2SuNiD5z5WSpTxVflnFZvzB8OP1dXwLJbOzVexJaejjw9Fb2azvrD1MW9qFK94T+HPyWzW+42laB3rvw3YNDo5P+8NLUVXVpkRHfJJdLJYCMxcH7lfqYJWBfb+YjEST5M2acsh/3v08oL28L+ct2B4UZRHry6osMtRKwZiPundVbMiaMVgmgAmp2rZb8WgfNb7s/xQbWYasT5K6VdjsGZ1XtpdW7uIWy6/DrNCaLFmM9mzMZK0gNUdSB+wlLRsO81CVoasEN8SvNWEqdyBXfdeCiRGVi92dJt4FpH6GlvdPCvvyLd3CdnS2Kq4n4vf9y978HDrPY0pNQytdp3B0z4+NdLqwuR7zHvkpzZ2t+9QmdybMug89I3saYwoT5UDqQdnKc4tiGekma9i4p6p1JrT6+VfXOyy6n3pKE75Lwj5ntWoGTLr84Lf/+5bhFwi18hlcqNm4cxcF875R0+LL30i1mYTLC+9pjAoO0KFhnHl/LXXoK3t9A3Re2j3iw3jCmH10XaqpV2WwlZbzXqvdKD6CcTOs+97NV11SaP0Fjzb/hV0CxTziNfkTfSPcZpB9aVLgM0zwYTkxm7t9ORvwzjDEd1CJWc52Ul3yBXybN3p/nn/WyjM37qB2CdokJ0bKD9y/ZfNYORe8ciPsG+5t4WtfpjueqGrKPvhJ8Ko76Q7/wWb/k+C0C9+3gAAAABJRU5ErkJggg==';
const RECEIPT_LOGO_SVG="<svg class=\"receiptLogo\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 220 216\" aria-label=\"Logo O Caseirão Burger\"><path d=\"M102 6h21v1H102zM91 7h19v1H91zM118 7h15v1H118zM88 8h10v1H88zM124 8h13v1H124zM84 9h9v1H84zM130 9h10v1H130zM76 10h1v1H76zM82 10h5v1H82zM136 10h8v1H136zM69 11h1v1H69zM81 11h2v1H81zM140 11h4v1H140zM65 12h6v1H65zM144 12h2v1H144zM154 12h3v1H154zM63 13h5v1H63zM99 13h23v1H99zM147 13h1v1H147zM156 13h3v1H156zM61 14h5v1H61zM94 14h14v1H94zM115 14h13v1H115zM159 14h2v1H159zM59 15h5v1H59zM87 15h8v1H87zM128 15h7v1H128zM161 15h3v1H161zM58 16h4v1H58zM84 16h6v1H84zM133 16h6v1H133zM164 16h1v1H164zM55 17h5v1H55zM81 17h5v1H81zM136 17h5v1H136zM165 17h2v1H165zM54 18h4v1H54zM77 18h5v1H77zM141 18h4v1H141zM166 18h2v1H166zM52 19h4v1H52zM75 19h4v1H75zM143 19h5v1H143zM167 19h1v1H167zM169 19h1v1H169zM51 20h3v1H51zM73 20h4v1H73zM146 20h4v1H146zM170 20h2v1H170zM49 21h1v1H49zM51 21h2v1H51zM70 21h3v1H70zM111 21h1v1H111zM149 21h3v1H149zM68 22h4v1H68zM111 22h1v1H111zM151 22h3v1H151zM66 23h3v1H66zM110 23h3v1H110zM154 23h3v1H154zM64 24h3v1H64zM107 24h9v1H107zM156 24h2v1H156zM62 25h3v1H62zM95 25h1v1H95zM107 25h9v1H107zM157 25h3v1H157zM60 26h3v1H60zM94 26h3v1H94zM108 26h7v1H108zM127 26h2v1H127zM161 26h1v1H161zM59 27h3v1H59zM92 27h6v1H92zM109 27h5v1H109zM126 27h4v1H126zM162 27h2v1H162zM57 28h3v1H57zM93 28h4v1H93zM109 28h5v1H109zM127 28h3v1H127zM163 28h1v1H163zM55 29h3v1H55zM93 29h4v1H93zM108 29h2v1H108zM113 29h2v1H113zM126 29h4v1H126zM54 30h2v1H54zM93 30h1v1H93zM108 30h1v1H108zM126 30h1v1H126zM167 30h1v1H167zM53 31h2v1H53zM169 31h1v1H169zM52 32h2v1H52zM169 32h2v1H169zM49 33h1v1H49zM47 34h2v1H47zM46 35h2v1H46zM52 36h3v1H52zM113 36h1v1H113zM43 37h2v1H43zM50 37h6v1H50zM104 37h5v1H104zM113 37h2v1H113zM122 37h1v1H122zM167 37h5v1H167zM177 37h2v1H177zM42 38h2v1H42zM49 38h8v1H49zM97 38h3v1H97zM104 38h1v1H104zM107 38h1v1H107zM166 38h7v1H166zM178 38h2v1H178zM41 39h2v1H41zM48 39h10v1H48zM99 39h1v1H99zM165 39h4v1H165zM171 39h3v1H171zM179 39h2v1H179zM40 40h2v1H40zM47 40h4v1H47zM54 40h5v1H54zM94 40h1v1H94zM100 40h2v1H100zM105 40h1v1H105zM111 40h2v1H111zM117 40h1v1H117zM164 40h4v1H164zM172 40h3v1H172zM180 40h2v1H180zM39 41h2v1H39zM46 41h5v1H46zM55 41h5v1H55zM100 41h1v1H100zM102 41h1v1H102zM163 41h4v1H163zM172 41h1v1H172zM174 41h2v1H174zM181 41h2v1H181zM38 42h2v1H38zM45 42h7v1H45zM56 42h5v1H56zM88 42h3v1H88zM102 42h1v1H102zM162 42h4v1H162zM171 42h2v1H171zM182 42h1v1H182zM37 43h2v1H37zM44 43h3v1H44zM50 43h3v1H50zM57 43h5v1H57zM89 43h1v1H89zM96 43h2v1H96zM110 43h1v1H110zM119 43h1v1H119zM161 43h4v1H161zM170 43h2v1H170zM36 44h2v1H36zM43 44h4v1H43zM51 44h3v1H51zM58 44h5v1H58zM92 44h3v1H92zM96 44h3v1H96zM102 44h4v1H102zM110 44h5v1H110zM119 44h2v1H119zM161 44h3v1H161zM169 44h3v1H169zM36 45h1v1H36zM42 45h5v1H42zM52 45h3v1H52zM59 45h4v1H59zM83 45h2v1H83zM92 45h18v1H92zM111 45h5v1H111zM160 45h4v1H160zM168 45h3v1H168zM176 45h1v1H176zM185 45h1v1H185zM35 46h1v1H35zM41 46h3v1H41zM45 46h3v1H45zM53 46h3v1H53zM60 46h4v1H60zM82 46h4v1H82zM92 46h17v1H92zM111 46h5v1H111zM129 46h1v1H129zM159 46h4v1H159zM167 46h3v1H167zM175 46h1v1H175zM34 47h2v1H34zM40 47h3v1H40zM46 47h3v1H46zM54 47h3v1H54zM61 47h4v1H61zM81 47h2v1H81zM90 47h5v1H90zM97 47h7v1H97zM106 47h6v1H106zM115 47h1v1H115zM158 47h4v1H158zM166 47h3v1H166zM174 47h1v1H174zM40 48h3v1H40zM47 48h3v1H47zM55 48h3v1H55zM62 48h4v1H62zM89 48h5v1H89zM97 48h6v1H97zM106 48h6v1H106zM115 48h4v1H115zM157 48h4v1H157zM165 48h3v1H165zM173 48h2v1H173zM41 49h3v1H41zM48 49h3v1H48zM56 49h3v1H56zM63 49h4v1H63zM85 49h1v1H85zM89 49h5v1H89zM96 49h8v1H96zM105 49h5v1H105zM115 49h4v1H115zM124 49h1v1H124zM156 49h4v1H156zM164 49h3v1H164zM172 49h2v1H172zM42 50h3v1H42zM49 50h3v1H49zM57 50h3v1H57zM64 50h4v1H64zM79 50h1v1H79zM88 50h22v1H88zM114 50h4v1H114zM124 50h1v1H124zM155 50h4v1H155zM163 50h3v1H163zM171 50h2v1H171zM43 51h3v1H43zM50 51h3v1H50zM58 51h3v1H58zM64 51h5v1H64zM78 51h3v1H78zM87 51h19v1H87zM107 51h3v1H107zM112 51h4v1H112zM155 51h3v1H155zM162 51h3v1H162zM170 51h2v1H170zM31 52h2v1H31zM44 52h3v1H44zM51 52h3v1H51zM59 52h3v1H59zM64 52h5v1H64zM84 52h1v1H84zM87 52h5v1H87zM93 52h13v1H93zM107 52h3v1H107zM111 52h2v1H111zM114 52h1v1H114zM121 52h1v1H121zM154 52h5v1H154zM161 52h3v1H161zM169 52h2v1H169zM31 53h1v1H31zM45 53h3v1H45zM52 53h3v1H52zM60 53h9v1H60zM84 53h1v1H84zM87 53h19v1H87zM108 53h4v1H108zM121 53h1v1H121zM154 53h9v1H154zM168 53h2v1H168zM30 54h2v1H30zM40 54h2v1H40zM46 54h3v1H46zM53 54h3v1H53zM61 54h7v1H61zM76 54h1v1H76zM82 54h2v1H82zM87 54h12v1H87zM100 54h5v1H100zM108 54h3v1H108zM115 54h2v1H115zM137 54h1v1H137zM155 54h7v1H155zM167 54h2v1H167zM174 54h1v1H174zM29 55h2v1H29zM41 55h2v1H41zM47 55h3v1H47zM54 55h3v1H54zM61 55h6v1H61zM76 55h1v1H76zM81 55h4v1H81zM88 55h11v1H88zM100 55h3v1H100zM108 55h2v1H108zM115 55h1v1H115zM125 55h1v1H125zM155 55h7v1H155zM166 55h2v1H166zM173 55h1v1H173zM29 56h1v1H29zM42 56h2v1H42zM48 56h3v1H48zM55 56h12v1H55zM81 56h5v1H81zM91 56h3v1H91zM95 56h3v1H95zM100 56h3v1H100zM107 56h3v1H107zM124 56h1v1H124zM156 56h7v1H156zM165 56h2v1H165zM172 56h1v1H172zM192 56h1v1H192zM28 57h2v1H28zM43 57h2v1H43zM49 57h3v1H49zM57 57h9v1H57zM81 57h6v1H81zM88 57h8v1H88zM100 57h3v1H100zM106 57h6v1H106zM135 57h1v1H135zM157 57h9v1H157zM178 57h1v1H178zM28 58h1v1H28zM43 58h3v1H43zM50 58h3v1H50zM57 58h9v1H57zM81 58h13v1H81zM99 58h3v1H99zM104 58h8v1H104zM114 58h2v1H114zM134 58h2v1H134zM157 58h9v1H157zM170 58h1v1H170zM27 59h2v1H27zM43 59h4v1H43zM51 59h3v1H51zM56 59h9v1H56zM75 59h2v1H75zM81 59h8v1H81zM133 59h1v1H133zM158 59h8v1H158zM169 59h1v1H169zM26 60h2v1H26zM44 60h4v1H44zM52 60h8v1H52zM62 60h3v1H62zM75 60h2v1H75zM147 60h1v1H147zM158 60h2v1H158zM161 60h4v1H161zM168 60h1v1H168zM175 60h1v1H175zM26 61h2v1H26zM45 61h4v1H45zM53 61h12v1H53zM75 61h2v1H75zM147 61h1v1H147zM158 61h2v1H158zM162 61h2v1H162zM25 62h2v1H25zM46 62h4v1H46zM53 62h12v1H53zM158 62h2v1H158zM162 62h2v1H162zM25 63h1v1H25zM47 63h4v1H47zM52 63h13v1H52zM103 63h2v1H103zM158 63h2v1H158zM24 64h2v1H24zM48 64h17v1H48zM105 64h2v1H105zM158 64h2v1H158zM24 65h1v1H24zM49 65h16v1H49zM159 65h4v1H159zM207 65h1v1H207zM23 66h2v1H23zM51 66h4v1H51zM61 66h3v1H61zM65 66h2v1H65zM76 66h3v1H76zM142 66h2v1H142zM156 66h2v1H156zM160 66h1v1H160zM207 66h2v1H207zM23 67h1v1H23zM64 67h4v1H64zM90 67h1v1H90zM95 67h3v1H95zM116 67h1v1H116zM156 67h3v1H156zM208 67h1v1H208zM22 68h2v1H22zM64 68h5v1H64zM86 68h12v1H86zM100 68h3v1H100zM116 68h2v1H116zM156 68h3v1H156zM11 69h1v1H11zM22 69h1v1H22zM65 69h5v1H65zM84 69h23v1H84zM115 69h4v1H115zM124 69h2v1H124zM155 69h3v1H155zM209 69h2v1H209zM11 70h1v1H11zM21 70h2v1H21zM66 70h3v1H66zM83 70h4v1H83zM92 70h3v1H92zM96 70h24v1H96zM123 70h3v1H123zM155 70h2v1H155zM210 70h2v1H210zM10 71h1v1H10zM21 71h2v1H21zM67 71h2v1H67zM82 71h5v1H82zM97 71h21v1H97zM210 71h2v1H210zM21 72h1v1H21zM67 72h2v1H67zM82 72h4v1H82zM99 72h18v1H99zM210 72h2v1H210zM20 73h2v1H20zM68 73h2v1H68zM82 73h3v1H82zM100 73h4v1H100zM108 73h7v1H108zM210 73h2v1H210zM20 74h1v1H20zM81 74h3v1H81zM101 74h2v1H101zM107 74h7v1H107zM210 74h2v1H210zM9 75h1v1H9zM19 75h2v1H19zM88 75h1v1H88zM106 75h7v1H106zM211 75h1v1H211zM19 76h2v1H19zM103 76h9v1H103zM211 76h3v1H211zM19 77h1v1H19zM103 77h8v1H103zM211 77h3v1H211zM18 78h2v1H18zM105 78h2v1H105zM212 78h3v1H212zM18 79h2v1H18zM212 79h3v1H212zM18 80h1v1H18zM74 80h2v1H74zM213 80h2v1H213zM18 81h1v1H18zM73 81h2v1H73zM169 81h5v1H169zM178 81h2v1H178zM213 81h2v1H213zM17 82h1v1H17zM168 82h8v1H168zM177 82h5v1H177zM213 82h3v1H213zM17 83h1v1H17zM106 83h3v1H106zM167 83h15v1H167zM213 83h3v1H213zM17 84h1v1H17zM81 84h2v1H81zM87 84h4v1H87zM96 84h6v1H96zM103 84h2v1H103zM106 84h3v1H106zM116 84h3v1H116zM166 84h15v1H166zM213 84h3v1H213zM16 85h1v1H16zM81 85h2v1H81zM85 85h8v1H85zM94 85h3v1H94zM101 85h8v1H101zM115 85h4v1H115zM167 85h3v1H167zM173 85h8v1H173zM214 85h2v1H214zM91 86h5v1H91zM106 86h2v1H106zM175 86h4v1H175zM214 86h2v1H214zM196 87h5v1H196zM214 87h2v1H214zM127 88h2v1H127zM193 88h11v1H193zM214 88h2v1H214zM20 89h11v1H20zM51 89h8v1H51zM96 89h9v1H96zM127 89h2v1H127zM191 89h15v1H191zM214 89h3v1H214zM18 90h15v1H18zM49 90h13v1H49zM73 90h10v1H73zM94 90h12v1H94zM113 90h17v1H113zM133 90h7v1H133zM144 90h14v1H144zM170 90h10v1H170zM190 90h17v1H190zM215 90h2v1H215zM5 91h1v1H5zM17 91h17v1H17zM47 91h16v1H47zM73 91h10v1H73zM93 91h14v1H93zM113 91h17v1H113zM133 91h7v1H133zM144 91h16v1H144zM170 91h10v1H170zM189 91h18v1H189zM215 91h2v1H215zM5 92h1v1H5zM16 92h19v1H16zM46 92h18v1H46zM73 92h10v1H73zM92 92h16v1H92zM113 92h17v1H113zM133 92h7v1H133zM144 92h17v1H144zM169 92h11v1H169zM189 92h19v1H189zM215 92h2v1H215zM16 93h19v1H16zM46 93h18v1H46zM73 93h11v1H73zM91 93h18v1H91zM113 93h17v1H113zM133 93h7v1H133zM144 93h18v1H144zM169 93h11v1H169zM188 93h20v1H188zM215 93h2v1H215zM15 94h21v1H15zM45 94h20v1H45zM72 94h12v1H72zM91 94h8v1H91zM100 94h9v1H100zM113 94h17v1H113zM133 94h7v1H133zM144 94h18v1H144zM169 94h11v1H169zM188 94h8v1H188zM200 94h8v1H200zM216 94h2v1H216zM15 95h9v1H15zM27 95h9v1H27zM45 95h9v1H45zM57 95h8v1H57zM72 95h12v1H72zM90 95h8v1H90zM102 95h8v1H102zM113 95h7v1H113zM133 95h7v1H133zM144 95h7v1H144zM154 95h9v1H154zM169 95h11v1H169zM188 95h8v1H188zM201 95h7v1H201zM216 95h2v1H216zM4 96h1v1H4zM15 96h8v1H15zM28 96h8v1H28zM45 96h8v1H45zM58 96h7v1H58zM72 96h12v1H72zM90 96h8v1H90zM103 96h7v1H103zM113 96h7v1H113zM133 96h7v1H133zM144 96h7v1H144zM155 96h8v1H155zM169 96h12v1H169zM188 96h7v1H188zM201 96h7v1H201zM216 96h2v1H216zM4 97h1v1H4zM15 97h8v1H15zM29 97h7v1H29zM45 97h7v1H45zM58 97h7v1H58zM72 97h12v1H72zM90 97h8v1H90zM103 97h7v1H103zM113 97h7v1H113zM133 97h7v1H133zM144 97h7v1H144zM155 97h8v1H155zM169 97h12v1H169zM188 97h7v1H188zM201 97h7v1H201zM216 97h2v1H216zM4 98h1v1H4zM15 98h8v1H15zM29 98h7v1H29zM45 98h7v1H45zM58 98h7v1H58zM71 98h13v1H71zM90 98h8v1H90zM103 98h7v1H103zM113 98h7v1H113zM133 98h7v1H133zM144 98h7v1H144zM155 98h8v1H155zM169 98h12v1H169zM188 98h7v1H188zM201 98h7v1H201zM216 98h2v1H216zM4 99h1v1H4zM15 99h8v1H15zM29 99h3v1H29zM33 99h3v1H33zM45 99h7v1H45zM58 99h7v1H58zM71 99h13v1H71zM90 99h8v1H90zM103 99h7v1H103zM113 99h7v1H113zM133 99h7v1H133zM144 99h7v1H144zM155 99h8v1H155zM169 99h12v1H169zM188 99h7v1H188zM201 99h7v1H201zM216 99h2v1H216zM4 100h1v1H4zM15 100h8v1H15zM29 100h7v1H29zM45 100h7v1H45zM58 100h7v1H58zM71 100h13v1H71zM90 100h8v1H90zM113 100h7v1H113zM133 100h7v1H133zM144 100h7v1H144zM155 100h8v1H155zM169 100h13v1H169zM188 100h7v1H188zM201 100h7v1H201zM216 100h2v1H216zM4 101h1v1H4zM15 101h8v1H15zM29 101h7v1H29zM45 101h7v1H45zM58 101h7v1H58zM71 101h6v1H71zM78 101h7v1H78zM91 101h8v1H91zM113 101h7v1H113zM133 101h7v1H133zM144 101h7v1H144zM155 101h8v1H155zM168 101h14v1H168zM188 101h7v1H188zM201 101h7v1H201zM216 101h3v1H216zM15 102h8v1H15zM29 102h7v1H29zM45 102h7v1H45zM59 102h5v1H59zM71 102h6v1H71zM78 102h7v1H78zM91 102h9v1H91zM113 102h7v1H113zM133 102h7v1H133zM144 102h7v1H144zM155 102h8v1H155zM168 102h7v1H168zM176 102h6v1H176zM188 102h7v1H188zM201 102h7v1H201zM216 102h3v1H216zM15 103h8v1H15zM29 103h7v1H29zM45 103h7v1H45zM70 103h7v1H70zM78 103h7v1H78zM92 103h9v1H92zM113 103h7v1H113zM133 103h7v1H133zM144 103h7v1H144zM155 103h8v1H155zM168 103h7v1H168zM176 103h6v1H176zM188 103h7v1H188zM201 103h7v1H201zM216 103h3v1H216zM15 104h8v1H15zM29 104h7v1H29zM45 104h7v1H45zM70 104h7v1H70zM78 104h7v1H78zM93 104h9v1H93zM113 104h15v1H113zM133 104h7v1H133zM144 104h7v1H144zM155 104h8v1H155zM168 104h7v1H168zM176 104h7v1H176zM188 104h7v1H188zM201 104h7v1H201zM216 104h3v1H216zM15 105h8v1H15zM29 105h7v1H29zM45 105h7v1H45zM70 105h7v1H70zM79 105h6v1H79zM94 105h10v1H94zM113 105h15v1H113zM133 105h7v1H133zM144 105h19v1H144zM168 105h6v1H168zM176 105h7v1H176zM188 105h7v1H188zM201 105h7v1H201zM216 105h3v1H216zM15 106h8v1H15zM29 106h7v1H29zM45 106h7v1H45zM70 106h6v1H70zM79 106h7v1H79zM95 106h10v1H95zM113 106h15v1H113zM133 106h7v1H133zM144 106h18v1H144zM167 106h7v1H167zM176 106h7v1H176zM188 106h7v1H188zM201 106h7v1H201zM216 106h3v1H216zM4 107h3v1H4zM15 107h8v1H15zM29 107h7v1H29zM45 107h7v1H45zM70 107h6v1H70zM79 107h7v1H79zM96 107h11v1H96zM113 107h15v1H113zM133 107h7v1H133zM144 107h18v1H144zM167 107h7v1H167zM176 107h7v1H176zM188 107h7v1H188zM201 107h7v1H201zM216 107h3v1H216zM4 108h3v1H4zM15 108h8v1H15zM29 108h7v1H29zM45 108h7v1H45zM70 108h6v1H70zM79 108h7v1H79zM97 108h11v1H97zM113 108h15v1H113zM133 108h7v1H133zM144 108h17v1H144zM167 108h7v1H167zM177 108h6v1H177zM188 108h7v1H188zM201 108h7v1H201zM216 108h3v1H216zM4 109h3v1H4zM15 109h8v1H15zM29 109h7v1H29zM45 109h7v1H45zM70 109h6v1H70zM79 109h7v1H79zM98 109h10v1H98zM113 109h7v1H113zM133 109h7v1H133zM144 109h16v1H144zM167 109h7v1H167zM177 109h6v1H177zM188 109h7v1H188zM201 109h7v1H201zM216 109h3v1H216zM4 110h3v1H4zM15 110h8v1H15zM29 110h7v1H29zM45 110h7v1H45zM70 110h6v1H70zM80 110h7v1H80zM99 110h10v1H99zM113 110h7v1H113zM133 110h7v1H133zM144 110h15v1H144zM167 110h6v1H167zM177 110h6v1H177zM188 110h7v1H188zM201 110h7v1H201zM216 110h3v1H216zM4 111h3v1H4zM15 111h8v1H15zM29 111h7v1H29zM45 111h7v1H45zM70 111h6v1H70zM80 111h7v1H80zM100 111h9v1H100zM113 111h7v1H113zM133 111h7v1H133zM144 111h7v1H144zM153 111h6v1H153zM166 111h7v1H166zM177 111h6v1H177zM188 111h7v1H188zM201 111h7v1H201zM216 111h3v1H216zM4 112h2v1H4zM15 112h8v1H15zM29 112h7v1H29zM45 112h7v1H45zM69 112h7v1H69zM80 112h7v1H80zM102 112h8v1H102zM113 112h7v1H113zM133 112h7v1H133zM144 112h7v1H144zM153 112h7v1H153zM166 112h7v1H166zM177 112h7v1H177zM188 112h7v1H188zM201 112h7v1H201zM216 112h2v1H216zM4 113h2v1H4zM15 113h8v1H15zM29 113h7v1H29zM45 113h7v1H45zM62 113h3v1H62zM69 113h7v1H69zM78 113h9v1H78zM91 113h6v1H91zM102 113h8v1H102zM113 113h7v1H113zM133 113h7v1H133zM144 113h7v1H144zM153 113h7v1H153zM166 113h7v1H166zM177 113h7v1H177zM188 113h7v1H188zM201 113h7v1H201zM216 113h2v1H216zM4 114h2v1H4zM15 114h8v1H15zM29 114h7v1H29zM45 114h7v1H45zM58 114h7v1H58zM69 114h18v1H69zM90 114h8v1H90zM103 114h7v1H103zM113 114h7v1H113zM133 114h7v1H133zM144 114h7v1H144zM154 114h6v1H154zM166 114h10v1H166zM177 114h7v1H177zM188 114h7v1H188zM201 114h7v1H201zM216 114h2v1H216zM5 115h1v1H5zM15 115h8v1H15zM29 115h7v1H29zM45 115h7v1H45zM58 115h7v1H58zM69 115h18v1H69zM90 115h8v1H90zM103 115h7v1H103zM113 115h7v1H113zM133 115h7v1H133zM144 115h7v1H144zM154 115h7v1H154zM166 115h18v1H166zM188 115h7v1H188zM201 115h7v1H201zM217 115h1v1H217zM5 116h1v1H5zM15 116h8v1H15zM29 116h7v1H29zM45 116h7v1H45zM58 116h7v1H58zM68 116h19v1H68zM90 116h8v1H90zM103 116h7v1H103zM113 116h7v1H113zM133 116h7v1H133zM144 116h7v1H144zM154 116h7v1H154zM166 116h18v1H166zM188 116h7v1H188zM201 116h7v1H201zM216 116h2v1H216zM5 117h1v1H5zM15 117h8v1H15zM29 117h7v1H29zM45 117h7v1H45zM58 117h7v1H58zM68 117h19v1H68zM90 117h8v1H90zM103 117h7v1H103zM114 117h6v1H114zM133 117h7v1H133zM144 117h7v1H144zM155 117h6v1H155zM166 117h19v1H166zM188 117h7v1H188zM201 117h7v1H201zM216 117h2v1H216zM5 118h1v1H5zM15 118h8v1H15zM29 118h7v1H29zM45 118h7v1H45zM58 118h7v1H58zM68 118h20v1H68zM90 118h8v1H90zM102 118h8v1H102zM113 118h8v1H113zM133 118h7v1H133zM144 118h7v1H144zM155 118h6v1H155zM166 118h19v1H166zM188 118h7v1H188zM201 118h7v1H201zM216 118h2v1H216zM5 119h1v1H5zM15 119h8v1H15zM29 119h7v1H29zM45 119h7v1H45zM58 119h7v1H58zM68 119h7v1H68zM80 119h8v1H80zM90 119h19v1H90zM113 119h17v1H113zM133 119h7v1H133zM144 119h7v1H144zM155 119h6v1H155zM165 119h20v1H165zM188 119h7v1H188zM201 119h7v1H201zM215 119h2v1H215zM15 120h8v1H15zM29 120h7v1H29zM45 120h7v1H45zM57 120h8v1H57zM67 120h8v1H67zM81 120h7v1H81zM91 120h18v1H91zM114 120h16v1H114zM133 120h7v1H133zM144 120h7v1H144zM155 120h7v1H155zM165 120h7v1H165zM178 120h7v1H178zM188 120h7v1H188zM201 120h7v1H201zM215 120h2v1H215zM15 121h8v1H15zM29 121h7v1H29zM45 121h8v1H45zM56 121h9v1H56zM67 121h7v1H67zM81 121h7v1H81zM91 121h18v1H91zM113 121h17v1H113zM133 121h7v1H133zM144 121h7v1H144zM155 121h7v1H155zM165 121h7v1H165zM178 121h8v1H178zM188 121h8v1H188zM201 121h7v1H201zM215 121h2v1H215zM15 122h8v1H15zM29 122h7v1H29zM45 122h19v1H45zM67 122h7v1H67zM81 122h8v1H81zM92 122h16v1H92zM113 122h17v1H113zM133 122h7v1H133zM144 122h7v1H144zM156 122h7v1H156zM165 122h7v1H165zM178 122h8v1H178zM188 122h8v1H188zM200 122h8v1H200zM215 122h2v1H215zM15 123h8v1H15zM28 123h7v1H28zM46 123h18v1H46zM67 123h7v1H67zM81 123h8v1H81zM93 123h13v1H93zM113 123h17v1H113zM133 123h7v1H133zM144 123h7v1H144zM156 123h7v1H156zM165 123h7v1H165zM179 123h7v1H179zM188 123h9v1H188zM199 123h9v1H199zM214 123h1v1H214zM15 124h20v1H15zM46 124h17v1H46zM67 124h7v1H67zM81 124h8v1H81zM96 124h7v1H96zM148 124h3v1H148zM156 124h7v1H156zM166 124h6v1H166zM179 124h7v1H179zM189 124h19v1H189zM214 124h1v1H214zM15 125h20v1H15zM47 125h15v1H47zM67 125h6v1H67zM161 125h2v1H161zM166 125h6v1H166zM179 125h7v1H179zM189 125h19v1H189zM214 125h1v1H214zM16 126h18v1H16zM49 126h12v1H49zM170 126h1v1H170zM179 126h7v1H179zM190 126h17v1H190zM16 127h17v1H16zM184 127h2v1H184zM191 127h15v1H191zM17 128h16v1H17zM193 128h12v1H193zM18 129h13v1H18zM195 129h9v1H195zM20 130h9v1H20zM23 131h1v1H23zM110 131h5v1H110zM125 131h3v1H125zM82 132h3v1H82zM92 132h8v1H92zM109 132h8v1H109zM125 132h3v1H125zM131 132h3v1H131zM142 132h6v1H142zM62 133h4v1H62zM75 133h3v1H75zM82 133h3v1H82zM92 133h9v1H92zM108 133h4v1H108zM114 133h3v1H114zM125 133h3v1H125zM131 133h3v1H131zM142 133h7v1H142zM155 133h7v1H155zM59 134h8v1H59zM75 134h3v1H75zM82 134h3v1H82zM92 134h3v1H92zM98 134h3v1H98zM108 134h3v1H108zM114 134h3v1H114zM125 134h3v1H125zM131 134h3v1H131zM142 134h3v1H142zM155 134h9v1H155zM59 135h9v1H59zM75 135h3v1H75zM82 135h3v1H82zM92 135h3v1H92zM98 135h3v1H98zM108 135h3v1H108zM114 135h3v1H114zM125 135h3v1H125zM131 135h3v1H131zM142 135h2v1H142zM155 135h4v1H155zM161 135h3v1H161zM211 135h1v1H211zM59 136h3v1H59zM65 136h3v1H65zM75 136h3v1H75zM82 136h3v1H82zM92 136h3v1H92zM98 136h3v1H98zM108 136h3v1H108zM114 136h3v1H114zM125 136h3v1H125zM131 136h3v1H131zM142 136h2v1H142zM155 136h3v1H155zM162 136h2v1H162zM59 137h3v1H59zM65 137h3v1H65zM75 137h3v1H75zM82 137h3v1H82zM92 137h3v1H92zM98 137h3v1H98zM108 137h3v1H108zM125 137h3v1H125zM131 137h3v1H131zM142 137h2v1H142zM155 137h3v1H155zM162 137h2v1H162zM210 137h1v1H210zM59 138h3v1H59zM65 138h3v1H65zM75 138h3v1H75zM82 138h3v1H82zM92 138h3v1H92zM98 138h3v1H98zM108 138h3v1H108zM125 138h3v1H125zM131 138h3v1H131zM142 138h2v1H142zM155 138h3v1H155zM162 138h3v1H162zM210 138h1v1H210zM59 139h3v1H59zM65 139h3v1H65zM75 139h3v1H75zM82 139h3v1H82zM92 139h3v1H92zM98 139h3v1H98zM108 139h3v1H108zM125 139h3v1H125zM131 139h3v1H131zM142 139h3v1H142zM155 139h3v1H155zM162 139h2v1H162zM210 139h1v1H210zM59 140h3v1H59zM65 140h2v1H65zM75 140h3v1H75zM82 140h3v1H82zM92 140h9v1H92zM108 140h3v1H108zM125 140h3v1H125zM131 140h3v1H131zM142 140h6v1H142zM155 140h3v1H155zM162 140h2v1H162zM209 140h1v1H209zM22 141h1v1H22zM61 141h1v1H61zM63 141h4v1H63zM75 141h3v1H75zM82 141h3v1H82zM92 141h8v1H92zM108 141h3v1H108zM113 141h4v1H113zM125 141h3v1H125zM131 141h3v1H131zM142 141h6v1H142zM155 141h1v1H155zM157 141h1v1H157zM161 141h3v1H161zM209 141h2v1H209zM23 142h1v1H23zM48 142h4v1H48zM61 142h5v1H61zM75 142h3v1H75zM82 142h3v1H82zM92 142h7v1H92zM108 142h3v1H108zM114 142h3v1H114zM125 142h3v1H125zM131 142h3v1H131zM142 142h3v1H142zM155 142h1v1H155zM158 142h6v1H158zM171 142h5v1H171zM198 142h1v1H198zM208 142h3v1H208zM23 143h1v1H23zM45 143h6v1H45zM59 143h9v1H59zM75 143h3v1H75zM82 143h3v1H82zM92 143h3v1H92zM97 143h2v1H97zM108 143h3v1H108zM115 143h2v1H115zM125 143h3v1H125zM131 143h3v1H131zM142 143h2v1H142zM155 143h4v1H155zM161 143h1v1H161zM172 143h5v1H172zM198 143h1v1H198zM208 143h2v1H208zM59 144h3v1H59zM66 144h2v1H66zM75 144h3v1H75zM82 144h3v1H82zM92 144h3v1H92zM97 144h3v1H97zM108 144h3v1H108zM115 144h2v1H115zM126 144h2v1H126zM131 144h3v1H131zM142 144h2v1H142zM155 144h3v1H155zM197 144h1v1H197zM208 144h2v1H208zM24 145h1v1H24zM61 145h1v1H61zM66 145h2v1H66zM75 145h3v1H75zM82 145h3v1H82zM94 145h1v1H94zM98 145h2v1H98zM108 145h3v1H108zM115 145h2v1H115zM126 145h1v1H126zM131 145h3v1H131zM142 145h2v1H142zM155 145h1v1H155zM197 145h1v1H197zM207 145h3v1H207zM25 146h1v1H25zM66 146h2v1H66zM76 146h2v1H76zM94 146h1v1H94zM98 146h2v1H98zM109 146h2v1H109zM115 146h2v1H115zM131 146h3v1H131zM142 146h2v1H142zM155 146h1v1H155zM207 146h2v1H207zM25 147h1v1H25zM94 147h1v1H94zM98 147h1v1H98zM109 147h2v1H109zM131 147h3v1H131zM142 147h2v1H142zM206 147h3v1H206zM111 148h4v1H111zM128 148h3v1H128zM206 148h2v1H206zM112 149h1v1H112zM114 149h2v1H114zM127 149h2v1H127zM161 149h1v1H161zM205 149h3v1H205zM144 150h2v1H144zM194 150h1v1H194zM205 150h2v1H205zM204 151h3v1H204zM204 152h2v1H204zM192 153h1v1H192zM203 153h3v1H203zM202 154h3v1H202zM202 155h3v1H202zM201 156h3v1H201zM201 157h2v1H201zM200 158h3v1H200zM199 159h3v1H199zM23 160h1v1H23zM82 160h3v1H82zM89 160h2v1H89zM96 160h1v1H96zM101 160h3v1H101zM108 160h2v1H108zM118 160h1v1H118zM124 160h2v1H124zM130 160h2v1H130zM137 160h1v1H137zM199 160h3v1H199zM23 161h2v1H23zM82 161h4v1H82zM89 161h1v1H89zM95 161h1v1H95zM97 161h1v1H97zM101 161h4v1H101zM107 161h2v1H107zM117 161h1v1H117zM119 161h1v1H119zM123 161h1v1H123zM125 161h1v1H125zM129 161h4v1H129zM136 161h1v1H136zM138 161h1v1H138zM198 161h3v1H198zM24 162h1v1H24zM82 162h2v1H82zM85 162h2v1H85zM89 162h1v1H89zM95 162h1v1H95zM100 162h2v1H100zM103 162h2v1H103zM107 162h2v1H107zM119 162h1v1H119zM122 162h2v1H122zM125 162h2v1H125zM132 162h1v1H132zM138 162h1v1H138zM197 162h3v1H197zM24 163h2v1H24zM82 163h2v1H82zM85 163h2v1H85zM89 163h2v1H89zM95 163h2v1H95zM100 163h2v1H100zM103 163h2v1H103zM107 163h3v1H107zM118 163h2v1H118zM122 163h2v1H122zM125 163h2v1H125zM131 163h2v1H131zM137 163h2v1H137zM146 163h3v1H146zM197 163h2v1H197zM25 164h2v1H25zM82 164h2v1H82zM85 164h2v1H85zM89 164h1v1H89zM97 164h1v1H97zM100 164h2v1H100zM103 164h2v1H103zM107 164h2v1H107zM117 164h2v1H117zM122 164h2v1H122zM125 164h2v1H125zM130 164h2v1H130zM136 164h2v1H136zM196 164h3v1H196zM26 165h2v1H26zM82 165h2v1H82zM85 165h1v1H85zM89 165h1v1H89zM97 165h1v1H97zM100 165h2v1H100zM103 165h2v1H103zM107 165h2v1H107zM117 165h1v1H117zM122 165h2v1H122zM125 165h2v1H125zM129 165h2v1H129zM136 165h1v1H136zM195 165h3v1H195zM27 166h2v1H27zM82 166h4v1H82zM89 166h2v1H89zM95 166h3v1H95zM101 166h3v1H101zM108 166h2v1H108zM117 166h3v1H117zM123 166h3v1H123zM129 166h3v1H129zM136 166h3v1H136zM194 166h3v1H194zM27 167h2v1H27zM193 167h3v1H193zM28 168h2v1H28zM193 168h2v1H193zM29 169h2v1H29zM192 169h3v1H192zM31 170h1v1H31zM191 170h3v1H191zM190 171h3v1H190zM189 172h3v1H189zM188 173h4v1H188zM60 174h1v1H60zM62 174h1v1H62zM161 174h2v1H161zM187 174h4v1H187zM58 175h2v1H58zM62 175h2v1H62zM161 175h2v1H161zM186 175h4v1H186zM58 176h1v1H58zM110 176h1v1H110zM162 176h2v1H162zM185 176h4v1H185zM57 177h2v1H57zM155 177h3v1H155zM163 177h2v1H163zM184 177h4v1H184zM57 178h1v1H57zM68 178h2v1H68zM154 178h2v1H154zM157 178h1v1H157zM164 178h2v1H164zM183 178h4v1H183zM58 179h2v1H58zM67 179h3v1H67zM154 179h2v1H154zM182 179h4v1H182zM66 180h1v1H66zM68 180h2v1H68zM155 180h3v1H155zM181 180h4v1H181zM65 181h2v1H65zM68 181h1v1H68zM155 181h3v1H155zM180 181h3v1H180zM64 182h5v1H64zM75 182h2v1H75zM156 182h2v1H156zM179 182h3v1H179zM67 183h2v1H67zM74 183h3v1H74zM78 183h3v1H78zM141 183h3v1H141zM157 183h1v1H157zM178 183h3v1H178zM67 184h1v1H67zM74 184h2v1H74zM77 184h3v1H77zM140 184h2v1H140zM143 184h2v1H143zM150 184h1v1H150zM176 184h3v1H176zM73 185h7v1H73zM85 185h3v1H85zM134 185h1v1H134zM141 185h1v1H141zM144 185h1v1H144zM175 185h3v1H175zM73 186h1v1H73zM75 186h2v1H75zM78 186h1v1H78zM84 186h2v1H84zM87 186h2v1H87zM133 186h3v1H133zM141 186h4v1H141zM174 186h3v1H174zM75 187h1v1H75zM78 187h1v1H78zM84 187h2v1H84zM87 187h2v1H87zM93 187h3v1H93zM132 187h1v1H132zM135 187h1v1H135zM142 187h1v1H142zM144 187h2v1H144zM172 187h4v1H172zM77 188h1v1H77zM84 188h4v1H84zM93 188h1v1H93zM96 188h1v1H96zM119 188h2v1H119zM126 188h2v1H126zM132 188h1v1H132zM136 188h1v1H136zM142 188h1v1H142zM145 188h1v1H145zM171 188h3v1H171zM84 189h1v1H84zM86 189h1v1H86zM92 189h2v1H92zM96 189h1v1H96zM108 189h2v1H108zM111 189h3v1H111zM119 189h2v1H119zM127 189h1v1H127zM133 189h1v1H133zM136 189h1v1H136zM142 189h2v1H142zM170 189h3v1H170zM83 190h1v1H83zM92 190h2v1H92zM95 190h2v1H95zM108 190h2v1H108zM111 190h3v1H111zM119 190h2v1H119zM127 190h1v1H127zM133 190h1v1H133zM136 190h1v1H136zM168 190h3v1H168zM92 191h1v1H92zM95 191h2v1H95zM108 191h2v1H108zM111 191h3v1H111zM118 191h4v1H118zM127 191h1v1H127zM133 191h2v1H133zM136 191h1v1H136zM166 191h4v1H166zM92 192h1v1H92zM95 192h2v1H95zM108 192h6v1H108zM118 192h2v1H118zM121 192h1v1H121zM127 192h1v1H127zM134 192h2v1H134zM165 192h3v1H165zM93 193h3v1H93zM108 193h3v1H108zM112 193h2v1H112zM118 193h4v1H118zM127 193h1v1H127zM162 193h2v1H162zM165 193h1v1H165zM108 194h1v1H108zM110 194h1v1H110zM112 194h2v1H112zM118 194h1v1H118zM121 194h1v1H121zM161 194h3v1H161zM159 195h4v1H159zM157 196h2v1H157zM0 198h6v1H0zM12 198h1v1H12zM152 198h2v1H152zM0 199h19v1H0zM151 199h2v1H151zM203 199h5v1H203zM0 200h28v1H0zM148 200h2v1H148zM193 200h2v1H193zM197 200h8v1H197zM206 200h9v1H206zM0 201h39v1H0zM143 201h4v1H143zM184 201h31v1H184zM216 201h1v1H216zM0 202h42v1H0zM141 202h4v1H141zM177 202h1v1H177zM181 202h4v1H181zM186 202h31v1H186zM0 203h42v1H0zM137 203h7v1H137zM176 203h4v1H176zM182 203h1v1H182zM187 203h5v1H187zM194 203h23v1H194zM0 204h41v1H0zM42 204h4v1H42zM131 204h9v1H131zM175 204h6v1H175zM185 204h33v1H185zM0 205h51v1H0zM93 205h1v1H93zM126 205h11v1H126zM175 205h1v1H175zM185 205h31v1H185zM0 206h53v1H0zM97 206h33v1H97zM180 206h2v1H180zM189 206h2v1H189zM193 206h24v1H193zM0 207h54v1H0zM100 207h25v1H100zM168 207h1v1H168zM181 207h2v1H181zM189 207h2v1H189zM193 207h25v1H193zM0 208h3v1H0zM4 208h53v1H4zM107 208h9v1H107zM177 208h1v1H177zM180 208h4v1H180zM186 208h2v1H186zM190 208h29v1H190zM0 209h59v1H0zM177 209h1v1H177zM180 209h2v1H180zM183 209h1v1H183zM186 209h2v1H186zM190 209h19v1H190zM210 209h9v1H210zM0 210h46v1H0zM47 210h15v1H47zM161 210h1v1H161zM181 210h5v1H181zM187 210h32v1H187zM0 211h65v1H0zM160 211h6v1H160zM171 211h9v1H171zM182 211h21v1H182zM204 211h15v1H204zM7 212h9v1H7zM17 212h51v1H17zM157 212h1v1H157zM159 212h1v1H159zM161 212h1v1H161zM164 212h2v1H164zM171 212h5v1H171zM178 212h26v1H178zM205 212h14v1H205zM3 213h1v1H3zM7 213h37v1H7zM47 213h23v1H47zM156 213h1v1H156zM160 213h1v1H160zM164 213h2v1H164zM172 213h31v1H172zM204 213h15v1H204zM3 214h1v1H3zM8 214h12v1H8zM21 214h23v1H21zM46 214h7v1H46zM54 214h18v1H54zM155 214h3v1H155zM164 214h1v1H164zM167 214h2v1H167zM172 214h26v1H172zM199 214h7v1H199zM207 214h12v1H207zM8 215h39v1H8zM48 215h1v1H48zM50 215h3v1H50zM54 215h19v1H54zM154 215h4v1H154zM164 215h1v1H164zM167 215h2v1H167zM174 215h16v1H174zM191 215h15v1H191zM207 215h1v1H207zM210 215h9v1H210z\"/></svg>";
let receiptLogoRasterCache=null;
function joinReceiptBytes(...parts){const size=parts.reduce((sum,p)=>sum+p.length,0),all=new Uint8Array(size);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.length}return all}
async function receiptLogoRasterBytes(){
 const targetWidth=(typeof printerPaperWidth==='function'&&printerPaperWidth()===80)?150:125;
 const img=new Image();img.src=RECEIPT_LOGO_DATA_URL;
 await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail});
 const ratio=img.naturalHeight/img.naturalWidth,h=Math.max(1,Math.round(targetWidth*ratio));
 const c=document.createElement('canvas');c.width=targetWidth;c.height=h;
 const x=c.getContext('2d',{willReadFrequently:true});
 x.fillStyle='#fff';x.fillRect(0,0,targetWidth,h);x.drawImage(img,0,0,targetWidth,h);
 const px=x.getImageData(0,0,targetWidth,h).data,rowBytes=Math.ceil(targetWidth/8),data=new Uint8Array(rowBytes*h);
 for(let y=0;y<h;y++)for(let xx=0;xx<targetWidth;xx++){
   const i=(y*targetWidth+xx)*4,lum=.299*px[i]+.587*px[i+1]+.114*px[i+2];
   if(px[i+3]>80&&lum<82)data[y*rowBytes+(xx>>3)]|=(0x80>>(xx&7));
 }
 const head=new Uint8Array([0x1b,0x61,0x01,0x1d,0x76,0x30,0x00,rowBytes&255,(rowBytes>>8)&255,h&255,(h>>8)&255]);
 return joinReceiptBytes(head,data,new Uint8Array([0x0a,0x1b,0x61,0x00]))
}
function wrapReceipt(value,width=32){
 const text=stripAccents(String(value??'')).replace(/\s+/g,' ').trim();
 const limit=Math.max(8,Number(width)||32);
 if(!text)return [''];
 const out=[];
 let rest=text;
 while(rest.length>limit){
   let cut=rest.lastIndexOf(' ',limit);
   if(cut<1)cut=limit;
   out.push(rest.slice(0,cut).trimEnd());
   rest=rest.slice(cut).trimStart();
 }
 if(rest||!out.length)out.push(rest);
 return out;
}
function receiptPlain(o){
 const L=[],hr='--------------------------------';
 L.push('       O CASEIRAO BURGER',`         PEDIDO #${o.order_number}`,new Date(o.created_at).toLocaleString('pt-BR'),hr);
 L.push(`CLIENTE: ${o.customer_name||''}`,`FONE: ${o.customer_phone||''}`,`TIPO: ${orderTypeLabel(o.type)}`);
 if(o.type==='delivery'){L.push('ENDERECO:');L.push(...wrapReceipt(orderAddress(o)))}
 L.push(`PAGAMENTO: ${paymentLabel(o.payment)}`);if(o.change_for)L.push(`TROCO PARA: ${o.change_for}`);
 L.push(hr);
 (o.order_items||[]).forEach((it,i)=>{
   L.push(...wrapReceipt(`${it.quantity||1}x ${it.product_name||'Item'}  ${fmt(it.line_total||0)}`));
   (it.order_item_addons||[]).forEach(a=>L.push(...wrapReceipt(`  + ${a.addon_name}${Number(a.price||0)>0?' '+fmt(a.price):''}`)));
   if(it.note)L.push(...wrapReceipt(`  OBS: ${it.note}`));
   if(i<(o.order_items||[]).length-1)L.push('');
 });
 if(o.notes){L.push(hr,'OBSERVACOES:');L.push(...wrapReceipt(o.notes))}
 L.push(hr,`SUBTOTAL: ${fmt(o.subtotal)}`);
 if(Number(o.delivery_fee||0))L.push(`ENTREGA: ${fmt(o.delivery_fee)}`);
 if(Number(o.delivery_discount||0))L.push(`DESC. ENTREGA: -${fmt(o.delivery_discount)}`);
 if(Number(o.discount||0))L.push(`DESCONTO: -${fmt(o.discount)}`);
 L.push(`TOTAL: ${fmt(o.total)}`,hr,'PECA NOVAMENTE PELO NOSSO SISTEMA:','caseiraopedidos.api.br');
 return stripAccents(L.join('\n'))
}
function receiptBrowserHtml(o){const items=(o.order_items||[]).map(it=>`<div class="item"><b>${Number(it.quantity||1)}x ${esc(it.product_name||'Item')}</b><b>${fmt(it.line_total||0)}</b></div>${(it.order_item_addons||[]).map(a=>`<div class="sub">+ ${esc(a.addon_name)} ${Number(a.price||0)>0?fmt(a.price):''}</div>`).join('')}${it.note?`<div class="obs">Obs.: ${esc(it.note)}</div>`:''}`).join('');return `<!doctype html><html><head><meta charset="utf-8"><title>Pedido #${o.order_number}</title><style>@page{size:58mm auto;margin:2mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;width:54mm;margin:0 auto;color:#000;font-size:10.5px;line-height:1.3}.center{text-align:center}.title{font-size:16px;font-weight:900}.receiptLogo{display:block;width:34mm;max-height:34mm;object-fit:contain;margin:0 auto 2mm}.hr{border-top:1px dashed #000;margin:5px 0}.line{display:flex;justify-content:space-between;gap:6px}.item{display:flex;justify-content:space-between;gap:5px;margin:4px 0}.sub,.obs{padding-left:7px;font-size:9px}.big{font-size:14px;font-weight:900}.block{margin:4px 0;word-break:break-word}</style></head><body><div class="center">${RECEIPT_LOGO_SVG}<div class="title">O CASEIRÃO BURGER</div><b>PEDIDO #${o.order_number}</b><div>${new Date(o.created_at).toLocaleString('pt-BR')}</div></div><div class="hr"></div><div class="block"><b>Cliente:</b> ${esc(o.customer_name||'')}<br><b>Telefone:</b> ${esc(o.customer_phone||'')}<br><b>Tipo:</b> ${esc(orderTypeLabel(o.type))}</div>${o.type==='delivery'?`<div class="block"><b>Endereço:</b><br>${esc(orderAddress(o))}</div>`:''}<div class="block"><b>Pagamento:</b> ${esc(paymentLabel(o.payment))}${o.change_for?`<br><b>Troco para:</b> ${esc(o.change_for)}`:''}</div><div class="hr"></div>${items||'<div>Sem itens.</div>'}${o.notes?`<div class="hr"></div><div class="block"><b>Observações:</b><br>${esc(o.notes)}</div>`:''}<div class="hr"></div><div class="line"><span>Subtotal</span><b>${fmt(o.subtotal)}</b></div>${Number(o.delivery_fee||0)?`<div class="line"><span>Entrega</span><b>${fmt(o.delivery_fee)}</b></div>`:''}${Number(o.discount||0)?`<div class="line"><span>Desconto</span><b>-${fmt(o.discount)}</b></div>`:''}<div class="line big"><span>TOTAL</span><b>${fmt(o.total)}</b></div><div class="hr"></div><div class="center">Código: ${esc(o.tracking_code||'')}<br><br>O Caseirão Burger</div><script>setTimeout(()=>window.print(),250)<\/script><style id="packaging-role-style">.readyToast{background:#208a4d!important}.packQueue{display:grid;gap:13px;margin-top:14px}.packOrder{border:2px solid #343b46;background:linear-gradient(145deg,#171c22,#101317);border-radius:18px;padding:15px}.packOrderTop{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:11px;border-bottom:1px solid var(--line)}.packOrderTop strong{font-size:21px;color:#fff}.packOrderTop span{padding:6px 9px;border-radius:999px;background:#282e36;color:#dce2e9;font-size:11px;font-weight:950}.packItems{padding:8px 0}.packItem{padding:9px 2px;border-bottom:1px solid #252b33}.packItem b{display:block;font-size:16px}.packItem small{display:block;margin-top:4px;color:#bdc5cf;font-size:13px}.packItem .packNote,.packGeneralNote{color:#ffd77a}.packGeneralNote{margin:5px 0 12px;padding:10px;border-radius:11px;background:#33290f;font-size:13px;font-weight:850}.packReadyBtn{width:100%;min-height:62px;border:0;border-radius:14px;background:#218b4e;color:#fff;font-size:17px;font-weight:950;box-shadow:0 8px 22px rgba(33,139,78,.24)}.packReadyBtn:disabled{opacity:.65}.packEmpty{display:flex;flex-direction:column;gap:7px;padding:38px 18px;border:1px dashed #3b444f;border-radius:17px;text-align:center;color:#aeb7c2}.packEmpty b{font-size:19px;color:#89e6aa}</style>
</body></html>`}
const receiptBrowserHtmlOriginal=receiptBrowserHtml;receiptBrowserHtml=function(order){return receiptBrowserHtmlOriginal(order).replace(RECEIPT_LOGO_SVG,'').replace('.receiptLogo{display:block;width:34mm;max-height:34mm;object-fit:contain;margin:0 auto 2mm}','').replace('setTimeout(()=>window.print(),250)','setTimeout(()=>window.print(),100)')};
function printOrderBrowser(id,sourceOrders=null){const o=(sourceOrders||admin?.orders||[]).find(x=>String(x.id)===String(id));if(!o)return alert('Pedido não encontrado.');const w=window.open('','_blank','width=420,height=720');if(!w)return alert('O navegador bloqueou a janela de impressão. Libere pop-ups e tente novamente.');w.document.open();w.document.write(receiptBrowserHtml(o));w.document.close()}
const BT_PROFILES=[
 {service:'0000ff00-0000-1000-8000-00805f9b34fb',chars:['0000ff02-0000-1000-8000-00805f9b34fb','0000ff03-0000-1000-8000-00805f9b34fb']},
 {service:'49535343-fe7d-4ae5-8fa9-9fafd205e455',chars:['49535343-8841-43f4-a8d4-ecbe34729bb3','49535343-6daa-4d02-abf6-19569aca69fe']},
 {service:'0000ae30-0000-1000-8000-00805f9b34fb',chars:['0000ae01-0000-1000-8000-00805f9b34fb']},
 {service:'0000ffe0-0000-1000-8000-00805f9b34fb',chars:['0000ffe1-0000-1000-8000-00805f9b34fb']},
 {service:'0000fff0-0000-1000-8000-00805f9b34fb',chars:['0000fff1-0000-1000-8000-00805f9b34fb','0000fff2-0000-1000-8000-00805f9b34fb']}
];
function setPrinterState(msg,kind=''){const el=$('#printerState');if(el){el.textContent=msg;el.className='printerState '+kind}}
async function connectBluetoothPrinter(){if(!navigator.bluetooth)throw new Error('Este navegador não oferece Web Bluetooth. Abra o sistema no Google Chrome do Android.');setPrinterState('Abrindo lista de dispositivos Bluetooth...');const optionalServices=BT_PROFILES.map(p=>p.service);const device=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices});if(!device.gatt)throw new Error('O dispositivo escolhido não oferece conexão BLE/GATT.');const server=await device.gatt.connect();let found=null;for(const p of BT_PROFILES){try{const service=await server.getPrimaryService(p.service);for(const cid of p.chars){try{const c=await service.getCharacteristic(cid);if(c.properties.write||c.properties.writeWithoutResponse){found=c;break}}catch{}}if(!found){const chars=await service.getCharacteristics();found=chars.find(c=>c.properties.write||c.properties.writeWithoutResponse)||null}if(found)break}catch{}}if(!found){try{const services=await server.getPrimaryServices();for(const service of services){try{const chars=await service.getCharacteristics();found=chars.find(c=>c.properties.write||c.properties.writeWithoutResponse)||null;if(found)break}catch{}}}catch{}}if(!found){server.disconnect();throw new Error('Conectou ao Bluetooth, mas não encontrei um canal BLE de impressão compatível. Essa impressora pode usar Bluetooth Clássico/SPP.');}btDevice=device;btWriteChar=found;btPrinterName=device.name||'Impressora Bluetooth';device.addEventListener('gattserverdisconnected',()=>{btWriteChar=null;setPrinterState('Impressora desconectada. Toque em Conectar novamente.','error')});setPrinterState(`Conectada: ${btPrinterName}`,'connected');return btPrinterName}
async function btWrite(bytes){if(!btWriteChar||!btDevice?.gatt?.connected)await connectBluetoothPrinter();const chunk=20;for(let i=0;i<bytes.length;i+=chunk){const part=bytes.slice(i,i+chunk);if(btWriteChar.properties.writeWithoutResponse&&btWriteChar.writeValueWithoutResponse)await btWriteChar.writeValueWithoutResponse(part);else if(btWriteChar.properties.write&&btWriteChar.writeValueWithResponse)await btWriteChar.writeValueWithResponse(part);else await btWriteChar.writeValue(part);await new Promise(r=>setTimeout(r,10))}}
function escposQrBytes(value){
 const data=new TextEncoder().encode(value),storeLen=data.length+3,pL=storeLen&255,pH=(storeLen>>8)&255;
 return joinReceiptBytes(
   new Uint8Array([0x1d,0x28,0x6b,0x04,0x00,0x31,0x41,0x32,0x00]),
   new Uint8Array([0x1d,0x28,0x6b,0x03,0x00,0x31,0x43,0x04]),
   new Uint8Array([0x1d,0x28,0x6b,0x03,0x00,0x31,0x45,0x31]),
   new Uint8Array([0x1d,0x28,0x6b,pL,pH,0x31,0x50,0x30]),data,
   new Uint8Array([0x1b,0x61,0x01,0x0a,0x1d,0x28,0x6b,0x03,0x00,0x31,0x51,0x30,0x0a,0x1b,0x61,0x00])
 )
}
async function escposBytes(o){
 const body=new TextEncoder().encode(receiptPlain(o)),head=new Uint8Array([0x1b,0x40]);
 let logo=new Uint8Array();try{logo=await receiptLogoRasterBytes()}catch(e){}
 const qr=escposQrBytes('https://caseiraopedidos.api.br'),tail=new Uint8Array([0x0a,0x0a,0x0a]);
 return joinReceiptBytes(head,logo,body,new Uint8Array([0x0a]),qr,tail)
}
async function printOrderBluetooth(id,sourceOrders=null){const o=(sourceOrders||admin?.orders||[]).find(x=>String(x.id)===String(id));if(!o)return alert('Pedido não encontrado.');try{setPrinterState('Enviando os dados do pedido para a impressora...');await btWrite(await escposBytes(o));setPrinterState(`Pedido #${o.order_number} enviado para ${btPrinterName||'impressora'}.`,'connected')}catch(e){setPrinterState(e.message||String(e),'error');alert((e.message||String(e))+'\n\nVocê ainda pode usar o botão “Imprimir pedido”, que abre a impressão normal do Chrome.') }}
function bindPrintButtons(sourceOrders=null){document.querySelectorAll('[data-webprint]').forEach(b=>b.onclick=()=>printOrderBrowser(b.dataset.webprint,sourceOrders));document.querySelectorAll('[data-btprint]').forEach(b=>b.onclick=()=>printOrderBluetooth(b.dataset.btprint,sourceOrders))}
function renderOrders(box){const visible=admin.orders.filter(o=>!o.archived_at);const active=visible.filter(o=>!['entregue','cancelado'].includes(o.status));const finished=visible.filter(o=>['entregue','cancelado'].includes(o.status)&&localDay(o.created_at)===todayKey()).slice(0,20);box.innerHTML=`<div class="notice" style="margin:10px 0">🔔 Alerta de pedido novo ativo. Agora cada pedido mostra todos os dados do cliente, entrega, pagamento, itens, adicionais, observações e totais.</div><div class="printerBar"><div class="printerBarTop"><div class="grow"><b>🖨️ Impressora térmica</b><div id="printerState" class="printerState">${navigator.bluetooth?'Bluetooth direto disponível no Chrome para impressoras BLE compatíveis.':'Use “Imprimir pedido”. Web Bluetooth não está disponível neste navegador.'}</div></div><button id="connectPrinter" class="printerConnect">Conectar Bluetooth</button></div></div><div class="twoBtns" style="margin:10px 0"><button id="refreshOrders" class="secondary">Atualizar</button><button id="testSound" class="secondary">Testar toque</button></div><button id="manualOrder" class="secondary" style="margin-bottom:10px">Pedido manual</button><div class="sectionTitle">Pedidos em andamento</div>${active.length?active.map(o=>orderAdminCard(o,false)).join(''):'<div class="empty">Nenhum pedido em andamento.</div>'}${finished.length?`<div class="sectionTitle">Finalizados hoje</div>${finished.map(o=>orderAdminCard(o,true)).join('')}`:''}`;$('#refreshOrders').onclick=refreshAdmin;$('#testSound').onclick=()=>{unlockOrderSound();playOrderSound()};$('#manualOrder').onclick=openManualOrder;$('#connectPrinter').onclick=async()=>{try{await connectBluetoothPrinter()}catch(e){setPrinterState(e.message||String(e),'error');alert(e.message||String(e))}};if(btWriteChar&&btDevice?.gatt?.connected)setPrinterState(`Conectada: ${btPrinterName}`,'connected');bindPrintButtons();document.querySelectorAll('[data-st]').forEach(b=>b.onclick=async()=>{const next=b.dataset.st;if(next==='cancelado'&&!confirm('Cancelar este pedido?'))return;if(next==='entregue'&&!confirm(completionConfirmText(b.dataset.oid)))return;try{b.disabled=true;await adminCall('update_status',{order_id:b.dataset.oid,status:next});admin=await adminCall('snapshot');try{refreshPendingPrintStatus()}catch{}renderAdmin()}catch(e){b.disabled=false;alert(e.message)}})}
function renderReportsAdmin(box){const defaultDay=todayKey();box.innerHTML=`<div class="field"><label>Dia do relatório</label><input id="reportDate" class="in" type="date" value="${defaultDay}"></div><div id="reportBody"></div>`;const draw=async()=>{const day=$('#reportDate').value||defaultDay;const body=$('#reportBody');body.innerHTML='<div class="notice" style="margin-top:10px">Carregando histórico completo do dia...</div>';try{const r=await archiveCall('report_day',{day});const all=r.orders||[];const valid=all.filter(o=>o.status!=='cancelado');const sales=valid.reduce((s,o)=>s+Number(o.total||0),0);const delivered=all.filter(o=>o.status==='entregue').length;const cancelled=all.filter(o=>o.status==='cancelado').length;const archived=all.filter(o=>o.archived_at).length;const avg=valid.length?sales/valid.length:0;const byPay={};const byType={};valid.forEach(o=>{byPay[o.payment||'Não informado']=(byPay[o.payment||'Não informado']||0)+Number(o.total||0);const t=orderTypeLabel(o.type);byType[t]=(byType[t]||0)+1});body.innerHTML=`<div class="reportGrid"><div class="reportCard"><b>${fmt(sales)}</b><span>Vendas do dia</span></div><div class="reportCard"><b>${valid.length}</b><span>Pedidos válidos</span></div><div class="reportCard"><b>${fmt(avg)}</b><span>Ticket médio</span></div><div class="reportCard"><b>${archived}</b><span>Arquivados</span></div></div><div class="reportBreak"><b>Resumo</b><div class="reportRow"><span>Pedidos finalizados</span><b>${delivered}</b></div><div class="reportRow"><span>Cancelados</span><b>${cancelled}</b></div>${Object.entries(byType).map(([k,v])=>`<div class="reportRow"><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div><div class="reportBreak"><b>Por pagamento</b>${Object.keys(byPay).length?Object.entries(byPay).map(([k,v])=>`<div class="reportRow"><span>${esc(k)}</span><b>${fmt(v)}</b></div>`).join(''):'<div class="mini" style="margin-top:8px">Sem vendas neste dia.</div>'}</div><div class="sectionTitle">Histórico detalhado de pedidos</div>${all.length?all.map(o=>orderAdminCard(o,true)).join(''):'<div class="empty">Nenhum pedido neste dia.</div>'}`;bindPrintButtons(all)}catch(e){body.innerHTML=`<div class="err">${esc(e.message||'Falha ao carregar o histórico.')}</div>`}};$('#reportDate').onchange=draw;draw()}
function renderProductsAdmin(box){box.innerHTML=`<button id="newProduct" class="primary" style="margin:10px 0">+ Novo produto</button>${admin.products.map(p=>`<div class="tableitem"><div class="grow"><b>${esc(p.name)}</b><div class="mini">${esc(p.category)} • ${fmt(p.price)} ${p.promo_price?`• Promo ${fmt(p.promo_price)}`:''} • ${p.active?'Ativo':'Inativo'} ${p.featured?'• ⭐ Destaque':''}</div></div><button class="editbtn" data-editp="${p.id}">Editar</button></div>`).join('')}`;$('#newProduct').onclick=()=>editProduct(null);document.querySelectorAll('[data-editp]').forEach(b=>b.onclick=()=>editProduct(admin.products.find(p=>p.id===b.dataset.editp)))}
function editProduct(p){p=p||{name:'',category:'Lanches',description:'',price:'',promo_price:'',image_url:'',active:true,featured:false};const selected=new Set(admin.product_addons.filter(x=>x.product_id===p.id).map(x=>x.addon_id));modal(`<div class="sheeth"><h2>${p.id?'Editar produto':'Novo produto'}</h2><button class="x" data-close>×</button></div><div class="row"><div class="field"><label>Nome</label><input id="pName" class="in" value="${esc(p.name)}"></div><div class="field"><label>Categoria</label><input id="pCat" class="in" value="${esc(p.category||'Lanches')}"></div></div><div class="field"><label>Descrição</label><textarea id="pDesc" class="ta">${esc(p.description||'')}</textarea></div><div class="row"><div class="field"><label>Preço</label><input id="pPrice" class="in" inputmode="decimal" value="${esc(p.price)}"></div><div class="field"><label>Preço promocional</label><input id="pPromo" class="in" inputmode="decimal" value="${esc(p.promo_price||'')}"></div></div><div class="field"><label>Foto</label><input id="pFile" class="in" type="file" accept="image/jpeg,image/png,image/webp"><input id="pImg" class="in" style="margin-top:8px" placeholder="URL da foto" value="${esc(p.image_url||'')}"></div><div class="field"><label>Adicionais permitidos</label>${admin.addons.map(a=>`<label class="addon"><input type="checkbox" data-pa="${a.id}" ${selected.has(a.id)?'checked':''}><span class="grow">${esc(a.name)}</span><span>${fmt(a.price)}</span></label>`).join('')}</div><label class="addon"><input id="pActive" type="checkbox" ${p.active?'checked':''}><span>Produto ativo</span></label><label class="addon"><input id="pFeatured" type="checkbox" ${p.featured?'checked':''}><span><b>⭐ Mostrar em Ofertas e Destaques</b><br><small style="color:var(--muted)">Quando marcado, este produto poderá aparecer no carrossel do cardápio.</small></span></label><div class="twoBtns"><button id="saveP" class="primary">Salvar</button>${p.id?'<button id="delP" class="secondary danger">Excluir</button>':'<button class="secondary" data-close>Cancelar</button>'}</div>`);bindClose();$('#pFile').onchange=async()=>{const f=$('#pFile').files[0];if(!f)return;try{$('#pImg').value='Enviando...';const base64=await fileToBase64(f);const pin=sessionStorage.getItem('caseirao_admin_pin')||'';const j=await api('admin-upload-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,content_type:f.type,base64})});$('#pImg').value=j.public_url}catch(e){alert(e.message);$('#pImg').value=p.image_url||''}};$('#saveP').onclick=async()=>{try{await adminCall('upsert_product',{id:p.id,name:$('#pName').value.trim(),category:$('#pCat').value.trim(),description:$('#pDesc').value.trim(),price:num($('#pPrice').value),promo_price:$('#pPromo').value.trim()===''?null:num($('#pPromo').value),image_url:$('#pImg').value.trim(),active:$('#pActive').checked,featured:$('#pFeatured').checked,addon_ids:[...document.querySelectorAll('[data-pa]:checked')].map(i=>i.dataset.pa)});admin=await adminCall('snapshot');adminTab='produtos';renderAdmin()}catch(e){alert(e.message)}};if($('#delP'))$('#delP').onclick=async()=>{if(confirm('Excluir este produto?')){try{await adminCall('delete_product',{id:p.id});admin=await adminCall('snapshot');adminTab='produtos';renderAdmin()}catch(e){alert(e.message)}}}}
const num=v=>Number(String(v).replace(',','.'))||0;function fileToBase64(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}
function renderNeighborhoodsAdmin(box){box.innerHTML=`<button id="newN" class="primary" style="margin:10px 0">+ Novo bairro</button>${admin.neighborhoods.map(n=>`<div class="tableitem"><div class="grow"><b>${esc(n.name)}</b><div class="mini">Taxa ${fmt(n.fee)} • ${n.active?'Ativo':'Inativo'}</div></div><button class="editbtn" data-n="${n.id}">Editar</button></div>`).join('')}`;$('#newN').onclick=()=>editNeighborhood(null);document.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>editNeighborhood(admin.neighborhoods.find(n=>n.id===b.dataset.n)))}
function editNeighborhood(n){n=n||{name:'',fee:'',active:true};modal(`<div class="sheeth"><h2>${n.id?'Editar bairro':'Novo bairro'}</h2><button class="x" data-close>×</button></div><div class="field"><label>Nome</label><input id="nName" class="in" value="${esc(n.name)}"></div><div class="field"><label>Taxa de entrega</label><input id="nFee" class="in" inputmode="decimal" value="${esc(n.fee)}"></div><label class="addon"><input id="nActive" type="checkbox" ${n.active?'checked':''}><span>Ativo</span></label><div class="twoBtns"><button id="saveN" class="primary">Salvar</button>${n.id?'<button id="delN" class="secondary danger">Excluir</button>':'<button class="secondary" data-close>Cancelar</button>'}</div>`);bindClose();$('#saveN').onclick=async()=>{try{await adminCall('upsert_neighborhood',{id:n.id,name:$('#nName').value.trim(),fee:num($('#nFee').value),active:$('#nActive').checked});admin=await adminCall('snapshot');adminTab='bairros';renderAdmin()}catch(e){alert(e.message)}};if($('#delN'))$('#delN').onclick=async()=>{if(confirm('Excluir bairro?')){await adminCall('delete_neighborhood',{id:n.id});admin=await adminCall('snapshot');adminTab='bairros';renderAdmin()}}}
function renderAddonsAdmin(box){box.innerHTML=`<button id="newA" class="primary" style="margin:10px 0">+ Novo adicional</button>${admin.addons.map(a=>`<div class="tableitem"><div class="grow"><b>${esc(a.name)}</b><div class="mini">${fmt(a.price)} • ${a.active?'Ativo':'Inativo'}</div></div><button class="editbtn" data-a="${a.id}">Editar</button></div>`).join('')}`;$('#newA').onclick=()=>editAddon(null);document.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>editAddon(admin.addons.find(a=>a.id===b.dataset.a)))}
function editAddon(a){a=a||{name:'',price:'',active:true};modal(`<div class="sheeth"><h2>${a.id?'Editar adicional':'Novo adicional'}</h2><button class="x" data-close>×</button></div><div class="field"><label>Nome</label><input id="aName" class="in" value="${esc(a.name)}"></div><div class="field"><label>Preço</label><input id="aPrice" class="in" inputmode="decimal" value="${esc(a.price)}"></div><label class="addon"><input id="aActive" type="checkbox" ${a.active?'checked':''}><span>Ativo</span></label><div class="twoBtns"><button id="saveA" class="primary">Salvar</button>${a.id?'<button id="delA" class="secondary danger">Excluir</button>':'<button class="secondary" data-close>Cancelar</button>'}</div>`);bindClose();$('#saveA').onclick=async()=>{await adminCall('upsert_addon',{id:a.id,name:$('#aName').value.trim(),price:num($('#aPrice').value),active:$('#aActive').checked});admin=await adminCall('snapshot');adminTab='adicionais';renderAdmin()};if($('#delA'))$('#delA').onclick=async()=>{if(confirm('Excluir adicional?')){await adminCall('delete_addon',{id:a.id});admin=await adminCall('snapshot');adminTab='adicionais';renderAdmin()}}}
function renderCouponsAdmin(box){box.innerHTML=`<button id="newC" class="primary" style="margin:10px 0">+ Novo cupom</button>${admin.coupons.length?admin.coupons.map(c=>`<div class="tableitem"><div class="grow"><b>${esc(c.code)}</b><div class="mini">${esc(c.type)} • ${c.value} • mínimo ${fmt(c.min_subtotal)} • ${c.active?'Ativo':'Inativo'}</div></div><button class="editbtn" data-c="${c.id}">Editar</button></div>`).join(''):'<div class="empty">Nenhum cupom cadastrado.</div>'}`;$('#newC').onclick=()=>editCoupon(null);document.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>editCoupon(admin.coupons.find(c=>c.id===b.dataset.c)))}
function editCoupon(c){c=c||{code:'',type:'fixed',value:'',min_subtotal:0,active:true};modal(`<div class="sheeth"><h2>${c.id?'Editar cupom':'Novo cupom'}</h2><button class="x" data-close>×</button></div><div class="field"><label>Código</label><input id="cCode" class="in" value="${esc(c.code)}"></div><div class="row"><div class="field"><label>Tipo</label><select id="cType" class="sel"><option value="fixed" ${c.type==='fixed'?'selected':''}>Valor fixo</option><option value="percent" ${c.type==='percent'?'selected':''}>Percentual</option><option value="free_delivery" ${c.type==='free_delivery'?'selected':''}>Entrega grátis</option></select></div><div class="field"><label>Valor</label><input id="cValue" class="in" inputmode="decimal" value="${esc(c.value)}"></div></div><div class="field"><label>Pedido mínimo</label><input id="cMin" class="in" inputmode="decimal" value="${esc(c.min_subtotal)}"></div><label class="addon"><input id="cActive" type="checkbox" ${c.active?'checked':''}><span>Ativo</span></label><div class="twoBtns"><button id="saveC" class="primary">Salvar</button>${c.id?'<button id="delC" class="secondary danger">Excluir</button>':'<button class="secondary" data-close>Cancelar</button>'}</div>`);bindClose();$('#saveC').onclick=async()=>{await adminCall('upsert_coupon',{id:c.id,code:$('#cCode').value.trim(),type:$('#cType').value,value:num($('#cValue').value),min_subtotal:num($('#cMin').value),active:$('#cActive').checked});admin=await adminCall('snapshot');adminTab='cupons';renderAdmin()};if($('#delC'))$('#delC').onclick=async()=>{if(confirm('Excluir cupom?')){await adminCall('delete_coupon',{id:c.id});admin=await adminCall('snapshot');adminTab='cupons';renderAdmin()}}}
function renderBannerAdmin(box){let image=String(admin.settings.banner_image_url||'');const drawPreview=()=>{const pv=$('#bannerPreview');if(pv)pv.innerHTML=image?`<img src="${esc(image)}" alt="Prévia do banner">`:'<div class="empty" style="border:0">Nenhuma foto de banner cadastrada.</div>'};box.innerHTML=`<div class="notice" style="margin:10px 0">Use uma imagem horizontal. Ela aparece no topo do cardápio para chamar atenção do cliente.</div><label class="addon"><input id="bActive" type="checkbox" ${admin.settings.banner_active?'checked':''}><span>Banner ativo</span></label><div id="bannerPreview" class="bannerPreview"></div><div class="field"><label>Foto do banner</label><input id="bFile" class="in" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="field"><label>Texto sobre o banner (opcional)</label><input id="bText" class="in" value="${esc(admin.settings.banner_text||'')}" placeholder="Ex.: Hoje tem Caseirão 🍔"></div><div class="twoBtns"><button id="saveBanner" class="primary">Salvar banner</button><button id="removeBannerPhoto" class="secondary danger">Remover foto</button></div>`;drawPreview();$('#bFile').onchange=async()=>{const f=$('#bFile').files[0];if(!f)return;try{const base64=await fileToBase64(f);const pin=sessionStorage.getItem('caseirao_admin_pin')||'';$('#bFile').disabled=true;const j=await api('admin-upload-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,content_type:f.type,base64})});image=j.public_url;drawPreview()}catch(e){alert(e.message)}finally{$('#bFile').disabled=false}};$('#removeBannerPhoto').onclick=()=>{image='';drawPreview()};$('#saveBanner').onclick=async()=>{try{const pin=sessionStorage.getItem('caseirao_admin_pin')||'';await api('admin-banner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,payload:{banner_active:$('#bActive').checked,banner_text:$('#bText').value.trim(),banner_image_url:image}})});admin=await adminCall('snapshot');await catalog();adminTab='banner';renderAdmin()}catch(e){alert(e.message)}}}
function renderStoreAdmin(box){const s=admin.settings;const isOpen=!!s.store_open;box.innerHTML=`<div class="storeControl"><div class="storeState"><div><div class="mini">STATUS DA LOJA AGORA</div><b class="${isOpen?'green':'red'}">${isOpen?'● ABERTA':'● FECHADA'}</b></div><span class="statusBadge ${isOpen?'st-confirmado':'st-cancelado'}">${isOpen?'Recebendo pedidos':'Pedidos bloqueados'}</span></div><button id="toggleStoreNow" class="storeNowBtn ${isOpen?'closeNow':'openNow'}">${isOpen?'ENCERRAR CAIXA E ARQUIVAR PEDIDOS':'ABRIR LOJA AGORA'}</button><div class="mini" style="margin-top:9px">${isOpen?'Ao encerrar, a loja fecha e os pedidos deste caixa saem da tela de Pedidos. Eles continuam guardados em Relatórios.':'Ao abrir, novos pedidos voltam a ser aceitos imediatamente.'}</div></div><div class="field"><label>Nome da loja</label><input id="sName" class="in" value="${esc(s.store_name)}"></div><div class="row"><div class="field"><label>WhatsApp</label><input id="sWhats" class="in" value="${esc(s.whatsapp)}"></div><div class="field"><label>Pedido mínimo</label><input id="sMin" class="in" value="${esc(s.min_order)}"></div></div><div class="field"><label>Endereço</label><input id="sAddr" class="in" value="${esc(s.address)}"></div><div class="field"><label>Texto quando estiver aberta</label><input id="sStatus" class="in" value="${esc(s.status_text)}"></div><div class="field"><label>Aviso do Pix</label><textarea id="sPix" class="ta">${esc(s.pix_text)}</textarea></div><div class="row"><div class="field"><label>Horário padrão de abertura</label><input id="sOpen" class="in" type="time" value="${esc(String(s.open_time||'18:00').slice(0,5))}"></div><div class="field"><label>Horário padrão de fechamento</label><input id="sClose" class="in" type="time" value="${esc(String(s.close_time||'23:20').slice(0,5))}"></div></div><button id="saveStore" class="primary">Salvar configurações</button>${admin.open_shift?`<div class="notice" style="margin-top:10px">Expediente aberto desde ${new Date(admin.open_shift.opened_at).toLocaleString('pt-BR')}</div>`:`<div class="mini" style="margin-top:10px">Nenhum expediente aberto agora.</div>`}`;$('#saveStore').onclick=async()=>{try{await adminCall('save_settings',{store_name:$('#sName').value.trim(),whatsapp:$('#sWhats').value.trim(),address:$('#sAddr').value.trim(),store_open:s.store_open,status_text:$('#sStatus').value.trim(),pix_text:$('#sPix').value.trim(),schedule_enabled:s.schedule_enabled,open_time:$('#sOpen').value,close_time:$('#sClose').value,delivery_eta:s.delivery_eta,pickup_eta:s.pickup_eta,min_order:num($('#sMin').value),banner_active:s.banner_active,banner_text:s.banner_text});admin=await adminCall('snapshot');await catalog();adminTab='loja';renderAdmin()}catch(e){alert(e.message)}};$('#toggleStoreNow').onclick=async()=>{try{if(isOpen){if(!confirm('Encerrar o caixa agora? A loja será fechada e os pedidos deste expediente serão arquivados. Eles continuarão disponíveis em Relatórios.'))return;const j=await adminCall('close_shift',{});let archived=0;if(j.shift){const a=await archiveCall('archive_shift',{shift_id:j.shift.id,opened_at:j.shift.opened_at,closed_at:j.shift.closed_at});archived=Number(a.archived_count||0)}alert(`Caixa encerrado. ${j.orders_count} pedidos • ${fmt(j.sales_total)} • ${archived} arquivados.`)}else{await adminCall('open_shift',{});alert('Loja aberta. Novos pedidos já estão liberados.')}admin=await adminCall('snapshot');await catalog();adminTab='loja';renderAdmin()}catch(e){alert(e.message)}}}
/* CORRECOES ADM CASEIRAO */
function shiftOrders(){
  if(!admin?.open_shift)return [];
  const opened=Date.parse(admin.open_shift.opened_at||0);
  return (admin.orders||[]).filter(o=>!o.archived_at&&(!opened||Date.parse(o.created_at)>=opened));
}
function renderAdmin(){
  if(!admin)return;
  const current=shiftOrders(),valid=current.filter(o=>o.status!=='cancelado'),sales=valid.reduce((s,o)=>s+Number(o.total||0),0);
  modal(`<div class="sheeth adminHead"><div><h2>Caixa do Caseirão</h2><div class="adminSub">${admin.settings.store_open?'Expediente em andamento':'Caixa encerrado'}</div></div><button class="x" data-close>×</button></div><div class="admgrid compactMetrics"><div class="metric"><span>Pedidos do caixa</span><b>${current.length}</b></div><div class="metric"><span>Vendas do caixa</span><b>${fmt(sales)}</b></div><div class="metric storeMetric"><span>Status</span><b class="${admin.settings.store_open?'green':'red'}">${admin.settings.store_open?'ABERTO':'FECHADO'}</b></div></div><div class="admbar cleanTabs">${[['pedidos','Pedidos'],['relatorios','Relatórios'],['produtos','Produtos'],['bairros','Bairros'],['adicionais','Adicionais'],['cupons','Cupons'],['banner','Banner'],['loja','Loja']].map(([k,n])=>`<button data-tab="${k}" class="${adminTab===k?'on':''}">${n}</button>`).join('')}</div><div id="admContent"></div>`,true);
  bindClose();document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{adminTab=b.dataset.tab;renderAdmin()});renderAdminTab();
}
function customerWhatsAppNumber(phone){
  let digits=String(phone||'').replace(/\D/g,'');
  if(digits.startsWith('00'))digits=digits.slice(2);
  if(digits.startsWith('55')&&(digits.length===12||digits.length===13))return digits;
  if(digits.length===10||digits.length===11)return '55'+digits;
  if(digits.length===8||digits.length===9)return '5586'+digits;
  return '';
}
function customerWhatsAppUrl(o){
  const phone=customerWhatsAppNumber(o.customer_phone);
  if(!phone)return '';
  const name=String(o.customer_name||'cliente').trim();
  const number=String(o.order_number||'').trim();
  let message=`Olá, ${name}! Estamos entrando em contato sobre o seu pedido #${number} no O Caseirão Burger.`;
  if(o.status==='pronto')message=o.type==='delivery'
    ?`Olá, ${name}! Seu pedido #${number} no O Caseirão Burger está pronto e em breve sairá para entrega. 🍔✅`
    :`Olá, ${name}! Seu pedido #${number} no O Caseirão Burger está pronto. Já pode vir buscar! 🍔✅`;
  else if(o.status==='em_rota')message=`Olá, ${name}! Seu pedido #${number} no O Caseirão Burger saiu para entrega. 🛵✅`;
  else if(o.status==='entregue')message=`Olá, ${name}! Passando para confirmar se você recebeu direitinho o pedido #${number} do O Caseirão Burger. 🍔`;
  return `intent://send?phone=${phone}&text=${encodeURIComponent(message)}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
}
function driverAddressWhatsAppUrl(o){
  if(o.type!=='delivery')return '';
  const address=orderAddress(o);
  if(!address)return '';
  const items=(Array.isArray(o.order_items)?o.order_items:[]).map(it=>{
    const addons=(Array.isArray(it.order_item_addons)?it.order_item_addons:[])
      .map(a=>`   + ${a.addon_name}${Number(a.price||0)>0?` (${fmt(a.price)})`:''}`);
    const note=it.note?`   *OBS. DO ITEM:* ${it.note}`:'';
    return [`*${Number(it.quantity||1)}x ${it.product_name||'Item'}*`,...addons,note].filter(Boolean).join('\n');
  }).join('\n\n')||'Itens não disponíveis';
  const payment=paymentLabel(o.payment);
  const change=o.change_for?`\n*TROCO PARA:* ${o.change_for}`:'';
  const generalNotes=o.notes?`\n\n*OBSERVAÇÕES GERAIS*\n${o.notes}`:'';
  const message=`🍔 *O CASEIRÃO BURGER — ENTREGA*\n*PEDIDO #${o.order_number}*\n\n*CLIENTE*\n${o.customer_name||'Cliente'}\n${o.customer_phone||'Telefone não informado'}\n\n*ENDEREÇO COMPLETO*\n${address}\n\n*ITENS DO PEDIDO*\n${items}${generalNotes}\n\n*PAGAMENTO*\n${payment}${change}\n\n*TOTAL: ${fmt(o.total)}*`;
  return 'intent://send?text='+encodeURIComponent(message)+'#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end';
}
function orderAdminCard(o,finished=false){
  const actions=[['confirmado','Confirmado'],['preparando','Preparando'],['pronto','Pronto'],['em_rota','Em rota'],['entregue','Entregue'],['cancelado','Cancelado']];
  const when=new Date(o.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}),delivery=Number(o.delivery_fee||0),discount=Number(o.discount||0),change=o.change_for?String(o.change_for):'';
  const waUrl=customerWhatsAppUrl(o);
  const driverWaUrl=driverAddressWhatsAppUrl(o);
  return `<details class="order orderDetailed ${finished?'finishedOrder':''}"><summary class="orderSummary"><div class="summaryMain"><div class="orderNumber">#${o.order_number}</div><div class="summaryCustomer"><b>${esc(o.customer_name||'Cliente')}</b><span>${esc(orderTypeLabel(o.type))} • ${esc(when)}</span></div></div><div class="summaryRight"><span class="statusBadge ${statusTone(o.status)}">${esc(statusLabel[o.status]||o.status)}</span><b>${fmt(o.total)}</b></div></summary><div class="orderBody"><div class="orderInfoGrid"><div class="orderInfo"><span>Cliente</span><b>${esc(o.customer_name||'Não informado')}</b><small>${esc(o.customer_phone||'Sem telefone')}</small></div><div class="orderInfo"><span>Pagamento</span><b>${esc(paymentLabel(o.payment))}</b><small>${change?`Troco para ${esc(change)}`:'Sem troco'}</small></div></div>${waUrl?`<a class="whatsappAction" href="${esc(waUrl)}" target="_blank" rel="noopener">💬 CHAMAR CLIENTE NO WHATSAPP</a>`:`<span class="whatsappAction disabled">⚠️ TELEFONE INVÁLIDO</span>`}${driverWaUrl?`<a class="deliveryAction" href="${esc(driverWaUrl)}" target="_blank" rel="noopener">📲 ENVIAR PEDIDO AO ENTREGADOR</a>`:''}${o.type==='delivery'?`<div class="addressBoxAdmin"><b>Endereço</b>${esc(orderAddress(o))}</div>`:''}<div class="orderItemsBox">${orderItemsHtml(o)}</div>${o.notes?`<div class="notesBoxAdmin"><b>Observações</b>${esc(o.notes)}</div>`:''}<div class="orderTotalsBox"><div class="orderTotalLine"><span>Subtotal</span><b>${fmt(o.subtotal)}</b></div>${delivery?`<div class="orderTotalLine"><span>Entrega</span><b>${fmt(delivery)}</b></div>`:''}${discount?`<div class="orderTotalLine"><span>Desconto</span><b>- ${fmt(discount)}</b></div>`:''}<div class="orderTotalLine grand"><span>Total</span><b>${fmt(o.total)}</b></div></div><div class="printActions"><button class="mainPrint" data-webprint="${o.id}">IMPRIMIR</button>${navigator.bluetooth?`<button class="bt" data-btprint="${o.id}">Bluetooth direto</button>`:''}</div>${finished?`<div class="orderactions"><button class="statusAction selected" disabled>${esc(statusLabel[o.status]||o.status)} ✓</button></div>`:`<div class="orderactions statusGrid">${actions.map(([st,label])=>`<button data-st="${st}" data-oid="${o.id}" class="statusAction ${statusTone(st)} ${o.status===st?'selected':''}">${o.status===st?'✓ ':''}${label}</button>`).join('')}</div>`}</div></details>`;
}
function printOrderBrowser(id,sourceOrders=null){
  const o=(sourceOrders||admin?.orders||[]).find(x=>String(x.id)===String(id));if(!o)return alert('Pedido não encontrado.');
  document.querySelector('#caseiraoPrintFrame')?.remove();
  const frame=document.createElement('iframe');frame.id='caseiraoPrintFrame';frame.title='Impressão do pedido';frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:.01;pointer-events:none';frame.srcdoc=receiptBrowserHtml(o);document.body.appendChild(frame);setTimeout(()=>frame.remove(),60000);
}
function openManualOrder(){
  let manualType='pickup';
  const quantities=new Map(),products=(admin?.products||data.products||[]).filter(p=>p.active!==false);
  const total=()=>products.reduce((s,p)=>s+(quantities.get(String(p.id))||0)*priceOf(p),0);
  const drawTotal=()=>{const el=$('#manualTotal');if(el)el.textContent=fmt(total())};
  const drawAddress=()=>{const box=$('#manualAddress');if(box)box.innerHTML=manualType==='delivery'?`<div class="row"><div class="field"><label>Rua / Avenida</label><input id="mStreet" class="in"></div><div class="field"><label>Número</label><input id="mNumber" class="in"></div></div><div class="field"><label>Bairro</label><select id="mNeighborhood" class="sel"><option value="">Selecione</option>${(admin.neighborhoods||[]).filter(n=>n.active!==false).map(n=>`<option value="${n.id}">${esc(n.name)} • ${fmt(n.fee)}</option>`).join('')}</select></div><div class="row"><div class="field"><label>Complemento</label><input id="mComplement" class="in"></div><div class="field"><label>Referência</label><input id="mReference" class="in"></div></div>`:''};
  modal(`<div class="sheeth"><div><h2>Novo pedido manual</h2><div class="adminSub">Balcão ou telefone</div></div><button class="x" id="backToAdmin">←</button></div><div class="seg"><button data-mtype="delivery">Entrega</button><button data-mtype="pickup" class="on">Retirada</button><button data-mtype="local">No local</button></div><div class="row"><div class="field"><label>Nome do cliente</label><input id="mName" class="in"></div><div class="field"><label>Telefone</label><input id="mPhone" class="in" inputmode="tel"></div></div><div id="manualAddress"></div><div class="row"><div class="field"><label>Pagamento</label><select id="mPayment" class="sel"><option>Pix</option><option>Dinheiro</option><option>Cartão</option></select></div><div class="field"><label>Troco para</label><input id="mChange" class="in"></div></div><div class="field"><label>Itens</label><div class="manualProducts">${products.map(p=>`<div class="manualProduct"><div class="grow"><b>${esc(p.name)}</b><span>${fmt(priceOf(p))}</span></div><div class="qty"><button data-mproduct="${p.id}" data-d="-1">−</button><b data-mqty="${p.id}">0</b><button data-mproduct="${p.id}" data-d="1">+</button></div></div>`).join('')}</div></div><div class="field"><label>Observações</label><textarea id="mNotes" class="ta"></textarea></div><div class="manualFooter"><div><span>Total estimado</span><b id="manualTotal">${fmt(0)}</b></div><button id="saveManual" class="primary">CRIAR PEDIDO</button></div>`,true);
  $('#backToAdmin').onclick=renderAdmin;drawAddress();
  document.querySelectorAll('[data-mtype]').forEach(b=>b.onclick=()=>{manualType=b.dataset.mtype;document.querySelectorAll('[data-mtype]').forEach(x=>x.classList.toggle('on',x===b));drawAddress()});
  document.querySelectorAll('[data-mproduct]').forEach(b=>b.onclick=()=>{const id=String(b.dataset.mproduct),next=Math.max(0,(quantities.get(id)||0)+Number(b.dataset.d));quantities.set(id,next);const q=document.querySelector(`[data-mqty="${CSS.escape(id)}"]`);if(q)q.textContent=next;drawTotal()});
  $('#saveManual').onclick=async()=>{const btn=$('#saveManual');try{const name=$('#mName').value.trim(),phone=$('#mPhone').value.trim(),items=products.map(p=>({product_id:p.id,qty:quantities.get(String(p.id))||0,addon_ids:[],note:''})).filter(i=>i.qty>0);if(!name)throw new Error('Informe o nome.');if(!phone)throw new Error('Informe o telefone.');if(!items.length)throw new Error('Adicione pelo menos um item.');const payload={customer:{name,phone},type:manualType,payment:$('#mPayment').value,change_for:$('#mChange').value.trim(),coupon_code:'',notes:('[PEDIDO MANUAL] '+$('#mNotes').value.trim()).trim(),items};if(manualType==='delivery'){const n=$('#mNeighborhood').value;if(!$('#mStreet').value.trim()||!$('#mNumber').value.trim()||!n)throw new Error('Preencha rua, número e bairro.');payload.address={street:$('#mStreet').value.trim(),number:$('#mNumber').value.trim(),neighborhood_id:n,complement:$('#mComplement').value.trim(),reference:$('#mReference').value.trim()}}btn.disabled=true;btn.textContent='Criando...';const made=await api('create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});admin=await adminCall('snapshot');knownOrderIds=new Set((admin.orders||[]).map(o=>o.id));adminTab='pedidos';renderAdmin();alert(`Pedido #${made.order_number} criado.`)}catch(e){alert(e.message||String(e));btn.disabled=false;btn.textContent='CRIAR PEDIDO'}};
}
function renderOrders(box){
  const visible=shiftOrders(),active=visible.filter(o=>!['entregue','cancelado'].includes(o.status)),finished=visible.filter(o=>['entregue','cancelado'].includes(o.status)).slice(0,12);
  box.innerHTML=`<div class="orderToolbar"><button id="manualOrder" class="primary">+ PEDIDO MANUAL</button><button id="refreshOrders" class="secondary">Atualizar</button></div>${!admin.settings.store_open?'<div class="empty cleanEmpty"><b>Caixa fechado</b><span>Abra a loja para iniciar um novo expediente. Os pedidos anteriores estão em Relatórios.</span></div>':`<div class="sectionTitle">Em andamento <span class="countPill">${active.length}</span></div>${active.length?active.map(o=>orderAdminCard(o,false)).join(''):'<div class="empty cleanEmpty"><b>Nenhum pedido agora</b><span>Os novos pedidos aparecerão aqui.</span></div>'}${finished.length?`<div class="sectionTitle">Finalizados neste caixa</div>${finished.map(o=>orderAdminCard(o,true)).join('')}`:''}`}`;
  $('#refreshOrders').onclick=refreshAdmin;$('#manualOrder').onclick=openManualOrder;bindPrintButtons();document.querySelectorAll('[data-st]').forEach(b=>b.onclick=async()=>{const next=b.dataset.st;if(next==='cancelado'&&!confirm('Cancelar este pedido?'))return;if(next==='entregue'&&!confirm(completionConfirmText(b.dataset.oid)))return;try{b.disabled=true;await adminCall('update_status',{order_id:b.dataset.oid,status:next});if(['entregue','cancelado'].includes(next))await deliveryApi('admin_stop',{order_id:b.dataset.oid},true).catch(()=>{});admin=await adminCall('snapshot');renderAdmin()}catch(e){b.disabled=false;alert(e.message)}});
}
function renderStoreAdmin(box){
  const s=admin.settings,isOpen=!!s.store_open;
  box.innerHTML=`<div class="storeControl"><div class="storeState"><div><div class="mini">STATUS DA LOJA</div><b class="${isOpen?'green':'red'}">${isOpen?'● ABERTA':'● FECHADA'}</b></div></div><button id="toggleStoreNow" class="storeNowBtn ${isOpen?'closeNow':'openNow'}">${isOpen?'FECHAR CAIXA E ARQUIVAR TUDO':'ABRIR NOVO CAIXA'}</button><div class="mini" style="margin-top:10px">${isOpen?'Ao fechar, a tela será zerada e os pedidos ficarão somente em Relatórios.':'Ao abrir, a tela começa zerada.'}</div></div><div class="field"><label>Nome da loja</label><input id="sName" class="in" value="${esc(s.store_name)}"></div><div class="row"><div class="field"><label>WhatsApp</label><input id="sWhats" class="in" value="${esc(s.whatsapp)}"></div><div class="field"><label>Pedido mínimo</label><input id="sMin" class="in" value="${esc(s.min_order)}"></div></div><div class="field"><label>Endereço</label><input id="sAddr" class="in" value="${esc(s.address)}"></div><div class="field"><label>Texto quando aberta</label><input id="sStatus" class="in" value="${esc(s.status_text)}"></div><div class="field"><label>Aviso do Pix</label><textarea id="sPix" class="ta">${esc(s.pix_text)}</textarea></div><div class="row"><div class="field"><label>Abertura padrão</label><input id="sOpen" class="in" type="time" value="${esc(String(s.open_time||'18:00').slice(0,5))}"></div><div class="field"><label>Fechamento padrão</label><input id="sClose" class="in" type="time" value="${esc(String(s.close_time||'23:20').slice(0,5))}"></div></div><button id="saveStore" class="primary">Salvar configurações</button>`;
  $('#saveStore').onclick=async()=>{try{await adminCall('save_settings',{store_name:$('#sName').value.trim(),whatsapp:$('#sWhats').value.trim(),address:$('#sAddr').value.trim(),store_open:s.store_open,status_text:$('#sStatus').value.trim(),pix_text:$('#sPix').value.trim(),schedule_enabled:s.schedule_enabled,open_time:$('#sOpen').value,close_time:$('#sClose').value,delivery_eta:s.delivery_eta,pickup_eta:s.pickup_eta,min_order:num($('#sMin').value),banner_active:s.banner_active,banner_text:s.banner_text});admin=await adminCall('snapshot');await catalog();adminTab='loja';renderAdmin()}catch(e){alert(e.message)}};
  $('#toggleStoreNow').onclick=async()=>{try{if(isOpen){if(!confirm('Fechar o caixa e arquivar todos os pedidos?'))return;const j=await adminCall('close_shift',{});if(j.shift)await archiveCall('archive_shift',{shift_id:j.shift.id,opened_at:j.shift.opened_at,closed_at:j.shift.closed_at});admin=await adminCall('snapshot');await catalog();adminTab='pedidos';renderAdmin();alert('Caixa fechado, pedidos arquivados e tela zerada.')}else{await adminCall('open_shift',{});admin=await adminCall('snapshot');await catalog();adminTab='pedidos';renderAdmin();alert('Novo caixa aberto. Tela zerada.')}}catch(e){alert(e.message||String(e))}};
}
async function deliveryApi(action,payload={},withPin=false){const body={action,payload};if(withPin)body.pin=sessionStorage.getItem('caseirao_admin_pin')||'';return api('delivery-tracking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
function mapFrameHtml(point){if(!point||point.latitude==null||point.longitude==null)return '<div class="empty cleanEmpty"><b>Aguardando a primeira localização</b><span>O entregador precisa abrir o link, permitir o GPS e iniciar o compartilhamento.</span></div>';const lat=Number(point.latitude),lng=Number(point.longitude),d=.007,bbox=[lng-d,lat-d,lng+d,lat+d].join('%2C'),src=`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`,maps=`https://www.google.com/maps?q=${lat},${lng}`,updated=point.updated_at?new Date(point.updated_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'agora',accuracy=point.accuracy?` • precisão aproximada de ${Math.round(Number(point.accuracy))} m`:'';return `<iframe class="deliveryMap" src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer"></iframe><div class="mini" style="margin-top:7px">Atualizado às ${esc(updated)}${esc(accuracy)}</div><a class="secondary" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="${esc(maps)}" target="_blank" rel="noopener">ABRIR NO GOOGLE MAPS</a>`}
async function copyText(value){try{await navigator.clipboard.writeText(value);return true}catch{const area=document.createElement('textarea');area.value=value;document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return ok}}
async function openAdminDeliveryTracking(orderId,orderNumber){if(deliveryPoll){clearInterval(deliveryPoll);deliveryPoll=null}modal(`<div class="sheeth"><div><h2>Entrega #${esc(orderNumber)}</h2><div class="adminSub">Localização do entregador</div></div><button class="x" id="backToOrders">←</button></div><div id="adminDeliveryBody"><div class="notice">Carregando rastreamento...</div></div>`,true);$('#backToOrders').onclick=()=>{if(deliveryPoll)clearInterval(deliveryPoll);deliveryPoll=null;renderAdmin()};const draw=async(shareUrl='')=>{try{const result=await deliveryApi('admin_get',{order_id:orderId},true),tracking=result.tracking,box=$('#adminDeliveryBody');if(!box)return;if(!tracking||!tracking.active){box.innerHTML=`<div class="locationState"><strong>Rastreamento ainda não iniciado</strong><div class="mini">Gere o link e envie para o celular do entregador.</div></div><button id="startDeliveryTracking" class="primary">GERAR LINK DO ENTREGADOR</button>`;$('#startDeliveryTracking').onclick=async()=>{try{const made=await deliveryApi('admin_start',{order_id:orderId},true),link=`${location.origin}${location.pathname}#entregador=${made.token}`;draw(link)}catch(e){alert(e.message)}};return}box.innerHTML=`<div class="locationState"><strong>● Rastreamento ativo</strong><div class="mini">O mapa atualiza automaticamente enquanto o entregador compartilha o GPS.</div></div>${shareUrl?`<div class="notice"><b>Link exclusivo do entregador</b><br><span style="word-break:break-all">${esc(shareUrl)}</span></div><div class="locationButtons"><button id="shareDriverLink" class="primary">ENVIAR LINK</button><button id="copyDriverLink" class="secondary">COPIAR LINK</button></div>`:''}<div id="adminLocationLive" style="margin-top:10px">${mapFrameHtml(tracking)}</div><div class="locationButtons"><button id="newDriverLink" class="secondary">GERAR NOVO LINK</button><button id="stopDeliveryTracking" class="secondary danger">ENCERRAR RASTREAMENTO</button></div>`;if(shareUrl){$('#copyDriverLink').onclick=async()=>alert(await copyText(shareUrl)?'Link copiado.':'Não foi possível copiar.');$('#shareDriverLink').onclick=async()=>{if(navigator.share)await navigator.share({title:`Entrega #${orderNumber}`,text:'Abra este link e permita a localização para iniciar a entrega:',url:shareUrl});else{await copyText(shareUrl);alert('Link copiado. Envie ao entregador.')}}}$('#newDriverLink').onclick=async()=>{if(!confirm('Gerar um novo link? O link anterior deixará de funcionar.'))return;const made=await deliveryApi('admin_start',{order_id:orderId},true);draw(`${location.origin}${location.pathname}#entregador=${made.token}`)};$('#stopDeliveryTracking').onclick=async()=>{if(!confirm('Encerrar o rastreamento desta entrega?'))return;await deliveryApi('admin_stop',{order_id:orderId},true);draw()}}catch(e){const box=$('#adminDeliveryBody');if(box)box.innerHTML=`<div class="err">${esc(e.message)}</div>`}};await draw();deliveryPoll=setInterval(async()=>{try{const result=await deliveryApi('admin_get',{order_id:orderId},true),live=$('#adminLocationLive');if(live&&result.tracking?.active)live.innerHTML=mapFrameHtml(result.tracking)}catch{}},8000)}
async function loadCustomerDeliveryMap(code,phone){if(deliveryPoll){clearInterval(deliveryPoll);deliveryPoll=null}const draw=async()=>{try{const result=await deliveryApi('customer_get',{tracking_code:code,phone}),box=$('#customerDeliveryMap');if(!box)return;box.innerHTML=result.tracking?.active?`<div class="sectionTitle">Seu entregador no mapa</div>${mapFrameHtml(result.tracking)}`:''}catch{}};await draw();deliveryPoll=setInterval(draw,8000)}
async function openDriverTracking(token){if(!token)return;try{const result=await deliveryApi('driver_get',{token}),orderNumber=result.order?.order_number||'';modal(`<div class="driverScreen"><div class="sheeth"><div><h2>Entrega #${esc(orderNumber)}</h2><div class="adminSub">O Caseirão Burger</div></div></div><div class="locationState"><div style="display:flex;align-items:center;gap:10px"><span id="driverPulse" class="driverPulse" style="background:#777;animation:none"></span><strong id="driverTitle" style="margin:0">Pronto para iniciar</strong></div><div id="driverMessage" class="mini" style="margin-top:7px">Ative a localização do celular e mantenha esta página aberta durante a entrega.</div></div><button id="startDriverGps" class="primary">INICIAR COMPARTILHAMENTO</button><button id="stopDriverGps" class="secondary danger" style="margin-top:10px" disabled>FINALIZAR COMPARTILHAMENTO</button></div>`,true);const start=$('#startDriverGps'),stop=$('#stopDriverGps'),title=$('#driverTitle'),message=$('#driverMessage'),pulse=$('#driverPulse');start.onclick=async()=>{if(!navigator.geolocation)return alert('Este celular não permite usar o GPS pelo navegador.');start.disabled=true;start.textContent='SOLICITANDO GPS...';try{if(navigator.wakeLock)driverWakeLock=await navigator.wakeLock.request('screen')}catch{}let lastSent=0;driverWatch=navigator.geolocation.watchPosition(async position=>{const now=Date.now();if(now-lastSent<5000)return;lastSent=now;try{await deliveryApi('driver_update',{token,latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy});title.textContent='Localização sendo compartilhada';message.textContent=`Última atualização às ${new Date().toLocaleTimeString('pt-BR')}. Mantenha esta tela aberta.`;pulse.removeAttribute('style');start.textContent='COMPARTILHAMENTO ATIVO';stop.disabled=false}catch(e){title.textContent='Falha ao enviar localização';message.textContent=e.message}},error=>{start.disabled=false;start.textContent='TENTAR NOVAMENTE';title.textContent='Não foi possível acessar o GPS';message.textContent=error.code===1?'Permita o acesso à localização nas configurações do navegador.':'Verifique se a localização do celular está ativada.'},{enableHighAccuracy:true,maximumAge:3000,timeout:15000})};stop.onclick=async()=>{if(!confirm('Finalizar o compartilhamento desta entrega?'))return;try{if(driverWatch!=null)navigator.geolocation.clearWatch(driverWatch);driverWatch=null;await deliveryApi('driver_stop',{token});try{await driverWakeLock?.release()}catch{}title.textContent='Compartilhamento finalizado';message.textContent='A localização não está mais sendo enviada.';pulse.style.background='#777';pulse.style.animation='none';start.disabled=true;stop.disabled=true;history.replaceState(null,'',location.pathname)}catch(e){alert(e.message)}}}catch(e){modal(`<div class="driverScreen"><div class="err"><b>Link indisponível</b><br>${esc(e.message)}</div></div>`,true)}}
async function openDriverTrackingReliable(token){
  if(!token)return;
  try{
    const result=await deliveryApi('driver_get',{token}),orderNumber=result.order?.order_number||'';
    modal(`<div class="driverScreen"><div class="sheeth"><div><h2>Entrega #${esc(orderNumber)}</h2><div class="adminSub">O Caseirão Burger</div></div></div><div class="locationState"><div style="display:flex;align-items:center;gap:10px"><span id="driverPulse" class="driverPulse" style="background:#777;animation:none"></span><strong id="driverTitle" style="margin:0">Pronto para iniciar</strong></div><div id="driverMessage" class="mini" style="margin-top:7px">Ative a localização precisa e mantenha esta tela aberta durante toda a entrega.</div></div><button id="startDriverGps" class="primary">INICIAR COMPARTILHAMENTO</button><button id="stopDriverGps" class="secondary danger" style="margin-top:10px" disabled>FINALIZAR COMPARTILHAMENTO</button></div>`,true);
    const start=$('#startDriverGps'),stop=$('#stopDriverGps'),title=$('#driverTitle'),message=$('#driverMessage'),pulse=$('#driverPulse');
    let sharing=false,lastSuccess=0,lastPosition=null;
    const gpsOptions={enableHighAccuracy:true,maximumAge:0,timeout:20000};
    const acquireWakeLock=async()=>{try{if(navigator.wakeLock&&(!driverWakeLock||driverWakeLock.released))driverWakeLock=await navigator.wakeLock.request('screen')}catch{}};
    const sendPosition=async position=>{
      if(!sharing||driverSending)return;
      const now=Date.now();
      if(now-lastSuccess<3500)return;
      driverSending=true;
      try{
        await deliveryApi('driver_update',{token,latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy});
        lastSuccess=Date.now();lastPosition=position;
        title.textContent='Localização sendo compartilhada';
        message.textContent=`GPS atualizado às ${new Date().toLocaleTimeString('pt-BR')} • precisão ${Math.round(position.coords.accuracy||0)} m. Mantenha esta tela aberta.`;
        pulse.removeAttribute('style');start.textContent='COMPARTILHAMENTO ATIVO';stop.disabled=false;
      }catch(e){title.textContent='Falha ao enviar localização';message.textContent=`${e.message}. Tentando novamente automaticamente...`}
      finally{driverSending=false}
    };
    const gpsError=error=>{
      title.textContent='Não foi possível atualizar o GPS';
      message.textContent=error.code===1?'Permita a localização precisa para este site nas configurações do navegador.':'Confira se o GPS está ligado e mantenha esta tela aberta.';
      if(!sharing){start.disabled=false;start.textContent='TENTAR NOVAMENTE'}
    };
    const forceGps=()=>{if(sharing)navigator.geolocation.getCurrentPosition(sendPosition,gpsError,gpsOptions)};
    const cleanup=async()=>{
      sharing=false;
      if(driverWatch!=null)navigator.geolocation.clearWatch(driverWatch);
      driverWatch=null;
      if(driverGpsTimer)clearInterval(driverGpsTimer);
      driverGpsTimer=null;
      if(driverVisibilityHandler)document.removeEventListener('visibilitychange',driverVisibilityHandler);
      driverVisibilityHandler=null;
      try{await driverWakeLock?.release()}catch{}
      driverWakeLock=null;
    };
    start.onclick=async()=>{
      if(!navigator.geolocation)return alert('Este celular não permite usar o GPS pelo navegador.');
      await cleanup();sharing=true;start.disabled=true;start.textContent='SOLICITANDO GPS...';
      await acquireWakeLock();
      driverWatch=navigator.geolocation.watchPosition(sendPosition,gpsError,gpsOptions);
      driverGpsTimer=setInterval(()=>{if(Date.now()-lastSuccess>6500)forceGps();else if(lastPosition)sendPosition(lastPosition)},7000);
      driverVisibilityHandler=()=>{if(document.visibilityState==='visible'){acquireWakeLock();forceGps()}else{title.textContent='Mantenha esta tela aberta';message.textContent='O Android pode pausar o GPS quando o navegador fica em segundo plano.'}};
      document.addEventListener('visibilitychange',driverVisibilityHandler);
      forceGps();
    };
    stop.onclick=async()=>{
      if(!confirm('Finalizar o compartilhamento desta entrega?'))return;
      try{await cleanup();await deliveryApi('driver_stop',{token});title.textContent='Compartilhamento finalizado';message.textContent='A localização não está mais sendo enviada.';pulse.style.background='#777';pulse.style.animation='none';start.disabled=true;stop.disabled=true;history.replaceState(null,'',location.pathname)}catch(e){alert(e.message)}
    };
  }catch(e){modal(`<div class="driverScreen"><div class="err"><b>Link indisponível</b><br>${esc(e.message)}</div></div>`,true)}
}
openDriverTracking=openDriverTrackingReliable;
function exposeDeliveryTrackingButtons(root=document){root.querySelectorAll('details.orderDetailed').forEach(card=>{const source=card.querySelector('.orderBody [data-delivery-map]'),summary=card.querySelector('.orderSummary .summaryRight');if(!source||!summary||summary.querySelector('[data-delivery-map]'))return;const quick=document.createElement('button');quick.type='button';quick.className='trackingQuick';quick.dataset.deliveryMap=source.dataset.deliveryMap;quick.dataset.orderNumber=source.dataset.orderNumber;quick.textContent='📍 RASTREAMENTO';summary.prepend(quick)})}
const trackingObserver=new MutationObserver(()=>exposeDeliveryTrackingButtons($('#modalRoot')));trackingObserver.observe($('#modalRoot'),{childList:true,subtree:true});
document.addEventListener('click',event=>{const button=event.target.closest('[data-delivery-map]');if(button){event.preventDefault();event.stopPropagation();openAdminDeliveryTracking(button.dataset.deliveryMap,button.dataset.orderNumber)}});

/* CASEIRAO PROFESSIONAL V2 — camada organizada de experiência e operação */
const customerMemory=()=>{try{return JSON.parse(localStorage.getItem('caseirao_customer')||'{}')}catch{return{}}};
const saveCustomerMemory=value=>{try{localStorage.setItem('caseirao_customer',JSON.stringify(value))}catch{}};
const digits=value=>String(value||'').replace(/\D/g,'');
const phoneMask=value=>{const d=digits(value).slice(0,11);if(d.length<=2)return d;if(d.length<=6)return `(${d.slice(0,2)}) ${d.slice(2)}`;if(d.length<=10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`};
const orderMinutes=o=>Math.max(0,Math.floor((Date.now()-new Date(o.created_at).getTime())/60000));
const orderWaitHtml=o=>{const m=orderMinutes(o),late=m>=35&&!['entregue','cancelado'].includes(o.status);return `<span class="waitBadge ${late?'late':''}">${late?'⚠️ ':''}${m} min</span>`};
const validPhone=value=>digits(value).length>=10;
const CASEIRAO_PIX={key:'53401547000165',display:'53.401.547/0001-65',bank:'Stone',holder:'Romário Remerson Alves de Carvalho'};

function renderPixPaymentPanel(){
  const payment=$('#payment'),change=$('#changeFor');if(!payment)return;
  let panel=$('#pixPaymentPanel');
  if(!panel){
    panel=document.createElement('div');panel.id='pixPaymentPanel';panel.className='pixPaymentPanel';
    panel.innerHTML=`<div class="pixPaymentTitle">◆ PAGAMENTO VIA PIX</div><div class="pixPaymentData"><div class="pixPaymentRow"><span>Banco</span><b>${esc(CASEIRAO_PIX.bank)}</b></div><div class="pixPaymentRow"><span>Titular</span><b>${esc(CASEIRAO_PIX.holder)}</b></div><div class="pixPaymentRow"><span>Tipo da chave</span><b>CNPJ</b></div></div><div class="pixKeyBox"><code>${esc(CASEIRAO_PIX.display)}</code><button type="button" class="copyPixBtn" id="copyPixBtn">COPIAR</button></div><div id="pixCopied" class="pixCopied" aria-live="polite"></div><div class="pixWarning"><b>Importante:</b> após realizar o pagamento, confirme o pedido e envie o comprovante pelo WhatsApp do Caseirão. O pagamento via Pix somente será confirmado após o recebimento do comprovante.</div>`;
    payment.closest('.row').insertAdjacentElement('afterend',panel);
    $('#copyPixBtn').onclick=async()=>{try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(CASEIRAO_PIX.key);else{const input=document.createElement('textarea');input.value=CASEIRAO_PIX.key;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();document.execCommand('copy');input.remove()}$('#pixCopied').textContent='✓ Chave Pix copiada: '+CASEIRAO_PIX.display;$('#copyPixBtn').textContent='COPIADO ✓';setTimeout(()=>{if($('#copyPixBtn'))$('#copyPixBtn').textContent='COPIAR'},2500)}catch{$('#pixCopied').textContent='Não foi possível copiar. Toque e segure a chave acima.'}};
  }
  const isPix=payment.value==='Pix';panel.classList.toggle('hide',!isPix);if(change){change.disabled=payment.value!=='Dinheiro';change.closest('.field').classList.toggle('hide',payment.value!=='Dinheiro');if(payment.value!=='Dinheiro')change.value=''}
}

function openProduct(id){
  const p=data.products.find(x=>String(x.id)===String(id));if(!p)return;const adds=allowedAddons(p);let qty=1;
  modal(`<div class="sheeth"><div><h2>${esc(p.name)}</h2><div class="adminSub">Monte do seu jeito</div></div><button class="x" data-close aria-label="Fechar">×</button></div><div class="notice">${esc(p.description||'Escolha os adicionais e observações.')}</div><div class="field"><label>Adicionais</label>${adds.length?adds.map(a=>`<label class="addon"><input type="checkbox" data-addon="${a.id}"><span class="grow">${esc(a.name)}</span><b>+ ${fmt(a.price)}</b></label>`).join(''):'<div class="mini">Este produto não possui adicionais cadastrados.</div>'}</div><div class="field"><label>Retirar ingrediente ou observação</label><textarea id="itemNote" class="ta" placeholder="Ex.: sem cebola, molho separado..."></textarea></div><div class="qtyHero"><button id="productMinus" aria-label="Diminuir quantidade">−</button><b id="productQty">1 unidade</b><button id="productPlus" aria-label="Aumentar quantidade">+</button></div><button id="confirmAdd" class="primary">Adicionar • ${fmt(priceOf(p))}</button>`);bindClose();
  const total=()=>{const extras=[...document.querySelectorAll('[data-addon]:checked')].reduce((s,i)=>s+Number(data.addons.find(a=>String(a.id)===String(i.dataset.addon))?.price||0),0);$('#productQty').textContent=`${qty} ${qty===1?'unidade':'unidades'}`;$('#confirmAdd').textContent=`Adicionar • ${fmt((priceOf(p)+extras)*qty)}`};
  $('#productMinus').onclick=()=>{qty=Math.max(1,qty-1);total()};$('#productPlus').onclick=()=>{qty=Math.min(30,qty+1);total()};document.querySelectorAll('[data-addon]').forEach(i=>i.onchange=total);
  $('#confirmAdd').onclick=()=>{const selected=[...document.querySelectorAll('[data-addon]:checked')].map(i=>data.addons.find(a=>String(a.id)===String(i.dataset.addon))).filter(Boolean);cart.push({key:crypto.randomUUID(),product:p,addons:selected,note:$('#itemNote').value.trim(),qty});closeModal();updateCartBar()};
}

function openCheckout(){
  const st=data.settings||{},saved=customerMemory();
  modal(`<div class="sheeth"><div><h2>Finalizar pedido</h2><div class="adminSub">Confira tudo antes de enviar</div></div><button class="x" data-close aria-label="Fechar">×</button></div><div class="checkoutSteps"><span class="on"></span><span class="on"></span><span></span></div><div class="seg"><button data-type="delivery" class="${orderType==='delivery'?'on':''}">Entrega</button><button data-type="pickup" class="${orderType==='pickup'?'on':''}">Retirada</button><button data-type="local" class="${orderType==='local'?'on':''}">No local</button></div><div class="row"><div class="field"><label>Seu nome *</label><input id="custName" class="in" autocomplete="name" value="${esc(saved.name||'')}"></div><div class="field"><label>WhatsApp *</label><input id="custPhone" class="in" inputmode="tel" autocomplete="tel" placeholder="(86) 99999-9999" value="${esc(saved.phone||'')}"></div></div><div id="addressBox"></div><div class="row"><div class="field"><label>Pagamento</label><select id="payment" class="sel"><option value="Pix">Pix</option><option value="Dinheiro">Dinheiro</option><option value="Cartão">Cartão</option></select></div><div class="field"><label>Troco para</label><input id="changeFor" class="in" inputmode="decimal" placeholder="Ex.: 50,00"></div></div><div class="field"><label>Cupom</label><input id="coupon" class="in" autocapitalize="characters" placeholder="Opcional"><div id="couponFeedback" class="mini"></div></div><div class="field"><label>Observações gerais</label><textarea id="orderNotes" class="ta" placeholder="Alguma observação sobre o pedido?"></textarea></div>${st.pix_text?`<div class="notice">${esc(st.pix_text)}</div>`:''}<div id="checkoutSum" class="sum"></div><div class="trustline"><span>✓ Valores conferidos</span><span>✓ Acompanhamento do pedido</span><span>✓ Dados protegidos</span></div><button id="sendOrder" class="primary">CONFIRMAR E ENVIAR PEDIDO</button>`);bindClose();
  document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{orderType=b.dataset.type;openCheckout()});renderAddress();
  if(orderType==='delivery'){const n=$('#neighborhood');if(saved.neighborhood_id)n.value=saved.neighborhood_id;$('#street').value=saved.street||'';$('#number').value=saved.number||'';$('#complement').value=saved.complement||'';$('#reference').value=saved.reference||'';const gps=document.createElement('button');gps.type='button';gps.id='useCustomerGps';gps.className='secondary gpsFill';gps.textContent='📍 Usar minha localização como referência';$('#addressBox').appendChild(gps);gps.onclick=()=>{if(!navigator.geolocation)return alert('Localização não disponível neste aparelho.');gps.disabled=true;gps.textContent='Buscando localização...';navigator.geolocation.getCurrentPosition(pos=>{const link=`https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;$('#reference').value=($('#reference').value.trim()?$('#reference').value.trim()+' • ':'')+link;gps.textContent='✓ Localização adicionada'},()=>{gps.disabled=false;gps.textContent='Tentar localização novamente'},{enableHighAccuracy:true,timeout:15000})}}
  renderPixPaymentPanel();$('#payment').onchange=renderPixPaymentPanel;$('#custPhone').oninput=e=>e.target.value=phoneMask(e.target.value);$('#coupon').oninput=e=>{e.target.value=e.target.value.toUpperCase();const c=(data.coupons||[]).find(x=>String(x.code).toUpperCase()===e.target.value.trim());$('#couponFeedback').textContent=e.target.value.trim()?(c&&c.active!==false?'Cupom encontrado. O desconto será confirmado ao enviar.':'O cupom será validado ao enviar.') : ''};$('#neighborhood')?.addEventListener('change',renderCheckoutSum);renderCheckoutSum();$('#sendOrder').onclick=sendOrder;
}

async function sendOrder(){
  const btn=$('#sendOrder');try{const customer={name:$('#custName').value.trim(),phone:$('#custPhone').value.trim()};if(customer.name.length<2)throw new Error('Informe o seu nome.');if(!validPhone(customer.phone))throw new Error('Informe um WhatsApp válido com DDD.');if(!cart.length)throw new Error('Seu carrinho está vazio.');if(!data.settings.store_open)throw new Error('A loja está fechada no momento.');const min=Number(data.settings.min_order||0);if(cartSubtotal()<min)throw new Error(`O pedido mínimo é ${fmt(min)}.`);const payload={customer,type:orderType,payment:$('#payment').value,change_for:$('#changeFor').value.trim(),coupon_code:$('#coupon').value.trim(),notes:$('#orderNotes').value.trim(),items:cart.map(x=>({product_id:x.product.id,qty:x.qty,addon_ids:x.addons.map(a=>a.id),note:x.note}))};if(payload.payment!=='Dinheiro')payload.change_for='';if(orderType==='delivery'){payload.address={street:$('#street').value.trim(),number:$('#number').value.trim(),neighborhood_id:$('#neighborhood').value,complement:$('#complement').value.trim(),reference:$('#reference').value.trim()};if(!payload.address.street||!payload.address.number||!payload.address.neighborhood_id)throw new Error('Preencha rua, número e bairro para entrega.')}btn.disabled=true;btn.textContent='ENVIANDO PEDIDO...';const j=await api('create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});saveCustomerMemory({name:customer.name,phone:phoneMask(customer.phone),...(payload.address||{})});localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:j.tracking_code,phone:customer.phone}));cart=[];updateCartBar();const wa=digits(data.settings.whatsapp||'86995653888');const receiptText=`Olá! Acabei de fazer o pedido #${j.order_number}. Código ${j.tracking_code}.`;modal(`<div class="sheeth"><div><h2>Pedido recebido ✅</h2><div class="adminSub">Agora é com o Caseirão</div></div><button class="x" data-close>×</button></div><div class="success"><b>Pedido #${j.order_number}</b><br>Código: <b>${esc(j.tracking_code)}</b><br>Total: <b>${fmt(j.total)}</b></div><div id="orderLoyalty"><div class="mini" style="padding:12px 0">Carregando sua fidelidade...</div></div><div class="operationHint">Guarde o código. Você poderá acompanhar todas as etapas do pedido.</div><button id="trackNow" class="primary">ACOMPANHAR PEDIDO</button>${payload.payment==='Pix'?`<a class="whatsappAction" href="https://wa.me/55${wa}?text=${encodeURIComponent(receiptText+' Vou enviar o comprovante do Pix.')}">ENVIAR COMPROVANTE DO PIX</a>`:''}`);bindClose();loadLoyalty('orderLoyalty',j.tracking_code,customer.phone);$('#trackNow').onclick=()=>openTracking(j.tracking_code,customer.phone)}catch(e){alert(e.message||String(e));if(btn){btn.disabled=false;btn.textContent='CONFIRMAR E ENVIAR PEDIDO'}}
}

function paymentKind(value){const key=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();if(key.includes('pix'))return'pix';if(key.includes('dinheiro'))return'dinheiro';if(key.includes('cartao')||key.includes('credito')||key.includes('debito'))return'cartao';return''}
function renderAdmin(){if(!admin)return;const current=shiftOrders(),valid=current.filter(o=>o.status!=='cancelado'),sales=valid.reduce((s,o)=>s+Number(o.total||0),0),payments=valid.reduce((totals,o)=>{const kind=paymentKind(o.payment);if(kind)totals[kind]+=Number(o.total||0);return totals},{pix:0,dinheiro:0,cartao:0});modal(`<div class="sheeth adminHead"><div class="grow"><h2>Central Caseirão</h2><div class="adminSub">Operação e gestão do negócio</div></div><button id="adminLogout" class="secondary adminLogout">Sair</button><button class="x" data-close aria-label="Fechar">×</button></div><div class="admgrid compactMetrics"><div class="metric"><b>${current.length}</b><span>Pedidos no caixa</span></div><div class="metric"><b>${fmt(sales)}</b><span>Vendas no caixa</span></div><div class="metric storeMetric"><b class="${admin.settings.store_open?'green':'red'}">${admin.settings.store_open?'ABERTA':'FECHADA'}</b><span>Loja agora</span></div></div><div class="paymentMetrics" aria-label="Vendas por forma de pagamento"><div class="paymentMetric"><span>💳 Cartão</span><b>${fmt(payments.cartao)}</b></div><div class="paymentMetric"><span>◆ Pix</span><b>${fmt(payments.pix)}</b></div><div class="paymentMetric"><span>💵 Dinheiro</span><b>${fmt(payments.dinheiro)}</b></div></div><div class="admbar">${[['pedidos','Operação'],['premiado','🎁 Pedido Premiado'],['producao','Produção'],['caixa','Caixa'],['entregas','🛵 Entregas'],['gestao','Gestão'],['fidelidade','Fidelidade'],['relatorios','Histórico'],['produtos','Produtos'],['bairros','Bairros'],['adicionais','Adicionais'],['cupons','Cupons'],['banner','Banner'],['loja','Loja']].map(([k,n])=>`<button data-tab="${k}" class="${adminTab===k?'on':''}">${n}</button>`).join('')}</div><div id="admContent"></div>`,true);bindClose();$('#adminLogout').onclick=()=>{sessionStorage.removeItem('caseirao_admin_pin');if(orderWatcher)clearInterval(orderWatcher);admin=null;openAdmin()};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{adminTab=b.dataset.tab;renderAdmin()});renderAdminTab()}

function renderAdminTab(){const box=$('#admContent');if(!box)return;if(adminTab==='pedidos')renderOrders(box);else if(adminTab==='producao')renderKitchen(box);else if(adminTab==='caixa')renderCash(box);else if(adminTab==='entregas')renderDeliveryHub(box);else if(adminTab==='gestao')renderManagement(box);else if(adminTab==='fidelidade')renderLoyaltyAdmin(box);else if(adminTab==='relatorios')renderReportsAdmin(box);else if(adminTab==='produtos')renderProductsAdmin(box);else if(adminTab==='bairros')renderNeighborhoodsAdmin(box);else if(adminTab==='adicionais')renderAddonsAdmin(box);else if(adminTab==='cupons')renderCouponsAdmin(box);else if(adminTab==='banner')renderBannerAdmin(box);else if(adminTab==='loja')renderStoreAdmin(box)}

function renderOrders(box){
  let all=shiftOrders(),filter='active',query='';

  const draw=()=>{
    const visible=all.filter(o=>{
      const matches=!query||`${o.order_number} ${o.customer_name} ${o.customer_phone}`.toLowerCase().includes(query);
      const group=filter==='all'||(filter==='active'?!['entregue','cancelado'].includes(o.status):o.status===filter);
      return matches&&group
    });

    box.innerHTML=`${caseiraoPrinterPanelHtml()}<div class="operationHint">Pedidos atrasados ficam destacados após 35 minutos. Use a busca para localizar nome, telefone ou número.</div><div class="proToolbar"><input id="orderSearch" class="in" placeholder="Buscar pedido..." value="${esc(query)}"><button id="manualOrder" class="primary">+ PEDIDO MANUAL</button></div><div class="proFilters">${[['active','Em andamento'],['novo','Novos'],['preparando','Preparando'],['pronto','Prontos'],['em_rota','Em rota'],['all','Todos']].map(([k,n])=>`<button data-ofilter="${k}" class="${filter===k?'on':''}">${n}</button>`).join('')}</div>${visible.length?visible.map(o=>orderAdminCard(o,['entregue','cancelado'].includes(o.status))).join(''):'<div class="empty cleanEmpty"><b>Nenhum pedido nesta lista</b><span>Os pedidos aparecerão aqui automaticamente.</span></div>'}`;

    bindCaseiraoPrinterPanel();
    $('#manualOrder').onclick=openManualOrder;
    $('#orderSearch').oninput=e=>{query=e.target.value.trim().toLowerCase();draw()};
    document.querySelectorAll('[data-ofilter]').forEach(b=>b.onclick=()=>{filter=b.dataset.ofilter;draw()});
    bindPrintButtons();

    document.querySelectorAll('[data-st]').forEach(b=>b.onclick=async()=>{
      const next=b.dataset.st;
      const orderId=String(b.dataset.oid||'');
      const card=b.closest('details.order');
      const wasOpen=!!card?.open;
      const scrollHost=document.querySelector('.admWorkspaceMain')||document.querySelector('.sheet.full');
      const savedScroll=scrollHost?.scrollTop||0;

      if(next==='cancelado'){
        const reason=prompt('Informe o motivo do cancelamento:');
        if(!reason)return;
        b.dataset.cancelReason=reason
      }

      try{
        b.disabled=true;
        await adminCall('update_status',{
          order_id:orderId,
          status:next,
          cancel_reason:b.dataset.cancelReason||''
        });

        if(['entregue','cancelado'].includes(next)){
          await deliveryApi('admin_stop',{order_id:orderId},true).catch(()=>{})
        }

        admin=await adminCall('snapshot');
        all=shiftOrders();

        /* Atualiza somente a lista de pedidos.
           Não chama renderAdmin(), pois isso recriava o modal inteiro
           e fechava o pedido aberto ao trocar o status. */
        draw();

        if(wasOpen&&!['entregue','cancelado'].includes(next)){
          const sameOrder=[...box.querySelectorAll('[data-st]')]
            .find(el=>String(el.dataset.oid||'')===orderId)
            ?.closest('details.order');
          if(sameOrder)sameOrder.open=true
        }

        if(scrollHost)scrollHost.scrollTop=savedScroll
      }catch(e){
        b.disabled=false;
        alert(e.message)
      }
    });

    exposeDeliveryTrackingButtons(box)
  };

  draw()
}

function kitchenWhatsAppHtml(o){const phone=customerWhatsAppNumber(o.customer_phone);if(!phone)return '<div class="kitchenPhoneMissing">⚠️ Cliente sem WhatsApp válido</div>';const messages={confirmado:`Olá, ${o.customer_name||'cliente'}! ✅ Seu pedido #${o.order_number} foi aceito pelo O Caseirão Burger.`,preparando:`Olá, ${o.customer_name||'cliente'}! 🍔 Seu pedido #${o.order_number} está em preparo.`,pronto:o.type==='pickup'?`Olá, ${o.customer_name||'cliente'}! ✅ Seu pedido #${o.order_number} está pronto. Você já pode vir buscar no Caseirão.`:`Olá, ${o.customer_name||'cliente'}! ✅ Seu pedido #${o.order_number} está pronto e aguardando o entregador.`,em_rota:`Olá, ${o.customer_name||'cliente'}! 🛵 Seu pedido #${o.order_number} saiu para entrega e está a caminho.`,entregue:o.type==='pickup'?`Pedido #${o.order_number} retirado com sucesso. Obrigado por escolher o Caseirão! 🍔`:`Seu pedido #${o.order_number} foi entregue. Obrigado por escolher o Caseirão! Bom apetite 🍔`};const stages=o.type==='delivery'?[['confirmado','ACEITO'],['preparando','EM PREPARO'],['pronto','PRONTO'],['em_rota','EM ROTA'],['entregue','ENTREGUE']]:[['confirmado','ACEITO'],['preparando','EM PREPARO'],['pronto','PODE BUSCAR'],['entregue','RETIRADO']];return `<div class="kitchenWhatsApp"><b>💬 AVISAR CLIENTE NO WHATSAPP</b><div>${stages.map(([stage,label])=>`<a href="https://wa.me/${phone}?text=${encodeURIComponent(messages[stage])}" target="_blank" rel="noopener">${label}</a>`).join('')}</div></div>`}
function renderKitchen(box){const orders=shiftOrders().filter(o=>['novo','confirmado','preparando','pronto'].includes(o.status));box.innerHTML=`<div class="kitchenToolbar"><button id="manualOrderKitchen" class="primary">+ PEDIDO MANUAL</button><button id="connectPrinterKitchen" class="secondary">🖨️ CONECTAR BLUETOOTH</button><button id="refreshKitchen" class="secondary">↻ ATUALIZAR</button></div><div id="printerState" class="printerState kitchenPrinterState">${btWriteChar&&btDevice?.gatt?.connected?`Conectada: ${esc(btPrinterName)}`:navigator.bluetooth?'Impressora Bluetooth disponível no Chrome.':'Bluetooth indisponível neste navegador.'}</div><div class="operationHint">Produção completa: cliente, tempo, pagamento, endereço, itens, impressão e mensagens do WhatsApp.</div><div class="kitchenGrid">${orders.length?orders.map(o=>{const m=orderMinutes(o),late=m>=35,created=new Date(o.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),change=o.change_for?` • Troco para ${esc(o.change_for)}`:'';return `<article class="kitchenCard kitchenFullCard ${late?'late':''}"><div class="ordertop kitchenOrderTop"><div><b class="orderNumber">#${o.order_number}</b><div class="kitchenCreated">Recebido às ${esc(created)}</div></div><span class="grow"></span>${orderWaitHtml(o)}</div><div class="kitchenCustomer"><div><span>CLIENTE</span><b>${esc(o.customer_name||'Não informado')}</b><a href="tel:${esc(o.customer_phone||'')}">${esc(o.customer_phone||'Sem telefone')}</a></div><div><span>PEDIDO E PAGAMENTO</span><b>${esc(orderTypeLabel(o.type))}</b><small>${esc(paymentLabel(o.payment))} • ${fmt(o.total)}${change}</small></div></div>${o.type==='delivery'?`<div class="kitchenAddress"><b>📍 ENDEREÇO COMPLETO</b><span>${esc(orderAddress(o))}</span></div>`:`<div class="kitchenAddress pickup"><b>📦 ${esc(orderTypeLabel(o.type))}</b><span>Cliente busca no estabelecimento</span></div>`}<div class="kitchenItems">${(o.order_items||[]).map(i=>`<div class="kitchenItem"><b>${Number(i.quantity||1)}x ${esc(i.product_name||'Item')}</b>${(i.order_item_addons||[]).map(a=>`<div class="kitchenAddon">+ ${esc(a.addon_name)}</div>`).join('')}${i.note?`<div class="kitchenNote">Observação do item: ${esc(i.note)}</div>`:''}</div>`).join('')}</div>${o.notes?`<div class="kitchenNote"><b>OBSERVAÇÃO GERAL:</b> ${esc(o.notes)}</div>`:''}<div class="printActions kitchenPrintActions"><button class="mainPrint" data-webprint="${o.id}">🧾 IMPRIMIR PEDIDO</button><button class="bt" data-btprint="${o.id}">🖨️ BLUETOOTH</button></div>${kitchenWhatsAppHtml(o)}<button class="primary kitchenMainAction" data-kitchen="${o.id}" data-next="${o.status==='novo'||o.status==='confirmado'?'preparando':'pronto'}">${o.status==='novo'||o.status==='confirmado'?'INICIAR PREPARO':'MARCAR COMO PRONTO'}</button></article>`}).join(''):'<div class="empty">Nenhum pedido aguardando produção.</div>'}</div>`;$('#manualOrderKitchen').onclick=openManualOrder;$('#refreshKitchen').onclick=async()=>{admin=await adminCall('snapshot');renderKitchen(box)};$('#connectPrinterKitchen').onclick=async()=>{try{await connectBluetoothPrinter()}catch(e){setPrinterState(e.message||String(e),'error');alert(e.message||String(e))}};bindPrintButtons(orders);document.querySelectorAll('[data-kitchen]').forEach(b=>b.onclick=async()=>{try{b.disabled=true;await adminCall('update_status',{order_id:b.dataset.kitchen,status:b.dataset.next});admin=await adminCall('snapshot');renderKitchen(box)}catch(e){b.disabled=false;alert(e.message)}})}

function cashOrders(){return shiftOrders().filter(o=>o.status!=='cancelado')}
function renderCash(box){const orders=cashOrders(),sales=orders.reduce((s,o)=>s+Number(o.total||0),0),delivery=orders.reduce((s,o)=>s+Number(o.delivery_fee||0),0),discount=orders.reduce((s,o)=>s+Number(o.discount||0)+Number(o.delivery_discount||0),0),byPay={};orders.forEach(o=>byPay[o.payment||'Não informado']=(byPay[o.payment||'Não informado']||0)+Number(o.total||0));box.innerHTML=`<div class="financeGrid"><div class="financeCard"><span>Faturamento do caixa</span><b>${fmt(sales)}</b></div><div class="financeCard"><span>Pedidos válidos</span><b>${orders.length}</b></div><div class="financeCard"><span>Ticket médio</span><b>${fmt(orders.length?sales/orders.length:0)}</b></div><div class="financeCard"><span>Taxas de entrega</span><b>${fmt(delivery)}</b></div><div class="financeCard"><span>Descontos concedidos</span><b>${fmt(discount)}</b></div><div class="financeCard"><span>Cancelados</span><b>${shiftOrders().filter(o=>o.status==='cancelado').length}</b></div></div><div class="sectionTitle">Recebimentos</div><div class="reportBreak">${Object.entries(byPay).map(([k,v])=>`<div class="reportRow"><span>${esc(k)}</span><b>${fmt(v)}</b></div>`).join('')||'<div class="mini">Nenhum recebimento.</div>'}</div><div class="operationHint">O fechamento oficial e o arquivamento continuam no menu Loja. Os valores acima são calculados com os pedidos deste expediente.</div>`}

function renderManagement(box){const orders=(admin.orders||[]).filter(o=>o.status!=='cancelado'),sales=orders.reduce((s,o)=>s+Number(o.total||0),0),productCount={},addonCount={},hours={};orders.forEach(o=>{hours[String(new Date(o.created_at).getHours()).padStart(2,'0')+'h']=(hours[String(new Date(o.created_at).getHours()).padStart(2,'0')+'h']||0)+1;(o.order_items||[]).forEach(i=>{productCount[i.product_name||'Item']=(productCount[i.product_name||'Item']||0)+Number(i.quantity||1);(i.order_item_addons||[]).forEach(a=>addonCount[a.addon_name||'Adicional']=(addonCount[a.addon_name||'Adicional']||0)+Number(i.quantity||1))})});const rank=obj=>Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5);box.innerHTML=`<div class="financeGrid"><div class="financeCard"><span>Vendas carregadas</span><b>${fmt(sales)}</b></div><div class="financeCard"><span>Pedidos válidos</span><b>${orders.length}</b></div><div class="financeCard"><span>Ticket médio</span><b>${fmt(orders.length?sales/orders.length:0)}</b></div></div><div class="sectionTitle">Produtos mais vendidos</div><div class="reportBreak">${rank(productCount).map(([n,q])=>`<div class="rankRow"><b>${esc(n)}</b><span>${q} un.</span></div>`).join('')||'<div class="mini">Sem dados.</div>'}</div><div class="sectionTitle">Adicionais mais escolhidos</div><div class="reportBreak">${rank(addonCount).map(([n,q])=>`<div class="rankRow"><b>${esc(n)}</b><span>${q} un.</span></div>`).join('')||'<div class="mini">Sem dados.</div>'}</div><div class="sectionTitle">Horários com mais pedidos</div><div class="reportBreak">${rank(hours).map(([n,q])=>`<div class="rankRow"><b>${esc(n)}</b><span>${q} pedidos</span></div>`).join('')||'<div class="mini">Sem dados.</div>'}</div>`}

async function renderLoyaltyAdmin(box){box.innerHTML='<div class="notice">Carregando clientes...</div>';try{const result=await loyaltyAdmin('snapshot'),customers=result.customers||[];let target=loyaltyTarget(result);const available=customers.reduce((sum,c)=>sum+Math.max(0,Number(c.loyalty_rewards_earned||0)-Number(c.loyalty_rewards_redeemed||0)),0);const draw=(query='')=>{const q=query.toLowerCase(),list=customers.filter(c=>!q||`${c.name} ${c.phone}`.toLowerCase().includes(q)).sort((a,b)=>{const ab=Number(a.loyalty_rewards_earned||0)-Number(a.loyalty_rewards_redeemed||0),bb=Number(b.loyalty_rewards_earned||0)-Number(b.loyalty_rewards_redeemed||0);return bb-ab||Number(b.order_count||0)-Number(a.order_count||0)});box.innerHTML=`<div class="financeGrid"><div class="financeCard"><span>Clientes cadastrados</span><b>${customers.length}</b></div><div class="financeCard"><span>Brindes disponíveis</span><b>${available}</b></div><div class="financeCard"><span>Regra atual</span><b>${target} pedidos</b></div></div><div class="loyaltyCard"><div class="sectionTitle" style="margin-top:0">Regra da fidelidade</div><div class="operationHint">Escolha quantos lanches/pedidos o cliente precisa completar para ganhar 1 brinde. A alteração vale para todos os clientes.</div><div class="row"><div class="field"><label>Quantidade para ganhar o brinde</label><input id="loyaltyTarget" class="in" type="number" inputmode="numeric" min="1" max="100" step="1" value="${target}"></div><div class="field" style="display:flex;align-items:flex-end"><button id="saveLoyaltyRule" class="primary">SALVAR REGRA</button></div></div><div id="loyaltyRuleFeedback"></div></div><div class="operationHint">Cada pedido soma automaticamente pelo WhatsApp. Ao completar ${target}, o cliente ganha um brinde.</div><input id="loyaltySearch" class="in" placeholder="Buscar cliente ou WhatsApp..." value="${esc(query)}">${list.map(c=>{const count=Number(c.order_count||0),earned=Number(c.loyalty_rewards_earned||0),redeemed=Number(c.loyalty_rewards_redeemed||0),balance=Math.max(0,earned-redeemed),cycle=count%target,progress=cycle===0&&count>0?target:cycle;return `<div class="loyaltyCard"><div class="loyaltyCardTop"><div class="grow"><b>${esc(c.name)}</b><div class="mini">${esc(phoneMask(c.phone))} • ${count} ${count===1?'pedido':'pedidos'}</div></div>${balance>0?`<span class="rewardBadge">🎁 ${balance} disponível</span>`:`<span class="loyaltyCount">${progress}/${target}</span>`}</div><div class="loyaltyTrack"><div class="loyaltyFill" style="width:${Math.min(100,(progress/target)*100)}%"></div></div>${balance>0?`<div class="loyaltyActions"><button class="primary" data-redeem="${c.id}" data-name="${esc(c.name)}">MARCAR BRINDE ENTREGUE</button></div>`:`<div class="mini">Faltam ${cycle===0&&count>0?target:target-cycle} pedidos para o próximo brinde.</div>`}</div>`}).join('')||'<div class="empty">Nenhum cliente encontrado.</div>'}`;$('#loyaltySearch').oninput=e=>draw(e.target.value.trim());$('#saveLoyaltyRule').onclick=async()=>{const btn=$('#saveLoyaltyRule'),feedback=$('#loyaltyRuleFeedback'),value=Math.round(Number($('#loyaltyTarget').value));try{if(!Number.isInteger(value)||value<1||value>100)throw new Error('Informe uma quantidade entre 1 e 100.');btn.disabled=true;btn.textContent='SALVANDO...';const saved=await loyaltyAdmin('save_rule',{orders_required:value});target=loyaltyTarget(saved?.rule||saved);data.settings.loyalty_orders_required=target;if(admin?.settings)admin.settings.loyalty_orders_required=target;feedback.innerHTML='<div class="success" style="margin-top:10px">Regra salva com sucesso.</div>';setTimeout(()=>draw(query),650)}catch(e){feedback.innerHTML=`<div class="err" style="margin-top:10px">${esc(e.message||String(e))}</div>`;btn.disabled=false;btn.textContent='TENTAR SALVAR NOVAMENTE'}};document.querySelectorAll('[data-redeem]').forEach(btn=>btn.onclick=async()=>{if(!confirm(`Confirmar que o brinde de ${btn.dataset.name} foi entregue?`))return;try{btn.disabled=true;await loyaltyAdmin('redeem',{customer_id:btn.dataset.redeem});await renderLoyaltyAdmin(box)}catch(e){btn.disabled=false;alert(e.message||String(e))}})};draw()}catch(e){box.innerHTML=`<div class="err">${esc(e.message||String(e))}</div>`}}

function editAddon(a){a=a||{name:'',price:'',active:true};modal(`<div class="sheeth"><div><h2>${a.id?'Editar adicional':'Novo adicional'}</h2><div class="adminSub">Cadastro seguro</div></div><button class="x" data-close>×</button></div><div class="field"><label>Nome *</label><input id="aName" class="in" value="${esc(a.name)}" placeholder="Ex.: Bacon"></div><div class="field"><label>Preço *</label><input id="aPrice" class="in" inputmode="decimal" value="${esc(a.price)}" placeholder="0,00"></div><label class="addon"><input id="aActive" type="checkbox" ${a.active?'checked':''}><span>Disponível para venda</span></label><div id="addonError"></div><div class="twoBtns"><button id="saveA" class="primary">SALVAR ADICIONAL</button>${a.id?'<button id="delA" class="secondary danger">Excluir</button>':'<button class="secondary" data-close>Cancelar</button>'}</div>`);bindClose();$('#saveA').onclick=async()=>{const btn=$('#saveA'),name=$('#aName').value.trim(),raw=$('#aPrice').value.trim(),price=num(raw),error=$('#addonError');try{error.innerHTML='';if(name.length<2)throw new Error('Informe o nome do adicional.');if(raw===''||price<0)throw new Error('Informe um preço válido.');btn.disabled=true;btn.textContent='SALVANDO...';await adminCall('upsert_addon',{id:a.id||null,name,price,active:$('#aActive').checked});admin=await adminCall('snapshot');adminTab='adicionais';renderAdmin()}catch(e){error.innerHTML=`<div class="err" style="margin-bottom:10px">${esc(e.message||String(e))}</div>`;btn.disabled=false;btn.textContent='TENTAR SALVAR NOVAMENTE'}};if($('#delA'))$('#delA').onclick=async()=>{if(!confirm(`Excluir o adicional “${a.name}”?`))return;try{$('#delA').disabled=true;await adminCall('delete_addon',{id:a.id});admin=await adminCall('snapshot');adminTab='adicionais';renderAdmin()}catch(e){alert(e.message||String(e));$('#delA').disabled=false}}}

/* Correção definitiva da fidelidade: nome e telefone são escritos juntos no
   mesmo bloco visível de cada cartão. */
const renderLoyaltyAdminWithNames=renderLoyaltyAdmin;
renderLoyaltyAdmin=async function(box){
  await renderLoyaltyAdminWithNames(box);
  const reveal=()=>{
    box.querySelectorAll('.loyaltyCardTop .grow').forEach(grow=>{
      const originalName=grow.querySelector('b');
      const details=grow.querySelector('.mini');
      if(!details||details.dataset.customerIdentity==='ready')return;
      const name=String(originalName?.textContent||'').trim()||'Nome não cadastrado';
      const phoneAndOrders=String(details.textContent||'').trim();
      details.dataset.customerIdentity='ready';
      details.innerHTML=`<strong style="display:block!important;margin:0 0 5px!important;color:#171a1e!important;-webkit-text-fill-color:#171a1e!important;opacity:1!important;visibility:visible!important;font-size:18px!important;font-weight:950!important;line-height:1.25!important">${esc(name)}</strong><span style="display:block!important;color:#626b75!important;-webkit-text-fill-color:#626b75!important;font-size:13px!important">${esc(phoneAndOrders)}</span>`;
      if(originalName)originalName.remove();
    });
  };
  reveal();
  box._loyaltyNameObserver?.disconnect();
  box._loyaltyNameObserver=new MutationObserver(reveal);
  box._loyaltyNameObserver.observe(box,{childList:true,subtree:true});
};

/* CASEIRAO EXPERIENCE V1 — navegação, carrinho, instalação e avisos */
let installPrompt=null,apiPending=0,apiTimer=null,lastCartCount=0;
const nativeAlert=window.alert.bind(window);
function showAppToast(message,type='info'){document.querySelector('.appToast')?.remove();const toast=document.createElement('div');toast.className=`appToast ${type}`;toast.setAttribute('role','status');toast.textContent=String(message||'Pronto.');document.body.appendChild(toast);setTimeout(()=>toast.remove(),type==='err'?5000:3200)}
window.alert=message=>showAppToast(message,/erro|falha|não foi|inválid|indisponível/i.test(String(message))?'err':'ok');
function setLoading(active){apiPending=Math.max(0,apiPending+(active?1:-1));clearTimeout(apiTimer);if(apiPending>0)apiTimer=setTimeout(()=>$('#loadingBar')?.classList.remove('hide'),220);else $('#loadingBar')?.classList.add('hide')}
const apiOriginal=api;api=async function(slug,opts={}){setLoading(true);try{return await apiOriginal(slug,opts)}finally{setLoading(false)}};

function persistCart(){try{localStorage.setItem('caseirao_cart',JSON.stringify(cart))}catch{}}
function restoreCart(){try{const saved=JSON.parse(localStorage.getItem('caseirao_cart')||'[]');if(Array.isArray(saved))cart=saved.filter(x=>x&&x.product&&Number(x.qty)>0).map(x=>({...x,key:x.key||crypto.randomUUID(),qty:Math.min(30,Math.max(1,Number(x.qty)||1)),addons:Array.isArray(x.addons)?x.addons:[]}))}catch{cart=[]}}
const updateCartBarOriginal=updateCartBar;updateCartBar=function(){const count=cartCount();persistCart();updateCartBarOriginal();if(count>lastCartCount&&lastCartCount>=0)showAppToast('Produto adicionado ao carrinho.','ok');lastCartCount=count};

const modalOriginal=modal,closeModalOriginal=closeModal;
function modalHeading(){return modalRoot.querySelector('.sheeth h2')?.textContent?.trim()||''}
modal=function(html,full=false){const wasOpen=!!modalRoot.firstElementChild;modalOriginal(html,full);const sheet=modalRoot.querySelector('.sheet');if(sheet&&!sheet.querySelector('.modalNav'))sheet.insertAdjacentHTML('afterbegin','<nav class="modalNav" aria-label="Navegação"><button type="button" data-smart-back>← Voltar</button><button type="button" data-modal-home>⌂ Início</button></nav>');sheet?.querySelector('[data-smart-back]')?.addEventListener('click',smartBack);sheet?.querySelector('[data-modal-home]')?.addEventListener('click',goHome);if(!wasOpen&&!history.state?.caseiraoModal)history.pushState({caseiraoModal:true},'',location.href)};
closeModal=function(fromHistory=false){closeModalOriginal();if(!fromHistory&&history.state?.caseiraoModal)history.back()};
function smartBack(){if(/Finalizar pedido/i.test(modalHeading()))renderCart();else closeModal()}
function goHome(){closeModal();window.scrollTo({top:0,behavior:'smooth'});$('#search').value='';search='';cat='Todos';if(data.products?.length)renderCatalog()}
window.addEventListener('popstate',()=>{if(!modalRoot.firstElementChild)return;if(/Finalizar pedido/i.test(modalHeading())){renderCart();history.pushState({caseiraoModal:true},'',location.href)}else closeModal(true)});

renderCart=function(){modal(`<div class="sheeth"><div><h2>Seu pedido</h2><div class="adminSub">Confira os itens antes de continuar</div></div><button class="x" data-close aria-label="Fechar">×</button></div><div id="cartLines"></div><div class="cartBreakdown"><div class="sumrow"><span>Produtos</span><b>${fmt(cartSubtotal())}</b></div><div class="sumrow"><span>Entrega</span><span class="mini">Calculada no endereço</span></div><div class="sumrow total"><span>Subtotal</span><b>${fmt(cartSubtotal())}</b></div></div><div class="twoBtns"><button class="secondary" data-close>CONTINUAR COMPRANDO</button><button id="goCheckout" class="primary" ${cart.length?'':'disabled'}>FINALIZAR PEDIDO</button></div>`);bindClose();const box=$('#cartLines');box.innerHTML=cart.length?cart.map(x=>`<div class="lineitem cartLine"><div class="cartDetails">${x.product.image_url?`<img class="cartThumb" src="${esc(x.product.image_url)}" alt="">`:'<div class="cartThumb"></div>'}<div class="grow"><b>${esc(x.product.name)}</b><div class="mini">${x.addons.map(a=>esc(a.name)).join(', ')||'Sem adicionais'}${x.note?'<br>'+esc(x.note):''}</div><div class="mini">${fmt((priceOf(x.product)+x.addons.reduce((s,a)=>s+Number(a.price||0),0))*x.qty)}</div></div></div><div class="qty"><button data-q="${x.key}" data-d="-1" aria-label="Diminuir">−</button><b>${x.qty}</b><button data-q="${x.key}" data-d="1" aria-label="Aumentar">+</button></div></div>`).join(''):'<div class="empty">Seu carrinho está vazio.</div>';document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const x=cart.find(i=>i.key===b.dataset.q);if(!x)return;x.qty+=Number(b.dataset.d);if(x.qty<=0)cart=cart.filter(i=>i.key!==x.key);updateCartBar();renderCart()});$('#goCheckout')?.addEventListener('click',openCheckout)};

function openCustomerLoyalty(){const saved=(()=>{try{return JSON.parse(localStorage.getItem('caseirao_last_tracking')||'{}')}catch{return{}}})(),memory=customerMemory(),target=loyaltyTarget(data.settings);modal(`<div class="sheeth"><div><h2>Minha fidelidade</h2><div class="adminSub">A cada ${target} pedidos, você ganha um brinde</div></div><button class="x" data-close>×</button></div><div class="notice">Digite somente o mesmo WhatsApp usado nos seus pedidos.</div><div class="field"><label>Seu WhatsApp cadastrado</label><input id="loyaltyPhone" class="in" inputmode="tel" autocomplete="tel" value="${esc(phoneMask(saved.phone||memory.phone||''))}" placeholder="(86) 99999-9999"></div><button id="checkLoyalty" class="primary">VER MINHA FIDELIDADE</button><div id="customerLoyaltyResult"></div>`);bindClose();$('#loyaltyPhone').oninput=e=>e.target.value=phoneMask(e.target.value);$('#checkLoyalty').onclick=async()=>{const btn=$('#checkLoyalty'),phone=$('#loyaltyPhone').value.trim();try{if(!validPhone(phone))throw new Error('Informe um WhatsApp válido com DDD.');btn.disabled=true;btn.textContent='CONSULTANDO...';const result=await loyaltyStatus(phone);saveCustomerMemory({...memory,phone:phoneMask(phone)});$('#customerLoyaltyResult').innerHTML=loyaltyHtml(result.loyalty)}catch(e){$('#customerLoyaltyResult').innerHTML=`<div class="err" style="margin-top:12px">${esc(e.message||String(e))}</div>`}finally{btn.disabled=false;btn.textContent='VER MINHA FIDELIDADE'}}}

function installManifest(){try{const manifest={name:'O Caseirão Burger',short_name:'Caseirão',description:'Cardápio e pedidos do O Caseirão Burger',start_url:location.pathname,scope:location.pathname.replace(/[^/]*$/,''),display:'standalone',background_color:'#f3f4f6',theme_color:'#ffffff',icons:[]};const link=document.createElement('link');link.rel='manifest';link.href=URL.createObjectURL(new Blob([JSON.stringify(manifest)],{type:'application/manifest+json'}));document.head.appendChild(link)}catch{}}
async function installApp(){if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone){showAppToast('O Caseirão já está instalado neste celular.','ok');return}if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;installPrompt=null;if(choice.outcome==='accepted')showAppToast('Aplicativo instalado com sucesso.','ok');return}modal(`<div class="sheeth"><div><h2>Instalar o Caseirão</h2><div class="adminSub">Crie um atalho na tela inicial</div></div><button class="x" data-close>×</button></div><div class="installSteps"><div class="installStep"><b>1</b><div>Abra o menu do navegador, nos <strong>três pontinhos</strong>.</div></div><div class="installStep"><b>2</b><div>Toque em <strong>Adicionar à tela inicial</strong> ou <strong>Instalar aplicativo</strong>.</div></div><div class="installStep"><b>3</b><div>Confirme em <strong>Instalar</strong>.</div></div></div><div class="notice">Depois disso, o Caseirão abrirá pelo ícone na tela do celular.</div>`);bindClose()}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#installBtn')?.classList.add('ready')});
window.addEventListener('appinstalled',()=>showAppToast('Caseirão instalado na tela inicial.','ok'));
window.addEventListener('beforeunload',event=>{if(!cart.length)return;event.preventDefault();event.returnValue='' });

/* CASEIRAO COMPLETE OPERATIONS V3 */
let appliedCoupon=null,customerStatusPoll=null,opsCache={drivers:[],cash_movements:[],audit_logs:[]};
const activeEta=type=>{const s=data.settings||{},peak=!!s.peak_mode;return type==='delivery'?(peak?s.peak_delivery_eta:s.delivery_eta):(peak?s.peak_pickup_eta:s.pickup_eta)};
async function opsCall(action='snapshot',payload={}){return api('admin-ops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:sessionStorage.getItem('caseirao_admin_pin')||'',action,payload})})}
function couponPayload(){return{code:$('#coupon')?.value.trim(),subtotal:cartSubtotal(),delivery_fee:checkoutFee(),order_type:orderType,phone:$('#custPhone')?.value||''}}
async function applyCheckoutCoupon(){const btn=$('#applyCoupon'),feedback=$('#couponFeedback');try{btn.disabled=true;feedback.className='mini';feedback.textContent='Validando cupom...';appliedCoupon=await api('validate-coupon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(couponPayload())});feedback.className='success';feedback.textContent='✓ '+appliedCoupon.message;renderCheckoutSum()}catch(e){appliedCoupon=null;feedback.className='err';feedback.textContent=e.message||String(e);renderCheckoutSum()}finally{btn.disabled=false}}
function renderCheckoutSum(){const sub=cartSubtotal(),fee=checkoutFee(),discount=Number(appliedCoupon?.discount||0),deliveryDiscount=Number(appliedCoupon?.delivery_discount||0),total=Math.max(0,sub+fee-discount-deliveryDiscount),eta=activeEta(orderType);if(!$('#checkoutSum'))return;$('#checkoutSum').innerHTML=`<div class="etaCard"><b>${data.settings.peak_mode?'🔥 Movimento intenso':'🕐 Previsão'}</b><span>${orderType==='delivery'?'Entrega':'Preparo'} em ${esc(eta||'a confirmar')}</span></div><div class="sumrow"><span>Produtos</span><b>${fmt(sub)}</b></div><div class="sumrow"><span>Entrega</span><b>${fmt(fee)}</b></div>${discount?`<div class="sumrow discountLine"><span>Desconto ${esc(appliedCoupon.code)}</span><b>- ${fmt(discount)}</b></div>`:''}${deliveryDiscount?`<div class="sumrow discountLine"><span>Desconto na entrega</span><b>- ${fmt(deliveryDiscount)}</b></div>`:''}<div class="sumrow total"><span>Total</span><b>${fmt(total)}</b></div>`}
function openCheckout(){appliedCoupon=null;const s=data.settings||{},saved=customerMemory(),eta=activeEta(orderType);modal(`<div class="sheeth"><div><h2>Finalizar pedido</h2><div class="adminSub">Previsão atual: ${esc(eta||'a confirmar')}</div></div><button class="x" data-close>×</button></div><div class="seg"><button data-type="delivery" class="${orderType==='delivery'?'on':''}">Entrega</button><button data-type="pickup" class="${orderType==='pickup'?'on':''}">Retirada</button><button data-type="local" class="${orderType==='local'?'on':''}">No local</button></div><div class="row"><div class="field"><label>Seu nome *</label><input id="custName" class="in" value="${esc(saved.name||'')}"></div><div class="field"><label>WhatsApp *</label><input id="custPhone" class="in" inputmode="tel" value="${esc(saved.phone||'')}"></div></div><div id="addressBox"></div><div class="row"><div class="field"><label>Pagamento</label><select id="payment" class="sel"><option>Pix</option><option>Dinheiro</option><option>Cartão</option></select></div><div class="field"><label>Troco para</label><input id="changeFor" class="in" inputmode="decimal"></div></div>${s.schedule_enabled?`<div class="field"><label>Quando preparar?</label><select id="scheduleMode" class="sel"><option value="now">O mais rápido possível</option><option value="schedule">Agendar horário</option></select><input id="scheduledFor" class="in hide" type="datetime-local" style="margin-top:8px"></div>`:''}<div class="field"><label>Cupom</label><div class="couponRow"><input id="coupon" class="in" placeholder="Digite o código"><button id="applyCoupon" class="secondary">APLICAR</button></div><div id="couponFeedback" class="mini"></div></div><div class="field"><label>Observações</label><textarea id="orderNotes" class="ta"></textarea></div><div id="checkoutSum" class="sum"></div><button id="sendOrder" class="primary">CONFIRMAR E ENVIAR</button>`);bindClose();document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{orderType=b.dataset.type;openCheckout()});renderAddress();if(orderType==='delivery'){const n=$('#neighborhood');if(saved.neighborhood_id)n.value=saved.neighborhood_id;$('#street').value=saved.street||'';$('#number').value=saved.number||'';$('#complement').value=saved.complement||'';$('#reference').value=saved.reference||''}renderPixPaymentPanel();$('#payment').onchange=renderPixPaymentPanel;$('#custPhone').oninput=e=>e.target.value=phoneMask(e.target.value);$('#coupon').oninput=e=>{e.target.value=e.target.value.toUpperCase();appliedCoupon=null;$('#couponFeedback').textContent='Toque em APLICAR para conferir.';renderCheckoutSum()};$('#applyCoupon').onclick=applyCheckoutCoupon;$('#neighborhood')?.addEventListener('change',()=>{appliedCoupon=null;renderCheckoutSum()});$('#scheduleMode')?.addEventListener('change',e=>$('#scheduledFor').classList.toggle('hide',e.target.value!=='schedule'));renderCheckoutSum();$('#sendOrder').onclick=sendOrder}
async function sendOrder(){const btn=$('#sendOrder');try{const customer={name:$('#custName').value.trim(),phone:$('#custPhone').value.trim()};if(customer.name.length<2)throw new Error('Informe seu nome.');if(!validPhone(customer.phone))throw new Error('Informe um WhatsApp válido.');if(!cart.length)throw new Error('Seu carrinho está vazio.');if($('#coupon').value.trim()&&!appliedCoupon)await applyCheckoutCoupon();if($('#coupon').value.trim()&&!appliedCoupon)throw new Error('Confira o cupom antes de enviar.');const requestId=crypto.randomUUID(),payload={client_request_id:requestId,customer,type:orderType,payment:$('#payment').value,change_for:$('#changeFor').value.trim(),coupon_code:appliedCoupon?.code||'',notes:$('#orderNotes').value.trim(),scheduled_for:$('#scheduleMode')?.value==='schedule'?$('#scheduledFor').value:null,items:cart.map(x=>({product_id:x.product.id,qty:x.qty,addon_ids:x.addons.map(a=>a.id),note:x.note}))};if(orderType==='delivery'){payload.address={street:$('#street').value.trim(),number:$('#number').value.trim(),neighborhood_id:$('#neighborhood').value,complement:$('#complement').value.trim(),reference:$('#reference').value.trim()};if(!payload.address.street||!payload.address.number||!payload.address.neighborhood_id)throw new Error('Preencha o endereço completo.')}btn.disabled=true;btn.textContent='ENVIANDO...';sessionStorage.setItem('caseirao_pending_request',JSON.stringify(payload));const j=await api('create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});sessionStorage.removeItem('caseirao_pending_request');saveCustomerMemory({name:customer.name,phone:phoneMask(customer.phone),...(payload.address||{})});localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:j.tracking_code,phone:customer.phone}));cart=[];updateCartBar();modal(`<div class="sheeth"><h2>Pedido recebido ✅</h2><button class="x" data-close>×</button></div><div class="success"><b>Pedido #${j.order_number}</b><br>Total: <b>${fmt(j.total)}</b>${j.discount?`<br>Desconto: <b>${fmt(j.discount+Number(j.delivery_discount||0))}</b>`:''}<br>Previsão: <b>${esc(j.eta_text||'a confirmar')}</b></div>${j.payment_status==='pending'?'<div class="pixWarning">Pagamento Pix aguardando confirmação. Envie o comprovante pelo WhatsApp.</div>':''}<button id="trackNow" class="primary">ACOMPANHAR PEDIDO</button>`);bindClose();$('#trackNow').onclick=()=>openTracking(j.tracking_code,customer.phone)}catch(e){alert(e.message||String(e));if(btn){btn.disabled=false;btn.textContent='CONFIRMAR E ENVIAR'}}}

const renderCatalogV2=renderCatalog;renderCatalog=function(){renderCatalogV2();(data.products||[]).filter(p=>p.sold_out).forEach(p=>{const b=document.querySelector(`[data-add="${p.id}"]`);if(b){b.disabled=true;b.textContent='ESGOTADO';b.closest('.card')?.classList.add('soldOut')}})};
const closeModalV3=closeModal;closeModal=function(...a){if(customerStatusPoll){clearInterval(customerStatusPoll);customerStatusPoll=null}return closeModalV3(...a)};
async function trackOrder(){try{const code=$('#trackCode').value.trim(),phone=$('#trackPhone').value.trim(),j=await api('track-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tracking_code:code,phone})}),o=j.order,current=o.status,idx=statusFlow.indexOf(current);localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:code,phone}));const steps=current==='cancelado'?`<div class="err"><b>Pedido cancelado</b><br>${esc(o.cancel_reason||'Fale com o Caseirão para mais informações.')}</div>`:statusFlow.map((st,i)=>`<div class="step"><span class="dot ${i<=idx?'done':''}"></span><div><b>${esc(statusLabel[st]||st)}</b>${st===current?'<div class="mini">Status atual</div>':''}</div></div>`).join('');$('#trackResult').innerHTML=`<div class="trackbox"><b>Pedido #${o.order_number}</b><div class="etaCard"><b>🕐 ${esc(o.eta_text||'Previsão a confirmar')}</b><span>${o.estimated_at?'Até aproximadamente '+new Date(o.estimated_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''}</span></div><div class="mini">Pagamento: ${esc(o.payment)} • ${o.payment_status==='confirmed'?'Confirmado':o.payment_status==='pending'?'Aguardando confirmação':'Na entrega'}</div><div class="orderItemsBox">${(o.order_items||[]).map(i=>`<div class="orderItemRow"><b>${i.quantity}x ${esc(i.product_name)}</b>${(i.order_item_addons||[]).map(a=>`<div class="mini">+ ${esc(a.addon_name)}</div>`).join('')}</div>`).join('')}</div><div class="sumrow total"><span>Total</span><b>${fmt(o.total)}</b></div></div><div class="timeline">${steps}</div><div id="customerDeliveryMap"></div>`;loadCustomerDeliveryMap(code,phone);if(!['entregue','cancelado'].includes(current)&&!customerStatusPoll)customerStatusPoll=setInterval(()=>{if($('#trackResult'))trackOrder()},10000)}catch(e){if($('#trackResult'))$('#trackResult').innerHTML=`<div class="err">${esc(e.message)}</div>`}}

async function saveEtaSettings(){const payload={delivery_eta:$('#sDeliveryEta').value,pickup_eta:$('#sPickupEta').value,peak_mode:$('#sPeak').checked,peak_delivery_eta:$('#sPeakDelivery').value,peak_pickup_eta:$('#sPeakPickup').value};const r=await api('admin-delivery-estimates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:sessionStorage.getItem('caseirao_admin_pin')||'',payload})});await opsCall('schedule_setting',{enabled:$('#sSchedule').checked});r.settings.schedule_enabled=$('#sSchedule').checked;return r}
const renderStoreBase=renderStoreAdmin;renderStoreAdmin=function(box){renderStoreBase(box);const s=admin.settings;box.insertAdjacentHTML('afterbegin',`<div class="storeControl"><div class="sectionTitle">Prazos e movimento</div><label class="addon"><input id="sPeak" type="checkbox" ${s.peak_mode?'checked':''}><span><b>Modo pico</b><div class="mini">Mostra prazos maiores aos clientes</div></span></label><label class="addon"><input id="sSchedule" type="checkbox" ${s.schedule_enabled?'checked':''}><span><b>Permitir agendamento</b><div class="mini">Cliente escolhe data e horário</div></span></label><div class="row"><div class="field"><label>Entrega normal</label><input id="sDeliveryEta" class="in" value="${esc(s.delivery_eta||'35–55 min')}"></div><div class="field"><label>Retirada normal</label><input id="sPickupEta" class="in" value="${esc(s.pickup_eta||'20–35 min')}"></div></div><div class="row"><div class="field"><label>Entrega no pico</label><input id="sPeakDelivery" class="in" value="${esc(s.peak_delivery_eta||'60–90 min')}"></div><div class="field"><label>Retirada no pico</label><input id="sPeakPickup" class="in" value="${esc(s.peak_pickup_eta||'35–50 min')}"></div></div><button id="saveEta" class="primary">SALVAR PRAZOS</button></div>`);$('#saveEta').onclick=async()=>{try{const r=await saveEtaSettings();admin.settings=r.settings;data.settings=r.settings;renderStoreAdmin(box);showAppToast('Prazos atualizados.','ok')}catch(e){alert(e.message)}}};

const renderProductsBase=renderProductsAdmin;renderProductsAdmin=function(box){renderProductsBase(box);admin.products.forEach(p=>{const edit=box.querySelector(`[data-editp="${p.id}"]`);if(!edit)return;const b=document.createElement('button');b.className='editbtn';b.textContent=p.sold_out?'LIBERAR':'ESGOTAR';b.onclick=async()=>{await opsCall('set_availability',{kind:'product',id:p.id,sold_out:!p.sold_out});admin=await adminCall('snapshot');renderProductsAdmin(box)};edit.before(b)})};
const renderAddonsBase=renderAddonsAdmin;renderAddonsAdmin=function(box){renderAddonsBase(box);admin.addons.forEach(a=>{const edit=box.querySelector(`[data-a="${a.id}"]`);if(!edit)return;const b=document.createElement('button');b.className='editbtn';b.textContent=a.sold_out?'LIBERAR':'ESGOTAR';b.onclick=async()=>{await opsCall('set_availability',{kind:'addon',id:a.id,sold_out:!a.sold_out});admin=await adminCall('snapshot');renderAddonsAdmin(box)};edit.before(b)})};

const renderOrdersBase=renderOrders;renderOrders=function(box){renderOrdersBase(box);shiftOrders().forEach(o=>{const st=box.querySelector(`[data-oid="${o.id}"]`);const body=st?.closest('.orderBody');if(!body||body.querySelector('.opsOrder'))return;body.insertAdjacentHTML('beforeend',`<details class="opsOrder opsOrderCollapsed"><summary><span>⚙️ <b>Controle operacional</b></span><strong>Abrir</strong></summary><div class="opsOrderContent"><div class="row"><button class="secondary" data-pay="${o.id}">${o.payment_status==='confirmed'?'✓ PAGAMENTO CONFIRMADO':'CONFIRMAR PAGAMENTO'}</button><button class="secondary" data-eta="${o.id}">ALTERAR PREVISÃO</button></div></div></details>`)});box.querySelectorAll('.opsOrder>summary').forEach(s=>s.onclick=()=>{const d=s.parentElement;requestAnimationFrame(()=>{const t=s.querySelector('strong');if(t)t.textContent=d.open?'Fechar':'Abrir'})});box.querySelectorAll('[data-pay]').forEach(b=>b.onclick=async()=>{await opsCall('payment',{order_id:b.dataset.pay,status:'confirmed'});admin=await adminCall('snapshot');renderOrders(box)});box.querySelectorAll('[data-eta]').forEach(b=>b.onclick=async()=>{const value=prompt('Nova previsão em minutos:','30');if(!value)return;await opsCall('order_eta',{order_id:b.dataset.eta,minutes:Number(value),eta_text:`${Number(value)} min`});admin=await adminCall('snapshot');renderOrders(box)})};

const renderCashBase=renderCash;renderCash=async function(box){renderCashBase(box);try{opsCache=await opsCall('snapshot');const kinds={opening:'Abertura',supply:'Suprimento',withdrawal:'Sangria',expense:'Despesa',closing:'Fechamento'},sum=k=>(opsCache.cash_movements||[]).filter(x=>x.kind===k).reduce((s,x)=>s+Number(x.amount||0),0);box.insertAdjacentHTML('beforeend',`<div class="sectionTitle">Movimentos de caixa</div><div class="financeGrid"><div class="financeCard"><span>Suprimentos</span><b>${fmt(sum('supply')+sum('opening'))}</b></div><div class="financeCard"><span>Sangrias</span><b>${fmt(sum('withdrawal'))}</b></div><div class="financeCard"><span>Despesas</span><b>${fmt(sum('expense'))}</b></div></div><div class="row"><select id="cashKind" class="sel"><option value="supply">Suprimento</option><option value="withdrawal">Sangria</option><option value="expense">Despesa</option></select><input id="cashAmount" class="in" inputmode="decimal" placeholder="Valor"></div><input id="cashDescription" class="in" placeholder="Motivo / descrição"><button id="saveCashMove" class="primary" style="margin-top:8px">REGISTRAR MOVIMENTO</button><div class="reportBreak">${(opsCache.cash_movements||[]).slice(0,20).map(x=>`<div class="reportRow"><span>${kinds[x.kind]||x.kind} • ${esc(x.description||'')}</span><b>${fmt(x.amount)}</b></div>`).join('')||'<div class="mini">Nenhum movimento.</div>'}</div>`);$('#saveCashMove').onclick=async()=>{await opsCall('cash_movement',{kind:$('#cashKind').value,amount:num($('#cashAmount').value),description:$('#cashDescription').value});renderCash(box)}}catch(e){box.insertAdjacentHTML('beforeend',`<div class="err">${esc(e.message)}</div>`)}};

const editCouponBase=editCoupon;editCoupon=function(c){editCouponBase(c);c=c||{};const active=$('#cActive')?.closest('label');if(!active)return;active.insertAdjacentHTML('beforebegin',`<div class="row"><div class="field"><label>Limite total</label><input id="cLimit" class="in" type="number" value="${esc(c.usage_limit??'')}"></div><div class="field"><label>Limite por telefone</label><input id="cCustomerLimit" class="in" type="number" value="${esc(c.per_customer_limit??1)}"></div></div>`);$('#saveC').onclick=async()=>{const btn=$('#saveC');try{btn.disabled=true;btn.textContent='SALVANDO...';await adminCall('upsert_coupon',{id:c.id,code:$('#cCode').value.trim(),type:$('#cType').value,value:num($('#cValue').value),min_subtotal:num($('#cMin').value),active:$('#cActive').checked,starts_at:null,ends_at:null,usage_limit:$('#cLimit').value===''?null:Number($('#cLimit').value),per_customer_limit:Number($('#cCustomerLimit').value||1)});admin=await adminCall('snapshot');adminTab='cupons';renderAdmin();showAppToast('Cupom salvo corretamente.','ok')}catch(e){alert(e.message||String(e));btn.disabled=false;btn.textContent='Salvar'}}};


const adminCallCouponBridge=adminCall;adminCall=async function(action='snapshot',payload={},allowRetry=true){if(action==='upsert_coupon'&&Object.prototype.hasOwnProperty.call(payload,'usage_limit'))return opsCall('upsert_coupon_advanced',payload);return adminCallCouponBridge(action,payload,allowRetry)};
/* CRONOMETRO POR PEDIDO + CONFIRMACAO AUTOMATICA */
const preparationStops=()=>{try{return JSON.parse(localStorage.getItem('caseirao_preparation_stops')||'{}')}catch{return{}}};
function savePreparationStop(orderId,time=Date.now()){const stops=preparationStops();stops[String(orderId)]=Number(time)||Date.now();try{localStorage.setItem('caseirao_preparation_stops',JSON.stringify(stops))}catch{}}
function preparationStop(o){const saved=Number(preparationStops()[String(o.id)]||0);if(saved)return saved;return ['pronto','em_rota','entregue','cancelado'].includes(o.status)?Date.parse(o.updated_at||o.created_at):0}
function chronometerText(start,stop=0){const elapsed=Math.max(0,Math.floor(((stop||Date.now())-start)/1000)),hours=Math.floor(elapsed/3600),minutes=Math.floor((elapsed%3600)/60),seconds=elapsed%60;return `${hours?String(hours).padStart(2,'0')+':':''}${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`}
function updateOrderChronometers(){document.querySelectorAll('[data-order-chronometer]').forEach(el=>{const start=Number(el.dataset.start||0),stop=Number(el.dataset.stop||0);if(start)el.querySelector('b').textContent=chronometerText(start,stop)})}
function installOrderChronometers(box=document){if(!admin||!box)return;box.querySelectorAll('details.orderDetailed').forEach(card=>{if(card.querySelector('[data-order-chronometer]'))return;const number=(card.querySelector('.orderNumber')?.textContent||'').replace(/\D/g,''),o=(admin.orders||[]).find(x=>String(x.order_number).replace(/\D/g,'')===number),target=card.querySelector('.summaryRight');if(!o||!target)return;const start=Date.parse(o.created_at),stop=preparationStop(o),timer=document.createElement('span');timer.className='orderChronometer'+(stop?' stopped':'');timer.dataset.orderChronometer='';timer.dataset.start=String(start);timer.dataset.stop=stop?String(stop):'';timer.innerHTML=`<small>${stop?'TEMPO FINAL':'TEMPO DO PEDIDO'}</small><b>${chronometerText(start,stop)}</b>`;target.prepend(timer)});updateOrderChronometers()}
const chronometerStyle=document.createElement('style');chronometerStyle.textContent=`.orderChronometer{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:88px;padding:7px 10px;border:1px solid #80531f;border-radius:11px;background:#2d1e0d;color:#ffd28f;line-height:1}.orderChronometer small{font-size:8px;font-weight:950;letter-spacing:.08em;margin-bottom:5px}.orderChronometer b{font:950 18px/1 ui-monospace,SFMono-Regular,Consolas,monospace;color:#fff}.orderChronometer.stopped{border-color:#286944;background:#112b1d;color:#91efb4}@media(max-width:430px){.orderChronometer{min-width:76px;padding:6px}.orderChronometer b{font-size:16px}.summaryRight{gap:5px}}`;document.head.appendChild(chronometerStyle);
setInterval(updateOrderChronometers,1000);
document.addEventListener('click',event=>{const button=event.target.closest('[data-st="pronto"],[data-kitchen][data-next="pronto"]');if(button)savePreparationStop(button.dataset.oid||button.dataset.kitchen)},true);
const renderOrdersChronometerBase=renderOrders;renderOrders=function(box){renderOrdersChronometerBase(box);box.querySelectorAll('[data-st="confirmado"]').forEach(button=>button.remove());installOrderChronometers(box)};
const adminCallAutoConfirmBase=adminCall;adminCall=async function(action='snapshot',payload={},allowRetry=true){const result=await adminCallAutoConfirmBase(action,payload,allowRetry);if(action==='snapshot'&&result?.orders){const pending=result.orders.filter(o=>o.status==='novo');if(pending.length){await Promise.all(pending.map(o=>adminCallAutoConfirmBase('update_status',{order_id:o.id,status:'confirmado'},allowRetry).catch(()=>null)));pending.forEach(o=>o.status='confirmado')}}return result};

/* CONTROLE DE MESAS E COMANDAS */
const TABLES_KEY='caseirao_tables_v1',TABLE_HISTORY_KEY='caseirao_table_history_v1';
function tableState(){try{const s=JSON.parse(localStorage.getItem(TABLES_KEY)||'null');if(s&&Array.isArray(s.tables))return s}catch{}return{count:12,tables:Array.from({length:12},(_,i)=>({number:i+1,status:'free',customer:'',opened_at:null,orders:[]}))}}
function saveTableState(s){localStorage.setItem(TABLES_KEY,JSON.stringify(s))}
function normalizeTables(s){s.count=Math.max(1,Math.min(50,Number(s.count)||12));for(let i=1;i<=s.count;i++)if(!s.tables.some(t=>Number(t.number)===i))s.tables.push({number:i,status:'free',customer:'',opened_at:null,orders:[]});s.tables=s.tables.filter(t=>Number(t.number)<=s.count);return s}
function tableOrders(table){const ids=new Set((table.orders||[]).map(String));return(admin?.orders||[]).filter(o=>ids.has(String(o.id)))}
function tableTotal(table){return tableOrders(table).filter(o=>o.status!=='cancelado').reduce((sum,o)=>sum+Number(o.total||0),0)}
function tableElapsed(table){if(!table.opened_at)return'';const min=Math.max(0,Math.floor((Date.now()-Date.parse(table.opened_at))/60000));return min<60?`${min} min`:`${Math.floor(min/60)}h ${min%60}min`}
function resetTable(table){table.status='free';table.customer='';table.opened_at=null;table.orders=[]}
function renderTables(box){const state=normalizeTables(tableState()),occupied=state.tables.filter(t=>t.status==='open'),total=occupied.reduce((s,t)=>s+tableTotal(t),0);box.innerHTML=`<div class="tableSummary"><div class="financeCard"><span>Mesas ocupadas</span><b>${occupied.length}/${state.count}</b></div><div class="financeCard"><span>Contas em aberto</span><b>${fmt(total)}</b></div></div><div class="tableToolbar"><div class="operationHint">Toque em uma mesa para abrir, lançar itens, conferir a comanda ou fechar a conta.</div><button id="configureTables" class="secondary">CONFIGURAR MESAS</button></div><div class="tablesGrid">${state.tables.map(t=>`<button class="restaurantTable ${t.status==='open'?'occupied':''}" data-table="${t.number}"><span class="tableIcon">${t.status==='open'?'🍽️':'○'}</span><strong>MESA ${String(t.number).padStart(2,'0')}</strong><small>${t.status==='open'?`${esc(t.customer||'Em atendimento')} • ${tableElapsed(t)}`:'Livre'}</small><b>${t.status==='open'?fmt(tableTotal(t)):'ABRIR'}</b></button>`).join('')}</div>`;box.querySelectorAll('[data-table]').forEach(b=>b.onclick=()=>openTable(Number(b.dataset.table)));$('#configureTables').onclick=()=>configureTables()}
function configureTables(){const state=normalizeTables(tableState()),value=prompt('Quantas mesas existem no Caseirão? (1 a 50)',String(state.count));if(value===null)return;const count=Math.max(1,Math.min(50,Number(value)||0));if(!count)return alert('Informe uma quantidade válida.');if(count<state.count&&state.tables.some(t=>Number(t.number)>count&&t.status==='open'))return alert('Existem mesas abertas acima desse número. Feche-as antes de reduzir.');state.count=count;normalizeTables(state);saveTableState(state);adminTab='mesas';renderAdmin()}
function openTable(number){const state=normalizeTables(tableState()),table=state.tables.find(t=>Number(t.number)===Number(number));if(!table)return;if(table.status!=='open'){const customer=(prompt(`Nome do cliente ou responsável da Mesa ${String(number).padStart(2,'0')}:`,'')||'').trim();if(!customer)return;table.status='open';table.customer=customer;table.opened_at=new Date().toISOString();table.orders=[];saveTableState(state)}renderTableAccount(number)}
function tableOrderRows(table){const orders=tableOrders(table);if(!orders.length)return'<div class="empty cleanEmpty"><b>Comanda vazia</b><span>Lance o primeiro pedido desta mesa.</span></div>';return orders.map(o=>`<details class="tableOrder"><summary><span><b>Pedido #${esc(o.order_number)}</b><small>${new Date(o.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} • ${esc(statusLabel[o.status]||o.status)}</small></span><b>${fmt(o.total)}</b></summary><div>${(o.order_items||[]).map(i=>`<div class="tableItemLine"><span>${Number(i.quantity||1)}x ${esc(i.product_name||'Item')}</span><b>${fmt(Number(i.unit_price||0)*Number(i.quantity||1))}</b></div>`).join('')}${o.notes?`<div class="mini">${esc(o.notes)}</div>`:''}</div></details>`).join('')}
function renderTableAccount(number){const state=normalizeTables(tableState()),table=state.tables.find(t=>Number(t.number)===Number(number));if(!table)return renderAdmin();modal(`<div class="sheeth"><div><h2>Mesa ${String(number).padStart(2,'0')}</h2><div class="adminSub">${esc(table.customer)} • aberta há ${tableElapsed(table)}</div></div><button class="x" id="backToTables">←</button></div><div class="tableAccountTotal"><span>Total da mesa</span><b>${fmt(tableTotal(table))}</b></div><button id="addTableOrder" class="primary">+ LANÇAR ITENS NA MESA</button><div class="sectionTitle">Comanda</div><div id="tableOrderList">${tableOrderRows(table)}</div><div class="tableAccountActions"><button id="printTable" class="secondary">IMPRIMIR CONTA</button><button id="closeTable" class="primary">FECHAR E RECEBER</button></div><button id="cancelTable" class="secondary danger">CANCELAR / LIBERAR MESA</button>`,true);$('#backToTables').onclick=()=>{adminTab='mesas';renderAdmin()};$('#addTableOrder').onclick=()=>openTableOrder(number);$('#printTable').onclick=()=>printTableAccount(number);$('#closeTable').onclick=()=>closeTableAccount(number);$('#cancelTable').onclick=()=>cancelTableAccount(number)}
function openTableOrder(number){const products=(admin?.products||data.products||[]).filter(p=>p.active!==false&&!p.sold_out),quantities=new Map();const total=()=>products.reduce((s,p)=>s+(quantities.get(String(p.id))||0)*priceOf(p),0);modal(`<div class="sheeth"><div><h2>Lançar na Mesa ${String(number).padStart(2,'0')}</h2><div class="adminSub">O pedido seguirá direto para a produção</div></div><button class="x" id="backToTable">←</button></div><input id="tableProductSearch" class="in" placeholder="Buscar produto..."><div id="tableProducts" class="manualProducts">${products.map(p=>`<div class="manualProduct" data-table-product-row data-name="${esc(String(p.name).toLowerCase())}"><div class="grow"><b>${esc(p.name)}</b><span>${fmt(priceOf(p))}</span></div><div class="qty"><button data-tproduct="${p.id}" data-d="-1">−</button><b data-tqty="${p.id}">0</b><button data-tproduct="${p.id}" data-d="1">+</button></div></div>`).join('')}</div><div class="field"><label>Observações desta rodada</label><textarea id="tableOrderNotes" class="ta" placeholder="Ex.: sem cebola, ponto da carne..."></textarea></div><div class="manualFooter"><div><span>Total da rodada</span><b id="tableOrderTotal">${fmt(0)}</b></div><button id="saveTableOrder" class="primary">ENVIAR À PRODUÇÃO</button></div>`,true);$('#backToTable').onclick=()=>renderTableAccount(number);$('#tableProductSearch').oninput=e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('[data-table-product-row]').forEach(row=>row.classList.toggle('hide',!row.dataset.name.includes(q)))};document.querySelectorAll('[data-tproduct]').forEach(b=>b.onclick=()=>{const id=String(b.dataset.tproduct),next=Math.max(0,(quantities.get(id)||0)+Number(b.dataset.d));quantities.set(id,next);$(`[data-tqty="${CSS.escape(id)}"]`).textContent=next;$('#tableOrderTotal').textContent=fmt(total())});$('#saveTableOrder').onclick=async()=>{const btn=$('#saveTableOrder');try{const state=normalizeTables(tableState()),table=state.tables.find(t=>Number(t.number)===Number(number)),items=products.map(p=>({product_id:p.id,qty:quantities.get(String(p.id))||0,addon_ids:[],note:''})).filter(i=>i.qty>0);if(!table||table.status!=='open')throw new Error('Esta mesa não está mais aberta.');if(!items.length)throw new Error('Adicione pelo menos um item.');btn.disabled=true;btn.textContent='ENVIANDO...';const payload={customer:{name:`Mesa ${String(number).padStart(2,'0')} • ${table.customer}`,phone:(data.settings?.whatsapp||'86995653888')},type:'local',payment:'Pendente',change_for:'',coupon_code:'',notes:`[MESA ${String(number).padStart(2,'0')}] ${$('#tableOrderNotes').value.trim()}`.trim(),items};const made=await api('create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});admin=await adminCall('snapshot');const created=(admin.orders||[]).find(o=>String(o.order_number)===String(made.order_number));if(!created)throw new Error('Pedido criado, mas ainda não apareceu na comanda. Toque em atualizar.');table.orders.push(created.id);saveTableState(state);knownOrderIds.add(created.id);renderTableAccount(number);showAppToast(`Pedido #${made.order_number} lançado na Mesa ${number}.`,'ok')}catch(e){alert(e.message||String(e));btn.disabled=false;btn.textContent='ENVIAR À PRODUÇÃO'}}}
function printTableAccount(number){const state=normalizeTables(tableState()),table=state.tables.find(t=>Number(t.number)===Number(number)),orders=table?tableOrders(table).filter(o=>o.status!=='cancelado'):[];if(!table)return;const lines=orders.flatMap(o=>(o.order_items||[]).map(i=>`<tr><td>${Number(i.quantity||1)}x ${esc(i.product_name||'Item')}</td><td>${fmt(Number(i.unit_price||0)*Number(i.quantity||1))}</td></tr>`)).join('');const w=window.open('','_blank','width=420,height=700');if(!w)return alert('Permita a abertura da janela para imprimir.');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Mesa ${number}</title><style>body{font:14px monospace;width:72mm;margin:auto;padding:8px}h2,p{text-align:center}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px dashed #999}td:last-child{text-align:right}.total{font-size:20px;font-weight:bold;text-align:right;margin-top:14px}</style></head><body><h2>O CASEIRÃO BURGER</h2><p>Mesa ${String(number).padStart(2,'0')} • ${esc(table.customer)}<br>${new Date().toLocaleString('pt-BR')}</p><table>${lines}</table><div class="total">TOTAL ${fmt(tableTotal(table))}</div><script>onload=()=>{print();setTimeout(close,500)}<\/script></body></html>`);w.document.close()}
function tableMoneyCents(value){const raw=String(value??'').trim().replace(/R\$|\s/g,'');if(!raw)return 0;const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;const number=Number(normalized.replace(/[^0-9.-]/g,''));return Number.isFinite(number)?Math.round(number*100):0}
function tablePaymentSummary(payments){return payments.length===1?payments[0].method:`Dividido: ${payments.map(p=>`${p.method} ${fmt(p.amount/100)}`).join(' + ')}`}
function openTablePaymentCheckout({title,total,onBack,onConfirm}){const totalCents=Math.round(Number(total||0)*100),payments=[];modal(`<div class="sheeth"><div><h2>${esc(title)}</h2><div class="adminSub">Registre cada valor recebido antes de liberar</div></div><button class="x" id="backTablePayment">←</button></div><div class="splitPaymentTotals"><div><span>Total da conta</span><b>${fmt(totalCents/100)}</b></div><div><span>Já pago</span><b id="tablePaidTotal">${fmt(0)}</b></div><div class="remaining"><span>Falta pagar</span><b id="tableRemaining">${fmt(totalCents/100)}</b></div></div><div class="splitPaymentEntry"><div class="field"><label>Forma de pagamento</label><select id="tablePaymentMethod" class="sel"><option>Pix</option><option>Dinheiro</option><option>Cartão de débito</option><option>Cartão de crédito</option></select></div><div class="field"><label>Valor deste pagamento</label><input id="tablePaymentAmount" class="in" inputmode="decimal" placeholder="R$ 0,00"></div><div id="tableCashReceivedField" class="field hide"><label>Valor entregue em dinheiro</label><input id="tableCashReceived" class="in" inputmode="decimal" placeholder="R$ 0,00"><small id="tableCashChange" class="splitCashChange"></small></div><button id="addTablePayment" class="secondary splitAddPayment">+ ADICIONAR PAGAMENTO</button></div><div class="sectionTitle">Pagamentos registrados</div><div id="tablePaymentsList" class="splitPaymentsList"><div class="empty">Nenhum pagamento registrado.</div></div><div class="field"><label>Observação do fechamento</label><input id="tableCloseNote" class="in" placeholder="Opcional"></div><button id="confirmTablePayments" class="primary" disabled>RECEBA O VALOR RESTANTE</button>`,true);
  const paid=()=>payments.reduce((sum,p)=>sum+p.amount,0),remaining=()=>Math.max(0,totalCents-paid());
  const updateCash=()=>{const cash=$('#tablePaymentMethod').value==='Dinheiro',field=$('#tableCashReceivedField');field.classList.toggle('hide',!cash);if(!cash)return;const amount=tableMoneyCents($('#tablePaymentAmount').value),received=tableMoneyCents($('#tableCashReceived').value),change=Math.max(0,received-amount);$('#tableCashChange').textContent=received?received<amount?'Valor entregue é menor que o pagamento.':`Troco: ${fmt(change/100)}`:''};
  const draw=()=>{const left=remaining();$('#tablePaidTotal').textContent=fmt(paid()/100);$('#tableRemaining').textContent=fmt(left/100);$('#tablePaymentAmount').value=left?(left/100).toFixed(2).replace('.',','):'';$('#tablePaymentsList').innerHTML=payments.length?payments.map((p,i)=>`<div class="splitPaymentRow"><div><b>${esc(p.method)}</b><small>${p.method==='Dinheiro'&&p.cashReceived>p.amount?`Recebido ${fmt(p.cashReceived/100)} • Troco ${fmt((p.cashReceived-p.amount)/100)}`:'Pagamento confirmado'}</small></div><b>${fmt(p.amount/100)}</b><button type="button" data-remove-table-payment="${i}" aria-label="Remover pagamento">×</button></div>`).join(''):'<div class="empty">Nenhum pagamento registrado.</div>';document.querySelectorAll('[data-remove-table-payment]').forEach(button=>button.onclick=()=>{payments.splice(Number(button.dataset.removeTablePayment),1);draw()});const confirm=$('#confirmTablePayments');confirm.disabled=left!==0;confirm.textContent=left===0?'CONFIRMAR E LIBERAR MESA':`FALTA ${fmt(left/100)}`;updateCash()};
  $('#backTablePayment').onclick=onBack;$('#tablePaymentMethod').onchange=updateCash;$('#tablePaymentAmount').oninput=updateCash;$('#tableCashReceived').oninput=updateCash;$('#addTablePayment').onclick=()=>{const method=$('#tablePaymentMethod').value,amount=tableMoneyCents($('#tablePaymentAmount').value),left=remaining(),cashReceived=method==='Dinheiro'?tableMoneyCents($('#tableCashReceived').value):amount;if(amount<=0)return alert('Informe um valor maior que zero.');if(amount>left)return alert(`O pagamento não pode ser maior que o saldo de ${fmt(left/100)}.`);if(method==='Dinheiro'&&cashReceived<amount)return alert('O valor entregue em dinheiro não pode ser menor que o pagamento.');payments.push({method,amount,cashReceived});$('#tableCashReceived').value='';draw()};$('#confirmTablePayments').onclick=async()=>{const button=$('#confirmTablePayments');if(remaining()!==0)return alert(`Ainda falta receber ${fmt(remaining()/100)}.`);try{button.disabled=true;button.textContent='FECHANDO...';await onConfirm({payments:payments.map(p=>({...p})),payment:tablePaymentSummary(payments),note:$('#tableCloseNote').value.trim()})}catch(error){alert(error.message||String(error));button.disabled=false;button.textContent='CONFIRMAR E LIBERAR MESA'}};draw()}
async function closeTableAccount(number){const state=normalizeTables(tableState()),table=state.tables.find(t=>Number(t.number)===Number(number));if(!table)return;const total=tableTotal(table);if(total<=0)return alert('A mesa ainda não possui consumo.');openTablePaymentCheckout({title:`Fechar Mesa ${String(number).padStart(2,'0')}`,total,onBack:()=>renderTableAccount(number),onConfirm:async({payments,payment,note})=>{for(const o of tableOrders(table).filter(o=>o.status!=='cancelado')){await opsCall('payment',{order_id:o.id,status:'confirmed',payment});if(o.status!=='entregue')await adminCall('update_status',{order_id:o.id,status:'entregue'})}const history=JSON.parse(localStorage.getItem(TABLE_HISTORY_KEY)||'[]');history.unshift({table:number,customer:table.customer,opened_at:table.opened_at,closed_at:new Date().toISOString(),payment,payments,total,note,orders:[...table.orders]});localStorage.setItem(TABLE_HISTORY_KEY,JSON.stringify(history.slice(0,300)));resetTable(table);saveTableState(state);admin=await adminCall('snapshot');adminTab='mesas';renderAdmin();showAppToast(`Mesa ${number} fechada. ${payment}.`,'ok')}})}
async function cancelTableAccount(number){const state=normalizeTables(tableState()),table=state.tables.find(t=>Number(t.number)===Number(number));if(!table)return;if(table.orders.length&&!confirm('Cancelar os pedidos vinculados e liberar esta mesa?'))return;if(!table.orders.length&&!confirm('Liberar esta mesa sem consumo?'))return;try{for(const o of tableOrders(table).filter(o=>!['entregue','cancelado'].includes(o.status)))await adminCall('update_status',{order_id:o.id,status:'cancelado',cancel_reason:`Mesa ${number} liberada pelo caixa`});resetTable(table);saveTableState(state);admin=await adminCall('snapshot');adminTab='mesas';renderAdmin()}catch(e){alert(e.message||String(e))}}
const tablesStyle=document.createElement('style');tablesStyle.textContent=`.tableSummary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}.tableToolbar{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;margin:10px 0}.tablesGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.restaurantTable{min-height:142px;border:1px solid #303741;background:linear-gradient(145deg,#171c22,#11151a);color:#fff;border-radius:17px;padding:14px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}.restaurantTable .tableIcon{font-size:25px}.restaurantTable strong{font-size:15px}.restaurantTable small{color:#89939f;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.restaurantTable>b{margin-top:5px;color:#96efb6}.restaurantTable.occupied{border-color:#b66b25;background:linear-gradient(145deg,#38220f,#1d160f);box-shadow:inset 0 0 0 1px rgba(255,177,83,.1)}.restaurantTable.occupied>b{color:#ffd18a}.tableAccountTotal{border:1px solid #b66b25;background:#2b1d10;border-radius:16px;padding:15px;margin:10px 0;display:flex;justify-content:space-between;align-items:center}.tableAccountTotal span{color:#d4b996;font-weight:850}.tableAccountTotal b{font-size:25px}.tableOrder{border:1px solid var(--line);border-radius:13px;background:#14181e;margin:8px 0;padding:11px}.tableOrder summary{display:flex;justify-content:space-between;gap:10px;cursor:pointer}.tableOrder summary span{display:flex;flex-direction:column}.tableOrder summary small{color:var(--muted);margin-top:3px}.tableItemLine{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #282e36;margin-top:8px}.tableAccountActions{display:grid;grid-template-columns:1fr 1.4fr;gap:9px;margin:14px 0 9px}@media(max-width:700px){.tablesGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.tableToolbar{grid-template-columns:1fr}.restaurantTable{min-height:126px}.tableSummary{grid-template-columns:1fr 1fr}}@media(max-width:410px){.tablesGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}`;document.head.appendChild(tablesStyle);
const splitPaymentStyle=document.createElement('style');splitPaymentStyle.textContent=`.splitPaymentTotals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0 15px}.splitPaymentTotals>div{padding:12px;border:1px solid #dfe3e7;border-radius:13px;background:#fff}.splitPaymentTotals span{display:block;color:#69717a;font-size:10px;font-weight:900;text-transform:uppercase}.splitPaymentTotals b{display:block;margin-top:5px;color:#202327;font-size:18px}.splitPaymentTotals .remaining{border-color:#efc39f;background:#fff7f0}.splitPaymentTotals .remaining b{color:#bd4a12}.splitPaymentEntry{padding:12px;border:1px solid #dfe3e7;border-radius:14px;background:#fff}.splitAddPayment{width:100%;min-height:46px}.splitPaymentsList{display:grid;gap:7px;margin:8px 0 16px}.splitPaymentRow{display:grid;grid-template-columns:minmax(0,1fr) auto 38px;gap:10px;align-items:center;padding:11px 10px;border:1px solid #dfe3e7;border-radius:12px;background:#fff}.splitPaymentRow>div{min-width:0}.splitPaymentRow small{display:block;margin-top:3px;color:#747b83;font-size:10px}.splitPaymentRow>button{width:34px;height:34px;border:0;border-radius:9px;background:#fff0f1;color:#bd3037;font-size:21px;font-weight:900}.splitCashChange{display:block;margin-top:6px;color:#35704c;font-weight:850}.splitPaymentTotals+.splitPaymentEntry .field:first-child{margin-top:0}@media(max-width:480px){.splitPaymentTotals{grid-template-columns:1fr 1fr}.splitPaymentTotals .remaining{grid-column:1/-1}.splitPaymentTotals>div{padding:10px}.splitPaymentTotals b{font-size:17px}}`;document.head.appendChild(splitPaymentStyle);
const renderAdminTablesBase=renderAdmin;renderAdmin=function(){renderAdminTablesBase();const bar=document.querySelector('.admbar');if(bar&&!bar.querySelector('[data-tab="mesas"]')){const btn=document.createElement('button');btn.dataset.tab='mesas';btn.className=adminTab==='mesas'?'on':'';btn.textContent='Mesas';btn.onclick=()=>{adminTab='mesas';renderAdmin()};const caixa=bar.querySelector('[data-tab="caixa"]');caixa?caixa.before(btn):bar.appendChild(btn)}if(adminTab==='mesas'){const box=$('#admContent');if(box)renderTables(box)}};
const renderAdminTabTablesBase=renderAdminTab;renderAdminTab=function(){if(adminTab==='mesas'){const box=$('#admContent');if(box)renderTables(box);return}renderAdminTabTablesBase()};

/* ACESSO INDIVIDUAL DOS FUNCIONARIOS + MESAS SINCRONIZADAS */
let employeeAdminCache=null,employeeSnapshot=null,employeeReadyPoll=null;
const employeeToken=()=>sessionStorage.getItem('caseirao_employee_token')||'';
async function employeeApi(action,payload={},adminMode=false){return api('employee-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload,...(adminMode?{pin:sessionStorage.getItem('caseirao_admin_pin')||''}:{token:employeeToken()})})})}
async function loadEmployeeAdmin(){employeeAdminCache=await employeeApi('admin_snapshot',{},true);return employeeAdminCache}
function remoteSessionForTable(id,cache=employeeAdminCache){return(cache?.sessions||[]).find(s=>String(s.restaurant_table_id)===String(id)&&s.status==='open')}
function remoteSessionTotal(s){return(s?.orders||[]).filter(o=>o.status!=='cancelado').reduce((a,o)=>a+Number(o.total||0),0)}
async function renderRemoteTables(box){try{box.innerHTML='<div class="notice">Carregando mesas...</div>';const c=await loadEmployeeAdmin(),occupied=c.sessions||[],total=occupied.reduce((a,s)=>a+remoteSessionTotal(s),0);box.innerHTML=`<div class="tableSummary"><div class="financeCard"><span>Mesas ocupadas</span><b>${occupied.length}/${(c.tables||[]).length}</b></div><div class="financeCard"><span>Contas em aberto</span><b>${fmt(total)}</b></div></div><div class="tableToolbar"><div class="operationHint">Mesas sincronizadas: os lançamentos feitos pelos funcionários aparecem aqui em todos os aparelhos.</div><button id="configureRemoteTables" class="secondary">CONFIGURAR MESAS</button></div><div class="tablesGrid">${(c.tables||[]).map(t=>{const s=remoteSessionForTable(t.id,c);return`<button class="restaurantTable ${s?'occupied':''}" data-remote-table="${t.id}"><span class="tableIcon">${s?'🍽️':'○'}</span><strong>MESA ${String(t.table_number).padStart(2,'0')}</strong><small>${s?`${esc(s.customer_name)} • ${esc(s.employee_accounts?.name||'ADM')}`:'Livre'}</small><b>${s?fmt(remoteSessionTotal(s)):'ABRIR'}</b></button>`}).join('')}</div>`;box.querySelectorAll('[data-remote-table]').forEach(b=>b.onclick=()=>openRemoteAdminTable(b.dataset.remoteTable));$('#configureRemoteTables').onclick=async()=>{const n=prompt('Quantas mesas existem no Caseirão?',String((c.tables||[]).length));if(n===null)return;try{await employeeApi('admin_set_table_count',{count:Number(n)},true);renderRemoteTables(box)}catch(e){alert(e.message)}}}catch(e){box.innerHTML=`<div class="err">${esc(e.message||String(e))}</div>`}}
async function openRemoteAdminTable(tableId){if(!employeeAdminCache)await loadEmployeeAdmin();const t=(employeeAdminCache.tables||[]).find(x=>String(x.id)===String(tableId)),s=remoteSessionForTable(tableId);if(!t)return;if(!s){const customer=(prompt(`Responsável da Mesa ${String(t.table_number).padStart(2,'0')}:`,'')||'').trim();if(!customer)return;await employeeApi('admin_open_table',{table_id:t.id,customer_name:customer},true);await loadEmployeeAdmin();return openRemoteAdminTable(tableId)}renderRemoteAdminAccount(t,s)}
function remoteOrdersHtml(s){const orders=s.orders||[];return orders.length?orders.map(o=>`<details class="tableOrder"><summary><span><b>Pedido #${esc(o.order_number)}</b><small>${esc(statusLabel[o.status]||o.status)}${o.employee_id?' • funcionário':''}</small></span><b>${fmt(o.total)}</b></summary><div>${(o.order_items||[]).map(i=>`<div class="tableItemLine"><span>${Number(i.quantity||1)}x ${esc(i.product_name)}</span><b>${fmt(i.line_total)}</b></div>`).join('')}${o.notes?`<div class="mini">${esc(o.notes)}</div>`:''}</div></details>`).join(''):'<div class="empty cleanEmpty"><b>Comanda vazia</b><span>Aguardando lançamento.</span></div>'}
function renderRemoteAdminAccount(t,s){modal(`<div class="sheeth"><div><h2>Mesa ${String(t.table_number).padStart(2,'0')}</h2><div class="adminSub">${esc(s.customer_name)}</div></div><button class="x" id="backRemoteTables">←</button></div><div class="tableAccountTotal"><span>Total da mesa</span><b>${fmt(remoteSessionTotal(s))}</b></div><button id="adminAddRemoteOrder" class="primary">+ LANÇAR ITENS</button><div class="sectionTitle">Comanda sincronizada</div>${remoteOrdersHtml(s)}<div class="tableAccountActions"><button id="adminPrintRemote" class="secondary">IMPRIMIR CONTA</button><button id="adminCloseRemote" class="primary">FECHAR E RECEBER</button></div><button id="adminCancelRemote" class="secondary danger">CANCELAR / LIBERAR MESA</button>`,true);$('#backRemoteTables').onclick=()=>{adminTab='mesas';renderAdmin()};$('#adminAddRemoteOrder').onclick=()=>openRemoteOrderForm(t,s,true);$('#adminPrintRemote').onclick=()=>printRemoteTable(t,s);$('#adminCloseRemote').onclick=()=>openRemoteClose(t,s);$('#adminCancelRemote').onclick=async()=>{if(!confirm('Cancelar pedidos em aberto e liberar esta mesa?'))return;await employeeApi('admin_cancel_table',{table_session_id:s.id},true);admin=await adminCall('snapshot');adminTab='mesas';renderAdmin()}}
function printRemoteTable(t,s){const lines=(s.orders||[]).filter(o=>o.status!=='cancelado').flatMap(o=>(o.order_items||[]).map(i=>`<tr><td>${Number(i.quantity||1)}x ${esc(i.product_name)}</td><td>${fmt(i.line_total)}</td></tr>`)).join(''),w=window.open('','_blank','width=420,height=700');if(!w)return alert('Permita a janela de impressão.');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px monospace;width:72mm;margin:auto;padding:8px}h2,p{text-align:center}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px dashed #999}td:last-child{text-align:right}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:14px}</style></head><body><h2>O CASEIRÃO BURGER</h2><p>Mesa ${String(t.table_number).padStart(2,'0')} • ${esc(s.customer_name)}</p><table>${lines}</table><div class="total">TOTAL ${fmt(remoteSessionTotal(s))}</div><script>onload=()=>{print();setTimeout(close,500)}<\/script></body></html>`);w.document.close()}
function openRemoteClose(t,s){const total=remoteSessionTotal(s);if(total<=0)return alert('A mesa ainda não possui consumo.');openTablePaymentCheckout({title:`Fechar Mesa ${String(t.table_number).padStart(2,'0')}`,total,onBack:()=>renderRemoteAdminAccount(t,s),onConfirm:async({payments,payment,note})=>{const paymentDetails=payments.map(p=>`${p.method}: ${fmt(p.amount/100)}${p.method==='Dinheiro'&&p.cashReceived>p.amount?` (recebido ${fmt(p.cashReceived/100)}, troco ${fmt((p.cashReceived-p.amount)/100)})`:''}`).join(' | '),closingNote=[note,payments.length>1?`Pagamentos: ${paymentDetails}`:''].filter(Boolean).join(' — ');await employeeApi('admin_close_table',{table_session_id:s.id,payment,note:closingNote,payments:payments.map(p=>({method:p.method,amount:p.amount/100,cash_received:p.cashReceived/100,change:(p.cashReceived-p.amount)/100}))},true);admin=await adminCall('snapshot');adminTab='mesas';renderAdmin();showAppToast(`Mesa ${t.table_number} fechada. ${payment}.`,'ok')}})}
async function renderEmployees(box){try{box.innerHTML='<div class="notice">Carregando funcionários...</div>';const c=await loadEmployeeAdmin();box.innerHTML=`<div class="operationHint">Cada funcionário recebe login e senha próprios. Escolha se o acesso será para atendimento das mesas ou somente para a embalagem.</div><button id="newEmployee" class="primary" style="margin:12px 0">+ CADASTRAR FUNCIONÁRIO</button><div>${(c.employees||[]).map(e=>`<div class="tableitem"><div class="grow"><b>${esc(e.name)}</b><div class="mini">Login: ${esc(e.username)} • ${e.role==='embalagem'?'Embalagem':'Atendimento'} • ${e.active?'Ativo':'Bloqueado'}${e.last_login_at?' • último acesso '+new Date(e.last_login_at).toLocaleString('pt-BR'):''}</div></div><button class="editbtn" data-edit-employee="${e.id}">EDITAR</button></div>`).join('')||'<div class="empty">Nenhum funcionário cadastrado.</div>'}</div>`;$('#newEmployee').onclick=()=>editEmployee();box.querySelectorAll('[data-edit-employee]').forEach(b=>b.onclick=()=>editEmployee((c.employees||[]).find(e=>String(e.id)===String(b.dataset.editEmployee))))}catch(e){box.innerHTML=`<div class="err">${esc(e.message)}</div>`}}
function editEmployee(e={}){modal(`<div class="sheeth"><div><h2>${e.id?'Editar funcionário':'Novo funcionário'}</h2><div class="adminSub">Acesso restrito a mesas e pedidos</div></div><button class="x" id="backEmployees">←</button></div><div class="field"><label>Nome do funcionário</label><input id="employeeName" class="in" value="${esc(e.name||'')}"></div><div class="field"><label>Login</label><input id="employeeUsername" class="in" autocapitalize="none" value="${esc(e.username||'')}"></div><div class="field"><label>Tipo de acesso</label><select id="employeeRole" class="sel"><option value="atendimento" ${(e.role||'atendimento')==='atendimento'?'selected':''}>Atendimento — mesas e pedidos</option><option value="embalagem" ${e.role==='embalagem'?'selected':''}>Embalagem — somente pedido no ponto</option></select></div><div class="field"><label>${e.id?'Nova senha (deixe vazia para manter)':'Senha (mínimo 6 caracteres)'}</label><input id="employeePassword" class="in" type="password" autocomplete="new-password"></div><label class="addon"><input id="employeeActive" type="checkbox" ${e.active!==false?'checked':''}><span><b>Acesso ativo</b><div class="mini">Desmarque para bloquear imediatamente.</div></span></label><button id="saveEmployee" class="primary">SALVAR FUNCIONÁRIO</button>${e.id?'<button id="blockEmployee" class="secondary danger" style="margin-top:9px">BLOQUEAR ACESSO</button>':''}`,true);$('#backEmployees').onclick=()=>{adminTab='funcionarios';renderAdmin()};$('#saveEmployee').onclick=async()=>{const b=$('#saveEmployee');try{b.disabled=true;await employeeApi('admin_save_employee',{id:e.id||'',name:$('#employeeName').value,username:$('#employeeUsername').value,password:$('#employeePassword').value,role:$('#employeeRole').value,active:$('#employeeActive').checked},true);adminTab='funcionarios';renderAdmin();showAppToast('Funcionário salvo.','ok')}catch(x){alert(x.message);b.disabled=false}};if(e.id)$('#blockEmployee').onclick=async()=>{if(!confirm('Bloquear o acesso deste funcionário?'))return;await employeeApi('admin_delete_employee',{id:e.id},true);adminTab='funcionarios';renderAdmin()}}
function openEmployeeLogin(){modal(`<div class="sheeth"><div><h2>Acesso da equipe</h2><div class="adminSub">Somente atendimento, mesas e lançamento de pedidos</div></div><button class="x" data-close>×</button></div><div class="employeeLoginCard"><div class="field"><label>Login</label><input id="employeeLogin" class="in" autocapitalize="none" autocomplete="username"></div><div class="field"><label>Senha</label><input id="employeePass" class="in" type="password" autocomplete="current-password"></div><button id="employeeEnter" class="primary">ENTRAR</button><div id="employeeLoginError"></div></div>`,true);bindClose();$('#employeeEnter').onclick=async()=>{const b=$('#employeeEnter');try{b.disabled=true;b.textContent='ENTRANDO...';const r=await api('employee-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',payload:{username:$('#employeeLogin').value,password:$('#employeePass').value}})});sessionStorage.setItem('caseirao_employee_token',r.token);await openTeamEmployeePanel()}catch(e){sessionStorage.removeItem('caseirao_employee_token');$('#employeeLoginError').innerHTML=`<div class="err" style="margin-top:10px">${esc(e.message)}</div>`;b.disabled=false;b.textContent='ENTRAR'}}}
function isDispatcherEmployee(snapshot){return String(snapshot?.employee?.role||'').trim().toLowerCase()==='embalagem'}
async function openDispatcherPanel(){try{employeeSnapshot=await employeeApi('employee_snapshot');if(!isDispatcherEmployee(employeeSnapshot))throw new Error('Este login não pertence à despachante. Use um funcionário com a função Embalagem.');renderPackagingPanel()}catch(e){sessionStorage.removeItem('caseirao_employee_token');employeeSnapshot=null;openDispatcherLogin();setTimeout(()=>alert(e.message),50)}}
function openDispatcherLogin(){modal(`<div class="sheeth"><div><h2>Área da despachante</h2><div class="adminSub">Acesso exclusivo da embalagem</div></div><button class="x" data-close>×</button></div><div class="employeeLoginCard"><div class="employeeLimit">📦 Entre com o funcionário cadastrado na função <b>Embalagem</b>.</div><div class="field"><label>Login da despachante</label><input id="dispatcherLogin" class="in" autocapitalize="none" autocomplete="username"></div><div class="field"><label>Senha</label><input id="dispatcherPass" class="in" type="password" autocomplete="current-password"></div><button id="dispatcherEnter" class="primary">ENTRAR NA DESPACHANTE</button><div id="dispatcherLoginError"></div></div>`,true);bindClose();$('#dispatcherEnter').onclick=async()=>{const b=$('#dispatcherEnter');try{b.disabled=true;b.textContent='ENTRANDO...';const r=await api('employee-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',payload:{username:$('#dispatcherLogin').value,password:$('#dispatcherPass').value}})});sessionStorage.setItem('caseirao_employee_token',r.token);employeeSnapshot=await employeeApi('employee_snapshot');if(!isDispatcherEmployee(employeeSnapshot))throw new Error('Esse usuário não está cadastrado na função Embalagem.');renderPackagingPanel()}catch(e){sessionStorage.removeItem('caseirao_employee_token');employeeSnapshot=null;$('#dispatcherLoginError').innerHTML=`<div class="err" style="margin-top:10px">${esc(e.message)}</div>`;b.disabled=false;b.textContent='ENTRAR NA DESPACHANTE'}}}
async function openEmployeePanel(){try{employeeSnapshot=await employeeApi('employee_snapshot');renderEmployeePanel()}catch(e){sessionStorage.removeItem('caseirao_employee_token');openEmployeeLogin();setTimeout(()=>alert(e.message),50)}}
async function openTeamEmployeePanel(){employeeSnapshot=await employeeApi('employee_snapshot');if(isDispatcherEmployee(employeeSnapshot))throw new Error('Este usuário pertence à Embalagem. Entre pelo botão Área da despachante.');return renderEmployeePanel()}
function packagingItemsHtml(order){return(order.order_items||[]).map(item=>`<div class="packItem"><b>${Number(item.quantity||1)}x ${esc(item.product_name)}</b>${(item.order_item_addons||[]).length?`<small>+ ${item.order_item_addons.map(a=>esc(a.addon_name)).join(', ')}</small>`:''}${item.note?`<small class="packNote">OBS: ${esc(item.note)}</small>`:''}</div>`).join('')}
function renderPackagingPanel(){const c=employeeSnapshot,orders=c.orders||[];if(employeeReadyPoll)clearInterval(employeeReadyPoll);modal(`<div class="sheeth adminHead"><div class="grow"><h2>Embalagem • ${esc(c.employee.name)}</h2><div class="adminSub">Avise a central quando o pedido estiver no ponto</div></div><button id="employeeLogout" class="secondary adminLogout">Sair</button></div><div class="employeeLimit">🔒 Este acesso mostra somente os pedidos em produção e o botão de aviso.</div><div class="packQueue">${orders.length?orders.map(o=>`<article class="packOrder"><div class="packOrderTop"><strong>PEDIDO #${esc(o.order_number)}</strong><span>${o.table_number?`MESA ${String(o.table_number).padStart(2,'0')}`:o.type==='counter'?'BALCÃO':/^\[BALCÃO\]/i.test(String(o.notes||''))?'BALCÃO':o.type==='pickup'?'RETIRADA':o.type==='local'?'LOCAL':'ENTREGA'}</span></div><div class="packItems">${packagingItemsHtml(o)}</div>${o.notes?`<div class="packGeneralNote">OBSERVAÇÃO: ${esc(o.notes)}</div>`:''}<button class="packReadyBtn" data-pack-ready="${esc(o.id)}">✅ PEDIDO NO PONTO</button></article>`).join(''):`<div class="packEmpty"><b>✓ Nenhum pedido aguardando</b><span>Os próximos pedidos aparecerão automaticamente.</span></div>`}</div>`,true);$('#employeeLogout').onclick=async()=>{if(employeeReadyPoll)clearInterval(employeeReadyPoll);await employeeApi('logout').catch(()=>{});sessionStorage.removeItem('caseirao_employee_token');employeeSnapshot=null;openDispatcherLogin()};document.querySelectorAll('[data-pack-ready]').forEach(button=>button.onclick=async()=>{if(!confirm('Confirmar que este pedido está no ponto?'))return;try{button.disabled=true;button.textContent='AVISANDO A CENTRAL...';const result=await employeeApi('mark_order_ready',{order_id:button.dataset.packReady});if(result?.success===false)throw new Error(result.error||'A central não confirmou a atualização.');employeeSnapshot=await employeeApi('employee_snapshot');showAppToast('Central avisada: pedido no ponto.','ok');renderPackagingPanel()}catch(e){button.disabled=false;button.textContent='✅ PEDIDO NO PONTO';alert(e.message)}});employeeReadyPoll=setInterval(async()=>{if(document.hidden||!sessionStorage.getItem('caseirao_employee_token'))return;try{const fresh=await employeeApi('employee_snapshot');if((fresh.employee?.role||'atendimento')!=='embalagem')return;const before=(employeeSnapshot?.orders||[]).map(o=>o.id+':'+o.status).join('|'),after=(fresh.orders||[]).map(o=>o.id+':'+o.status).join('|');employeeSnapshot=fresh;if(before!==after)renderPackagingPanel()}catch{}},3500)}
function renderEmployeePanel(){const c=employeeSnapshot;if((c.employee?.role||'atendimento')==='embalagem')return renderPackagingPanel();if(employeeReadyPoll){clearInterval(employeeReadyPoll);employeeReadyPoll=null}const occupied=c.sessions||[];modal(`<div class="sheeth adminHead"><div class="grow"><h2>Atendimento • ${esc(c.employee.name)}</h2><div class="adminSub">Mesas e lançamento de pedidos</div></div><button id="employeeLogout" class="secondary adminLogout">Sair</button></div><div class="employeeLimit">🔒 Acesso restrito: caixa, faturamento, relatórios e configurações não estão disponíveis.</div><div class="tablesGrid" style="margin-top:12px">${(c.tables||[]).map(t=>{const s=remoteSessionForTable(t.id,c);return`<button class="restaurantTable ${s?'occupied':''}" data-employee-table="${t.id}"><span class="tableIcon">${s?'🍽️':'○'}</span><strong>MESA ${String(t.table_number).padStart(2,'0')}</strong><small>${s?esc(s.customer_name):'Livre'}</small><b>${s?fmt(remoteSessionTotal(s)):'ABRIR'}</b></button>`}).join('')}</div>`,true);$('#employeeLogout').onclick=async()=>{await employeeApi('logout').catch(()=>{});sessionStorage.removeItem('caseirao_employee_token');openEmployeeLogin()};document.querySelectorAll('[data-employee-table]').forEach(b=>b.onclick=()=>openEmployeeTable(b.dataset.employeeTable))}
async function openEmployeeTable(tableId){const c=employeeSnapshot,t=(c.tables||[]).find(x=>String(x.id)===String(tableId));let s=remoteSessionForTable(tableId,c);if(!s){const customer=(prompt(`Responsável da Mesa ${String(t.table_number).padStart(2,'0')}:`,'')||'').trim();if(!customer)return;await employeeApi('open_table',{table_id:t.id,customer_name:customer});employeeSnapshot=await employeeApi('employee_snapshot');s=remoteSessionForTable(tableId,employeeSnapshot)}modal(`<div class="sheeth"><div><h2>Mesa ${String(t.table_number).padStart(2,'0')}</h2><div class="adminSub">${esc(s.customer_name)}</div></div><button class="x" id="backEmployeePanel">←</button></div><div class="tableAccountTotal"><span>Total lançado</span><b>${fmt(remoteSessionTotal(s))}</b></div><button id="employeeAddOrder" class="primary">+ LANÇAR PEDIDO</button><div class="sectionTitle">Comanda</div>${remoteOrdersHtml(s)}<div class="tableAccountActions"><button id="employeeBackTables" class="secondary">VOLTAR ÀS MESAS</button><button id="employeeCloseTable" class="primary">FECHAR E RECEBER</button></div><div class="employeeLimit">O atendente pode receber a conta e liberar a mesa. Confira os valores antes de confirmar.</div>`,true);$('#backEmployeePanel').onclick=renderEmployeePanel;$('#employeeBackTables').onclick=renderEmployeePanel;$('#employeeAddOrder').onclick=()=>openRemoteOrderForm(t,s,false);$('#employeeCloseTable').onclick=()=>openEmployeeClose(t,s)}
function openEmployeeClose(t,s){const total=remoteSessionTotal(s);if(total<=0)return alert('A mesa ainda não possui consumo.');openTablePaymentCheckout({title:`Fechar Mesa ${String(t.table_number).padStart(2,'0')}`,total,onBack:()=>openEmployeeTable(t.id),onConfirm:async({payments,note})=>{await employeeApi('close_table',{table_session_id:s.id,note,payments:payments.map(p=>({method:p.method,amount:p.amount/100,cash_received:p.cashReceived/100,change:Math.max(0,(p.cashReceived-p.amount)/100)}))});employeeSnapshot=await employeeApi('employee_snapshot');renderEmployeePanel();showAppToast(`Mesa ${t.table_number} recebida e liberada com sucesso.`,'ok')}})}
function operationalGroup(p){const category=String(p.category||'').toLowerCase(),name=String(p.name||'').toLowerCase();if(category.includes('hamb'))return'Hambúrgueres';if(category.includes('combo'))return'Combos';if(category.includes('batata'))return'Batatas';if(name.includes('suco'))return'Sucos';if(name==='água'||name==='agua'||name.includes('água ')||name.includes('agua '))return'Água';if(category.includes('bebida')||name.includes('coca')||name.includes('guaran')||name.includes('fanta')||name.includes('pepsi')||name.includes('papsi')||name.includes('refri'))return'Bebidas';return'Outros'}
const operationalGroupOrder=['Hambúrgueres','Combos','Bebidas','Batatas','Sucos','Água','Outros'];
function operationalCatalogHtml(products){return operationalGroupOrder.map(group=>{const rows=products.filter(p=>operationalGroup(p)===group);if(!rows.length)return'';return`<section class="employeeProductGroup" data-product-group><div class="employeeGroupTitle"><span>${group==='Hambúrgueres'?'🍔':group==='Combos'?'🥤':group==='Bebidas'?'🧊':group==='Batatas'?'🍟':group==='Sucos'?'🍹':group==='Água'?'💧':'•'}</span><b>${group}</b><small>${rows.length} itens</small></div><div class="employeeProductGrid">${rows.map(p=>`<div class="employeeProductCard" data-rprow data-name="${esc((String(p.name)+' '+group).toLowerCase())}"><div class="employeeProductPhoto">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:'<span>CB</span>'}</div><div class="employeeProductInfo"><b>${esc(p.name)}</b><span>${fmt(priceOf(p))}</span></div><div class="qty employeeProductQty"><button data-rproduct="${p.id}" data-d="-1" aria-label="Diminuir ${esc(p.name)}">−</button><b data-rqty="${p.id}">0</b><button data-rproduct="${p.id}" data-d="1" aria-label="Adicionar ${esc(p.name)}">+</button></div><div class="unitNotes" data-unit-notes="${p.id}"></div></div>`).join('')}</div></section>`}).join('')}
function filterOperationalCatalog(value){const term=String(value||'').trim().toLowerCase();document.querySelectorAll('[data-rprow]').forEach(row=>row.classList.toggle('hide',!row.dataset.name.includes(term)));document.querySelectorAll('[data-product-group]').forEach(group=>group.classList.toggle('hide',!group.querySelector('[data-rprow]:not(.hide)')))}
function renderUnitNotes(productId,productName,quantity,notes){const box=document.querySelector(`[data-unit-notes="${CSS.escape(String(productId))}"]`);if(!box)return;const saved=notes.get(String(productId))||[];while(saved.length<quantity)saved.push('');notes.set(String(productId),saved);box.innerHTML=quantity?`<div class="unitNotesTitle">OBSERVAÇÃO POR UNIDADE</div>${Array.from({length:quantity},(_,i)=>`<label class="unitNoteRow"><span>${esc(productName)} ${i+1}</span><input class="in" data-unit-note="${productId}" data-unit-index="${i}" value="${esc(saved[i]||'')}" placeholder="${i===0?'Ex.: sem verdura, sem molho...':'Ex.: completo ou outra alteração'}"></label>`).join('')}`:'';box.querySelectorAll('[data-unit-note]').forEach(input=>input.oninput=e=>{const list=notes.get(String(productId))||[];list[Number(e.target.dataset.unitIndex)]=e.target.value;notes.set(String(productId),list)})}
function openRemoteOrderForm(t,s,adminMode){const products=(adminMode?(admin?.products||data.products||[]):(employeeSnapshot?.products||[])).filter(p=>p.active!==false&&!p.sold_out),q=new Map(),unitNotes=new Map(),total=()=>products.reduce((a,p)=>a+(q.get(String(p.id))||0)*priceOf(p),0);modal(`<div class="sheeth"><div><h2>Mesa ${String(t.table_number).padStart(2,'0')}</h2><div class="adminSub">Escolha os produtos por categoria</div></div><button class="x" id="backRemoteOrder">←</button></div><div class="employeeProductSearch"><span>⌕</span><input id="remoteProductSearch" class="in" placeholder="Buscar lanche, bebida, batata..."></div><div class="employeeCatalog">${operationalCatalogHtml(products)}</div><div class="field"><label>Observação geral da mesa</label><textarea id="remoteOrderNotes" class="ta" placeholder="Opcional: recado geral para toda a rodada"></textarea></div><div class="manualFooter"><div><span>Total</span><b id="remoteOrderTotal">${fmt(0)}</b></div><button id="saveRemoteOrder" class="primary">ENVIAR À PRODUÇÃO</button></div>`,true);$('#backRemoteOrder').onclick=()=>adminMode?renderRemoteAdminAccount(t,s):openEmployeeTable(t.id);$('#remoteProductSearch').oninput=e=>filterOperationalCatalog(e.target.value);document.querySelectorAll('[data-rproduct]').forEach(b=>b.onclick=()=>{const id=String(b.dataset.rproduct),n=Math.max(0,(q.get(id)||0)+Number(b.dataset.d)),product=products.find(p=>String(p.id)===id);q.set(id,n);const counter=$(`[data-rqty="${CSS.escape(id)}"]`);counter.textContent=n;counter.closest('.employeeProductCard')?.classList.toggle('selected',n>0);renderUnitNotes(id,product?.name||'Item',n,unitNotes);$('#remoteOrderTotal').textContent=fmt(total())});$('#saveRemoteOrder').onclick=async()=>{const b=$('#saveRemoteOrder'),items=products.flatMap(p=>{const qty=q.get(String(p.id))||0,notes=unitNotes.get(String(p.id))||[];return Array.from({length:qty},(_,i)=>({product_id:p.id,qty:1,addon_ids:[],note:String(notes[i]||'').trim()}))});if(!items.length)return alert('Adicione pelo menos um item.');try{b.disabled=true;b.textContent='ENVIANDO...';if(adminMode){alert('Para lançar como administrador, use temporariamente um acesso de funcionário. O fechamento continua exclusivo do ADM.');b.disabled=false;b.textContent='ENVIAR À PRODUÇÃO';return}await employeeApi('create_table_order',{table_session_id:s.id,items,notes:$('#remoteOrderNotes').value,phone:data.settings?.whatsapp||'86995653888'});employeeSnapshot=await employeeApi('employee_snapshot');showAppToast(`Pedido lançado na Mesa ${t.table_number}.`,'ok');openEmployeeTable(t.id)}catch(e){alert(e.message);b.disabled=false;b.textContent='ENVIAR À PRODUÇÃO'}}}
openManualOrder=function(){let manualType='pickup';const products=(admin?.products||data.products||[]).filter(p=>p.active!==false&&!p.sold_out),quantities=new Map(),unitNotes=new Map(),total=()=>products.reduce((sum,p)=>sum+(quantities.get(String(p.id))||0)*priceOf(p),0);const drawAddress=()=>{const box=$('#manualAddress');if(!box)return;box.innerHTML=manualType==='delivery'?`<div class="manualSectionTitle">ENDEREÇO DA ENTREGA</div><div class="row"><div class="field"><label>Rua / Avenida</label><input id="mStreet" class="in"></div><div class="field"><label>Número</label><input id="mNumber" class="in"></div></div><div class="field"><label>Bairro</label><select id="mNeighborhood" class="sel"><option value="">Selecione</option>${(admin.neighborhoods||[]).filter(n=>n.active!==false).map(n=>`<option value="${n.id}">${esc(n.name)} • ${fmt(n.fee)}</option>`).join('')}</select></div><div class="row"><div class="field"><label>Complemento</label><input id="mComplement" class="in"></div><div class="field"><label>Referência</label><input id="mReference" class="in"></div></div>`:''};modal(`<div class="sheeth"><div><h2>Novo pedido manual</h2><div class="adminSub">Balcão, telefone ou consumo no local</div></div><button class="x" id="backToAdmin">←</button></div><div class="seg manualOrderTypes"><button data-mtype="delivery">Entrega</button><button data-counter-order>Balcão</button><button data-mtype="pickup" class="on">Retirada</button><button data-mtype="local">No local</button></div><div id="counterNotice" class="counterNotice hide">Pedido presencial no balcão — sem entrega e sem mesa.</div><div class="manualSectionTitle">DADOS DO CLIENTE</div><div class="row"><div class="field"><label>Nome do cliente</label><input id="mName" class="in"></div><div class="field"><label>Telefone</label><input id="mPhone" class="in" inputmode="tel" placeholder="(86) 99999-9999"></div></div><div id="manualAddress"></div><div class="row"><div class="field"><label>Pagamento</label><select id="mPayment" class="sel"><option>Pix</option><option>Dinheiro</option><option>Cartão</option></select></div><div class="field"><label>Troco para</label><input id="mChange" class="in" inputmode="decimal"></div></div><div class="manualSectionTitle">ESCOLHA OS PRODUTOS</div><div class="employeeProductSearch manualProductSearch"><span>⌕</span><input id="manualProductSearch" class="in" placeholder="Buscar lanche, combo, bebida..."></div><div class="employeeCatalog">${operationalCatalogHtml(products)}</div><div class="field"><label>Observação geral do pedido</label><textarea id="mNotes" class="ta" placeholder="Opcional: recado que vale para o pedido inteiro"></textarea></div><div class="manualFooter"><div><span>Total estimado</span><b id="manualTotal">${fmt(0)}</b></div><button id="saveManual" class="primary">CRIAR PEDIDO</button></div>`,true);let isCounter=false;const typeButtons=[...document.querySelectorAll('[data-mtype]')],counterButton=document.querySelector('[data-counter-order]'),counterNotice=$('#counterNotice');const selectType=button=>{isCounter=false;manualType=button.dataset.mtype;[...document.querySelectorAll('.manualOrderTypes button')].forEach(x=>x.classList.toggle('on',x===button));counterNotice?.classList.add('hide');drawAddress()};$('#backToAdmin').onclick=renderAdmin;drawAddress();typeButtons.forEach(button=>button.onclick=()=>selectType(button));counterButton.onclick=()=>{isCounter=true;manualType='counter';[...document.querySelectorAll('.manualOrderTypes button')].forEach(x=>x.classList.toggle('on',x===counterButton));counterNotice?.classList.remove('hide');drawAddress();$('#mName')?.focus()};$('#mPhone').oninput=e=>e.target.value=phoneMask(e.target.value);$('#manualProductSearch').oninput=e=>filterOperationalCatalog(e.target.value);document.querySelectorAll('[data-rproduct]').forEach(button=>button.onclick=()=>{const id=String(button.dataset.rproduct),quantity=Math.max(0,(quantities.get(id)||0)+Number(button.dataset.d)),product=products.find(p=>String(p.id)===id);quantities.set(id,quantity);const counter=$(`[data-rqty="${CSS.escape(id)}"]`);counter.textContent=quantity;counter.closest('.employeeProductCard')?.classList.toggle('selected',quantity>0);renderUnitNotes(id,product?.name||'Item',quantity,unitNotes);$('#manualTotal').textContent=fmt(total())});$('#saveManual').onclick=async()=>{const button=$('#saveManual');try{const name=$('#mName').value.trim(),phone=$('#mPhone').value.trim(),items=products.flatMap(p=>{const quantity=quantities.get(String(p.id))||0,notes=unitNotes.get(String(p.id))||[];return Array.from({length:quantity},(_,i)=>({product_id:p.id,qty:1,addon_ids:[],note:String(notes[i]||'').trim()}))});if(name.length<2)throw new Error('Informe o nome do cliente.');if(!validPhone(phone))throw new Error('Informe um telefone válido com DDD.');if(!items.length)throw new Error('Adicione pelo menos um item.');const typedNotes=$('#mNotes').value.trim(),payload={customer:{name,phone},type:manualType,payment:$('#mPayment').value,change_for:$('#mChange').value.trim(),coupon_code:'',notes:typedNotes,items,source:'manual'};if(manualType==='delivery'){const neighborhood=$('#mNeighborhood').value;if(!$('#mStreet').value.trim()||!$('#mNumber').value.trim()||!neighborhood)throw new Error('Preencha rua, número e bairro.');payload.address={street:$('#mStreet').value.trim(),number:$('#mNumber').value.trim(),neighborhood_id:neighborhood,complement:$('#mComplement').value.trim(),reference:$('#mReference').value.trim()}}button.disabled=true;button.textContent='CRIANDO...';const made=await adminCall('create_manual_order',payload);admin=await adminCall('snapshot');knownOrderIds=new Set((admin.orders||[]).map(o=>o.id));knownOrderStatuses=new Map((admin.orders||[]).map(o=>[String(o.id),String(o.status||'')]));adminTab='pedidos';renderAdmin();showAppToast(`Pedido #${made.order_number} criado com sucesso.`,'ok')}catch(e){alert(e.message||String(e));button.disabled=false;button.textContent='CRIAR PEDIDO'}}};
const employeeStyle=document.createElement('style');employeeStyle.textContent=`.employeeLoginCard{max-width:430px;margin:30px auto}.employeeLimit{border:1px solid #3c4654;background:#171d25;border-radius:13px;padding:11px 12px;color:#c7d0db;font-size:12px;line-height:1.45}.employeeAccessBtn{border-color:#5b3a20;background:#261a11;color:#ffd5a1}@media(max-width:480px){.employeeAccessBtn{grid-column:2}.topin{grid-template-columns:1fr auto auto auto}}`;document.head.appendChild(employeeStyle);
const headerButtonsStyle=document.createElement('style');headerButtonsStyle.textContent=`@media(max-width:640px){.topin{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;padding:12px 14px!important}.topin>.brand{grid-column:1/-1!important;width:100%;margin-bottom:3px}.topin>.headbtn{grid-column:auto!important;width:100%;min-width:0;padding:10px 6px!important;text-align:center;font-size:11px!important;white-space:nowrap}.topin>#trackBtn{order:2}.topin>#employeeAccessBtn{order:3}.topin>#adminBtn{order:4}}@media(min-width:641px){.topin>.brand{order:1}.topin>#trackBtn{order:2}.topin>#employeeAccessBtn{order:3}.topin>#adminBtn{order:4}}`;document.head.appendChild(headerButtonsStyle);
const employeeCatalogStyle=document.createElement('style');employeeCatalogStyle.textContent=`.employeeProductSearch{position:sticky;top:58px;z-index:4;background:#0f1216;padding:6px 0 10px}.employeeProductSearch>span{position:absolute;left:15px;top:17px;color:#89929d;font-size:22px}.employeeProductSearch .in{padding-left:43px}.employeeCatalog{display:grid;gap:18px;margin-top:5px}.employeeProductGroup{display:grid;gap:8px}.employeeGroupTitle{display:flex;align-items:center;gap:8px;padding:2px 3px}.employeeGroupTitle>b{font-size:16px;letter-spacing:-.02em}.employeeGroupTitle>small{margin-left:auto;color:var(--muted);font-size:10px;text-transform:uppercase;font-weight:850}.employeeProductGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.employeeProductCard{display:grid;grid-template-columns:58px minmax(0,1fr);grid-template-rows:auto auto;gap:7px 10px;align-items:center;border:1px solid var(--line);background:linear-gradient(145deg,#171b20,#111418);border-radius:14px;padding:8px;min-width:0;transition:.15s}.employeeProductCard.selected{border-color:#b9672c;background:linear-gradient(145deg,#2a1b11,#17130f);box-shadow:inset 0 0 0 1px rgba(255,136,56,.12)}.employeeProductPhoto{grid-row:1/3;width:58px;height:58px;border-radius:11px;overflow:hidden;background:#242931;display:grid;place-items:center}.employeeProductPhoto img{width:100%;height:100%;object-fit:cover}.employeeProductPhoto span{font-size:12px;font-weight:950;color:#8f98a4}.employeeProductInfo{min-width:0;align-self:end}.employeeProductInfo>b{display:block;font-size:13px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.employeeProductInfo>span{display:block;color:#f2a466;font-weight:900;font-size:12px;margin-top:3px}.employeeProductQty{align-self:start;gap:5px}.employeeProductQty button{width:31px;height:31px}.employeeProductQty>b{min-width:20px;text-align:center}.employeeCatalog+.field{margin-top:18px}@media(max-width:520px){.employeeProductGrid{grid-template-columns:1fr}.employeeProductCard{grid-template-columns:64px minmax(0,1fr) auto;grid-template-rows:1fr}.employeeProductPhoto{grid-row:auto;width:64px;height:64px}.employeeProductInfo{align-self:center}.employeeProductInfo>b{font-size:15px;white-space:normal}.employeeProductQty{align-self:center}.employeeProductQty button{width:38px;height:38px}.employeeProductSearch{top:57px}}`;document.head.appendChild(employeeCatalogStyle);
const unitNotesStyle=document.createElement('style');unitNotesStyle.textContent=`.unitNotes{display:none;grid-column:1/-1;border-top:1px solid rgba(255,255,255,.09);padding-top:8px;margin-top:2px}.employeeProductCard.selected .unitNotes{display:grid;gap:7px}.unitNotesTitle{color:#f2a466;font-size:9px;font-weight:950;letter-spacing:.08em}.unitNoteRow{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px;align-items:center}.unitNoteRow>span{font-size:10px;color:#c7cdd4;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.unitNoteRow>.in{padding:9px 10px;border-radius:10px;font-size:12px;background:#0e1115}@media(max-width:520px){.unitNoteRow{grid-template-columns:92px minmax(0,1fr)}.unitNoteRow>.in{font-size:13px}}`;document.head.appendChild(unitNotesStyle);
const manualOrderStyle=document.createElement('style');manualOrderStyle.textContent=`.manualSectionTitle{margin:18px 2px 4px;color:#6d747d;font-size:10px;font-weight:950;letter-spacing:.1em}.manualProductSearch{top:0;margin-bottom:4px}.manualProductSearch+.employeeCatalog{margin-bottom:18px}`;document.head.appendChild(manualOrderStyle);
const lightThemeStyle=document.createElement('style');lightThemeStyle.textContent=`
:root{--bg:#f3f4f6;--panel:#ffffff;--panel2:#f8f9fb;--line:#dfe3e8;--txt:#17191c;--muted:#6d747d;--brand:#d85a18;--brand-2:#f0782f;--brand-deep:#bd4310;--brand-text:#fff;--danger:#d83b43;--ok:#178647;--blue:#2477bd}
html,body{background:var(--bg);color:var(--txt)}body{background:linear-gradient(180deg,#fff 0,#f3f4f6 230px)}
.top{background:rgba(255,255,255,.94);border-bottom-color:#e3e5e8;box-shadow:0 5px 22px rgba(25,31,38,.07)}.brand h1{color:#15171a}.brandMark{background:linear-gradient(145deg,#f17931,#c84912);border-color:rgba(0,0,0,.05)}.status{color:#777f88}.status.open{color:#138446}.status.closed{color:#c83b42}.headbtn{background:#f5f6f8;color:#25282c;border-color:#daddE2;box-shadow:0 1px 2px rgba(0,0,0,.04)}.headbtn:hover{background:#eceff2;border-color:#cfd3d8}.employeeAccessBtn{background:#fff5ed;color:#a94112;border-color:#f0c7ad}
.search,.in,.sel,.ta{background:#fff;color:#1c1f23;border-color:#d9dde2;box-shadow:0 1px 2px rgba(20,25,30,.025)}.search::placeholder,.in::placeholder,.ta::placeholder{color:#969ca4}.search:focus,.in:focus,.sel:focus,.ta:focus{border-color:#e17638;box-shadow:0 0 0 3px rgba(216,90,24,.11)}
.chip{background:#fff;color:#4d535b;border-color:#dfe2e6}.chip.on{background:var(--brand);border-color:var(--brand);color:#fff}.card{background:#fff;border-color:#e0e3e7;box-shadow:0 5px 18px rgba(28,34,41,.055)}.pic{background:#eef0f2;color:#8a9199}.name,.price{color:#17191c}.desc{color:#737a83}.old{color:#949aa1}.add,.primary,.cartbtn{background:linear-gradient(135deg,#f4772e,#ca4812);color:#fff;box-shadow:0 7px 17px rgba(203,72,18,.17)}
.cartbar{background:linear-gradient(180deg,transparent,#f3f4f6 32%)}.overlay{background:rgba(18,22,27,.46);backdrop-filter:blur(3px)}.sheet{background:#f7f8fa;border-color:#e0e3e7;box-shadow:0 -14px 45px rgba(20,25,30,.15)}.sheeth{background:#f7f8fa}.sheeth h2,.adminHead h2{color:#17191c}.x{background:#fff;color:#2a2d31;border-color:#d9dde2}.field label{color:#60666e}.secondary,.editbtn{background:#fff;color:#30343a;border-color:#d7dbe0}.danger{background:#fff0f1!important;color:#bd3037!important;border-color:#efc4c7!important}.okbtn{background:#eaf8f0!important;color:#167441!important;border-color:#b8e2ca!important}
.seg button{background:#fff;color:#535960;border-color:#d9dde2}.seg button.on{background:#272b30;color:#fff;border-color:#272b30}.lineitem{border-bottom-color:#e4e6e9}.qty button{background:#f0f2f4;color:#24272b;border-color:#d8dce1}.sum{border-top-color:#dfe2e6}.sumrow{color:#555c64}.sumrow.total{color:#17191c}.manualFooter{background:#f7f8fa!important;border-top-color:#dfe3e7!important;box-shadow:0 -12px 24px rgba(28,34,41,.06);color:#202327}.manualFooter>div span{color:#6d747d}.manualFooter>div b{color:#17191c}
.notice,.operationHint{background:#eef5ff;color:#315a80;border-color:#cbdff1}.err{background:#fff0f1;color:#b62f37;border-color:#efc1c5}.success{background:#ecf9f1;color:#176d3e;border-color:#bfe4cd}.empty{border-color:#cfd4d9;color:#757c84;background:rgba(255,255,255,.55)}
.admbar{background:transparent}.admbar button{background:#fff;color:#50575f;border-color:#d9dde2}.admbar button.on{background:#2d3136;color:#fff;border-color:#2d3136}.metric,.financeCard,.reportCard{background:#fff;border-color:#e0e3e7;box-shadow:0 3px 12px rgba(25,31,38,.04)}.metric b,.financeCard b,.reportCard b{color:#191c20}.metric span,.financeCard span,.reportCard span,.mini,.adminSub{color:#707780}
.order,.orderDetailed,.tableitem,.reportBreak,.trackbox{background:#fff;border-color:#dfe3e7}.orderDetailed{background:linear-gradient(145deg,#fff,#fafbfc)}.orderBody{border-top-color:#e4e7ea}.orderInfo,.orderItemsBox,.orderItemRow{background:#f8f9fa;border-color:#e3e6e9}.orderInfo span{color:#7d858e}.orderInfo b,.orderItemHead b{color:#202328}.orderAddonLine{color:#626a73}.addressBoxAdmin,.notesBoxAdmin{background:#eef5fb;color:#3c566d;border-color:#d2e1ed}.orderTotalsBox{border-top-color:#d4d8dd}.orderTotalLine{color:#555d66}.orderTotalLine.grand{color:#17191c}.orderSummary:after{color:#7e858d}
.st-novo{background:#edf0f3;color:#454b52;border-color:#d6dbe0}.st-confirmado{background:#e8f7ee;color:#16713f;border-color:#bce2ca}.st-preparando{background:#fff5dc;color:#8b620c;border-color:#edd39a}.st-pronto{background:#eeecff;color:#554ca2;border-color:#cbc6ef}.st-em_rota{background:#e8f4ff;color:#1f679c;border-color:#bcd9ee}.st-entregue{background:#e7f7ed;color:#197443;border-color:#b9dfc8}.st-cancelado{background:#ffedef;color:#ad3037;border-color:#efc0c4}
.printerBar{background:#eef6fb;border-color:#cfdfeb}.printerConnect{background:#dceef9;color:#246184;border-color:#b8d5e6}.storeControl{background:linear-gradient(145deg,#fff,#f7f8f9);border-color:#dfe3e7}.storeNowBtn.openNow{background:#e7f7ed;color:#167441;border-color:#b9dfc8}.storeNowBtn.closeNow{background:#fff0f1;color:#bb333a;border-color:#edc1c4}
.kitchenCard{background:#fff;border-color:#dfe3e7}.kitchenCard.late{background:#fff3f0;border-color:#eaa58f}.kitchenItems{background:#f7f8f9;border-color:#e2e5e8}.kitchenNote{background:#fff5dc;color:#78550e;border-color:#ead19a}.orderChronometer{background:#fff4e6;color:#a45914;border-color:#efcb9b}.orderChronometer b{color:#342a20}.orderChronometer.stopped{background:#eaf8f0;color:#197342;border-color:#b9dfc8}
.kitchenFullCard{padding:16px!important}.kitchenOrderTop{padding-bottom:11px;border-bottom:1px solid #e4e7ea}.kitchenCreated{margin-top:3px;color:#727a83;font-size:11px;font-weight:750}.kitchenCustomer{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}.kitchenCustomer>div{min-width:0;padding:11px;border:1px solid #e1e5e8;border-radius:12px;background:#f8f9fa}.kitchenCustomer span{display:block;margin-bottom:4px;color:#777f88;font-size:9px;font-weight:950;letter-spacing:.06em}.kitchenCustomer b{display:block;color:#202429;font-size:15px;line-height:1.3}.kitchenCustomer a,.kitchenCustomer small{display:block;margin-top:4px;color:#315d7d;font-size:12px;line-height:1.35;text-decoration:none;word-break:break-word}.kitchenAddress{display:grid;gap:4px;margin-top:9px;padding:11px;border:1px solid #cbdfee;border-radius:12px;background:#eef7ff;color:#314f67}.kitchenAddress b{font-size:10px;letter-spacing:.04em}.kitchenAddress span{font-size:13px;font-weight:800;line-height:1.45}.kitchenAddress.pickup{border-color:#d7d0ef;background:#f5f2ff;color:#5c5090}.kitchenItem{padding:10px 11px;border-bottom:1px solid #e2e5e8}.kitchenItem:last-child{border-bottom:0}.kitchenAddon{margin-top:4px;padding-left:10px;color:#616a74;font-size:12px}.kitchenWhatsApp{margin:10px 0;padding:11px;border:1px solid #bfe0ca;border-radius:13px;background:#effaf3}.kitchenWhatsApp>b{display:block;margin-bottom:8px;color:#176a3c;font-size:11px}.kitchenWhatsApp>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.kitchenWhatsApp a{display:grid;place-items:center;min-height:40px;padding:7px;border:1px solid #b7dac4;border-radius:10px;background:#fff;color:#176a3c;text-align:center;text-decoration:none;font-size:9px;font-weight:950}.kitchenPhoneMissing{margin:10px 0;padding:10px;border:1px solid #e5c993;border-radius:11px;background:#fff7e5;color:#805b16;font-size:11px;font-weight:900}.kitchenMainAction{min-height:53px!important;margin-top:4px;font-size:14px!important}@media(max-width:520px){.kitchenCustomer{grid-template-columns:1fr}.kitchenWhatsApp>div{grid-template-columns:1fr 1fr}}
.kitchenToolbar{display:grid;grid-template-columns:1.2fr 1.2fr .8fr;gap:8px;margin-bottom:8px}.kitchenToolbar button{min-height:49px}.kitchenPrinterState{margin:0 0 10px;padding:9px 11px;border:1px solid #d8e2e9;border-radius:11px;background:#f4f8fb;color:#526675}.kitchenPrintActions{margin-top:10px!important}@media(max-width:620px){.kitchenToolbar{grid-template-columns:1fr 1fr}.kitchenToolbar #refreshKitchen{grid-column:1/-1}.kitchenToolbar button{font-size:11px}.kitchenPrintActions{grid-template-columns:1fr 1fr!important}}
.restaurantTable{background:linear-gradient(145deg,#fff,#f7f8fa);color:#22262a;border-color:#dce0e4;box-shadow:0 4px 14px rgba(25,31,38,.045)}.restaurantTable small{color:#777e86}.restaurantTable.occupied{background:linear-gradient(145deg,#fff8f1,#fff0e3);border-color:#e5a16d;box-shadow:inset 0 0 0 1px rgba(216,90,24,.08)}.restaurantTable.occupied>b{color:#b44713}.tableAccountTotal{background:#fff4e9;color:#3c2a1e;border-color:#efbf98}.tableAccountTotal span{color:#8c5634}.tableOrder{background:#fff;border-color:#dfe3e7}.tableItemLine{border-top-color:#e5e7ea}
.employeeLimit{background:#eef2f6;color:#515b65;border-color:#d6dde4}.employeeProductSearch{background:#f7f8fa}.employeeProductCard{background:linear-gradient(145deg,#fff,#f7f8fa);border-color:#dde1e5}.employeeProductCard.selected{background:linear-gradient(145deg,#fff8f2,#ffecdd);border-color:#df8b52}.employeeProductPhoto{background:#eceff2}.employeeProductInfo>b{color:#1f2226}.employeeProductInfo>span,.unitNotesTitle{color:#bd4c15}.unitNotes{border-top-color:#e1d7cf}.unitNoteRow>span{color:#626971}.unitNoteRow>.in{background:#fff}.employeeLoginCard{background:#fff;border:1px solid #e0e3e7;border-radius:18px;padding:18px;box-shadow:0 10px 28px rgba(27,33,40,.08)}
.pixPaymentPanel{background:#edf9f2;border-color:#bee2cc}.pixPaymentTitle{color:#176f40}.pixPaymentRow{border-bottom-color:#d7eadf}.pixPaymentRow span{color:#59816a}.pixPaymentRow b{color:#26372d}.pixKeyBox{background:#fff;border-color:#8fc9a7}.pixKeyBox code{color:#1d2922}.pixWarning{background:#fff4d9;color:#78560f}.whatsappAction{background:#168c4c}.deliveryAction{background:#e9f4fc;color:#23648f;border-color:#bdd8eb}.locationState{background:#eef5fa;color:#3f5c72;border-color:#d1e0ea}
.banner{background:linear-gradient(135deg,#fff5e9,#fff);color:#713710;border-color:#efcfad}.banner.hasimg{background:#e9ecef}.bannerCaption{color:#fff}.loyaltyCard,.loyaltyBox{background:#fff;border-color:#dfe3e7}.loyaltyTrack{background:#e4e7ea}.trustline{color:#6c747d}.checkoutSteps span{background:#d8dce1}.checkoutSteps span.on{background:var(--brand)}
.cartBreakdown{background:#fff;border-color:#d9dde2;box-shadow:0 4px 14px rgba(28,34,41,.06)}
.cartBreakdown .sumrow{color:#505861}
.cartBreakdown .sumrow b{color:#202328}
.cartBreakdown .sumrow .mini{color:#68717b}
.cartBreakdown .sumrow.total{margin-top:7px;padding-top:11px;border-top:1px solid #e1e4e8;color:#17191c;font-size:18px}
.cartBreakdown .sumrow.total b{color:#c94d14;font-size:20px}
.siteFooter{margin:34px auto 82px;padding:22px 12px 0;border-top:1px solid #dfe3e8;color:#737a83;text-align:center;font-size:12px;font-weight:700;letter-spacing:.01em}
@media(max-width:640px){.admbar{background:rgba(247,248,250,.96)}.sheet.full{background:#f7f8fa}}
`;document.head.appendChild(lightThemeStyle);
function customerCategoryRank(category){const c=String(category||'Outros').toLowerCase();if(c.includes('hamb'))return 0;if(c.includes('combo'))return 1;if(c.includes('batata'))return 2;if(c.includes('bebida'))return 3;return 4}
const renderCatalogCategoryOrderBase=renderCatalog;renderCatalog=function(){if(Array.isArray(data?.products))data.products.sort((a,b)=>customerCategoryRank(a.category)-customerCategoryRank(b.category)||Number(priceOf(a))-Number(priceOf(b))||String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));return renderCatalogCategoryOrderBase()};
let operationalMode=null;
function leaveOperationalMode(){operationalMode=null;closeModal();window.scrollTo({top:0,behavior:'smooth'});if($('#search'))$('#search').value='';search='';cat='Todos';if(data.products?.length)renderCatalog()}
function operationalPanelHome(){if(operationalMode==='admin'&&admin)return renderAdmin();if(operationalMode==='employee'&&employeeSnapshot)return renderEmployeePanel();leaveOperationalMode()}
const renderAdminLockedBase=renderAdmin;renderAdmin=function(){operationalMode='admin';return renderAdminLockedBase()};
const renderEmployeePanelLockedBase=renderEmployeePanel;renderEmployeePanel=function(){operationalMode='employee';return renderEmployeePanelLockedBase()};
const modalOperationalBase=modal;modal=function(html,full=false){modalOperationalBase(html,full);if(!operationalMode)return;const sheet=modalRoot.querySelector('.sheet'),heading=modalHeading();sheet?.querySelector('.modalNav')?.remove();sheet?.querySelectorAll('[data-close]').forEach(button=>{button.removeAttribute('data-close');if(/^Central Caseirão|^Atendimento •/i.test(heading)){button.remove()}else{button.textContent='←';button.setAttribute('aria-label','Voltar ao painel');button.onclick=operationalPanelHome}});const overlay=modalRoot.querySelector('.overlay');overlay?.addEventListener('click',e=>{if(e.target===overlay){e.preventDefault();e.stopImmediatePropagation()}},true)};
window.addEventListener('popstate',e=>{if(!operationalMode||!modalRoot.firstElementChild)return;e.stopImmediatePropagation();operationalPanelHome();if(!history.state?.caseiraoModal)history.pushState({caseiraoModal:true},'',location.href)},true);
const operationalNavigationStyle=document.createElement('style');operationalNavigationStyle.textContent=`.sheet.full>.sheeth:first-child{padding-top:8px}.adminHead .adminLogout{width:auto;min-width:72px;padding:11px 15px;background:#fff4ea;color:#a84212;border-color:#efc6aa}`;document.head.appendChild(operationalNavigationStyle);
const oldRenderTablesRemote=renderTables;renderTables=function(box){renderRemoteTables(box)};
const renderAdminEmployeesBase=renderAdmin;renderAdmin=function(){renderAdminEmployeesBase();const bar=document.querySelector('.admbar');if(bar&&!bar.querySelector('[data-tab="funcionarios"]')){const b=document.createElement('button');b.dataset.tab='funcionarios';b.className=adminTab==='funcionarios'?'on':'';b.textContent='Funcionários';b.onclick=()=>{adminTab='funcionarios';renderAdmin()};const products=bar.querySelector('[data-tab="produtos"]');products?products.before(b):bar.appendChild(b)}if(adminTab==='funcionarios'){const box=$('#admContent');if(box)renderEmployees(box)}};
const renderAdminTabEmployeesBase=renderAdminTab;renderAdminTab=function(){if(adminTab==='funcionarios'){const box=$('#admContent');if(box)renderEmployees(box);return}renderAdminTabEmployeesBase()};
const employeeAccessButton=document.createElement('button');employeeAccessButton.id='employeeAccessBtn';employeeAccessButton.className='headbtn employeeAccessBtn';employeeAccessButton.textContent='EQUIPE';document.querySelector('.topin')?.insertBefore(employeeAccessButton,$('#adminBtn'));employeeAccessButton.onclick=()=>employeeToken()?openTeamEmployeePanel().catch(e=>{sessionStorage.removeItem('caseirao_employee_token');employeeSnapshot=null;openEmployeeLogin();setTimeout(()=>alert(e.message),50)}):openEmployeeLogin();
const renderAdminCleanChromeBase=renderAdmin;renderAdmin=function(){operationalMode='admin';const result=renderAdminCleanChromeBase();modalRoot.querySelector('.modalNav')?.remove();modalRoot.querySelector('.sheeth>.x')?.remove();const exit=$('#adminLogout');if(exit){exit.textContent='Sair';exit.onclick=()=>{sessionStorage.removeItem('caseirao_admin_pin');clearInternalResume();if(orderWatcher)clearInterval(orderWatcher);admin=null;leaveOperationalMode()}}return result};
const renderEmployeeCleanChromeBase=renderEmployeePanel;renderEmployeePanel=function(){operationalMode='employee';const result=renderEmployeeCleanChromeBase();modalRoot.querySelector('.modalNav')?.remove();const exit=$('#employeeLogout');if(exit){exit.textContent='Sair';exit.onclick=async()=>{await employeeApi('logout').catch(()=>{});sessionStorage.removeItem('caseirao_employee_token');employeeSnapshot=null;leaveOperationalMode()}}return result};

/* Carrossel de promoções: mantém compatibilidade com os campos atuais do banner. */
const bannerCarouselStyle=document.createElement('style');bannerCarouselStyle.textContent=`
.banner.hasimg{padding:0;overflow:hidden;position:relative}.bannerTrack{position:relative;width:100%;aspect-ratio:16/6}.bannerSlide{position:absolute;inset:0;opacity:0;visibility:hidden;transition:opacity .7s ease;pointer-events:none}.bannerSlide.active{opacity:1;visibility:visible;pointer-events:auto;z-index:1}.bannerSlide img{width:100%;height:100%;object-fit:cover;display:block}.bannerSlide .bannerCaption{z-index:2}.bannerNav{position:absolute;z-index:4;top:50%;transform:translateY(-50%);width:38px;height:38px;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(0,0,0,.38);backdrop-filter:blur(5px);color:#fff;font-size:25px;line-height:1;display:grid;place-items:center}.bannerPrev{left:10px}.bannerNext{right:10px}.bannerDots{position:absolute;z-index:4;left:50%;bottom:9px;transform:translateX(-50%);display:flex;gap:7px}.bannerDot{width:8px;height:8px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.52);box-shadow:0 1px 4px rgba(0,0,0,.35)}.bannerDot.active{width:22px;border-radius:8px;background:#fff}.bannerEditorGrid{display:grid;gap:12px;margin:12px 0}.bannerEditorCard{border:1px solid var(--line);border-radius:16px;background:var(--panel);padding:12px}.bannerEditorHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.bannerEditorHead b{font-size:14px}.bannerSlotPreview{overflow:hidden;border-radius:12px;background:#e9ecef;min-height:95px;display:grid;place-items:center;color:var(--muted);font-size:12px}.bannerSlotPreview img{width:100%;aspect-ratio:16/6;object-fit:cover;display:block}.bannerSlotActions{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:9px}.bannerSlotActions .secondary{width:auto;padding:11px 14px}.bannerFileLabel{display:flex;align-items:center;justify-content:center;border:0;background:linear-gradient(135deg,#f4772e,#ca4812);color:#fff;border-radius:12px;padding:11px 13px;font-weight:900;cursor:pointer}.bannerFileLabel input{display:none}@media(min-width:700px){.bannerTrack{aspect-ratio:16/5}.bannerEditorGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(min-width:1050px){.bannerTrack{aspect-ratio:16/4}}@media(max-width:480px){.bannerTrack{aspect-ratio:16/7}.bannerNav{width:32px;height:32px;font-size:21px}.bannerPrev{left:7px}.bannerNext{right:7px}}
`;document.head.appendChild(bannerCarouselStyle);
let bannerCarouselTimer=null,bannerCarouselIndex=0;
function decodeBannerSlides(settings){const raw=String(settings?.banner_text||''),prefix='__CASEIRAO_SLIDES__';if(raw.startsWith(prefix)){try{const parsed=JSON.parse(raw.slice(prefix.length));if(Array.isArray(parsed))return parsed.slice(0,3).map(x=>({image:String(x?.image||''),text:String(x?.text||'')})).filter(x=>x.image||x.text)}catch(e){}}const image=String(settings?.banner_image_url||''),text=raw;return image||text?[{image,text}]:[]}
function encodeBannerSlides(slides){return '__CASEIRAO_SLIDES__'+JSON.stringify(slides.slice(0,3).map(x=>({image:String(x.image||''),text:String(x.text||'')})))}
function stopBannerCarousel(){if(bannerCarouselTimer){clearInterval(bannerCarouselTimer);bannerCarouselTimer=null}}
function showBannerSlide(index,restart=true){const banner=$('#banner'),slides=[...banner.querySelectorAll('.bannerSlide')],dots=[...banner.querySelectorAll('.bannerDot')];if(!slides.length)return;bannerCarouselIndex=(index+slides.length)%slides.length;slides.forEach((slide,i)=>slide.classList.toggle('active',i===bannerCarouselIndex));dots.forEach((dot,i)=>{dot.classList.toggle('active',i===bannerCarouselIndex);dot.setAttribute('aria-current',i===bannerCarouselIndex?'true':'false')});if(restart){stopBannerCarousel();if(slides.length>1)bannerCarouselTimer=setInterval(()=>showBannerSlide(bannerCarouselIndex+1,false),5000)}}
function renderBannerCarousel(settings){const banner=$('#banner'),slides=decodeBannerSlides(settings).filter(x=>x.image||x.text);stopBannerCarousel();bannerCarouselIndex=0;if(!settings?.banner_active||!slides.length){banner.className='banner hide';banner.innerHTML='';return}const hasImage=slides.some(x=>x.image);banner.className='banner'+(hasImage?' hasimg':'');banner.classList.remove('hide');if(!hasImage&&slides.length===1){banner.innerHTML=`<div>${esc(slides[0].text)}</div>`;return}banner.innerHTML=`<div class="bannerTrack">${slides.map((slide,i)=>`<div class="bannerSlide ${i===0?'active':''}" data-banner-slide="${i}">${slide.image?`<img src="${esc(slide.image)}" alt="Promoção ${i+1} do O Caseirão Burger" ${i?'loading="lazy"':''} onerror="this.style.display='none'">`:''}${slide.text?`<div class="bannerCaption">${esc(slide.text)}</div>`:''}</div>`).join('')}</div>${slides.length>1?`<button class="bannerNav bannerPrev" type="button" aria-label="Promoção anterior">‹</button><button class="bannerNav bannerNext" type="button" aria-label="Próxima promoção">›</button><div class="bannerDots">${slides.map((_,i)=>`<button class="bannerDot ${i===0?'active':''}" type="button" data-banner-dot="${i}" aria-label="Ver promoção ${i+1}"></button>`).join('')}</div>`:''}`;banner.querySelector('.bannerPrev')?.addEventListener('click',()=>showBannerSlide(bannerCarouselIndex-1));banner.querySelector('.bannerNext')?.addEventListener('click',()=>showBannerSlide(bannerCarouselIndex+1));banner.querySelectorAll('[data-banner-dot]').forEach(dot=>dot.addEventListener('click',()=>showBannerSlide(Number(dot.dataset.bannerDot))));let touchX=null;banner.addEventListener('touchstart',event=>{touchX=event.changedTouches[0].clientX},{passive:true});banner.addEventListener('touchend',event=>{if(touchX===null)return;const diff=event.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(diff)>45)showBannerSlide(bannerCarouselIndex+(diff<0?1:-1))},{passive:true});showBannerSlide(0)}
const renderCatalogBannerCarouselBase=renderCatalog;renderCatalog=function(){const result=renderCatalogBannerCarouselBase();renderBannerCarousel(data.settings||{});return result};
renderBannerAdmin=function(box){let slides=decodeBannerSlides(admin.settings);while(slides.length<3)slides.push({image:'',text:''});const preview=id=>{const el=$(`#bannerSlotPreview${id}`),slide=slides[id];if(el)el.innerHTML=slide.image?`<img src="${esc(slide.image)}" alt="Prévia da promoção ${id+1}">`:`<span>Nenhuma imagem neste espaço</span>`};box.innerHTML=`<div class="notice" style="margin:10px 0">Cadastre até 3 promoções. Quando houver mais de uma, elas trocarão automaticamente a cada 5 segundos.</div><label class="addon"><input id="bActive" type="checkbox" ${admin.settings.banner_active?'checked':''}><span>Carrossel de banners ativo</span></label><div class="bannerEditorGrid">${slides.map((slide,i)=>`<div class="bannerEditorCard"><div class="bannerEditorHead"><b>Promoção ${i+1}</b><span class="mini">${i===0?'Principal':'Opcional'}</span></div><div id="bannerSlotPreview${i}" class="bannerSlotPreview"></div><div class="bannerSlotActions"><label class="bannerFileLabel">Escolher imagem<input data-banner-file="${i}" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="secondary danger" data-banner-remove="${i}" type="button">Remover</button></div><div class="field"><label>Texto sobre a imagem (opcional)</label><input class="in" data-banner-text="${i}" value="${esc(slide.text)}" placeholder="Ex.: Promoção de hoje"></div></div>`).join('')}</div><button id="saveBanner" class="primary">Salvar carrossel</button>`;slides.forEach((_,i)=>preview(i));box.querySelectorAll('[data-banner-file]').forEach(input=>input.onchange=async()=>{const i=Number(input.dataset.bannerFile),file=input.files[0];if(!file)return;try{input.disabled=true;const base64=await fileToBase64(file),pin=sessionStorage.getItem('caseirao_admin_pin')||'',response=await api('admin-upload-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,content_type:file.type,base64})});slides[i].image=response.public_url;preview(i)}catch(e){alert(e.message)}finally{input.disabled=false;input.value=''}});box.querySelectorAll('[data-banner-remove]').forEach(button=>button.onclick=()=>{const i=Number(button.dataset.bannerRemove);slides[i].image='';slides[i].text='';const text=box.querySelector(`[data-banner-text="${i}"]`);if(text)text.value='';preview(i)});$('#saveBanner').onclick=async()=>{try{box.querySelectorAll('[data-banner-text]').forEach(input=>slides[Number(input.dataset.bannerText)].text=input.value.trim());const activeSlides=slides.filter(x=>x.image||x.text),pin=sessionStorage.getItem('caseirao_admin_pin')||'';await api('admin-banner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,payload:{banner_active:$('#bActive').checked&&activeSlides.length>0,banner_text:encodeBannerSlides(activeSlides),banner_image_url:activeSlides[0]?.image||''}})});admin=await adminCall('snapshot');await catalog();adminTab='banner';renderAdmin();showAppToast('Carrossel de promoções salvo.','ok')}catch(e){alert(e.message)}}};

/* Central de promoções: usa o preço promocional já persistido em cada produto. */
const promotionsStyle=document.createElement('style');promotionsStyle.textContent=`
.promoQuick{background:linear-gradient(135deg,#ff7a2f,#d94c12);border-color:#d94c12;color:#fff;box-shadow:0 5px 15px rgba(210,72,16,.2)}.promoModalIntro{margin:2px 0 13px;color:#6b737c;font-size:13px}.promoCustomerGrid{display:grid;gap:11px}.promoCustomerCard{display:grid;grid-template-columns:78px minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid #e0e3e7;background:#fff;border-radius:16px;padding:10px}.promoCustomerCard img,.promoCustomerPhoto{width:78px;height:70px;border-radius:12px;object-fit:cover;background:#eceff2}.promoCustomerInfo{min-width:0}.promoCustomerInfo b{display:block;color:#1b1e22;font-size:15px}.promoCustomerPrice{display:flex;align-items:baseline;gap:7px;margin-top:5px}.promoCustomerPrice del{color:#8a9199;font-size:12px}.promoCustomerPrice strong{color:#c94d14;font-size:19px}.promoCustomerAdd{border:0;border-radius:11px;background:#272b30;color:#fff;padding:11px 12px;font-weight:900}.promotionAdminRow{display:grid;grid-template-columns:minmax(0,1fr) 125px auto;gap:9px;align-items:end;border:1px solid #dfe3e7;background:#fff;border-radius:15px;padding:12px;margin:9px 0}.promotionAdminRow .field{margin:0}.promotionAdminRow .primary{width:auto;min-height:45px}.promotionAdminRow.isPromo{border-color:#e9a578;background:#fff8f2}.promotionAdminName b{display:block;color:#1c1f23}.promotionAdminName span{display:block;margin-top:4px;color:#717983;font-size:11px}.promotionsTop{margin:10px 0;padding:14px;border-radius:15px;background:#fff4e9;border:1px solid #efc6a7;color:#713b1c}.promotionsTop b{display:block;font-size:17px}.promotionsTop span{display:block;margin-top:4px;font-size:12px}@media(max-width:520px){.promoCustomerCard{grid-template-columns:68px minmax(0,1fr)}.promoCustomerCard img,.promoCustomerPhoto{width:68px;height:64px}.promoCustomerAdd{grid-column:1/-1;width:100%}.promotionAdminRow{grid-template-columns:1fr 112px}.promotionAdminRow .primary{grid-column:1/-1;width:100%}}
`;document.head.appendChild(promotionsStyle);
function activePromotions(){return (data.products||[]).filter(p=>p.active!==false&&Number(p.promo_price)>0&&Number(p.promo_price)<Number(p.price||0)).sort((a,b)=>Number(priceOf(a))-Number(priceOf(b)))}
function openDailyPromotions(){const items=activePromotions();modal(`<div class="sheeth"><div><h2>🔥 Promoções do dia</h2><div class="adminSub">Ofertas disponíveis agora</div></div><button class="x" data-close aria-label="Fechar">×</button></div>${items.length?`<div class="promoModalIntro">Aproveite os preços especiais de hoje.</div><div class="promoCustomerGrid">${items.map(p=>`<div class="promoCustomerCard">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'<div class="promoCustomerPhoto"></div>'}<div class="promoCustomerInfo"><b>${esc(p.name)}</b><div class="promoCustomerPrice"><del>${fmt(p.price)}</del><strong>${fmt(p.promo_price)}</strong></div></div><button class="promoCustomerAdd" data-promo-add="${p.id}">PEDIR</button></div>`).join('')}</div>`:'<div class="empty">Nenhuma promoção ativa no momento. Volte mais tarde!</div>'}`);bindClose();document.querySelectorAll('[data-promo-add]').forEach(button=>button.onclick=()=>openProduct(button.dataset.promoAdd))}
function promotionProductPayload(p,promoPrice){return{id:p.id,name:p.name,category:p.category||'Outros',description:p.description||'',price:Number(p.price||0),promo_price:promoPrice,image_url:p.image_url||'',active:p.active!==false,featured:!!p.featured,addon_ids:(admin.product_addons||[]).filter(link=>link.product_id===p.id).map(link=>link.addon_id)}}
function renderPromotionsAdmin(box){const products=[...(admin.products||[])].filter(p=>p.active!==false).sort((a,b)=>Number(a.price||0)-Number(b.price||0)),count=products.filter(p=>Number(p.promo_price)>0).length;box.innerHTML=`<div class="promotionsTop"><b>🔥 Promoções do dia</b><span>${count?`${count} produto${count===1?' está':'s estão'} em promoção.`:'Nenhuma promoção ativa.'} Digite o preço especial e salve.</span></div>${products.map(p=>`<div class="promotionAdminRow ${Number(p.promo_price)>0?'isPromo':''}"><div class="promotionAdminName"><b>${esc(p.name)}</b><span>Preço normal: ${fmt(p.price)}</span></div><div class="field"><label>Preço promocional</label><input class="in" inputmode="decimal" data-promo-price="${p.id}" value="${Number(p.promo_price)>0?esc(p.promo_price):''}" placeholder="R$ 0,00"></div><button class="primary" data-save-promo="${p.id}">${Number(p.promo_price)>0?'ATUALIZAR':'ATIVAR'}</button></div>`).join('')||'<div class="empty">Nenhum produto ativo.</div>'}`;box.querySelectorAll('[data-save-promo]').forEach(button=>button.onclick=async()=>{const p=admin.products.find(item=>item.id===button.dataset.savePromo),input=box.querySelector(`[data-promo-price="${CSS.escape(button.dataset.savePromo)}"]`);try{const value=input.value.trim()===''?null:num(input.value);if(value!==null&&(value<=0||value>=Number(p.price)))throw new Error('O preço promocional precisa ser maior que zero e menor que o preço normal.');button.disabled=true;button.textContent='SALVANDO...';await adminCall('upsert_product',promotionProductPayload(p,value));admin=await adminCall('snapshot');await catalog();adminTab='promocoes';renderAdmin();showAppToast(value===null?'Promoção removida.':'Promoção publicada para os clientes.','ok')}catch(e){button.disabled=false;button.textContent=Number(p.promo_price)>0?'ATUALIZAR':'ATIVAR';alert(e.message||String(e))}})}
const promotionDeactivateStyle=document.createElement('style');promotionDeactivateStyle.textContent=`.deactivatePromotion{grid-column:1/-1;width:100%;border:1px solid #efc0c4;background:#fff0f1;color:#b42f37;border-radius:11px;padding:11px 13px;font-weight:900}.deactivatePromotion:disabled{opacity:.6}`;document.head.appendChild(promotionDeactivateStyle);
const renderPromotionsAdminDeactivateBase=renderPromotionsAdmin;renderPromotionsAdmin=function(box){renderPromotionsAdminDeactivateBase(box);box.querySelectorAll('.promotionAdminRow.isPromo').forEach(row=>{const saveButton=row.querySelector('[data-save-promo]');if(!saveButton)return;const button=document.createElement('button');button.type='button';button.className='deactivatePromotion';button.textContent='DESATIVAR PROMOÇÃO';button.onclick=async()=>{const p=admin.products.find(item=>item.id===saveButton.dataset.savePromo);if(!p||!confirm(`Desativar a promoção de ${p.name}?`))return;try{button.disabled=true;button.textContent='DESATIVANDO...';await adminCall('upsert_product',promotionProductPayload(p,null));admin=await adminCall('snapshot');await catalog();adminTab='promocoes';renderAdmin();showAppToast('Promoção desativada e retirada da página do cliente.','ok')}catch(e){button.disabled=false;button.textContent='DESATIVAR PROMOÇÃO';alert(e.message||String(e))}};row.appendChild(button)})};
const renderAdminPromotionsBase=renderAdmin;renderAdmin=function(){const result=renderAdminPromotionsBase();const bar=document.querySelector('.admbar');if(bar&&!bar.querySelector('[data-tab="promocoes"]')){const button=document.createElement('button');button.dataset.tab='promocoes';button.className=adminTab==='promocoes'?'on':'';button.textContent='Promoções';button.onclick=()=>{adminTab='promocoes';renderAdmin()};const products=bar.querySelector('[data-tab="produtos"]');products?products.before(button):bar.appendChild(button)}return result};
const renderAdminTabPromotionsBase=renderAdminTab;renderAdminTab=function(){if(adminTab==='promocoes'){const box=$('#admContent');if(box)renderPromotionsAdmin(box);return}return renderAdminTabPromotionsBase()};

/* Sincronização rápida do ADM: inclui pedidos lançados por funcionários nas mesas. */
let adminOrderSyncBusy=false;
const normalizedOrderStatus=value=>String(value||'').trim().toLowerCase();
const isCounterOrder=order=>/^\s*\[BALCÃO\]/i.test(String(order?.notes||''));
const operationalOrderType=order=>isCounterOrder(order)?'counter':String(order?.type||'');
const operationalOrderTypeLabel=order=>{
  const type=operationalOrderType(order);
  return type==='counter'?'Balcão':type==='delivery'?'Entrega':type==='pickup'?'Retirada':type==='local'?'Consumo no local':orderTypeLabel(type);
};
function completionConfirmText(orderId){
  const order=(admin?.orders||[]).find(item=>String(item.id)===String(orderId));
  const type=operationalOrderType(order);
  return type==='counter'?'Finalizar este pedido de balcão?':type==='pickup'?'Confirmar que o cliente retirou este pedido?':type==='local'?'Finalizar o consumo deste pedido?':'Confirmar que o entregador concluiu esta entrega?';
}
function completedOrderMessage(order){
  const number=order?.order_number||'—',type=operationalOrderType(order);
  if(type==='counter')return `Pedido de balcão #${number} finalizado.`;
  if(type==='pickup')return `Pedido #${number} retirado pelo cliente.`;
  if(type==='local')return `Atendimento do pedido #${number} finalizado.`;
  return `Pedido #${number} entregue por entregador.`;
}
function showReadyCentralAlert(order){
  const id=String(order.id||order.order_number||''),message=`Pedido #${order.order_number||'—'} está no ponto.`;
  document.querySelector(`.readyCentralAlert[data-ready-order="${CSS.escape(id)}"]`)?.remove();
  const layer=document.createElement('div');layer.className='readyCentralAlert';layer.dataset.readyOrder=id;layer.setAttribute('role','alertdialog');layer.setAttribute('aria-modal','true');
  layer.innerHTML=`<section class="readyCentralAlertCard"><div class="readyCentralAlertIcon">📦</div><div class="readyCentralAlertText"><b>PEDIDO NO PONTO!</b><span>${esc(message)} A despachante confirmou a embalagem.</span></div><button type="button" data-ready-ack>OK, VI</button></section>`;
  document.body.appendChild(layer);layer.querySelector('[data-ready-ack]').onclick=()=>layer.remove();
  try{navigator.vibrate?.([400,150,400,150,700])}catch{}
  if('Notification'in window&&Notification.permission==='granted'){try{new Notification('Pedido no ponto • Caseirão',{body:message,tag:`caseirao-ready-${id}`,renotify:true,requireInteraction:true,vibrate:[400,150,700]})}catch{}}
}
checkNewOrders=async function(){
  if(adminOrderSyncBusy||!sessionStorage.getItem('caseirao_admin_pin'))return;
  adminOrderSyncBusy=true;
  try{
    const previousStatus=new Map((admin?.orders||[]).map(o=>[String(o.id),normalizedOrderStatus(o.status)]));
    const fresh=await adminCall('snapshot'),orders=fresh.orders||[];
    const newOrders=orders.filter(o=>!knownOrderIds.has(o.id));
    const justReady=orders.filter(o=>normalizedOrderStatus(o.status)==='pronto'&&previousStatus.has(String(o.id))&&previousStatus.get(String(o.id))!=='pronto');
    const justDelivered=orders.filter(o=>normalizedOrderStatus(o.status)==='entregue'&&previousStatus.has(String(o.id))&&previousStatus.get(String(o.id))!=='entregue');
    orders.forEach(o=>{knownOrderIds.add(o.id);knownOrderStatuses.set(String(o.id),normalizedOrderStatus(o.status))});admin=fresh;
    for(const order of justReady){savePreparationStop(order.id,Date.parse(order.updated_at)||Date.now());playOrderSound();showReadyToast(order);showReadyCentralAlert(order)}
    for(const order of justDelivered){const message=completedOrderMessage(order),type=operationalOrderType(order);if(type==='delivery')window.caseiraoSaveDeliveryNotification?.(message,order.id||order.order_number);playOrderSound();showAppToast(message,'ok');if(type!=='delivery')window.caseiraoShowOperationalCompletion?.(order,message)}
    if(newOrders.length){playOrderSound();showOrderToast(newOrders[0])}
    const box=$('#admContent');if(box&&(newOrders.length||justReady.length||justDelivered.length)){if(adminTab==='pedidos')renderOrders(box);else if(adminTab==='producao')renderKitchen(box);else if(adminTab==='caixa')renderCash(box);else if(adminTab==='mesas')await renderRemoteTables(box);else if(adminTab==='entregas')await renderDeliveryHub(box)}
  }catch(e){console.warn('Falha na sincronização da Central:',e)}finally{adminOrderSyncBusy=false}
};
startOrderWatcher=function(){if(orderWatcher)clearInterval(orderWatcher);knownOrderIds=new Set((admin?.orders||[]).map(o=>o.id));knownOrderStatuses=new Map((admin?.orders||[]).map(o=>[String(o.id),normalizedOrderStatus(o.status)]));orderWatcher=setInterval(checkNewOrders,5000)};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&sessionStorage.getItem('caseirao_admin_pin'))checkNewOrders()});

/* Alertas reforçados enquanto o ADM está ativo no aparelho. */
let adminScreenWakeLock=null;
const loudAlertStyle=document.createElement('style');loudAlertStyle.textContent=`.paymentMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:10px 3px 14px}.paymentMetric{min-width:0;padding:10px 11px;border:1px solid #d9dde2;background:#fff;border-radius:14px;box-shadow:0 4px 12px rgba(20,24,28,.04)}.paymentMetric span{display:block;color:#68717b;font-size:12px;font-weight:850;white-space:nowrap}.paymentMetric b{display:block;color:#1d2126;font-size:17px;line-height:1.15;margin-top:5px;white-space:nowrap}.alertControl{margin:8px 0 12px;padding:12px;border:1px solid #efbd97;background:linear-gradient(135deg,#fff7ef,#fff);border-radius:14px}.alertControlTop{display:flex;align-items:center;gap:10px}.alertControlTop>div{flex:1}.alertControlTop b{display:block;color:#54280f;font-size:14px}.alertControlTop span{display:block;color:#7b5a46;font-size:11px;margin-top:3px}.enableAlertsBtn{width:auto;border:0;border-radius:10px;padding:10px 13px;background:#d95416;color:#fff;font-weight:950}.alertControl.alertEnabled{display:inline-flex;width:auto;padding:0;border:0;background:transparent}.alertEnabled .alertControlTop>div{display:none}.alertEnabled .alertControlTop{gap:0}.alertEnabled .enableAlertsBtn{padding:8px 11px;border:1px solid #a8d7ba;background:#edf9f2;color:#176a3d;border-radius:999px;font-size:12px}.alertEnabled .enableAlertsBtn:before{content:'🔔 ';font-size:12px}@media(max-width:480px){.paymentMetrics{gap:6px}.paymentMetric{padding:9px 7px}.paymentMetric span{font-size:10px}.paymentMetric b{font-size:14px}.alertControl:not(.alertEnabled) .alertControlTop{align-items:stretch;flex-direction:column}.alertControl:not(.alertEnabled) .enableAlertsBtn{width:100%}}`;document.head.appendChild(loudAlertStyle);
playOrderSound=function(){try{unlockOrderSound();if(!audioCtx)return;const start=audioCtx.currentTime+.04,notes=[1047,1397,1760,1397,1760,2093];[0,1].forEach(repeat=>notes.forEach((frequency,index)=>{const at=start+repeat*1.12+index*.115,oscillator=audioCtx.createOscillator(),gain=audioCtx.createGain();oscillator.type='square';oscillator.frequency.setValueAtTime(frequency,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.58,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.095);oscillator.connect(gain);gain.connect(audioCtx.destination);oscillator.start(at);oscillator.stop(at+.105)}))}catch{}try{navigator.vibrate?.([650,260,650])}catch{}};
async function requestAdminWakeLock(){try{if('wakeLock'in navigator&&(!adminScreenWakeLock||adminScreenWakeLock.released))adminScreenWakeLock=await navigator.wakeLock.request('screen')}catch{}}
async function enableAdminAlerts(){unlockOrderSound();let permission='unsupported';if('Notification'in window){try{permission=Notification.permission==='granted'?'granted':await Notification.requestPermission()}catch{permission=Notification.permission||'denied'}}localStorage.setItem('caseirao_admin_alerts','1');await requestAdminWakeLock();playOrderSound();renderAdmin();showAppToast(permission==='denied'?'Som e tela ativa ligados. Permita notificações nas configurações do navegador.':'Alertas ligados. Ajuste também o volume de mídia do celular.','ok')}
function showNativeOrderNotification(order){if(!('Notification'in window)||Notification.permission!=='granted')return;try{const notification=new Notification(`Novo pedido #${order.order_number}`,{body:`${order.customer_name||'Cliente'} • ${fmt(order.total)}`,tag:`caseirao-order-${order.id}`,renotify:true,requireInteraction:true,vibrate:[500,180,500,180,800]});notification.onclick=()=>{window.focus();notification.close()}}catch{}}
const showOrderToastNativeBase=showOrderToast;showOrderToast=function(order){showOrderToastNativeBase(order);showNativeOrderNotification(order)};
const renderOrdersAlertBase=renderOrders;renderOrders=function(box){renderOrdersAlertBase(box);const enabled=localStorage.getItem('caseirao_admin_alerts')==='1',control=document.createElement('div');control.className='alertControl'+(enabled?' alertEnabled':'');control.innerHTML=`<div class="alertControlTop"><div><b>ATIVAR ALERTAS DE PEDIDOS</b><span>Toque aqui uma vez e permita as notificações.</span></div><button id="enableAdminAlerts" class="enableAlertsBtn" aria-label="${enabled?'Alertas ativos. Toque para testar o som.':'Ativar alertas de novos pedidos'}">${enabled?'ALERTAS ATIVOS':'ATIVAR'}</button></div>`;box.prepend(control);$('#enableAdminAlerts').onclick=enabled?()=>{unlockOrderSound();playOrderSound();showAppToast('Som de alerta testado.','ok')}:enableAdminAlerts;if(enabled)requestAdminWakeLock()};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&localStorage.getItem('caseirao_admin_alerts')==='1')requestAdminWakeLock()});

/* Controles operacionais: hierarquia visual sem alterar as ações existentes. */
const professionalControlsStyle=document.createElement('style');professionalControlsStyle.textContent=`
.admbar{gap:5px!important;padding:8px 2px 11px!important;scroll-snap-type:x proximity}.admbar button{min-height:42px;padding:9px 13px!important;border-radius:11px!important;font-size:12px!important;font-weight:850!important;box-shadow:none!important;scroll-snap-align:start}.admbar button.on{background:#272b30!important;color:#fff!important;border-color:#272b30!important;box-shadow:0 4px 12px rgba(25,29,34,.14)!important}
.statusSectionTitle{display:flex;align-items:center;gap:8px;margin:15px 0 8px;color:#5e6670;font-size:10px;font-weight:950;letter-spacing:.09em;text-transform:uppercase}.statusSectionTitle:before{content:'';width:4px;height:15px;border-radius:5px;background:#d85a18}
.orderactions.statusWorkflow{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important;margin-top:0!important}.orderactions.statusWorkflow .statusAction{min-height:58px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid #d9dde2!important;border-radius:12px!important;background:#fff!important;color:#30353b!important;padding:8px 6px!important;font-size:12px!important;line-height:1.1;box-shadow:0 2px 7px rgba(28,34,41,.045)!important}.statusIcon{font-size:17px;line-height:1}.statusText{display:flex;flex-direction:column;gap:3px;text-align:left}.statusText small{color:#8a9199;font-size:8px;font-weight:950;letter-spacing:.07em}.orderactions.statusWorkflow .st-preparando{border-color:#ebcf9f!important;background:#fff9ed!important;color:#7c5711!important}.orderactions.statusWorkflow .st-pronto{border-color:#c9c5ec!important;background:#f6f5ff!important;color:#554da0!important}.orderactions.statusWorkflow .st-em_rota{border-color:#b9d7eb!important;background:#f0f8fe!important;color:#23628e!important}.orderactions.statusWorkflow .st-entregue{border-color:#b7dfc6!important;background:#effaf3!important;color:#176c3d!important}.orderactions.statusWorkflow .statusAction.selected{box-shadow:inset 0 0 0 2px currentColor,0 4px 12px rgba(25,31,38,.08)!important;transform:none!important}.orderactions.statusWorkflow .statusAction.selected .statusText small:after{content:' • ATUAL';font-weight:950}.orderactions.statusWorkflow .cancelAction{grid-column:1/-1;min-height:43px!important;background:#fff5f5!important;color:#af333a!important;border-color:#ecc4c7!important;box-shadow:none!important}.orderactions.statusWorkflow .cancelAction .statusText{display:block}.orderactions.statusWorkflow .cancelAction .statusText small{display:none}
.printActions{gap:8px!important;margin-top:13px!important}.printActions button{min-height:48px!important;border-radius:12px!important;font-size:12px!important;letter-spacing:.01em}.printActions .mainPrint{background:linear-gradient(135deg,#f06c23,#cf4c12)!important;border-color:#c94a12!important;color:#fff!important}.printActions .bt{background:#18384c!important;border-color:#2c607d!important;color:#d5efff!important}
@media(max-width:640px){.admbar{margin-left:-2px;margin-right:-2px}.admbar button{font-size:11px!important;padding:9px 11px!important}.orderactions.statusWorkflow{grid-template-columns:repeat(2,minmax(0,1fr))!important}.orderactions.statusWorkflow .statusAction{min-height:55px}.printActions{grid-template-columns:1fr 1fr!important}}
`;document.head.appendChild(professionalControlsStyle);
const readableNotesStyle=document.createElement('style');readableNotesStyle.textContent=`
.orderItemNote{display:block;margin:7px 0 1px;padding:8px 10px;border:1px solid #e3b94f;border-left:4px solid #d99a00;border-radius:9px;background:#fff2b8;color:#5b3b00!important;font-size:12px!important;font-weight:850;line-height:1.4}.orderItemNote:before{content:'⚠ ';font-size:12px}.notesBoxAdmin{background:#eaf4fb!important;border:1px solid #b9d3e5!important;border-left:5px solid #2777a8!important;color:#253b4b!important;font-size:13px!important;font-weight:700;line-height:1.5}.notesBoxAdmin b{color:#183c55!important;font-size:12px!important;font-weight:950!important;text-transform:uppercase;letter-spacing:.04em}.notesBoxAdmin:not(:has(b)){color:#253b4b!important}.kitchenNote{background:#fff2b8!important;border:1px solid #e3b94f!important;color:#5b3b00!important;font-weight:850!important;font-size:13px!important;line-height:1.45}
`;document.head.appendChild(readableNotesStyle);
const renderOrdersProfessionalControlsBase=renderOrders;renderOrders=function(box){renderOrdersProfessionalControlsBase(box);const statusMeta={preparando:['🔥','ETAPA 1','Preparando'],pronto:['✓','ETAPA 2','Pronto'],em_rota:['➜','ETAPA 3','Em rota'],entregue:['✓','ETAPA 4','Entregue'],cancelado:['×','','Cancelar pedido']};box.querySelectorAll('.orderactions').forEach(actions=>{const buttons=[...actions.querySelectorAll('[data-st]')];if(!buttons.length)return;actions.classList.add('statusWorkflow');if(!actions.previousElementSibling?.classList.contains('statusSectionTitle'))actions.insertAdjacentHTML('beforebegin','<div class="statusSectionTitle">Atualizar andamento</div>');buttons.forEach(button=>{const meta=statusMeta[button.dataset.st];if(!meta)return;button.classList.toggle('cancelAction',button.dataset.st==='cancelado');button.innerHTML=`<span class="statusIcon">${meta[0]}</span><span class="statusText"><small>${meta[1]}</small>${meta[2]}</span>`;button.setAttribute('aria-label',meta[2])})});box.querySelectorAll('.printActions [data-webprint]').forEach(button=>button.innerHTML='🧾&nbsp; IMPRIMIR PEDIDO');box.querySelectorAll('.printActions [data-btprint]').forEach(button=>button.innerHTML='🖨️&nbsp; BLUETOOTH')};
let keepOpenOrderId='',keepOpenOrderScroll=0;
document.addEventListener('click',event=>{const button=event.target.closest('[data-st][data-oid]');if(!button)return;const collapse=false;keepOpenOrderId=String(button.dataset.oid||'');keepOpenOrderScroll=button.closest('.sheet')?.scrollTop||0},true);
const renderAdminKeepOrderOpenBase=renderAdmin;renderAdmin=function(){const result=renderAdminKeepOrderOpenBase();if(keepOpenOrderId){const id=keepOpenOrderId,scroll=keepOpenOrderScroll;requestAnimationFrame(()=>{const statusButton=[...document.querySelectorAll('.orderDetailed [data-oid]')].find(button=>String(button.dataset.oid)===id),card=statusButton?.closest('details.orderDetailed'),sheet=card?.closest('.sheet');if(card){card.open=true;if(sheet)sheet.scrollTop=scroll}keepOpenOrderId='';keepOpenOrderScroll=0})}return result};
const renderOrdersKeepExpandedBase=renderOrders;renderOrders=function(box){const sheet=box?.closest('.sheet'),scroll=sheet?.scrollTop||0,openIds=[...box.querySelectorAll('details.orderDetailed[open]')].map(card=>card.querySelector('[data-oid]')?.dataset.oid).filter(Boolean),result=renderOrdersKeepExpandedBase(box);if(openIds.length){box.querySelectorAll('details.orderDetailed').forEach(card=>{const id=card.querySelector('[data-oid]')?.dataset.oid;if(openIds.includes(id))card.open=true});if(sheet)sheet.scrollTop=scroll}return result};

/* Instalação legível e orientada para Chrome e Samsung Internet. */
const installHelpStyle=document.createElement('style');installHelpStyle.textContent=`.installSteps{gap:10px!important}.installStep{display:grid!important;grid-template-columns:34px minmax(0,1fr);align-items:center!important;gap:11px!important;min-height:64px;border:1px solid #dce1e6!important;background:#fff!important;color:#262a2f!important;border-radius:14px!important;padding:12px!important;box-shadow:0 2px 8px rgba(25,31,38,.04)}.installStep b{width:32px!important;height:32px!important;background:linear-gradient(135deg,#f4772e,#ca4812)!important;color:#fff!important;font-size:15px!important}.installStep div{color:#343940!important;font-size:13px!important;line-height:1.45!important}.installStep strong{color:#15181b!important;font-weight:950!important}.installBrowserHint{padding:11px 12px;border:1px solid #cbddea;background:#edf6fc;color:#31566f;border-radius:12px;font-size:12px;line-height:1.45}.copyInstallLink{margin-top:10px}`;document.head.appendChild(installHelpStyle);
installApp=async function(){if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone){showAppToast('O Caseirão já está instalado neste celular.','ok');return}if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;installPrompt=null;if(choice.outcome==='accepted')showAppToast('Aplicativo instalado com sucesso.','ok');return}const samsung=/SamsungBrowser/i.test(navigator.userAgent),browser=samsung?'Samsung Internet':'Google Chrome';modal(`<div class="sheeth"><div><h2>Instalar o Caseirão</h2><div class="adminSub">Passo a passo no ${browser}</div></div><button class="x" data-close>×</button></div><div class="installBrowserHint">O navegador não mostrou a instalação automática. Faça pelo menu — leva menos de um minuto.</div><div class="installSteps">${samsung?'<div class="installStep"><b>1</b><div>Toque no botão de <strong>três linhas (☰)</strong> na parte inferior do Samsung Internet.</div></div><div class="installStep"><b>2</b><div>Escolha <strong>Adicionar página a</strong>.</div></div><div class="installStep"><b>3</b><div>Toque em <strong>Tela inicial</strong> e confirme em <strong>Adicionar</strong>.</div></div>':'<div class="installStep"><b>1</b><div>Toque nos <strong>três pontinhos (⋮)</strong> no canto superior do Chrome.</div></div><div class="installStep"><b>2</b><div>Escolha <strong>Adicionar à tela inicial</strong> ou <strong>Instalar aplicativo</strong>.</div></div><div class="installStep"><b>3</b><div>Confirme tocando em <strong>Instalar</strong> ou <strong>Adicionar</strong>.</div></div>'}</div><div class="notice">Se essa opção não aparecer, copie o endereço abaixo e abra pelo Google Chrome.</div><button id="copyInstallLink" class="secondary copyInstallLink">COPIAR ENDEREÇO DO SISTEMA</button>`);bindClose();$('#copyInstallLink').onclick=async()=>showAppToast(await copyText(location.href)?'Endereço copiado. Agora abra no Chrome.':'Não foi possível copiar o endereço.',await copyText(location.href)?'ok':'err')};

const installAppCopyFixBase=installApp;installApp=async function(){await installAppCopyFixBase();const button=$('#copyInstallLink');if(button)button.onclick=async()=>{const copied=await copyText(location.href);showAppToast(copied?'Endereço copiado. Agora abra no Chrome.':'Não foi possível copiar o endereço.',copied?'ok':'err')}};

/* Agendamento visível em todo o fluxo do pedido. */
const scheduleDisplayStyle=document.createElement('style');scheduleDisplayStyle.textContent=`.scheduledOrderBadge{margin:10px 0;padding:11px 12px;border:1px solid #e5b36f;border-left:5px solid #d96a18;border-radius:12px;background:#fff5e8;color:#593315}.scheduledOrderBadge b{display:block;color:#a33f0f;font-size:11px;font-weight:950;letter-spacing:.06em;text-transform:uppercase}.scheduledOrderBadge strong{display:block;margin-top:4px;color:#2d211a;font-size:15px}.scheduledOrderBadge span{display:block;margin-top:3px;color:#76533d;font-size:11px}.kitchenCard .scheduledOrderBadge{margin:8px 0;background:#fff0d8}.success .scheduledOrderBadge{margin:10px 0 0;text-align:left}`;document.head.appendChild(scheduleDisplayStyle);
function scheduledOrderInfo(order){const raw=order?.scheduled_for;if(!raw)return null;const date=new Date(raw);if(Number.isNaN(date.getTime()))return null;return{label:order.type==='pickup'?'RETIRADA AGENDADA':order.type==='counter'?'BALCÃO AGENDADO':order.type==='delivery'?'ENTREGA AGENDADA':'PEDIDO AGENDADO',date:date.toLocaleString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',',' •')}}
function scheduledOrderHtml(order){const info=scheduledOrderInfo(order);return info?`<div class="scheduledOrderBadge"><b>📅 ${info.label}</b><strong>${esc(info.date)}</strong><span>Não preparar como pedido imediato.</span></div>`:''}
document.addEventListener('click',event=>{const button=event.target.closest('#sendOrder');if(!button)return;const mode=$('#scheduleMode'),field=$('#scheduledFor');if(mode?.value==='schedule'&&!field?.value){event.preventDefault();event.stopImmediatePropagation();alert('Escolha a data e o horário do agendamento.');field?.focus()}},true);
const sendOrderScheduledBase=sendOrder;sendOrder=async function(){const value=$('#scheduleMode')?.value==='schedule'?$('#scheduledFor')?.value:'',type=orderType;await sendOrderScheduledBase();if(value&&/Pedido recebido/i.test(modalHeading())){const success=modalRoot.querySelector('.success');if(success)success.insertAdjacentHTML('beforeend',scheduledOrderHtml({scheduled_for:value,type}))}};
const orderAdminCardScheduledBase=orderAdminCard;orderAdminCard=function(order,finished=false){const html=orderAdminCardScheduledBase(order,finished),schedule=scheduledOrderHtml(order);return schedule?html.replace('<div class="orderInfoGrid">',schedule+'<div class="orderInfoGrid">'):html};
const compactStatusStyle=document.createElement('style');compactStatusStyle.textContent=`.statusSentence{display:block!important;margin-top:3px!important;font-size:11px!important;font-weight:850!important}.statusSentence.route{color:#236b9b!important}.statusSentence.delivered{color:#197443!important}.orderDetailed.statusCollapsed{border-left-width:5px}.orderDetailed.statusCollapsed.route{border-left-color:#3894ca}.orderDetailed.statusCollapsed.delivered{border-left-color:#2a9b5d}.orderDetailed.statusCollapsed .orderSummary{background:linear-gradient(90deg,rgba(48,142,195,.08),transparent)}.orderDetailed.statusCollapsed.delivered .orderSummary{background:linear-gradient(90deg,rgba(42,155,93,.09),transparent)}`;document.head.appendChild(compactStatusStyle);
const orderAdminCardCompactStatusBase=orderAdminCard;orderAdminCard=function(order,finished=false){let html=orderAdminCardCompactStatusBase(order,finished);const route=order.status==='em_rota',delivered=order.status==='entregue';if(!route&&!delivered)return html;const tone=route?'route':'delivered',type=operationalOrderType(order),message=route?'Esta entrega está em rota.':type==='counter'?'Este pedido de balcão foi finalizado.':type==='pickup'?'Este pedido foi retirado pelo cliente.':type==='local'?'Este atendimento no local foi finalizado.':'Esta entrega foi concluída.';html=html.replace('class="order orderDetailed ','class="order orderDetailed statusCollapsed '+tone+' ');return html.replace('</div></div><div class="summaryRight">',`<span class="statusSentence ${tone}">${message}</span></div></div><div class="summaryRight">`)};
const renderKitchenScheduledBase=renderKitchen;renderKitchen=function(box){renderKitchenScheduledBase(box);box.querySelectorAll('[data-kitchen]').forEach(button=>{const order=(admin?.orders||[]).find(item=>String(item.id)===String(button.dataset.kitchen)),card=button.closest('.kitchenCard');if(card&&order?.scheduled_for&&!card.querySelector('.scheduledOrderBadge'))card.querySelector('.ordertop')?.insertAdjacentHTML('afterend',scheduledOrderHtml(order))})};
const receiptBrowserScheduledBase=receiptBrowserHtml;receiptBrowserHtml=function(order){const html=receiptBrowserScheduledBase(order),info=scheduledOrderInfo(order);if(!info)return html;const printed=`<div class="hr"></div><div class="block big"><b>*** ${esc(info.label)} ***</b><br>${esc(info.date)}<br>NÃO PREPARAR COMO IMEDIATO</div>`;return html.replace('<div class="hr"></div>',printed)};
let lastTrackedScheduleOrder=null;const apiScheduledBase=api;api=async function(slug,options={}){const result=await apiScheduledBase(slug,options);if(slug==='track-order')lastTrackedScheduleOrder=result?.order||null;return result};
const trackOrderScheduledBase=trackOrder;trackOrder=async function(){await trackOrderScheduledBase();const box=$('#trackResult .trackbox'),schedule=scheduledOrderHtml(lastTrackedScheduleOrder);if(box&&schedule&&!box.querySelector('.scheduledOrderBadge'))box.insertAdjacentHTML('beforeend',schedule)};

/* Desempenho do cardápio: cache imediato, imagens priorizadas e uploads compactados. */
const CATALOG_FAST_CACHE='caseirao_catalog_fast_v1';
catalog=async function(){let showedCache=false;try{const cached=JSON.parse(localStorage.getItem(CATALOG_FAST_CACHE)||'null');if(cached?.data&&Date.now()-Number(cached.savedAt||0)<21600000){data=cached.data;renderCatalog();showedCache=true}}catch{}try{const fresh=await api('catalog');data=fresh;try{localStorage.setItem(CATALOG_FAST_CACHE,JSON.stringify({savedAt:Date.now(),data:fresh}))}catch{}renderCatalog()}catch(e){if(!showedCache){$('#storeStatus').textContent='Erro ao carregar';$('#storeStatus').className='status closed';$('#products').innerHTML=`<div class="empty"><b>Não foi possível carregar.</b><br>${esc(e.message)}<br><br><button class="secondary" onclick="location.reload()">Tentar novamente</button></div>`}}};
const renderCatalogPerformanceBase=renderCatalog;renderCatalog=function(){const result=renderCatalogPerformanceBase();const productImages=[...document.querySelectorAll('#products .pic img')];productImages.forEach((image,index)=>{image.decoding='async';image.loading=index<4?'eager':'lazy';image.fetchPriority=index<2?'high':'low'});const bannerImages=[...document.querySelectorAll('#banner img')];bannerImages.forEach((image,index)=>{image.decoding='async';image.loading=index===0?'eager':'lazy';image.fetchPriority=index===0?'high':'low'});return result};
const rawFileToBase64=fileToBase64;fileToBase64=async function(file){if(!file?.type?.startsWith('image/')||file.type==='image/gif')return rawFileToBase64(file);try{const bitmap=await createImageBitmap(file),maxWidth=1600,maxHeight=1200,scale=Math.min(1,maxWidth/bitmap.width,maxHeight/bitmap.height),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale)),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#ffffff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);bitmap.close?.();const type=file.type==='image/png'?'image/webp':'image/jpeg',quality=.8,result=canvas.toDataURL(type,quality);return result.length<file.size*1.37?result:rawFileToBase64(file)}catch{return rawFileToBase64(file)}};
const performanceStyle=document.createElement('style');performanceStyle.textContent=`#products .card{content-visibility:auto;contain-intrinsic-size:auto 330px}#products .pic img{will-change:auto}.skeleton{content-visibility:visible}`;document.head.appendChild(performanceStyle);

/* Fotos do cardápio nas telas administrativas de Produtos e Promoções. */
const adminCatalogImage=product=>{
  const catalogProduct=(data.products||[]).find(item=>String(item.id)===String(product.id))||(data.products||[]).find(item=>String(item.name||'').trim().toLowerCase()===String(product.name||'').trim().toLowerCase());
  return String(product.image_url||catalogProduct?.image_url||'').trim();
};
const adminProductPhotosStyle=document.createElement('style');adminProductPhotosStyle.textContent=`
.adminProductList{display:grid;gap:11px;margin-top:12px}.adminProductCard{display:grid;grid-template-columns:82px minmax(0,1fr) auto;gap:13px;align-items:center;border:1px solid #dfe3e7;background:#fff;border-radius:18px;padding:11px;box-shadow:0 5px 18px rgba(28,34,41,.045)}.adminProductPhoto,.promotionAdminPhoto{overflow:hidden;background:#edf0f2;display:grid;place-items:center;color:#a54a1b;font-weight:950}.adminProductPhoto{width:82px;height:76px;border-radius:14px}.adminProductPhoto img,.promotionAdminPhoto img{width:100%;height:100%;object-fit:cover;display:block}.adminProductInfo{min-width:0}.adminProductInfo>b{display:block!important;color:#191c20!important;font-size:16px!important;line-height:1.2!important;white-space:normal!important}.adminProductInfo .mini{margin-top:6px;color:#717983!important;line-height:1.4}.adminProductActions{display:flex;gap:8px;align-items:center}.adminProductActions .editbtn{min-height:46px;padding:10px 15px}.promotionAdminRow.withPhoto{grid-template-columns:76px minmax(0,1fr) 125px auto;align-items:center}.promotionAdminPhoto{width:76px;height:72px;border-radius:13px}.promotionAdminName{min-width:0}.promotionAdminName b{font-size:16px;line-height:1.2}.promotionAdminName span{font-size:12px;line-height:1.4}.promotionAdminRow.withPhoto .field{align-self:center}.promotionAdminRow.withPhoto>.primary{align-self:center}.promotionAdminRow.withPhoto .deactivatePromotion{grid-column:2/-1}@media(max-width:620px){.adminProductCard{grid-template-columns:76px minmax(0,1fr)}.adminProductPhoto{width:76px;height:72px}.adminProductActions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}.adminProductActions .editbtn{width:100%}.promotionAdminRow.withPhoto{grid-template-columns:72px minmax(0,1fr) 112px}.promotionAdminPhoto{width:72px;height:68px}.promotionAdminRow.withPhoto>.primary{grid-column:1/-1;width:100%}.promotionAdminRow.withPhoto .deactivatePromotion{grid-column:1/-1}}@media(max-width:390px){.promotionAdminRow.withPhoto{grid-template-columns:66px minmax(0,1fr)}.promotionAdminPhoto{width:66px;height:64px}.promotionAdminRow.withPhoto .field{grid-column:1/-1}.promotionAdminRow.withPhoto>.primary{grid-column:1/-1}}
`;document.head.appendChild(adminProductPhotosStyle);
renderProductsAdmin=function(box){
  box.innerHTML=`<button id="newProduct" class="primary" style="margin:10px 0">+ Novo produto</button><div class="adminProductList">${(admin.products||[]).map(p=>{const image=adminCatalogImage(p);return `<div class="adminProductCard"><div class="adminProductPhoto">${image?`<img src="${esc(image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentNode.innerHTML='CB'">`:'CB'}</div><div class="adminProductInfo"><b>${esc(p.name)}</b><div class="mini">${esc(p.category||'Outros')} • ${fmt(p.price)} ${p.promo_price?`• Promo ${fmt(p.promo_price)}`:''} • ${p.active!==false?'Ativo':'Inativo'} ${p.featured?'• ⭐ Destaque':''}</div></div><div class="adminProductActions"><button class="editbtn" data-stockp="${p.id}">${p.sold_out?'LIBERAR':'ESGOTAR'}</button><button class="editbtn" data-editp="${p.id}">Editar</button></div></div>`}).join('')}</div>`;
  $('#newProduct').onclick=()=>editProduct(null);
  box.querySelectorAll('[data-editp]').forEach(button=>button.onclick=()=>editProduct((admin.products||[]).find(p=>String(p.id)===String(button.dataset.editp))));
  box.querySelectorAll('[data-stockp]').forEach(button=>button.onclick=async()=>{const p=(admin.products||[]).find(item=>String(item.id)===String(button.dataset.stockp));if(!p)return;button.disabled=true;try{await opsCall('set_availability',{kind:'product',id:p.id,sold_out:!p.sold_out});admin=await adminCall('snapshot');renderProductsAdmin(box)}catch(error){button.disabled=false;alert(error.message||String(error))}});
};
renderPromotionsAdmin=function(box){
  const products=[...(admin.products||[])].filter(p=>p.active!==false).sort((a,b)=>customerCategoryRank(a.category)-customerCategoryRank(b.category)||Number(a.price||0)-Number(b.price||0)||String(a.name||'').localeCompare(String(b.name||''),'pt-BR')),count=products.filter(p=>Number(p.promo_price)>0).length;
  box.innerHTML=`<div class="promotionsTop"><b>🔥 Promoções do dia</b><span>${count?`${count} produto${count===1?' está':'s estão'} em promoção.`:'Nenhuma promoção ativa.'} Digite o preço especial e salve.</span></div>${products.map(p=>{const image=adminCatalogImage(p),active=Number(p.promo_price)>0;return `<div class="promotionAdminRow withPhoto ${active?'isPromo':''}"><div class="promotionAdminPhoto">${image?`<img src="${esc(image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentNode.innerHTML='CB'">`:'CB'}</div><div class="promotionAdminName"><b>${esc(p.name)}</b><span>${esc(p.category||'Outros')}<br>Preço normal: ${fmt(p.price)}</span></div><div class="field"><label>Preço promocional</label><input class="in" inputmode="decimal" data-promo-price="${p.id}" value="${active?esc(p.promo_price):''}" placeholder="R$ 0,00"></div><button class="primary" data-save-promo="${p.id}">${active?'ATUALIZAR':'ATIVAR'}</button>${active?`<button class="deactivatePromotion" data-disable-promo="${p.id}">DESATIVAR PROMOÇÃO</button>`:''}</div>`}).join('')||'<div class="empty">Nenhum produto ativo.</div>'}`;
  box.querySelectorAll('[data-save-promo]').forEach(button=>button.onclick=async()=>{const p=(admin.products||[]).find(item=>String(item.id)===String(button.dataset.savePromo)),input=box.querySelector(`[data-promo-price="${CSS.escape(button.dataset.savePromo)}"]`);try{const value=input.value.trim()===''?null:num(input.value);if(value!==null&&(value<=0||value>=Number(p.price)))throw new Error('O preço promocional precisa ser maior que zero e menor que o preço normal.');button.disabled=true;button.textContent='SALVANDO...';await adminCall('upsert_product',promotionProductPayload(p,value));admin=await adminCall('snapshot');await catalog();adminTab='promocoes';renderAdmin();showAppToast(value===null?'Promoção removida.':'Promoção publicada para os clientes.','ok')}catch(error){button.disabled=false;button.textContent=Number(p?.promo_price)>0?'ATUALIZAR':'ATIVAR';alert(error.message||String(error))}});
  box.querySelectorAll('[data-disable-promo]').forEach(button=>button.onclick=async()=>{const p=(admin.products||[]).find(item=>String(item.id)===String(button.dataset.disablePromo));if(!p||!confirm(`Desativar a promoção de ${p.name}?`))return;try{button.disabled=true;button.textContent='DESATIVANDO...';await adminCall('upsert_product',promotionProductPayload(p,null));admin=await adminCall('snapshot');await catalog();adminTab='promocoes';renderAdmin();showAppToast('Promoção desativada e retirada da página do cliente.','ok')}catch(error){button.disabled=false;button.textContent='DESATIVAR PROMOÇÃO';alert(error.message||String(error))}});
};

/* Histórico compacto, legível e com hierarquia visual limpa. */
const historyReadabilityStyle=document.createElement('style');historyReadabilityStyle.textContent=`
.sheet.full:has(.adminHead) .orderSummary .orderNumber{color:#1b1e22!important;font-size:18px!important;min-width:50px}.sheet.full:has(.adminHead) .orderSummary .summaryCustomer>b{color:#1b1e22!important;font-weight:900!important}.sheet.full:has(.adminHead) .orderSummary .summaryCustomer>span{color:#6f7780!important}.sheet.full:has(.adminHead) .orderSummary .summaryRight>b{color:#1b1e22!important;font-size:17px!important}.sheet.full:has(.adminHead) .orderSummary:after{color:#77808a!important}.sheet.full:has(.adminHead) .statusSentence{line-height:1.25}
#reportBody .sectionTitle{margin:20px 2px 10px;color:#343a41;font-weight:900}#reportBody .orderDetailed{margin:9px 0;border:1px solid #dfe3e7!important;border-left-width:4px!important;background:#fff!important;box-shadow:0 4px 14px rgba(28,34,41,.04)!important}#reportBody .orderDetailed.statusCollapsed.delivered{border-left-color:#2a9b5d!important}#reportBody .orderDetailed.statusCollapsed.route{border-left-color:#3894ca!important}#reportBody .orderDetailed .orderSummary{min-height:88px;padding:13px 14px;background:#fff!important}#reportBody .orderDetailed .summaryMain{gap:9px}#reportBody .orderDetailed .summaryCustomer{gap:2px}#reportBody .orderDetailed .summaryRight{min-width:104px;gap:7px}#reportBody .orderDetailed .statusBadge{padding:6px 10px;font-size:11px}#reportBody .orderDetailed .statusSentence{font-size:10px!important;margin-top:2px!important}#reportBody .orderDetailed[open]{box-shadow:0 9px 25px rgba(28,34,41,.09)!important;border-color:#cfd5da!important}#reportBody .orderDetailed[open] .orderBody{background:#fafbfc}
@media(max-width:430px){#reportBody .orderDetailed .orderSummary{min-height:84px;padding:12px 11px}#reportBody .orderDetailed .orderNumber{font-size:17px!important;min-width:43px}#reportBody .orderDetailed .summaryCustomer>b{font-size:14px}#reportBody .orderDetailed .summaryCustomer>span{font-size:11px}#reportBody .orderDetailed .summaryRight{min-width:98px}#reportBody .orderDetailed .summaryRight>b{font-size:15px!important}#reportBody .orderDetailed .statusBadge{font-size:10px;padding:5px 8px}}
`;document.head.appendChild(historyReadabilityStyle);

/* Identificação do proprietário e copyright nas áreas internas. */
const internalIdentityStyle=document.createElement('style');internalIdentityStyle.textContent=`
.adminIdentityField{position:relative}.adminIdentityField .in{padding-left:46px;background:#eef1f4!important;color:#30353b!important;font-weight:850}.adminIdentityField:before{content:'👤';position:absolute;left:15px;bottom:14px;z-index:1;font-size:18px}.internalCopyright{margin:26px 0 5px;padding:18px 10px 4px;border-top:1px solid #dde1e5;color:#757c84;text-align:center;font-size:11px;font-weight:700;line-height:1.5}.loginCopyright{margin-top:24px;padding-top:16px}.adminOwnerBadge{display:inline-flex;align-items:center;gap:7px;margin-top:7px;padding:6px 10px;border:1px solid #e7d3c5;border-radius:999px;background:#fff7f1;color:#9b4217;font-size:11px;font-weight:850}
`;document.head.appendChild(internalIdentityStyle);
const openAdminIdentityBase=openAdmin;openAdmin=function(){
  openAdminIdentityBase();
  const sheet=modalRoot.querySelector('.sheet'),login=sheet?.querySelector('.loginbox'),pinField=$('#adminPin')?.closest('.field');
  if(sheet)sheet.classList.add('admLoginPremium');
  if(login&&pinField&&!$('#adminIdentity')){
    login.insertAdjacentHTML('afterbegin',`<div class="admLoginBrand" aria-hidden="true">CB</div><div class="admLoginIntro"><b>Central Administrativa</b><span>Acesso protegido do Caseirão</span></div>`);
    pinField.insertAdjacentHTML('beforebegin',`<div class="field adminIdentityField"><label>Identificação do administrador</label><input id="adminIdentity" class="in" value="Romário Caseirão ADM" readonly aria-readonly="true"></div>`);
    login.insertAdjacentHTML('beforeend','<div class="internalCopyright loginCopyright">© 2026 O Caseirão Burger<br>Todos os direitos reservados.</div>');
    const head=sheet.querySelector('.sheeth');if(head)head.remove();
  }
};
function addInternalCopyright(area){
  const box=$('#admContent')||$('#employeeContent')||modalRoot.querySelector('.sheet.full');
  if(!box||box.querySelector('.internalCopyright'))return;
  box.insertAdjacentHTML('beforeend',`<div class="internalCopyright"><span class="adminOwnerBadge">👤 ${esc(area)}</span><br><br>© 2026 O Caseirão Burger • Todos os direitos reservados.</div>`);
}
const renderAdminCopyrightBase=renderAdmin;renderAdmin=function(){const result=renderAdminCopyrightBase();addInternalCopyright('Romário Caseirão ADM');return result};
const renderEmployeeCopyrightBase=renderEmployeePanel;renderEmployeePanel=function(){const result=renderEmployeeCopyrightBase();addInternalCopyright('Equipe Caseirão');return result};

/* Retorno visual global para ações administrativas assíncronas. */
const adminActionFeedbackStyle=document.createElement('style');adminActionFeedbackStyle.textContent=`
@keyframes caseiraoSpin{to{transform:rotate(360deg)}}
button{position:relative;-webkit-tap-highlight-color:transparent}
button:active{transform:translateY(1px) scale(.985)!important;filter:brightness(.96)}
.adminActionLoading{pointer-events:none!important;cursor:wait!important;opacity:.82!important;color:transparent!important;text-shadow:none!important}
.adminActionLoading:before{content:'';position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-12px 0 0 -12px;border:3px solid rgba(255,255,255,.38);border-top-color:#fff;border-radius:50%;animation:caseiraoSpin .7s linear infinite;z-index:2}
.adminActionLoading.secondary:before,.adminActionLoading.editbtn:before,.adminActionLoading.deactivatePromotion:before,.adminActionLoading.danger:before{border-color:rgba(43,48,54,.2);border-top-color:#30363d}
.adminActionLoading:after{content:'PROCESSANDO';position:absolute;left:50%;top:calc(50% + 11px);transform:translateX(-50%);color:currentColor;font-size:0}
`;document.head.appendChild(adminActionFeedbackStyle);
const adminActionSelector=[
  '#saveP','#delP','#saveN','#delN','#saveA','#delA','#saveC','#delC','#saveStore','#saveEta','#saveBanner','#toggleStoreNow',
  '#confirmCloseTable','#saveTableOrder','#saveManualOrder','#confirmCloseShift','#startDeliveryTracking','#stopDeliveryTracking','#newDriverLink',
  '#saveEmployee','#deleteEmployee','#confirmPayment','#finishCashOrder',
  '[data-save-promo]','[data-disable-promo]','[data-stockp]','[data-st]','[data-kitchen]','[data-payment]','[data-action]'
].join(',');
function clearAdminActionFeedback(button){if(!button)return;button.classList.remove('adminActionLoading');button.removeAttribute('aria-busy');if(button.dataset.feedbackDisabled!=='1')button.disabled=false;delete button.dataset.feedbackDisabled}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||button.disabled||!button.closest('.sheet')||!button.matches(adminActionSelector))return;
  button.dataset.feedbackDisabled=button.disabled?'1':'0';
  requestAnimationFrame(()=>{if(!button.isConnected)return;button.classList.add('adminActionLoading');button.setAttribute('aria-busy','true');button.disabled=true});
  let checks=0;
  const watcher=setInterval(()=>{
    checks++;
    if(!button.isConnected){clearInterval(watcher);return}
    if(checks>=3&&!button.disabled){clearInterval(watcher);clearAdminActionFeedback(button);return}
    if(checks>=80){clearInterval(watcher);clearAdminActionFeedback(button)}
  },200);
},true);
const caseiraoNativeAlert=window.alert.bind(window);window.alert=function(...args){document.querySelectorAll('.adminActionLoading').forEach(clearAdminActionFeedback);return caseiraoNativeAlert(...args)};

restoreCart();lastCartCount=cartCount();updateCartBar();
$('#search').addEventListener('input',e=>{search=e.target.value;renderCatalog()});$('#cartBtn').onclick=renderCart;$('#trackBtn').onclick=()=>openTracking();$('#adminBtn').onclick=openAdmin;$('#homeBtn').onclick=goHome;$('#promotionsBtn').onclick=openDailyPromotions;$('#loyaltyBtn').onclick=openCustomerLoyalty;$('#installBtn').onclick=installApp;
$('#teamEmployeeBtn').onclick=()=>employeeToken()?openTeamEmployeePanel().catch(e=>{sessionStorage.removeItem('caseirao_employee_token');employeeSnapshot=null;openEmployeeLogin();setTimeout(()=>alert(e.message),50)}):openEmployeeLogin();
$('#teamDispatcherBtn').onclick=()=>employeeToken()?openDispatcherPanel():openDispatcherLogin();
$('#teamAdminBtn').onclick=openAdmin;
$('#teamInstallBtn').onclick=installApp;
catalog();
/* ADM distribuido como arquivo unico: remove workers/caches antigos para impedir
   que o navegador continue exibindo uma versao anterior depois do deploy. */
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=20260924-v42').catch(()=>{}));}

/* CASEIRÃO ENTREGAS — área autenticada, pagamentos, troco e acerto */
const driverAppStyle=document.createElement('style');driverAppStyle.textContent=`
.driverAccessChoice{border-color:#b8d9ee!important;background:#f1f9ff!important;color:#175f8f!important}.deliveryHubGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.deliveryPanel,.deliveryCard{border:1px solid #dfe3e7;background:#fff;border-radius:17px;padding:14px;color:#25292e}.deliveryPanel h3,.deliveryCard h3{margin:0 0 8px}.deliveryCard{margin:10px 0}.deliveryMeta{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:10px 0}.deliveryMeta>div{border:1px solid #e3e6e9;background:#f7f8f9;border-radius:11px;padding:9px}.deliveryMeta small{display:block;color:#717981}.deliveryActions{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.deliveryActions button{min-height:46px}.driverScreenNew{max-width:680px;margin:auto}.driverOrder{border:1px solid #dfe3e7;background:#fff;color:#24282d;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 5px 16px rgba(28,34,41,.05)}.driverOrder .addressBoxAdmin{background:#f6f8fa;color:#25292e;border-color:#dfe3e7}.driverMoney{border:1px solid #cce5d4;background:#effaf2;border-radius:13px;padding:12px;margin:10px 0;color:#176b3b}.driverPremiumHero{position:relative;overflow:hidden;border-radius:22px;padding:18px;margin:0 0 13px;background:linear-gradient(135deg,#20252a,#343a40);color:#fff;box-shadow:0 12px 30px rgba(20,24,28,.18);border:1px solid rgba(255,255,255,.06)}.driverPremiumHero:after{content:'🛵';position:absolute;right:12px;top:7px;font-size:58px;opacity:.12;transform:rotate(-7deg)}.driverPremiumHead{display:flex;align-items:center;gap:11px;position:relative;z-index:1}.driverPremiumIcon{width:45px;height:45px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.12);font-size:23px}.driverPremiumHead h2{margin:0;font-size:18px}.driverPremiumHead small{display:block;margin-top:2px;color:#cfd4d9}.driverPremiumStats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:15px;position:relative;z-index:1}.driverPremiumStat{background:rgba(255,255,255,.095);border:1px solid rgba(255,255,255,.11);border-radius:13px;padding:10px}.driverPremiumStat small{display:block;font-size:9px;text-transform:uppercase;font-weight:850;color:#cfd4d9}.driverPremiumStat b{display:block;margin-top:3px;font-size:15px}.driverPremiumStat.total b{color:#ffd2b9}.driverSectionHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 2px 7px}.driverSectionHead h3{margin:0;font-size:15px;color:#2d3238}.driverSectionHead span{font-size:10px;font-weight:900;color:#8a4a27;background:#fff1e8;border:1px solid #f0cfbd;border-radius:999px;padding:5px 8px}.driverQuickTop{display:flex;align-items:flex-start;gap:10px}.driverQuickTop .grow{min-width:0}.driverQuickTop h3{margin:0;font-size:17px}.driverQuickTop .driverFee{font-size:18px;color:#b94716;white-space:nowrap}.driverQuickLine{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:8px 0 10px}.driverQuickChip{display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border-radius:999px;background:#f4f6f8;border:1px solid #e3e6e9;font-size:11px;font-weight:800;color:#4a5159}.driverNextAction{margin-top:8px}.driverNextAction .primary,.driverNextAction .secondary{min-height:48px}.driverDetails{margin-top:9px;border-top:1px solid #eceff1;padding-top:8px}.driverDetails>summary{list-style:none;cursor:pointer;font-size:12px;font-weight:900;color:#6a7179;padding:8px 0}.driverDetails>summary::-webkit-details-marker{display:none}.driverDetails>summary:after{content:'＋';float:right;color:#a64a1c}.driverDetails[open]>summary:after{content:'−'}.driverDetailsContent{padding-top:4px}.driverMiniMapBtn{display:block;text-align:center;text-decoration:none;margin:8px 0;padding:11px 12px!important;min-height:auto!important;font-size:12px}.driverCompactMeta{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin:8px 0}.driverCompactMeta>div{background:#f6f7f8;border:1px solid #e5e8eb;border-radius:10px;padding:8px}.driverCompactMeta small{display:block;color:#7a8188;font-size:9px;text-transform:uppercase;font-weight:850}.driverCompactMeta b{display:block;margin-top:3px;font-size:12px}.driverStatus{font-size:12px;font-weight:900;color:#b24b18;text-transform:uppercase}.deliveryLogin{max-width:430px;margin:25px auto}.gpsActive{background:#157347!important;color:#fff!important}.settled{opacity:.7}.deliveryPanel .in,.deliveryPanel .sel,.deliveryCard .in,.deliveryCard .sel,.driverOrder .in{color:#20242a!important;background:#fff!important}
.driverDaySummary{margin:0 0 14px;border:1px solid #d8dce1;background:#fff;color:#20242a;border-radius:18px;padding:15px;box-shadow:0 7px 22px rgba(28,34,41,.06)}.driverDaySummaryHead{display:flex;align-items:center;justify-content:space-between;gap:12px}.driverDaySummaryHead h3{margin:0;font-size:18px}.driverDaySummaryHead strong{font-size:20px;color:#bd4715}.driverDayStats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:11px}.driverDayStats>div{background:#f5f7f8;border-radius:12px;padding:10px}.driverDayStats small{display:block;color:#747c84;font-size:9px;font-weight:900;text-transform:uppercase}.driverDayStats b{display:block;margin-top:4px;font-size:16px}.driverHoodList{margin-top:11px;border:1px solid #e4e7ea;border-radius:13px;overflow:hidden}.driverHoodRow{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:10px 11px;border-bottom:1px solid #e8eaed}.driverHoodRow:last-child{border-bottom:0}.driverHoodRow small{color:#707780}.driverHoodRow>strong{min-width:72px;text-align:right}
@media(max-width:620px){.deliveryHubGrid,.deliveryActions{grid-template-columns:1fr}.deliveryMeta{grid-template-columns:1fr 1fr}.driverDayStats{grid-template-columns:1fr 1fr}.driverHoodRow{grid-template-columns:1fr auto}.driverHoodRow small{grid-column:1/-1}}
`;document.head.appendChild(driverAppStyle);

let deliveryHub=null,driverSnapshot=null,driverLocationWatch=null,driverLocationTimer=null;
const driverTokenKey='caseirao_driver_token';
const internalResumeKey='caseirao_internal_resume';
function setInternalResume(area){try{sessionStorage.setItem(internalResumeKey,area)}catch{}}
function clearInternalResume(){try{sessionStorage.removeItem(internalResumeKey)}catch{}}
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

async function loadDeliveryHub(){deliveryHub=await driverAppApi('admin_snapshot',{},true);return deliveryHub}
async function renderDeliveryHub(box){
  try{box.innerHTML='<div class="notice">Carregando controle de entregas...</div>';await loadDeliveryHub();
    const active=(deliveryHub.assignments||[]).filter(a=>a.status!=='settled'),settled=(deliveryHub.assignments||[]).filter(a=>a.status==='settled').slice(0,10),assignedIds=new Set(active.map(a=>a.order_id));
    const available=(deliveryHub.orders||[]).filter(o=>!assignedIds.has(o.id));
    box.innerHTML=`<div class="operationHint">Acompanhe quem está com cada pedido, localização, pagamento, troco e acerto com o caixa.</div><div class="deliveryHubGrid"><details class="deliveryPanel deliveryManageFold"><summary><span><b>Entregadores</b><small>Cadastro e acesso da equipe</small></span><span>⌄</span></summary><div class="deliveryManageBody"><button id="newDriverAccount" class="primary">+ CADASTRAR ENTREGADOR</button>${(deliveryHub.drivers||[]).map(d=>`<div class="tableitem"><div class="grow"><b>${esc(d.name)}</b><div class="mini">Login: ${esc(d.username||'não criado')} • ${d.active?'Ativo':'Bloqueado'}</div></div><button class="editbtn" data-edit-driver="${d.id}">EDITAR</button></div>`).join('')||'<div class="empty">Cadastre o primeiro entregador.</div>'}</div></details><section class="deliveryPanel deliveryAvailablePanel"><h3>Pedidos aguardando entregador</h3>${available.map(o=>`<div class="deliveryCard"><b>#${o.order_number} • ${esc(o.customer_name)}</b><div class="mini">${esc(orderAddress(o))}<br>${esc(paymentLabel(o.payment))} • ${fmt(o.total)}</div><div class="field"><label>Entregador</label><select class="sel" data-driver-select="${o.id}"><option value="">Selecione</option>${(deliveryHub.drivers||[]).filter(d=>d.active).map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div><div class="field"><label>Troco levado pelo entregador</label><input class="in" data-change-float="${o.id}" inputmode="decimal" placeholder="R$ 0,00"></div><button class="primary" data-assign-order="${o.id}">ENTREGAR PEDIDO AO MOTOBOY</button></div>`).join('')||'<div class="empty">Nenhum pedido aguardando entregador.</div>'}</section></div><div class="sectionTitle">Entregas em andamento</div>${active.map(deliveryAdminCard).join('')||'<div class="empty">Nenhuma entrega em andamento.</div>'}${settled.length?`<div class="sectionTitle">Acertos concluídos</div>${settled.map(deliveryAdminCard).join('')}`:''}`;
    $('#newDriverAccount').onclick=()=>openDriverEditor();box.querySelectorAll('[data-edit-driver]').forEach(b=>b.onclick=()=>openDriverEditor((deliveryHub.drivers||[]).find(d=>d.id===b.dataset.editDriver)));
    box.querySelectorAll('[data-assign-order]').forEach(b=>b.onclick=async()=>{const id=b.dataset.assignOrder,driverId=box.querySelector(`[data-driver-select="${CSS.escape(id)}"]`).value,change=num(box.querySelector(`[data-change-float="${CSS.escape(id)}"]`).value);if(!driverId)return alert('Selecione o entregador.');try{b.disabled=true;b.textContent='ATRIBUINDO...';await driverAppApi('admin_assign',{order_id:id,driver_id:driverId,change_float:change},true);await renderDeliveryHub(box);showAppToast('Pedido enviado para o entregador.','ok')}catch(e){alert(e.message);b.disabled=false}});
    box.querySelectorAll('[data-settle-delivery]').forEach(b=>b.onclick=async()=>{if(!confirm('Confirmar que o entregador prestou contas deste pedido?'))return;try{b.disabled=true;b.textContent='CONFIRMANDO...';await driverAppApi('admin_settle',{assignment_id:b.dataset.settleDelivery},true);await renderDeliveryHub(box)}catch(e){alert(e.message);b.disabled=false;b.textContent='CONFIRMAR ACERTO'}});
    box.querySelectorAll('[data-unassign-delivery]').forEach(b=>b.onclick=async()=>{if(!confirm('Retirar este pedido do entregador?'))return;try{b.disabled=true;b.textContent='RETIRANDO...';await driverAppApi('admin_unassign',{assignment_id:b.dataset.unassignDelivery},true);await renderDeliveryHub(box)}catch(e){alert(e.message);b.disabled=false;b.textContent='RETIRAR ENTREGADOR'}});
  }catch(e){box.innerHTML=`<div class="err">${esc(e.message||String(e))}</div>`}
}
function deliveryAdminCard(a){const o=a.orders||{},d=a.drivers||{},cash=Number(a.cash_received||0),float=Number(a.change_float||0),items=Array.isArray(o.order_items)?o.order_items:[],itemCount=items.reduce((sum,item)=>sum+Number(item.quantity||1),0),itemsSummary=items.slice(0,2).map(item=>`${Number(item.quantity||1)}x ${esc(item.product_name||'Item')}`).join(' • ');return `<div class="deliveryCard deliveryOperationalCard ${a.status==='settled'?'settled':''}"><div class="ordertop deliveryCardTop"><div class="grow"><h3>#${o.order_number} • ${esc(o.customer_name||'Cliente')}</h3><div class="deliveryDriverLine">🛵 ${esc(d.name||'Sem entregador')}</div></div><span class="statusBadge st-${a.status==='delivered'||a.status==='settled'?'entregue':a.status==='route'?'em_rota':'preparando'}">${esc(deliveryStatusLabel(a.status))}</span></div><div class="deliveryAddressLine">📍 ${esc(orderAddress(o))}</div><div class="deliveryMeta"><div><small>Pagamento</small><b>${esc(paymentLabel(o.payment))}</b></div><div><small>Total</small><b>${fmt(o.total)}</b></div><div><small>Troco levado</small><b>${fmt(float)}</b></div><div><small>Retorno</small><b>${fmt(cash)}</b></div></div><details class="deliveryOrderDetails"><summary><span>🍔 ${itemCount||items.length||0} ${itemCount===1?'item':'itens'}${itemsSummary?` • ${itemsSummary}`:''}</span><b>VER DETALHES</b></summary><div class="deliveryOrderDetailsBody"><div class="orderItemsBox">${orderItemsHtml(o)}</div>${o.notes?`<div class="notesBoxAdmin"><b>Observações</b>${esc(o.notes)}</div>`:''}</div></details><div class="mini">${a.problem_note?`<b style="color:#b52e34">Problema: ${esc(a.problem_note)}</b>`:''}</div>${deliveryTimesHtml(a)}<div class="deliveryActions">${['delivered','returned'].includes(a.status)?`<button class="primary" data-settle-delivery="${a.id}">CONFIRMAR ACERTO</button>`:''}${a.status==='assigned'?`<button class="secondary danger" data-unassign-delivery="${a.id}">RETIRAR ENTREGADOR</button>`:''}${o.id?`<button class="secondary" data-delivery-map="${o.id}" data-order-number="${o.order_number}">VER GPS</button>`:''}</div></div>`}
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

const driverToken=decodeURIComponent((location.hash.match(/^#entregador=([^&]+)/)||[])[1]||'');if(driverToken)setTimeout(()=>openDriverTracking(driverToken),100);


/* MELHORIAS CONSOLIDADAS NO NÚCLEO — V21 */
/* Troca apenas os rótulos decorativos do resumo financeiro. */
(()=>{
  const polishAdminLabels=()=>{
    const head=document.querySelector('.sheet.full .adminHead h2');
    if(!head||!/^Central Caseirão$/i.test(head.textContent.trim()))return;
    document.querySelectorAll('.sheet.full .paymentMetric span').forEach((label,index)=>{
      const desired=['Cartão','Pix','Dinheiro'][index];
      if(desired&&label.textContent!==desired)label.textContent=desired;
    });
    const nav=document.querySelector('.sheet.full>.admbar');
    if(nav){nav.setAttribute('aria-label','Áreas da Central Caseirão');nav.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('on'))));}
  };
  /* Rótulos aplicados sem observer global. */
  polishAdminLabels();
})();

/* Mantém todas as ações existentes, mas apresenta somente a próxima etapa como destaque. */
(()=>{
  const flow=['confirmado','preparando','pronto','em_rota','entregue'];
  const nextFor=order=>{
    if(!order)return null;
    if(order.status==='novo'||order.status==='confirmado')return'preparando';
    if(order.status==='preparando')return'pronto';
    if(order.status==='pronto')return order.type==='delivery'?'em_rota':'entregue';
    if(order.status==='em_rota')return'entregue';
    return null;
  };
  const actionLabel=(order,next)=>({
    preparando:'🔥 INICIAR PREPARO',
    pronto:'✓ MARCAR COMO PRONTO',
    em_rota:'🛵 ENVIAR PARA ROTA',
    entregue:isCounterOrder(order)?'✓ FINALIZAR BALCÃO':order?.type==='pickup'?'✓ CONFIRMAR RETIRADA':order?.type==='local'?'✓ FINALIZAR CONSUMO':'✓ CONFIRMAR ENTREGA'
  }[next]||'AVANÇAR PEDIDO');
  const ageLabel=order=>{
    const minutes=Math.max(0,Math.floor((Date.now()-new Date(order.created_at).getTime())/60000));
    return minutes<1?'chegou agora':`há ${minutes} min`;
  };
  const enhance=box=>{
    box.querySelectorAll('.orderactions.statusWorkflow').forEach(actions=>{
      if(actions.closest('.finishedOrder')||actions.closest('.smartOrderFlow'))return;
      const id=actions.querySelector('[data-oid]')?.dataset.oid;
      const order=(admin?.orders||[]).find(item=>String(item.id)===String(id));
      const next=nextFor(order);
      if(!order||!next)return;
      const target=actions.querySelector(`[data-st="${next}"]`);
      if(!target)return;
      actions.previousElementSibling?.classList.contains('statusSectionTitle')&&actions.previousElementSibling.remove();
      const currentIndex=Math.max(0,flow.indexOf(order.status));
      const guide=document.createElement('div');
      guide.className='smartOrderFlow';
      guide.innerHTML=`<div class="smartFlowTop"><b>PRÓXIMA AÇÃO</b><span>Pedido ${ageLabel(order)}</span></div><div class="smartFlowSteps" aria-label="Progresso do pedido">${[0,1,2,3].map((_,i)=>`<span class="smartFlowStep ${i<currentIndex?'done':''}"></span>`).join('')}</div><button type="button" class="smartNextAction" data-next="${next}">${actionLabel(order,next)}</button><details class="statusAdvancedOptions"><summary>Corrigir status ou cancelar</summary></details>`;
      const advanced=guide.querySelector('.statusAdvancedOptions');
      actions.parentNode.insertBefore(guide,actions);
      advanced.appendChild(actions);
      guide.querySelector('.smartNextAction').onclick=event=>{
        const button=event.currentTarget;
        button.disabled=true;
        button.textContent='ATUALIZANDO...';
        target.click();
      };
    });
  };
  const base=renderOrders;
  renderOrders=function(box){const result=base(box);enhance(box);return result};
})();

/*
 * Entrega em um toque. O sistema percorre internamente as etapas exigidas pela
 * API, registra o horário final e evita que dois toques contabilizem o pedido.
 */
(()=>{
  const deliveryLocks=new Set();

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

  driverOrderCard=function(a){
    const o=driverFullOrder(a),hood=a.neighborhood_name||o.neighborhood_name||'Bairro não informado',fee=Number(a.driver_fee||0);
    const finished=['delivered','returned','settled'].includes(a.status);
    const rawPhone=String(o.customer_phone||'').replace(/\D/g,'');
    const phoneHref=rawPhone?`tel:${rawPhone}`:'';
    const change=o.change_for?String(o.change_for):'';
    const street=[o.address_street,o.address_number].filter(Boolean).join(', ')||'Endereço não informado';
    const complement=o.address_complement?`Complemento: ${o.address_complement}`:'';
    const reference=o.address_reference?`Referência: ${o.address_reference}`:'';
    const action=finished
      ? `<button class="primary" disabled>✓ ENTREGA CONCLUÍDA</button>`
      : `<button class="primary driverDeliverButton" data-driver-deliver="${a.id}">✓ MARCAR COMO ENTREGUE</button><div class="driverOneTapHint">Um toque confirma a entrega, registra o horário e atualiza o fechamento.</div>`;
    return `<div class="driverOrder ${finished?'driverFinishedCard':''}">
      <div class="driverQuickTop">
        <div class="grow"><h3>Pedido #${esc(o.order_number||'—')}</h3><div class="driverStatus">${esc(deliveryStatusLabel(a.status))}</div></div>
        <b class="driverFee">${fee?fmt(fee):'—'}</b>
      </div>
      <div class="driverQuickLine"><span class="driverQuickChip">📍 ${esc(hood)}</span><span class="driverQuickChip">💳 ${esc(paymentLabel(o.payment))}</span></div>
      <div class="driverNextAction">${action}${!finished?`<button class="secondary danger" style="margin-top:7px" data-driver-status="problem" data-driver-assignment="${a.id}">PROBLEMA NA ENTREGA</button>`:''}</div>
      <details class="driverDetails" open><summary>Endereço e detalhes do pedido</summary><div class="driverDetailsContent">${deliveryTimesHtml(a)}
        <div class="driverDeliveryInfo">
          <div class="driverInfoBlock driverAddressBlock"><small>📍 Endereço da entrega</small><strong>${esc(street)}</strong><span class="driverReference">${esc(hood)}${complement?` • ${esc(complement)}`:''}${reference?`<br>${esc(reference)}`:''}</span></div>
          <a class="secondary driverMiniMapBtn" href="${esc(safeMapsLink(o))}" target="_blank" rel="noopener">🗺️ ABRIR ROTA NO MAPA</a>
          <div class="driverInfoBlock"><small>👤 Cliente</small><strong>${esc(o.customer_name||'Não informado')}</strong>${phoneHref?`<a class="driverPhoneLink" href="${esc(phoneHref)}">📞 LIGAR PARA ${esc(o.customer_phone)}</a>`:`<span class="driverReference">Telefone não informado</span>`}</div>
          <div class="driverPayGrid"><div class="driverInfoBlock"><small>💳 Pagamento</small><strong>${esc(paymentLabel(o.payment))}</strong><span class="driverReference">${change?`Troco para ${esc(change)}`:'Sem troco informado'}</span></div><div class="driverInfoBlock"><small>💰 Total a receber</small><strong>${fmt(o.total)}</strong><span class="driverReference">Taxa do entregador: ${fee?fmt(fee):'não informada'}</span></div></div>
        </div>
        <div class="driverItemsTitle">🍔 ITENS DO PEDIDO</div><div class="orderItemsBox">${orderItemsHtml(o)}</div>
        ${o.notes?`<div class="notesBoxAdmin"><b>📝 Observações gerais</b>${esc(o.notes)}</div>`:''}
        <button class="secondary" data-driver-gps="${a.id}">📍 ATIVAR COMPARTILHAMENTO DE GPS</button>
      </div></details>
    </div>`;
  };

  async function deliverInOneTap(id,button){
    if(deliveryLocks.has(id))return;
    const assignment=(driverSnapshot?.assignments||[]).find(x=>String(x.id)===String(id));
    if(!assignment||['delivered','returned','settled'].includes(assignment.status))return;
    deliveryLocks.add(id);button.disabled=true;button.textContent='CONFIRMANDO ENTREGA...';
    try{
      let current=assignment.status;
      if(current==='assigned'||current==='problem'){
        await driverAppApi('status',{assignment_id:id,status:'route'});
        current='route';
      }
      if(current==='route'){
        await driverAppApi('status',{assignment_id:id,status:'arrived'});
        current='arrived';
      }
      if(current==='arrived'){
        const order=assignment.orders||{};
        const payload={assignment_id:id,status:'delivered',payment_confirmed:true};
        if(order.payment==='Dinheiro'){
          payload.cash_received=Number(order.total||0);
          payload.change_given=0;
        }
        await driverAppApi('status',payload);
      }
      stopDriverAreaGps();
      showAppToast('Entrega confirmada e contabilizada.','ok');
      await renderDriverArea();
    }catch(e){
      button.disabled=false;button.textContent='✓ MARCAR COMO ENTREGUE';
      alert(e.message||'Não foi possível confirmar a entrega.');
    }finally{deliveryLocks.delete(id)}
  }

  const baseRenderDriverArea=renderDriverArea;
  renderDriverArea=async function(){
    const result=await baseRenderDriverArea();
    document.querySelectorAll('[data-driver-deliver]').forEach(button=>{
      button.onclick=()=>deliverInOneTap(button.dataset.driverDeliver,button);
    });
    return result;
  };

  /* O painel pode ter sido restaurado antes deste aprimoramento carregar. */
  if(document.querySelector('.driverScreenNew')&&localStorage.getItem(driverTokenKey)){
    setTimeout(()=>renderDriverArea(),0);
  }
})();

/* Alerta do ADM quando o entregador conclui uma entrega em outro aparelho. */
(()=>{
  let deliveryAlertTimer=null,deliveryAlertBusy=false,deliveryAlertReady=false;
  const knownDelivered=new Set();
  const deliveredKey=a=>`${a.id}:${a.delivered_at||'delivered'}`;
  const isDelivered=a=>['delivered','returned','settled'].includes(a.status)&&Boolean(a.delivered_at||a.status==='delivered');

  function nativeDeliveryNotification(assignment){
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    const order=assignment.orders||{},driver=assignment.drivers||{};
    try{
      const notification=new Notification(`Entrega concluída • Pedido #${order.order_number||'—'}`,{
        body:`${driver.name||'Entregador'} confirmou a entrega.`,
        tag:`caseirao-delivery-${assignment.id}`,
        renotify:true,
        requireInteraction:true,
        vibrate:[250,120,250]
      });
      notification.onclick=()=>{window.focus();notification.close();adminTab='entregas';renderAdmin()};
    }catch{}
  }

  async function checkDeliveredOrders(){
    if(deliveryAlertBusy||!sessionStorage.getItem('caseirao_admin_pin'))return;
    deliveryAlertBusy=true;
    try{
      const snapshot=await driverAppApi('admin_snapshot',{},true);
      const completed=(snapshot.assignments||[]).filter(isDelivered);
      if(!deliveryAlertReady){
        completed.forEach(a=>knownDelivered.add(deliveredKey(a)));
        deliveryAlertReady=true;
        return;
      }
      const fresh=completed.filter(a=>!knownDelivered.has(deliveredKey(a)));
      completed.forEach(a=>knownDelivered.add(deliveredKey(a)));
      if(!fresh.length)return;
      deliveryHub=snapshot;
      for(const assignment of fresh){
        const order=assignment.orders||{},driver=assignment.drivers||{};
        const message=`Pedido #${order.order_number||'—'} entregue por ${driver.name||'entregador'}.`;
        playOrderSound();
        showAppToast(message,'ok');
        nativeDeliveryNotification(assignment);
      }
      if(adminTab==='entregas'){
        const box=$('#admContent');
        if(box)await renderDeliveryHub(box);
      }
    }catch{}finally{deliveryAlertBusy=false}
  }

  function startDeliveryAlerts(){
    /* O detector principal agora usa a sincronização do ADM, que já roda a cada 2,5 s. */
    return;
  }

  const baseRenderAdminForDeliveryAlerts=renderAdmin;
  renderAdmin=function(){
    const result=baseRenderAdminForDeliveryAlerts();
    startDeliveryAlerts();
    return result;
  };
})();

/* Confirmação persistente na Central: o atendente precisa reconhecer o aviso. */
(()=>{
  const historyKey='caseirao_delivery_alert_history';
  const originalToast=showAppToast;
  let lastDeliveryMessage='',lastDeliveryMessageAt=0;
  const saveAlert=(message,id='')=>{
    try{
      const history=JSON.parse(localStorage.getItem(historyKey)||'[]');
      const now=Date.now(),duplicate=history.some(item=>(id&&String(item.id||'')===String(id))||(!id&&item.message===message&&now-new Date(item.time||0).getTime()<20000));
      if(duplicate)return;
      history.unshift({id:String(id||crypto.randomUUID?.()||now),message,time:new Date().toISOString(),read:false});
      localStorage.setItem(historyKey,JSON.stringify(history.slice(0,50)));
      window.dispatchEvent(new CustomEvent('caseirao-delivery-alert-saved'));
    }catch{}
  };
  window.caseiraoSaveDeliveryNotification=saveAlert;
  const centralAlert=message=>{
    saveAlert(message);
    document.querySelector('.deliveryCentralAlert')?.remove();
    const layer=document.createElement('div');
    layer.className='deliveryCentralAlert';
    layer.setAttribute('role','alertdialog');
    layer.setAttribute('aria-modal','true');
    layer.innerHTML=`<section class="deliveryCentralAlertCard"><div class="deliveryCentralAlertHead"><div class="deliveryCentralAlertIcon">✓</div><div><b>Entrega concluída!</b><span>Confirmação recebida do entregador</span></div></div><div class="deliveryCentralAlertBody"><div class="deliveryCentralAlertMessage">${esc(message)}</div><div class="deliveryCentralAlertTime">Recebido às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div><div class="deliveryCentralAlertActions"><button class="primary" data-open-deliveries>ABRIR ENTREGAS</button><button class="secondary" data-ack-delivery>OK, ENTENDI</button></div></div></section>`;
    document.body.appendChild(layer);
    try{navigator.vibrate?.([300,120,300,120,500])}catch{}
    if('Notification' in window&&Notification.permission==='granted'){
      try{new Notification('Entrega concluída • Caseirão',{body:message,tag:'caseirao-central-'+message,renotify:true,requireInteraction:true,vibrate:[300,120,400]})}catch{}
    }
    layer.querySelector('[data-ack-delivery]').onclick=()=>layer.remove();
    layer.querySelector('[data-open-deliveries]').onclick=()=>{layer.remove();adminTab='entregas';renderAdmin()};
  };
  showAppToast=function(message,type='info'){
    const isDelivery=/^Pedido #.+ entregue por .+\.$/i.test(String(message||''));
    if(isDelivery&&String(message)===lastDeliveryMessage&&Date.now()-lastDeliveryMessageAt<15000)return;
    if(isDelivery){lastDeliveryMessage=String(message);lastDeliveryMessageAt=Date.now()}
    originalToast(message,type);
    if(isDelivery)centralAlert(String(message));
  };
})();

/* Conclusões presenciais: Retirada, Balcão e Consumo no local não são entregas. */
(()=>{
  window.caseiraoShowOperationalCompletion=(order,message)=>{
    const type=operationalOrderType(order);
    if(type==='delivery')return;
    const copy=type==='counter'
      ?{title:'Pedido de balcão finalizado!',subtitle:'Atendimento concluído no balcão'}
      :type==='pickup'
        ?{title:'Pedido retirado!',subtitle:'Pedido retirado pelo cliente'}
        :{title:'Atendimento finalizado!',subtitle:'Consumo no local concluído'};
    document.querySelector('.operationalCompletionAlert')?.remove();
    const layer=document.createElement('div');
    layer.className='deliveryCentralAlert operationalCompletionAlert';
    layer.setAttribute('role','alertdialog');
    layer.setAttribute('aria-modal','true');
    layer.innerHTML=`<section class="deliveryCentralAlertCard"><div class="deliveryCentralAlertHead"><div class="deliveryCentralAlertIcon">✓</div><div><b>${esc(copy.title)}</b><span>${esc(copy.subtitle)}</span></div></div><div class="deliveryCentralAlertBody"><div class="deliveryCentralAlertMessage">${esc(message)}</div><div class="deliveryCentralAlertTime">Finalizado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div><div class="deliveryCentralAlertActions"><button class="secondary" data-ack-operation>OK, ENTENDI</button></div></div></section>`;
    document.body.appendChild(layer);
    layer.querySelector('[data-ack-operation]').onclick=()=>layer.remove();
    try{navigator.vibrate?.([250,100,350])}catch{}
    if('Notification'in window&&Notification.permission==='granted'){
      try{new Notification(`${copy.title} • Caseirão`,{body:message,tag:`caseirao-operation-${order?.id||order?.order_number||Date.now()}`,renotify:true,requireInteraction:true,vibrate:[250,100,350]})}catch{}
    }
  };
})();

/* Detector redundante: acompanha Entregas e Pedidos para não depender de uma única resposta da API. */
(()=>{
  if(window.__caseiraoDeliveryFallback)return;
  window.__caseiraoDeliveryFallback=true;
  /* Mantido apenas como histórico de compatibilidade. A sincronização central é a fonte única. */
  return;
  const seenKey='caseirao_seen_delivered_orders_v2';
  let busy=false,initialized=false;
  const seen=new Set();
  try{JSON.parse(localStorage.getItem(seenKey)||'[]').forEach(id=>seen.add(String(id)))}catch{}
  const persist=()=>{try{localStorage.setItem(seenKey,JSON.stringify([...seen].slice(-300)))}catch{}};
  const assignmentRows=snapshot=>snapshot?.assignments||snapshot?.deliveries||snapshot?.data?.assignments||snapshot?.data?.deliveries||[];
  const orderRows=snapshot=>snapshot?.orders||snapshot?.data?.orders||[];
  const completedAssignment=a=>['delivered','returned','settled','entregue'].includes(String(a.status||'').toLowerCase())||Boolean(a.delivered_at);
  const recent=date=>{const time=new Date(date||0).getTime();return Number.isFinite(time)&&time>0&&Date.now()-time<120000};
  function emit(orderId,number,driverName,deliveredAt){
    const id=String(orderId||number||'');
    if(!id||seen.has(id))return;
    seen.add(id);persist();
    const message=`Pedido #${number||'—'} entregue por ${driverName||'entregador'}.`;
    playOrderSound();
    showAppToast(message,'ok');
    if('Notification' in window&&Notification.permission==='granted'){
      try{new Notification(`Entrega concluída • Pedido #${number||'—'}`,{body:message,tag:`caseirao-delivered-${id}`,renotify:true,requireInteraction:true,vibrate:[300,120,400],timestamp:new Date(deliveredAt||Date.now()).getTime()})}catch{}
    }
  }
  async function poll(){
    if(busy||!sessionStorage.getItem('caseirao_admin_pin'))return;
    busy=true;
    try{
      let deliverySnapshot=null,adminSnapshot=null;
      try{deliverySnapshot=await driverAppApi('admin_snapshot',{},true)}catch{}
      try{adminSnapshot=await adminCall('snapshot')}catch{}
      const completed=assignmentRows(deliverySnapshot).filter(completedAssignment);
      const deliveredOrders=orderRows(adminSnapshot).filter(o=>String(o.status||'').toLowerCase()==='entregue');
      if(!initialized&&seen.size===0){
        completed.filter(a=>!recent(a.delivered_at)).forEach(a=>seen.add(String(a.order_id||a.orders?.id||a.id)));
        deliveredOrders.filter(o=>!recent(o.updated_at||o.delivered_at)).forEach(o=>seen.add(String(o.id||o.order_number)));
        persist();
      }
      completed.forEach(a=>{const o=a.orders||{};emit(a.order_id||o.id||a.id,o.order_number||a.order_number,a.drivers?.name||a.driver_name,a.delivered_at)});
      deliveredOrders.forEach(o=>emit(o.id||o.order_number,o.order_number,'entregador',o.delivered_at||o.updated_at));
      initialized=true;
    }finally{busy=false}
  }
  /* Poll duplicado removido: o watcher principal já detecta entregas concluídas. */
})();

/* Caixa de notificações das entregas, com histórico e contador de não lidas. */
(()=>{
  const key='caseirao_delivery_alert_history';
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
  const write=value=>{try{localStorage.setItem(key,JSON.stringify(value.slice(0,50)))}catch{}};
  const timeLabel=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Horário não informado':date.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})};
  function updateBadge(){const badge=document.querySelector('.deliveryNotificationBadge');if(!badge)return;const count=read().filter(item=>!item.read).length,label=count>99?'99+':String(count);if(badge.textContent!==label)badge.textContent=label;badge.classList.toggle('hide',count===0);badge.closest('button')?.setAttribute('aria-label',count?`${count} notificações de entrega não lidas`:'Notificações de entrega')}
  function openCenter(){
    document.querySelector('.deliveryNotificationLayer')?.remove();
    const history=read(),layer=document.createElement('div');
    layer.className='deliveryNotificationLayer';
    layer.innerHTML=`<aside class="deliveryNotificationPanel" role="dialog" aria-modal="true" aria-label="Notificações de entrega"><div class="deliveryNotificationPanelHead"><div><h2>🔔 Entregas</h2><span>${history.length?`${history.length} avisos guardados`:'Nenhum aviso recebido'}</span></div><button data-close-notifications aria-label="Fechar">×</button></div><div class="deliveryNotificationList">${history.length?history.map((item,index)=>`<article class="deliveryNotificationItem ${item.read?'':'unread'}"><div class="deliveryNotificationItemIcon">✓</div><div><b>${esc(item.message||'Entrega concluída.')}</b><time>${esc(timeLabel(item.time))}</time></div><button class="deliveryNotificationDelete" data-delete-notification="${index}" aria-label="Apagar esta notificação">🗑</button></article>`).join(''):'<div class="deliveryNotificationEmpty"><b>Nenhuma entrega notificada</b>As confirmações dos entregadores aparecerão aqui.</div>'}</div>${history.length?'<div class="deliveryNotificationFooter"><button data-clear-history>APAGAR TODO O HISTÓRICO</button></div>':''}</aside>`;
    document.body.appendChild(layer);
    write(history.map(item=>({...item,read:true})));updateBadge();
    layer.querySelector('[data-close-notifications]').onclick=()=>layer.remove();
    layer.onclick=event=>{if(event.target===layer)layer.remove()};
    layer.querySelectorAll('[data-delete-notification]').forEach(button=>button.onclick=()=>{const current=read();current.splice(Number(button.dataset.deleteNotification),1);write(current);layer.remove();openCenter()});
    layer.querySelector('[data-clear-history]')?.addEventListener('click',()=>{if(!confirm('Apagar todas as notificações de entrega?'))return;write([]);layer.remove();openCenter()});
  }
  function mount(){
    return;
    if(!sessionStorage.getItem('caseirao_admin_pin'))return;
    const head=document.querySelector('.sheet.full .adminHead');if(!head)return;
    let bell=head.querySelector('.deliveryNotificationBell');
    if(!bell){bell=document.createElement('button');bell.type='button';bell.className='deliveryNotificationBell';bell.innerHTML='🔔<span class="deliveryNotificationBadge hide">0</span>';bell.onclick=openCenter;const logout=head.querySelector('#adminLogout');logout?head.insertBefore(bell,logout):head.appendChild(bell)}
    updateBadge();
  }
  /* Observer morto removido: mount() está desativado. */
  window.addEventListener('caseirao-delivery-alert-saved',()=>updateBadge());
})();

/* Histórico oficial no Supabase: compartilhado entre aparelhos e apagado somente pelo ADM. */
(()=>{
  let dbHistory=[],syncBusy=false;
  const notificationAdminApi=async(action,payload={})=>{const response=await fetch('https://jhvtjhjzlljqfzdccrxc.supabase.co/functions/v1/driver-api',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:sessionStorage.getItem('caseirao_admin_pin')||'',action,payload})});let result={};try{result=await response.json()}catch{}if(!response.ok||result.error)throw new Error(result.error||result.detail||`Erro ${response.status}`);return result};
  const normalize=row=>({id:row.id,message:row.message||`Pedido #${row.order_number||'—'} entregue por ${row.driver_name||'entregador'}.`,time:row.created_at,read:Boolean(row.read_at)});
  const updateDbBadge=()=>{const badge=document.querySelector('.deliveryNotificationBadge');if(!badge)return;const count=dbHistory.filter(item=>!item.read).length,label=count>99?'99+':String(count);if(badge.textContent!==label)badge.textContent=label;badge.classList.toggle('hide',count===0)};
  async function syncDbHistory(){if(syncBusy||!sessionStorage.getItem('caseirao_admin_pin'))return dbHistory;syncBusy=true;try{const snapshot=await notificationAdminApi('admin_snapshot');dbHistory=(snapshot.notifications||[]).map(normalize);updateDbBadge();return dbHistory}finally{syncBusy=false}}
  async function openDbCenter(){
    document.querySelector('.deliveryNotificationLayer')?.remove();
    const loading=document.createElement('div');loading.className='deliveryNotificationLayer';loading.innerHTML='<aside class="deliveryNotificationPanel"><div class="deliveryNotificationPanelHead"><div><h2>🔔 Entregas</h2><span>Carregando histórico do banco...</span></div><button data-close-db-notifications>×</button></div></aside>';document.body.appendChild(loading);loading.querySelector('[data-close-db-notifications]').onclick=()=>loading.remove();
    try{await syncDbHistory()}catch(e){loading.querySelector('span').textContent='Falha ao carregar: '+(e.message||e);return}
    loading.remove();const history=dbHistory,layer=document.createElement('div');layer.className='deliveryNotificationLayer';
    layer.innerHTML=`<aside class="deliveryNotificationPanel" role="dialog" aria-modal="true"><div class="deliveryNotificationPanelHead"><div><h2>🔔 Entregas</h2><span>${history.length?`${history.length} notificações salvas no banco`:'Nenhuma notificação salva'}</span></div><button data-close-db-notifications>×</button></div><div class="deliveryNotificationList">${history.length?history.map(item=>`<article class="deliveryNotificationItem ${item.read?'':'unread'}"><div class="deliveryNotificationItemIcon">✓</div><div><b>${esc(item.message)}</b><time>${new Date(item.time).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time></div><button class="deliveryNotificationDelete" data-db-delete="${esc(item.id)}" aria-label="Apagar esta notificação">🗑</button></article>`).join(''):'<div class="deliveryNotificationEmpty"><b>Nenhuma entrega notificada</b>As próximas confirmações ficarão salvas aqui.</div>'}</div>${history.length?'<div class="deliveryNotificationFooter"><button data-db-clear>APAGAR TODO O HISTÓRICO</button></div>':''}</aside>`;document.body.appendChild(layer);
    const unread=history.filter(item=>!item.read).map(item=>item.id);if(unread.length){notificationAdminApi('admin_read_notifications',{ids:unread}).then(()=>{dbHistory=dbHistory.map(item=>({...item,read:true}));updateDbBadge()}).catch(()=>{})}
    layer.querySelector('[data-close-db-notifications]').onclick=()=>layer.remove();layer.onclick=event=>{if(event.target===layer)layer.remove()};
    layer.querySelectorAll('[data-db-delete]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await notificationAdminApi('admin_delete_notification',{id:button.dataset.dbDelete});dbHistory=dbHistory.filter(item=>String(item.id)!==String(button.dataset.dbDelete));layer.remove();openDbCenter()}catch(e){button.disabled=false;alert(e.message||e)}});
    layer.querySelector('[data-db-clear]')?.addEventListener('click',async()=>{if(!confirm('Apagar definitivamente todas as notificações de entrega?'))return;try{await notificationAdminApi('admin_clear_notifications');dbHistory=[];layer.remove();openDbCenter()}catch(e){alert(e.message||e)}})
  }
  document.addEventListener('click',event=>{const bell=event.target.closest?.('.deliveryNotificationBell');if(!bell)return;event.preventDefault();event.stopImmediatePropagation();openDbCenter()},true);
  window.addEventListener('caseirao-delivery-alert-saved',()=>setTimeout(syncDbHistory,700));
  /* Central de histórico desativada a pedido do proprietário; alertas operacionais permanecem ativos. */
})();

/* Mantém o teclado aberto: a busca filtra os cartões existentes sem recriar a tela. */
document.addEventListener('input',event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||input.id!=='orderSearch')return;
  event.stopImmediatePropagation();
  const term=input.value.trim().toLocaleLowerCase('pt-BR');
  const content=input.closest('#admContent')||document;
  content.querySelectorAll('.orderDetailed').forEach(card=>{
    card.classList.toggle('hide',Boolean(term)&&!card.textContent.toLocaleLowerCase('pt-BR').includes(term));
  });
},true);

/* CASEIRÃO PROFESSIONAL FINAL — inteligência operacional sem alterar contratos do backend. */
(()=>{
  const finalBuild='2026.09.13-final';
  let lastSyncAt=new Date(),syncTimer=null;
  const finalShiftOrders=()=>typeof shiftOrders==='function'?shiftOrders():(admin?.orders||[]).filter(o=>localDay(o.created_at)===todayKey()&&!o.archived_at);
  const liveOrders=()=>finalShiftOrders().filter(o=>!['entregue','cancelado'].includes(String(o.status||'')));
  const money=n=>fmt(Number(n||0));
  const minutes=o=>Math.max(0,Math.floor((Date.now()-new Date(o.created_at).getTime())/60000));
  const csvCell=value=>`"${String(value??'').replace(/"/g,'""')}"`;
  const download=(name,content,type='text/plain;charset=utf-8')=>{const blob=new Blob(['\ufeff',content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const statusName=status=>statusLabel?.[status]||status||'Não informado';

  function syncLabel(){
    const head=document.querySelector('.sheet.full .adminHead .grow');if(!head)return;
    let label=head.querySelector('.opsSync');if(!label){label=document.createElement('div');label.className='opsSync';head.appendChild(label)}
    label.textContent=`Sincronizado às ${lastSyncAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
  }
  function connectionState(){
    document.querySelector('.opsConnection')?.remove();
    if(navigator.onLine)return;
    const el=document.createElement('div');el.className='opsConnection';el.innerHTML='● SEM INTERNET — os dados podem não atualizar';document.body.appendChild(el);
  }
  window.addEventListener('online',()=>{connectionState();showAppToast('Internet restabelecida. Atualizando a central…','ok');safeRefresh()});
  window.addEventListener('offline',connectionState);connectionState();

  function exportOrdersCsv(){
    const rows=finalShiftOrders(),header=['Pedido','Data','Cliente','Telefone','Tipo','Bairro','Pagamento','Status','Subtotal','Entrega','Desconto','Total','Itens'];
    const lines=rows.map(o=>[o.order_number,new Date(o.created_at).toLocaleString('pt-BR'),o.customer_name,o.customer_phone,orderTypeLabel(o.type),o.neighborhood_name||'',paymentLabel(o.payment),statusName(o.status),Number(o.subtotal||0).toFixed(2),Number(o.delivery_fee||0).toFixed(2),Number(o.discount||0).toFixed(2),Number(o.total||0).toFixed(2),(o.order_items||[]).map(i=>`${i.quantity||1}x ${i.product_name||'Item'}`).join(' | ')].map(csvCell).join(';'));
    download(`caseirao-pedidos-${todayKey()}.csv`,[header.map(csvCell).join(';'),...lines].join('\n'),'text/csv;charset=utf-8');showAppToast('Relatório CSV gerado.','ok');
  }
  function backupOperational(){
    const payload={gerado_em:new Date().toISOString(),versao:finalBuild,settings:admin?.settings||{},orders:finalShiftOrders(),products:admin?.products||[],neighborhoods:admin?.neighborhoods||[],addons:admin?.addons||[],coupons:admin?.coupons||[]};
    download(`caseirao-backup-${todayKey()}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');showAppToast('Backup operacional gerado.','ok');
  }
  function productRanking(orders){
    const map=new Map();orders.filter(o=>o.status!=='cancelado').forEach(o=>(o.order_items||[]).forEach(i=>{const key=i.product_name||'Item';map.set(key,(map.get(key)||0)+Number(i.quantity||1))}));return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  }
  function shareShift(){
    const rows=finalShiftOrders().filter(o=>o.status!=='cancelado'),sales=rows.reduce((s,o)=>s+Number(o.total||0),0),done=rows.filter(o=>o.status==='entregue').length;
    const text=`Fechamento parcial • O Caseirão Burger\n${rows.length} pedidos • ${done} concluídos\nVendas: ${money(sales)}\nAtualizado: ${new Date().toLocaleString('pt-BR')}`;
    if(navigator.share)navigator.share({title:'Resumo do Caseirão',text}).catch(()=>{});else copyText(text).then(()=>showAppToast('Resumo copiado.','ok'));
  }
  async function safeRefresh(){
    if(!sessionStorage.getItem('caseirao_admin_pin')||!navigator.onLine)return;
    const label=document.querySelector('.opsSync');label?.classList.add('busy');if(label)label.textContent='Sincronizando…';
    try{admin=await adminCall('snapshot');lastSyncAt=new Date();renderAdmin()}catch(e){showAppToast('Não foi possível atualizar agora.','err')}finally{syncLabel()}
  }
  function renderCommandCenter(box){
    const all=finalShiftOrders(),valid=all.filter(o=>o.status!=='cancelado'),active=liveOrders(),sales=valid.reduce((s,o)=>s+Number(o.total||0),0),ticket=valid.length?sales/valid.length:0,late=active.filter(o=>minutes(o)>=35),ready=active.filter(o=>o.status==='pronto'),newOnes=active.filter(o=>['novo','confirmado'].includes(o.status));
    const types=['delivery','pickup','counter','local'].map(type=>({name:orderTypeLabel(type),value:valid.filter(o=>o.type===type).length})),maxType=Math.max(1,...types.map(x=>x.value));
    const pays=['Pix','Dinheiro','Cartão'].map(name=>({name,value:valid.filter(o=>String(o.payment||'').toLowerCase().includes(name.toLowerCase())).reduce((s,o)=>s+Number(o.total||0),0)})),maxPay=Math.max(1,...pays.map(x=>x.value));
    const queue=[...active].sort((a,b)=>(minutes(b)>=35)-(minutes(a)>=35)||new Date(a.created_at)-new Date(b.created_at)).slice(0,7),ranking=productRanking(valid);
    box.innerHTML=`<section class="commandHero"><div class="commandHeroTop"><div><h2>Visão geral do turno</h2><p>Decisões rápidas com os dados da operação de hoje</p></div><span class="commandLive">AO VIVO</span></div><div class="commandKpis"><div class="commandKpi"><span>VENDAS</span><b>${money(sales)}</b></div><div class="commandKpi"><span>PEDIDOS</span><b>${valid.length}</b></div><div class="commandKpi"><span>TICKET MÉDIO</span><b>${money(ticket)}</b></div><div class="commandKpi"><span>EM ANDAMENTO</span><b>${active.length}</b></div></div></section><div class="slaStrip"><div class="slaCard"><span>Novos</span><b>${newOnes.length}</b></div><div class="slaCard"><span>Prontos</span><b>${ready.length}</b></div><div class="slaCard ${late.length?'danger':''}"><span>Atrasados +35 min</span><b>${late.length}</b></div><div class="slaCard"><span>Cancelados</span><b>${all.filter(o=>o.status==='cancelado').length}</b></div></div><div class="commandGrid"><section class="commandPanel"><div class="commandPanelHead"><b>Fila por prioridade</b><small>MAIS URGENTES PRIMEIRO</small></div><div class="commandQueue">${queue.length?queue.map(o=>`<button class="commandOrder ${minutes(o)>=35?'critical':''}" data-command-order="${esc(o.id)}"><strong>#${esc(o.order_number)}</strong><div><strong>${esc(o.customer_name||'Cliente')}</strong><span>${esc(statusName(o.status))} • ${esc(orderTypeLabel(o.type))}</span></div><b class="commandAge">${minutes(o)} min</b></button>`).join(''):'<div class="commandEmpty">✓ Nenhum pedido aguardando. Operação em dia.</div>'}</div></section><section class="commandPanel"><div class="commandPanelHead"><b>Canais de venda</b><small>PEDIDOS</small></div><div class="commandBars">${types.map(x=>`<div><div class="commandBarTop"><span>${esc(x.name)}</span><b>${x.value}</b></div><div class="commandTrack"><div class="commandFill" style="width:${x.value/maxType*100}%"></div></div></div>`).join('')}</div><div class="commandPanelHead" style="margin-top:18px"><b>Recebimentos</b><small>VALOR</small></div><div class="commandBars">${pays.map(x=>`<div><div class="commandBarTop"><span>${x.name}</span><b>${money(x.value)}</b></div><div class="commandTrack"><div class="commandFill" style="width:${x.value/maxPay*100}%"></div></div></div>`).join('')}</div></section><section class="commandPanel"><div class="commandPanelHead"><b>Mais vendidos</b><small>UNIDADES</small></div>${ranking.length?ranking.map(([name,count],i)=>`<div class="commandRank"><i>${i+1}</i><b>${esc(name)}</b><strong>${count}</strong></div>`).join(''):'<div class="commandEmpty">O ranking aparecerá após as vendas.</div>'}</section><section class="commandPanel"><div class="commandPanelHead"><b>Ferramentas do turno</b><small>${esc(finalBuild)}</small></div><p class="mini">Exporte os pedidos para Excel, gere uma cópia de segurança ou compartilhe o resumo parcial.</p><div class="commandActions"><button data-export-csv>BAIXAR RELATÓRIO CSV</button><button data-backup-ops>GERAR BACKUP</button><button data-share-shift>COMPARTILHAR RESUMO</button></div></section></div>`;
    box.querySelectorAll('[data-command-order]').forEach(button=>button.onclick=()=>{adminTab='pedidos';renderAdmin();requestAnimationFrame(()=>{const target=[...document.querySelectorAll('[data-oid]')].find(x=>String(x.dataset.oid)===String(button.dataset.commandOrder))?.closest('details');if(target){target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'})}})});
    box.querySelector('[data-export-csv]')?.addEventListener('click',exportOrdersCsv);box.querySelector('[data-backup-ops]')?.addEventListener('click',backupOperational);box.querySelector('[data-share-shift]')?.addEventListener('click',shareShift);
  }
  function addOrderTools(box){
    const active=liveOrders(),ages=active.map(minutes),average=ages.length?Math.round(ages.reduce((a,b)=>a+b,0)/ages.length):0;
    const strip=document.createElement('div');strip.className='slaStrip';strip.innerHTML=`<div class="slaCard"><span>Fila ativa</span><b>${active.length}</b></div><div class="slaCard"><span>Espera média</span><b>${average} min</b></div><div class="slaCard ${active.some(o=>minutes(o)>=35)?'danger':''}"><span>Acima de 35 min</span><b>${active.filter(o=>minutes(o)>=35).length}</b></div><div class="slaCard"><span>Prontos / rota</span><b>${active.filter(o=>['pronto','em_rota'].includes(o.status)).length}</b></div>`;box.prepend(strip);
    const tools=document.createElement('div');tools.className='opsTools';tools.innerHTML='<button data-orders-export>⬇ EXPORTAR PEDIDOS DO TURNO</button><button data-orders-refresh>↻ SINCRONIZAR AGORA</button>';strip.after(tools);tools.querySelector('[data-orders-export]').onclick=exportOrdersCsv;tools.querySelector('[data-orders-refresh]').onclick=safeRefresh;
    finalShiftOrders().forEach(o=>{const marker=box.querySelector(`[data-oid="${CSS.escape(String(o.id))}"]`),card=marker?.closest('.orderDetailed');if(!card)return;const summary=card.querySelector('.summaryCustomer')||card.querySelector('.ordertop>div');if(summary&&!summary.querySelector('.opsSlaBadge')){const age=minutes(o),badge=document.createElement('span');badge.className=`opsSlaBadge ${['entregue','cancelado'].includes(o.status)?'ok':age>=35?'late':age>=25?'warn':''}`;badge.textContent=['entregue','cancelado'].includes(o.status)?statusName(o.status):`${age} min de espera`;summary.appendChild(badge)}const body=card.querySelector('.orderBody')||card;if(body&&!body.querySelector('.opsContactRow')){const row=document.createElement('div');row.className='opsContactRow';const phone=String(o.customer_phone||'').replace(/\D/g,'');row.innerHTML=`${phone?`<a href="https://wa.me/55${esc(phone.replace(/^55/,''))}" target="_blank" rel="noopener">WHATSAPP DO CLIENTE</a>`:'<button disabled>SEM TELEFONE</button>'}<button data-copy-order="${esc(o.id)}">COPIAR RESUMO</button>`;body.appendChild(row);row.querySelector('[data-copy-order]')?.addEventListener('click',()=>copyText(receiptPlain(o)).then(()=>showAppToast('Resumo do pedido copiado.','ok')))}});
  }

  const adminBase=renderAdmin;
  renderAdmin=function(){const result=adminBase();const bar=document.querySelector('.sheet.full>.admbar');if(bar&&!bar.querySelector('[data-tab="visao"]')){const button=document.createElement('button');button.dataset.tab='visao';button.textContent='Visão geral';button.className=adminTab==='visao'?'on':'';button.onclick=()=>{adminTab='visao';renderAdmin()};bar.prepend(button)}if(adminTab==='visao'){const box=$('#admContent');if(box)renderCommandCenter(box)}syncLabel();return result};
  const tabBase=renderAdminTab;
  renderAdminTab=function(){if(adminTab==='visao'){const box=$('#admContent');if(box)renderCommandCenter(box);return}return tabBase()};
  const ordersBase=renderOrders;
  renderOrders=function(box){const result=ordersBase(box);addOrderTools(box);return result};

  const adminCallBase=adminCall;
  adminCall=async function(...args){const value=await adminCallBase(...args);lastSyncAt=new Date();queueMicrotask(syncLabel);return value};
  clearInterval(syncTimer);syncTimer=setInterval(()=>{if(document.visibilityState==='visible'&&sessionStorage.getItem('caseirao_admin_pin'))syncLabel()},1000);
  const validTabsFinal=new Set(['visao','pedidos','producao','caixa','gestao','fidelidade','relatorios','produtos','bairros','adicionais','cupons','banner','loja','mesas','funcionarios','promocoes','entregas']);
  try{const area=sessionStorage.getItem(internalResumeKey)||'';if(area.startsWith('admin:')&&!validTabsFinal.has(area.slice(6)))sessionStorage.setItem(internalResumeKey,'admin:pedidos')}catch{}
})();

/* Filtra os cartões sem reconstruir o campo e sem fechar o teclado. */
document.addEventListener('input',event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||input.id!=='loyaltySearch')return;
  event.stopImmediatePropagation();
  const term=input.value.trim().toLocaleLowerCase('pt-BR');
  const root=input.closest('#admContent')||document;
  root.querySelectorAll('.loyaltyCard').forEach(card=>{
    if(card.querySelector('#loyaltyTarget'))return;
    card.classList.toggle('hide',Boolean(term)&&!card.textContent.toLocaleLowerCase('pt-BR').includes(term));
  });
},true);

(()=>{
  const phone=value=>typeof phoneMask==='function'?phoneMask(value):String(value||'');
  async function openLoyaltyParticipants(){
    document.querySelector('.loyaltyParticipantsLayer')?.remove();
    const layer=document.createElement('div');layer.className='loyaltyParticipantsLayer';
    layer.innerHTML='<section class="loyaltyParticipantsPanel"><div class="loyaltyParticipantsHead"><div><h2>Clientes participantes</h2><p>Nome, WhatsApp e quantidade contabilizada</p></div><button class="loyaltyParticipantsClose" aria-label="Fechar">×</button></div><div class="notice">Carregando participantes...</div></section>';
    document.body.appendChild(layer);layer.querySelector('.loyaltyParticipantsClose').onclick=()=>layer.remove();layer.onclick=event=>{if(event.target===layer)layer.remove()};
    try{
      const result=await loyaltyAdmin('snapshot'),customers=(result.customers||[]).slice().sort((a,b)=>Number(b.order_count||0)-Number(a.order_count||0));
      const panel=layer.querySelector('.loyaltyParticipantsPanel');
      panel.innerHTML=`<div class="loyaltyParticipantsHead"><div><h2>Clientes participantes</h2><p>${customers.length} clientes participando da fidelidade</p></div><button class="loyaltyParticipantsClose" aria-label="Fechar">×</button></div><input class="loyaltyParticipantsSearch" placeholder="Buscar nome ou WhatsApp..." autocomplete="off"><div class="loyaltyParticipantsList">${customers.map(customer=>{const name=String(customer.display_name||customer.name||'Cliente sem nome').trim(),number=String(customer.phone||''),count=Number(customer.order_count||0),search=`${name} ${number}`.toLocaleLowerCase('pt-BR');return `<article class="loyaltyParticipant" data-participant data-search="${esc(search)}"><div><strong>${esc(name)}</strong><span>${esc(phone(number))}</span></div><div class="loyaltyParticipantCount"><b>${count}</b><small>${count===1?'pedido':'pedidos'}</small></div></article>`}).join('')||'<div class="loyaltyParticipantsEmpty">Nenhum cliente participante.</div>'}</div>`;
      panel.querySelector('.loyaltyParticipantsClose').onclick=()=>layer.remove();
      panel.querySelector('.loyaltyParticipantsSearch').addEventListener('input',event=>{const term=event.target.value.trim().toLocaleLowerCase('pt-BR');panel.querySelectorAll('[data-participant]').forEach(card=>card.classList.toggle('hide',Boolean(term)&&!card.dataset.search.includes(term)))});
    }catch(error){layer.querySelector('.loyaltyParticipantsPanel').innerHTML=`<div class="loyaltyParticipantsHead"><div><h2>Clientes participantes</h2><p>Não foi possível carregar agora</p></div><button class="loyaltyParticipantsClose">×</button></div><div class="err">${esc(error.message||String(error))}</div>`;layer.querySelector('.loyaltyParticipantsClose').onclick=()=>layer.remove()}
  }
  const mountButton=()=>{if(typeof adminTab==='undefined'||adminTab!=='fidelidade')return;const box=document.querySelector('#admContent');if(!box||box.querySelector('.loyaltyParticipantsButton'))return;const button=document.createElement('button');button.type='button';button.className='loyaltyParticipantsButton';button.textContent='👥 VER CLIENTES PARTICIPANTES';button.onclick=openLoyaltyParticipants;box.prepend(button)};
  /* Sem observer global e sem timer duplicado. */
  queueMicrotask(mountButton);
})();

/* Mantém a aba ativa visível e alinhada ao conteúdo selecionado. */
(()=>{
  let requestedTab='';
  function centerActiveAdminTab(smooth=false){
    const bar=document.querySelector('.sheet.full>.admbar');
    if(!bar)return;
    const active=(requestedTab&&bar.querySelector(`[data-tab="${CSS.escape(requestedTab)}"]`))||bar.querySelector('button.on');
    if(!active)return;
    bar.querySelectorAll('button[data-tab]').forEach(button=>button.classList.toggle('on',button===active));
    const left=Math.max(0,active.offsetLeft-(bar.clientWidth-active.offsetWidth)/2);
    bar.scrollTo({left,behavior:smooth?'smooth':'auto'});
    requestedTab=active.dataset.tab||requestedTab;
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.sheet.full>.admbar button[data-tab]');
    if(!button)return;
    requestedTab=button.dataset.tab||'';
    setTimeout(()=>centerActiveAdminTab(true),20);
    setTimeout(()=>centerActiveAdminTab(false),140);
  },true);
  /* Sem observar document.body a cada reconstrução do ADM. */
  window.addEventListener('resize',()=>centerActiveAdminTab(false));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)centerActiveAdminTab(false)});
})();

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
/* Ponte oficial entre o nucleo do ADM e os modulos visuais carregados abaixo.
   Getters e setters mantem uma unica referencia: quando um modulo aprimora uma
   funcao, todos os botoes e fluxos internos passam a usar a versao aprimorada. */
const exposeCaseirao=(name,getter,setter)=>Object.defineProperty(window,name,{configurable:true,get:getter,set:setter});
exposeCaseirao('renderAdmin',()=>renderAdmin,value=>{renderAdmin=value});
exposeCaseirao('renderAdminTab',()=>renderAdminTab,value=>{renderAdminTab=value});
exposeCaseirao('orderAdminCard',()=>orderAdminCard,value=>{orderAdminCard=value});
exposeCaseirao('adminTab',()=>adminTab,value=>{adminTab=value});
Object.assign(window,{api,customerWhatsAppNumber,esc,$,num,showAppToast});

/* ===== IMPRESSAO BLUETOOTH AUTOMATICA • 58/80 MM ===== */
const PRINTER_PREF_KEY='caseirao_printer_prefs_v1';
function printerPrefs(){try{return {...{paper:'58',auto:false},...JSON.parse(localStorage.getItem(PRINTER_PREF_KEY)||'{}')}}catch{return {paper:'58',auto:false}}}
function savePrinterPrefs(next){const value={...printerPrefs(),...next};localStorage.setItem(PRINTER_PREF_KEY,JSON.stringify(value));return value}
function printerPaperWidth(){return printerPrefs().paper==='80'?80:58}
function printerTextWidth(){return printerPaperWidth()===80?48:32}
function printerConnected(){return !!(btWriteChar&&btDevice?.gatt?.connected)}
function printerStatusText(){return printerConnected()?`🟢 CONECTADA • ${btPrinterName||'Impressora Bluetooth'}`:'🔴 DESCONECTADA'}
function refreshPrinterStatus(){const el=$('#printerState');if(!el)return;el.textContent=printerStatusText();el.className='printerState '+(printerConnected()?'connected':'error')}

const receiptPlainPaperBase=receiptPlain;
receiptPlain=function(o){
  const width=printerTextWidth(),hr='-'.repeat(width),L=[];
  const wr=t=>wrapReceipt(t,width);
  L.push('O CASEIRAO BURGER',`PEDIDO #${o.order_number}`,new Date(o.created_at).toLocaleString('pt-BR'),hr,`CLIENTE: ${o.customer_name||''}`,`FONE: ${o.customer_phone||''}`,`TIPO: ${orderTypeLabel(o.type)}`);
  if(o.type==='delivery'){L.push(hr,'ENDERECO:',...wr(orderAddress(o)))}
  L.push(hr,`PAGAMENTO: ${paymentLabel(o.payment)}`);if(o.change_for)L.push(`TROCO PARA: ${o.change_for}`);L.push(hr,'ITENS:');
  (o.order_items||[]).forEach(it=>{L.push(...wr(`${it.quantity||1}x ${it.product_name||'Item'}  ${fmt(it.line_total||0)}`));(it.order_item_addons||[]).forEach(a=>L.push(...wr(`  + ${a.addon_name}${Number(a.price||0)>0?' '+fmt(a.price):''}`)));if(it.note)L.push(...wr(`  OBS: ${it.note}`))});
  if(o.notes)L.push(hr,'OBSERVACOES:',...wr(o.notes));L.push(hr,`SUBTOTAL: ${fmt(o.subtotal)}`);if(Number(o.delivery_fee||0))L.push(`ENTREGA: ${fmt(o.delivery_fee)}`);if(Number(o.delivery_discount||0))L.push(`DESC. ENTREGA: -${fmt(o.delivery_discount)}`);if(Number(o.discount||0))L.push(`DESCONTO: -${fmt(o.discount)}`);L.push(`TOTAL: ${fmt(o.total)}`,hr,`CODIGO: ${o.tracking_code||''}`,'','','');return stripAccents(L.join('\n'));
};
const receiptBrowserPaperBase=receiptBrowserHtml;
receiptBrowserHtml=function(o){const mm=printerPaperWidth(),body=mm===80?76:54;return receiptBrowserPaperBase(o).replace('@page{size:58mm auto;margin:2mm}',`@page{size:${mm}mm auto;margin:2mm}`).replace('width:54mm',`width:${body}mm`)};

const connectBluetoothPrinterStatusBase=connectBluetoothPrinter;
connectBluetoothPrinter=async function(){try{const name=await connectBluetoothPrinterStatusBase();refreshPrinterStatus();return name}catch(e){refreshPrinterStatus();throw e}};

async function printOrderBluetoothAuto(id,sourceOrders=null,silent=false){
  const o=(sourceOrders||admin?.orders||[]).find(x=>String(x.id)===String(id));if(!o)return false;
  if(!printerConnected()){refreshPrinterStatus();if(!silent)alert('Impressora Bluetooth desconectada. Toque em CONECTAR BLUETOOTH primeiro.');return false}
  try{setPrinterState(`Imprimindo pedido #${o.order_number}...`,'connected');await btWrite(await escposBytes(o));setPrinterState(`🟢 CONECTADA • Pedido #${o.order_number} impresso`,'connected');return true}catch(e){btWriteChar=null;refreshPrinterStatus();if(!silent)alert(e.message||String(e));return false}
}
printOrderBluetooth=async function(id,sourceOrders=null){return printOrderBluetoothAuto(id,sourceOrders,false)};

const renderOrdersPrinterBase=renderOrders;
renderOrders=function(box){
  const result=renderOrdersPrinterBase(box),bar=box.querySelector('.printerBar');
  if(bar){const prefs=printerPrefs();bar.innerHTML=`<div class="printerBarTop"><div class="grow"><b>🖨️ Impressora Bluetooth</b><div id="printerState" class="printerState"></div></div><button id="connectPrinter" class="printerConnect">CONECTAR BLUETOOTH</button></div><div class="printerConfigGrid"><label><span>Largura do papel</span><select id="printerPaper" class="sel"><option value="58" ${prefs.paper==='58'?'selected':''}>58 mm</option><option value="80" ${prefs.paper==='80'?'selected':''}>80 mm</option></select></label><label class="printerAutoToggle"><input id="printerAuto" type="checkbox" ${prefs.auto?'checked':''}><span><b>Impressão automática</b><small>Imprime pedido novo quando o Bluetooth já estiver conectado.</small></span></label><button id="printerTest" class="secondary">IMPRIMIR TESTE</button></div>`;
    $('#connectPrinter').onclick=async()=>{try{await connectBluetoothPrinter()}catch(e){refreshPrinterStatus();alert(e.message||String(e))}};
    $('#printerPaper').onchange=e=>{savePrinterPrefs({paper:e.target.value});showAppToast(`Impressora configurada para ${e.target.value} mm.`,'ok')};
    $('#printerAuto').onchange=e=>{savePrinterPrefs({auto:e.target.checked});showAppToast(e.target.checked?'Impressão automática ativada.':'Impressão automática desativada.','ok')};
    $('#printerTest').onclick=async()=>{if(!printerConnected())return alert('Conecte a impressora Bluetooth primeiro.');const width=printerTextWidth(),text=stripAccents(`O CASEIRAO BURGER\nTESTE DE IMPRESSAO\nPAPEL: ${printerPaperWidth()} mm\n${'-'.repeat(width)}\nBluetooth conectado OK\n\n\n`);try{await btWrite(new TextEncoder().encode(text));setPrinterState('🟢 CONECTADA • Teste enviado','connected')}catch(e){alert(e.message||String(e));refreshPrinterStatus()}};
    refreshPrinterStatus();
  }
  bindPrintButtons();return result;
};

const checkNewOrdersAutoPrintBase=checkNewOrders;
/* Motor antigo desativado: a impressão automática é controlada pelo motor seguro abaixo. */
checkNewOrders=async function(){return await checkNewOrdersAutoPrintBase();};

const printerExtraStyle=document.createElement('style');printerExtraStyle.textContent=`.printerState.connected{color:#16833d!important;font-weight:900}.printerState.error{color:#c43131!important;font-weight:900}.printerConfigGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:10px;align-items:stretch}.printerConfigGrid>label,.printerConfigGrid>button{border:1px solid #dfe3e7;border-radius:12px;padding:10px;background:#fff}.printerConfigGrid label>span:first-child{display:block;font-size:11px;font-weight:900;margin-bottom:6px}.printerAutoToggle{display:flex!important;align-items:center;gap:9px}.printerAutoToggle input{width:20px;height:20px}.printerAutoToggle span{display:flex!important;flex-direction:column}.printerAutoToggle small{font-size:10px;color:#6f7782;margin-top:2px}@media(max-width:700px){.printerConfigGrid{grid-template-columns:1fr}}`;document.head.appendChild(printerExtraStyle);


/* ===== PROTECAO CONTRA PEDIDO / IMPRESSAO DUPLICADOS ===== */
let caseiraoOrderSubmitLocked=false;
const sendOrderDuplicateSafeBase=sendOrder;
sendOrder=async function(){
  const btn=$('#sendOrder');
  if(caseiraoOrderSubmitLocked){
    if(btn){btn.disabled=true;btn.textContent='PEDIDO JÁ ESTÁ SENDO ENVIADO...'}
    return;
  }
  caseiraoOrderSubmitLocked=true;
  if(btn){btn.disabled=true;btn.dataset.submitLocked='1'}
  try{
    return await sendOrderDuplicateSafeBase();
  }finally{
    /* Se a tela de checkout ainda estiver aberta, a tentativa falhou e pode ser refeita.
       Se o pedido foi aceito, o botão original já não existe e o bloqueio é liberado
       somente para um novo checkout. */
    caseiraoOrderSubmitLocked=false;
    const current=$('#sendOrder');
    if(current){current.dataset.submitLocked='0';if(!current.disabled)current.textContent='CONFIRMAR E ENVIAR'}
  }
};

const AUTO_PRINTED_KEY='caseirao_auto_printed_orders_v2';
const AUTO_PRINT_PENDING_KEY='caseirao_auto_print_pending_v2';
function autoPrintedOrders(){try{return new Set(JSON.parse(localStorage.getItem(AUTO_PRINTED_KEY)||'[]').map(String))}catch{return new Set()}}
function saveAutoPrinted(set){localStorage.setItem(AUTO_PRINTED_KEY,JSON.stringify([...set].slice(-500)))}
function markAutoPrinted(id){const set=autoPrintedOrders();set.add(String(id));saveAutoPrinted(set)}
function wasAutoPrinted(id){return autoPrintedOrders().has(String(id))}
function pendingAutoPrintIds(){try{return new Set(JSON.parse(localStorage.getItem(AUTO_PRINT_PENDING_KEY)||'[]').map(String))}catch{return new Set()}}
function savePendingAutoPrint(set){localStorage.setItem(AUTO_PRINT_PENDING_KEY,JSON.stringify([...set].slice(-200)))}
function queueAutoPrint(id){const set=pendingAutoPrintIds();set.add(String(id));savePendingAutoPrint(set);refreshPendingPrintStatus()}
function unqueueAutoPrint(id){const set=pendingAutoPrintIds();set.delete(String(id));savePendingAutoPrint(set);refreshPendingPrintStatus()}
function caseiraoOrderHasItems(o){return Array.isArray(o?.order_items)&&o.order_items.length>0}
async function caseiraoRefreshUntilItems(orderId,attempts=4,delayMs=550){
  let latest=admin;
  for(let i=0;i<attempts;i++){
    const found=(latest?.orders||[]).find(x=>String(x.id)===String(orderId));
    if(caseiraoOrderHasItems(found))return found;
    if(i<attempts-1)await new Promise(r=>setTimeout(r,delayMs));
    try{latest=await adminCall('snapshot');admin=latest}catch{}
  }
  return (admin?.orders||[]).find(x=>String(x.id)===String(orderId))||null;
}
function eligibleForAutoPrint(o){
  if(!o||o.source==='manual'||['cancelado','entregue'].includes(String(o.status||'')))return false;
  const pay=String(o.payment||'').toLowerCase();
  if(pay==='pix')return String(o.payment_status||'').toLowerCase()==='confirmed';
  return true;
}
function cleanPendingAutoPrint(){
  const pending=pendingAutoPrintIds();
  if(!pending.size)return pending;
  const orders=admin?.orders||[];
  const byId=new Map(orders.map(o=>[String(o.id),o]));
  let changed=false;
  for(const id of [...pending]){
    const o=byId.get(String(id));
    if(!o||!eligibleForAutoPrint(o)||wasAutoPrinted(id)){
      pending.delete(String(id));changed=true;
    }
  }
  if(changed)savePendingAutoPrint(pending);
  return pending;
}
function refreshPendingPrintStatus(){
  const n=cleanPendingAutoPrint().size;
  document.querySelectorAll('[data-print-pending]').forEach(el=>{
    el.textContent=n?`${n} pedido${n===1?'':'s'} aguardando impressão`:'Nenhum pedido aguardando impressão';
    el.classList.toggle('hasPending',n>0);
  });
}
async function flushPendingAutoPrint(){
  if(!printerPrefs().auto||!printerConnected()||autoPrintQueueBusy)return;
  const pending=cleanPendingAutoPrint();if(!pending.size)return;
  autoPrintQueueBusy=true;
  try{
    for(const id of [...pending]){
      const o=(admin?.orders||[]).find(x=>String(x.id)===String(id));
      if(!o){unqueueAutoPrint(id);continue}
      if(wasAutoPrinted(id)){unqueueAutoPrint(id);continue}
      if(!eligibleForAutoPrint(o)){unqueueAutoPrint(id);continue}
      let printable=o;
      if(!caseiraoOrderHasItems(printable)){
        printable=await caseiraoRefreshUntilItems(id,4,600);
        if(!caseiraoOrderHasItems(printable)){
          /* Mantém na fila: nunca imprime automaticamente um pedido sem os itens. */
          refreshPendingPrintStatus();
          continue;
        }
      }
      /* Reserva antes do envio para impedir dois disparos concorrentes. */
      markAutoPrinted(id);
      const ok=await printOrderBluetoothAuto(id,[printable,...(admin?.orders||[]).filter(x=>String(x.id)!==String(id))],true);
      if(ok)unqueueAutoPrint(id);
      else{const printed=autoPrintedOrders();printed.delete(String(id));saveAutoPrinted(printed);break}
    }
  }finally{autoPrintQueueBusy=false;refreshPendingPrintStatus()}
}

/* Um único motor de impressão automática:
   - pedido manual não dispara sozinho;
   - Pix só imprime confirmado;
   - pedido não imprime duas vezes;
   - se Bluetooth cair, entra na fila e imprime após reconectar. */
let autoPrintQueueBusy=false;
const checkNewOrdersPrintDedupeBase=checkNewOrders;
checkNewOrders=async function(){
  const before=new Set((admin?.orders||[]).map(o=>String(o.id)));
  await checkNewOrdersPrintDedupeBase();
  if(!printerPrefs().auto)return;
  const candidates=(admin?.orders||[]).filter(o=>!before.has(String(o.id))&&eligibleForAutoPrint(o)&&!wasAutoPrinted(o.id));
  for(const o of candidates)queueAutoPrint(o.id);
  if(printerConnected())await flushPendingAutoPrint();
  else if(candidates.length){refreshPrinterStatus();showAppToast('Pedido recebido. Ficou aguardando a impressora Bluetooth conectar.','warn')}
};


/* ===== PAINEL BLUETOOTH RESILIENTE • OPERACAO =====
   Mantem os controles visiveis mesmo quando a interface profissional
   substitui/reorganiza o renderizador original de pedidos. */
function caseiraoPrinterPanelHtml(){
  const prefs=printerPrefs();
  return `<section id="caseiraoPrinterPanel" class="printerBar caseiraoPrinterPanel">
    <div class="printerBarTop">
      <div class="grow"><b>🖨️ Impressora</b><div id="printerState" class="printerState"></div></div>
      <button type="button" id="printerConfigToggle" class="secondary printerConfigToggle">CONFIGURAR</button>
      <button type="button" id="connectPrinter" class="printerConnect">CONECTAR</button>
    </div>
    <div class="printerConfigGrid printerConfigCollapsed">
      <label><span>Largura do papel</span><select id="printerPaper" class="sel"><option value="58" ${prefs.paper==='58'?'selected':''}>58 mm</option><option value="80" ${prefs.paper==='80'?'selected':''}>80 mm</option></select></label>
      <label class="printerAutoToggle"><input id="printerAuto" type="checkbox" ${prefs.auto?'checked':''}><span><b>Impressão automática</b><small>Pedido novo imprime sozinho após conectar.</small></span></label>
      <button type="button" id="printerTest" class="secondary">IMPRIMIR TESTE</button>
      <div class="printerPending" data-print-pending>Nenhum pedido aguardando impressão</div>
    </div>
  </section>`;
}
function bindCaseiraoPrinterPanel(){
  const panel=document.querySelector('#caseiraoPrinterPanel');if(!panel)return;
  const connect=panel.querySelector('#connectPrinter'),paper=panel.querySelector('#printerPaper'),auto=panel.querySelector('#printerAuto'),test=panel.querySelector('#printerTest');
  const toggle=panel.querySelector('#printerConfigToggle'),grid=panel.querySelector('.printerConfigGrid');
  if(toggle&&!toggle.dataset.bound){toggle.dataset.bound='1';toggle.onclick=()=>{const open=grid?.classList.toggle('printerConfigOpen');toggle.textContent=open?'FECHAR':'CONFIGURAR'}}
  if(connect&&!connect.dataset.bound){connect.dataset.bound='1';connect.onclick=async()=>{try{await connectBluetoothPrinter();refreshPrinterStatus();await flushPendingAutoPrint()}catch(e){refreshPrinterStatus();const msg=String(e?.message||e||'');if(/cancelled|canceled|chooser/i.test(msg))showAppToast('Seleção Bluetooth cancelada. Toque em CONECTAR quando quiser tentar novamente.','warn');else alert(msg)}}}
  if(paper&&!paper.dataset.bound){paper.dataset.bound='1';paper.onchange=e=>{savePrinterPrefs({paper:e.target.value});showAppToast(`Impressora configurada para ${e.target.value} mm.`,'ok')}}
  if(auto&&!auto.dataset.bound){auto.dataset.bound='1';auto.onchange=async e=>{savePrinterPrefs({auto:e.target.checked});showAppToast(e.target.checked?'Impressão automática ativada.':'Impressão automática desativada.','ok');if(e.target.checked)await flushPendingAutoPrint();refreshPendingPrintStatus()}}
  if(test&&!test.dataset.bound){test.dataset.bound='1';test.onclick=async()=>{if(!printerConnected())return alert('Conecte a impressora pelo botão CONECTAR BLUETOOTH primeiro.');const width=printerTextWidth(),text=stripAccents(`O CASEIRAO BURGER\nTESTE DE IMPRESSAO\nPAPEL: ${printerPaperWidth()} mm\n${'-'.repeat(width)}\nBluetooth conectado OK\n\n\n`);try{await btWrite(new TextEncoder().encode(text));setPrinterState('🟢 CONECTADA • Teste enviado','connected')}catch(e){refreshPrinterStatus();alert(e.message||String(e))}}}
  refreshPrinterStatus();refreshPendingPrintStatus();
}
function ensureCaseiraoPrinterPanel(){
  const box=document.querySelector('#admContent');if(!box||adminTab!=='pedidos')return;
  let panel=box.querySelector('#caseiraoPrinterPanel');
  if(!panel){
    const old=box.querySelector('.printerBar');
    if(old){old.outerHTML=caseiraoPrinterPanelHtml()}
    else{
      const anchor=box.querySelector('input[placeholder*="Buscar pedido"],input[placeholder*="Buscar"],#manualOrder,[id*="manualOrder"]');
      const host=anchor?.closest('.searchBox,.orderSearch,.manualOrderBox')||anchor?.parentElement;
      if(host)host.insertAdjacentHTML('beforebegin',caseiraoPrinterPanelHtml());else box.insertAdjacentHTML('afterbegin',caseiraoPrinterPanelHtml());
    }
  }
  bindCaseiraoPrinterPanel();
}
/* CORRECAO LOGIN/TRAVAMENTO: observador global removido.
   O painel Bluetooth e montado somente pelo renderOrders final. */

/* Nunca abre o seletor de dispositivo por uma impressao. O seletor Bluetooth
   aparece somente quando o operador toca em CONECTAR BLUETOOTH. */
btWrite=async function(bytes){
  if(!btWriteChar||!btDevice?.gatt?.connected)throw new Error('Impressora Bluetooth desconectada. Toque em CONECTAR BLUETOOTH primeiro.');
  const chunk=20;
  for(let i=0;i<bytes.length;i+=chunk){const part=bytes.slice(i,i+chunk);if(btWriteChar.properties.writeWithoutResponse&&btWriteChar.writeValueWithoutResponse)await btWriteChar.writeValueWithoutResponse(part);else if(btWriteChar.properties.write&&btWriteChar.writeValueWithResponse)await btWriteChar.writeValueWithResponse(part);else await btWriteChar.writeValue(part);await new Promise(r=>setTimeout(r,10))}
};

const printerPanelStyle=document.createElement('style');printerPanelStyle.textContent=`#caseiraoPrinterPanel{display:block!important;margin:0 0 8px!important;padding:8px 10px!important;border:1px solid #cfdfeb!important;border-radius:14px!important;background:#eef6fb!important}#caseiraoPrinterPanel .printerBarTop{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto!important;gap:6px!important;align-items:center!important}#caseiraoPrinterPanel .printerConnect,#caseiraoPrinterPanel .printerConfigToggle{min-height:34px!important;height:34px!important;width:auto!important;padding:5px 9px!important;margin:0!important;font-size:9px!important}#caseiraoPrinterPanel .printerConfigGrid{display:none!important;grid-template-columns:1fr 1.35fr 1fr!important;gap:9px!important;margin-top:8px!important}#caseiraoPrinterPanel .printerConfigGrid.printerConfigOpen{display:grid!important}#caseiraoPrinterPanel .printerAutoToggle{align-items:center!important;gap:10px!important}#caseiraoPrinterPanel .printerAutoToggle input{display:block!important;appearance:auto!important;width:22px!important;height:22px!important;opacity:1!important;position:static!important}@media(max-width:700px){#caseiraoPrinterPanel .printerBarTop{grid-template-columns:minmax(0,1fr) auto auto!important;align-items:center!important}#caseiraoPrinterPanel .printerConfigGrid.printerConfigOpen{grid-template-columns:1fr!important}}`;document.head.appendChild(printerPanelStyle);
const printerPendingStyle=document.createElement('style');printerPendingStyle.textContent=`#caseiraoPrinterPanel .printerPending{grid-column:1/-1;padding:8px 10px;border-radius:10px;background:#f7f9fb;color:#6d7580;font-size:10px;font-weight:800;text-align:center}#caseiraoPrinterPanel .printerPending.hasPending{background:#fff3d6;color:#8b5a00}`;document.head.appendChild(printerPendingStyle);


/* ===== CORRECAO FINAL • PAINEL BLUETOOTH FIXO NA OPERACAO =====
   Monta o painel diretamente no render final da Operacao. Nao depende de
   MutationObserver nem da printerBar antiga, evitando que o layout profissional
   esconda os controles. */
const renderOrdersBluetoothPanelFinalBase=renderOrders;
renderOrders=function(box){
  const result=renderOrdersBluetoothPanelFinalBase(box);
  if(box){
    box.querySelector('#caseiraoPrinterPanel')?.remove();
    box.insertAdjacentHTML('afterbegin',caseiraoPrinterPanelHtml());
    bindCaseiraoPrinterPanel();
  }
  return result;
};


})();


/* ===== CASEIRAO • BLUETOOTH STABLE FIX 2026-09-23 =====
   Fluxo unico para a impressora: reutiliza o dispositivo autorizado,
   reconecta o GATT sem reabrir o seletor, serializa escritas e usa
   cupom ESC/POS leve (sem logo/QR) para evitar sobrecarga no BLE. */
let caseiraoBtWriteChain=Promise.resolve();
let caseiraoBtConnecting=null;

async function caseiraoFindWriteCharacteristic(server){
  for(const p of BT_PROFILES){
    try{
      const service=await server.getPrimaryService(p.service);
      for(const cid of p.chars){
        try{
          const c=await service.getCharacteristic(cid);
          if(c.properties.write||c.properties.writeWithoutResponse)return c;
        }catch(e){}
      }
      try{
        const chars=await service.getCharacteristics();
        const c=chars.find(x=>x.properties.write||x.properties.writeWithoutResponse);
        if(c)return c;
      }catch(e){}
    }catch(e){}
  }
  try{
    const services=await server.getPrimaryServices();
    for(const service of services){
      try{
        const chars=await service.getCharacteristics();
        const c=chars.find(x=>x.properties.write||x.properties.writeWithoutResponse);
        if(c)return c;
      }catch(e){}
    }
  }catch(e){}
  return null;
}

async function caseiraoConnectKnownDevice(device){
  if(!device?.gatt)throw new Error('A impressora selecionada não oferece conexão BLE/GATT.');
  const server=device.gatt.connected?device.gatt:await device.gatt.connect();
  const characteristic=await caseiraoFindWriteCharacteristic(server);
  if(!characteristic){
    try{server.disconnect()}catch(e){}
    throw new Error('Bluetooth conectado, mas o canal de impressão não foi encontrado.');
  }
  btDevice=device;
  btWriteChar=characteristic;
  btPrinterName=device.name||'Impressora Bluetooth';
  if(!device.__caseiraoDisconnectBound){
    device.__caseiraoDisconnectBound=true;
    device.addEventListener('gattserverdisconnected',()=>{
      btWriteChar=null;
      setPrinterState('🔴 DESCONECTADA • reconecta automaticamente ao imprimir','error');
      try{refreshPrinterStatus()}catch(e){}
    });
  }
  setPrinterState(`🟢 CONECTADA • ${btPrinterName}`,'connected');
  try{refreshPrinterStatus()}catch(e){}
  return btPrinterName;
}

connectBluetoothPrinter=async function(){
  if(caseiraoBtConnecting)return caseiraoBtConnecting;
  caseiraoBtConnecting=(async()=>{
    if(!navigator.bluetooth)throw new Error('Abra a Central no Google Chrome do Android para usar Bluetooth.');
    let device=btDevice;
    if(!device){
      setPrinterState('Abrindo lista de dispositivos Bluetooth...');
      device=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:BT_PROFILES.map(p=>p.service)});
    }
    return caseiraoConnectKnownDevice(device);
  })();
  try{return await caseiraoBtConnecting}finally{caseiraoBtConnecting=null}
};

async function caseiraoEnsurePrinterConnection(){
  if(btWriteChar&&btDevice?.gatt?.connected)return btWriteChar;
  if(!btDevice)throw new Error('Toque em CONECTAR BLUETOOTH e selecione a impressora primeiro.');
  await caseiraoConnectKnownDevice(btDevice);
  if(!btWriteChar)throw new Error('Não foi possível recuperar o canal de impressão.');
  return btWriteChar;
}

btWrite=function(bytes){
  const job=async()=>{
    const characteristic=await caseiraoEnsurePrinterConnection();
    const chunk=20;
    for(let i=0;i<bytes.length;i+=chunk){
      if(!btDevice?.gatt?.connected){
        await caseiraoConnectKnownDevice(btDevice);
      }
      const c=btWriteChar||characteristic;
      const part=bytes.slice(i,i+chunk);
      if(c.properties.writeWithoutResponse&&typeof c.writeValueWithoutResponse==='function')await c.writeValueWithoutResponse(part);
      else if(c.properties.write&&typeof c.writeValueWithResponse==='function')await c.writeValueWithResponse(part);
      else await c.writeValue(part);
      await new Promise(resolve=>setTimeout(resolve,30));
    }
    return true;
  };
  caseiraoBtWriteChain=caseiraoBtWriteChain.catch(()=>{}).then(job);
  return caseiraoBtWriteChain;
};

/* Cupom Bluetooth leve: primeiro estabiliza texto/ESC-POS.
   Logo e QR permanecem fora deste fluxo para não derrubar a conexão. */
escposBytes=async function(o){
  const head=new Uint8Array([0x1b,0x40]);
  const body=new TextEncoder().encode(receiptPlain(o));
  const tail=new Uint8Array([0x0a,0x0a,0x0a]);
  return joinReceiptBytes(head,body,tail);
};
/* ===== FIM BLUETOOTH STABLE FIX ===== */

/* ===== CASEIRAO PRINTER ENGINE V3 • 2026-09-23 =====
   Modulo final/autoritativo de impressao Bluetooth.
   Objetivos: conexao unica, escrita conservadora, fila limpa e sem pedidos fantasmas. */
const CASEIRAO_PRINT_V3_PENDING='caseirao_print_pending_v3';
const CASEIRAO_PRINT_V3_DONE='caseirao_print_done_v3';
try{localStorage.removeItem('caseirao_auto_print_pending_v2')}catch(e){}
let caseiraoPrintV3Busy=false;
let caseiraoPrintV3ConnectPromise=null;
let caseiraoPrintV3WritePromise=Promise.resolve();
let caseiraoPrintV3Generation=0;

function caseiraoPrintV3Set(key,set,limit){try{localStorage.setItem(key,JSON.stringify([...set].slice(-limit)))}catch(e){}}
function caseiraoPrintV3Get(key){try{return new Set(JSON.parse(localStorage.getItem(key)||'[]').map(String))}catch(e){return new Set()}}
function pendingAutoPrintIds(){return caseiraoPrintV3Get(CASEIRAO_PRINT_V3_PENDING)}
function savePendingAutoPrint(set){caseiraoPrintV3Set(CASEIRAO_PRINT_V3_PENDING,set,100)}
function autoPrintedOrders(){return caseiraoPrintV3Get(CASEIRAO_PRINT_V3_DONE)}
function saveAutoPrinted(set){caseiraoPrintV3Set(CASEIRAO_PRINT_V3_DONE,set,500)}
function markAutoPrinted(id){const s=autoPrintedOrders();s.add(String(id));saveAutoPrinted(s)}
function wasAutoPrinted(id){return autoPrintedOrders().has(String(id))}
function queueAutoPrint(id){const s=pendingAutoPrintIds();s.add(String(id));savePendingAutoPrint(s);refreshPendingPrintStatus()}
function unqueueAutoPrint(id){const s=pendingAutoPrintIds();s.delete(String(id));savePendingAutoPrint(s);refreshPendingPrintStatus()}
function caseiraoPrintV3CleanQueue(){
  const orders=admin?.orders||[],byId=new Map(orders.map(o=>[String(o.id),o])),pending=pendingAutoPrintIds();
  let changed=false;
  for(const id of [...pending]){
    const o=byId.get(String(id));
    if(!o||!eligibleForAutoPrint(o)||wasAutoPrinted(id)){pending.delete(String(id));changed=true}
  }
  if(changed)savePendingAutoPrint(pending);
  refreshPendingPrintStatus();
  return pending;
}
function refreshPendingPrintStatus(){
  const n=caseiraoPrintV3CleanQueue.__running?pendingAutoPrintIds().size:(()=>{caseiraoPrintV3CleanQueue.__running=true;try{return caseiraoPrintV3CleanQueue().size}finally{caseiraoPrintV3CleanQueue.__running=false}})();
  document.querySelectorAll('[data-print-pending]').forEach(el=>{el.textContent=n?`${n} pedido${n===1?'':'s'} aguardando impressão`:'Nenhum pedido aguardando impressão';el.classList.toggle('hasPending',n>0)});
}

async function caseiraoPrintV3FindChannel(server){
  const preferred=[];
  for(const p of BT_PROFILES){
    try{
      const service=await server.getPrimaryService(p.service);
      for(const cid of p.chars){try{const c=await service.getCharacteristic(cid);if(c.properties.write||c.properties.writeWithoutResponse)preferred.push(c)}catch(e){}}
      try{for(const c of await service.getCharacteristics())if((c.properties.write||c.properties.writeWithoutResponse)&&!preferred.includes(c))preferred.push(c)}catch(e){}
    }catch(e){}
  }
  if(!preferred.length){
    try{for(const service of await server.getPrimaryServices()){try{for(const c of await service.getCharacteristics())if(c.properties.write||c.properties.writeWithoutResponse)preferred.push(c)}catch(e){}}}catch(e){}
  }
  return preferred.find(c=>c.properties.write&&typeof c.writeValueWithResponse==='function')||preferred.find(c=>c.properties.writeWithoutResponse&&typeof c.writeValueWithoutResponse==='function')||preferred[0]||null;
}
async function caseiraoPrintV3Attach(device){
  if(!device?.gatt)throw new Error('O dispositivo escolhido não oferece BLE/GATT para impressão.');
  const generation=++caseiraoPrintV3Generation;
  const server=device.gatt.connected?device.gatt:await device.gatt.connect();
  const channel=await caseiraoPrintV3FindChannel(server);
  if(!channel)throw new Error('Conectou ao Bluetooth, mas não encontrei um canal de escrita compatível.');
  btDevice=device;btWriteChar=channel;btPrinterName=device.name||'Impressora Bluetooth';
  if(!device.__caseiraoV3Bound){device.__caseiraoV3Bound=true;device.addEventListener('gattserverdisconnected',()=>{if(generation<=caseiraoPrintV3Generation){btWriteChar=null;setPrinterState('🔴 DESCONECTADA','error');try{refreshPrinterStatus()}catch(e){}}})}
  setPrinterState(`🟢 CONECTADA • ${btPrinterName}`,'connected');try{refreshPrinterStatus()}catch(e){}
  return btPrinterName;
}
connectBluetoothPrinter=async function(){
  if(caseiraoPrintV3ConnectPromise)return caseiraoPrintV3ConnectPromise;
  caseiraoPrintV3ConnectPromise=(async()=>{
    if(!navigator.bluetooth)throw new Error('Abra a Central no Chrome do Android para usar Bluetooth.');
    if(btDevice){try{return await caseiraoPrintV3Attach(btDevice)}catch(e){btWriteChar=null}}
    setPrinterState('Selecione a impressora...');
    const device=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:BT_PROFILES.map(p=>p.service)});
    const connected=await caseiraoPrintV3Attach(device);
    if(printerPrefs().auto)setTimeout(()=>flushPendingAutoPrint().catch(()=>{}),150);
    return connected;
  })();
  try{return await caseiraoPrintV3ConnectPromise}finally{caseiraoPrintV3ConnectPromise=null}
};
function printerConnected(){return !!(btDevice?.gatt?.connected&&btWriteChar)}
async function caseiraoPrintV3Ensure(){if(printerConnected())return btWriteChar;if(!btDevice)throw new Error('Conecte a impressora primeiro.');await caseiraoPrintV3Attach(btDevice);return btWriteChar}
function caseiraoPrintV3Sleep(ms){return new Promise(r=>setTimeout(r,ms))}
btWrite=function(bytes){
  const run=async()=>{
    let c=await caseiraoPrintV3Ensure();
    const CHUNK=20,PAUSE=70;
    for(let i=0;i<bytes.length;i+=CHUNK){
      if(!btDevice?.gatt?.connected){await caseiraoPrintV3Attach(btDevice);c=btWriteChar}
      const part=bytes.slice(i,i+CHUNK);
      if(c.properties.write&&typeof c.writeValueWithResponse==='function')await c.writeValueWithResponse(part);
      else if(c.properties.writeWithoutResponse&&typeof c.writeValueWithoutResponse==='function')await c.writeValueWithoutResponse(part);
      else await c.writeValue(part);
      await caseiraoPrintV3Sleep(PAUSE);
    }
    await caseiraoPrintV3Sleep(250);return true;
  };
  caseiraoPrintV3WritePromise=caseiraoPrintV3WritePromise.catch(()=>{}).then(run);
  return caseiraoPrintV3WritePromise;
};
escposBytes=async function(o){
  const width=printerTextWidth(),hr='-'.repeat(width),L=[];
  const wr=t=>wrapReceipt(t,width);
  L.push('O CASEIRAO BURGER',`PEDIDO #${o.order_number}`,new Date(o.created_at).toLocaleString('pt-BR'),hr,`CLIENTE: ${o.customer_name||''}`,`FONE: ${o.customer_phone||''}`,`TIPO: ${orderTypeLabel(o.type)}`);
  if(o.type==='delivery')L.push(hr,'ENDERECO:',...wr(orderAddress(o)));
  L.push(hr,`PAGAMENTO: ${paymentLabel(o.payment)}`);if(o.change_for)L.push(`TROCO PARA: ${o.change_for}`);L.push(hr,'ITENS:');
  for(const it of (o.order_items||[])){L.push(...wr(`${it.quantity||1}x ${it.product_name||'Item'}  ${fmt(it.line_total||0)}`));for(const a of (it.order_item_addons||[]))L.push(...wr(`  + ${a.addon_name}${Number(a.price||0)>0?' '+fmt(a.price):''}`));if(it.note)L.push(...wr(`  OBS: ${it.note}`))}
  if(o.notes)L.push(hr,'OBSERVACOES:',...wr(o.notes));
  L.push(hr,`SUBTOTAL: ${fmt(o.subtotal)}`);if(Number(o.delivery_fee||0))L.push(`ENTREGA: ${fmt(o.delivery_fee)}`);if(Number(o.discount||0))L.push(`DESCONTO: -${fmt(o.discount)}`);L.push(`TOTAL: ${fmt(o.total)}`,hr,'','','');
  return joinReceiptBytes(new Uint8Array([0x1b,0x40]),new TextEncoder().encode(stripAccents(L.join('\n'))),new Uint8Array([0x0a,0x0a]));
};
printOrderBluetoothAuto=async function(id,sourceOrders=null,silent=false){
  const o=(sourceOrders||admin?.orders||[]).find(x=>String(x.id)===String(id));
  if(!o||['cancelado','entregue'].includes(String(o.status||''))){unqueueAutoPrint(id);return false}
  try{if(!printerConnected())await caseiraoPrintV3Ensure();setPrinterState(`Imprimindo pedido #${o.order_number}...`,'connected');await btWrite(await escposBytes(o));markAutoPrinted(id);unqueueAutoPrint(id);setPrinterState(`🟢 CONECTADA • Pedido #${o.order_number} impresso`,'connected');return true}catch(e){setPrinterState(`Erro ao imprimir: ${e.message||e}`,'error');if(!silent)alert(e.message||String(e));return false}
};
printOrderBluetooth=async function(id,sourceOrders=null){return printOrderBluetoothAuto(id,sourceOrders,false)};
flushPendingAutoPrint=async function(){
  if(caseiraoPrintV3Busy||!printerPrefs().auto)return;
  const pending=caseiraoPrintV3CleanQueue();if(!pending.size||!printerConnected())return;
  caseiraoPrintV3Busy=true;
  try{for(const id of [...pending]){const ok=await printOrderBluetoothAuto(id,admin?.orders||[],true);if(!ok)break}}finally{caseiraoPrintV3Busy=false;refreshPendingPrintStatus()}
};
try{caseiraoPrintV3CleanQueue()}catch(e){}
/* ===== FIM CASEIRAO PRINTER ENGINE V3 ===== */
