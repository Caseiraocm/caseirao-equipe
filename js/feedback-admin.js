(() => {
  'use strict';

  const labels = { pending:'Aguardando aprovação', published:'Publicada', hidden:'Recusada ou ocultada', private:'Privada' };
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
    filter.value = 'pending';
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
      const fromMenu = review.source === 'menu';
      const origin = fromMenu ? 'Pelo cardápio' : 'Pedido #' + review.order_number;
      const score = fromMenu
        ? 'Nota geral: ' + review.rating + '/5'
        : 'Produtos ' + review.rating_products + '/5 · Qualidade ' + review.rating_quality + '/5 · Atendimento ' + review.rating_service + '/5';
      card.append(
        node('strong', (review.public_name || 'Cliente anônimo') + ' · ' + labels[review.status]),
        node('p', origin + ' · ' + timestamp.format(new Date(review.created_at)) + (review.category ? ' · ' + categories[review.category] : ''), 'mini'),
        node('p', score, 'mini')
      );
      if (review.comment) {
        const comment = node('p', review.comment);
        comment.style.overflowWrap = 'anywhere';
        comment.style.whiteSpace = 'pre-line';
        card.append(comment);
      }

      if (review.allow_public) {
        const actions = document.createElement('div');
        actions.className = 'feedbackAdminActions';
        const options = {
          pending: [['published', 'Publicar', 'Avaliação publicada.'], ['hidden', 'Recusar', 'Avaliação recusada.']],
          published: [['hidden', 'Ocultar do cardápio', 'Avaliação ocultada.']],
          hidden: [['published', 'Publicar', 'Avaliação publicada.']]
        };
        for (const [next, label, message] of options[review.status] || []) {
          const change = node('button', label, 'secondary');
          change.type = 'button';
          change.onclick = async () => {
            for (const button of actions.children) button.disabled = true;
            try {
              await request('admin_moderate', {
                source: review.source,
                review_id: review.review_id,
                order_id: review.order_id,
                status: next
              });
              if (box.isConnected) await load(true, message);
            } catch (error) {
              if (box.isConnected) status.textContent = error.message;
            } finally {
              for (const button of actions.children) button.disabled = false;
            }
          };
          actions.append(change);
        }
        card.append(actions);
      }
      if (review.status === 'published') {
        card.append(window.caseiraoReviewThread(review, request, true));
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
        const result = await request('admin_list', { status:filter.value, page, include_menu:true });
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
