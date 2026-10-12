/* Assinatura dos proprietários no cabeçalho da Central ADM.
   Independente da API de pedidos: alteração exclusivamente visual, salva no navegador. */
(() => {
  'use strict';
  const STORAGE_KEY = 'caseirao_adm_proprietarios_v1';
  const DEFAULTS = { first: 'Romário', second: 'Jeyciane' };

  function readOwners() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved.first === 'string' && typeof saved.second === 'string'
        && saved.first.trim() && saved.second.trim()) {
        return { first: saved.first.trim().slice(0, 25), second: saved.second.trim().slice(0, 25) };
      }
    } catch (_) { /* Usa os nomes padrão quando o armazenamento não está disponível. */ }
    return { ...DEFAULTS };
  }

  const ownerText = ({ first, second }) => `${first.toLocaleUpperCase('pt-BR')} & ${second.toLocaleUpperCase('pt-BR')}`;

  function refreshOwners() {
    const label = ownerText(readOwners());
    document.querySelectorAll('[data-caseirao-owner-names]').forEach(element => { element.textContent = label; });
  }

  function closeEditor(dialog, returnFocus) {
    dialog.remove();
    document.removeEventListener('keydown', dialog._onKeyDown);
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  }

  function openEditor() {
    if (document.querySelector('.cbOwnerOverlay')) return;
    const returnFocus = document.activeElement;
    const owners = readOwners();
    const overlay = document.createElement('div');
    overlay.className = 'cbOwnerOverlay';
    overlay.innerHTML = `
      <section class="cbOwnerDialog" role="dialog" aria-modal="true" aria-labelledby="cbOwnerDialogTitle">
        <button type="button" class="cbOwnerClose" aria-label="Fechar personalização">×</button>
        <span class="cbOwnerDialogTag">✦ CENTRAL CASEIRÃO</span>
        <h2 id="cbOwnerDialogTitle">Personalizar os proprietários</h2>
        <p>Escolha os nomes exibidos em dourado no topo do painel administrativo.</p>
        <form class="cbOwnerForm">
          <label>Primeiro nome<input name="first" type="text" maxlength="25" required autocomplete="off"></label>
          <label>Segundo nome<input name="second" type="text" maxlength="25" required autocomplete="off"></label>
          <div class="cbOwnerPreview"><small>PRÉVIA DO CABEÇALHO</small><strong data-caseirao-owner-names></strong><span>PROPRIETÁRIOS • O CASEIRÃO BURGER</span></div>
          <div class="cbOwnerActions"><button type="button" class="cbOwnerCancel">Cancelar</button><button type="submit" class="cbOwnerSave">Salvar nomes</button></div>
        </form>
        <div class="cbOwnerLocalNote">A personalização fica salva neste navegador e aparelho. Outros aparelhos continuam com os nomes padrão até serem personalizados.</div>
      </section>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector('form');
    form.elements.first.value = owners.first;
    form.elements.second.value = owners.second;
    refreshOwners();
    const cancel = () => closeEditor(overlay, returnFocus);
    overlay.querySelector('.cbOwnerClose').addEventListener('click', cancel);
    overlay.querySelector('.cbOwnerCancel').addEventListener('click', cancel);
    overlay.addEventListener('click', event => { if (event.target === overlay) cancel(); });
    overlay._onKeyDown = event => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } };
    document.addEventListener('keydown', overlay._onKeyDown);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const first = String(form.elements.first.value || '').trim().replace(/\s+/g, ' ').slice(0, 25);
      const second = String(form.elements.second.value || '').trim().replace(/\s+/g, ' ').slice(0, 25);
      if (!first || !second) { alert('Preencha os dois nomes.'); return; }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ first, second }));
      } catch (_) { alert('Não foi possível salvar os nomes neste navegador. Verifique o armazenamento do aparelho.'); return; }
      refreshOwners();
      cancel();
    });
    form.addEventListener('input', () => {
      const first = String(form.elements.first.value || '').trim() || '—';
      const second = String(form.elements.second.value || '').trim() || '—';
      overlay.querySelector('[data-caseirao-owner-names]').textContent = ownerText({ first, second });
    });
    form.elements.first.focus();
  }

  function enhanceHeader() {
    const header = document.querySelector('.proHeader');
    if (!header || header.querySelector('.proOwners')) return;
    const brand = header.querySelector('.proBrand');
    if (!brand) return;
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'proOwners';
    badge.title = 'Personalizar nomes dos proprietários';
    badge.setAttribute('aria-label', 'Personalizar nomes dos proprietários');
    badge.innerHTML = `<span class="proOwnersCrown" aria-hidden="true">✦</span><span class="proOwnersText"><strong data-caseirao-owner-names></strong><small>PROPRIETÁRIOS • O CASEIRÃO BURGER</small></span><span class="proOwnersEdit" aria-hidden="true">✎</span>`;
    brand.after(badge);
    badge.addEventListener('click', openEditor);
    refreshOwners();
  }

  function enhanceSettings() {
    if (typeof adminTab === 'undefined' || adminTab !== 'loja') return;
    const content = document.querySelector('.proAdmin #admContent');
    if (!content || content.querySelector('.cbOwnerSettings')) return;
    const card = document.createElement('section');
    card.className = 'cbOwnerSettings';
    card.innerHTML = `<div class="cbOwnerSettingsTop"><div><span class="cbOwnerSettingsTag">✦ IDENTIDADE DA CENTRAL</span><h2>Assinatura dos proprietários</h2><p>Nomes exibidos no espaço central do cabeçalho preto do ADM.</p></div><button type="button" class="cbOwnerSettingsEdit">✎ Alterar nomes</button></div><div class="cbOwnerSettingsPreview"><strong data-caseirao-owner-names></strong><small>PROPRIETÁRIOS • O CASEIRÃO BURGER</small></div><p class="cbOwnerSettingsNote">Personalização visual salva neste navegador/aparelho. Não altera pedidos, cardápio ou dados da loja.</p>`;
    content.prepend(card);
    card.querySelector('.cbOwnerSettingsEdit').addEventListener('click', openEditor);
    refreshOwners();
  }

  if (typeof renderAdminTab === 'function') {
    const previousTab = renderAdminTab;
    renderAdminTab = function (...args) {
      const result = previousTab.apply(this, args);
      enhanceSettings();
      return result;
    };
  }
  if (typeof renderAdmin === 'function') {
    const previousRender = renderAdmin;
    renderAdmin = function (...args) {
      const result = previousRender.apply(this, args);
      enhanceHeader();
      enhanceSettings();
      return result;
    };
  }
})();
