'use strict';
/* ===== IMPRESSAO BLUETOOTH AUTOMATICA • 80 MM ===== */
const PRINTER_PREF_KEY='caseirao_printer_prefs_v1';
function printerPrefs(){try{return {...{auto:false},...JSON.parse(localStorage.getItem(PRINTER_PREF_KEY)||'{}'),paper:'80'}}catch{return {paper:'80',auto:false}}}
function savePrinterPrefs(next){const value={...printerPrefs(),...next};localStorage.setItem(PRINTER_PREF_KEY,JSON.stringify(value));return value}
function printerPaperWidth(){return 80}
function printerTextWidth(){return 48}
function printerConnected(){return !!(btWriteChar&&btDevice?.gatt?.connected)}
function printerStatusText(){return printerConnected()?`🟢 CONECTADA • ${btPrinterName||'Impressora Bluetooth'}`:'🔴 DESCONECTADA'}
function refreshPrinterStatus(){const el=$('#printerState');if(!el)return;el.textContent=printerStatusText();el.className='printerState '+(printerConnected()?'connected':'error')}

const receiptPlainPaperBase=receiptPlain;
receiptPlain=function(o){
  const width=printerTextWidth(),hr='-'.repeat(width),L=[];
  const wr=t=>wrapReceipt(t,width);
  L.push('O CASEIRAO BURGER',`PEDIDO #${o.order_number}`,new Date(o.created_at).toLocaleString('pt-BR'),hr,`CLIENTE: ${o.customer_name||''}`,`FONE: ${o.customer_phone||''}`,`TIPO: ${orderTypeLabel(o.type)}`);
  if(o.type==='delivery'){L.push(hr,'ENDERECO:',...wr(orderAddress(o)))}
  L.push(hr,`PAGAMENTO: ${paymentLabel(o.payment)}`);if(o.change_for)L.push(`TROCO PARA: ${o.change_for}`);L.push(hr,'ITENS:');
  (o.order_items||[]).forEach(it=>{L.push(...wr(`${it.quantity||1}x ${it.product_name||'Item'}  ${fmt(it.line_total||0)}`));(it.order_item_addons||[]).forEach(a=>L.push(...wr(`  + ${a.addon_name}${Number(a.price||0)>0?' '+fmt(a.price):''}`)));if(it.note)L.push(...wr(`  OBS: ${it.note}`))});
  if(o.notes)L.push(hr,'OBSERVACOES:',...wr(o.notes));L.push(hr,`SUBTOTAL: ${fmt(o.subtotal)}`);if(Number(o.delivery_fee||0))L.push(`ENTREGA: ${fmt(o.delivery_fee)}`);if(Number(o.delivery_discount||0))L.push(`DESC. ENTREGA: -${fmt(o.delivery_discount)}`);if(Number(o.discount||0))L.push(`DESCONTO: -${fmt(o.discount)}`);if(Number(o.cashback_used||0))L.push(`CASHBACK: -${fmt(o.cashback_used)}`);L.push(`TOTAL: ${fmt(o.total)}`,hr,`CODIGO: ${o.tracking_code||''}`,'','','');return stripAccents(L.join('\n'));
};
const receiptBrowserPaperBase=receiptBrowserHtml;
receiptBrowserHtml=function(o){return receiptBrowserPaperBase(o)
  .replace('@page{size:58mm auto;margin:2mm}','@page{size:80mm auto;margin:1.5mm}')
  .replace('width:54mm','width:77mm')
  .replace('font-size:10.5px','font-size:13.5px')
  .replace('line-height:1.3','line-height:1.38')
  .replace('.title{font-size:16px', '.title{font-size:23px')
  .replace('.sub,.obs{padding-left:7px;font-size:9px}', '.sub,.obs{padding-left:9px;font-size:12px}')
  .replace('.big{font-size:14px', '.big{font-size:20px')
  .replace('<div class="title">O CASEIRÃO BURGER</div>','<div class="title">O CASEIRÃO BURGER</div><b>DESDE 2022</b><div>CAMPO MAIOR – PI</div>')};

