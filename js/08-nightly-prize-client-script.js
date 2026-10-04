
(()=>{
  const prizeRequest=async(action,trackingCode,phone)=>api('nightly-prize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload:{tracking_code:trackingCode,phone}})});
  const winnerHtml=prize=>prize?.is_winner?`<div class="nightPrizeWin"><h3>VOCÊ GANHOU!</h3><strong class="nightPrizeName">${esc(prize.prize_name||'Brinde do Caseirão')}</strong><p>${esc(prize.winner_message||'Você ganhou um brinde do Caseirão Burger!')}</p><span class="nightPrizeCode">${esc(prize.winner_code||'')}</span><div class="nightPrizeHint">Tire um print desta tela e envie para o Caseirão. Guarde também o código acima.</div></div>`:'';
  sendOrder=async function(){
    const btn=$('#sendOrder');
    try{
      const customer={name:$('#custName').value.trim(),phone:$('#custPhone').value.trim()};
      if(customer.name.length<2)throw new Error('Informe seu nome.');
      if(!validPhone(customer.phone))throw new Error('Informe um WhatsApp válido.');
      if(!cart.length)throw new Error('Seu carrinho está vazio.');
      if($('#coupon').value.trim()&&!appliedCoupon)await applyCheckoutCoupon();
      if($('#coupon').value.trim()&&!appliedCoupon)throw new Error('Confira o cupom antes de enviar.');
      const requestId=crypto.randomUUID(),payload={client_request_id:requestId,customer,type:orderType,payment:$('#payment').value,change_for:$('#changeFor').value.trim(),coupon_code:appliedCoupon?.code||'',notes:$('#orderNotes').value.trim(),scheduled_for:$('#scheduleMode')?.value==='schedule'?$('#scheduledFor').value:null,items:cart.map(x=>({product_id:x.product.id,qty:x.qty,addon_ids:x.addons.map(a=>a.id),note:x.note}))};
      if(payload.payment!=='Dinheiro')payload.change_for='';
      if(orderType==='delivery'){payload.address={street:$('#street').value.trim(),number:$('#number').value.trim(),neighborhood_id:$('#neighborhood').value,complement:$('#complement').value.trim(),reference:$('#reference').value.trim()};if(!payload.address.street||!payload.address.number||!payload.address.neighborhood_id)throw new Error('Preencha o endereço completo.');}
      btn.disabled=true;btn.textContent='ENVIANDO...';sessionStorage.setItem('caseirao_pending_request',JSON.stringify(payload));
      const j=await api('create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      sessionStorage.removeItem('caseirao_pending_request');
      let prize=j.prize||null;
      if(!prize){
        try{const result=await prizeRequest('claim',j.tracking_code,customer.phone);prize=result.prize||null}
        catch(error){console.error('Falha ao confirmar participação no Pedido Premiado:',error)}
      }
      saveCustomerMemory({name:customer.name,phone:phoneMask(customer.phone),...(payload.address||{})});
      localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:j.tracking_code,phone:customer.phone}));
      cart=[];updateCartBar();
      modal(`<div class="sheeth"><h2>${prize?.is_winner?'Pedido premiado! 🎁':'Pedido recebido ✅'}</h2><button class="x" data-close>×</button></div>${winnerHtml(prize)}<div class="success"><b>Pedido #${j.order_number}</b><br>Total: <b>${fmt(j.total)}</b>${j.discount?`<br>Desconto: <b>${fmt(j.discount+Number(j.delivery_discount||0))}</b>`:''}<br>Previsão: <b>${esc(j.eta_text||'a confirmar')}</b></div>${j.payment_status==='pending'?'<div class="pixWarning">Pagamento Pix aguardando confirmação. Envie o comprovante pelo WhatsApp.</div>':''}<button id="trackNow" class="primary">ACOMPANHAR PEDIDO</button>`);
      bindClose();$('#trackNow').onclick=()=>openTracking(j.tracking_code,customer.phone);
    }catch(e){alert(e.message||String(e));if(btn){btn.disabled=false;btn.textContent='CONFIRMAR E ENVIAR'}}
  };
  const baseTrackOrder=trackOrder;
  trackOrder=async function(){
    await baseTrackOrder();
    const result=$('#trackResult');if(!result)return;
    const code=$('#trackCode')?.value.trim(),phone=$('#trackPhone')?.value.trim();if(!code||!phone)return;
    try{const response=await prizeRequest('status',code,phone),prize=response.prize;if(prize?.is_winner&&!result.querySelector('.trackPrizeWin'))result.insertAdjacentHTML('afterbegin',`<div class="trackPrizeWin">${winnerHtml(prize)}</div>`)}catch{}
  };
})();
