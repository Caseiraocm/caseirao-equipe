(()=>{
 const cashbackApi=(action,payload={})=>window.api('cashback-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
 const premiumMoney=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 let carouselTimer=null;

 function premiumBlocks(){
  const banner=document.querySelector('#banner');if(!banner)return;
  const d=window.caseiraoData||{},esc=window.caseiraoEsc,fmt=window.caseiraoFmt,priceOf=window.caseiraoPriceOf,openProduct=window.caseiraoOpenProduct;
  if(!esc||!fmt||!priceOf||!openProduct)return;

  /* Remove o bloco decorativo antigo que ocupava muito espaço. */
  document.querySelector('#premiumWelcome')?.remove();

  const cashbackPercent=(d.settings?.cashback_enabled===false)?0:Math.max(0,Number(d.settings?.cashback_percent||0));
  const picks=(d.products||[])
   .filter(p=>p.active!==false&&!p.sold_out&&p.image_url&&Number(p.sold_qty||0)>0)
   .sort((a,b)=>Number(b.sold_qty||0)-Number(a.sold_qty||0))
   .slice(0,8);

  let section=document.querySelector('#featuredSection');
  if(!picks.length){
   if(carouselTimer)clearInterval(carouselTimer);carouselTimer=null;section?.remove();
  }else{
   if(!section){section=document.createElement('section');section.id='featuredSection';section.className='featuredSection'}
   /* Mais pedidos imediatamente abaixo do banner. */
   if(banner.nextElementSibling!==section)banner.insertAdjacentElement('afterend',section);
   section.innerHTML='<div class="featuredHead"><h3>🔥 Mais pedidos</h3><span>Os favoritos de quem pede no Caseirão</span></div><div class="featuredRail">'+
    picks.map((p,i)=>{
     const value=priceOf(p),cashback=value*cashbackPercent/100,sold=Number(p.sold_qty||0);
     return `<article class="featuredItem" data-premium-product="${esc(p.id)}">
       <span class="featuredTag">#${i+1} MAIS PEDIDO</span>
       <img src="${esc(p.image_url)}" alt="${esc(p.name)}">
       <div class="featuredItemInfo">
        <b>${esc(p.name)}</b>
        <span>${Number(p.promo_price)>0?`<small class="featuredOld">${fmt(p.price)}</small>`:''}${fmt(value)}</span>
        <small class="featuredSales">${sold} ${sold===1?'pedido':'pedidos'} registrados</small>
        ${cashbackPercent>0?`<small class="featuredCashback">↩ ${cashbackPercent}% cashback • ganhe ${fmt(cashback)}</small>`:''}
       </div>
      </article>`;
    }).join('')+'</div>';
   section.querySelectorAll('[data-premium-product]').forEach(el=>el.onclick=()=>openProduct(el.dataset.premiumProduct));
   startFeaturedCarousel();
  }

  /* Cashback compacto, depois do bloco de ofertas quando ele existir. */
  let club=document.querySelector('#cashbackClub');
  if(!club){
   club=document.createElement('section');club.id='cashbackClub';club.className='cashbackClub';
   club.innerHTML='<div class="cashbackIcon">$</div><div class="cashbackClubCopy"><b>Clube Cashback Caseirão</b><span>Consulte seu saldo e use nas próximas compras.</span></div><button type="button" id="openCashback">Consultar saldo</button>';
  }
  const benefits=document.querySelector('#systemBenefits');
  if(benefits) benefits.insertAdjacentElement('afterend',club);
  else if(section) section.insertAdjacentElement('afterend',club);
  else banner.insertAdjacentElement('afterend',club);
  club.querySelector('#openCashback').onclick=openCashback;
 }

 function decorateProductCashback(){
  const d=window.caseiraoData||{},settings=d.settings||{},fmt=window.caseiraoFmt,priceOf=window.caseiraoPriceOf;
  const percent=settings.cashback_enabled===false?0:Math.max(0,Number(settings.cashback_percent||0));
  document.querySelectorAll('#products .productCashbackBadge').forEach(el=>el.remove());
  if(!percent||!fmt||!priceOf)return;
  document.querySelectorAll('#products [data-add]').forEach(button=>{
   const card=button.closest('.card'),pic=card?.querySelector('.pic');if(!card||!pic)return;
   const product=(d.products||[]).find(p=>String(p.id)===String(button.dataset.add));if(!product)return;
   const price=Number(priceOf(product)||0),min=Number(settings.cashback_min_order||0);if(price<min)return;
   const badge=document.createElement('span');badge.className='productCashbackBadge';
   badge.innerHTML=`↩ <b>${fmt(price*percent/100)}</b> cashback`;
   pic.appendChild(badge);
  });
 }

 function startFeaturedCarousel(){
  if(carouselTimer){clearInterval(carouselTimer);carouselTimer=null}
  const rail=document.querySelector('#featuredSection .featuredRail');if(!rail)return;
  const cards=[...rail.querySelectorAll('.featuredItem')];if(cards.length<2)return;
  let paused=false,index=0,resumeTimer=null;
  const syncIndex=()=>{index=cards.reduce((best,c,i)=>Math.abs(c.offsetLeft-rail.scrollLeft)<Math.abs(cards[best].offsetLeft-rail.scrollLeft)?i:best,0)};
  const pause=()=>{paused=true;if(resumeTimer)clearTimeout(resumeTimer)};
  const resume=()=>{syncIndex();resumeTimer=setTimeout(()=>paused=false,2200)};
  rail.addEventListener('touchstart',pause,{passive:true});rail.addEventListener('touchend',resume,{passive:true});
  rail.addEventListener('pointerdown',pause,{passive:true});rail.addEventListener('pointerup',resume,{passive:true});
  carouselTimer=setInterval(()=>{if(paused||!document.body.contains(rail))return;index=(index+1)%cards.length;rail.scrollTo({left:cards[index].offsetLeft-rail.offsetLeft,behavior:'smooth'})},4200);
 }

 function openCashback(){
  const $=window.caseirao$,esc=window.caseiraoEsc;
  if(!$||!esc||!window.caseiraoModal||!window.caseiraoBindClose)return;
  window.caseiraoModal('<div class="sheeth"><div><h2>Meu cashback</h2><div class="adminSub">Consulte pelo WhatsApp usado nos pedidos</div></div><button class="x" data-close>×</button></div><div class="field"><label>Seu WhatsApp</label><input id="cashbackPhone" class="in" inputmode="tel" placeholder="(86) 99999-9999"></div><button id="cashbackLookup" class="primary">CONSULTAR SALDO</button><div id="cashbackLookupResult"></div>');
  window.caseiraoBindClose();
  let remembered={};try{remembered=JSON.parse(localStorage.getItem('caseirao_customer')||'{}')}catch{}
  if(remembered.phone)$('#cashbackPhone').value=remembered.phone;
  $('#cashbackLookup').onclick=async()=>{
   const button=$('#cashbackLookup'),box=$('#cashbackLookupResult');
   try{
    button.disabled=true;button.textContent='CONSULTANDO...';
    const r=await cashbackApi('status',{phone:$('#cashbackPhone').value});
    box.innerHTML=`<div class="cashbackResult"><span>Saldo disponível de ${esc(r.customer.name||'cliente')}</span><div class="cashbackBalance">${premiumMoney(r.customer.balance)}</div><div class="mini">Cashback de ${Number(r.settings.cashback_percent||0)}% liberado após a entrega.</div><div class="cashbackStats"><div class="cashbackStat"><span>Total ganho</span><b>${premiumMoney(r.customer.earned)}</b></div><div class="cashbackStat"><span>Total utilizado</span><b>${premiumMoney(r.customer.used)}</b></div></div></div>`;
   }catch(e){box.innerHTML=`<div class="err">${esc(e.message||String(e))}</div>`}
   finally{button.disabled=false;button.textContent='CONSULTAR SALDO'}
  };
 }

 const renderCatalogBase=window.renderCatalog;
 if(typeof renderCatalogBase==='function')window.renderCatalog=function(){const out=renderCatalogBase();premiumBlocks();decorateProductCashback();return out};

 let cashbackAvailable=0,cashbackUse=0,cashbackMax=0,cashbackMin=0,cashbackObserver=null;

 function refreshCashbackTotal(){
  const sum=document.querySelector('#checkoutSum');if(!sum)return;
  sum.querySelectorAll('.cashbackDiscountLine').forEach(el=>el.remove());
  if(cashbackUse<=0)return;
  const totalRow=sum.querySelector('.sumrow.total');if(!totalRow)return;
  const totalValue=totalRow.querySelector('b');if(!totalValue)return;
  const rows=[...sum.querySelectorAll('.sumrow')].filter(r=>!r.classList.contains('total'));
  let base=0;
  rows.forEach(r=>{
   const txt=(r.querySelector('b')?.textContent||'').replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');
   const n=Number(txt||0);
   base+=r.classList.contains('discountLine')?-Math.abs(n):Math.abs(n);
  });
  const line=document.createElement('div');line.className='sumrow discountLine cashbackDiscountLine';
  line.innerHTML=`<span>Cashback aplicado</span><b>- ${premiumMoney(cashbackUse)}</b>`;
  totalRow.before(line);
  totalValue.textContent=premiumMoney(Math.max(0,base-cashbackUse));
 }

 function watchCashbackSummary(){
  if(cashbackObserver){cashbackObserver.disconnect();cashbackObserver=null}
  const sum=document.querySelector('#checkoutSum');if(!sum)return;
  let scheduled=false;
  const observe=()=>cashbackObserver&&cashbackObserver.observe(sum,{childList:true,subtree:true,characterData:true});
  cashbackObserver=new MutationObserver(()=>{
   if(cashbackUse<=0||scheduled)return;
   scheduled=true;
   cashbackObserver.disconnect();
   requestAnimationFrame(()=>{
    try{refreshCashbackTotal()}
    finally{scheduled=false;if(document.body.contains(sum))observe()}
   });
  });
  observe();
 }

 const openCheckoutBase=window.openCheckout;
 if(typeof openCheckoutBase==='function')window.openCheckout=function(){
  cashbackUse=0;cashbackAvailable=0;cashbackMax=0;cashbackMin=0;
  const out=openCheckoutBase(),$=window.caseirao$;const sum=$('#checkoutSum');if(!sum||$('#cashbackCheckout'))return out;
  const box=document.createElement('div');box.id='cashbackCheckout';box.className='cashbackCheckout';
  box.innerHTML='<div class="cashbackCheckoutTop"><div><b>Cashback Caseirão</b><small>Use seu saldo para pagar menos</small></div><button type="button" id="checkCheckoutCashback">CONSULTAR</button></div><div id="cashbackCheckoutState" class="cashbackCheckoutState">Consulte seu saldo pelo WhatsApp do pedido.</div><div id="cashbackUseRow" class="cashbackUseRow hide"><div class="cashbackAmountWrap"><span>R$</span><input id="cashbackAmount" inputmode="decimal" placeholder="0,00"></div><button type="button" id="applyCashback" class="cashbackApply">APLICAR CASHBACK</button></div><button type="button" id="removeCashback" class="cashbackRemove hide">REMOVER CASHBACK</button>';
  sum.before(box);watchCashbackSummary();

  $('#checkCheckoutCashback').onclick=async()=>{
   const state=$('#cashbackCheckoutState'),button=$('#checkCheckoutCashback');
   try{
    button.disabled=true;button.textContent='CONSULTANDO...';
    const phone=$('#custPhone')?.value||'';
    if(!phone.trim())throw new Error('Informe seu WhatsApp acima para consultar.');
    const r=await cashbackApi('status',{phone});
    cashbackAvailable=Number(r.customer.balance||0);
    cashbackMin=Number(r.settings.cashback_min_redeem||0);
    const percent=Number(r.settings.cashback_max_redeem_percent||100);
    cashbackMax=Math.max(0,Math.min(cashbackAvailable,window.caseiraoCartSubtotal()*percent/100));
    const eligible=cashbackAvailable>=cashbackMin&&cashbackMax>0;
    state.className='cashbackCheckoutState '+(eligible?'cashbackOk':'');
    state.innerHTML=eligible
      ?`Saldo <b>${premiumMoney(cashbackAvailable)}</b> • você pode aplicar até <b>${premiumMoney(cashbackMax)}</b> neste pedido.`
      :`Saldo <b>${premiumMoney(cashbackAvailable)}</b> • mínimo para usar: <b>${premiumMoney(cashbackMin)}</b>.`;
    $('#cashbackUseRow').classList.toggle('hide',!eligible);
    if(eligible)$('#cashbackAmount').value=cashbackMax.toFixed(2).replace('.',',');
   }catch(e){
    state.className='cashbackCheckoutState cashbackError';
    state.textContent=e.message||String(e);
    $('#cashbackUseRow').classList.add('hide');
   }finally{button.disabled=false;button.textContent='CONSULTAR'}
  };

  $('#applyCashback').onclick=()=>{
   const amount=Math.max(0,Number(String($('#cashbackAmount').value).replace(/\./g,'').replace(',','.'))||0);
   if(cashbackAvailable<cashbackMin)return alert(`O saldo mínimo para usar cashback é ${premiumMoney(cashbackMin)}.`);
   if(amount<=0)return alert('Informe o valor do cashback que deseja usar.');
   if(amount>cashbackMax+0.001)return alert(`Você pode usar no máximo ${premiumMoney(cashbackMax)} neste pedido.`);
   cashbackUse=Math.min(amount,cashbackMax);
   $('#cashbackCheckoutState').className='cashbackCheckoutState cashbackApplied';
   $('#cashbackCheckoutState').innerHTML=`✓ <b>${premiumMoney(cashbackUse)}</b> de cashback aplicado neste pedido.`;
   $('#cashbackUseRow').classList.add('hide');
   $('#removeCashback').classList.remove('hide');
   refreshCashbackTotal();
  };

  $('#removeCashback').onclick=()=>{
   cashbackUse=0;
   $('#removeCashback').classList.add('hide');
   $('#cashbackUseRow').classList.remove('hide');
   $('#cashbackCheckoutState').className='cashbackCheckoutState cashbackOk';
   $('#cashbackCheckoutState').innerHTML=`Saldo <b>${premiumMoney(cashbackAvailable)}</b> • você pode aplicar até <b>${premiumMoney(cashbackMax)}</b> neste pedido.`;
   refreshCashbackTotal();
  };
  return out;
 };

 const apiBase=window.api;
 if(typeof apiBase==='function')window.api=async function(slug,opts={}){if(slug==='create-order'&&opts.body&&cashbackUse>0){try{const body=JSON.parse(opts.body);body.cashback_to_use=cashbackUse;opts={...opts,body:JSON.stringify(body)}}catch{}}const response=await apiBase(slug,opts);if(slug==='create-order')cashbackUse=0;return response};

 setTimeout(()=>{premiumBlocks();decorateProductCashback()},0);
})();
