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
                       // 2 camisetas (59,80), camiseta+gorra (56,80) y cualquier combo;
                       // solo paga envío la prenda suelta barata (camiseta 29,90 / gorra 26,90 /
                       // tote 24,90) y el oversize suelto (44,90), que queda a 4,10 € del umbral.
    flatRate: 4.95,      // coste de envío si no se alcanza
  },

  promo: {               // códigos de descuento (demo — muévelos a backend cuando integres)
    'GZS10':       { type: 'percent', value: 10, label: '-10 %' },
    'ENVIOGRATIS': { type: 'freeship', value: 0, label: 'Envío gratis' },
  },

  /* ------------------------------------------------------------------
     STRIPE — pendiente de integrar.
     1) Crea la cuenta en https://dashboard.stripe.com
     2) Pega aquí la clave publicable (pk_live_… o pk_test_…)
     3) Para cobros reales hace falta un backend (Checkout Session):
        mira el README.md, sección «Integrar Stripe».
     ------------------------------------------------------------------ */
  stripe: {
    enabled: false,
    publishableKey: '',
    // endpoint del backend que crea la sesión de pago (Checkout):
    // p. ej. 'https://tu-proyecto.supabase.co/functions/v1/create-checkout-session'
    checkoutEndpoint: '',
  },

  /* ------------------------------------------------------------------
     SUPABASE — pendiente de integrar (pedidos, newsletter, stock).
     1) Crea el proyecto en https://supabase.com
     2) Pega URL y anon key
     3) Ejecuta el SQL del README (tablas orders / subscribers)
     ------------------------------------------------------------------ */
  supabase: {
    enabled: false,
    url: '',            // 'https://xxxx.supabase.co'
    anonKey: '',        // anon public key
    tables: { orders: 'orders', subscribers: 'subscribers' },
  },

  analytics: {
    // hueco para GA4 / Plausible / Umami si quieres
    provider: '',
    id: '',
  },
};
