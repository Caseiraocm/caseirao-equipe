
/* Recuperação segura do cadastro do cliente salvo no banco. */
(()=>{
  const originalOpenCheckout=openCheckout;
  const lastOrder=()=>{try{return JSON.parse(localStorage.getItem('caseirao_last_tracking')||'{}')}catch{return{}}};
  const fillProfile=profile=>{
    if(!profile?.customer)return false;
    const address=(profile.addresses||[])[0]||{};
    if($('#custName'))$('#custName').value=profile.customer.name||'';
    if($('#custPhone'))$('#custPhone').value=phoneMask(profile.customer.phone||'');
    if(orderType==='delivery'){
      if($('#street'))$('#street').value=address.street||'';
      if($('#number'))$('#number').value=address.number||'';
      if($('#complement'))$('#complement').value=address.complement||'';
      if($('#reference'))$('#reference').value=address.reference||'';
      if($('#neighborhood')&&address.neighborhood_id){$('#neighborhood').value=address.neighborhood_id;$('#neighborhood').dispatchEvent(new Event('change'))}
    }
    saveCustomerMemory({name:profile.customer.name,phone:phoneMask(profile.customer.phone||''),...address});
    return true;
  };
  const recover=async(phone,tracking,quiet=false)=>{
    const status=$('#customerRestoreStatus');
    try{
      if(status)status.textContent='Buscando seu cadastro...';
      const profile=await api('customer-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,tracking_code:tracking})});
      fillProfile(profile);
      if(status)status.textContent='✓ Dados preenchidos. Confira antes de enviar.';
      return true;
    }catch(error){
      if(status)status.textContent=quiet?'':(error.message||'Não foi possível recuperar seus dados.');
      return false;
    }
  };
  openCheckout=function(){
    originalOpenCheckout();
    const name=$('#custName');if(!name)return;
    const row=name.closest('.row');
    const button=document.createElement('button');button.type='button';button.id='restoreCustomer';button.className='customerRestore';button.textContent='JÁ PEDIU ANTES? RECUPERAR MEUS DADOS';
    const status=document.createElement('div');status.id='customerRestoreStatus';status.className='customerRestoreStatus';
    row.insertAdjacentElement('afterend',button);button.insertAdjacentElement('afterend',status);
    button.onclick=async()=>{
      const previous=lastOrder(),phone=prompt('Digite o WhatsApp usado no pedido:',phoneMask($('#custPhone')?.value||previous.phone||''));if(phone===null)return;
      const code=prompt('Digite o código de um pedido anterior:',previous.tracking_code||'');if(code===null)return;
      button.disabled=true;button.textContent='RECUPERANDO...';await recover(phone,code);button.disabled=false;button.textContent='JÁ PEDIU ANTES? RECUPERAR MEUS DADOS';
    };
    const previous=lastOrder();if(previous.phone&&previous.tracking_code)recover(previous.phone,previous.tracking_code,true);
  };
})();
