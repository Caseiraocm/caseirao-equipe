(function () {
  'use strict';

  const carousel = window.CaseiraoBalcao;
  if (!carousel || typeof renderBannerAdmin !== 'function') return;
  const e = carousel.escape;
  const effects = { slide: 'Deslizar', fade: 'Esmaecer', zoom: 'Zoom suave' };
  const destinations = { menu: 'Cardápio completo', category: 'Categoria', product: 'Produto', promos: 'Promoções' };
  const colors = { petrol: 'Verde-petróleo', terracotta: 'Terracota' };

  function optionList(options, selected) {
    return Object.entries(options).map(([value, label]) =>
      '<option value="' + e(value) + '"' + (value === selected ? ' selected' : '') + '>' + e(label) + '</option>'
    ).join('');
  }

  function checkbox(key, label, checked) {
    return '<label class="balcao-check"><input type="checkbox" name="' + key + '"' + (checked ? ' checked' : '') + '> ' + label + '</label>';
  }

  renderBannerAdmin = function (box) {
    const products = (admin.products || data.products || []).filter(product => product.active !== false);
    const productOptions = Object.fromEntries(products.map(product => [String(product.id), product.name]));
    const categoryOptions = Object.fromEntries(products.map(product => {
      const category = product.category || 'Outros';
      return [category, category];
    }));
    const config = carousel.read(admin.settings || {}, products);
    let layout = 'tablet';
    let row = 0;
    let busy = false;
    let preview;

    function destinationField(slide) {
      const from = slide.target === 'product' ? productOptions : categoryOptions;
      const values = slide.value && !Object.hasOwn(from, slide.value)
        ? { ...from, [slide.value]: 'Destino indisponível' } : from;
      if (!['product', 'category'].includes(slide.target)) return '<span></span>';
      return '<label>' + (slide.target === 'product' ? 'Produto' : 'Categoria') +
        '<select name="value" data-slide><option value="">Selecione</option>' + optionList(values, slide.value) + '</select></label>';
    }

    function render() {
      preview?.dispose();
      const slide = config.slides[row];
      box.innerHTML = `
        <form class="balcao-admin">
          <div class="balcao-admin-head"><h2>Carrossel do cardápio</h2><button type="submit" class="primary">Salvar carrossel</button></div>
          <div class="balcao-admin-grid">
            <section class="balcao-admin-panel">
              <h3>Banners</h3>
              <label>Banner em edição<select data-select-slide ${slide ? '' : 'disabled'}>
                ${config.slides.map((item, index) => '<option value="' + index + '"' + (row === index ? ' selected' : '') + '>' + e(item.text || 'Banner ' + (index + 1)) + (item.enabled ? '' : ' (inativo)') + '</option>').join('')}
              </select></label>
              <div class="balcao-admin-actions">
                <button type="button" data-operation="add">Adicionar banner</button>
                <button type="button" data-operation="up" ${!slide || !row ? 'disabled' : ''}>Subir</button>
                <button type="button" data-operation="down" ${!slide || row >= config.slides.length - 1 ? 'disabled' : ''}>Descer</button>
                <button type="button" data-operation="remove" ${slide ? '' : 'disabled'}>Remover</button>
              </div>
              ${slide ? `
                <div class="balcao-fields">
                  <label>Título<input name="text" data-slide value="${e(slide.text)}" maxlength="120"></label>
                  <label>Texto curto<input name="body" data-slide value="${e(slide.body)}" maxlength="180"></label>
                  <label>Imagem do banner (URL)<input name="image" data-slide value="${e(slide.image)}"></label>
                  <label>Enviar imagem<input type="file" accept="image/jpeg,image/png,image/webp" data-upload></label>
                  <label>Texto do botão<input name="button" data-slide value="${e(slide.button)}" maxlength="40"></label>
                  <label>Cor do banner<select name="color" data-slide>${optionList(colors, slide.color)}</select></label>
                  <label>Destino do botão<select name="target" data-slide>${optionList(destinations, slide.target)}</select></label>
                  <div data-destination>${destinationField(slide)}</div>
                </div>
                ${checkbox('slideEnabled', 'Mostrar este banner', slide.enabled)}
              ` : '<p>Adicione um banner para montar o carrossel.</p>'}
            </section>
            <section class="balcao-admin-panel">
              <h3>Transições</h3>
              ${checkbox('enabled', 'Mostrar carrossel no cardápio', config.enabled)}
              <label>Efeito<select name="effect">${optionList(effects, config.effect)}</select></label>
              <div class="balcao-fields">
                <label>Trocar a cada (segundos)<input name="interval" type="number" min="2" max="60" step="0.1" value="${config.interval / 1000}" required></label>
                <label>Duração do efeito (ms)<input name="duration" type="number" min="100" max="1500" step="1" value="${config.duration}" required></label>
              </div>
              ${checkbox('autoplay', 'Trocar banners automaticamente', config.autoplay)}
              ${checkbox('loop', 'Repetir ao chegar ao fim', config.loop)}
              ${checkbox('pause', 'Pausar troca automática durante a interação', config.pause)}
            </section>
          </div>
          <section class="balcao-admin-panel">
            <div class="balcao-admin-head">
              <h3>Prévia</h3>
              <div class="balcao-admin-actions">
                <button type="button" data-preview-layout="tablet" aria-pressed="${layout === 'tablet'}">Tablet</button>
                <button type="button" data-preview-layout="mobile" aria-pressed="${layout === 'mobile'}">Celular</button>
                <button type="button" data-test>Testar transição</button>
              </div>
            </div>
            <div class="balcao-hero" data-preview aria-label="Prévia dos banners"></div>
            <p data-preview-empty hidden>Ative o carrossel e preencha pelo menos um banner para ver a prévia.</p>
          </section>
          <p class="balcao-admin-message" role="status"></p>
        </form>`;
      const form = box.querySelector('.balcao-admin');
      form.oninput = edit;
      form.onchange = selectOrUpload;
      form.onclick = activate;
      form.onsubmit = save;
      updatePreview();
    }

    function updatePreview(test = false) {
      const root = box.querySelector('[data-preview]');
      if (!root) return;
      preview = carousel.render(root, carousel.normalize(config), { layout, preview: true });
      box.querySelector('[data-preview-empty]').hidden = Boolean(preview);
      if (test) preview?.test();
    }

    function report(message, error = false) {
      const status = box.querySelector('.balcao-admin-message');
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('balcao-error', error);
    }

    function lock(value) {
      busy = value;
      box.querySelectorAll('input, select, button:not([data-hero-cta])').forEach(field => {
        if (value) {
          field.dataset.previousDisabled = String(field.disabled);
          field.disabled = true;
        } else if (field.dataset.previousDisabled != null) {
          field.disabled = field.dataset.previousDisabled === 'true';
          delete field.dataset.previousDisabled;
        }
      });
    }

    function edit(event) {
      const field = event.target;
      if (busy || field.matches('[type=file], [data-select-slide]') || !field.name) return;
      const slide = config.slides[row];
      if (field.matches('[data-slide]') && slide) {
        slide[field.name] = field.value;
        if (field.name === 'target') {
          slide.value = '';
          box.querySelector('[data-destination]').innerHTML = destinationField(slide);
        }
        if (field.name === 'text') box.querySelector('[data-select-slide]').options[row].textContent =
          (slide.text || 'Banner ' + (row + 1)) + (slide.enabled ? '' : ' (inativo)');
      } else if (field.name === 'slideEnabled' && slide) {
        slide.enabled = field.checked;
        box.querySelector('[data-select-slide]').options[row].textContent =
          (slide.text || 'Banner ' + (row + 1)) + (slide.enabled ? '' : ' (inativo)');
      } else {
        config[field.name] = field.type === 'checkbox' ? field.checked : field.value;
        if (field.name === 'interval') config.interval = field.value === '' ? '' : Number(field.value) * 1000;
      }
      updatePreview();
    }

    async function selectOrUpload(event) {
      const field = event.target;
      if (busy) return;
      if (field.matches('[data-select-slide]')) {
        row = Number(field.value);
        render();
      }
      if (!field.matches('[data-upload]') || !field.files[0]) return;
      const file = field.files[0];
      const form = event.currentTarget;
      try {
        lock(true);
        report('Enviando imagem…');
        const base64 = await fileToBase64(file);
        const pin = sessionStorage.getItem('caseirao_admin_pin') || '';
        const result = await api('admin-upload-image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, content_type: file.type, base64 })
        });
        if (!result.public_url) throw new Error('O envio não retornou o endereço da imagem.');
        if (!form.isConnected) return;
        config.slides[row].image = result.public_url;
        box.querySelector('input[name=image]').value = result.public_url;
        report('Imagem enviada. Salve o carrossel para publicar a alteração.');
      } catch (error) {
        report(error.message, true);
      } finally {
        if (form.isConnected) {
          lock(false);
          field.value = '';
          updatePreview();
        }
      }
    }

    function activate(event) {
      const button = event.target.closest('button');
      if (!button || busy) return;
      if (button.matches('[data-preview-layout]')) {
        layout = button.dataset.previewLayout;
        box.querySelectorAll('[data-preview-layout]').forEach(item =>
          item.setAttribute('aria-pressed', String(item === button)));
        updatePreview();
      }
      if (button.matches('[data-test]')) updatePreview(true);
      const operation = button.dataset.operation;
      if (!operation) return;
      if (operation === 'add') {
        config.slides.push(carousel.normalize({ slides: [{ text: '', button: 'Ver cardápio' }] }).slides[0]);
        row = config.slides.length - 1;
      } else if (operation === 'remove') {
        config.slides.splice(row, 1);
        row = Math.max(0, Math.min(row, config.slides.length - 1));
      } else {
        const next = row + (operation === 'up' ? -1 : 1);
        [config.slides[row], config.slides[next]] = [config.slides[next], config.slides[row]];
        row = next;
      }
      render();
    }

    async function save(event) {
      event.preventDefault();
      if (busy) return;
      const invalid = config.slides.findIndex(slide => slide.enabled && slide.button.trim() &&
        ((slide.target === 'product' && !Object.hasOwn(productOptions, slide.value)) ||
         (slide.target === 'category' && !Object.hasOwn(categoryOptions, slide.value))));
      if (invalid >= 0) {
        row = invalid;
        render();
        report('Escolha um destino disponível para o botão deste banner.', true);
        box.querySelector('select[name=value]')?.focus();
        return;
      }
      const form = event.currentTarget;
      let saved = false;
      try {
        lock(true);
        report('Salvando carrossel…');
        const pin = sessionStorage.getItem('caseirao_admin_pin') || '';
        await api('admin-banner', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, payload: carousel.encode(config) })
        });
        saved = true;
        admin = await adminCall('snapshot');
        await catalog();
        if (form.isConnected && adminTab === 'banner') renderAdmin();
        showAppToast('Carrossel do cardápio salvo.', 'ok');
      } catch (error) {
        report(saved ? 'O carrossel foi salvo. Reabra esta aba para atualizar a tela.' : error.message, !saved);
      } finally {
        if (form.isConnected) lock(false);
      }
    }

    render();
  };
})();
