'use strict';
/* Ponte oficial entre o nucleo do ADM e os modulos visuais carregados abaixo.
   Getters e setters mantem uma unica referencia: quando um modulo aprimora uma
   funcao, todos os botoes e fluxos internos passam a usar a versao aprimorada. */
const exposeCaseirao=(name,getter,setter)=>Object.defineProperty(window,name,{configurable:true,get:getter,set:setter});
exposeCaseirao('renderAdmin',()=>renderAdmin,value=>{renderAdmin=value});
exposeCaseirao('renderAdminTab',()=>renderAdminTab,value=>{renderAdminTab=value});
exposeCaseirao('orderAdminCard',()=>orderAdminCard,value=>{orderAdminCard=value});
exposeCaseirao('adminTab',()=>adminTab,value=>{adminTab=value});
Object.assign(window,{api,customerWhatsAppNumber,esc,$,num,showAppToast});