const connectBluetoothPrinterStatusBase=connectBluetoothPrinter;
connectBluetoothPrinter=async function(){try{const name=await connectBluetoothPrinterStatusBase();refreshPrinterStatus();return name}catch(e){refreshPrinterStatus();throw e}};

async function printOrderBluetoothAuto(id,sourceOrders=null,silent=false){
  const o=(sourceOrders||admin?.orders||[]).find(x=>String(x.id)===String(id));if(!o)return false;
  if(!printerConnected()){refreshPrinterStatus();if(!silent)alert('Impressora Bluetooth desconectada. Toque em CONECTAR BLUETOOTH primeiro.');return false}
  try{setPrinterState(`Imprimindo pedido #${o.order_number}...`,'connected');await btWrite(await escposBytes(o));setPrinterState(`🟢 CONECTADA • Pedido #${o.order_number} impresso`,'connected');return true}catch(e){btWriteChar=null;refreshPrinterStatus();if(!silent)alert(e.message||String(e));return false}
}
printOrderBluetooth=async function(id,sourceOrders=null){return printOrderBluetoothAuto(id,sourceOrders,false)};

const renderOrdersPrinterBase=renderOrders;
renderOrders=function(box){
  const result=renderOrdersPrinterBase(box),bar=box.querySelector('.printerBar');
  if(bar){const prefs=printerPrefs();bar.innerHTML=`<div class="printerBarTop"><div class="grow"><b>🖨️ Impressora Bluetooth</b><div id="printerState" class="printerState"></div></div><button id="connectPrinter" class="printerConnect">CONECTAR BLUETOOTH</button></div><div class="printerConfigGrid"><label><span>Largura do papel</span><select id="printerPaper" class="sel" disabled><option value="80" selected>80 mm</option></select></label><label class="printerAutoToggle"><input id="printerAuto" type="checkbox" ${prefs.auto?'checked':''}><span><b>Impressão automática</b><small>Imprime pedido novo quando o Bluetooth já estiver conectado.</small></span></label><button id="printerTest" class="secondary">IMPRIMIR TESTE</button></div>`;
    $('#connectPrinter').onclick=async()=>{try{await connectBluetoothPrinter()}catch(e){refreshPrinterStatus();alert(e.message||String(e))}};
    $('#printerPaper').onchange=e=>{savePrinterPrefs({paper:e.target.value});showAppToast(`Impressora configurada para ${e.target.value} mm.`,'ok')};
    $('#printerAuto').onchange=e=>{savePrinterPrefs({auto:e.target.checked});showAppToast(e.target.checked?'Impressão automática ativada.':'Impressão automática desativada.','ok')};
    $('#printerTest').onclick=async()=>{if(!printerConnected())return alert('Conecte a impressora Bluetooth primeiro.');const width=printerTextWidth(),text=stripAccents(`O CASEIRAO BURGER\nTESTE DE IMPRESSAO\nPAPEL: ${printerPaperWidth()} mm\n${'-'.repeat(width)}\nBluetooth conectado OK\n\n\n`);try{await btWrite(new TextEncoder().encode(text));setPrinterState('🟢 CONECTADA • Teste enviado','connected')}catch(e){alert(e.message||String(e));refreshPrinterStatus()}};
    refreshPrinterStatus();
  }
  bindPrintButtons();return result;
};

const checkNewOrdersAutoPrintBase=checkNewOrders;
/* Motor antigo desativado: a impressão automática é controlada pelo motor seguro abaixo. */
checkNewOrders=async function(){return await checkNewOrdersAutoPrintBase();};

const printerExtraStyle=document.createElement('style');printerExtraStyle.textContent=`.printerState.connected{color:#16833d!important;font-weight:900}.printerState.error{color:#c43131!important;font-weight:900}.printerConfigGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:10px;align-items:stretch}.printerConfigGrid>label,.printerConfigGrid>button{border:1px solid #dfe3e7;border-radius:12px;padding:10px;background:#fff}.printerConfigGrid label>span:first-child{display:block;font-size:11px;font-weight:900;margin-bottom:6px}.printerAutoToggle{display:flex!important;align-items:center;gap:9px}.printerAutoToggle input{width:20px;height:20px}.printerAutoToggle span{display:flex!important;flex-direction:column}.printerAutoToggle small{font-size:10px;color:#6f7782;margin-top:2px}@media(max-width:700px){.printerConfigGrid{grid-template-columns:1fr}}`;document.head.appendChild(printerExtraStyle);


