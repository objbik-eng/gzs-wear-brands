/* ==========================================================================
   GZS WEAR BRANDS — Carrito (localStorage, sin dependencias)
   API:  GZS.cart.add(item) · update(idx, qty) · remove(idx) · clear()
         GZS.cart.items · GZS.cart.count() · GZS.cart.subtotal() · totals()
   Evento global: 'gzs:cart' en document cada vez que cambia.
   ========================================================================== */
(function () {
  const KEY = 'gzs_cart_v1';
  const cfg = window.GZS_CONFIG;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const write = (items) => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('gzs:cart', { detail: items }));
  };

  const cart = {
    get items() { return read(); },

    count() { return read().reduce((n, i) => n + i.qty, 0); },

    subtotal() { return read().reduce((s, i) => s + i.price * i.qty, 0); },

    add(item, qty = 1) {
      const items = read();
      const key = [item.id, item.color || '', item.size || ''].join('|');
      const found = items.find(i => [i.id, i.color || '', i.size || ''].join('|') === key);
      if (found) found.qty = Math.min(99, found.qty + qty);
      else items.push({
        id: item.id, slug: item.slug, name: item.name, price: item.price,
        image: item.image, color: item.color || '', colorRaw: item.colorRaw || item.color || '',
        size: item.size || '', qty
      });
      write(items);
      return items;
    },

    update(idx, qty) {
      const items = read();
      if (!items[idx]) return;
      items[idx].qty = Math.max(1, Math.min(99, qty));
      write(items);
    },

    remove(idx) { const items = read(); items.splice(idx, 1); write(items); },

    clear() { write([]); },

    /* Totales con envío, promo y umbral de envío gratis */
    totals(promoCode) {
      const sub = cart.subtotal();
      const s = cfg.shipping;
      const promo = promoCode && cfg.promo[promoCode.toUpperCase()] ? cfg.promo[promoCode.toUpperCase()] : null;

      let discount = 0;
      let freeShip = sub >= s.freeFrom || sub === 0;
      if (promo) {
        if (promo.type === 'percent') discount = sub * (promo.value / 100);
        if (promo.type === 'freeship') freeShip = true;
      }
      const shipping = (freeShip ? 0 : s.flatRate);
      const total = Math.max(0, sub - discount) + shipping;
      return { sub, discount, shipping, total, freeShip, promo, missingForFree: Math.max(0, s.freeFrom - sub) };
    },
  };

  window.GZS = window.GZS || {};
  window.GZS.cart = cart;
})();
