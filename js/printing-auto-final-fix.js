'use strict';
/* Ponte final entre o monitor de pedidos e a impressao automatica. */
(()=>{
  if(typeof checkNewOrders!=='function'||typeof flushPendingAutoPrint!=='function'||typeof queueAutoPrint!=='function'||typeof eligibleForAutoPrint!=='function')return;
  let observed=null,bridgeBusy=false;
  const printState=order=>({eligible:!!eligibleForAutoPrint(order),payment:String(order?.payment_status||'').toLowerCase(),status:String(order?.status||'').toLowerCase()});
  function observeOrders(orders,baseline=false){
    const next=new Map();
    for(const order of (orders||[])){
      const id=String(order?.id||'');if(!id)continue;
      const state=printState(order),previous=observed?.get(id);next.set(id,state);
      const becameEligible=previous&&!previous.eligible&&state.eligible,isNew=observed&&!previous;
      if(!baseline&&state.eligible&&(isNew||becameEligible)&&!wasAutoPrinted(id))queueAutoPrint(id);
    }
    observed=next;
  }
  // A fotografia atual evita reimprimir pedidos antigos ao atualizar a pagina.
  observeOrders(admin?.orders||[],true);
  const previousCheck=checkNewOrders;
  checkNewOrders=async function(...args){
    if(bridgeBusy)return;bridgeBusy=true;
    try{
      await previousCheck.apply(this,args);
      if(!sessionStorage.getItem('caseirao_admin_pin'))return;
      observeOrders(admin?.orders||[],false);
      if(printerPrefs().auto)await flushPendingAutoPrint();
    }catch(error){console.error('[Caseirao AutoPrint] Falha no ciclo:',error)}finally{bridgeBusy=false}
  };
  if(typeof startOrderWatcher==='function'){
    const previousStart=startOrderWatcher;
    startOrderWatcher=function(...args){observeOrders(admin?.orders||[],true);return previousStart.apply(this,args)};
  }
  if(printerPrefs().auto)setTimeout(()=>flushPendingAutoPrint().catch(error=>console.error('[Caseirao AutoPrint] Falha ao retomar fila:',error)),500);
  // Se o ADM foi restaurado automaticamente antes deste ultimo script,
  // reinicia o intervalo para ele apontar para a rotina ja corrigida.
  if(sessionStorage.getItem('caseirao_admin_pin')&&admin&&typeof startOrderWatcher==='function')startOrderWatcher();
})();