/* ===== PROTECAO CONTRA PEDIDO / IMPRESSAO DUPLICADOS ===== */
let caseiraoOrderSubmitLocked=false;
const sendOrderDuplicateSafeBase=sendOrder;
sendOrder=async function(){
  const btn=$('#sendOrder');
  if(caseiraoOrderSubmitLocked){
    if(btn){btn.disabled=true;btn.textContent='PEDIDO JÁ ESTÁ SENDO ENVIADO...'}
    return;
  }
  caseiraoOrderSubmitLocked=true;
  if(btn){btn.disabled=true;btn.dataset.submitLocked='1'}
  try{
    return await sendOrderDuplicateSafeBase();
  }finally{
    /* Se a tela de checkout ainda estiver aberta, a tentativa falhou e pode ser refeita.
       Se o pedido foi aceito, o botão original já não existe e o bloqueio é liberado
       somente para um novo checkout. */
    caseiraoOrderSubmitLocked=false;
    const current=$('#sendOrder');
    if(current){current.dataset.submitLocked='0';if(!current.disabled)current.textContent='CONFIRMAR E ENVIAR'}
  }
};

function caseiraoOrderHasItems(o){return Array.isArray(o?.order_items)&&o.order_items.length>0}
async function caseiraoRefreshUntilItems(orderId,attempts=4,delayMs=550){
  let latest=admin;
  for(let i=0;i<attempts;i++){
    const found=(latest?.orders||[]).find(x=>String(x.id)===String(orderId));
    if(caseiraoOrderHasItems(found))return found;
    if(i<attempts-1)await new Promise(r=>setTimeout(r,delayMs));
    try{latest=await adminCall('snapshot');admin=latest}catch{}
  }
  return (admin?.orders||[]).find(x=>String(x.id)===String(orderId))||null;
}
function eligibleForAutoPrint(o){
  if(!o||o.source==='manual'||['cancelado','entregue'].includes(String(o.status||'')))return false;
  const pay=String(o.payment||'').toLowerCase();
  if(pay==='pix')return String(o.payment_status||'').toLowerCase()==='confirmed';
  return true;
}
const checkNewOrdersPrintDedupeBase=checkNewOrders;
checkNewOrders=async function(){
  const before=new Set((admin?.orders||[]).map(o=>String(o.id)));
  await checkNewOrdersPrintDedupeBase();
  if(!printerPrefs().auto)return;
  const candidates=(admin?.orders||[]).filter(o=>!before.has(String(o.id))&&eligibleForAutoPrint(o)&&!wasAutoPrinted(o.id));
  for(const o of candidates)queueAutoPrint(o.id);
  if(printerConnected())await flushPendingAutoPrint();
  else if(candidates.length){refreshPrinterStatus();showAppToast('Pedido recebido. Ficou aguardando a impressora Bluetooth conectar.','warn')}
};


/* ===== PAINEL BLUETOOTH RESILIENTE • OPERACAO =====
   Mantem os controles visiveis mesmo quando a interface profissional
   substitui/reorganiza o renderizador original de pedidos. */
