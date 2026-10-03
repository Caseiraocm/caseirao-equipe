/* Caseirão Professional Shell v1
   Corrige a estrutura visual do ADM sem substituir as regras de negócio. */
(()=>{
  'use strict';

  const primaryTabs=['visao','pedidos','mesas','producao','entregas'];
  const labels={
    visao:'Visão geral',pedidos:'Pedidos',mesas:'Mesas',producao:'Produção',
    entregas:'Entregas',caixa:'Caixa',cashback:'Cashback',premiado:'Pedido premiado',
    fidelidade:'Fidelidade',gestao:'Indicadores',relatorios:'Histórico',
    promocoes:'Promoções',produtos:'Produtos',adicionais:'Adicionais',
    bairros:'Bairros e taxas',cupons:'Cupons',banner:'Banners',
    funcionarios:'Funcionários',loja:'Loja e expediente'
  };
  let scheduled=false;

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;enhanceLauncher();normalizeAdmin()});
  }

  function enhanceLauncher(){
    const home=document.querySelector('#teamHome');
    const card=home?.querySelector('.teamLauncherCard');
    if(!card)return;
    home.setAttribute('aria-label','Central de operação do Caseirão');
    const kicker=card.querySelector('.teamLauncherKicker');
    if(kicker)kicker.textContent='OPERAÇÃO DO CASEIRÃO';
    const live=card.querySelector('.teamLauncherLive');
    if(live){live.textContent='Sistema pronto';live.setAttribute('role','status')}
    card.querySelectorAll('.teamChoice').forEach(button=>button.setAttribute('aria-label',button.querySelector('strong')?.textContent||'Abrir área'));
  }

  function normalizeAdmin(){
    const sheet=document.querySelector('.sheet.full.admWorkspace');
    if(!sheet)return;
    const head=sheet.querySelector(':scope > .adminHead');
    const metrics=sheet.querySelector(':scope > .admgrid');
    const payments=sheet.querySelector(':scope > .paymentMetrics');
    const bar=sheet.querySelector(':scope > .admbar');
    if(!bar)return;

    const primary=bar.querySelector(':scope > .admPrimaryNav');
    const body=bar.querySelector(':scope > .admWorkspaceBody');
    const toggle=bar.querySelector(':scope > .admManagementToggle');
    const backdrop=bar.querySelector(':scope > .admManagementBackdrop');

    /* A versão antiga colocava todo o conteúdo dentro da barra de navegação.
       Reposicionar como irmãos evita compactação, rolagem dupla e menu sobreposto. */
    if(primary&&!sheet.querySelector(':scope > .admPrimaryNav'))sheet.insertBefore(primary,body||bar.nextSibling);
    if(body&&!sheet.querySelector(':scope > .admWorkspaceBody'))sheet.appendChild(body);
    if(toggle&&!sheet.querySelector(':scope > .admManagementToggle'))sheet.insertBefore(toggle,sheet.querySelector(':scope > .admWorkspaceBody'));
    if(backdrop&&!sheet.querySelector(':scope > .admManagementBackdrop'))sheet.appendChild(backdrop);
    if(!bar.querySelector('button[data-tab]'))bar.remove();

    const nav=sheet.querySelector(':scope > .admPrimaryNav');
    nav?.querySelectorAll('button[data-tab]').forEach(button=>{
      const key=button.dataset.tab;
      if(labels[key])button.textContent=labels[key];
      button.setAttribute('aria-current',button.classList.contains('on')?'page':'false');
    });
    const aside=sheet.querySelector('.admManagement');
    aside?.querySelectorAll('button[data-tab]').forEach(button=>{
      const key=button.dataset.tab;
      if(labels[key])button.textContent=labels[key];
      button.setAttribute('aria-current',button.classList.contains('on')?'page':'false');
    });
    if(aside){
      const title=aside.querySelector('.admManagementTitle');
      if(title)title.innerHTML='<b>Gestão</b><span>Configurações e resultados</span>';
    }
    if(head){
      head.classList.add('professionalHead');
      const title=head.querySelector('h2');
      if(title)title.textContent='Central Caseirão';
    }
    metrics?.setAttribute('aria-label','Resumo do expediente');
    payments?.setAttribute('aria-label','Recebimentos do expediente');

    const content=sheet.querySelector('#admContent');
    if(content){
      content.setAttribute('role','main');
      content.setAttribute('aria-live','polite');
    }
    sheet.dataset.professional='1';
  }

  document.addEventListener('click',event=>{
    const tab=event.target.closest?.('button[data-tab]');
    if(tab)requestAnimationFrame(schedule);
  },true);
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
