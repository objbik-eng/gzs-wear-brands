/* ==========================================================================
   GZS WEAR BRANDS — UI global: cabecera, pie, carrito lateral, toasts,
   modales, animaciones de entrada y utilidades.
   ========================================================================== */
(function () {
  const cfg = window.GZS_CONFIG;
  const cart = window.GZS.cart;

  /* ---------------- utilidades ---------------- */
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const money = (n) => new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.currency }).format(n);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  const ICONS = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    arrow: '<svg class="arrow" width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 5h13M10 1l4 4-4 4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 13 4 4L19 7"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 19C5 9 12 5 19 5c0 7-4 14-14 14z"/><path d="M5 19c3-3 6-5 10-7"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/></svg>',
    tt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 4v10.5a4 4 0 1 1-3-3.9"/><path d="M14 6c.5 1.8 2 3 4 3.2"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
  };

  /* ---------------- toasts ---------------- */
  let toastRoot;
  function toast(title, text = '', opts = {}) {
    if (!toastRoot) { toastRoot = document.createElement('div'); toastRoot.className = 'toasts'; document.body.appendChild(toastRoot); }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="ico">${opts.icon || ICONS.check}</span>
      <span class="t"><b>${esc(title)}</b>${text ? esc(text) : ''}</span>
      ${opts.action ? `<button class="undo" data-act="1">${esc(opts.action)}</button>` : ''}`;
    toastRoot.appendChild(el);
    if (opts.action) el.querySelector('.undo').addEventListener('click', () => { opts.onAction && opts.onAction(); el.remove(); });
    setTimeout(() => { el.style.transition = 'opacity .4s, transform .4s'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 420); }, opts.ms || 3400);
  }

  /* ---------------- modal ---------------- */
  function modal(html, onOpen) {
    let root = $('#gzs-modal');
    if (!root) { root = document.createElement('div'); root.id = 'gzs-modal'; root.className = 'modal'; document.body.appendChild(root); }
    root.innerHTML = `<div class="scrim is-on" data-close></div><div class="modal-card" role="dialog" aria-modal="true">${html}<div class="mt-3"><button class="btn btn--ghost btn--wide" data-close>Cerrar</button></div></div>`;
    root.classList.add('is-on');
    root.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', escClose);
    function close() { root.classList.remove('is-on'); document.removeEventListener('keydown', escClose); }
    function escClose(e) { if (e.key === 'Escape') close(); }
    onOpen && onOpen(root);
    return { close };
  }

  /* ---------------- cabecera ---------------- */
  const NAV = [
    ['shop.html', 'Tienda', 'shop'],
    ['index.html#coleccion', 'Colección 001', 'coleccion'],
    ['about.html', 'Marca', 'about'],
    ['shop.html?cat=Accesorios', 'Accesorios', 'acc'],
  ];

  function header(active) {
    return `
    <div class="announce">Envío gratis desde ${cfg.shipping.freeFrom} € · <b>COLECCIÓN 001 — YA DISPONIBLE</b></div>
    <header class="site-header" id="site-header">
      <div class="wrap header-in">
        <a class="brand" href="index.html" aria-label="GZS Wear Brands — inicio">GZS<span class="dot"></span><small>WEAR BRANDS</small></a>
        <nav class="nav" aria-label="Principal">
          ${NAV.map(([href, label, key]) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
        </nav>
        <div class="header-actions">
          <a class="icon-btn" href="shop.html" aria-label="Buscar productos">${ICONS.search}</a>
          <button class="icon-btn" id="cart-open" aria-label="Abrir carrito">${ICONS.bag}<span class="cart-count" id="cart-count">0</span></button>
          <button class="icon-btn burger" id="burger" aria-label="Abrir menú">${ICONS.menu}</button>
        </div>
      </div>
    </header>
    <nav class="mobile-nav" id="mobile-nav" aria-label="Menú móvil">
      <div class="top">
        <a class="brand" href="index.html">GZS<span class="dot"></span><small>WEAR BRANDS</small></a>
        <button class="icon-btn" id="mnav-close" aria-label="Cerrar menú">${ICONS.close}</button>
      </div>
      <div class="mt-4">
        <a class="mlink" href="shop.html">Tienda <span>15 piezas</span></a>
        <a class="mlink" href="index.html#coleccion">Colección 001 <span>01</span></a>
        <a class="mlink" href="about.html">Marca <span>GZS</span></a>
        <a class="mlink" href="cart.html">Carrito <span id="mnav-count">0</span></a>
      </div>
      <div class="mt-4 mono muted">${esc(cfg.brand.email)}</div>
    </nav>`;
  }

  /* ---------------- pie ---------------- */
  function footer() {
    const y = new Date().getFullYear();
    return `
    <footer class="site-footer">
      <div class="wrap">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="brand" style="color:var(--white)" href="index.html">GZS<span class="dot"></span><small style="color:rgba(255,255,255,.5)">WEAR BRANDS</small></a>
            <p>${esc(cfg.brand.tagline)} Streetwear minimal de edición limitada. Series cortas, algodón pesado y piezas hechas para durar.</p>
            <div class="footer-social">
              ${cfg.brand.instagram ? `<a href="${cfg.brand.instagram}" aria-label="Instagram" target="_blank" rel="noopener">${ICONS.ig}</a>` : ''}
              ${cfg.brand.tiktok ? `<a href="${cfg.brand.tiktok}" aria-label="TikTok" target="_blank" rel="noopener">${ICONS.tt}</a>` : ''}
              <a href="mailto:${cfg.brand.email}" aria-label="Email">${ICONS.mail}</a>
            </div>
          </div>
          <div>
            <h4>Tienda</h4>
            <a href="shop.html">Todo</a>
            <a href="shop.html?cat=Camisetas">Camisetas</a>
            <a href="shop.html?cat=Oversize">Oversize</a>
            <a href="shop.html?cat=Sudaderas">Sudaderas</a>
            <a href="shop.html?cat=Accesorios">Accesorios</a>
          </div>
          <div>
            <h4>Ayuda</h4>
            <a href="envios-devoluciones.html">Envíos y devoluciones</a>
            <a href="envios-devoluciones.html#tallas">Guía de tallas</a>
            <a href="aviso-legal.html">Aviso legal</a>
            <a href="privacidad.html">Privacidad</a>
            <a href="cookies.html">Cookies</a>
            <a href="terminos.html">Términos</a>
          </div>
          <div>
            <h4>Contacto</h4>
            <a href="mailto:${cfg.brand.email}">${esc(cfg.brand.email)}</a>
            <a href="about.html">Sobre GZS</a>
            <a href="index.html#newsletter">Newsletter</a>
          </div>
        </div>
        <div class="footer-giant" aria-hidden="true">GZS WEAR</div>
        <div class="footer-bottom">
          <span class="mono">© ${y} ${esc(cfg.brand.name)} · Urban minimal style</span>
          <span class="pays"><span>VISA</span><span>MASTERCARD</span><span>AMEX</span><span>APPLE&nbsp;PAY</span><span>KLARNA</span></span>
          <span class="mono">Envíos a toda la UE</span>
        </div>
      </div>
    </footer>`;
  }

  /* ---------------- carrito lateral ---------------- */
  function drawerShell() {
    const d = document.createElement('div');
    d.innerHTML = `
      <div class="scrim" id="drawer-scrim"></div>
      <aside class="drawer" id="drawer" aria-label="Carrito de compra" aria-hidden="true">
        <div class="drawer-top">
          <h3 class="display">Tu carrito <span class="mono muted" id="drawer-n" style="font-size:11px"></span></h3>
          <button class="icon-btn" id="drawer-close" aria-label="Cerrar carrito">${ICONS.close}</button>
        </div>
        <div class="drawer-items" id="drawer-items"></div>
        <div class="drawer-foot" id="drawer-foot"></div>
      </aside>`;
    document.body.appendChild(d);
  }

  function renderDrawer() {
    const items = cart.items;
    const box = $('#drawer-items'); const foot = $('#drawer-foot');
    if (!box) return;
    $('#drawer-n').textContent = items.length ? `(${cart.count()})` : '';
    document.querySelectorAll('#cart-count').forEach(el => { el.textContent = cart.count(); el.classList.toggle('is-on', cart.count() > 0); });
    const mc = $('#mnav-count'); if (mc) mc.textContent = cart.count();

    if (!items.length) {
      box.innerHTML = `<div class="empty"><div class="big">Vacío, de momento.</div>
        <p>La Colección 001 no se va a comprar sola.</p>
        <a class="btn mt-3" href="shop.html">Ver la colección ${ICONS.arrow}</a></div>`;
      foot.innerHTML = '';
      return;
    }
    box.innerHTML = items.map((i, idx) => `
      <div class="ci">
        <div class="ci-img"><img src="${i.image}" alt="${esc(i.name)}" loading="lazy"></div>
        <div>
          <div class="ci-name">${esc(i.name)}</div>
          <div class="ci-meta">${[i.color, i.size].filter(Boolean).join(' · ') || '—'}</div>
          <div class="ci-qty">
            <button data-q="-1" data-i="${idx}" aria-label="Quitar una unidad">−</button>
            <span>${i.qty}</span>
            <button data-q="1" data-i="${idx}" aria-label="Añadir una unidad">+</button>
          </div>
          <button class="ci-rm" data-rm="${idx}">Eliminar</button>
        </div>
        <div class="ci-price">${money(i.price * i.qty)}</div>
      </div>`).join('');

    const t = cart.totals();
    const pct = Math.min(100, Math.round((t.sub / cfg.shipping.freeFrom) * 100));
    foot.innerHTML = `
      <div class="mono muted" style="display:flex;justify-content:space-between">
        <span>${t.freeShip ? 'Envío gratis desbloqueado ✓' : `Te faltan ${money(t.missingForFree)} para envío gratis`}</span>
        <span>${pct}%</span>
      </div>
      <div class="freebar"><i style="width:${pct}%"></i></div>
      <div class="totline"><span>Subtotal</span><span class="v">${money(t.sub)}</span></div>
      <div class="totline"><span>Envío</span><span class="v">${t.shipping === 0 ? 'Gratis' : money(t.shipping)}</span></div>
      <div class="totline grand"><span class="display" style="font-size:19px">Total</span><span class="v" style="font-size:17px">${money(t.total)}</span></div>
      <a class="btn btn--wide mt-3" href="checkout.html">Tramitar pedido ${ICONS.arrow}</a>
      <button class="btn btn--ghost btn--wide mt-2" data-close-drawer>Seguir comprando</button>
      <p class="mono muted center mt-2" style="font-size:9px">Pago seguro · Preparación 2-4 días · Envío 3-6 días</p>`;

    box.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i; cart.update(i, cart.items[i].qty + (+b.dataset.q));
    }));
    box.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.rm; const it = cart.items[i];
      cart.remove(i);
      toast('Eliminado', it.name, { ms: 4200, action: 'Deshacer', onAction: () => { cart.add(it, it.qty); } });
    }));
    foot.querySelector('[data-close-drawer]').addEventListener('click', () => closeDrawer());
  }

  let lastFocus = null;
  function openDrawer() {
    lastFocus = document.activeElement;
    $('#drawer').classList.add('is-open'); $('#drawer').setAttribute('aria-hidden', 'false');
    $('#drawer-scrim').classList.add('is-on'); document.body.style.overflow = 'hidden';
    $('#drawer-close').focus();
  }
  function closeDrawer() {
    $('#drawer').classList.remove('is-open'); $('#drawer').setAttribute('aria-hidden', 'true');
    $('#drawer-scrim').classList.remove('is-on'); document.body.style.overflow = '';
    lastFocus && lastFocus.focus();
  }

  /* ---------------- animaciones de entrada ---------------- */
  function initReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px' });
    els.forEach(e => io.observe(e));
  }

  /* ---------------- scroll de cabecera ---------------- */
  function initHeaderScroll() {
    const h = $('#site-header'); if (!h) return;
    const on = () => h.classList.toggle('is-stuck', window.scrollY > 8);
    on(); window.addEventListener('scroll', on, { passive: true });
  }

  /* ---------------- API pública ---------------- */
  window.GZS.ui = { $, $$, money, esc, toast, modal, ICONS, renderDrawer, openDrawer, closeDrawer, initReveal, header, footer };

  /* ---------------- arranque común ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const active = document.body.dataset.nav || '';
    const head = $('#site-header-root'); if (head) head.innerHTML = header(active);
    const foot = $('#site-footer-root'); if (foot) foot.innerHTML = footer();
    drawerShell();
    renderDrawer();
    initReveal();
    initHeaderScroll();

    $('#cart-open') && $('#cart-open').addEventListener('click', openDrawer);
    $('#drawer-close') && $('#drawer-close').addEventListener('click', closeDrawer);
    $('#drawer-scrim') && $('#drawer-scrim').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

    const burger = $('#burger'), mnav = $('#mobile-nav');
    burger && burger.addEventListener('click', () => { mnav.classList.add('is-open'); document.body.style.overflow = 'hidden'; });
    $('#mnav-close') && $('#mnav-close').addEventListener('click', () => { mnav.classList.remove('is-open'); document.body.style.overflow = ''; });
    $$('#mobile-nav .mlink').forEach(a => a.addEventListener('click', () => { mnav.classList.remove('is-open'); document.body.style.overflow = ''; }));

    document.addEventListener('gzs:cart', renderDrawer);
    window.addEventListener('storage', (e) => { if (e.key === 'gzs_cart_v1') renderDrawer(); });
  });
})();
