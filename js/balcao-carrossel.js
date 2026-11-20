(function () {
  'use strict';

  const prefix = '__CASEIRAO_SLIDES__';
  const defaults = { enabled: true, effect: 'slide', interval: 5000, duration: 450, autoplay: true, loop: true, pause: true };
  const instances = new WeakMap();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  function imageUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), document.baseURI);
      if (['http:', 'https:'].includes(url.protocol)) return url.href;
    } catch { /* Ignore invalid image URLs. */ }
    return '';
  }

  function number(value, fallback, min, max) {
    return value === '' || value == null || !Number.isFinite(Number(value))
      ? fallback : Math.min(max, Math.max(min, Math.round(Number(value))));
  }

  function normalize(config) {
    return {
      enabled: config.enabled !== false,
      effect: ['slide', 'fade', 'zoom'].includes(config.effect) ? config.effect : defaults.effect,
      interval: number(config.interval, defaults.interval, 2000, 60000),
      duration: number(config.duration, defaults.duration, 100, 1500),
      autoplay: config.autoplay !== false,
      loop: config.loop !== false,
      pause: config.pause !== false,
      slides: (config.slides || []).map(slide => ({
        enabled: slide.enabled !== false,
        image: String(slide.image || ''),
        text: String(slide.text || ''),
        body: String(slide.body || ''),
        button: String(slide.button ?? 'Ver cardápio'),
        target: ['menu', 'category', 'product', 'promos'].includes(slide.target) ? slide.target : 'menu',
        value: String(slide.value || ''),
        color: slide.color === 'terracotta' ? 'terracotta' : 'petrol'
      }))
    };
  }

  function suggestions(products) {
    const active = products.filter(item => item.active !== false);
    const burger = active.find(item => /hamb[uú]rguer/i.test(item.category || '') && item.image_url);
    const combo = active.find(item => /combos?/i.test(item.category || '') && item.image_url)
      || active.find(item => /combos?/i.test(item.category || ''));
    return [
      { text: 'Seu próximo burger.', button: 'Ver cardápio', image: burger?.image_url || '' },
      ...(combo ? [{ text: 'Combos do Caseirão', body: 'Seus burgers favoritos em combos especiais.', button: 'Ver combos',
        image: combo.image_url || '', target: 'category', value: combo.category, color: 'terracotta' }] : [])
    ];
  }

  function read(settings, products = []) {
    const raw = String(settings.banner_text || '');
    let slides = [];
    if (raw.startsWith(prefix)) {
      try {
        const parsed = JSON.parse(raw.slice(prefix.length).trim());
        if (Array.isArray(parsed)) slides = parsed.filter(slide => slide && typeof slide === 'object');
      } catch { /* Keep the plain image fallback for malformed legacy data. */ }
    }
    if (slides[0]?.balcao) {
      const config = slides[0].balcao;
      return normalize({ ...config, enabled: settings.banner_active !== false, slides: config.empty ? [] : slides });
    }
    if (!slides.length && (settings.banner_image_url || (raw && !raw.startsWith(prefix)))) {
      slides.push({ image: settings.banner_image_url, text: raw.startsWith(prefix) ? '' : raw });
    }
    if (!slides.length) return normalize({ ...defaults, slides: suggestions(products) });
    return normalize({ enabled: settings.banner_active !== false, slides });
  }

  function encode(config) {
    const { slides, ...options } = normalize(config);
    const entries = slides.length ? slides.map(slide => ({ ...slide })) : [{ image: '', text: '' }];
    entries[0].balcao = { ...options, empty: slides.length === 0 };
    return {
      banner_active: options.enabled,
      banner_text: prefix + JSON.stringify(entries),
      banner_image_url: slides.find(slide => slide.enabled && slide.image)?.image || ''
    };
  }

  function render(root, config, options = {}) {
    if (!root) return;
    const signature = JSON.stringify([config, options.layout, options.preview]);
    const existing = instances.get(root);
    if (existing?.signature === signature) return existing;
    existing?.dispose();
    root.replaceChildren();
    const slides = config.slides.filter(slide => slide.enabled && (slide.image || slide.text || slide.body));
    root.hidden = !config.enabled || !slides.length;
    if (root.hidden) return;

    const controller = new AbortController();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listen = (element, event, handler) => element.addEventListener(event, handler, { signal: controller.signal });
    root.dataset.layout = options.layout || 'auto';
    root.style.setProperty('--balcao-duration', config.duration + 'ms');
    root.classList.toggle('balcao-hero-single', slides.length === 1);
    root.innerHTML = '<div class="balcao-hero-window"><div class="balcao-hero-track"></div></div>';
    const track = root.querySelector('.balcao-hero-track');
    if (slides.length > 1) {
      root.insertAdjacentHTML('beforeend', '<button type="button" class="balcao-hero-prev" aria-label="Banner anterior">‹</button><button type="button" class="balcao-hero-next" aria-label="Próximo banner">›</button><div class="balcao-hero-dots">' + slides.map((_, index) =>
        '<button type="button" aria-label="Mostrar banner ' + (index + 1) + '" data-slide-index="' + index + '"><span></span></button>'
      ).join('') + '</div>');
    }
    const previous = root.querySelector('.balcao-hero-prev');
    const next = root.querySelector('.balcao-hero-next');
    const dots = [...root.querySelectorAll('[data-slide-index]')];
    let index = 0;
    let timer;
    let hovering = false;
    let focused = false;
    let start;

    function paint(direction = 0) {
      const following = index === slides.length - 1 ? (config.loop ? 0 : -1) : index + 1;
      track.className = 'balcao-hero-track';
      track.classList.toggle('balcao-hero-last', following < 0);
      track.innerHTML = [...new Set([index, following])].filter(position => position >= 0).map(position => {
        const slide = slides[position];
        const image = imageUrl(slide.image);
        return '<article class="balcao-hero-slide balcao-hero-' + slide.color + (slide.text || slide.body ? '' : ' balcao-hero-image-only') + '">' +
          (image ? '<img src="' + escape(image) + '" alt="" decoding="async">' : '') +
          '<div class="balcao-hero-copy">' +
          (slide.text ? '<h2>' + escape(slide.text) + '</h2>' : '') +
          (slide.body ? '<p>' + escape(slide.body) + '</p>' : '') +
          (slide.button ? '<button type="button" data-hero-cta="' + position + '"' + (options.preview ? ' disabled' : '') + '>' +
          escape(slide.button) + ' <span aria-hidden="true">↓</span></button>' : '') + '</div></article>';
      }).join('');
      if (direction) {
        void track.offsetWidth;
        track.classList.add('balcao-effect-' + config.effect);
        track.classList.toggle('balcao-reverse', direction < 0);
      }
      dots.forEach((dot, position) => dot.setAttribute('aria-current', String(position === index)));
      if (previous) previous.disabled = !config.loop && index === 0;
      if (next) next.disabled = !config.loop && index === slides.length - 1;
    }

    function schedule() {
      clearTimeout(timer);
      if (options.preview || !config.autoplay || motion.matches || slides.length < 2 ||
          (config.pause && (hovering || focused || start)) || (!config.loop && index === slides.length - 1)) return;
      timer = setTimeout(() => {
        if (root.isConnected) move(index + 1);
      }, config.interval);
    }

    function move(position) {
      if (!config.loop && (position < 0 || position >= slides.length)) return;
      const normalized = (position + slides.length) % slides.length;
      if (normalized !== index) {
        const direction = position > index ? 1 : -1;
        index = normalized;
        paint(direction);
      }
      schedule();
    }

    listen(root, 'click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target === previous) move(index - 1);
      if (target === next) move(index + 1);
      if (target.dataset.slideIndex != null) move(Number(target.dataset.slideIndex));
      if (target.dataset.heroCta != null) options.onAction?.(slides[Number(target.dataset.heroCta)]);
    });
    listen(root, 'keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      if (slides.length < 2) return;
      event.preventDefault();
      move(index + (event.key === 'ArrowRight' ? 1 : -1));
    });
    listen(root, 'mouseenter', () => { hovering = true; schedule(); });
    listen(root, 'mouseleave', () => { hovering = false; schedule(); });
    listen(root, 'focusin', () => { focused = true; schedule(); });
    listen(root, 'focusout', event => { focused = root.contains(event.relatedTarget); schedule(); });
    listen(track, 'touchstart', event => {
      start = event.touches.length === 1 ? event.touches[0] : undefined;
      schedule();
    });
    listen(track, 'touchend', event => {
      if (start) {
        const touch = event.changedTouches[0];
        const distance = touch.clientX - start.clientX;
        if (Math.abs(distance) > 38 && Math.abs(distance) > Math.abs(touch.clientY - start.clientY)) {
          move(index + (distance < 0 ? 1 : -1));
        }
      }
      start = undefined;
      schedule();
    });
    listen(track, 'touchcancel', () => { start = undefined; schedule(); });
    listen(motion, 'change', schedule);
    paint();
    schedule();
    const instance = {
      signature,
      test() {
        if (slides.length === 1) paint(1);
        else if (!config.loop && index === slides.length - 1) move(0);
        else move(index + 1);
      },
      dispose() {
        controller.abort();
        clearTimeout(timer);
        instances.delete(root);
      }
    };
    instances.set(root, instance);
    return instance;
  }

  window.CaseiraoBalcao = { defaults, escape, imageUrl, normalize, read, encode, render };
})();
