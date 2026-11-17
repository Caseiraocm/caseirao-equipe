(function(root){
 'use strict';
 const day=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
 const labels={charge:'Consumo cobrado',gift:'Cortesia da casa',payment:'Pagamento recebido',reversal:'Correção / estorno de registro'};
 const currency=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 function amount(text){const s=String(text||'').trim();if(!/^\d+(?:[.,]\d{1,2})?$/.test(s))return null;const n=Math.round(Number(s.replace(',','.'))*100);return Number.isSafeInteger(n)&&n>0?n:null;}
 function build(member,entries,start='',end=''){
  const list=entries.filter(e=>e.member_id===member.id).slice().sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  const index=new Map(list.map(e=>[e.id,e])),reversed=new Set(list.filter(e=>e.reverses_id&&(!end||day(e.created_at)<=end)).map(e=>e.reverses_id));
  let running=0,opening=0,closing=0,charged=0,paid=0,gifts=0;const rows=[];
  for(const e of list){
   const d=day(e.created_at);running+=Number(e.debt_delta_cents);if(start&&d<start)opening=running;
   if(end&&d>end)continue;closing=running;if(start&&d<start)continue;
   const source=e.reverses_id?index.get(e.reverses_id):null;
   const kind=source?.kind||e.kind,sign=e.kind==='reversal'?-1:1,value=Number(e.amount_cents)*sign;
   if(kind==='charge')charged+=value;if(kind==='payment')paid+=value;if(kind==='gift')gifts+=value;
   rows.push({...e,label:labels[e.kind],source,reversed:reversed.has(e.id),balance_cents:running});
  }
  return {member,start,end,opening,closing,current:running,charged,paid,gifts,rows};
 }
 function receipt(s,generated,width=48){
  const line='-'.repeat(width),lines=['O CASEIRAO BURGER','CONSUMO DE FUNCIONARIO',s.member.name,'Extrato para conferencia',line,`Emitido: ${generated}`,`Periodo: ${s.start||'Inicio'} a ${s.end||'Hoje'}`,`Saldo anterior: ${currency(s.opening)}`,line];
  for(const e of s.rows){
   lines.push(new Date(e.created_at).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}),`${e.label}: ${currency(e.amount_cents)}`);
   if(e.kind==='charge'||e.kind==='gift'){
    lines.push(`Consumido em: ${e.consumed_on}`);
    for(const i of e.items||[]){lines.push(`${i.qty}x ${i.name} - ${currency(i.total_cents)}`);for(const a of i.addons||[])lines.push(' + '+a.name);if(i.note)lines.push(' Obs.: '+i.note);}
   }
   if(e.method)lines.push('Forma: '+e.method);
   if(e.source)lines.push('Corrige: '+labels[e.source.kind]+' de '+day(e.source.created_at));
   if(e.note)lines.push('Motivo/Obs.: '+e.note);
   lines.push('Responsavel: '+e.actor,`Saldo apos lancamento: ${currency(e.balance_cents)}`,line);
  }
  lines.push(`Consumo cobrado no periodo: ${currency(s.charged)}`,`Pagamentos no periodo: ${currency(s.paid)}`,`Cortesias no periodo: ${currency(s.gifts)}`,`SALDO NO FIM DO PERIODO: ${currency(s.closing)}`,`SALDO ATUAL DA FICHA: ${currency(s.current)}`,line,'Cortesia nao gera cobranca.','Correcoes preservam os lancamentos originais.','');return lines;
 }
 const api={day,amount,labels,currency,build,receipt};root.CaseiraoStaff=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