function caseiraoPrinterPanelHtml(){
  const prefs=printerPrefs();
  return `<section id="caseiraoPrinterPanel" class="printerBar caseiraoPrinterPanel">
    <div class="printerBarTop">
      <div class="grow"><b>🖨️ Impressora</b><div id="printerState" class="printerState"></div></div>
      <button type="button" id="printerConfigToggle" class="secondary printerConfigToggle">CONFIGURAR</button>
      <button type="button" id="connectPrinter" class="printerConnect">CONECTAR</button>
    </div>
    <div class="printerConfigGrid printerConfigCollapsed">
      <label><span>Largura do papel</span><select id="printerPaper" class="sel" disabled><option value="80" selected>80 mm</option></select></label>
      <label class="printerAutoToggle"><input id="printerAuto" type="checkbox" ${prefs.auto?'checked':''}><span><b>Impressão automática</b><small>Pedido novo imprime sozinho após conectar.</small></span></label>
      <button type="button" id="printerTest" class="secondary">IMPRIMIR TESTE</button>
      <div class="printerPending" data-print-pending>Nenhum pedido aguardando impressão</div>
    </div>
  </section>`;
}
function bindCaseiraoPrinterPanel(){
  const panel=document.querySelector('#caseiraoPrinterPanel');if(!panel)return;
  const connect=panel.querySelector('#connectPrinter'),paper=panel.querySelector('#printerPaper'),auto=panel.querySelector('#printerAuto'),test=panel.querySelector('#printerTest');
  const toggle=panel.querySelector('#printerConfigToggle'),grid=panel.querySelector('.printerConfigGrid');
  if(toggle&&!toggle.dataset.bound){toggle.dataset.bound='1';toggle.onclick=()=>{const open=grid?.classList.toggle('printerConfigOpen');toggle.textContent=open?'FECHAR':'CONFIGURAR'}}
  if(connect&&!connect.dataset.bound){connect.dataset.bound='1';connect.onclick=async()=>{try{await connectBluetoothPrinter();refreshPrinterStatus();await flushPendingAutoPrint()}catch(e){refreshPrinterStatus();const msg=String(e?.message||e||'');if(/cancelled|canceled|chooser/i.test(msg))showAppToast('Seleção Bluetooth cancelada. Toque em CONECTAR quando quiser tentar novamente.','warn');else alert(msg)}}}
  if(paper&&!paper.dataset.bound){paper.dataset.bound='1';paper.onchange=e=>{savePrinterPrefs({paper:e.target.value});showAppToast(`Impressora configurada para ${e.target.value} mm.`,'ok')}}
  if(auto&&!auto.dataset.bound){auto.dataset.bound='1';auto.onchange=async e=>{savePrinterPrefs({auto:e.target.checked});showAppToast(e.target.checked?'Impressão automática ativada.':'Impressão automática desativada.','ok');if(e.target.checked)await flushPendingAutoPrint();refreshPendingPrintStatus()}}
  if(test&&!test.dataset.bound){test.dataset.bound='1';test.onclick=async()=>{if(!printerConnected())return alert('Conecte a impressora pelo botão CONECTAR BLUETOOTH primeiro.');const width=printerTextWidth(),text=stripAccents(`O CASEIRAO BURGER\nTESTE DE IMPRESSAO\nPAPEL: ${printerPaperWidth()} mm\n${'-'.repeat(width)}\nBluetooth conectado OK\n\n\n`);try{await btWrite(new TextEncoder().encode(text));setPrinterState('🟢 CONECTADA • Teste enviado','connected')}catch(e){refreshPrinterStatus();alert(e.message||String(e))}}}
  refreshPrinterStatus();refreshPendingPrintStatus();
}
function ensureCaseiraoPrinterPanel(){
  const box=document.querySelector('#admContent');if(!box||adminTab!=='pedidos')return;
  let panel=box.querySelector('#caseiraoPrinterPanel');
  if(!panel){
    const old=box.querySelector('.printerBar');
    if(old){old.outerHTML=caseiraoPrinterPanelHtml()}
    else{
      const anchor=box.querySelector('input[placeholder*="Buscar pedido"],input[placeholder*="Buscar"],#manualOrder,[id*="manualOrder"]');
      const host=anchor?.closest('.searchBox,.orderSearch,.manualOrderBox')||anchor?.parentElement;
      if(host)host.insertAdjacentHTML('beforebegin',caseiraoPrinterPanelHtml());else box.insertAdjacentHTML('afterbegin',caseiraoPrinterPanelHtml());
    }
  }
  bindCaseiraoPrinterPanel();
}
/* CORRECAO LOGIN/TRAVAMENTO: observador global removido.
   O painel Bluetooth e montado somente pelo renderOrders final. */

