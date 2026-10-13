/* ==========================================================================
   GZS WEAR BRANDS — Catálogo: carga de datos y componentes de producto
   Los datos viven en data/products.json (fuente de verdad). Además se
   incrusta data/catalog.js como respaldo para poder abrir el sitio en
   local (file://) sin servidor.
   ========================================================================== */
(function () {
  const { $, $$, money, esc, ICONS, toast } = window.GZS.ui;
  const cart = window.GZS.cart;

  const Catalog = {
    data: null,

    async load() {
      if (this.data) return this.data;
      // 1) respaldo incrustado (funciona en file://)
      if (window.GZS_CATALOG) { this.data = window.GZS_CATALOG; return this.data; }
      // 2) JSON oficial
      const res = await fetch('data/products.json', { cache: 'no-cache' });
      this.data = await res.json();
      return this.data;
    },

    get products() { return (this.data && this.data.products) || []; },
    get categories() { return (this.data && this.data.categories) || []; },
    bySlug(slug) { return this.products.find(p => p.slug === slug); },
    byId(id) { return this.products.find(p => p.id === id); },
    byCat(cat) { return cat && cat !== 'Todo' ? this.products.filter(p => p.cat === cat) : this.products; },

    /* Tarjeta de producto */
    cardHTML(p, opts = {}) {
      const imgA = p.images[0], imgB = p.images[1] || p.images[0];
      const badge = opts.badgeOverride || p.badge;
      return `
      <article class="card reveal ${opts.delay || ''}" data-slug="${p.slug}">
        <a class="card-media" href="product.html?p=${p.slug}" aria-label="${esc(p.name)}">
          <div class="badges">
            ${badge ? `<span class="badge ${badge === 'Nuevo' ? 'badge--clay' : 'badge--ink'}">${esc(badge)}</span>` : ''}
            ${p.badge === 'Best Seller' ? '' : ''}
          </div>
          <img class="a" src="${p.images[0]}" alt="${esc(p.name)}" loading="${opts.eager ? 'eager' : 'lazy'}" width="1000" height="1250">
          <img class="b" src="${imgB}" alt="" aria-hidden="true" loading="lazy" width="1000" height="1250">
        </a>
        <div class="quick-add"><button class="btn btn--wide btn--sm" data-quick="${p.slug}">Añadir rápido ${ICONS.arrow}</button></div>
        <div class="card-body">
          <div>
            <span class="card-cat">${esc(p.cat)}</span>
            <a class="card-name" href="product.html?p=${p.slug}">${esc(p.name)}</a>
          </div>
          <div class="card-price">${money(p.price)}</div>
        </div>
      </article>`;
    },

    /* Añadir rápido: usa la primera talla/color disponible */
    quickAdd(p) {
      const color = (p.colorsUI[0] || {}).name || '';
      const size = p.sizes.length ? p.sizes[Math.min(1, p.sizes.length - 1)] : '';
      cart.add({ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.images[0], color, size }, 1);
      toast('Añadido al carrito', `${p.name} · ${[color, size].filter(Boolean).join(' · ')}`, {
        ms: 4200, action: 'Ver carrito', onAction: () => window.GZS.ui.openDrawer()
      });
    },

    bindGrid(root) {
      root.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', (e) => {
        e.preventDefault();
        const p = this.bySlug(b.dataset.quick); if (p) this.quickAdd(p);
      }));
    },

    renderGrid(root, list, opts = {}) {
      root.innerHTML = list.map((p, i) => this.cardHTML(p, { delay: 'reveal-d' + (i % 4), ...opts })).join('');
      this.bindGrid(root);
      window.GZS.ui.initReveal();
    },
  };

  window.GZS.catalog = Catalog;
})();
