/* Caseirão: integra impressão automática ao watcher final (inclusive alertas sonoros). */
(()=>{
  if(typeof checkNewOrders!=='function'||typeof caseiraoPrintObserve!=='function'||typeof flushPendingAutoPrint!=='function')return;
  const previous=checkNewOrders;
  let running=false;
  checkNewOrders=async function(...args){
    if(running)return;
    running=true;
    try{
      await previous.apply(this,args);
      if(!sessionStorage.getItem('caseirao_admin_pin'))return;
      if(!printerPrefs().auto)return;
      caseiraoPrintObserve(admin?.orders||[],false);
      await flushPendingAutoPrint();
    }catch(e){console.error('[Caseirao AutoPrint] Falha no ciclo:',e)}
    finally{running=false}
  };
  // Se o watcher já estiver ativo, o próximo ciclo usará a versão corrigida.
  // A fila é preservada mesmo quando a impressora está desconectada.
  if(printerPrefs().auto){
    try{caseiraoPrintObserve(admin?.orders||[],true)}catch(e){console.warn('[Caseirao AutoPrint] Baseline:',e)}
    setTimeout(()=>flushPendingAutoPrint().catch(e=>console.error('[Caseirao AutoPrint]',e)),500);
  }
})();
