/* O Caseirão Burger — Central Profissional v2 */
(()=>{
  'use strict';
  const sections=[
    {group:'Operação',items:[['visao','⌂','Visão geral'],['pedidos','⚡','Pedidos'],['atendimento_chat','◌','Atendimento'],['feedback','★','Feedback'],['agendados','▣','Agendados'],['mesas','▦','Mesas'],['producao','🍔','Produção'],['entregas','🛵','Entregas'],['caixa','$','Caixa']]},
    {group:'Clientes e vendas',items:[['cartao_caseirao','▣','Cartão Caseirão'],['cashback','◆','Cashback'],['premiado','🎁','Pedido premiado'],['fidelidade_pontos','★','Clube Pontos'],['promocoes','🔥','Promoções']]},
    {group:'Gestão',items:[['gestao','▥','Indicadores'],['relatorios','▥','Relatórios'],['financeiro','▤','Financeiro'],['reserva_impostos','%','Reserva de impostos'],['consumo','▤','Consumo funcionários'],['pagamentos_equipe','▣','Pagamentos da equipe'],['estoque','▥','Estoque'],['produtos','🍔','Produtos'],['adicionais','＋','Adicionais'],['bairros','⌖','Bairros e taxas'],['cupons','%','Cupons'],['banner','▣','Banners'],['funcionarios','♟','Funcionários'],['loja','⚙','Loja e expediente']]}
  ];
  const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const paymentKey=value=>{const key=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(key.includes('pix'))return'pix';if(key.includes('dinheiro'))return'dinheiro';if(key.includes('cartao')||key.includes('credito')||key.includes('debito'))return'cartao';return''};
  const navHtml=()=>sections.map(section=>`<section class="proNavGroup"><div class="proNavLabel">${section.group}</div>${section.items.map(([key,icon,label])=>`<button type="button" data-pro-tab="${key}" class="proNavButton ${adminTab===key?'active':''}"><span>${icon}</span><b>${label}</b>${key==='atendimento_chat'?'<strong class="supportBadge" data-support-unread hidden></strong>':''}</button>`).join('')}</section>`).join('');
  function enhanceHome(){const card=document.querySelector('.teamLauncherCard');if(!card)return;const kicker=card.querySelector('.teamLauncherKicker');if(kicker&&kicker.textContent!=='CENTRAL OFICIAL DO CASEIRÃO')kicker.textContent='CENTRAL OFICIAL DO CASEIRÃO';const live=card.querySelector('.teamLauncherLive');if(live&&live.textContent!=='● SISTEMA ONLINE')live.textContent='● SISTEMA ONLINE'}
  function cashMetrics(){
    const orders=typeof shiftOrders==='function'?shiftOrders():(admin.orders||[]);
    const valid=orders.filter(order=>typeof orderCountsAsSale==='function'?orderCountsAsSale(order):order.status!=='cancelado');
    const sales=valid.reduce((sum,order)=>sum+Number(order.total||0),0);
    const active=orders.filter(order=>!['entregue','cancelado'].includes(order.status)).length;
    const payments=valid.reduce((sum,order)=>{const key=paymentKey(order.payment==='Cartão Caseirão'?'':order.payment);if(key)sum[key]+=Number(order.total||0);return sum},{pix:0,dinheiro:0,cartao:0});
    return `<section class="proMetrics"><article><span class="proMetricIcon yellow">⚡</span><div><small>EM ANDAMENTO</small><b>${active}</b><em>pedidos ativos</em></div></article><article><span class="proMetricIcon dark">▣</span><div><small>PEDIDOS DO CAIXA</small><b>${orders.length}</b><em>neste expediente</em></div></article><article><span class="proMetricIcon green">$</span><div><small>COMANDAS LIBERADAS</small><b>${money(sales)}</b><em>valor dos pedidos do turno</em></div></article><article><span class="proMetricIcon blue">◆</span><div><small>COMANDAS PIX</small><b>${money(payments.pix)}</b><em>valor dos pedidos confirmados</em></div></article></section>`;
  }
  function openTaxReserve(box) {
    if (typeof window.renderTaxReserve === 'function') {
      window.renderTaxReserve(box);
      return;
    }

    const status = document.createElement('p');
    status.className = 'notice';
    status.setAttribute('role', 'status');
    status.textContent = 'Carregando a reserva de impostos…';
    box.replaceChildren(status);

    const retry = document.createElement('script');
    retry.src = new URL('./js/tax-reserve.js', document.baseURI).href + '?v=20261123-reserva-v3-retry';
    const finish = () => {
      retry.remove();
      if (!box.isConnected) return;
      if (typeof window.renderTaxReserve === 'function') {
        window.renderTaxReserve(box);
        return;
      }
      status.className = 'err';
      status.textContent = 'A reserva de impostos não carregou. Toque em Atualizar no topo para tentar novamente.';
    };
    retry.onload = finish;
    retry.onerror = finish;
    document.head.appendChild(retry);
  }
  window.renderAdmin=function(){
    if(!admin)return;
    operationalMode='admin';
    const opened=!!admin.settings?.store_open;
    const title=sections.flatMap(x=>x.items).find(x=>x[0]===adminTab)?.[2]||'Central';
    modal(`<div class="proAdmin proCaseiraoHeader" data-pro-section="${adminTab}"><header class="proHeader">
      <button type="button" id="proMenu" class="proMenu" aria-label="Abrir menu" aria-controls="proSidebar" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 5h18M3 12h18M3 19h18"/></svg>
      </button>
      <div class="proBrand">
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M2 15a14 11 0 0 1 28 0z"/><rect x="2" y="20" width="28" height="6" rx="3"/></svg>
        <b>Caseirão <em>Burger</em></b>
      </div>
      <span class="proHeaderSection" aria-current="page">${title}</span>
      <div class="proHeaderStatus ${opened?'open':'closed'}"><i aria-hidden="true"></i>${opened?'Loja aberta':'Loja fechada'}</div>
      <button type="button" id="proSupport" class="proHeaderButton" aria-label="Atendimento"><span>Atendimento</span><strong class="supportBadge" data-support-unread hidden></strong></button>
      <button type="button" id="proSchedules" class="proHeaderButton scheduleShortcut" aria-label="Ver agendamentos" title="Ver agendamentos">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4m-7 8h6"/></svg>
        <strong hidden></strong>
      </button>
      <button type="button" id="proRefresh" class="proHeaderButton" aria-label="Atualizar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 4v6h-6M21 10a9 9 0 1 0 0 5"/></svg>
        <span>Atualizar</span>
      </button>
    </header><aside class="proSidebar" id="proSidebar" hidden><div class="proSidebarHead"><b>MENU PRINCIPAL</b><button type="button" id="proMenuClose" aria-label="Fechar menu">×</button></div><nav class="proSectionNav" aria-label="Menu principal">${navHtml()}</nav><section class="proNavGroup proSessionActions" aria-label="Sessão">
      <button type="button" id="proHome" class="proNavButton"><span aria-hidden="true">⌂</span><b>Início</b></button>
      <button type="button" id="adminLogout" class="proNavButton"><span aria-hidden="true">↪</span><b>Sair</b></button>
    </section><div class="proSidebarFoot"><span class="${opened?'on':'off'}"></span><div><b>${opened?'Expediente aberto':'Expediente fechado'}</b><small>O Caseirão Burger</small></div></div></aside><button type="button" class="proBackdrop" id="proBackdrop" aria-label="Fechar menu" tabindex="-1" hidden></button><main class="proMain"><section class="proPageTitle"><div><small>PAINEL ADMINISTRATIVO</small><h1 tabindex="-1">${title}</h1></div>${['estoque','cartao_caseirao','reserva_impostos'].includes(adminTab)?'':'<button type="button" id="proManualOrder">＋ Novo pedido</button>'}</section>${adminTab==='caixa'?cashMetrics():''}<section class="proContent" id="admContent" aria-live="polite"></section></main></div>`,true);
    bindClose();
    const menu = $('#proMenu');
    const closeMenu = $('#proMenuClose');
    const sidebar = $('#proSidebar');
    const backdrop = $('#proBackdrop');
    const main = $('.proMain');
    function setMenu(open) {
      sidebar.hidden = !open;
      backdrop.hidden = !open;
      backdrop.classList.toggle('show', open);
      main.inert = open;
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      (open ? closeMenu : menu).focus({preventScroll: true});
    }
    menu.onclick = () => setMenu(sidebar.hidden);
    closeMenu.onclick = backdrop.onclick = () => setMenu(false);
    menu.closest('.proAdmin').addEventListener('keydown', event => {
      if (event.key === 'Escape' && !sidebar.hidden) {
        event.preventDefault();
        setMenu(false);
      }
    });
    sidebar.querySelectorAll('[data-pro-tab]').forEach(button => {
      button.onclick = () => {
        adminTab = button.dataset.proTab;
        renderAdmin();
        $('.proPageTitle h1')?.focus({preventScroll: true});
      };
    });
    $('#proHome').onclick=()=>{clearInternalResume();leaveOperationalMode()};
    $('#adminLogout').onclick=()=>{sessionStorage.removeItem('caseirao_admin_pin');clearInternalResume();if(orderWatcher)clearInterval(orderWatcher);admin=null;openAdmin()};
    $('#proSupport').onclick=()=>{adminTab='atendimento_chat';renderAdmin()};
    window.caseiraoMountScheduleAlerts?.($('#proSchedules'));
    $('#proRefresh').onclick=async()=>{
      const button=$('#proRefresh');
      const label=button.querySelector('span');
      button.disabled=true;
      button.setAttribute('aria-label','Atualizando');
      label.textContent='Atualizando…';
      try{
        const snapshot=await adminCall('snapshot');
        if(!button.isConnected)return;
        admin=snapshot;
        renderAdmin();
        $('#proRefresh')?.focus({preventScroll:true});
      }catch(error){
        if(!button.isConnected)return;
        button.disabled=false;
        button.setAttribute('aria-label','Atualizar');
        label.textContent='Atualizar';
        alert(error.message||String(error));
      }
    };
    const manualOrder=$('#proManualOrder');
    if(manualOrder)manualOrder.onclick=()=>openManualOrder();
    if (adminTab === 'reserva_impostos') openTaxReserve($('#admContent'));
    else if (adminTab === 'financeiro') {
      const box = $('#admContent');
      if (typeof window.renderBusinessFinance === 'function') window.renderBusinessFinance(box);
      else box.innerHTML = '<p class="notice">O Financeiro não carregou. Atualize a Central e tente novamente.</p>';
    }
    else if (adminTab === 'fidelidade_pontos') window.renderCaseiraoPointsAdmin($('#admContent'));
    else if (adminTab === 'feedback') window.renderCaseiraoFeedbackAdmin($('#admContent'));
    else renderAdminTab();
  };
  new MutationObserver(enhanceHome).observe(document.body,{childList:true,subtree:true});enhanceHome();
})();
