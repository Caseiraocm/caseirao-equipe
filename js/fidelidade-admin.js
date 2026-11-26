(() => {
  const pin = () => sessionStorage.getItem('caseirao_admin_pin') || '';
  const call = (endpoint, body) => api(endpoint, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ ...body, pin:pin() }),
  });
  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reader.onabort = () => reject(new Error(
        'Não foi possível ler a foto. Escolha o arquivo novamente pela Galeria ou por Downloads.'
      ));
      reader.readAsDataURL(file);
    });
  }
  async function preparePhoto(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error('Escolha uma foto de até 5 MB.');
    const base64 = await readPhoto(file);
    return { content_type:file.type, base64 };
  }
  async function uploadPhoto(payload) {
    const upload = await call('admin-upload-image', payload);
    return upload.public_url;
  }

  function bindPhotoInput(input, status, showPreview) {
    let pending;
    input.onchange = async () => {
      const file = input.files[0];
      const selection = file ? preparePhoto(file) : null;
      pending = selection;
      showPreview(null);
      status.textContent = selection ? 'Carregando foto…' : '';
      try {
        if (!selection) return;
        const payload = await selection;
        if (pending !== selection) return;
        showPreview(payload.base64);
        if (status.textContent === 'Carregando foto…') status.textContent = '';
      } catch (error) {
        if (pending === selection) status.textContent = error.message;
      }
    };
    return {
      get selection() { return pending; },
      clear() {
        input.value = '';
        input.onchange();
      },
    };
  }

  function bindGiftEditor(box, gifts, products) {
    const list = box.querySelector('[data-gift-list]');
    const form = box.querySelector('[data-gift-form]');
    const add = box.querySelector('[data-add-gift]');
    const title = form.querySelector('h4');
    const img = form.querySelector('img');
    const status = form.querySelector('[role=status]');
    const feedback = box.querySelector('[data-gift-feedback]');
    const fields = form.elements;
    const submit = form.querySelector('[type=submit]');
    const remove = form.querySelector('[data-delete-gift]');
    let id;
    let photo;
    let savedGift;

    const photoInput = bindPhotoInput(fields.photo, status, preview => {
      const url = preview || photo;
      img.hidden = !url;
      if (url) img.src = url;
      else img.removeAttribute('src');
    });

    function edit(gift) {
      if (submit.disabled) return;
      id = gift?.id || crypto.randomUUID();
      savedGift = gift;
      remove.hidden = !gift;
      photo = gift?.photo_url || null;
      form.reset();
      fields.giftProduct.value = gift?.product_id || '';
      if (gift?.product_id && !fields.giftProduct.value) {
        fields.giftProduct.add(new Option('Produto indisponível',gift.product_id));
        fields.giftProduct.value = gift.product_id;
      }
      title.textContent = gift ? 'Editar recompensa' : 'Nova recompensa';
      fields.giftName.value = gift?.name ?? '';
      fields.description.value = gift?.description ?? '';
      fields.goal.value = gift?.goal ?? '';
      fields.stock.value = gift?.stock ?? '';
      fields.active.checked = gift?.active ?? false;
      feedback.textContent = '';
      photoInput.clear();
      form.hidden = false;
      fields.giftName.focus();
    }

    function renderList() {
      list.replaceChildren();
      if (!gifts.length) {
        list.textContent = 'Nenhuma recompensa adicional cadastrada.';
        return;
      }
      for (const gift of gifts) {
        const row = document.createElement('div');
        const name = document.createElement('strong');
        const details = document.createElement('p');
        const button = document.createElement('button');
        name.textContent = gift.name;
        const state = !gift.active ? 'Pausado' : gift.remaining === 0 ? 'Esgotado' : 'Disponível';
        details.textContent = gift.goal + ' pontos · ' + (gift.product_id ? 'No pedido · ' : 'Retirada · ') + gift.remaining + ' em estoque · ' + state;
        button.type = 'button';
        button.className = 'secondary';
        button.textContent = 'Editar';
        button.setAttribute('aria-label', 'Editar ' + gift.name);
        button.onclick = () => edit(gift);
        row.append(name, details, button);
        list.append(row);
      }
    }

    add.onclick = () => edit();
    for (const product of products.filter(product => product.active)) {
      fields.giftProduct.add(new Option(product.name, product.id));
    }
    const photoBase = new URL('/storage/v1/object/public/product-images/products/', FN).href;
    fields.giftProduct.onchange = () => {
      const product = products.find(product => product.id === fields.giftProduct.value);
      if (!product) return;
      fields.giftName.value = product.name;
      const imageUrl = product.image_url;
      photo = imageUrl?.startsWith(photoBase) &&
        /^[a-f0-9-]+\.(jpg|png|webp)$/.test(imageUrl.slice(photoBase.length)) ? imageUrl : null;
      photoInput.clear();
    };
    form.querySelector('[data-remove-photo]').onclick = () => {
      photo = null;
      photoInput.clear();
    };
    form.querySelector('[data-cancel-gift]').onclick = () => {
      if (submit.disabled) return;
      photoInput.clear();
      form.hidden = true;
      add.focus();
    };
    remove.onclick = async () => {
      if (submit.disabled || !savedGift) return;
      const gift = savedGift;
      if (!window.confirm('Apagar “' + gift.name + '”? Ele sairá do catálogo. Os resgates anteriores ficam no histórico.')) return;
      submit.disabled = true;
      fields.editor.disabled = true;
      status.textContent = 'Apagando brinde…';
      try {
        await call('caseirao-fidelidade', { action:'delete-gift', id:gift.id });
        const index = gifts.findIndex(item => item.id === gift.id);
        if (index !== -1) gifts.splice(index, 1);
        savedGift = null;
        photoInput.clear();
        renderList();
        form.hidden = true;
        feedback.textContent = 'Brinde apagado. Você pode cadastrar outro.';
        add.focus();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        fields.editor.disabled = false;
        submit.disabled = false;
      }
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (submit.disabled) return;
      const gift = {
        id, name:fields.giftName.value.trim(), description:fields.description.value.trim(),
        goal:fields.goal.valueAsNumber, stock:fields.stock.valueAsNumber, active:fields.active.checked,
        photo_url:photo, product_id:fields.giftProduct.value || null,
      };
      if (!gift.name) {
        status.textContent = 'Informe o nome do brinde.';
        fields.giftName.focus();
        return;
      }
      submit.disabled = true;
      fields.editor.disabled = true;
      status.textContent = 'Salvando…';
      try {
        const payload = await photoInput.selection;
        if (payload) {
          photo = gift.photo_url = await uploadPhoto(payload);
          photoInput.clear();
          status.textContent = 'Salvando…';
        }
        const { gift:saved } = await call('caseirao-fidelidade', { action:'save-gift', gift });
        const existing = gifts.findIndex(item => item.id === saved.id);
        if (existing === -1) gifts.push(saved);
        else gifts[existing] = saved;
        renderList();
        form.hidden = true;
        feedback.textContent = 'Brinde salvo.';
        add.focus();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        fields.editor.disabled = false;
        submit.disabled = false;
      }
    };
    renderList();
  }

  const claimLabels = { pending:'Aguardando retirada', delivered:'Entregue', cancelled:'Cancelado' };
  const historyLabels = { pedido:'Pedido', resgate:'Resgate no pedido', estorno:'Estorno',
    ajuste:'Ajuste manual', brinde:'Solicitação de brinde', devolucao:'Pontos devolvidos' };
  const pointsLabel = value => value + (value === 1 ? ' ponto' : ' pontos');
  const dateLabel = value => new Date(value).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });

  function secondary(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = label;
    button.onclick = handler;
    return button;
  }

  function bindManagement(box) {
    const clients = box.querySelector('[data-points-clients]');
    const claims = box.querySelector('[data-points-claims]');
    const run = (action, args = {}) => call('caseirao-fidelidade', { action, ...args });
    let walletPanel;
    let selected;

    function paginate(panel, action, render) {
      const list = panel.querySelector('[data-list]');
      const feedback = panel.querySelector('[role=status]');
      const refresh = panel.querySelector('[data-refresh]');
      const pages = panel.querySelector('[data-pages]');
      let offset = 0;
      let revision = 0;
      async function load(next = offset, message = '') {
        const request = ++revision;
        feedback.textContent = 'Carregando…';
        try {
          const result = await run(action, { offset:next });
          if (request !== revision || !panel.isConnected) return;
          offset = next;
          list.replaceChildren(...result.rows.map(render));
          if (!result.rows.length) list.textContent = next ? 'Nenhum registro nesta página.' :
            action === 'wallets' ? 'Ainda não há clientes com movimentação de pontos.' : 'Nenhuma solicitação de brinde.';
          const navigation = [];
          if (offset) navigation.push(secondary('Página anterior', () => load(offset - 25)));
          if (result.more) navigation.push(secondary('Próxima página', () => load(offset + 25)));
          pages.replaceChildren(...navigation);
          feedback.textContent = message;
        } catch (error) {
          if (request === revision) feedback.textContent = error.message;
        }
      }
      refresh.onclick = () => load();
      load();
      return load;
    }

    function showWallet(wallet, summary, message = '') {
      if (selected !== wallet.id || !walletPanel.isConnected) return;
      wallet.balance = summary.balance;
      walletPanel.innerHTML = `
        <h4 data-wallet-name></h4><p data-balance></p>
        <form style="display:grid;gap:10px">
          <fieldset name="fields" style="display:grid;gap:10px">
            <legend>Ajustar saldo</legend>
            <label class="field">Ação<select class="input" name="operation">
              <option value="add">Adicionar pontos</option>
              <option value="subtract">Descontar pontos</option>
              <option value="reset">Zerar saldo</option>
            </select></label>
            <label class="field" data-quantity>Quantidade<input class="input" name="points" type="number" min="1" max="100000" step="1" required></label>
            <label class="field">Motivo<input class="input" name="reason" maxlength="200" required></label>
            <button class="primary" type="submit">Confirmar ajuste</button>
          </fieldset>
        </form>
        <p role="status"></p><h4>Histórico de pontos</h4><ul></ul>`;
      walletPanel.querySelector('[data-wallet-name]').textContent = wallet.name || 'Cliente sem nome';
      walletPanel.querySelector('[data-balance]').textContent = 'Saldo atual · ' + pointsLabel(summary.balance);
      const status = walletPanel.querySelector('[role=status]');
      const list = walletPanel.querySelector('ul');
      status.textContent = message;
      if (!summary.history.length) {
        const empty = document.createElement('li');
        empty.textContent = 'Nenhuma movimentação registrada.';
        list.append(empty);
      }
      for (const entry of summary.history) {
        const item = document.createElement('li');
        const label = historyLabels[entry.kind] || 'Movimentação';
        item.textContent = label + (entry.order_number == null ? '' : ' #' + entry.order_number)
          + ' · ' + (entry.points < 0 ? '−' : '+') + pointsLabel(Math.abs(entry.points))
          + (entry.detail ? ' · ' + entry.detail : '') + (entry.created_at ? ' · ' + dateLabel(entry.created_at) : '');
        if (entry.kind === 'pedido' && entry.points > 0 && entry.order_id) {
          item.append(' ', secondary('Estornar pedido', async event => {
            if (!confirm('Estornar ' + pointsLabel(entry.points) + ' do pedido #' + entry.order_number + '?')) return;
            const button = event.currentTarget;
            button.disabled = true;
            try {
              const result = await run('reverse-credit', { id:wallet.id, order_id:entry.order_id });
              showWallet(wallet, result, 'Pontos do pedido estornados.');
              loadWallets();
            } catch (error) {
              status.textContent = error.message;
            } finally {
              button.disabled = false;
            }
          }));
        }
        list.append(item);
      }
      const form = walletPanel.querySelector('form');
      const fields = form.elements;
      fields.operation.onchange = () => {
        const fixed = fields.operation.value === 'reset';
        form.querySelector('[data-quantity]').hidden = fixed;
        fields.points.disabled = fixed;
      };
      let previous;
      form.onsubmit = async event => {
        event.preventDefault();
        const operation = fields.operation.value;
        const reason = fields.reason.value.trim();
        if (!reason) { status.textContent = 'Informe o motivo do ajuste.'; return; }
        if (operation === 'reset' && !confirm('Zerar o saldo atual desta carteira?')) return;
        const args = { id:wallet.id, operation, reason, points:operation === 'reset' ? 0 : fields.points.valueAsNumber };
        const key = JSON.stringify(args);
        const request_id = previous?.key === key ? previous.id : crypto.randomUUID();
        previous = { key, id:request_id };
        fields.fields.disabled = true;
        status.textContent = 'Salvando…';
        try {
          const result = await run('adjust', { ...args, request_id });
          showWallet(wallet, result, 'Ajuste registrado.');
          loadWallets();
        } catch (error) {
          status.textContent = error.message;
        } finally {
          fields.fields.disabled = false;
        }
      };
    }

    walletPanel = clients.querySelector('[data-wallet]');
    const loadWallets = paginate(clients, 'wallets', wallet => {
      const li = document.createElement('li');
      const name = wallet.name || 'Cliente sem nome';
      li.append(secondary(name + ' · ' + pointsLabel(wallet.balance), async () => {
        selected = wallet.id;
        walletPanel.textContent = 'Carregando carteira de ' + name + '…';
        try {
          showWallet(wallet, await run('wallet', { id:wallet.id }));
        } catch (error) {
          if (selected === wallet.id) walletPanel.textContent = error.message;
        }
      }));
      return li;
    });

    const loadClaims = paginate(claims, 'claims', claim => {
      const li = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = claim.gift_name;
      const info = document.createElement('p');
      info.textContent = (claim.customer_name || 'Cliente sem nome') + ' · ' + claimLabels[claim.status]
        + ' · Código ' + claim.id.slice(0,12).toUpperCase() + ' · ' + dateLabel(claim.created_at);
      li.append(title, info);
      if (claim.status !== 'pending') return li;
      const finish = status => async () => {
        const delivered = status === 'delivered';
        if (!confirm(delivered ? 'Confirmar a entrega deste brinde?' : 'Cancelar e devolver os pontos ao cliente?')) return;
        li.querySelectorAll('button').forEach(button => { button.disabled = true; });
        try {
          await run('finish-claim', { id:claim.id, status });
          await loadClaims(undefined, delivered ? 'Entrega registrada.' : 'Solicitação cancelada e pontos devolvidos.');
          if (!delivered) {
            selected = null;
            walletPanel.replaceChildren();
            loadWallets();
          }
        } catch (error) {
          claims.querySelector('[role=status]').textContent = error.message;
        } finally {
          li.querySelectorAll('button').forEach(button => { button.disabled = false; });
        }
      };
      li.append(secondary('Marcar como entregue', finish('delivered')), ' ',
        secondary('Cancelar solicitação', finish('cancelled')));
      return li;
    });
  }

  window.renderCaseiraoPointsAdmin = async box => {
    box.innerHTML = '<p class="notice" role="status">Carregando Clube Pontos…</p>';
    try {
      const { settings, products, gifts = [] } = await call('caseirao-fidelidade', { action:'admin' });
      if (!box.isConnected) return;
      box.innerHTML = `
        <form style="display:grid;gap:10px;max-width:580px">
          <h3>Configuração da campanha</h3>
          <p>Os pedidos feitos pelo cardápio somam pontos após o pagamento e a conclusão.</p>
          <label><input name="active" type="checkbox"> Campanha ativa</label>
          <label class="field">Valor em produtos para ganhar 1 ponto (R$)<input class="input" name="amount" type="number" min="0.01" max="10000" step="0.01" required></label>
          <label class="field">Brinde do cardápio<select class="input" name="reward"></select></label>
          <button class="secondary" type="button" data-delete-menu-reward hidden>Apagar brinde</button>
          <fieldset data-menu-reward-details style="border:0;padding:0;margin:0;min-width:0">
            <div style="display:grid;gap:10px">
              <label class="field">Pontos para resgatar o brinde<input class="input" name="goal" type="number" min="1" max="100000" step="1" required></label>
              <img width="230" style="max-width:100%;border-radius:12px" alt="Foto do brinde" hidden>
              <label class="field">Trocar foto do brinde<input class="input" name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>
              <button class="secondary" type="button" data-default-photo>Usar a foto do produto</button>
            </div>
          </fieldset>
          <button class="primary" type="submit">Salvar campanha</button>
          <p role="status"></p>
        </form>
        <section style="display:grid;gap:12px;max-width:580px;margin-top:22px">
          <h3>Produtos e brindes adicionais</h3>
          <div data-gift-list style="display:grid;gap:14px"></div>
          <button class="secondary" type="button" data-add-gift>Cadastrar produto ou brinde</button>
          <p data-gift-feedback role="status"></p>
          <form data-gift-form hidden>
            <fieldset name="editor" style="display:grid;gap:10px">
              <legend><h4>Nova recompensa</h4></legend>
              <label class="field" data-gift-product>Forma de resgate<select class="input" name="giftProduct"><option value="">Brinde físico · retirada</option></select></label>
              <label class="field">Nome<input class="input" name="giftName" maxlength="100" required></label>
              <label class="field">Descrição<textarea class="input" name="description" maxlength="500" rows="3"></textarea></label>
              <label class="field">Pontos para resgatar<input class="input" name="goal" type="number" min="1" max="100000" step="1" required></label>
              <label class="field">Estoque total<input class="input" name="stock" type="number" min="0" max="1000000" step="1" required aria-describedby="giftStockHelp"></label>
              <small id="giftStockHelp">Inclua as unidades já resgatadas. Para repor, some as novas unidades ao total.</small>
              <img width="160" style="max-width:100%;border-radius:12px" alt="Foto do brinde" hidden>
              <label class="field">Foto<input class="input" name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>
              <button class="secondary" type="button" data-remove-photo>Remover foto</button>
              <label><input name="active" type="checkbox"> Disponível para resgate</label>
              <button class="primary" type="submit">Salvar brinde</button>
              <button class="secondary" type="button" data-delete-gift hidden>Apagar brinde</button>
              <button class="secondary" type="button" data-cancel-gift>Voltar</button>
              <p role="status"></p>
            </fieldset>
          </form>
        </section>
        <section data-points-clients style="display:grid;gap:10px;max-width:680px;margin:22px 0">
          <h3>Clientes do Clube Pontos</h3>
          <button class="secondary" type="button" data-refresh>Atualizar clientes</button>
          <p role="status"></p>
          <ul data-list style="display:grid;gap:8px;padding-left:20px"></ul>
          <div data-pages></div>
          <section data-wallet></section>
        </section>
        <section data-points-claims style="display:grid;gap:10px;max-width:680px;margin:22px 0">
          <h3>Solicitações de brindes físicos</h3>
          <button class="secondary" type="button" data-refresh>Atualizar solicitações</button>
          <p role="status"></p>
          <ul data-list style="display:grid;gap:10px;padding-left:20px"></ul>
          <div data-pages></div>
        </section>`;
      const form = box.querySelector('form');
      const fields = form.elements;
      const $status = form.querySelector('[role=status]');
      const img = form.querySelector('img');
      const rewardDetails = form.querySelector('[data-menu-reward-details]');
      const save = form.querySelector('[type=submit]');
      const removeReward = form.querySelector('[data-delete-menu-reward]');
      let photo = settings.photo_url;
      let preview;
      function updateImage() {
        const url = preview || photo || products.find(item => item.id === fields.reward.value)?.image_url;
        img.hidden = !url;
        if (url) img.src = url;
        else img.removeAttribute('src');
      }
      fields.active.checked = settings.active;
      fields.amount.value = settings.step_cents / 100;
      fields.goal.value = settings.goal;
      fields.reward.add(new Option('Sem brinde do cardápio', ''));
      for (const product of products) {
        if (product.active || product.id === settings.reward_id) {
          fields.reward.add(new Option(product.name, product.id));
        }
      }
      fields.reward.value = settings.reward_id || '';
      const photoInput = bindPhotoInput(fields.photo, $status, url => {
        preview = url;
        updateImage();
      });
      function updateReward() {
        const hasReward = Boolean(fields.reward.value);
        rewardDetails.hidden = !hasReward;
        rewardDetails.disabled = !hasReward;
        if (!hasReward) photoInput.clear();
        else updateImage();
      }
      fields.reward.onchange = () => {
        photo = fields.reward.value === settings.reward_id ? settings.photo_url : null;
        photoInput.clear();
        updateReward();
      };
      const defaultPhoto = form.querySelector('[data-default-photo]');
      defaultPhoto.onclick = () => {
        photo = null;
        photoInput.clear();
      };
      function menuRewardName() {
        return products.find(product => product.id === settings.reward_id)?.name || 'brinde do cardápio';
      }
      function updateRemoveReward() {
        removeReward.hidden = !settings.reward_id;
        removeReward.textContent = 'Apagar brinde (' + menuRewardName() + ')';
      }
      function setCampaignBusy(busy) {
        save.disabled = busy;
        removeReward.disabled = busy;
        fields.reward.disabled = busy;
        rewardDetails.disabled = busy || !fields.reward.value;
      }
      async function saveCampaign(campaign) {
        await call('caseirao-fidelidade', { action:'save', settings:campaign });
        Object.assign(settings, campaign);
        updateRemoveReward();
      }
      removeReward.onclick = async () => {
        if (!settings.reward_id || save.disabled) return;
        if (!window.confirm('Apagar “' + menuRewardName() + '” dos resgates do Clube Pontos? O produto continua no cardápio para venda.')) return;
        setCampaignBusy(true);
        $status.textContent = 'Apagando brinde…';
        try {
          await saveCampaign({
            active:settings.active, step_cents:settings.step_cents, goal:settings.goal,
            reward_id:null, photo_url:null,
          });
          fields.reward.value = '';
          fields.goal.value = settings.goal;
          photo = null;
          updateReward();
          $status.textContent = 'Brinde apagado do Clube Pontos. Você pode escolher outro produto ou cadastrar um brinde.';
        } catch (error) {
          $status.textContent = error.message;
        } finally {
          setCampaignBusy(false);
          if (!settings.reward_id) fields.reward.focus();
        }
      };
      form.onsubmit = async event => {
        event.preventDefault();
        if (save.disabled) return;
        setCampaignBusy(true);
        $status.textContent = 'Salvando…';
        try {
          const payload = await photoInput.selection;
          if (payload) {
            photo = await uploadPhoto(payload);
            photoInput.clear();
            $status.textContent = 'Salvando…';
          }
          const campaign = {
            active:fields.active.checked, step_cents:Math.round(fields.amount.valueAsNumber * 100),
            goal:fields.reward.value ? fields.goal.valueAsNumber : settings.goal,
            reward_id:fields.reward.value || null, photo_url:fields.reward.value ? photo : null,
          };
          await saveCampaign(campaign);
          if (!fields.reward.value) photo = null;
          $status.textContent = 'Campanha salva.';
        } catch (error) {
          $status.textContent = error.message;
        } finally {
          setCampaignBusy(false);
        }
      };
      updateReward();
      updateRemoveReward();

      bindGiftEditor(box, gifts, products);

      box.prepend(box.querySelector('[data-points-claims]'));
      box.prepend(box.querySelector('[data-points-clients]'));
      bindManagement(box);
    } catch (error) {
      if (box.isConnected) box.querySelector('[role=status]').textContent = error.message;
    }
  };
})();

