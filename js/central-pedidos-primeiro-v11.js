/* O Caseirão • V11 • pedidos sempre na frente, equipamentos e alertas no rodapé.
   Só reorganiza elementos já renderizados. NÃO altera os serviços de pedidos,
   Bluetooth, áudio, voz, Pix, impressão ou cadastro. */
(()=>{
 'use strict';
 let settingsExpanded=false;
 let queued=false;
 const folderId='caseiraoV11Settings';

 function prioritizeNewOrders(box){
   const received=box.querySelector('.ordersKanban [data-kanban="received"] .kanbanCards');
   if(!received)return;
   const items=Array.from(received.children).filter(card=>card.classList.contains('orderDetailed'));
   if(items.length<2)return;
   const newIds=new Set((typeof admin!=='undefined'&&admin?.orders||[])
     .filter(order=>String(order.status||'').toLowerCase()==='novo')
     .map(order=>String(order.id)));
   if(!newIds.size)return;
   // Dentro de "Recebidos", os pedidos novos ficam acima dos já confirmados.
   const isNew=card=>newIds.has(String(card.querySelector('[data-oid]')?.dataset.oid||''));
   const ordered=[...items.filter(isNew),...items.filter(card=>!isNew(card))];
   if(ordered.every((card,index)=>card===items[index]))return;
   for(let i=0;i<ordered.length;i++){
      const actual=received.children[i];
      if(actual!==ordered[i])received.insertBefore(ordered[i],actual||null);
   }
 }

 function organize(box){
   if(!box||box.id!=='admContent'||!box.isConnected)return;
   if(typeof adminTab!=='undefined'&&adminTab!=='pedidos')return;
   const audio=box.querySelector('#caseiraoV8SoundPanel');
   const printer=box.querySelector('.centralPrinterFold')||box.querySelector('#caseiraoPrinterPanel');
   if(!audio&&!printer)return;

   let settings=box.querySelector('#'+folderId);
   if(!settings){
     settings=document.createElement('details');
     settings.id=folderId;
     settings.className='caseiraoV11Settings';
     settings.open=settingsExpanded;
     const title=document.createElement('summary');
     title.className='caseiraoV11SettingsToggle';
     title.innerHTML='<span>⚙️ Equipamentos e alertas</span><span class="caseiraoV11SettingsHint">Bluetooth, impressora e sons <span aria-hidden="true">⌄</span></span>';
     const area=document.createElement('div');
     area.className='caseiraoV11SettingsBody';
     settings.append(title,area);
     settings.addEventListener('toggle',()=>{if(settings.isConnected)settingsExpanded=settings.open});
     box.append(settings);
   }
   const target=settings.querySelector('.caseiraoV11SettingsBody');
   if(printer&&!target.contains(printer))target.append(printer);
   if(audio&&!target.contains(audio))target.append(audio);
   if(settings!==box.lastElementChild)box.append(settings);
   prioritizeNewOrders(box);
 }

 if(typeof renderOrders==='function'){
   const previous=renderOrders;
   renderOrders=function(box){
     const openSettings=box?.querySelector('#'+folderId);
     if(openSettings)settingsExpanded=openSettings.open;
     const result=previous(box);
     organize(box);
     return result;
   };
 }

 // A central compacta reorganiza as colunas após a pintura. Esta checagem
 // aguarda o board e age só quando aparece algo novo, preservando filtros e cliques.
 const observer=new MutationObserver(records=>{
   if(queued||!records.some(record=>record.addedNodes.length||record.removedNodes.length))return;
   queued=true;
   requestAnimationFrame(()=>{
     queued=false;
     const box=document.querySelector('#admContent');
     if(box)organize(box);
   });
 });
 observer.observe(document.documentElement,{childList:true,subtree:true});
 const existing=document.querySelector('#admContent');
 if(existing)organize(existing);
})();
