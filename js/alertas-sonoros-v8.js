'use strict';
/* Caseirão V10 — alertas por evento + anúncio falado adaptado ao destino.
   Opera sobre os fluxos existentes e não altera o envio nem o estado dos pedidos. */
(function () {
  const key = 'caseirao_alertas_v8';
  const defaults = {volume:100, voice:true};
  let pref = {...defaults};
  try {pref={...defaults,...JSON.parse(localStorage.getItem(key)||'{}')};}catch{}
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(pref));}catch{}};
  let soundsContext=null;
  let lastSpeech=null;
  const emitted=new Map();
  let queue=Promise.resolve();
  // Começa fechado para liberar espaço dos cartões; mantém estado ao atualizar pedidos.
  let soundPanelExpanded=false;
  const validTypes=new Set(['novo','confirmado','pronto','em_rota','entregue']);
  const money=(v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function prepare(){
    try{
      if(typeof unlockOrderSound==='function')unlockOrderSound();
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!soundsContext&&AC)soundsContext=(typeof audioCtx!=='undefined'&&audioCtx)||new AC();
      if(soundsContext?.state==='suspended')soundsContext.resume().catch(()=>{});
    }catch{}
    return soundsContext;
  }
  function simpleTone(ctx,freq,start,duration,kind='sine',strength=.7){
    const oscillator=ctx.createOscillator(),g=ctx.createGain();
    oscillator.type=kind; oscillator.frequency.setValueAtTime(freq,start);
    const amplitude=Math.max(.0001,Number(pref.volume||0)/100)*.15*strength;
    g.gain.setValueAtTime(.0001,start);
    g.gain.exponentialRampToValueAtTime(Math.max(.00011,amplitude),start+.012);
    g.gain.setValueAtTime(Math.max(.00011,amplitude),start+Math.max(.024,duration-.075));
    g.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(g);g.connect(ctx.destination);oscillator.start(start);oscillator.stop(start+duration+.02);
  }
  function bellTone(ctx,freq,start,duration,strength,master){
    // Mesma síntese de campainha da prévia “Volume máximo” aprovada.
    const gain=ctx.createGain();
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.linearRampToValueAtTime(strength,start+.007);
    gain.gain.setValueAtTime(strength*.95,start+Math.min(.17,duration*.36));
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    gain.connect(master);
    [[1,'triangle',.60],[2,'sine',.30],[3,'sine',.12],[1.005,'sine',.17]].forEach(([harmonic,kind,amplitude])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type=kind;o.frequency.setValueAtTime(freq*harmonic,start);g.gain.value=amplitude;
      o.connect(g);g.connect(gain);o.start(start);o.stop(start+duration+.012);
    });
  }
  function play(kind){
    if(!validTypes.has(kind))return 0;
    const ctx=prepare();if(!ctx)return 0;
    const start=ctx.currentTime+.045;
    try{
      if(kind==='novo'){
        const master=ctx.createGain(),limiter=ctx.createDynamicsCompressor();
        limiter.threshold.value=-10;limiter.knee.value=6;limiter.ratio.value=12;
        limiter.attack.value=.002;limiter.release.value=.10;
        master.gain.value=Math.max(0,Math.min(1,Number(pref.volume)/100))*1.05;
        master.connect(limiter);limiter.connect(ctx.destination);
        for(let j=0;j<4;j++){
          const t=start+j*1.08;
          bellTone(ctx,1046.5,t,.43,.56,master);
          bellTone(ctx,783.99,t+.38,.54,.61,master);
        }
        try{navigator.vibrate?.([500,180,500,180,650]);}catch{}
        return 4550;
      }
      if(kind==='confirmado'){
        simpleTone(ctx,987.77,start,.16,'sine',.7);
        simpleTone(ctx,1318.5,start+.2,.29,'sine',.8);
        return 750;
      }
      if(kind==='pronto'){
        simpleTone(ctx,587.33,start,.14,'triangle',1);
        simpleTone(ctx,783.99,start+.22,.14,'triangle',1);
        simpleTone(ctx,1046.5,start+.44,.32,'triangle',1.1);
        return 950;
      }
      if(kind==='em_rota'){
        simpleTone(ctx,392,start,.2,'triangle',1);
        simpleTone(ctx,587.33,start+.33,.38,'triangle',1);
        return 900;
      }
      if(kind==='entregue'){
        simpleTone(ctx,659.25,start,.14,'sine',.78);
        simpleTone(ctx,830.61,start+.18,.14,'sine',.78);
        simpleTone(ctx,1046.5,start+.36,.41,'sine',.86);
        return 990;
      }
    }catch(e){console.warn('Caseirão: áudio indisponível',e)}
    return 0;
  }
  function cleanName(name){
    const raw=String(name||'').replace(/[\n\r]/g,' ').replace(/[^\p{L}\p{M} .'-]/gu,' ').replace(/\s+/g,' ').trim();
    return /^(cliente|pedido manual|não informado)$/i.test(raw)||raw.length<2?'':raw.slice(0,70);
  }
  function readyOrderCategory(order){
    const type=String(order?.type||'').trim().toLowerCase();
    const notes=String(order?.notes||'');
    const recordedMesa=Number(order?.table_number);
    const mesaTag=notes.match(/\[MESA\s*(\d{1,3})\]/i);
    const mesa=Number.isSafeInteger(recordedMesa)&&recordedMesa>0?recordedMesa:(mesaTag?Number(mesaTag[1]):0);
    if(mesa>0)return {kind:'mesa',mesa};
    if(type==='counter'||type==='balcao'||/^\s*\[BALC[AÃ]O\]/i.test(notes))return {kind:'balcao',mesa:0};
    if(type==='delivery'||type==='entrega')return {kind:'entrega',mesa:0};
    if(type==='pickup'||type==='retirada')return {kind:'retirada',mesa:0};
    if(type==='local'||type==='mesa'||type==='table')return {kind:'local',mesa:0};
    return {kind:'outro',mesa:0};
  }
  function voiceCustomer(order){
    let raw=String(order?.customer_name||'').trim();
    // As comandas de mesa trazem "Mesa 04 • Maria" no nome; não ler "Mesa" como se fosse uma pessoa.
    if(readyOrderCategory(order).kind==='mesa')raw=raw.replace(/^mesa\s*\d+\s*(?:[•|:;,.\-–—]\s*)?/i,'').trim();
    const name=cleanName(raw);
    return /^(mesa|cliente da mesa|respons[aá]vel da mesa)$/i.test(name)?'':name;
  }
  function makeReadyText(order){
    const name=voiceCustomer(order);
    const number=Number(order?.order_number);
    const numberPart=Number.isSafeInteger(number)&&number>0?`, número ${number},`:'';
    const customerPart=name?` de ${name}`:'';
    const {kind,mesa}=readyOrderCategory(order);
    if(kind==='entrega')return `Pedido para entrega${customerPart}${numberPart} está pronto. Atenção, entregador! Pode buscar o pedido no Caseirão para sair em rota.`;
    if(kind==='retirada')return `Pedido para retirada${customerPart}${numberPart} está pronto. Pode avisar o cliente para vir retirar aqui no Caseirão.`;
    if(kind==='mesa')return `Pedido para consumo no local, mesa ${mesa}${name?`, de ${name}`:''}${numberPart} está pronto. Atendimento, pode levar o pedido para a mesa ${mesa}.`;
    if(kind==='balcao')return `Pedido de balcão${customerPart}${numberPart} está pronto. Pode chamar o cliente para retirar no balcão.`;
    if(kind==='local')return `Pedido para consumo no local${customerPart}${numberPart} está pronto. Atendimento, pode servir o pedido no salão.`;
    // Não direcionar um pedido sem tipo conhecido para o entregador ou para o cliente errado.
    return `Pedido${customerPart}${numberPart} está pronto. Confira o destino do pedido na Central.`;
  }
  const voiceExamples={
    entrega:{type:'delivery',customer_name:'Maria Eduarda',order_number:123},
    retirada:{type:'pickup',customer_name:'João Pedro',order_number:124},
    mesa:{type:'local',table_number:4,customer_name:'Mesa 04 • Ana Clara',order_number:125},
    balcao:{type:'counter',customer_name:'Lucas',order_number:126}
  };
  function previewVoice(kind){prepare();return speak(makeReadyText(voiceExamples[kind]||voiceExamples.entrega),true)}
  // Prefere Francisca quando disponibilizada pelo sistema. A voz Neural da
  // Microsoft não é distribuída pela Web Speech API do Chrome Android;
  // para garantia de voz Neural é necessária integração segura com Azure TTS.
  function selectNaturalVoice(voices){
    const pt=voices.filter(v=>/^pt(?:[-_]BR)?$/i.test(v.lang));
    const score=v=>{
      const n=String(v.name||'').toLowerCase();
      return (/francisca/.test(n)?1000:0)+(/neural|natural|online/.test(n)?200:0)+
        (/microsoft/.test(n)?100:0)+(/google/.test(n)?40:0)+
        (/female|feminina|woman/.test(n)?15:0)-(v.localService?5:0);
    };
    return pt.sort((a,b)=>score(b)-score(a))[0]||voices.find(v=>/^pt/i.test(v.lang));
  }
  function speak(text,force=false){
    if(!force&&!pref.voice)return false;
    const speech=window.speechSynthesis;
    if(!speech||typeof window.SpeechSynthesisUtterance!=='function')return false;
    try{
      speech.cancel();
      const u=new SpeechSynthesisUtterance(String(text));
      const voice=selectNaturalVoice(speech.getVoices()||[]);
      if(voice)u.voice=voice;
      u.lang='pt-BR';u.rate=.91;u.pitch=1.04;u.volume=Math.min(1,Number(pref.volume)/100);
      lastSpeech=u;
      speech.speak(u);
      return true;
    }catch(e){console.warn('Caseirão: leitura por voz indisponível',e);return false;}
  }
  // Em alguns navegadores as vozes só aparecem após o carregamento inicial.
  try{window.speechSynthesis?.getVoices();}catch{}
  function eventId(order,status){return `${String(order?.id||'')}:${status}`;}
  function recentlyNotified(order,status){
    const k=eventId(order,status);
    if(emitted.has(k)&&Date.now()-emitted.get(k)<20000)return true;
    emitted.set(k,Date.now());
    if(emitted.size>400){for(const [id,time] of emitted){if(Date.now()-time>60*60*1000)emitted.delete(id);}}
    return false;
  }
  function dispatch(kind,order,withSpeech=false){
    if(recentlyNotified(order,kind))return;
    queue=queue.catch(()=>{}).then(async()=>{
      const duration=play(kind);
      if(withSpeech&&pref.voice){await sleep(Math.max(800,Math.min(duration,1500)));speak(makeReadyText(order));}
      // Evita que vários estados e vozes se sobreponham ao mesmo tempo.
      await sleep(withSpeech&&pref.voice?3000:duration+180);
    });
  }
  // Mantém o botão antigo Testar toque / Ativar alertas funcional.
  if(typeof playOrderSound==='function')playOrderSound=function(){play('novo')};
  // Emita alertas apenas por transição real (nunca por re-renderização).
  if(typeof checkNewOrders==='function')checkNewOrders=async function(){
    if(adminOrderSyncBusy||!sessionStorage.getItem('caseirao_admin_pin'))return;
    adminOrderSyncBusy=true;
    try{
      const old=new Map((admin?.orders||[]).map(o=>[String(o.id),String(o.status||'').toLowerCase()]));
      const fresh=await adminCall('snapshot'),orders=fresh.orders||[];
      const newOrders=orders.filter(o=>!knownOrderIds.has(o.id));
      const changed=orders.filter(o=>old.has(String(o.id))&&old.get(String(o.id))!==String(o.status||'').toLowerCase());
      orders.forEach(o=>{knownOrderIds.add(o.id);knownOrderStatuses.set(String(o.id),String(o.status||'').toLowerCase())});
      admin=fresh;
      for(const order of newOrders){dispatch('novo',order);showOrderToast(order)}
      for(const order of changed){
        const status=String(order.status||'').toLowerCase();
        if(!validTypes.has(status))continue;
        dispatch(status,order,status==='pronto');
        if(status==='pronto'){
          try{savePreparationStop(order.id,Date.parse(order.updated_at)||Date.now())}catch{}
          showReadyToast(order);showReadyCentralAlert(order);
        }else if(status==='entregue'){
          const message=completedOrderMessage(order),type=operationalOrderType(order);
          if(type==='delivery')window.caseiraoSaveDeliveryNotification?.(message,order.id||order.order_number);
          showAppToast(message,'ok');
          if(type!=='delivery')window.caseiraoShowOperationalCompletion?.(order,message);
        }
      }
      const box=document.querySelector('#admContent');
      if(box&&(newOrders.length||changed.length)){
        if(adminTab==='pedidos')renderOrders(box);
        else if(adminTab==='producao')renderKitchen(box);
        else if(adminTab==='caixa')renderCash(box);
        else if(adminTab==='mesas')await renderRemoteTables(box);
        else if(adminTab==='entregas')await renderDeliveryHub(box);
      }
    }catch(err){console.warn('Caseirão: falha na sincronização de alertas',err)}
    finally{adminOrderSyncBusy=false;}
  };
  if(typeof startOrderWatcher==='function')startOrderWatcher=function(){
    if(orderWatcher)clearInterval(orderWatcher);
    knownOrderIds=new Set((admin?.orders||[]).map(o=>o.id));
    knownOrderStatuses=new Map((admin?.orders||[]).map(o=>[String(o.id),String(o.status||'').toLowerCase()]));
    orderWatcher=setInterval(checkNewOrders,3500);
  };
  // Mudança manual de estado na própria Central também deve emitir o som correto.
  if(typeof adminCall==='function'){
    const originalAdminCall=adminCall;
    adminCall=async function(action,payload,...other){
      const order=action==='update_status'?(admin?.orders||[]).find(o=>String(o.id)===String(payload?.order_id)):null;
      const before=String(order?.status||'').toLowerCase();
      const response=await originalAdminCall(action,payload,...other);
      if(action==='update_status'&&order&&before!==String(payload?.status||'').toLowerCase()){
        const status=String(payload.status).toLowerCase();
        if(validTypes.has(status)){
          const current={...order,status,updated_at:new Date().toISOString()};
          dispatch(status,current,status==='pronto');
        }
      }
      return response;
    };
  }
  // A despachante recebe confirmação por voz no próprio tablet, APENAS depois do retorno da API.
  if(typeof employeeApi==='function'){
    const originalEmployeeApi=employeeApi;
    employeeApi=async function(action,payload,...other){
      const order=action==='mark_order_ready'?(employeeSnapshot?.orders||[]).find(o=>String(o.id)===String(payload?.order_id)):null;
      const result=await originalEmployeeApi(action,payload,...other);
      if(action==='mark_order_ready'&&result&&result.success!==false&&result.ok!==false&&order){
        play('pronto');
        if(pref.voice)setTimeout(()=>speak(makeReadyText(order)),870);
      }
      return result;
    };
  }
  function injectControls(box){
    if(!box||box.querySelector('#caseiraoV8SoundPanel'))return;
    const panel=document.createElement('details');panel.id='caseiraoV8SoundPanel';panel.className='caseiraoV8SoundPanel';
    // <details> ocupa apenas uma linha enquanto fechado. O som continua funcionando sempre.
    panel.open=soundPanelExpanded;
    panel.innerHTML=`<summary class="caseiraoV8SoundToggle"><span>🔔 Alertas sonoros e voz</span><span class="caseiraoV8SoundHint"><span class="caseiraoV8SoundHintText">Configurar</span><span class="caseiraoV8SoundChevron" aria-hidden="true">⌄</span></span></summary>
    <div class="caseiraoV8SoundBody"><div class="caseiraoV8SoundTitle">🔔 ALERTAS POR ETAPA <small>Campainha forte exclusiva do pedido novo</small></div>
    <div class="caseiraoV8SoundActions">
      <button type="button" data-caseirao-sound="novo">🔔 Pedido novo</button>
      <button type="button" data-caseirao-sound="confirmado">✓ Confirmado</button>
      <button type="button" data-caseirao-sound="pronto">📦 No ponto</button>
      <button type="button" data-caseirao-sound="em_rota">🛵 Saiu</button>
      <button type="button" data-caseirao-sound="entregue">✅ Entregue</button>
      <button type="button" data-caseirao-voice="entrega">🔊 Voz entrega</button>
      <button type="button" data-caseirao-voice="retirada">🔊 Voz retirada</button>
      <button type="button" data-caseirao-voice="mesa">🔊 Voz mesa</button>
      <button type="button" data-caseirao-voice="balcao">🔊 Voz balcão</button>
    </div>
    <div class="caseiraoV8SoundPrefs"><label>Volume <input type="range" id="caseiraoV8Volume" min="0" max="100" value="${Math.max(0,Math.min(100,Number(pref.volume)||0))}"></label><output id="caseiraoV8VolumeLabel">${Math.max(0,Math.min(100,Number(pref.volume)||0))}%</output><label class="caseiraoV8Voice"><input type="checkbox" id="caseiraoV8Voice" ${pref.voice?'checked':''}> Voz ao ficar pronto</label></div>
    <small class="caseiraoV8Disclaimer">Para tocar automaticamente no Chrome, mantenha a Central aberta e ative os alertas após abrir o app. A voz prioriza Francisca, quando disponível no aparelho; caso contrário usa a melhor voz em português instalada.</small></div>`;
    panel.addEventListener('toggle',()=>{soundPanelExpanded=panel.open});
    // Não troca a posição nem as ações dos cartões de pedidos.
    const alertControl=box.querySelector('.alertControl');
    if(alertControl)alertControl.after(panel);else box.prepend(panel);
    panel.querySelectorAll('[data-caseirao-sound]').forEach(b=>b.addEventListener('click',()=>play(b.dataset.caseiraoSound)));
    panel.querySelectorAll('[data-caseirao-voice]').forEach(b=>b.addEventListener('click',()=>previewVoice(b.dataset.caseiraoVoice)));
    panel.querySelector('#caseiraoV8Volume').addEventListener('input',event=>{pref.volume=Math.max(0,Math.min(100,Number(event.target.value)));panel.querySelector('#caseiraoV8VolumeLabel').textContent=pref.volume+'%';save()});
    panel.querySelector('#caseiraoV8Voice').addEventListener('change',event=>{pref.voice=event.target.checked;save()});
  }
  if(typeof renderOrders==='function'){
    const originalRenderOrders=renderOrders;
    renderOrders=function(box){const result=originalRenderOrders(box);injectControls(box);return result};
  }
  // Botão de prévia de voz também na área da despachante (não depende do ADM).
  if(typeof renderPackagingPanel==='function'){
    const originalRenderPackagingPanel=renderPackagingPanel;
    renderPackagingPanel=function(){
      const result=originalRenderPackagingPanel();
      const queue=document.querySelector('.packQueue');
      // Desbloqueia o áudio durante o toque do operador, antes da resposta de rede.
      queue?.querySelectorAll('[data-pack-ready]').forEach(button=>button.addEventListener('click',prepare,{capture:true}));
      if(queue&&!document.querySelector('#caseiraoV8DispatcherVoice')){
        const hint=document.createElement('div');hint.id='caseiraoV8DispatcherVoice';hint.className='caseiraoV8DispatcherVoice';
        hint.innerHTML=`<b>🔊 Confirmação por voz</b><span>Ao marcar NO PONTO, a voz fala o nome, número e destino: entrega, retirada ou consumo no local.</span><label class="caseiraoV8DispatcherToggle"><input type="checkbox" ${pref.voice?'checked':''}> Voz ativa</label><div class="caseiraoV10VoiceSamples"><button type="button" data-caseirao-voice="entrega">▶ Entrega</button><button type="button" data-caseirao-voice="retirada">▶ Retirada</button><button type="button" data-caseirao-voice="mesa">▶ Mesa</button><button type="button" data-caseirao-voice="balcao">▶ Balcão</button></div>`;
        queue.before(hint);
        hint.querySelectorAll('[data-caseirao-voice]').forEach(b=>b.addEventListener('click',()=>previewVoice(b.dataset.caseiraoVoice)));
        hint.querySelector('input').onchange=(ev)=>{pref.voice=ev.target.checked;save()};
      }
      return result;
    };
  }
  window.CaseiraoSoundV8={play,makeReadyText,readyOrderCategory,speak,previewReady:()=>previewVoice('entrega'),previewType:previewVoice};
})();