/* Nunca abre o seletor de dispositivo por uma impressao. O seletor Bluetooth
   aparece somente quando o operador toca em CONECTAR BLUETOOTH. */
btWrite=async function(bytes){
  if(!btWriteChar||!btDevice?.gatt?.connected)throw new Error('Impressora Bluetooth desconectada. Toque em CONECTAR BLUETOOTH primeiro.');
  const chunk=20;
  for(let i=0;i<bytes.length;i+=chunk){const part=bytes.slice(i,i+chunk);if(btWriteChar.properties.writeWithoutResponse&&btWriteChar.writeValueWithoutResponse)await btWriteChar.writeValueWithoutResponse(part);else if(btWriteChar.properties.write&&btWriteChar.writeValueWithResponse)await btWriteChar.writeValueWithResponse(part);else await btWriteChar.writeValue(part);await new Promise(r=>setTimeout(r,10))}
};

const printerPanelStyle=document.createElement('style');printerPanelStyle.textContent=`#caseiraoPrinterPanel{display:block!important;margin:0 0 8px!important;padding:8px 10px!important;border:1px solid #cfdfeb!important;border-radius:14px!important;background:#eef6fb!important}#caseiraoPrinterPanel .printerBarTop{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto!important;gap:6px!important;align-items:center!important}#caseiraoPrinterPanel .printerConnect,#caseiraoPrinterPanel .printerConfigToggle{min-height:34px!important;height:34px!important;width:auto!important;padding:5px 9px!important;margin:0!important;font-size:9px!important}#caseiraoPrinterPanel .printerConfigGrid{display:none!important;grid-template-columns:1fr 1.35fr 1fr!important;gap:9px!important;margin-top:8px!important}#caseiraoPrinterPanel .printerConfigGrid.printerConfigOpen{display:grid!important}#caseiraoPrinterPanel .printerAutoToggle{align-items:center!important;gap:10px!important}#caseiraoPrinterPanel .printerAutoToggle input{display:block!important;appearance:auto!important;width:22px!important;height:22px!important;opacity:1!important;position:static!important}@media(max-width:700px){#caseiraoPrinterPanel .printerBarTop{grid-template-columns:minmax(0,1fr) auto auto!important;align-items:center!important}#caseiraoPrinterPanel .printerConfigGrid.printerConfigOpen{grid-template-columns:1fr!important}}`;document.head.appendChild(printerPanelStyle);
const printerPendingStyle=document.createElement('style');printerPendingStyle.textContent=`#caseiraoPrinterPanel .printerPending{grid-column:1/-1;padding:8px 10px;border-radius:10px;background:#f7f9fb;color:#6d7580;font-size:10px;font-weight:800;text-align:center}#caseiraoPrinterPanel .printerPending.hasPending{background:#fff3d6;color:#8b5a00}`;document.head.appendChild(printerPendingStyle);


/* ===== CORRECAO FINAL • PAINEL BLUETOOTH FIXO NA OPERACAO =====
   Monta o painel diretamente no render final da Operacao. Nao depende de
   MutationObserver nem da printerBar antiga, evitando que o layout profissional
   esconda os controles. */
const renderOrdersBluetoothPanelFinalBase=renderOrders;
renderOrders=function(box){
  const result=renderOrdersBluetoothPanelFinalBase(box);
  if(box){
    box.querySelector('#caseiraoPrinterPanel')?.remove();
    box.insertAdjacentHTML('afterbegin',caseiraoPrinterPanelHtml());
    bindCaseiraoPrinterPanel();
  }
  return result;
};


/* ===== CASEIRAO PRINTER ENGINE V3 • 2026-09-23 =====
   Modulo final/autoritativo de impressao Bluetooth.
   Objetivos: conexao unica, escrita conservadora, fila limpa e sem pedidos fantasmas. */
const CASEIRAO_PRINT_V3_PENDING='caseirao_print_pending_v3';
const CASEIRAO_PRINT_V3_DONE='caseirao_print_done_v3';
try{localStorage.removeItem('caseirao_auto_print_pending_v2')}catch(e){}
let caseiraoPrintV3Busy=false;
let caseiraoPrintV3ConnectPromise=null;
let caseiraoPrintV3WritePromise=Promise.resolve();
let caseiraoPrintV3Generation=0;

