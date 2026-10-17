/* ==========================================================================
   GZS WEAR BRANDS — Configuración central
   Aquí se enchufan Stripe y Supabase cuando estén listos.
   ========================================================================== */
window.GZS_CONFIG = {
  brand: {
    name: 'GZS WEAR BRANDS',
    tagline: 'No es solo ropa. Es tu nueva identidad.',
    collection: 'Colección 001',
    email: 'hola@gzswear.gazetastudio.com',      // ← cambia por tu email real
    instagram: 'https://www.instagram.com/',      // ← pon tu @ real
    tiktok: 'https://www.tiktok.com/',
  },

  currency: 'EUR',
  locale: 'es-ES',

  shipping: {
    freeFrom: 49,        // envío gratis a partir de este importe (€)
                       // 49 € está calculado sobre el catálogo: entra 1 sudadera (49,90),
                       // 2 camisetas (59,80), camiseta+gorra (62,80) y cualquier combo;
                       // solo paga envío la prenda suelta barata (camiseta 29,90 / gorro 24,90 / tote 24,90),
                       // la gorra suelta (32,90) y el oversize suelto (44,90), que queda a 4,10 € del umbral.
    flatRate: 4.95,      // coste de envío si no se alcanza
  },

  promo: {               // códigos de descuento (demo — muévelos a backend cuando integres)
    'GZS10':       { type: 'percent', value: 10, label: '-10 %' },
    'ENVIOGRATIS': { type: 'freeship', value: 0, label: 'Envío gratis' },
  },

  /* ------------------------------------------------------------------
     STRIPE — ACTIVO (live).
     La clave publicable es pública por diseño; la secreta vive sólo en
     variables de entorno de Vercel (STRIPE_SECRET_KEY) y nunca en el repo.
     ------------------------------------------------------------------ */
  stripe: {
    enabled: true,
    publishableKey: 'pk_live_51URWGT6Ez3lleHYiWh9ROqrewAictOYYzjrovcFhrcCZBmcDxUkyZxxwKHOUWiUnAk30xxwLvRxuTZK7Dijqo0TO00L6h3yiv4',
    checkoutEndpoint: 'https://gzs-wear-brands.vercel.app/api/checkout',   // función serverless (Vercel) que crea la Checkout Session
    orderEndpoint: 'https://gzs-wear-brands.vercel.app/api/order',         // resumen del pedido para la página de gracias
  },

  /* ------------------------------------------------------------------
     SUPABASE — ACTIVO (pedidos, newsletter y control de stock).
     Los pedidos se escriben desde el servidor con la clave secreta;
     el navegador sólo usa la clave publicable para leer stock.
     ------------------------------------------------------------------ */
  supabase: {
    enabled: true,
    url: 'https://apsqrzhvrlcnkffmaovt.supabase.co',
    anonKey: 'sb_publishable_pD_UQcIoGf7UsvzlbD1LXg_yC7AvtAu',
    newsletterEndpoint: 'https://gzs-wear-brands.vercel.app/api/newsletter',
    tables: { orders: 'orders', subscribers: 'newsletter' },
  },

  analytics: {
    // hueco para GA4 / Plausible / Umami si quieres
    provider: '',
    id: '',
  },
};
