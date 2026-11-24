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

  function bindGiftEditor(box, gifts) {
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
      title.textContent = gift ? 'Editar brinde' : 'Novo brinde';
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
        list.textContent = 'Nenhum brinde personalizado cadastrado.';
        return;
      }
      for (const gift of gifts) {
        const row = document.createElement('div');
        const name = document.createElement('strong');
        const details = document.createElement('p');
        const button = document.createElement('button');
        name.textContent = gift.name;
        const state = !gift.active ? 'Pausado' : gift.remaining === 0 ? 'Esgotado' : 'Disponível';
        details.textContent = gift.goal + ' pontos · ' + gift.remaining + ' em estoque · ' + state;
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
        photo_url:photo,
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

  window.renderCaseiraoPointsAdmin = async box => {
    box.innerHTML = '<p class="notice" role="status">Carregando a fidelidade…</p>';
    try {
      const { settings, products, gifts = [] } = await call('caseirao-fidelidade', { action:'admin' });
      if (!box.isConnected) return;
      box.innerHTML = `
        <form style="display:grid;gap:10px;max-width:580px">
          <h2>Campanha de pontos</h2>
          <p>Os pedidos feitos pelo cardápio somam pontos após o pagamento e a conclusão.</p>
          <label><input name="active" type="checkbox"> Campanha ativa</label>
          <label class="field">Valor em produtos para ganhar 1 ponto (R$)<input class="input" name="amount" type="number" min="0.01" max="10000" step="0.01" required></label>
          <label class="field">Brinde do cardápio<select class="input" name="reward"></select></label>
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
          <h3>Brindes personalizados</h3>
          <div data-gift-list style="display:grid;gap:14px"></div>
          <button class="secondary" type="button" data-add-gift>Cadastrar brinde</button>
          <p data-gift-feedback role="status"></p>
          <form data-gift-form hidden>
            <fieldset name="editor" style="display:grid;gap:10px">
              <legend><h4>Novo brinde</h4></legend>
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
        <form data-wallet-search style="display:grid;gap:10px;max-width:580px;margin-top:22px">
          <h2>Consultar pontos por WhatsApp</h2>
          <input class="input" name="phone" type="tel" inputmode="tel" required aria-label="WhatsApp com DDD">
          <button class="secondary" type="submit">Consultar histórico</button>
          <div role="status"></div>
        </form>`;
      const form = box.querySelector('form');
      const fields = form.elements;
      const $status = form.querySelector('[role=status]');
      const img = form.querySelector('img');
      const rewardDetails = form.querySelector('[data-menu-reward-details]');
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
      fields.reward.onchange = updateReward;
      const defaultPhoto = form.querySelector('[data-default-photo]');
      defaultPhoto.onclick = () => {
        photo = null;
        photoInput.clear();
      };
      form.onsubmit = async event => {
        event.preventDefault();
        const button = form.querySelector('[type=submit]');
        if (button.disabled) return;
        button.disabled = true;
        fields.reward.disabled = true;
        fields.photo.disabled = true;
        defaultPhoto.disabled = true;
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
          await call('caseirao-fidelidade', { action:'save', settings:campaign });
          settings.goal = campaign.goal;
          if (!fields.reward.value) photo = null;
          $status.textContent = 'Campanha salva.';
        } catch (error) {
          $status.textContent = error.message;
        } finally {
          defaultPhoto.disabled = false;
          fields.photo.disabled = false;
          fields.reward.disabled = false;
          button.disabled = false;
        }
      };
      updateReward();

      bindGiftEditor(box, gifts);

      const lookup = box.querySelector('[data-wallet-search]');
      lookup.onsubmit = async event => {
        event.preventDefault();
        const results = lookup.querySelector('[role=status]');
        results.textContent = 'Consultando…';
        try {
          const { wallets } = await call('caseirao-fidelidade', { action:'lookup', phone:lookup.elements.phone.value });
          if (!wallets.length) { results.textContent = 'Ainda não há pontos nesse WhatsApp.'; return; }
          results.replaceChildren(...wallets.map((wallet, index) => {
            const section = document.createElement('section');
            const heading = document.createElement('h3');
            heading.textContent = (wallets.length > 1 ? 'Carteira ' + (index + 1) + ' · ' : '') + wallet.balance + ' pontos';
            const list = document.createElement('ul');
            for (const item of wallet.history) {
              const row = document.createElement('li');
              row.textContent = (item.kind === 'resgate' ? 'Resgate' : 'Pedido') + ' #' + item.order_number +
                ' · ' + (item.points > 0 ? '+' : '−') + Math.abs(item.points) + ' pontos';
              list.append(row);
            }
            section.append(heading, list);
            return section;
          }));
        } catch (error) {
          results.textContent = error.message;
        }
      };
    } catch (error) {
      if (box.isConnected) box.querySelector('[role=status]').textContent = error.message;
    }
  };
})();