function caseiraoPrintV3Set(key,set,limit){try{localStorage.setItem(key,JSON.stringify([...set].slice(-limit)))}catch(e){}}
function caseiraoPrintV3Get(key){try{return new Set(JSON.parse(localStorage.getItem(key)||'[]').map(String))}catch(e){return new Set()}}
function pendingAutoPrintIds(){return caseiraoPrintV3Get(CASEIRAO_PRINT_V3_PENDING)}
function savePendingAutoPrint(set){caseiraoPrintV3Set(CASEIRAO_PRINT_V3_PENDING,set,100)}
function autoPrintedOrders(){return caseiraoPrintV3Get(CASEIRAO_PRINT_V3_DONE)}
function saveAutoPrinted(set){caseiraoPrintV3Set(CASEIRAO_PRINT_V3_DONE,set,500)}
function markAutoPrinted(id){const s=autoPrintedOrders();s.add(String(id));saveAutoPrinted(s)}
function wasAutoPrinted(id){return autoPrintedOrders().has(String(id))}
function queueAutoPrint(id){const s=pendingAutoPrintIds();s.add(String(id));savePendingAutoPrint(s);refreshPendingPrintStatus()}
function unqueueAutoPrint(id){const s=pendingAutoPrintIds();s.delete(String(id));savePendingAutoPrint(s);refreshPendingPrintStatus()}
function caseiraoPrintV3CleanQueue(){
  const orders=admin?.orders||[],byId=new Map(orders.map(o=>[String(o.id),o])),pending=pendingAutoPrintIds();
  let changed=false;
  for(const id of [...pending]){
    const o=byId.get(String(id));
    if(!o||!eligibleForAutoPrint(o)||wasAutoPrinted(id)){pending.delete(String(id));changed=true}
  }
  if(changed)savePendingAutoPrint(pending);
  refreshPendingPrintStatus();
  return pending;
}
function refreshPendingPrintStatus(){
  const n=caseiraoPrintV3CleanQueue.__running?pendingAutoPrintIds().size:(()=>{caseiraoPrintV3CleanQueue.__running=true;try{return caseiraoPrintV3CleanQueue().size}finally{caseiraoPrintV3CleanQueue.__running=false}})();
  document.querySelectorAll('[data-print-pending]').forEach(el=>{el.textContent=n?`${n} pedido${n===1?'':'s'} aguardando impressão`:'Nenhum pedido aguardando impressão';el.classList.toggle('hasPending',n>0)});
}

