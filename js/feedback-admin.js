(() => {
  'use strict';

  const labels = { pending:'Aguardando aprovação', published:'Publicada', hidden:'Ocultada', private:'Privada' };
  const categories = { elogio:'Elogio', sugestao:'Sugestão', problema:'Problema' };
  const timestamp = new Intl.DateTimeFormat('pt-BR', {
    timeZone:'America/Fortaleza', dateStyle:'short', timeStyle:'short'
  });

  function node(tag, content, className = '') {
    const element = document.createElement(tag);
    element.textContent = content;
    if (className) element.className = className;
    return element;
  }

  function request(action, values) {
    const pin = sessionStorage.getItem('caseirao_admin_pin') || '';
    return api('caseirao-feedback', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ action, pin, ...values })
    });
  }

  window.renderCaseiraoFeedbackAdmin = function (box) {
    const filter = document.createElement('select');
    filter.className = 'sel';
    filter.setAttribute('aria-label', 'Filtrar avaliações');
    for (const [value, label] of Object.entries({ all:'Todas', ...labels })) {
      filter.append(new Option(label, value));
    }
    const status = node('p', '', 'mini');
    status.setAttribute('role', 'status');
    const list = document.createElement('div');
    const more = node('button', 'Ver mais avaliações', 'secondary');
    more.type = 'button';
    more.hidden = true;
    box.replaceChildren(filter, status, list, more);
    let page = 0;
    let requestId = 0;

    function appendReview(review) {
      const card = node('article', '', 'storeControl');
      card.append(
        node('strong', 'Pedido #' + review.order_number + ' · ' + labels[review.status]),
        node('p', timestamp.format(new Date(review.created_at)) + (review.category ? ' · ' + categories[review.category] : ''), 'mini'),
        node('p', 'Produtos ' + review.rating_products + '/5 · Qualidade ' + review.rating_quality + '/5 · Atendimento ' + review.rating_service + '/5')
      );
      if (review.comment) {
        const comment = node('p', review.comment);
        comment.style.overflowWrap = 'anywhere';
        card.append(comment);
      }
      if (review.allow_public) {
        const next = review.status === 'published' ? 'hidden' : 'published';
        const change = node('button', next === 'published' ? 'Publicar no cardápio' : 'Ocultar do cardápio', 'secondary');
        change.type = 'button';
        change.onclick = async () => {
          change.disabled = true;
          try {
            await request('admin_moderate', { order_id:review.order_id, status:next });
            if (!box.isConnected) return;
            await load(true, next === 'published' ? 'Avaliação publicada.' : 'Avaliação ocultada.');
          } catch (error) {
            if (box.isConnected) status.textContent = error.message;
          } finally {
            change.disabled = false;
          }
        };
        card.append(change);
      }
      list.append(card);
    }

    async function load(reset, message = '') {
      const current = ++requestId;
      if (reset) {
        page = 0;
        list.replaceChildren();
      }
      status.textContent = 'Carregando avaliações…';
      more.hidden = true;
      try {
        const result = await request('admin_list', { status:filter.value, page });
        if (current !== requestId || !box.isConnected) return;
        result.feedback.forEach(appendReview);
        page++;
        status.textContent = message || (list.childElementCount ? '' : 'Nenhuma avaliação neste filtro.');
        more.hidden = !result.has_more;
        more.textContent = 'Ver mais avaliações';
      } catch (error) {
        if (current !== requestId || !box.isConnected) return;
        status.textContent = error.message;
        more.hidden = false;
        more.textContent = 'Tentar novamente';
      }
    }

    filter.onchange = () => load(true);
    more.onclick = () => load(false);
    load(true);
  };
})();
