function orderTrackingCard(order){
  const code=String(order?.tracking_code||'').trim();
  if(!code)return '<div class="orderTrackingCard">Código de acompanhamento indisponível. Entre em contato com o Caseirão informando o número do pedido.</div>';
  return `<div class="orderTrackingCard"><span>Código de acompanhamento</span><strong>${esc(code)}</strong><button type="button" class="secondary" data-copy-order-code="${esc(code)}">Copiar código do pedido</button><small>Guarde este código para acompanhar seu pedido.</small></div>`;
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-copy-order-code]');if(!button)return;
  const code=button.dataset.copyOrderCode;
  try{await navigator.clipboard.writeText(code);button.textContent='Código copiado ✓'}catch{prompt('Copie o código do pedido:',code)}
});
(()=>{'use strict';
const FN='https://jhvtjhjzlljqfzdccrxc.supabase.co/functions/v1/', $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}), moneyValue=v=>Math.round((Number(v)||0)*100)/100, digits=v=>String(v||'').replace(/\D/g,''), esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let data={settings:{},products:[],neighborhoods:[],addons:[],product_addons:[],coupons:[]},cart=[],cat='__START__',search='',orderType='delivery',coupon=null,cashback=0,deferredPrompt=null,slideTimer=null;
const STORE_TIME_ZONE='America/Fortaleza',STORE_OPEN_TIME='18:00',STORE_CLOSE_TIME='23:30',STORE_WARNING_MINUTES=30;
let catalogLoaded=false,lastAutomaticStoreState='';
let categorySpyFrame=0,lastVisualCategory='';
function setVisualCategory(name){
 const menu=$('#cats');if(!menu)return;
 const buttons=[...menu.querySelectorAll('[data-cat]')],active=buttons.find(button=>button.dataset.cat===name)||buttons.find(button=>button.dataset.cat==='Todos');
 if(!active)return;
 buttons.forEach(button=>button.classList.toggle('on',button===active));
 if(lastVisualCategory===active.dataset.cat)return;
 lastVisualCategory=active.dataset.cat;
 const left=active.offsetLeft-(menu.clientWidth-active.offsetWidth)/2;
 menu.scrollTo({left:Math.max(0,left),behavior:'smooth'});
}
function updateCategoryScrollSpy(){
 categorySpyFrame=0;
 if(cat!=='Todos'||search.trim()){setVisualCategory(cat);return}
 const products=$('#products'),cards=products?[...products.querySelectorAll('.card[data-product-category]')]:[];
 if(!products||!cards.length){setVisualCategory('Todos');return}
 const menu=$('#cats'),line=Math.max((menu?.getBoundingClientRect().bottom||0)+18,window.innerHeight*.32);
 if(products.getBoundingClientRect().top>line){setVisualCategory('Todos');return}
 let current=cards[0].dataset.productCategory||'Todos';
 for(const card of cards){if(card.getBoundingClientRect().top<=line)current=card.dataset.productCategory||current;else break}
 setVisualCategory(current);
}
function scheduleCategoryScrollSpy(){if(!categorySpyFrame)categorySpyFrame=requestAnimationFrame(updateCategoryScrollSpy)}
function fortalezaMinutes(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:STORE_TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const hour=Number(parts.find(x=>x.type==='hour')?.value||0),minute=Number(parts.find(x=>x.type==='minute')?.value||0);
 return hour*60+minute;
}
function timeToMinutes(value){const [hour,minute]=String(value||'00:00').split(':').map(Number);return hour*60+minute}
const MANUAL_OPEN_MARK='[[MANUAL_OPEN]]';
function manualOpenEnabled(settings=data.settings||{}){return String(settings.status_text||'').startsWith(MANUAL_OPEN_MARK)}
function publicStatusText(settings=data.settings||{}){return String(settings.status_text||'Aberto').replace(MANUAL_OPEN_MARK,'').trim()||'Aberto'}
function automaticStoreState(manualOpen=!!data.settings?.store_open,now=new Date()){
 const settings=data.settings||{},openTime=String(settings.open_time||STORE_OPEN_TIME).slice(0,5),closeTime=String(settings.close_time||STORE_CLOSE_TIME).slice(0,5);
 const current=fortalezaMinutes(now),opening=timeToMinutes(openTime),closing=timeToMinutes(closeTime);
 const inWindow=opening<closing?current>=opening&&current<closing:current>=opening||current<closing;
 const untilClose=(closing-current+1440)%1440;
 if(!manualOpen)return {open:false,warning:false,reason:'manual',message:'Loja fechada no momento'};
 if(manualOpenEnabled(settings)||settings.schedule_enabled===false)return {open:true,warning:false,reason:'manual-override',message:'Loja aberta manualmente pelo ADM'};
 if(!inWindow)return {open:false,warning:false,reason:'schedule',message:`Loja fechada. Abriremos às ${openTime.replace(':','h')}.`};
 if(untilClose>0&&untilClose<=STORE_WARNING_MINUTES)return {open:true,warning:true,reason:'schedule',message:`Fecharemos em breve. Faça seu pedido até ${closeTime.replace(':','h')}.`};
 return {open:true,warning:false,reason:'schedule',message:''};
}
function ordersOpen(){return automaticStoreState().open}
function drawAutomaticStoreNotice(state=automaticStoreState()){
  const notice=$('#automaticStoreNotice');if(!notice)return;
  const settings=data.settings||{},openTime=String(settings.open_time||STORE_OPEN_TIME).slice(0,5),closeTime=String(settings.close_time||STORE_CLOSE_TIME).slice(0,5);
 if(state.open&&!state.warning){notice.className='automaticStoreNotice hidden';notice.replaceChildren();return}
 notice.classList.toggle('hidden',state.open&&!state.warning);
 notice.classList.toggle('closingSoon',state.warning);
 notice.classList.toggle('closedNow',!state.open);
 notice.innerHTML=state.warning?`<span class="automaticStoreIcon" aria-hidden="true">⏰</span><span class="automaticStoreCopy"><b>Fecharemos em breve</b><small>Faça seu pedido até ${closeTime.replace(':','h')}.</small></span>`:`<span class="automaticStoreIcon" aria-hidden="true">🌙</span><span class="automaticStoreCopy"><b>Pedidos encerrados por hoje</b><small>Abrimos novamente às ${openTime.replace(':','h')}.</small></span>`;
}
function showClosedMessage(){const state=automaticStoreState();modal(`<div class="head"><h2>Loja fechada</h2><button class="x" data-close>×</button></div><div class="notice"><b>Não estamos recebendo novos pedidos agora.</b><br>${esc(state.message)}</div><div class="operationHint">Seu carrinho continuará salvo para você pedir quando a loja abrir.</div>`)}
try{cart=JSON.parse(localStorage.getItem('caseirao_v2_cart')||'[]')}catch{cart=[]}
const saveCart=()=>{try{localStorage.setItem('caseirao_v2_cart',JSON.stringify(cart))}catch{}};
async function api(slug,opts={}){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);try{const r=await fetch(FN+slug,{cache:'no-store',...opts,signal:ctl.signal});let j={};try{j=await r.json()}catch{}if(!r.ok||j.error)throw new Error(j.error||j.detail||`Erro ${r.status}`);return j}catch(e){if(e.name==='AbortError')throw new Error('Servidor demorou para responder. Tente novamente.');throw e}finally{clearTimeout(timer)}}
function normalizeCouponResult(result,body={}){
 const response=result&&typeof result==='object'?result:{},details=response.coupon&&typeof response.coupon==='object'?response.coupon:response;
 const catalogCoupon=(data.coupons||[]).find(item=>String(item.code||'').trim().toUpperCase()===String(body.code||'').trim().toUpperCase())||{};
 const source={...catalogCoupon,...details},type=String(source.type||source.discount_type||'').toLowerCase(),value=Number(source.value??source.discount_value??source.percent??source.percentage??0);
 let discount=Number(response.discount??response.discount_amount??response.coupon_discount??details.discount??details.discount_amount??0);
 let deliveryDiscount=Number(response.delivery_discount??response.delivery_discount_amount??details.delivery_discount??details.delivery_discount_amount??0);
 if(!discount&&!deliveryDiscount){
  if(type==='percent'||type==='percentage')discount=Number(body.subtotal||0)*value/100;
  else if(type==='fixed'||type==='value'||type==='amount')discount=Math.min(Number(body.subtotal||0),value);
  else if(type==='free_delivery')deliveryDiscount=Number(body.delivery_fee||0);
 }
 return {...response,...source,code:String(response.code||source.code||body.code||'').trim().toUpperCase(),discount:moneyValue(Math.max(0,discount)),delivery_discount:moneyValue(Math.max(0,deliveryDiscount))};
}
const post=async(slug,body)=>{const result=await api(slug,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return slug==='validate-coupon'?normalizeCouponResult(result,body):result};
const price=p=>Number(p.promo_price)>0?Number(p.promo_price):Number(p.price||0), count=()=>cart.reduce((s,x)=>s+x.qty,0), subtotal=()=>cart.reduce((s,x)=>s+(price(x.product)+x.addons.reduce((a,b)=>a+Number(b.price||0),0))*x.qty,0);
function updateCart(){saveCart();$('#cartLabel').textContent=`Carrinho • ${count()} ${count()===1?'item':'itens'}`;$('#cartTotal').textContent=money(subtotal())}
function modal(html){$('#modal').innerHTML=`<div class="overlay"><section class="sheet">${html}</section></div>`;$('.overlay').onclick=e=>{if(e.target.classList.contains('overlay'))closeModal()};$$('[data-close]').forEach(x=>x.onclick=closeModal)}
function closeModal(){$('#modal').innerHTML=''}
function parseBanner(s){let raw=String(s.banner_text||''),slides=[];const mark='__CASEIRAO_SLIDES__';if(raw.includes(mark)){const at=raw.indexOf(mark),payload=raw.slice(at+mark.length).trim();raw=raw.slice(0,at).trim();try{const a=JSON.parse(payload);if(Array.isArray(a))slides=a.filter(x=>x&&x.image)}catch{}}if(s.banner_image_url)slides.unshift({image:s.banner_image_url,text:raw});return {text:raw,slides:[...new Map(slides.map(x=>[x.image,x])).values()]}}
function renderBanner(){const s=data.settings||{},bn=$('#banner'),b=parseBanner(s);clearInterval(slideTimer);if(!s.banner_active||(!b.slides.length&&!b.text)){bn.classList.add('hidden');return}bn.classList.remove('hidden');let i=0;const draw=()=>{const x=b.slides[i]||{};bn.innerHTML=(x.image?`<img src="${esc(x.image)}" alt="Banner">`:'')+(x.text?`<p>${esc(x.text)}</p>`:'')+(b.slides.length>1?`<div class="slideDots">${b.slides.map((_,n)=>`<i class="${n===i?'on':''}"></i>`).join('')}</div>`:'')};draw();if(b.slides.length>1)slideTimer=setInterval(()=>{i=(i+1)%b.slides.length;draw()},4500)}
async function loadCatalog(){try{data=await api('catalog');if(!Array.isArray(data.products))throw new Error('Resposta do catálogo inválida.');catalogLoaded=true;render()}catch(e){$('#storeStatus').textContent='Erro ao carregar';$('#storeStatus').className='closed';$('#products').innerHTML=`<div class="empty"><b>Não foi possível carregar o cardápio.</b><div class="error">${esc(e.message)}</div><button class="primary" id="retry">Tentar novamente</button></div>`;$('#retry').onclick=loadCatalog}}

function renderBestSellers(){
 const section=$('#bestSection'),track=$('#bestTrack'),cash=$('#bestCash');
 if(!section||!track)return;
 const s=data.settings||{}, pct=Number(s.cashback_percent||0);
 const list=[...data.products].filter(p=>p.active!==false&&!p.sold_out&&Number(p.sold_qty||0)>0)
   .sort((a,b)=>Number(b.sold_qty||0)-Number(a.sold_qty||0)).slice(0,6);
 if(!list.length){section.classList.add('hidden');return}
 cash.textContent=s.cashback_enabled&&pct>0?`+ ${pct}% cashback`:'Mais vendidos';
 track.innerHTML=list.map(p=>`<article class="bestCard"><div class="bestPic">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:'SEM FOTO'}</div><div class="bestBody"><div class="bestName">${esc(p.name)}</div><div class="bestMeta">${Number(p.sold_qty||0)} pedidos registrados</div><div class="bestPrice">${money(price(p))}</div>${s.cashback_enabled&&pct>0?`<span class="cashTag">Ganhe cashback nesta compra</span>`:''}<button class="bestAdd" data-best="${p.id}">Adicionar</button></div></article>`).join('');
 $$('[data-best]').forEach(b=>b.onclick=()=>openProduct(b.dataset.best));
 section.classList.remove('hidden');
 if(section._autoSlide)clearInterval(section._autoSlide);
 let index=0;
 section._autoSlide=setInterval(()=>{
   const cards=[...track.querySelectorAll('.bestCard')];
   if(cards.length<2)return;
   index=(index+1)%cards.length;
   track.scrollTo({left:cards[index].offsetLeft-track.offsetLeft,behavior:'smooth'});
 },3500);
}

function render(){const s=data.settings||{},clock=automaticStoreState(!!s.store_open),open=clock.open;$('#storeName').textContent=s.store_name||'O Caseirão Burger';$('#storeStatus').textContent=open?(clock.warning?`Fecharemos às ${String(s.close_time||STORE_CLOSE_TIME).slice(0,5).replace(':','h')}`:(clock.reason==='manual-override'?'Aberto manualmente':publicStatusText(s))):'Fechado no momento';$('#storeStatus').className=open?'open':'closed';drawAutomaticStoreNotice(clock);document.body.classList.toggle('automaticStoreClosed',!open);renderBanner();renderBestSellers();const catPriority=n=>{const x=String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(x.includes('hamburg'))return 0;if(x.includes('combo'))return 1;if(x.includes('bebida'))return 2;if(x.includes('suco'))return 3;if(x.includes('batata'))return 99;return 10};
const realCats=[...new Set(data.products.filter(p=>p.active!==false).map(p=>p.category||'Outros'))];
realCats.sort((a,b)=>catPriority(a)-catPriority(b));
const cats=['Todos',...realCats];
if(cat==='__START__')cat='Todos';$('#cats').innerHTML=cats.map(c=>`<button class="chip ${c===cat?'on':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');$$('[data-cat]').forEach(b=>b.onclick=()=>{cat=b.dataset.cat;lastVisualCategory='';render();if(cat==='Todos')requestAnimationFrame(updateCategoryScrollSpy)});const q=search.trim().toLowerCase(),list=data.products.filter(p=>p.active!==false&&(cat==='Todos'||(p.category||'Outros')===cat)&&(!q||(p.name+' '+(p.description||'')).toLowerCase().includes(q))).map((p,index)=>({p,index})).sort((a,b)=>cat==='Todos'?(catPriority(a.p.category)-catPriority(b.p.category)||a.index-b.index):a.index-b.index).map(x=>x.p);$('#products').innerHTML=list.length?list.map(p=>`<article class="card" data-product-category="${esc(p.category||'Outros')}"><div class="pic">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:'SEM FOTO'}</div><div class="body"><div class="name">${esc(p.name)}</div>${Number(p.promo_price)>0?'<span class="promo">PROMO</span>':''}<div class="desc">${esc(p.description||'')}</div><div class="price">${Number(p.promo_price)>0?`<span class="old">${money(p.price)}</span>`:''}${money(price(p))}</div><button class="primary" data-add="${p.id}" ${p.sold_out||!open?'disabled':''}>${p.sold_out?'Esgotado':open?'Adicionar':'Loja fechada'}</button></div></article>`).join(''):'<div class="empty">Nenhum produto encontrado.</div>';$$('[data-add]').forEach(b=>b.onclick=()=>openProduct(b.dataset.add));updateCart();requestAnimationFrame(updateCategoryScrollSpy)}
function allowed(p){const ids=new Set(data.product_addons.filter(x=>String(x.product_id)===String(p.id)).map(x=>String(x.addon_id)));return data.addons.filter(a=>a.active!==false&&!a.sold_out&&ids.has(String(a.id)))}
function openProduct(id){if(!ordersOpen())return showClosedMessage();const p=data.products.find(x=>String(x.id)===String(id));if(!p)return;const adds=allowed(p);let itemQty=1;modal(`<div class="productDetail">
<div class="productHero">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'<div class="productNoPhoto">Sem foto</div>'}<button class="productClose" data-close aria-label="Fechar">×</button></div>
<div class="productInfo"><div class="productTitleRow"><div><h2>${esc(p.name)}</h2>${Number(p.promo_price)>0?'<span class="promo">PROMO</span>':''}<div class="productQtyTop"><span>Quantidade</span><div class="productQtyControl"><button type="button" id="productQtyMinus" aria-label="Diminuir quantidade">−</button><b id="productQtyValue">1</b><button type="button" id="productQtyPlus" aria-label="Aumentar quantidade">+</button></div></div></div><div class="productDetailPrice">${Number(p.promo_price)>0?`<small>${money(p.price)}</small>`:''}<b>${money(price(p))}</b></div></div>
${p.description?`<p class="productDescription">${esc(p.description)}</p>`:''}
<div class="detailDivider"></div>
<div class="field productOptions"><div class="optionTitle"><b>Adicionais</b><small>${adds.length?'Escolha como preferir':'Nenhum adicional disponível'}</small></div>${adds.length?adds.map(a=>`<label class="addon premiumAddon"><input type="checkbox" data-addon="${a.id}"><span class="grow"><b>${esc(a.name)}</b></span><strong>+ ${money(a.price)}</strong></label>`).join(''):'<div class="notice">Sem adicionais para este item.</div>'}</div>
<div class="field"><label>Alguma observação?</label><textarea id="itemNote" class="textarea" placeholder="Ex.: sem cebola, molho separado..."></textarea></div>
<div class="detailAction"><button id="confirmAdd" class="primary">Adicionar <span id="detailQtyText">1 item</span> ao carrinho • <span id="detailTotal">${money(price(p))}</span></button></div>
</div></div>`);
const refreshTotal=()=>{const extra=$$('[data-addon]:checked').reduce((s,i)=>{const a=data.addons.find(x=>String(x.id)===String(i.dataset.addon));return s+Number(a?.price||0)},0);const el=$('#detailTotal');if(el)el.textContent=money((price(p)+extra)*itemQty);const q=$('#productQtyValue');if(q)q.textContent=String(itemQty);const qt=$('#detailQtyText');if(qt)qt.textContent=`${itemQty} ${itemQty===1?'item':'itens'}`;const minus=$('#productQtyMinus');if(minus)minus.disabled=itemQty<=1};
$$('[data-addon]').forEach(i=>i.onchange=refreshTotal);
$('#productQtyMinus').onclick=()=>{if(itemQty>1){itemQty--;refreshTotal()}};
$('#productQtyPlus').onclick=()=>{itemQty=Math.min(30,itemQty+1);refreshTotal()};
refreshTotal();
$('#confirmAdd').onclick=()=>{const chosen=$$('[data-addon]:checked').map(i=>data.addons.find(a=>String(a.id)===String(i.dataset.addon))).filter(Boolean);if(chosen.length>10)return alert('Escolha no máximo 10 adicionais por item.');cart.push({key:crypto.randomUUID(),product:p,addons:chosen,note:$('#itemNote').value.trim(),qty:itemQty});updateCart();closeModal()}}

function renderCart(){const items=count(),open=ordersOpen();modal(`<div class="cartSheet"><div class="head cartHead"><div><small>Confira antes de continuar</small><h2>Seu pedido</h2></div><button class="x" data-close aria-label="Fechar">×</button></div><div class="cartSummaryTop"><span>${items} ${items===1?'item':'itens'} no carrinho</span><strong>${money(subtotal())}</strong></div><div id="lines" class="cartLines"></div><div class="cartTotals"><div class="sumrow"><span>Subtotal</span><b>${money(subtotal())}</b></div><div class="cartHint">${open?'Taxa de entrega, cupom e cashback são calculados na próxima etapa.':'A loja está fechada. Seu carrinho continuará salvo.'}</div></div><button id="checkout" class="primary cartCheckout" ${cart.length&&open?'':'disabled'}><span>${open?'Continuar':'Loja fechada'}</span><b>${open?`${money(subtotal())} →`:'18h'}</b></button></div>`);$('#lines').innerHTML=cart.length?cart.map(x=>{const unit=price(x.product)+x.addons.reduce((a,b)=>a+Number(b.price||0),0),lineTotal=unit*x.qty;return `<article class="cartItem"><div class="cartItemPhoto">${x.product.image_url?`<img src="${esc(x.product.image_url)}" alt="${esc(x.product.name)}">`:'<span>🍔</span>'}</div><div class="cartItemBody"><div class="cartItemTop"><div class="cartItemName">${esc(x.product.name)}</div><button class="cartRemove" data-remove="${x.key}" type="button" aria-label="Remover item">Remover</button></div>${x.addons.length?`<div class="cartItemMeta">${x.addons.map(a=>`+ ${esc(a.name)}`).join(' · ')}</div>`:''}${x.note?`<div class="cartItemNote">Obs.: ${esc(x.note)}</div>`:''}<div class="cartItemBottom"><div class="qty cartQty"><button data-q="${x.key}" data-d="-1" type="button">−</button><b>${x.qty}</b><button data-q="${x.key}" data-d="1" type="button">+</button></div><div class="cartItemPrice"><small>${x.qty>1?`${money(unit)} cada`:''}</small><strong>${money(lineTotal)}</strong></div></div></div></article>`}).join(''):'<div class="cartEmpty"><div class="cartEmptyIcon">🛒</div><b>Seu carrinho está vazio</b><span>Escolha um lanche do Caseirão para começar.</span></div>';$$('[data-q]').forEach(b=>b.onclick=()=>{const x=cart.find(i=>i.key===b.dataset.q);if(!x)return;x.qty+=Number(b.dataset.d);if(x.qty<=0)cart=cart.filter(i=>i.key!==x.key);updateCart();renderCart()});$$('[data-remove]').forEach(b=>b.onclick=()=>{cart=cart.filter(i=>i.key!==b.dataset.remove);updateCart();renderCart()});if(open)$('#checkout').onclick=openCheckout}
const hoodFee=()=>orderType==='delivery'?Number(data.neighborhoods.find(n=>String(n.id)===String($('#hood')?.value))?.fee||0):0;
function customerMemory(){try{return JSON.parse(localStorage.getItem('caseirao_customer')||'{}')}catch{return {}}}
function saveCustomer(){try{localStorage.setItem('caseirao_customer',JSON.stringify({name:$('#name')?.value||'',phone:$('#phone')?.value||'',email:$('#email')?.value||''}))}catch{}}
function organizeCheckout(){
 const send=$('#send'),sheet=send?.closest('.sheet');if(!sheet||sheet.dataset.checkoutOrganized)return;
 sheet.dataset.checkoutOrganized='1';sheet.classList.add('checkoutSheet');
 const head=sheet.querySelector(':scope>.head'),title=head?.querySelector('h2');
 if(head)head.classList.add('checkoutHead');
 if(title){title.insertAdjacentHTML('beforebegin','<small class="checkoutEyebrow">ÚLTIMA ETAPA</small>');title.insertAdjacentHTML('afterend','<span class="checkoutIntro">Preencha seus dados e confira tudo antes de enviar.</span>')}
 const seg=sheet.querySelector(':scope>.seg'),nameField=$('#name')?.closest('.field'),phoneField=$('#phone')?.closest('.field'),address=$('#address'),payment=$('#payment'),paymentField=payment?.closest('.field'),pixField=$('#pixEmailField'),changeField=$('#change')?.closest('.field'),couponField=$('#coupon')?.closest('.field'),cashField=$('#cashbackUse')?.closest('.field'),notesField=$('#notes')?.closest('.field'),sum=$('#sum');
 if($('#name')){$('#name').placeholder='Digite seu nome completo';$('#name').autocomplete='name'}
 if($('#phone')){$('#phone').placeholder='(86) 99999-9999';$('#phone').autocomplete='tel'}
 if($('#notes'))$('#notes').placeholder='Ex.: sem cebola, entregar na portaria...';
 if(seg){const copy={delivery:['🛵 Entrega','Receba no seu endereço'],pickup:['📦 Retirada','Busque no Caseirão'],local:['🍔 No local','Consumir no estabelecimento']};seg.querySelectorAll('[data-type]').forEach(button=>{const item=copy[button.dataset.type];if(item)button.innerHTML=`<b>${item[0]}</b><small>${item[1]}</small>`})}
 const section=(step,label,text)=>{const node=document.createElement('div');node.className='checkoutSectionTitle';node.innerHTML=`<i>${step}</i><div><b>${label}</b><span>${text}</span></div>`;return node};
 const personalTitle=section('1','Seus dados','Informe quem vai receber o pedido.'),methodTitle=section('2','Como você quer receber?','Escolha entrega, retirada ou consumo no local.'),addressTitle=orderType==='delivery'?section('3','Endereço da entrega','Preencha rua, número e bairro corretamente.'):null,paymentTitle=section(orderType==='delivery'?'4':'3','Forma de pagamento','Escolha como deseja pagar.'),extrasTitle=section(orderType==='delivery'?'5':'4','Descontos e observações','Cupom, cashback e recados são opcionais.');
 if(addressTitle)address.prepend(addressTitle);
 if(paymentField&&!paymentField.querySelector('.paymentChoices')){paymentField.classList.add('paymentField');payment.insertAdjacentHTML('afterend','<div class="paymentChoices"><button type="button" data-payment="Pix"><b>◆ Pix</b><small>Pagamento pelo celular</small></button><button type="button" data-payment="Dinheiro"><b>💵 Dinheiro</b><small>Pague ao receber</small></button><button type="button" data-payment="Cartão"><b>💳 Cartão</b><small>Crédito ou débito</small></button></div>');paymentField.querySelectorAll('[data-payment]').forEach(button=>button.onclick=()=>{payment.value=button.dataset.payment;payment.dispatchEvent(new Event('change'))})}
 couponField?.classList.add('checkoutExtra');cashField?.classList.add('checkoutExtra');
 head.after(personalTitle,nameField,phoneField,methodTitle,seg,address,paymentTitle,paymentField,pixField,changeField,extrasTitle,couponField,cashField,notesField,sum,send);
 const syncChoices=()=>paymentField?.querySelectorAll('[data-payment]').forEach(button=>button.classList.toggle('on',button.dataset.payment===payment.value));
 payment?.addEventListener('change',syncChoices);syncChoices();
}
new MutationObserver(()=>{if($('#send'))queueMicrotask(organizeCheckout)}).observe(document.querySelector('#modal'),{childList:true,subtree:true});
function openCheckout(){if(!ordersOpen())return showClosedMessage();coupon=null;cashback=0;const h=data.neighborhoods.filter(n=>n.active!==false),m=customerMemory();modal(`<div class="head"><h2>Finalizar pedido</h2><button class="x" data-close>×</button></div><div class="seg"><button data-type="delivery">Entrega</button><button data-type="pickup">Retirada</button><button data-type="local">No local</button></div><div class="field"><label>Nome</label><input id="name" class="input" value="${esc(m.name||'')}"></div><div class="field"><label>WhatsApp</label><input id="phone" class="input" inputmode="tel" value="${esc(m.phone||'')}"></div><div class="field" id="pixEmailField"><label>E-mail para pagamento Pix</label><input id="email" class="input" type="email" autocomplete="email" value="${esc(m.email||'')}" placeholder="seuemail@exemplo.com"><small>Necessário somente para gerar o Pix.</small></div><div id="address"></div><div class="field"><label>Cupom</label><div class="line"><input id="coupon" class="input" placeholder="Código"><button id="applyCoupon" class="secondary">Aplicar</button></div><div id="couponMsg"></div></div><div class="field"><label>Usar cashback</label><input id="cashbackUse" class="input" inputmode="decimal" placeholder="0,00"><button id="checkCash" class="secondary">Consultar saldo</button><div id="cashMsg"></div></div><div class="field"><label>Pagamento</label><select id="payment" class="select"><option>Pix</option><option>Dinheiro</option><option>Cartão</option></select></div><div class="field"><label>Troco para</label><input id="change" class="input" placeholder="Ex.: 50,00"></div><div class="field"><label>Observações</label><textarea id="notes" class="textarea"></textarea></div><div id="sum" class="sum"></div><button id="send" class="primary">Confirmar e enviar</button>`);$$('[data-type]').forEach(b=>{b.classList.toggle('on',b.dataset.type===orderType);b.onclick=()=>{orderType=b.dataset.type;openCheckout()}});if(orderType==='delivery')$('#address').innerHTML=`<div class="field"><label>Rua</label><input id="street" class="input"></div><div class="field"><label>Número</label><input id="number" class="input"></div><div class="field"><label>Bairro</label><select id="hood" class="select"><option value="">Selecione</option>${h.map(n=>`<option value="${n.id}">${esc(n.name)} • ${money(n.fee)}</option>`).join('')}</select></div><div class="field"><label>Complemento</label><input id="complement" class="input"></div><div class="field"><label>Referência</label><input id="reference" class="input"></div>`;const draw=()=>{const disc=Number(coupon?.discount||0)+Number(coupon?.delivery_discount||0),total=Math.max(0,subtotal()+hoodFee()-disc-cashback);$('#sum').innerHTML=`<div class="sumrow"><span>Produtos</span><b>${money(subtotal())}</b></div><div class="sumrow"><span>Entrega</span><b>${money(hoodFee())}</b></div>${disc?`<div class="sumrow"><span>Desconto</span><b>− ${money(disc)}</b></div>`:''}${cashback?`<div class="sumrow"><span>Cashback</span><b>− ${money(cashback)}</b></div>`:''}<div class="sumrow total"><span>Total estimado</span><b>${money(total)}</b></div>`};$('#hood')?.addEventListener('change',draw);draw();$('#applyCoupon').onclick=async()=>{try{coupon=await post('validate-coupon',{code:$('#coupon').value,subtotal:subtotal(),delivery_fee:hoodFee(),order_type:orderType,phone:digits($('#phone').value)});$('#couponMsg').innerHTML=`<div class="success">Cupom aplicado.</div>`;draw()}catch(e){coupon=null;$('#couponMsg').innerHTML=`<div class="error">${esc(e.message)}</div>`;draw()}};$('#checkCash').onclick=async()=>{try{const j=await post('cashback-api',{action:'status',payload:{phone:digits($('#phone').value)}}),bal=Number(j.customer?.balance||0);cashback=0;$('#cashMsg').innerHTML=`<div class="success">Saldo disponível: <b>${money(bal)}</b></div><button id="applyCash" class="primary" type="button">Aplicar cashback</button>`;draw();$('#applyCash').onclick=()=>{const req=Number(String($('#cashbackUse').value||'0').replace(',','.'))||0;if(req<=0){cashback=0;$('#cashMsg').innerHTML=`<div class="success">Saldo disponível: <b>${money(bal)}</b></div><div class="error">Informe um valor de cashback para aplicar.</div><button id="applyCash" class="primary" type="button">Aplicar cashback</button>`;draw();return}cashback=Math.max(0,Math.min(req,bal));draw();$('#cashMsg').innerHTML=`<div class="success">Saldo disponível: <b>${money(bal)}</b><br>Cashback aplicado: <b>${money(cashback)}</b></div><button id="applyCash" class="secondary" type="button">Aplicado ✓</button>`;$('#applyCash').disabled=true}}catch(e){cashback=0;$('#cashMsg').innerHTML=`<div class="error">${esc(e.message)}</div>`;draw()}};$('#cashbackUse').oninput=()=>{cashback=0;$('#cashMsg').innerHTML='';draw()};const syncPixEmail=()=>{$('#pixEmailField')?.classList.toggle('hidden',$('#payment').value!=='Pix');$('#change')?.closest('.field')?.classList.toggle('hidden',$('#payment').value!=='Dinheiro')};$('#payment').onchange=syncPixEmail;syncPixEmail();$('#send').onclick=sendOrder}
async function sendOrder(){const btn=$('#send');try{const name=$('#name').value.trim(),phone=digits($('#phone').value),payment=$('#payment').value,email=String($('#email')?.value||'').trim();if(name.length<2)throw new Error('Informe seu nome.');if(phone.length<10)throw new Error('Informe um WhatsApp válido.');if(payment==='Pix'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Informe um e-mail válido para gerar o Pix.');saveCustomer();const cashReq=moneyValue(cashback),payload={client_request_id:crypto.randomUUID(),customer:{name,phone},type:orderType,payment,change_for:$('#change').value.trim(),notes:$('#notes').value.trim(),coupon_code:$('#coupon').value.trim(),cashback_to_use:cashReq,source:'client-v2',items:cart.map(x=>({product_id:x.product.id,qty:x.qty,addon_ids:x.addons.map(a=>a.id),note:x.note}))};if(orderType==='delivery'){payload.address={street:$('#street').value.trim(),number:$('#number').value.trim(),neighborhood_id:$('#hood').value,complement:$('#complement').value.trim(),reference:$('#reference').value.trim()};if(!payload.address.street||!payload.address.number||!payload.address.neighborhood_id)throw new Error('Preencha rua, número e bairro.')}btn.disabled=true;btn.textContent='Enviando…';const j=await post('create-order',payload);localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:j.tracking_code,phone}));if(payment==='Pix'){btn.textContent='Gerando Pix…';const pix=await post('mercadopago-create-pix',{order_id:j.id,email});cart=[];updateCart();openPixPayment(j,pix,phone);return}cart=[];updateCart();modal(`<div class="head"><h2>Pedido recebido ✅</h2><button class="x" data-close>×</button></div><div class="success">Pedido <b>#${j.order_number}</b><br>Total: <b>${money(j.total)}</b><br>Previsão: <b>${esc(j.eta_text||'a confirmar')}</b></div>${orderTrackingCard(j)}<button id="trackNow" class="primary">Acompanhar pedido</button>`);$('#trackNow').onclick=()=>openTracking(j.tracking_code,phone)}catch(e){alert(e.message||String(e));if(btn){btn.disabled=false;btn.textContent='Confirmar e enviar'}}}

/* Pedido resiliente: o mesmo identificador acompanha todas as tentativas.
   Se o Pix falhar depois que o pedido já foi salvo, a tela recupera somente
   o pagamento e nunca cria um segundo pedido. */
const PENDING_ORDER_KEY='caseirao_pending_order_v1';
function pendingOrder(){try{return JSON.parse(localStorage.getItem(PENDING_ORDER_KEY)||'null')}catch{return null}}
function savePendingOrder(value){try{localStorage.setItem(PENDING_ORDER_KEY,JSON.stringify(value))}catch{}}
function clearPendingOrder(){try{localStorage.removeItem(PENDING_ORDER_KEY)}catch{}}
function acceptedOrder(order,phone){
  localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:order.tracking_code,phone}));
  cart=[];updateCart();clearPendingOrder();
  modal(`<div class="head"><h2>Pedido recebido ✅</h2><button class="x" data-close>×</button></div><div class="success">Pedido <b>#${order.order_number}</b><br>Total: <b>${money(order.total)}</b><br>Previsão: <b>${esc(order.eta_text||'a confirmar')}</b></div>${orderTrackingCard(order)}<button id="trackNow" class="primary">Acompanhar pedido</button>`);
  $('#trackNow').onclick=()=>openTracking(order.tracking_code,phone);
}
async function recoverPixOrder(state){
  const pix=await post('mercadopago-create-pix',{order_id:state.order.id,email:state.email});
  state.pix=pix;cart=[];updateCart();clearPendingOrder();openPixPayment(state.order,pix,state.phone);
}
async function sendOrderSafe(){
  const btn=$('#send');
  try{
    if(!ordersOpen())throw new Error(`A loja fechou às ${STORE_CLOSE_TIME.replace(':','h')}. Seu carrinho ficou salvo para o próximo horário.`);
    const name=$('#name').value.trim(),phone=digits($('#phone').value),payment=$('#payment').value,email=String($('#email')?.value||'').trim();
    if(name.length<2)throw new Error('Informe seu nome.');
    if(phone.length<10)throw new Error('Informe um WhatsApp válido.');
    if(!cart.length)throw new Error('Seu carrinho está vazio.');
    if(payment==='Pix'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Informe um e-mail válido para gerar o Pix.');
    saveCustomer();
    const cashReq=moneyValue(cashback);
    const previous=pendingOrder();
    let state=previous&&previous.payload&&!previous.order?previous:null;
    if(previous?.order){
      if(previous.payment==='Pix'){btn.disabled=true;btn.textContent='Recuperando Pix…';await recoverPixOrder(previous);return}
      acceptedOrder(previous.order,previous.phone);return;
    }
    if(!state){
      const payload={client_request_id:crypto.randomUUID(),customer:{name,phone},type:orderType,payment,change_for:$('#change').value.trim(),notes:$('#notes').value.trim(),coupon_code:$('#coupon').value.trim(),cashback_to_use:cashReq,source:'client',items:cart.map(x=>({product_id:x.product.id,qty:x.qty,addon_ids:x.addons.map(a=>a.id),note:x.note}))};
      if(orderType==='delivery'){
        payload.address={street:$('#street').value.trim(),number:$('#number').value.trim(),neighborhood_id:$('#hood').value,complement:$('#complement').value.trim(),reference:$('#reference').value.trim()};
        if(!payload.address.street||!payload.address.number||!payload.address.neighborhood_id)throw new Error('Preencha rua, número e bairro.');
      }
      state={payload,phone,email,payment,created_at:Date.now()};savePendingOrder(state);
    }
    btn.disabled=true;btn.textContent='Salvando pedido…';
    const order=await post('create-order',state.payload);
    state={...state,order};savePendingOrder(state);
    localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:order.tracking_code,phone:state.phone}));
    if(state.payment==='Pix'){btn.textContent='Gerando Pix…';await recoverPixOrder(state);return}
    acceptedOrder(order,state.phone);
  }catch(e){
    const state=pendingOrder();
    if(state?.order){
      modal(`<div class="head"><h2>Pedido já registrado</h2><button class="x" data-close>×</button></div><div class="notice">O pedido <b>#${esc(state.order.order_number)}</b> está salvo. Não envie outro pedido.</div>${orderTrackingCard(state.order)}${state.payment==='Pix'?'<button id="retryPix" class="primary">Gerar Pix novamente</button>':''}<button id="trackSaved" class="secondary">Acompanhar pedido</button>`);
      if($('#retryPix'))$('#retryPix').onclick=async()=>{try{await recoverPixOrder(state)}catch(err){alert(err.message||String(err))}};
      $('#trackSaved').onclick=()=>openTracking(state.order.tracking_code,state.phone);
    }else{
      alert((e.name==='AbortError'?'A conexão caiu, mas sua tentativa foi preservada. Toque novamente para consultar o mesmo envio.':e.message)||String(e));
      if(btn){btn.disabled=false;btn.textContent='Tentar o mesmo envio novamente'}
    }
  }
}
sendOrder=sendOrderSafe;
function openPixPayment(order,pix,phone){const qr=String(pix.qr_code||''),img=String(pix.qr_code_base64||''),ticket=String(pix.ticket_url||'');modal(`<div class="pixPayment">
<div class="head pixHead"><div><small>Pagamento seguro</small><h2>Pagamento Pix</h2></div><button class="x" data-close>×</button></div>
<div class="pixOrderCard"><span>Pedido #${order.order_number}</span><strong>${money(order.total)}</strong></div>
${orderTrackingCard(order)}
<div class="pixStatusCard waiting" id="pixStatus"><div class="pixStatusIcon"><span class="pixSpinner"></span></div><div class="pixStatusText"><strong>Aguardando pagamento</strong><span>Abra o app do seu banco e conclua o Pix.</span></div></div>
${img?`<div class="pixQrWrap"><div class="pixQrCard"><img alt="QR Code Pix" src="data:image/jpeg;base64,${esc(img)}"></div><small>Aponte a câmera do seu banco para o QR Code</small></div>`:''}
${qr?`<div class="field pixCopyField"><label>Pix Copia e Cola</label><textarea id="pixCode" class="textarea" readonly>${esc(qr)}</textarea><button id="copyPix" class="primary pixCopyBtn" type="button">Copiar código Pix</button></div>`:''}
${ticket?`<a class="secondary pixOpenBtn" href="${esc(ticket)}" target="_blank" rel="noopener">Abrir pagamento Pix</a>`:''}
<button id="trackNow" class="secondary pixTrackBtn">Acompanhar pedido</button>
</div>`);
if($('#copyPix'))$('#copyPix').onclick=async()=>{try{await navigator.clipboard.writeText(qr);$('#copyPix').textContent='Código copiado ✓'}catch{$('#pixCode')?.select()}};
$('#trackNow').onclick=()=>openTracking(order.tracking_code,phone);
let tries=0;
const timer=setInterval(async()=>{tries++;if(!document.querySelector('#pixStatus')||tries>60){clearInterval(timer);return}try{const s=await post('mercadopago-check-pix',{order_id:order.id});if(s.payment_status==='confirmed'){clearInterval(timer);clearPendingOrder();const el=$('#pixStatus');if(el){el.className='pixStatusCard confirmed';el.innerHTML='<div class="pixStatusIcon pixCheck">✓</div><div class="pixStatusText"><strong>Pagamento confirmado!</strong><span>Recebemos seu Pix. Seu pedido já foi enviado para o Caseirão.</span></div>';const qrWrap=document.querySelector('.pixQrWrap');if(qrWrap)qrWrap.classList.add('pixPaidFade');const copyField=document.querySelector('.pixCopyField');if(copyField)copyField.classList.add('pixPaidFade')}}}catch{}},5000)}
function openTracking(code='',phone=''){let saved={};try{saved=JSON.parse(localStorage.getItem('caseirao_last_tracking')||'{}')}catch{}modal(`<div class="head"><h2>Acompanhar pedido</h2><button class="x" data-close>×</button></div><div class="field"><label>Código</label><input id="tcode" class="input" value="${esc(code||saved.tracking_code||'')}"></div><div class="field"><label>Telefone</label><input id="tphone" class="input" value="${esc(phone||saved.phone||'')}"></div><button id="track" class="primary">Consultar</button><div id="trackResult"></div>`);$('#track').onclick=async()=>{try{const j=await post('track-order',{tracking_code:$('#tcode').value.trim(),phone:digits($('#tphone').value)}),o=j.order;$('#trackResult').innerHTML=`<div class="success"><b>Pedido #${o.order_number}</b><br>Código: <b>${esc($('#tcode').value.trim())}</b><br>Status: <b>${esc(o.status)}</b><br>Total: <b>${money(o.total)}</b><br>Previsão: ${esc(o.eta_text||'')}</div>`}catch(e){$('#trackResult').innerHTML=`<div class="error">${esc(e.message)}</div>`}}}
function openLoyalty(){modal(`<div class="head"><h2>Minha fidelidade</h2><button class="x" data-close>×</button></div><div class="field"><label>WhatsApp com DDD</label><input id="lphone" class="input" inputmode="tel" value="${esc(customerMemory().phone||'')}"></div><button id="lgo" class="primary">Consultar</button><div id="lres"></div>`);$('#lgo').onclick=async()=>{try{const j=await post('loyalty-status',{phone:digits($('#lphone').value)}),l=j.loyalty;$('#lres').innerHTML=`<div class="success"><b>${l.progress} de ${l.orders_required} pedidos</b><br>Faltam ${l.remaining} para completar o ciclo.<br>Brindes disponíveis: <b>${l.reward_balance}</b></div>`}catch(e){$('#lres').innerHTML=`<div class="error">${esc(e.message)}</div>`}}}
function openCashback(){modal(`<div class="head"><h2>Meu cashback</h2><button class="x" data-close>×</button></div><div class="field"><label>WhatsApp com DDD</label><input id="cphone" class="input" inputmode="tel" value="${esc(customerMemory().phone||'')}"></div><button id="cgo" class="primary">Consultar</button><div id="cres"></div>`);$('#cgo').onclick=async()=>{try{const j=await post('cashback-api',{action:'status',payload:{phone:digits($('#cphone').value)}}),c=j.customer,s=j.settings;$('#cres').innerHTML=`<div class="success">Saldo: <b>${money(c.balance)}</b><br>Acumulado: ${money(c.earned)}<br>Usado: ${money(c.used)}</div>${s?.cashback_enabled?'<div class="notice">Cashback ativo no Caseirão.</div>':''}`}catch(e){$('#cres').innerHTML=`<div class="error">${esc(e.message)}</div>`}}}
function repeatLastOrder(){
 let saved={};try{saved=JSON.parse(localStorage.getItem('caseirao_last_tracking')||'{}')}catch{}
 const ask=async()=>{
  let code=String(saved.tracking_code||'').trim(),phone=digits(saved.phone||customerMemory().phone||'');
  if(!code){const v=prompt('Digite o código do seu último pedido:','');if(v===null)return;code=v.trim()}
  if(!phone){const v=prompt('Digite o WhatsApp usado no pedido:','');if(v===null)return;phone=digits(v)}
  if(!code||phone.length<10){alert('Informe o código do pedido e um WhatsApp válido.');return}
  const btn=$('#repeatBtn');if(btn){btn.disabled=true;btn.textContent='Buscando pedido…'}
  try{
   const j=await post('track-order',{tracking_code:code,phone}),o=j.order,items=Array.isArray(o?.order_items)?o.order_items:[];
   if(!items.length)throw new Error('Não encontrei os itens desse pedido.');
   const rebuilt=[],missing=[];
   for(const old of items){
    const product=data.products.find(p=>String(p.id)===String(old.product_id))||data.products.find(p=>String(p.name||'').trim().toLowerCase()===String(old.product_name||'').trim().toLowerCase());
    if(!product||product.active===false||product.sold_out){missing.push(old.product_name||'Item indisponível');continue}
    const oldAddons=Array.isArray(old.order_item_addons)?old.order_item_addons:[];
    const addons=[];
    for(const oa of oldAddons){
     const addon=data.addons.find(a=>String(a.id)===String(oa.addon_id))||data.addons.find(a=>String(a.name||'').trim().toLowerCase()===String(oa.addon_name||'').trim().toLowerCase());
     if(addon&&addon.active!==false&&!addon.sold_out)addons.push(addon);
    }
    rebuilt.push({key:crypto.randomUUID(),product,addons,note:String(old.note||''),qty:Math.max(1,Number(old.quantity||old.qty||1))});
   }
   if(!rebuilt.length)throw new Error('Os itens do pedido anterior não estão disponíveis no cardápio agora.');
   cart=rebuilt;updateCart();
   localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:code,phone}));
   renderCart();
   if(missing.length)setTimeout(()=>alert('Alguns itens indisponíveis não foram adicionados: '+missing.join(', ')),150);
  }catch(e){alert(e.message||'Não foi possível repetir esse pedido agora.')}finally{if(btn){btn.disabled=false;btn.textContent='🔁 Pedir novamente'}}
 };
 ask();
}
function openPromos(){const list=data.products.filter(p=>p.active!==false&&Number(p.promo_price)>0);modal(`<div class="head promoHead"><div><h2>Promoções</h2><small>Ofertas especiais do Caseirão</small></div><button class="x" data-close>×</button></div><div class="promoList">${list.length?list.map(p=>`<article class="promoCard"><div class="promoPhoto">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:'<span>Sem foto</span>'}</div><div class="promoInfo"><b class="promoName">${esc(p.name)}</b><div class="promoPrices"><span class="old">${money(p.price)}</span><strong>${money(p.promo_price)}</strong></div></div><button class="promoAdd" data-pa="${p.id}" ${p.sold_out?'disabled':''}>${p.sold_out?'Esgotado':'Adicionar'}</button></article>`).join(''):'<div class="notice">Nenhuma promoção de produto ativa agora.</div>'}</div>`);$$('[data-pa]').forEach(b=>b.onclick=()=>{if(!b.disabled)openProduct(b.dataset.pa)})}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')}};
$('#search').oninput=e=>{search=e.target.value;render()};$('#cartBtn').onclick=renderCart;$('#repeatBtn').onclick=repeatLastOrder;$('#trackBtn').onclick=()=>openTracking();$('#loyaltyBtn').onclick=openLoyalty;$('#cashbackBtn').onclick=openCashback;$('#promoBtn').onclick=openPromos;
const premiumOffers=[
 {title:'Bateu a fome?',accent:'Vem de Caseirão.',support:'Escolha seu favorito e peça em poucos cliques.'},
 {title:'Seu lanche favorito',accent:'está logo aqui.',support:'Monte do seu jeito. A gente prepara com capricho.'},
 {title:'Hoje combina com',accent:'hambúrguer artesanal.',support:'Peça pelo sistema e acompanhe tudo pelo celular.'},
 {title:'Mais sabor.',accent:'Menos espera.',support:'Escolha, personalize e envie seu pedido agora.'}
];
let premiumOfferIndex=0,premiumOfferTimer=null;
const drawPremiumOffer=()=>{const line=$('#premiumOfferLine'),support=$('#premiumOfferSupport'),offer=premiumOffers[premiumOfferIndex];if(!line||!support)return;line.classList.add('isChanging');setTimeout(()=>{line.innerHTML=`<span>${offer.title}</span><em>${offer.accent}</em>`;support.textContent=offer.support;line.classList.remove('isChanging')},180)};
if(!matchMedia('(prefers-reduced-motion: reduce)').matches)premiumOfferTimer=setInterval(()=>{premiumOfferIndex=(premiumOfferIndex+1)%premiumOffers.length;drawPremiumOffer()},3800);
addEventListener('scroll',scheduleCategoryScrollSpy,{passive:true});addEventListener('resize',scheduleCategoryScrollSpy,{passive:true});
$('#premiumMenuCta')?.addEventListener('click',()=>{const best=$('#bestSection');const target=best&&!best.classList.contains('hidden')?best:$('#products');target?.scrollIntoView({behavior:'smooth',block:'start'})});
const premiumReveal=()=>{$$('#products .card,.bestCard').forEach((el,index)=>{if(el.dataset.premiumReveal)return;el.dataset.premiumReveal='1';el.style.setProperty('--reveal-delay',`${Math.min(index,7)*45}ms`);el.classList.add('premiumReveal')})};
const premiumObserver=new MutationObserver(premiumReveal);premiumObserver.observe($('#products'),{childList:true});premiumObserver.observe($('#bestTrack'),{childList:true});
setInterval(()=>{if(!catalogLoaded)return;const next=JSON.stringify(automaticStoreState());if(next!==lastAutomaticStoreState){lastAutomaticStoreState=next;render()}else drawAutomaticStoreNotice()},15000);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
updateCart();premiumReveal();loadCatalog();
})();