async function caseiraoPrintV3FindChannel(server){
  const preferred=[];
  for(const p of BT_PROFILES){
    try{
      const service=await server.getPrimaryService(p.service);
      for(const cid of p.chars){try{const c=await service.getCharacteristic(cid);if(c.properties.write||c.properties.writeWithoutResponse)preferred.push(c)}catch(e){}}
      try{for(const c of await service.getCharacteristics())if((c.properties.write||c.properties.writeWithoutResponse)&&!preferred.includes(c))preferred.push(c)}catch(e){}
    }catch(e){}
  }
  if(!preferred.length){
    try{for(const service of await server.getPrimaryServices()){try{for(const c of await service.getCharacteristics())if(c.properties.write||c.properties.writeWithoutResponse)preferred.push(c)}catch(e){}}}catch(e){}
  }
  return preferred.find(c=>c.properties.write&&typeof c.writeValueWithResponse==='function')||preferred.find(c=>c.properties.writeWithoutResponse&&typeof c.writeValueWithoutResponse==='function')||preferred[0]||null;
}
async function caseiraoPrintV3Attach(device){
  if(!device?.gatt)throw new Error('O dispositivo escolhido não oferece BLE/GATT para impressão.');
  const generation=++caseiraoPrintV3Generation;
  const server=device.gatt.connected?device.gatt:await device.gatt.connect();
  const channel=await caseiraoPrintV3FindChannel(server);
  if(!channel)throw new Error('Conectou ao Bluetooth, mas não encontrei um canal de escrita compatível.');
  btDevice=device;btWriteChar=channel;btPrinterName=device.name||'Impressora Bluetooth';
  if(!device.__caseiraoV3Bound){device.__caseiraoV3Bound=true;device.addEventListener('gattserverdisconnected',()=>{if(generation<=caseiraoPrintV3Generation){btWriteChar=null;setPrinterState('🔴 DESCONECTADA','error');try{refreshPrinterStatus()}catch(e){}}})}
  setPrinterState(`🟢 CONECTADA • ${btPrinterName}`,'connected');try{refreshPrinterStatus()}catch(e){}
  return btPrinterName;
}
connectBluetoothPrinter=async function(){
  if(caseiraoPrintV3ConnectPromise)return caseiraoPrintV3ConnectPromise;
  caseiraoPrintV3ConnectPromise=(async()=>{
    if(!navigator.bluetooth)throw new Error('Abra a Central no Chrome do Android para usar Bluetooth.');
    if(btDevice){try{return await caseiraoPrintV3Attach(btDevice)}catch(e){btWriteChar=null}}
    setPrinterState('Selecione a impressora...');
    const device=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:BT_PROFILES.map(p=>p.service)});
    const connected=await caseiraoPrintV3Attach(device);
    if(printerPrefs().auto)setTimeout(()=>flushPendingAutoPrint().catch(()=>{}),150);
    return connected;
  })();
  try{return await caseiraoPrintV3ConnectPromise}finally{caseiraoPrintV3ConnectPromise=null}
};
async function caseiraoPrintV3Ensure(){if(printerConnected())return btWriteChar;if(!btDevice)throw new Error('Conecte a impressora primeiro.');await caseiraoPrintV3Attach(btDevice);return btWriteChar}
function caseiraoPrintV3Sleep(ms){return new Promise(r=>setTimeout(r,ms))}
btWrite=function(bytes){
  const run=async()=>{
    let c=await caseiraoPrintV3Ensure();
    const CHUNK=20,PAUSE=70;
    for(let i=0;i<bytes.length;i+=CHUNK){
      if(!btDevice?.gatt?.connected){await caseiraoPrintV3Attach(btDevice);c=btWriteChar}
      const part=bytes.slice(i,i+CHUNK);
      if(c.properties.write&&typeof c.writeValueWithResponse==='function')await c.writeValueWithResponse(part);
      else if(c.properties.writeWithoutResponse&&typeof c.writeValueWithoutResponse==='function')await c.writeValueWithoutResponse(part);
      else await c.writeValue(part);
      await caseiraoPrintV3Sleep(PAUSE);
    }
    await caseiraoPrintV3Sleep(250);return true;
  };
  caseiraoPrintV3WritePromise=caseiraoPrintV3WritePromise.catch(()=>{}).then(run);
  return caseiraoPrintV3WritePromise;
};
escposBytes=async function(o){
  const width=48,hr='-'.repeat(width),enc=t=>new TextEncoder().encode(stripAccents(String(t)));
  const txt=(...lines)=>enc(lines.join('\n')+'\n');
  const center=new Uint8Array([0x1b,0x61,0x01]),left=new Uint8Array([0x1b,0x61,0x00]);
  const normal=new Uint8Array([0x1d,0x21,0x00]),tall=new Uint8Array([0x1d,0x21,0x01]),doubleSize=new Uint8Array([0x1d,0x21,0x11]);
  const boldOn=new Uint8Array([0x1b,0x45,0x01]),boldOff=new Uint8Array([0x1b,0x45,0x00]);
  const wrap=t=>wrapReceipt(stripAccents(String(t||'')),width);
  const pair=(label,value)=>{label=stripAccents(String(label));value=stripAccents(String(value));const room=width-label.length-value.length;return room>0?label+' '.repeat(room)+value:label+' '+value};
  const body=[];
  body.push(hr,`CLIENTE: ${o.customer_name||''}`,`FONE: ${o.customer_phone||''}`,`TIPO: ${orderTypeLabel(o.type)}`);
  if(o.type==='delivery')body.push(hr,'ENDERECO:',...wrap(orderAddress(o)));
  body.push(hr,`PAGAMENTO: ${paymentLabel(o.payment)}`);if(o.change_for)body.push(`TROCO PARA: ${o.change_for}`);
  body.push(hr,'ITENS:');
  for(const it of (o.order_items||[])){
    const itemName=`${it.quantity||1}x ${it.product_name||'Item'}`,price=fmt(it.line_total||0);
    if(itemName.length+price.length+1<=width)body.push(pair(itemName,price));else body.push(...wrap(itemName),pair('',price));
    for(const a of (it.order_item_addons||[]))body.push(...wrap(`  + ${a.addon_name}${Number(a.price||0)>0?' '+fmt(a.price):''}`));
    if(it.note)body.push(...wrap(`  OBS: ${it.note}`));
  }
  if(o.notes)body.push(hr,'OBSERVACOES:',...wrap(o.notes));
  const totals=[hr,pair('SUBTOTAL',fmt(o.subtotal))];
  if(Number(o.delivery_fee||0))totals.push(pair('ENTREGA',fmt(o.delivery_fee)));
  if(Number(o.delivery_discount||0))totals.push(pair('DESC. ENTREGA',`-${fmt(o.delivery_discount)}`));
  if(Number(o.discount||0))totals.push(pair('DESCONTO',`-${fmt(o.discount)}`));
  if(Number(o.cashback_used||0))totals.push(pair('CASHBACK',`-${fmt(o.cashback_used)}`));
  return joinReceiptBytes(
    new Uint8Array([0x1b,0x40]),center,boldOn,doubleSize,txt('O CASEIRAO BURGER'),
    normal,txt('DESDE 2022','CAMPO MAIOR - PI',''),doubleSize,txt(`PEDIDO #${o.order_number}`),
    normal,boldOff,txt(new Date(o.created_at).toLocaleString('pt-BR')),left,tall,txt(...body),
    normal,boldOn,txt(...totals),center,doubleSize,txt(`TOTAL ${fmt(o.total)}`),
    normal,boldOff,left,txt(hr,'','','')
  );
};
printOrderBluetoothAuto=async function(id,sourceOrders=null,silent=false){
  let o=(sourceOrders||admin?.orders||[]).find(x=>String(x.id)===String(id));
  if(!o||['cancelado','entregue'].includes(String(o.status||''))){unqueueAutoPrint(id);return false}
  if(!caseiraoOrderHasItems(o))o=await caseiraoRefreshUntilItems(id,4,600);
  if(!caseiraoOrderHasItems(o)){queueAutoPrint(id);setPrinterState('Pedido recebido; aguardando os itens sincronizarem.','error');return false}
  try{if(!printerConnected())await caseiraoPrintV3Ensure();setPrinterState(`Imprimindo pedido #${o.order_number}...`,'connected');await btWrite(await escposBytes(o));markAutoPrinted(id);unqueueAutoPrint(id);setPrinterState(`🟢 CONECTADA • Pedido #${o.order_number} impresso`,'connected');return true}catch(e){setPrinterState(`Erro ao imprimir: ${e.message||e}`,'error');if(!silent)alert(e.message||String(e));return false}
};
printOrderBluetooth=async function(id,sourceOrders=null){return printOrderBluetoothAuto(id,sourceOrders,false)};
async function flushPendingAutoPrint(){
  if(caseiraoPrintV3Busy||!printerPrefs().auto)return;
  const pending=caseiraoPrintV3CleanQueue();if(!pending.size||!printerConnected())return;
  caseiraoPrintV3Busy=true;
  try{for(const id of [...pending]){const ok=await printOrderBluetoothAuto(id,admin?.orders||[],true);if(!ok)break}}finally{caseiraoPrintV3Busy=false;refreshPendingPrintStatus()}
};
try{caseiraoPrintV3CleanQueue()}catch(e){}
/* ===== FIM CASEIRAO PRINTER ENGINE V3 ===== */
