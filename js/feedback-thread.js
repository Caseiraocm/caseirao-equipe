(() => {
  'use strict';

  const clock = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short'
  });
  let visitor;
  function visitorId() {
    if (visitor) return visitor;
    const key = 'caseirao_feedback_visitor';
    try {
      visitor = localStorage.getItem(key) || crypto.randomUUID();
      localStorage.setItem(key, visitor);
    } catch {
      visitor ||= crypto.randomUUID();
    }
    return visitor;
  }

  function node(tag, text = '', className = '') {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function button(text, action) {
    const element = node('button', text, 'feedbackThreadButton');
    element.type = 'button';
    element.onclick = action;
    return element;
  }

  window.caseiraoReviewThread = function (review, request, team = false) {
    const section = node('details', '', 'feedbackThread');
    const title = node('summary', team ? 'Ver respostas e responder' : 'Curtir ou responder');
    const status = node('p', '', 'feedbackThreadStatus');
    status.setAttribute('role', 'status');
    const list = node('div', '', 'feedbackReplyList');
    const key = { source: review.source, review_id: review.review_id };
    const form = node('form', '', 'feedbackReplyForm');
    form.hidden = true;
    const target = node('p', '');
    const comment = node('textarea');
    comment.rows = 2;
    comment.required = true;
    comment.maxLength = 500;
    comment.placeholder = 'Escreva sua resposta';
    comment.setAttribute('aria-label', 'Resposta');
    const name = node('input');
    name.maxLength = 40;
    name.placeholder = 'Nome ou apelido (opcional)';
    name.setAttribute('aria-label', 'Nome ou apelido');
    const website = node('input', '', 'feedbackThreadTrap');
    website.tabIndex = -1;
    website.autocomplete = 'off';
    website.setAttribute('aria-hidden', 'true');
    const actions = node('div', '', 'feedbackThreadActions');
    const send = node('button', team ? 'Enviar como Equipe Caseirão' : 'Enviar resposta', 'feedbackThreadButton');
    send.type = 'submit';
    const cancel = button('Cancelar', () => { form.hidden = true; });
    form.append(target, comment);
    if (!team) form.append(name, website);
    actions.append(send, cancel);
    form.append(actions);
    let parentId = null;
    let requestId = '';
    let page = 0;
    let loaded = false;
    let liked = false;
    let busy = false;

    function openForm(parent) {
      const nextParent = parent?.id || null;
      if (nextParent !== parentId) requestId = '';
      parentId = nextParent;
      const author = parent?.from_team ? 'Equipe Caseirão' : parent?.public_name || 'Cliente anônimo';
      target.textContent = parent ? 'Respondendo a ' + author : '';
      target.hidden = !parent;
      form.hidden = false;
      comment.focus();
    }

    const controls = node('div', '', 'feedbackThreadActions');
    const like = button('Curtir', async () => {
      const next = !liked;
      like.disabled = true;
      status.textContent = '';
      try {
        updateLikes(await request('like_review', { ...key, visitor_id: visitorId(), liked: next }));
      } catch (error) {
        status.textContent = error.message;
      } finally {
        like.disabled = false;
      }
    });
    like.setAttribute('aria-pressed', 'false');
    if (!team) controls.append(like);
    controls.append(button(team ? 'Responder como equipe' : 'Responder à avaliação', () => openForm(null)));
    controls.hidden = true;
    const more = button('Ver mais respostas', () => load(page));
    more.hidden = true;
    section.append(title, controls, status, list, more, form);

    function updateLikes(result) {
      liked = result.liked;
      like.textContent = (liked ? '♥ Curtido' : '♡ Curtir') + (result.likes ? ' · ' + result.likes : '');
      like.setAttribute('aria-pressed', String(liked));
    }

    function append(reply) {
      const article = node('article', '', 'feedbackReply');
      if (reply.from_team) article.classList.add('feedbackReplyTeam');
      article.append(
        node('strong', reply.from_team ? 'Equipe Caseirão' : reply.public_name || 'Cliente anônimo'),
        node('time', clock.format(new Date(reply.created_at))),
      );
      if (reply.reply_to) article.append(node('small', 'Em resposta a ' + reply.reply_to));
      article.append(node('p', reply.body));
      const replyActions = node('div', '', 'feedbackThreadActions');
      replyActions.append(button('Responder', () => openForm(reply)));
      if (team) {
        const hide = button('Ocultar', async () => {
          hide.disabled = true;
          try {
            await request('admin_hide_reply', { ...key, reply_id: reply.id });
            await load(0, 'Resposta ocultada.');
          } catch (error) {
            status.textContent = error.message;
          } finally {
            hide.disabled = false;
          }
        });
        replyActions.append(hide);
      }
      article.append(replyActions);
      list.append(article);
    }

    async function load(nextPage, message = '') {
      if (busy) return;
      busy = true;
      more.disabled = true;
      status.textContent = 'Carregando respostas…';
      try {
        const result = await request('review_thread', { ...key, page: nextPage, visitor_id: team ? undefined : visitorId() });
        if (nextPage === 0) list.replaceChildren();
        result.replies.forEach(append);
        updateLikes(result);
        page = nextPage + 1;
        more.textContent = 'Ver mais respostas';
        loaded = true;
        controls.hidden = false;
        more.hidden = !result.has_more;
        status.textContent = message || (list.childElementCount ? '' : 'Ainda sem respostas.');
      } catch (error) {
        status.textContent = error.message;
        more.textContent = 'Tentar novamente';
        more.hidden = false;
      } finally {
        busy = false;
        more.disabled = false;
      }
    }

    form.onsubmit = async event => {
      event.preventDefault();
      if (send.disabled || busy) return;
      const body = comment.value.trim();
      if (!body) {
        status.textContent = 'Escreva sua resposta.';
        return;
      }
      send.disabled = true;
      requestId ||= crypto.randomUUID();
      try {
        await request(team ? 'admin_reply' : 'reply_review', {
          ...key, request_id: requestId, parent_id: parentId, comment: body,
          public_name: name.value, website: website.value
        });
        form.reset();
        form.hidden = true;
        requestId = '';
        await load(0, 'Resposta publicada.');
      } catch (error) {
        status.textContent = error.message;
      } finally {
        send.disabled = false;
      }
    };

    section.ontoggle = () => {
      if (section.open && !loaded) load(0);
    };
    return section;
  };
})();
