
(()=>{
  const clock=document.getElementById('liveClock');
  if(!clock)return;
  const formatter=new Intl.DateTimeFormat('pt-BR',{
    timeZone:'America/Fortaleza',
    hour:'2-digit',
    minute:'2-digit',
    hour12:false
  });
  const updateClock=()=>{
    const now=new Date();
    clock.textContent=formatter.format(now);
    clock.dateTime=now.toISOString();
  };
  updateClock();
  setInterval(updateClock,1000);
})();
