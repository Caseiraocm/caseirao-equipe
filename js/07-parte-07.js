
(()=>{
  const sync=()=>{
    let notice=document.getElementById('networkStatus');
    if(navigator.onLine){notice?.remove();return}
    if(!notice){notice=document.createElement('div');notice.id='networkStatus';notice.className='networkStatus';notice.setAttribute('role','status');notice.textContent='Sem internet — confira a conexão antes de enviar o pedido';document.body.appendChild(notice)}
  };
  window.addEventListener('online',sync);
  window.addEventListener('offline',sync);
  sync();
})();
