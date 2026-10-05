/* Central compacta v2.4 — preserva os recursos e reduz a rolagem operacional. */
(()=>{
  'use strict';
  let lastAction={id:'',at:0};

  function orderId(card){
    return String(card.querySelector('[data-oid]')?.dataset.oid||'');
  }

  function compactCard(card){
    const body=card.querySelector(':scope > .orderBody');
    if(!body)return;
    const keep=new Set(['orderInfoGrid','orderItemsBox','orderTotalsBox','pixPendingWarning','smartOrderFlow']);
    let more=body.querySelector(':scope > .centralMore');
    let content=more?.querySelector(':scope > .centralMoreBody');
    const movable=[...body.children].filter(node=>{
      if(node===more||node.matches('script,style'))return false;
      return ![...keep].some(name=>node.classList?.contains(name));
    });

    if(movable.length){
      if(!more){
        more=document.createElement('details');
        more.className='centralMore';
        const summary=document.createElement('summary');
        summary.textContent='MAIS INFORMAÇÕES E AÇÕES';
        content=document.createElement('div');
        content.className='centralMoreBody';
        more.append(summary,content);
        body.appendChild(more);
      }
      movable.forEach(node=>content.appendChild(node));
    }
    card.dataset.compactReady='1';
  }

  function foldPrinter(root){
    const panel=root.querySelector('#caseiraoPrinterPanel');
    if(!panel||panel.closest('.centralPrinterFold'))return;
    const fold=document.createElement('details');
    fold.className='centralPrinterFold';
    const summary=document.createElement('summary');
    summary.textContent='🖨️ IMPRESSORA E CONFIGURAÇÕES';
    panel.before(fold);fold.append(summary,panel);
  }

  function enhance(root=document){
    const content=root.matches?.('#admContent')?root:root.querySelector?.('#admContent');
    if(!content)return;
    content.querySelectorAll('details.orderDetailed').forEach(compactCard);
    foldPrinter(content);

    if(lastAction.id&&Date.now()-lastAction.at<9000){
      const card=[...content.querySelectorAll('details.orderDetailed')].find(item=>orderId(item)===lastAction.id);
      if(card){
        card.open=true;
        card.classList.add('recentlyUpdated');
        requestAnimationFrame(()=>card.scrollIntoView({block:'center',behavior:'smooth'}));
        setTimeout(()=>card.classList.remove('recentlyUpdated'),7000);
        lastAction={id:'',at:0};
      }
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-st][data-oid]');
    if(!button)return;
    lastAction={id:String(button.dataset.oid||''),at:Date.now()};
  },true);

  const observer=new MutationObserver(records=>{
    if(records.some(record=>record.addedNodes.length))requestAnimationFrame(()=>enhance(document));
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  enhance(document);
})();
