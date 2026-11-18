'use strict';
(()=>{
 const C=window.CaseiraoStock,F=window.CaseiraoFinance,date=v=>new Date(v).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}),today=()=>F.day(new Date());
 const call=(action,payload)=>api('caseirao-stock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:sessionStorage.getItem('caseirao_admin_pin')||'',action,payload})});
 let state={products:[],movements:[]},filter='beverages',search='',start=today().slice(0,8)+'01',end=today(),token=0;
 const key=id=>'caseirao_stock_pending_'+id;
 const pending=id=>{try{return JSON.parse(localStorage.getItem(key(id))||'null');}catch{return null;}};
 async function send(p){localStorage.setItem(key(p.product_id),JSON.stringify(p));try{const r=await call('control',p);localStorage.removeItem(key(p.product_id));return r;}catch(e){if(e.httpStatus&&e.httpStatus<500)localStorage.removeItem(key(p.product_id));throw e;}}
 async function load(box){const current=++token;box.innerHTML='<div class="notice">Consultando produtos e movimentos de estoque…</div>';try{const r=await call('snapshot',{start,end});if(current!==token||!box.isConnected||adminTab!=='estoque')return;state=r;paint(box);}catch(e){if(current===token&&box.isConnected){box.innerHTML='<div class="err">'+esc(e.message)+'</div><button class="secondary" id="stockRetry">Tentar novamente</button>';box.querySelector('#stockRetry').onclick=()=>load(box);}}}
 const filters=[
  ['all','Todos os produtos'],
  ['beverages','Bebidas e itens contáveis'],
  ['tracked','Com controle'],
  ['low','Estoque baixo'],
  ['empty','Esgotados']
 ];
 const matches={
  all:()=>true,
  beverages:C.countable,
  tracked:p=>p.stock_enabled,
  low:p=>p.stock_enabled&&p.stock_quantity>0&&p.stock_quantity<=p.stock_minimum,
  empty:p=>p.stock_enabled&&p.stock_quantity<=0
 };
 const activeProducts=()=>state.products.filter(p=>p.active!==false);
 const number=value=>Number(value).toLocaleString('pt-BR');
 const movementButton=(p,action,label,className='secondary')=>
  `<button class="${className}" data-stock-action="${action}" data-stock-id="${esc(p.id)}">${label}</button>`;

 function productCard(p){
  const status=C.status(p),unresolved=pending(p.id);
  const balance=p.stock_enabled
   ?`<div class="stockBalance"><div><b>${number(p.stock_quantity)}</b> <span>unid. disponíveis</span></div><small>Alerta mínimo de ${number(p.stock_minimum)} unid.</small></div>`
   :'<p class="stockNoControl">Ative o controle para informar o saldo inicial e baixar unidades nas vendas.</p>';
  const actions=p.stock_enabled
   ?movementButton(p,'restock','＋ Repor','primary')+movementButton(p,'loss','Perda / retirada')+
    movementButton(p,'count','Ajustar contagem')+movementButton(p,'minimum','Alerta mínimo')+
    movementButton(p,'disable','Desativar controle','stockDisable')
   :movementButton(p,'enable','Ativar controle','primary');
  return `<article class="stockProduct">
   <div class="stockProductHeading"><div><small>${esc(p.category||'Produtos')}</small><h3>${esc(p.name)}</h3></div><span class="stockBadge ${status.tone}">${status.label}</span></div>
   ${balance}
   ${p.stock_enabled&&p.stock_manual_sold_out?'<p class="stockHint">A venda está pausada manualmente em Produtos.</p>':''}
   ${unresolved
     ?`<div class="stockPending">Existe um movimento aguardando resposta. <button class="secondary" data-stock-check="${esc(p.id)}">Conferir tentativa anterior</button></div>`
     :`<div class="stockActions">${actions}</div><div class="stockProductFooter"><button class="stockRemove" data-stock-remove="${esc(p.id)}">Remover produto</button></div>`}
  </article>`;
 }

 function paintProducts(box){
  const query=C.normalize(search.trim());
  const list=activeProducts().filter(p=>matches[filter](p)&&C.normalize(p.name+' '+p.category).includes(query));
  box.querySelector('#stockProductCount').textContent=list.length===1?'1 produto':number(list.length)+' produtos';
  const products=box.querySelector('.stockProducts');
  products.innerHTML=list.map(productCard).join('')||'<div class="stockEmpty">Nenhum produto encontrado. <button id="stockClear" class="secondary">Mostrar todos</button></div>';
  products.querySelector('#stockClear')?.addEventListener('click',()=>{
   search='';box.querySelector('#stockSearch').value='';setFilter(box,'all');
  });
  products.querySelectorAll('[data-stock-action]').forEach(b=>b.onclick=()=>openAction(b.dataset.stockId,b.dataset.stockAction));
  products.querySelectorAll('[data-stock-remove]').forEach(b=>b.onclick=()=>removeProduct(box,b));
  products.querySelectorAll('[data-stock-check]').forEach(b=>b.onclick=async()=>{
   const attempt=pending(b.dataset.stockCheck);
   if(!attempt){await load(box);return;}
   b.disabled=true;
   try{await send(attempt);}
   catch(e){alert(e.message||'Resposta não confirmada. Confira novamente a mesma tentativa.');}
   await load(box);
  });
 }

 function setFilter(box,value){
  filter=value;
  box.querySelector('#stockFilter').value=value;
  box.querySelectorAll('[data-stock-filter]').forEach(button=>
   button.setAttribute('aria-pressed',String(button.dataset.stockFilter===value)));
  paintProducts(box);
 }

 function paint(box){
  const totals=C.summary(activeProducts());
  const metrics=[
   ['tracked','Produtos com controle',totals.tracked,'blue'],
   ['','Unidades disponíveis',totals.units,'green'],
   ['low','Estoque baixo',totals.low,'amber'],
   ['empty','Esgotados',totals.empty,'red']
  ];
  const cards=metrics.map(([value,label,count,tone])=>{
   const content=`<span>${label}</span><strong>${number(count)}</strong>`;
   return value
    ?`<button type="button" class="stockMetric ${tone}" data-stock-filter="${value}" aria-pressed="${filter===value}">${content}</button>`
    :`<div class="stockMetric ${tone}">${content}</div>`;
  }).join('');
  box.innerHTML=`<div class="stockDashboard">
   <section class="stockHero" aria-labelledby="stockOverview"><div><h2 id="stockOverview">Visão do estoque</h2><p>Acompanhe o saldo por produto e veja o que precisa de reposição.</p></div><div class="stockHeroActions"><button class="primary" id="stockNew">＋ Cadastrar produto</button><button class="secondary" id="stockRefresh">Atualizar</button></div></section>
   <div class="stockMetrics">${cards}</div>
   <section class="stockPanel" aria-labelledby="stockProductTitle">
    <div class="stockSectionHeading"><h2 id="stockProductTitle">Produtos</h2><span id="stockProductCount" aria-live="polite"></span></div>
    <div class="stockFilters"><label>Buscar produto<input class="in" id="stockSearch" type="search" value="${esc(search)}" placeholder="Ex.: Coca, água, suco"></label><label>Exibir<select class="sel" id="stockFilter">${filters.map(([k,label])=>`<option value="${k}" ${filter===k?'selected':''}>${label}</option>`).join('')}</select></label></div>
    <div class="stockProducts"></div>
   </section>
   <section class="stockPanel stockHistory" aria-labelledby="stockHistoryTitle">
    <div class="stockSectionHeading"><h2 id="stockHistoryTitle">Histórico de movimentações</h2><span>${number(state.movements.length)} no período</span></div>
    <div class="stockFilters"><label>De<input type="date" class="in" id="stockStart" value="${start}"></label><label>Até<input type="date" class="in" id="stockEnd" value="${end}"></label><button class="secondary" id="stockLoadHistory">Consultar</button><button class="secondary" id="stockExport">Baixar CSV</button></div>
    <div class="stockTableScroll" tabindex="0" role="region" aria-label="Tabela de movimentações"><table><thead><tr><th>Data</th><th>Produto</th><th>Movimento</th><th>Unidades</th><th>Saldo após</th><th>Motivo</th></tr></thead><tbody>${state.movements.slice(-500).reverse().map(m=>`<tr><td>${esc(date(m.created_at))}</td><td>${esc(m.product_name)}</td><td>${esc(C.labels[m.kind]||m.kind)}</td><td>${m.quantity_delta>0?'+':''}${m.quantity_delta}</td><td>${m.balance_after}</td><td>${esc(m.note)}</td></tr>`).join('')||'<tr><td colspan="6">Nenhuma movimentação no período.</td></tr>'}</tbody></table></div>
    ${state.movements.length>500?'<p class="stockHint">Mostrando os últimos 500 movimentos. O CSV inclui todo o período consultado.</p>':''}
   </section>
  </div>`;
  box.querySelector('#stockRefresh').onclick=()=>load(box);
  box.querySelector('#stockNew').onclick=()=>editProduct(null,{
   category:filter==='beverages'?'Bebidas':'',
   onBack:back,
   onSaved:product=>{
    filter='all';search=product.name;showAppToast('Produto cadastrado.','ok');back();
   }
  });
  box.querySelector('#stockSearch').oninput=e=>{search=e.target.value;paintProducts(box);};
  box.querySelector('#stockFilter').onchange=e=>setFilter(box,e.target.value);
  box.querySelectorAll('[data-stock-filter]').forEach(button=>
   button.onclick=()=>setFilter(box,button.getAttribute('aria-pressed')==='true'?'all':button.dataset.stockFilter));
  box.querySelector('#stockLoadHistory').onclick=()=>{
   const from=box.querySelector('#stockStart').value,to=box.querySelector('#stockEnd').value;
   if(!from||!to||from>to){alert('Confira as datas do período.');return;}
   if((Date.parse(to)-Date.parse(from))/86400000>365){alert('Selecione um período de até 366 dias.');return;}
   start=from;end=to;load(box);
  };
  box.querySelector('#stockExport').onclick=()=>{
   if(box.querySelector('#stockStart').value!==start||box.querySelector('#stockEnd').value!==end){
    alert('Toque em Consultar para carregar o período antes de baixar o CSV.');return;
   }
   exportCsv();
  };
  paintProducts(box);
 }

 async function removeProduct(box,button){
  const product=state.products.find(p=>p.id===button.dataset.stockRemove);
  if(!product||button.disabled||pending(product.id))return;
  if(!confirm('Remover '+product.name+' do estoque e do cardápio? O histórico será preservado. Você pode reativar o produto na aba Produtos.'))return;
  button.disabled=true;
  try{
   const {id,name,category,description,price,promo_price,image_url,featured}=product;
   await adminCall('upsert_product',{id,name,category,description,price,promo_price,image_url,featured,active:false});
   const cached=admin.products.find(p=>p.id===id);
   if(cached)cached.active=false;
   showAppToast('Produto removido.','ok');
   if(box.isConnected&&adminTab==='estoque')await load(box);
  }catch(e){alert(e.message||'Não foi possível confirmar a remoção. Atualize o estoque e confira o produto.');}
  finally{button.disabled=false;}
 }
 const back=()=>{adminTab='estoque';renderAdmin();};
 function openAction(id,operation){
  const p=state.products.find(p=>p.id===id);if(!p||pending(id))return;
  const note={enable:'Contagem inicial',disable:'Controle de unidades desativado',restock:'Reposição de mercadoria',loss:'',count:'Conferência da contagem',minimum:'Ajuste do alerta de estoque mínimo'}[operation];
  modal(`<div class="sheeth"><div><h2>${esc(C.labels[operation])}</h2><div class="adminSub">${esc(p.name)}</div></div><button class="x" id="stockBack">←</button></div><div id="stockFormError" aria-live="polite"></div><div class="stockFormBalance">Saldo disponível atual: <b>${p.stock_quantity} unidade(s)</b></div>${['enable','restock','loss','count'].includes(operation)?`<div class="field"><label>${operation==='restock'?'Quantidade que entrou':operation==='loss'?'Quantidade que saiu sem pedido':'Quantidade disponível contada (sem as unidades já reservadas)'}</label><input class="in" id="stockQuantity" type="number" min="${['restock','loss'].includes(operation)?1:0}" step="1" placeholder="Ex.: 24" ${operation==='count'?'value="'+p.stock_quantity+'"':''}></div>`:''}${['enable','minimum'].includes(operation)?`<div class="field"><label>Avisar estoque baixo a partir de</label><input class="in" id="stockMinimum" type="number" min="0" step="1" value="${p.stock_minimum}"></div>`:''}${operation==='disable'?'<div class="stockNotice">Ao desativar, os próximos pedidos deixam de baixar unidades. Quando reativar, faça uma nova contagem disponível.</div>':''}<div class="field"><label>Motivo / observação</label><input class="in" id="stockNote" maxlength="400" value="${esc(note)}" placeholder="Ex.: 2 latas danificadas"></div><button class="primary" id="stockSave">Confirmar movimento</button>`,true);
  $('#stockBack').onclick=back;$('#stockSave').onclick=async()=>{const quantity=$('#stockQuantity')?C.unit($('#stockQuantity').value):null,minimum=$('#stockMinimum')?C.unit($('#stockMinimum').value):null,note=$('#stockNote').value.trim();if(note.length<3||(['enable','restock','loss','count'].includes(operation)&&quantity===null)||(['restock','loss'].includes(operation)&&quantity===0)||(['enable','minimum'].includes(operation)&&minimum===null)){alert('Confira as quantidades inteiras e informe o motivo.');return;}if(!confirm('Confirmar '+C.labels[operation].toLowerCase()+' de '+p.name+'?'))return;const button=$('#stockSave');button.disabled=true;const payload={product_id:id,operation,quantity,minimum,expected_revision:p.stock_revision,note,request_id:crypto.randomUUID()};try{await send(payload);showAppToast('Estoque atualizado.','ok');back();}catch(e){$('#stockFormError').innerHTML='<div class="err">'+esc(e.httpStatus&&e.httpStatus<500?e.message:'Resposta não confirmada. Volte e confira a tentativa anterior para não duplicar.')+'</div>';button.disabled=!!pending(id);}};
 }
 function exportCsv(){const rows=[['Gerado em',date(state.generated_at)],['Período',start+' a '+end],[],['Produto','Categoria','Controle ativo','Saldo disponível','Estoque mínimo','Estado'],...activeProducts().map(p=>[p.name,p.category,p.stock_enabled?'Sim':'Não',p.stock_quantity,p.stock_minimum,C.status(p).label]),[],['Data','Produto','Tipo','Variação unidades','Saldo após','Motivo','Responsável','Origem','Origem ID'],...state.movements.map(m=>[date(m.created_at),m.product_name,C.labels[m.kind]||m.kind,m.quantity_delta,m.balance_after,m.note,m.actor,m.source_kind,m.source_id])];const url=URL.createObjectURL(new Blob([F.csv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='caseirao-estoque-'+start+'-a-'+end+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
 const originalTab=renderAdminTab;renderAdminTab=function(){if(adminTab!=='estoque')return originalTab();const box=$('#admContent');if(box)load(box);};
})();
