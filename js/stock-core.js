(function(root){
 'use strict';
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const unit=v=>{const s=String(v??'').trim();if(!/^\d+$/.test(s))return null;const n=Number(s);return Number.isSafeInteger(n)&&n<=2147483647?n:null;};
 const countable=p=>/bebida|refrigerante|suco|agua|coca|guarana|sprite|fanta|pepsi|lata|litro/.test(normalize(p.category+' '+p.name));
 function status(p){if(!p.stock_enabled)return {label:'Sem controle',tone:'off'};if(p.active===false)return {label:'Produto inativo',tone:'off'};if(Number(p.stock_quantity)<=0)return {label:'Esgotado',tone:'empty'};if(p.stock_manual_sold_out)return {label:'Pausado manualmente',tone:'paused'};if(Number(p.stock_quantity)<=Number(p.stock_minimum))return {label:'Estoque baixo',tone:'low'};return {label:'Disponível',tone:'ok'};}
 const labels={enable:'Ativação / contagem inicial',disable:'Controle desativado',restock:'Entrada de mercadoria',loss:'Perda / retirada',count:'Ajuste de contagem',minimum:'Estoque mínimo alterado',saida_automatica:'Baixa / reserva automática',devolucao_cancelamento:'Devolução de unidade reservada'};
 const summary=products=>{const tracked=products.filter(p=>p.stock_enabled);return {tracked:tracked.length,units:tracked.reduce((sum,p)=>sum+Number(p.stock_quantity),0),empty:tracked.filter(p=>p.stock_quantity<=0).length,low:tracked.filter(p=>p.stock_quantity>0&&p.stock_quantity<=p.stock_minimum).length};};
 const api={unit,countable,status,summary,normalize,labels};root.CaseiraoStock=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
