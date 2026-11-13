/* Modelo 2: usa os pedidos e as rotinas originais de impressão e WhatsApp. */
(()=>{
  'use strict';
  let queued=false;
  const tones={novo:'received',confirmado:'received',preparando:'preparing',pronto:'ready',em_rota:'route',entregue:'finished',cancelado:'cancelled'};
  function enhance(){
    queued=false;
    document.querySelectorAll('details.orderDetailed').forEach(card=>{
      const id=card.querySelector('[data-oid]')?.dataset.oid||card.querySelector('[data-webprint]')?.dataset.webprint;
      const order=(admin?.orders||[]).find(o=>String(o.id)===String(id));
      if(!order)return;
      const tone=tones[order.status]||'received';
      if(card.dataset.premiumTone!==tone)card.dataset.premiumTone=tone;
      const summary=card.querySelector(':scope > summary');
      if(!summary||summary.querySelector('.premiumQuick'))return;
      const quick=document.createElement('span');quick.className='premiumQuick';
      const url=customerWhatsAppUrl(order);
      const wa=document.createElement(url?'a':'button');wa.className='premiumWhatsApp';
      wa.textContent='☏ WhatsApp';
      if(url){wa.href=url;wa.target='_blank';wa.rel='noopener';wa.setAttribute('aria-label',`WhatsApp do cliente do pedido ${order.order_number}`)}
      else {wa.type='button';wa.disabled=true;wa.title='Cliente sem telefone válido';wa.textContent='Sem telefone'}
      const print=document.createElement('button');print.type='button';print.className='premiumPrint';print.textContent='▤ Imprimir pedido';
      print.setAttribute('aria-label',`Imprimir pedido ${order.order_number}`);
      print.onclick=event=>{event.preventDefault();event.stopPropagation();printOrderBrowser(order.id)};
      wa.addEventListener('click',event=>event.stopPropagation());
      quick.append(wa,print);summary.append(quick);
    });
    document.querySelectorAll('.teamLogo,.admLoginBrand').forEach(logo=>{
      if(!logo.querySelector('img'))logo.innerHTML='<img src="./assets/logo-caseirao.svg" alt="O Caseirão Burger">';
    });
    const login=document.querySelector('.sheet.admLoginPremium');
    if(login&&!login.querySelector('.premiumLoginIdentity')){
      const identity=document.createElement('section');identity.className='premiumLoginIdentity';
      identity.innerHTML='<img src="./assets/logo-caseirao.svg" alt="Logo oficial O Caseirão Burger"><span>CENTRAL DE OPERAÇÕES</span><h1>O sabor da casa.<br>A gestão nas suas mãos.</h1><p>Pedidos, equipe e entregas em um só lugar.</p>';
      login.prepend(identity);
    }
    document.querySelectorAll('.packOrder,.kitchenCard,.deliveryCard').forEach(card=>{
      if(!card.classList.contains('premiumPanelCard'))card.classList.add('premiumPanelCard');
    });
  }
  new MutationObserver(records=>{
    if(queued||!records.some(r=>r.addedNodes.length))return;
    queued=true;requestAnimationFrame(enhance);
  }).observe(document.body,{childList:true,subtree:true});
  enhance();
})();
