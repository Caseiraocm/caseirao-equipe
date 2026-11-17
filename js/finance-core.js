/* Núcleo único dos relatórios. Valores calculados em centavos. */
(function(root){
 'use strict';
 const cents=v=>Math.round(Number(v||0)*100);
 const day=v=>v?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)):'';
 const method=v=>{const s=String(v||'').trim();return ['Pix','Dinheiro','Cartão de débito','Cartão de crédito','Cartão'].includes(s)?s:(s.startsWith('Dividido')?'Dividido sem detalhamento':'Não informado');};
 const csv=rows=>'\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const decimal=c=>(c/100).toFixed(2).replace('.',',');
 function build(data){
  const orders=data.orders||[],events=data.events||[],tablePays=data.table_payments||[],sessions=data.sessions||[],audit=data.audit||[],start=data.start,end=data.end;
  const inRange=v=>{const d=day(v);return d&&d>=start&&d<=end;};
  const orderMap=new Map(orders.map(o=>[o.id,o])),net=new Map(),receipts=[],issues=[],sales=[],pending=[],daily=new Map(),products=new Map();
  const addNet=(id,amount)=>net.set(id,(net.get(id)||0)+amount);
  const dailyRow=d=>{if(!daily.has(d))daily.set(d,{day:d,sales:0,receipts:0,refunds:0,count:0});return daily.get(d);};
  const receipt=r=>{receipts.push(r);if(r.at&&inRange(r.at)){const d=dailyRow(day(r.at));d[r.kind==='refund'?'refunds':'receipts']+=(r.kind==='correction'?-1:1)*r.amount;}};
  for(const e of events){
   const value=cents(e.amount),o=orderMap.get(e.order_id);if(!o)continue;
   if(!e.occurred_at||day(e.occurred_at)<=end)addNet(o.id,e.kind==='refund'?-value:value);
   if(inRange(e.occurred_at)||(!e.occurred_at&&inRange(o.sale_date||o.created_at))){receipt({id:e.id,order:o.order_number,order_id:o.id,kind:e.kind,method:method(e.method),amount:value,at:e.occurred_at,historical:!!e.historical,note:e.note||'',source:'Comanda'});}
   if(e.note==='Pix recebido por QR anterior após troca de modalidade')issues.push({order:o.order_number,reason:'Pix do QR antigo foi recebido após troca: confira duplicidade ou devolução.'});
  }
  const paidSessions=new Set(tablePays.map(p=>p.table_session_id));
  const itemOrders=new Map();orders.forEach(o=>(o.order_items||[]).forEach(i=>itemOrders.set(i.id,o.id)));
  for(const p of tablePays){
   for(const i of p.items||[])if(day(p.created_at)<=end&&itemOrders.has(i.item_id))addNet(itemOrders.get(i.item_id),Number(i.amount_cents||0));
   if(inRange(p.created_at))receipt({id:p.id,order:'Mesa',order_id:'',kind:'receipt',method:method(p.method),amount:Number(p.amount_cents),at:p.created_at,note:'Pagamento por itens • '+p.actor,source:'Mesa por itens'});
  }
  for(const s of sessions){
   if(s.status!=='closed'||paidSessions.has(s.id))continue;
   const os=orders.filter(o=>o.table_session_id===s.id&&o.status!=='cancelado');
   if(day(s.closed_at)<=end)os.forEach(o=>addNet(o.id,cents(o.total)));
   if(!inRange(s.closed_at))continue;
   const record=audit.find(l=>os.some(o=>o.id===l.order_id)&&Array.isArray(l.details?.payments));
   let parts=record?.details?.payments?.map(p=>({method:p.method,amount:Number(p.amount)}))||[];
   if(!parts.length&&String(s.payment_method).startsWith('Dividido:')){
    const regex=/(Pix|Dinheiro|Cartão de débito|Cartão de crédito|Cartão)\s+R\$\s*([\d.]+,\d{2})/g;let m;
    while((m=regex.exec(s.payment_method)))parts.push({method:m[1],amount:Math.round(Number(m[2].replace(/\./g,'').replace(',','.'))*100)});
   }
   if(parts.reduce((sum,p)=>sum+p.amount,0)!==cents(s.total)||!parts.length){parts=[{method:s.payment_method,amount:cents(s.total)}];}
   parts.forEach((p,i)=>receipt({id:s.id+'-'+i,order:os.map(o=>o.order_number).join(' / '),kind:'receipt',method:method(p.method),amount:p.amount,at:s.closed_at,note:'Fechamento de mesa',source:'Mesa por valores'}));
  }
  const staffEntries=data.staff_entries||[],staffMembers=new Map((data.staff_members||[]).map(m=>[m.id,m.name])),staffIndex=new Map(staffEntries.map(e=>[e.id,e]));
  let staffSales=0,staffGifts=0,staffBalance=0,staffCorrections=0,staffReceived=0,staffAdvances=0;const staffOutflows=[];
  for(const e of staffEntries){
   if(day(e.created_at)>end)continue;
   staffBalance+=Number(e.debt_delta_cents);
   if(!inRange(e.created_at))continue;
   const original=e.reverses_id?staffIndex.get(e.reverses_id):null,kind=original?.kind||e.kind,sign=e.kind==='reversal'?-1:1;
   if(kind==='charge'){staffSales+=sign*Number(e.amount_cents);const d=dailyRow(day(e.created_at));d.staffSales=(d.staffSales||0)+sign*Number(e.amount_cents);}
   if(kind==='gift')staffGifts+=sign*Number(e.amount_cents);
   if(kind==='advance'){staffAdvances+=sign*Number(e.amount_cents);const d=dailyRow(day(e.created_at));d.staffAdvances=(d.staffAdvances||0)+sign*Number(e.amount_cents);staffOutflows.push({...e,member_name:staffMembers.get(e.member_id),signed_cents:sign*Number(e.amount_cents)});}
   if(kind==='payment'){
    staffReceived+=sign*Number(e.amount_cents);if(sign<0)staffCorrections+=Number(e.amount_cents);
    receipt({id:e.id,order:staffMembers.get(e.member_id)||'Funcionário',kind:sign<0?'correction':'receipt',method:method(e.method),amount:Number(e.amount_cents),at:e.created_at,note:(sign<0?'Estorno de registro: ':'Pagamento da ficha: ')+(e.note||''),source:'Ficha de funcionário'});
   }
  }
  for(const o of orders){
   const saleDate=o.sale_date||o.scheduled_released_at||o.created_at;if(!inRange(saleDate))continue;
   const value=cents(o.total),paid=net.get(o.id)||0;
   const scheduled=['agendado','agendado_confirmado'].includes(o.status),cancelled=o.status==='cancelado';
   if(cancelled){if(paid>0)issues.push({order:o.order_number,reason:'Pedido cancelado com recebimento sem devolução integral registrada.'});continue;}
   if(scheduled)continue;
   const row={...o,sale_date:saleDate,value,received:paid,due:Math.max(0,value-paid),overpaid:Math.max(0,paid-value)};
   if(o.status==='entregue'){
    sales.push(row);const d=dailyRow(day(saleDate));d.sales+=value;d.count++;
    (o.order_items||[]).forEach(i=>{const name=i.product_name||'Item',p=products.get(name)||{name,qty:0,total:0};p.qty+=Number(i.quantity||0);p.total+=cents(i.line_total);products.set(name,p);});
   }else pending.push(row);
   if(row.overpaid)issues.push({order:o.order_number,reason:'Recebimentos superiores ao total: confira troco/devolução pendente.'});
   if(cents(o.item_refund_due)>0)issues.push({order:o.order_number,reason:'Remoção de itens com devolução pendente: '+decimal(cents(o.item_refund_due))});
   if(o.payment_status==='confirmed'&&paid===0&&!o.table_session_id)issues.push({order:o.order_number,reason:'Marcado como confirmado sem lançamento financeiro compatível.'});
  }
  const dated=receipts.filter(r=>r.at),undated=receipts.filter(r=>!r.at),byMethod={};
  for(const r of dated){const key=r.method,v=byMethod[key]||(byMethod[key]={received:0,refunded:0});v[r.kind==='refund'?'refunded':'received']+=(r.kind==='correction'?-1:1)*r.amount;}
  const sum=(arr,field)=>arr.reduce((s,r)=>s+Number(r[field]||0),0);
  const result={start,end,generated_at:data.generated_at,sales,pending,receipts,issues,byMethod,daily:[...daily.values()].sort((a,b)=>a.day.localeCompare(b.day)),products:[...products.values()].sort((a,b)=>b.qty-a.qty),audit,cash:data.cash_movements||[],orders,
   staffOutflows,staffEntries:staffEntries,staffMembers:data.staff_members||[],totals:{staffAdvances,staffSales,staffGifts,staffBalance,staffCorrections,staffReceived,sales:sum(sales,'value'),received:sum(dated.filter(r=>r.kind==='receipt'),'amount')-sum(dated.filter(r=>r.kind==='correction'),'amount'),refunded:sum(dated.filter(r=>r.kind==='refund'),'amount'),undated:undated.reduce((s,r)=>s+(r.kind==='refund'?-r.amount:r.amount),0),due:sum(sales,'due'),pending:sum(pending,'value'),cancelled:sum(orders.filter(o=>o.status==='cancelado'&&inRange(o.sale_date||o.created_at)).map(o=>({value:cents(o.total)})),'value'),delivery:sum(sales.map(o=>({value:cents(o.delivery_fee)-cents(o.delivery_discount)})),'value'),discounts:sum(sales.map(o=>({value:cents(o.discount)+cents(o.delivery_discount)})),'value'),cashback:sum(sales.map(o=>({value:cents(o.cashback_used)})),'value')}};
  return result;
 }
 const api={build,cents,day,csv,decimal,method};root.CaseiraoFinance=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
