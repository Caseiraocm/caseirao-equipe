/* O Caseirão Burger — Central Profissional v2 */
(()=>{
  'use strict';
  const sections=[
    {group:'Operação',items:[['visao','⌂','Visão geral'],['pedidos','⚡','Pedidos'],['agendados','▣','Agendados'],['mesas','▦','Mesas'],['producao','🍔','Produção'],['entregas','🛵','Entregas'],['caixa','$','Caixa']]},
    {group:'Clientes e vendas',items:[['cashback','◆','Cashback'],['premiado','🎁','Pedido premiado'],['fidelidade','★','Fidelidade'],['promocoes','🔥','Promoções']]},
    {group:'Gestão',items:[['gestao','▥','Indicadores'],['relatorios','▥','Relatórios'],['consumo','▤','Consumo funcionários'],['pagamentos_equipe','▣','Pagamentos da equipe'],['estoque','▥','Estoque'],['produtos','🍔','Produtos'],['adicionais','＋','Adicionais'],['bairros','⌖','Bairros e taxas'],['cupons','%','Cupons'],['banner','▣','Banners'],['funcionarios','♟','Funcionários'],['loja','⚙','Loja e expediente']]}
  ];
  const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const paymentKey=value=>{const key=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(key.includes('pix'))return'pix';if(key.includes('dinheiro'))return'dinheiro';if(key.includes('cartao')||key.includes('credito')||key.includes('debito'))return'cartao';return''};
  const navHtml=()=>sections.map(section=>`<section class="proNavGroup"><div class="proNavLabel">${section.group}</div>${section.items.map(([key,icon,label])=>`<button type="button" data-pro-tab="${key}" class="proNavButton ${adminTab===key?'active':''}"><span>${icon}</span><b>${label}</b></button>`).join('')}</section>`).join('');
  function enhanceHome(){const card=document.querySelector('.teamLauncherCard');if(!card)return;const kicker=card.querySelector('.teamLauncherKicker');if(kicker&&kicker.textContent!=='CENTRAL OFICIAL DO CASEIRÃO')kicker.textContent='CENTRAL OFICIAL DO CASEIRÃO';const live=card.querySelector('.teamLauncherLive');if(live&&live.textContent!=='● SISTEMA ONLINE')live.textContent='● SISTEMA ONLINE'}
  function cashMetrics(){
    const orders=typeof shiftOrders==='function'?shiftOrders():(admin.orders||[]);
    const valid=orders.filter(order=>typeof orderCountsAsSale==='function'?orderCountsAsSale(order):order.status!=='cancelado');
    const sales=valid.reduce((sum,order)=>sum+Number(order.total||0),0);
    const active=orders.filter(order=>!['entregue','cancelado'].includes(order.status)).length;
    const payments=valid.reduce((sum,order)=>{const key=paymentKey(order.payment);if(key)sum[key]+=Number(order.total||0);return sum},{pix:0,dinheiro:0,cartao:0});
    return `<section class="proMetrics"><article><span class="proMetricIcon yellow">⚡</span><div><small>EM ANDAMENTO</small><b>${active}</b><em>pedidos ativos</em></div></article><article><span class="proMetricIcon dark">▣</span><div><small>PEDIDOS DO CAIXA</small><b>${orders.length}</b><em>neste expediente</em></div></article><article><span class="proMetricIcon green">$</span><div><small>COMANDAS LIBERADAS</small><b>${money(sales)}</b><em>valor dos pedidos do turno</em></div></article><article><span class="proMetricIcon blue">◆</span><div><small>COMANDAS PIX</small><b>${money(payments.pix)}</b><em>valor dos pedidos confirmados</em></div></article></section>`;
  }
  window.renderAdmin=function(){
    if(!admin)return;
    const opened=!!admin.settings?.store_open;
    const title=sections.flatMap(x=>x.items).find(x=>x[0]===adminTab)?.[2]||'Central';
    modal(`<div class="proAdmin" data-pro-section="${adminTab}"><header class="proHeader"><button type="button" id="proMenu" class="proMenu" aria-label="Abrir menu" aria-controls="proSidebar" aria-expanded="false">☰</button><div class="proBrand"><span>CB</span><div><b>Central Caseirão</b><small>Operação e gestão</small></div></div><div class="proHeaderStatus ${opened?'open':'closed'}"><i></i>${opened?'Loja aberta':'Loja fechada'}</div><button type="button" id="proRefresh" class="proHeaderButton">↻ Atualizar</button><button type="button" id="adminLogout" class="proHeaderButton">Sair</button><button type="button" class="proHeaderClose" data-close aria-label="Fechar">×</button></header><aside class="proSidebar" id="proSidebar" hidden><div class="proSidebarHead"><b>MENU PRINCIPAL</b><button type="button" id="proMenuClose" aria-label="Fechar menu">×</button></div><nav aria-label="Menu principal">${navHtml()}</nav><div class="proSidebarFoot"><span class="${opened?'on':'off'}"></span><div><b>${opened?'Expediente aberto':'Expediente fechado'}</b><small>O Caseirão Burger</small></div></div></aside><button type="button" class="proBackdrop" id="proBackdrop" aria-label="Fechar menu" tabindex="-1" hidden></button><main class="proMain"><section class="proPageTitle"><div><small>PAINEL ADMINISTRATIVO</small><h1 tabindex="-1">${title}</h1></div>${adminTab==='estoque'?'':'<button type="button" id="proManualOrder">＋ Novo pedido</button>'}</section>${adminTab==='caixa'?cashMetrics():''}<section class="proContent" id="admContent" aria-live="polite"></section></main></div>`,true);
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
    $('#adminLogout').onclick=()=>{sessionStorage.removeItem('caseirao_admin_pin');if(orderWatcher)clearInterval(orderWatcher);admin=null;openAdmin()};
    $('#proRefresh').onclick=async()=>{const button=$('#proRefresh');try{button.disabled=true;button.textContent='Atualizando…';admin=await adminCall('snapshot');renderAdmin()}catch(error){button.disabled=false;button.textContent='↻ Tentar novamente';alert(error.message||String(error))}};
    const manualOrder=$('#proManualOrder');
    if(manualOrder)manualOrder.onclick=()=>openManualOrder();
    renderAdminTab();
  };
  new MutationObserver(enhanceHome).observe(document.body,{childList:true,subtree:true});enhanceHome();
})();
