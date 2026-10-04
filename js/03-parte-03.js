
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
  new MutationObserver(polishAdminLabels).observe(document.body,{childList:true,subtree:true});
  polishAdminLabels();
})();
