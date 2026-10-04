(()=>{
'use strict';

const $=s=>document.querySelector(s);

function isStandalone(){
  return !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
}
function syncInstallButton(){
  const b=$('#installBtn'); if(!b)return;
  b.classList.toggle('hide',isStandalone());
}
function productsTop(){
  const p=$('#products'); if(!p)return;
  const cats=$('#cats');
  const stickyOffset=(cats?.offsetHeight||0)+10;
  const y=p.getBoundingClientRect().top+window.scrollY-stickyOffset;
  window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
}
function bindCategoryNavigation(){
  const cats=$('#cats'); if(!cats || cats.dataset.smartNav==='1')return;
  cats.dataset.smartNav='1';
  cats.addEventListener('click',e=>{
    const b=e.target.closest('[data-cat]');
    if(!b)return;
    setTimeout(productsTop,70);
  });
}
function compactTop(){
  const benefits=$('#systemBenefits');
  if(benefits){
    benefits.classList.add('systemBenefitsCompact');
    const btn=benefits.querySelector('.systemBenefitsAction');
    if(btn)btn.textContent=/oferta/i.test(benefits.textContent||'')?'Ver ofertas':'Ver lanches';
  }
}
function enhance(){
  syncInstallButton();
  bindCategoryNavigation();
  compactTop();
}
enhance();
window.addEventListener('appinstalled',syncInstallButton);
window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',syncInstallButton);

const mo=new MutationObserver(()=>enhance());
mo.observe(document.body,{childList:true,subtree:true});
})();
