/* Helpers compartidos: Stripe (REST), Supabase (REST) y cálculo del carrito.
   Sin dependencias npm: sólo fetch nativo. */

export const STRIPE_API = 'https://api.stripe.com/v1';

export const SITE_URL = process.env.SITE_URL || 'https://gzs-wear-brands.vercel.app';

export const SHIPPING = { freeFromCents: 4900, flatRateCents: 495 };

export const PROMOS = {
  GZS10: { type: 'percent', value: 10, label: '-10 %' },
  ENVIOGRATIS: { type: 'freeship', value: 0, label: 'Envío gratis' },
};

export const ALLOWED_COUNTRIES = ['ES', 'PT', 'FR', 'DE', 'IT', 'NL', 'BE', 'AT', 'IE', 'LU'];

export const MAX_QTY_PER_LINE = 10;

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || null;
  }
}

export const ALLOWED_ORIGINS = [
  'https://gzs-wear-brands.vercel.app',
  'https://gzs-wear-brands-gzs-wear.vercel.app',
  'https://objbik-eng.github.io',
];

/** Añade cabeceras CORS si el origen está en la lista blanca. */
export function cors(req, res) {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET);
}

/* ------------------------------------------------------------------ */
/* Stripe                                                              */
/* ------------------------------------------------------------------ */

/** POST/GET contra la API de Stripe. `params` se serializa como
 *  application/x-www-form-urlencoded (formato que exige Stripe). */
export async function stripe(path, params = null, method = null) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new HttpError(500, 'Stripe no configurado');

  const opts = { method: method || (params ? 'POST' : 'GET') };
  opts.headers = {
    Authorization: `Bearer ${key}`,
    'Stripe-Version': '2024-06-20',
  };
  if (params) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = encodeForm(params);
  }

  const r = await fetch(`${STRIPE_API}${path}`, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `Stripe ${r.status}`;
    throw new HttpError(502, msg, { stripeType: data?.error?.type, code: data?.error?.code });
  }
  return data;
}

/** Serializa objetos anidados al formato de Stripe: a[b][0][c]=valor */
export function encodeForm(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') encodeForm(item, `${key}[${i}]`, out);
        else out.push([`${key}[${i}]`, String(item)]);
      });
    } else if (typeof v === 'object') {
      encodeForm(v, key, out);
    } else {
      out.push([key, String(v)]);
    }
  }
  if (!prefix) return new URLSearchParams(out).toString();
  return out;
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

export async function supabase(path, { method = 'GET', body = null, prefer = null } = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;

  const r = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new HttpError(502, `Supabase ${r.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

/* ------------------------------------------------------------------ */
/* Carrito                                                             */
/* ------------------------------------------------------------------ */

/** Valida líneas del carrito y recalcula TODO en servidor. */
export function computeTotals(rawItems, promoCode, catalog, stockMap = null) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new HttpError(400, 'El carrito está vacío');
  if (rawItems.length > 30) throw new HttpError(400, 'Demasiadas líneas en el carrito');

  const lines = [];
  for (const it of rawItems) {
    const prod = catalog[it?.id];
    if (!prod) throw new HttpError(400, `Producto no disponible: ${String(it?.id).slice(0, 40)}`);
    const qty = Number.isInteger(it.qty) ? it.qty : parseInt(it.qty, 10);
    if (!qty || qty < 1 || qty > MAX_QTY_PER_LINE) throw new HttpError(400, 'Cantidad no válida');
    if (stockMap && Object.prototype.hasOwnProperty.call(stockMap, it.id) && stockMap[it.id] < qty) {
      throw new HttpError(409, `${prod.name}: sólo quedan ${stockMap[it.id]} unidades`);
    }
    const color = typeof it.color === 'string' ? it.color.slice(0, 40) : '';
    const size = typeof it.size === 'string' ? it.size.slice(0, 12) : '';
    lines.push({
      product_id: it.id,
      slug: prod.slug,
      name: prod.name,
      unit_price_cents: prod.price_cents,
      qty,
      color,
      size,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.unit_price_cents * l.qty, 0);
  const code = String(promoCode || '').trim().toUpperCase();
  const promo = PROMOS[code] || null;

  let discount = 0;
  if (promo?.type === 'percent') discount = Math.round(subtotal * promo.value / 100);
  discount = Math.min(discount, subtotal);

  const afterDiscount = subtotal - discount;
  let shipping = afterDiscount >= SHIPPING.freeFromCents ? 0 : SHIPPING.flatRateCents;
  if (promo?.type === 'freeship') shipping = 0;

  return {
    lines, subtotal, discount, shipping,
    total: afterDiscount + shipping,
    promo: promo ? { code, ...promo } : null,
  };
}

/** Mapa id -> stock desde Supabase (null si no está configurado). */
export async function fetchStock() {
  if (!supabaseConfigured()) return null;
  try {
    const rows = await supabase('inventory?select=product_id,stock,active');
    const map = {};
    for (const r of rows) if (r.active) map[r.product_id] = r.stock;
    return map;
  } catch {
    return null; // el stock nunca debe tumbar una venta
  }
}
