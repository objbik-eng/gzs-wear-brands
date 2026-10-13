/* ==========================================================================
   GZS WEAR BRANDS — Lógica de páginas
   body[data-page]: home | shop | product | cart | checkout | about
   ========================================================================== */
(function () {
  const cfg = window.GZS_CONFIG;
  const { $, $$, money, esc, ICONS, toast, modal } = window.GZS.ui;
  const cart = window.GZS.cart;
  const Cat = window.GZS.catalog;

  const qs = (k) => new URLSearchParams(location.search).get(k);

  /* ======================================================================
     INTEGRACIONES PENDIENTES (Stripe / Supabase)
     ====================================================================== */
  const Backend = {
    /* Supabase: guarda el pedido en la tabla `orders`.
       Cuando configures supabase.url + anonKey, esto ya funciona. */
    async saveOrder(order) {
      if (!cfg.supabase.enabled || !cfg.supabase.url || !cfg.supabase.anonKey) {
        const local = JSON.parse(localStorage.getItem('gzs_orders_demo') || '[]');
        local.push({ ...order, savedAt: new Date().toISOString(), demo: true });
        localStorage.setItem('gzs_orders_demo', JSON.stringify(local));
        return { demo: true };
      }
      const r = await fetch(`${cfg.supabase.url}/rest/v1/${cfg.supabase.tables.orders}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.supabase.anonKey,
          Authorization: `Bearer ${cfg.supabase.anonKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(order),
      });
      if (!r.ok) throw new Error('Supabase: ' + r.status);
      return { ok: true };
    },

    /* Supabase: alta en newsletter (tabla `subscribers`) */
    async subscribe(email) {
      if (!cfg.supabase.enabled || !cfg.supabase.url) {
        const l = JSON.parse(localStorage.getItem('gzs_subs_demo') || '[]');
        if (!l.includes(email)) l.push(email);
        localStorage.setItem('gzs_subs_demo', JSON.stringify(l));
        return { demo: true };
      }
      const r = await fetch(`${cfg.supabase.url}/rest/v1/${cfg.supabase.tables.subscribers}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.supabase.anonKey,
          Authorization: `Bearer ${cfg.supabase.anonKey}`,
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error('Supabase: ' + r.status);
      return { ok: true };
    },

    /* Stripe: crea la sesión de pago en tu backend y redirige.
       Sin clave configurada, muestra el aviso de demo. */
    async pay(order) {
      if (!cfg.stripe.enabled || !cfg.stripe.checkoutEndpoint) {
        modal(`
          <span class="eyebrow">Integración pendiente</span>
          <h3 class="mt-1">Stripe está listo para conectar</h3>
          <p class="muted small">El pedido se ha registrado en local (demo). Para cobrar de verdad:</p>
          <ol class="small" style="margin:14px 0 0 18px;display:grid;gap:8px">
            <li>Abre <code>assets/js/config.js</code>.</li>
            <li>Rellena <code>stripe.publishableKey</code> y <code>stripe.checkoutEndpoint</code>.</li>
            <li>El endpoint debe crear una <em>Checkout Session</em> en Stripe y devolver su URL.</li>
          </ol>
          <p class="mt-3 small muted">Instrucciones completas en el <strong>README.md</strong> del repositorio.</p>`);
        return { demo: true };
      }
      const r = await fetch(cfg.stripe.checkoutEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, items: cart.items, totals: cart.totals() }),
      });
      const j = await r.json();
      if (j.url) { window.location.href = j.url; return { redirect: true }; }
      throw new Error('Stripe: respuesta sin url');
    },
  };

  /* ======================================================================
     HOME
     ====================================================================== */
  async function initHome() {
    const c = await Cat.load();
    document.documentElement.dataset.catalog = 'ready';

    /* destacados: best sellers + novedades */
    const featured = [
      ...c.products.filter(p => p.badge === 'Best Seller').slice(0, 2),
      ...c.products.filter(p => p.badge === 'Nuevo').slice(0, 2),
    ];
    while (featured.length < 4 && c.products.length >= 4) {
      const nxt = c.products.find(p => !featured.includes(p));
      if (!nxt) break; featured.push(nxt);
    }
    const grid = $('#featured-grid');
    if (grid) Cat.renderGrid(grid, featured.slice(0, 4), { eager: true });

    /* contadores por categoría */
    $$('[data-cat-count]').forEach(el => {
      el.textContent = String(c.products.filter(p => p.cat === el.dataset.catCount).length).padStart(2, '0');
    });
    const total = $('#total-pieces'); if (total) total.textContent = String(c.products.length).padStart(2, '0');

    /* última pieza (let's play) en el bloque editorial */
    const story = c.products.find(p => p.slug === 'tee-lets-play') || c.products[0];
    const storyImg = $('#story-img'); if (storyImg && story) storyImg.src = story.images[1] || story.images[0];
    const storyLink = $('#story-link'); if (storyLink && story) storyLink.href = 'product.html?p=' + story.slug;
  }

  /* ======================================================================
     TIENDA
     ====================================================================== */
  async function initShop() {
    const c = await Cat.load();
    const grid = $('#shop-grid');
    const state = {
      cat: qs('cat') || 'Todo',
      sort: 'relevancia',
      q: qs('q') || '',
    };

    /* chips de categoría */
    const chips = $('#cat-chips');
    const cats = ['Todo', ...c.categories];
    chips.innerHTML = cats.map(x => {
      const n = x === 'Todo' ? Cat.products.length : Cat.byCat(x).length;
      return `<button class="chip${x === state.cat ? ' is-on' : ''}" data-cat="${esc(x)}">${esc(x)} <span class="muted" style="font-size:9px">${n}</span></button>`;
    }).join('');
    chips.addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      state.cat = b.dataset.cat;
      $$('.chip', chips).forEach(ch => ch.classList.toggle('is-on', ch === b));
      render();
    });

    const search = $('#shop-search');
    if (search) {
      search.value = state.q;
      search.addEventListener('input', () => { state.q = search.value.trim(); render(); });
      if (qs('focus')) search.focus();
    }
    const sortSel = $('#shop-sort');
    sortSel && sortSel.addEventListener('change', () => { state.sort = sortSel.value; render(); });

    function apply() {
      let list = Cat.byCat(state.cat === 'Todo' ? null : state.cat);
      if (state.q) {
        const q = state.q.toLowerCase();
        list = list.filter(p => (p.name + ' ' + p.cat + ' ' + p.tags.join(' ')).toLowerCase().includes(q));
      }
      if (state.sort === 'precio-asc') list = [...list].sort((a, b) => a.price - b.price);
      if (state.sort === 'precio-desc') list = [...list].sort((a, b) => b.price - a.price);
      if (state.sort === 'novedades') list = [...list].sort((a, b) => (b.badge === 'Nuevo') - (a.badge === 'Nuevo'));
      return list;
    }

    function render() {
      const list = apply();
      const count = $('#shop-count');
      count && (count.textContent = `${list.length} ${list.length === 1 ? 'pieza' : 'piezas'}`);
      grid.innerHTML = '';
      if (!list.length) {
        grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">Nada por aquí.</div>
          <p>Prueba con otra categoría o limpia la búsqueda.</p>
          <button class="btn btn--ghost mt-3" id="clear-filters">Ver todo</button></div>`;
        $('#clear-filters').addEventListener('click', () => { state.cat = 'Todo'; state.q = ''; state.sort = 'relevancia';
          search && (search.value = ''); sortSel && (sortSel.value = 'relevancia');
          $$('.chip', chips).forEach(ch => ch.classList.toggle('is-on', ch.dataset.cat === 'Todo')); render(); });
        return;
      }
      Cat.renderGrid(grid, list, { eager: list.length <= 6 });
    }
    render();
  }

  /* ======================================================================
     PRODUCTO
     ====================================================================== */
  async function initProduct() {
    const c = await Cat.load();
    const slug = qs('p') || c.products[0].slug;
    const p = Cat.bySlug(slug);
    const root = $('#pdp-root');
    if (!p) { root.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">Esa pieza no existe.</div><a class="btn mt-3" href="shop.html">Volver a la tienda</a></div>`; return; }

    document.title = `${p.name} — ${cfg.brand.name}`;
    const crumb = $('#crumb-name'); if (crumb) crumb.textContent = p.name;

    const sel = { color: (p.colorsUI[0] || {}).name || '', size: '' };

    root.innerHTML = `
      <div class="pdp-gallery reveal">
        <div class="pdp-main" id="pdp-main"><img src="${p.images[0]}" alt="${esc(p.name)}" id="pdp-main-img"></div>
        <div class="pdp-thumbs" id="pdp-thumbs">
          ${p.images.map((im, i) => `<button class="pdp-thumb${i === 0 ? ' is-on' : ''}" data-img="${im}" aria-label="Vista ${i + 1}"><img src="${im}" alt="" loading="lazy"></button>`).join('')}
        </div>
      </div>
      <div class="pdp-info reveal reveal-d1">
        <span class="eyebrow">${esc(p.cat)} ${p.badge ? '· <b style="color:var(--clay)">' + esc(p.badge) + '</b>' : ''}</span>
        <h1 class="display">${esc(p.name)}</h1>
        <div class="price-row">
          <span class="p">${money(p.price)}</span>
          ${p.priceMax > p.price ? `<span class="note">hasta ${money(p.priceMax)} según talla</span>` : ''}
        </div>
        <p class="lead">${esc(p.desc)}</p>
        <div class="flex mt-2" style="gap:8px">${p.tags.map(t => `<span class="chip" style="pointer-events:none">${esc(t)}</span>`).join('')}</div>

        ${p.colorsUI.length ? `
        <div class="opt-block">
          <div class="opt-head"><span class="lab">Color</span><span class="val" id="opt-color">${esc(sel.color)}</span></div>
          <div class="swatches">${p.colorsUI.map(cl => `<button class="swatch${cl.name === sel.color ? ' is-on' : ''}" style="background:${cl.hex}" data-color="${esc(cl.name)}" aria-label="${esc(cl.name)}" title="${esc(cl.name)}"></button>`).join('')}</div>
        </div>` : ''}

        ${p.sizes.length ? `
        <div class="opt-block">
          <div class="opt-head"><span class="lab">Talla</span><a class="val" href="envios-devoluciones.html#tallas" style="text-decoration:underline;text-underline-offset:3px">Guía de tallas</a></div>
          <div class="sizes" id="size-list">${p.sizes.map(s => `<button class="size" data-size="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        </div>` : ''}

        <div class="buy-row">
          <div class="qty" aria-label="Cantidad">
            <button id="q-minus" aria-label="Menos">−</button><span id="q-val">1</span><button id="q-plus" aria-label="Más">+</button>
          </div>
          <button class="btn" id="add-to-cart">Añadir al carrito ${ICONS.arrow}</button>
        </div>

        <div class="perks">
          <span class="perk">${ICONS.truck} Envío gratis desde ${money(cfg.shipping.freeFrom)} · entrega 3-6 días</span>
          <span class="perk">${ICONS.leaf} Impreso bajo demanda en la UE (sin sobrestock)</span>
          <span class="perk">${ICONS.shield} Pago seguro · Devoluciones en 30 días</span>
        </div>

        <div class="acc">
          <details open>
            <summary>Detalles y materiales <span class="ind">+</span></summary>
            <div class="body"><ul>${p.feats.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
            <p class="mt-2" style="font-size:13px">Base: ${esc(p.blueprint)} · Taller: ${esc(p.provider)}</p></div>
          </details>
          <details>
            <summary>Envío y devoluciones <span class="ind">+</span></summary>
            <div class="body">
              <p>Producción en 2-4 días laborables + envío en 3-6 días. Envío gratis desde ${money(cfg.shipping.freeFrom)} (si no, ${money(cfg.shipping.flatRate)}).</p>
              <p>30 días de devolución sin preguntas: escríbenos a <a href="mailto:${cfg.brand.email}" style="text-decoration:underline">${cfg.brand.email}</a>.</p>
            </div>
          </details>
          <details>
            <summary>Cuidados <span class="ind">+</span></summary>
            <div class="body"><ul>
              <li>Lavar del revés a 30 °C, programa suave.</li>
              <li>No usar secadora ni lejía.</li>
              <li>Planchar del revés, sin tocar el estampado.</li>
            </ul></div>
          </details>
        </div>
      </div>`;

    /* galería */
    $('#pdp-thumbs').addEventListener('click', e => {
      const b = e.target.closest('[data-img]'); if (!b) return;
      const img = $('#pdp-main-img');
      img.style.opacity = 0;
      setTimeout(() => { img.src = b.dataset.img; img.style.opacity = 1; }, 160);
      $$('.pdp-thumb').forEach(t => t.classList.toggle('is-on', t === b));
    });

    /* color / talla / cantidad */
    $$('.swatch').forEach(s => s.addEventListener('click', () => {
      sel.color = s.dataset.color;
      $$('.swatch').forEach(x => x.classList.toggle('is-on', x === s));
      $('#opt-color').textContent = sel.color;
    }));
    $$('#size-list .size').forEach(s => s.addEventListener('click', () => {
      sel.size = s.dataset.size;
      $$('#size-list .size').forEach(x => x.classList.toggle('is-on', x === s));
    }));
    let q = 1;
    $('#q-minus').addEventListener('click', () => { q = Math.max(1, q - 1); $('#q-val').textContent = q; });
    $('#q-plus').addEventListener('click', () => { q = Math.min(9, q + 1); $('#q-val').textContent = q; });

    $('#add-to-cart').addEventListener('click', () => {
      if (p.sizes.length && !sel.size) { toast('Elige una talla', 'Antes de añadir al carrito', { icon: ICONS.shield }); return; }
      cart.add({ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.images[0], color: sel.color, size: sel.size }, q);
      toast('Añadido al carrito', `${p.name} · ${[sel.color, sel.size].filter(Boolean).join(' · ')} × ${q}`, {
        ms: 4500, action: 'Ver carrito', onAction: () => window.GZS.ui.openDrawer()
      });
      window.GZS.ui.openDrawer();
    });

    /* relacionados */
    const rel = c.products.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
    const relBox = $('#related-grid');
    if (relBox) Cat.renderGrid(relBox, rel.length ? rel : c.products.filter(x => x.id !== p.id).slice(0, 4));

    /* SEO: JSON-LD */
    const ld = {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.desc,
      image: p.images.map(i => new URL(i, location.href).href), brand: { '@type': 'Brand', name: cfg.brand.name },
      offers: { '@type': 'Offer', price: p.price.toFixed(2), priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
    };
    const s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(ld); document.head.appendChild(s);
  }

  /* ======================================================================
     CARRITO (página)
     ====================================================================== */
  function initCart() {
    const box = $('#cart-lines'), sum = $('#cart-summary');
    let promo = sessionStorage.getItem('gzs_promo') || '';

    function render() {
      const items = cart.items;
      if (!items.length) {
        box.innerHTML = `<div class="empty"><div class="big">Tu carrito está vacío.</div><p>Empieza por la Colección 001 — 15 piezas, cero relleno.</p>
          <a class="btn mt-3" href="shop.html">Ir a la tienda ${ICONS.arrow}</a></div>`;
        sum.innerHTML = '';
        return;
      }
      box.innerHTML = items.map((i, idx) => `
        <div class="cart-line">
          <a class="im" href="product.html?p=${i.slug}"><img src="${i.image}" alt="${esc(i.name)}" loading="lazy"></a>
          <div>
            <span class="card-cat">${esc(i.cat || '')}</span>
            <a class="card-name" href="product.html?p=${i.slug}" style="font-size:19px">${esc(i.name)}</a>
            <div class="muted small mt-1">${[i.color, i.size].filter(Boolean).join(' · ') || 'Talla única'}</div>
            <div class="ci-qty mt-2">
              <button data-q="-1" data-i="${idx}">−</button><span>${i.qty}</span><button data-q="1" data-i="${idx}">+</button>
            </div>
            <button class="ci-rm" data-rm="${idx}">Eliminar</button>
          </div>
          <div class="ci-price" style="font-size:15px">${money(i.price * i.qty)}</div>
        </div>`).join('');

      const t = cart.totals(promo);
      sum.innerHTML = `
        <h3 class="display">Resumen</h3>
        <div class="totline"><span>${cart.count()} artículo${cart.count() === 1 ? '' : 's'}</span><span class="v">${money(t.sub)}</span></div>
        ${t.promo ? `<div class="totline"><span>Descuento <b>${esc(t.promo.label)}</b></span><span class="v">−${money(t.discount)}</span></div>` : ''}
        <div class="totline"><span>Envío</span><span class="v">${t.shipping === 0 ? 'Gratis' : money(t.shipping)}</span></div>
        <div class="promo">
          <input id="promo-in" placeholder="Código promocional" value="${esc(promo)}" aria-label="Código promocional">
          <button class="btn btn--ghost btn--sm" id="promo-go">Aplicar</button>
        </div>
        <div class="totline grand"><span class="display" style="font-size:21px">Total</span><span class="v" style="font-size:18px">${money(t.total)}</span></div>
        <a class="btn btn--wide mt-3" href="checkout.html">Tramitar pedido ${ICONS.arrow}</a>
        <a class="btn btn--ghost btn--wide mt-2" href="shop.html">Seguir comprando</a>
        ${t.promo ? '' : `<p class="mono muted center mt-2" style="font-size:9.5px">Prueba <b>GZS10</b> o <b>ENVIOGRATIS</b></p>`}`;

      box.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.i; cart.update(i, cart.items[i].qty + (+b.dataset.q));
      }));
      box.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { cart.remove(+b.dataset.rm); toast('Eliminado del carrito'); }));
      const go = $('#promo-go');
      go && go.addEventListener('click', () => {
        const code = $('#promo-in').value.trim().toUpperCase();
        if (!code) { promo = ''; sessionStorage.removeItem('gzs_promo'); render(); return; }
        if (cfg.promo[code]) { promo = code; sessionStorage.setItem('gzs_promo', code); toast('Código aplicado', cfg.promo[code].label); }
        else { promo = ''; sessionStorage.removeItem('gzs_promo'); toast('Código no válido', 'Prueba GZS10', { icon: ICONS.shield }); }
        render();
      });
    }
    render();
    document.addEventListener('gzs:cart', render);
  }

  /* ======================================================================
     CHECKOUT
     ====================================================================== */
  function initCheckout() {
    const sum = $('#co-summary');
    const form = $('#co-form');
    const promo = sessionStorage.getItem('gzs_promo') || '';

    function renderSummary() {
      const items = cart.items, t = cart.totals(promo);
      if (!items.length) {
        sum.innerHTML = `<h3 class="display">Nada que pagar</h3><p class="muted small mt-1">Tu carrito está vacío.</p>
          <a class="btn btn--wide mt-3" href="shop.html">Ir a la tienda</a>`;
        return;
      }
      sum.innerHTML = `
        <h3 class="display">Tu pedido</h3>
        <div class="mt-2" style="display:grid;gap:12px">
          ${items.map(i => `<div style="display:flex;gap:12px;align-items:center">
            <div class="ci-img" style="width:52px;height:64px"><img src="${i.image}" alt="" loading="lazy"></div>
            <div style="flex:1;min-width:0">
              <div class="small" style="font-weight:500">${esc(i.name)}</div>
              <div class="muted" style="font-size:11.5px">${[i.color, i.size].filter(Boolean).join(' · ')} · ×${i.qty}</div>
            </div>
            <div class="mono" style="font-size:12px">${money(i.price * i.qty)}</div>
          </div>`).join('')}
        </div>
        <hr class="hr mt-3 mb-2">
        <div class="totline"><span>Subtotal</span><span class="v">${money(t.sub)}</span></div>
        ${t.promo ? `<div class="totline"><span>Descuento ${esc(t.promo.label)}</span><span class="v">−${money(t.discount)}</span></div>` : ''}
        <div class="totline"><span>Envío</span><span class="v">${t.shipping === 0 ? 'Gratis' : money(t.shipping)}</span></div>
        <div class="totline grand"><span class="display" style="font-size:20px">Total</span><span class="v" style="font-size:17px">${money(t.total)}</span></div>`;
    }
    renderSummary();
    document.addEventListener('gzs:cart', renderSummary);

    /* método de pago */
    $$('.payopt').forEach(o => o.addEventListener('click', () => {
      $$('.payopt').forEach(x => x.classList.toggle('is-on', x === o));
      o.querySelector('input') && (o.querySelector('input').checked = true);
    }));

    /* validación + envío */
    form && form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!cart.items.length) { toast('Carrito vacío', 'Añade algo antes de pagar', { icon: ICONS.shield }); return; }
      const req = $$('[required]', form);
      let bad = null;
      req.forEach(f => {
        const ok = f.checkValidity();
        f.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok && !bad) bad = f;
      });
      if (bad) { bad.focus(); toast('Faltan datos', 'Revisa los campos marcados', { icon: ICONS.shield }); return; }

      const data = Object.fromEntries(new FormData(form).entries());
      const order = {
        ref: 'GZS-' + Date.now().toString(36).toUpperCase(),
        customer: { name: data.nombre, email: data.email, phone: data.telefono || '' },
        address: { line1: data.direccion, line2: data.direccion2 || '', city: data.ciudad, zip: data.cp, country: data.pais },
        items: cart.items,
        totals: cart.totals(promo),
        promo: promo || null,
        status: 'pending',
      };

      const btn = $('#pay-btn'); btn.disabled = true; btn.innerHTML = 'Procesando…';
      try {
        await Backend.saveOrder(order);
        const r = await Backend.pay(order);
        if (r.redirect) return;
        if (r.demo) {
          toast('Pedido guardado (demo)', order.ref + ' · conecta Stripe para cobrar', { ms: 6000 });
          cart.clear();
          setTimeout(() => { window.location.href = 'index.html'; }, 2200);
        }
      } catch (err) {
        toast('No se pudo completar', String(err.message || err).slice(0, 90), { icon: ICONS.shield });
        btn.disabled = false; btn.innerHTML = 'Pagar ahora ' + ICONS.arrow;
      }
    });
  }

  /* ======================================================================
     NEWSLETTER (en todas las páginas que la tengan)
     ====================================================================== */
  function initNewsletter() {
    $$('form[data-newsletter]').forEach(f => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = f.querySelector('input[type=email]');
      const msg = f.querySelector('.form-msg');
      const email = input.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.className = 'form-msg err'; msg.textContent = 'Ese email no parece válido.'; return; }
      try {
        const r = await Backend.subscribe(email);
        msg.className = 'form-msg ok';
        msg.textContent = r.demo ? '¡Dentro! (demo local — conecta Supabase para guardarlo)' : '¡Dentro! Bienvenido a GZS.';
        input.value = '';
      } catch (err) {
        msg.className = 'form-msg err';
        msg.textContent = 'No se pudo guardar. Inténtalo en un momento.';
      }
    }));
  }

  /* ======================================================================
     ARRANQUE
     ====================================================================== */
  document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body.dataset.page;
    initNewsletter();
    try {
      if (page === 'home') await initHome();
      else if (page === 'shop') await initShop();
      else if (page === 'product') await initProduct();
      else if (page === 'cart') initCart();
      else if (page === 'checkout') initCheckout();
    } catch (err) {
      console.error('[GZS]', err);
    }
  });
})();
