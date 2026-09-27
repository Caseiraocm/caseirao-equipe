/* Caseirão Burger • WhatsApp Business Coexistence / Meta Embedded Signup */
(()=>{
'use strict';
const META_APP_ID='2535794216831989';
const META_CONFIG_ID='2360191328062857';
let sdkReady=false;
let lastSession=null;

function loadMetaSdk(){
  if(window.FB){sdkReady=true;return Promise.resolve();}
  return new Promise((resolve,reject)=>{
    const old=window.fbAsyncInit;
    window.fbAsyncInit=function(){
      try{ old?.(); }catch{}
      FB.init({appId:META_APP_ID,cookie:true,xfbml:false,version:'v24.0'});
      sdkReady=true;resolve();
    };
    if(document.getElementById('facebook-jssdk')) return;
    const s=document.createElement('script');s.id='facebook-jssdk';s.async=true;s.defer=true;s.crossOrigin='anonymous';
    s.src='https://connect.facebook.net/pt_BR/sdk.js';s.onerror=()=>reject(new Error('Não foi possível carregar a conexão da Meta.'));
    document.head.appendChild(s);
  });
}

window.addEventListener('message',(event)=>{
  if(event.origin!=='https://www.facebook.com' && event.origin!=='https://web.facebook.com')return;
  try{
    const d=typeof event.data==='string'?JSON.parse(event.data):event.data;
    if(d?.type==='WA_EMBEDDED_SIGNUP'){
      lastSession=d;
      try{localStorage.setItem('caseirao_whatsapp_embedded_signup',JSON.stringify({saved_at:new Date().toISOString(),data:d}));}catch{}
    }
  }catch{}
});

async function connectWhatsApp(){
  const btn=document.getElementById('caseiraoConnectWhatsApp');
  const status=document.getElementById('caseiraoWhatsStatus');
  try{
    if(btn){btn.disabled=true;btn.textContent='ABRINDO WHATSAPP...';}
    if(status)status.textContent='Abrindo cadastro oficial da Meta...';
    await loadMetaSdk();
    if(!sdkReady||!window.FB)throw new Error('SDK da Meta não carregou.');
    FB.login((response)=>{
      if(response?.authResponse?.code){
        try{localStorage.setItem('caseirao_whatsapp_signup_code',response.authResponse.code);}catch{}
        if(status)status.innerHTML='<b style="color:#187a45">✓ Cadastro concluído na Meta.</b> O WhatsApp Business pode continuar no celular.';
      }else{
        if(status)status.textContent='Conexão não concluída. Nenhuma alteração foi feita no WhatsApp.';
      }
      if(btn){btn.disabled=false;btn.textContent='CONECTAR WHATSAPP BUSINESS';}
    },{
      config_id:META_CONFIG_ID,
      response_type:'code',
      override_default_response_type:true,
      extras:{setup:{},featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:'3'}
    });
  }catch(e){
    if(status)status.textContent=e?.message||'Não foi possível abrir a conexão.';
    if(btn){btn.disabled=false;btn.textContent='CONECTAR WHATSAPP BUSINESS';}
  }
}

function installPanel(box){
  if(!box||box.querySelector('#caseiraoWhatsAppCoexistence'))return;
  const panel=document.createElement('div');
  panel.id='caseiraoWhatsAppCoexistence';panel.className='storeControl';
  panel.innerHTML=`<div class="sectionTitle">WhatsApp Business oficial</div>
    <div style="font-size:13px;line-height:1.45;margin:7px 0 12px">Conecte o número do Caseirão pela opção oficial de <b>Coexistência</b>. O mesmo número continua funcionando no aplicativo WhatsApp Business do celular.</div>
    <button id="caseiraoConnectWhatsApp" class="primary" type="button">CONECTAR WHATSAPP BUSINESS</button>
    <div id="caseiraoWhatsStatus" class="mini" style="margin-top:9px">Configuração Meta pronta para iniciar o cadastro incorporado.</div>`;
  box.appendChild(panel);
  panel.querySelector('#caseiraoConnectWhatsApp').onclick=connectWhatsApp;
  loadMetaSdk().catch(()=>{});
}

function hook(){
  if(typeof window.renderStoreAdmin==='function'){
    const base=window.renderStoreAdmin;
    window.renderStoreAdmin=function(box){const r=base.apply(this,arguments);installPanel(box);return r;};
  }
  const box=document.querySelector('#admContent');
  if(box&&window.adminTab==='loja')installPanel(box);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook);else hook();
})();
