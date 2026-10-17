/* POST /api/checkout
   Crea una Checkout Session de Stripe con los precios recalculados en servidor.
   Body: { items:[{id,qty,color,size}], promo, customer:{email,name,phone} }
   Respuesta: { url, total_cents, ... }  → el navegador redirige a url. */

import PRICES from './_prices.mjs';
import {
  cors, json, stripe, computeTotals, fetchStock, supabaseConfigured,
  SITE_URL, ALLOWED_COUNTRIES, HttpError,
} from './_lib.mjs';

const CATALOG = PRICES.products;

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { items, promo, customer = {} } = body;

    const email = String(customer.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Email no válido');
    const name = String(customer.name || '').trim().slice(0, 120);
    if (name.length < 2) throw new HttpError(400, 'Falta el nombre');
    if (body.consent !== true) throw new HttpError(400, 'Hay que aceptar los términos');

    const stock = supabaseConfigured() ? await fetchStock() : null;
    const t = computeTotals(items, promo, CATALOG, stock);

    /* --- líneas de Stripe (precio siempre del servidor) --- */
    const lineItems = t.lines.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: 'eur',
        unit_amount: l.unit_price_cents,
        product_data: {
          name: l.name,
          description: [l.color, l.size].filter(Boolean).join(' · ') || undefined,
          metadata: { product_id: l.product_id, slug: l.slug },
        },
      },
    }));

    const params = {
      mode: 'payment',
      locale: 'es',
      customer_email: email,
      client_reference_id: `GZS-${Date.now().toString(36).toUpperCase()}`,
      line_items: lineItems,
      success_url: `${SITE_URL}/pedido.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/checkout.html?cancelado=1`,
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: t.shipping, currency: 'eur' },
          display_name: t.shipping === 0 ? 'Envío gratis (2-4 + 3-6 días laborables)' : 'Envío estándar (2-4 + 3-6 días laborables)',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 5 },
            maximum: { unit: 'business_day', value: 10 },
          },
        },
      }],
      metadata: {
        origen: 'web',
        promo: t.promo?.code || '',
        cliente: name,
        telefono: String(customer.phone || '').slice(0, 30),
        subtotal_cents: String(t.subtotal),
        descuento_cents: String(t.discount),
        envio_cents: String(t.shipping),
      },
      payment_intent_data: {
        description: 'GZS WEAR BRANDS — Colección 001',
        metadata: { origen: 'web', promo: t.promo?.code || '' },
      },
    };

    /* --- descuento como cupón de importe fijo (no toca el envío) --- */
    if (t.discount > 0) {
      const coupon = await stripe('/coupons', {
        amount_off: t.discount,
        currency: 'eur',
        duration: 'once',
        name: `${t.promo.code} · GZS WEAR`,
        metadata: { promo: t.promo.code, order_ref: params.client_reference_id },
      });
      params.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe('/checkout/sessions', params);

    /* --- registro "pendiente" para no perder el pedido si falla el webhook --- */
    if (supabaseConfigured()) {
      try {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
          method: 'POST',
          headers: {
            apikey: process.env.SUPABASE_SECRET,
            Authorization: `Bearer ${process.env.SUPABASE_SECRET}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=ignore-duplicates,return=minimal',
          },
          body: JSON.stringify({
            stripe_session_id: session.id,
            email,
            customer_name: name,
            amount_total_cents: t.total,
            shipping_cents: t.shipping,
            discount_cents: t.discount,
            currency: 'eur',
            status: 'pending',
            promo_code: t.promo?.code || null,
          }),
        });
      } catch { /* no bloquea el pago */ }
    }

    return json(res, 200, {
      url: session.url,
      session_id: session.id,
      subtotal_cents: t.subtotal,
      discount_cents: t.discount,
      shipping_cents: t.shipping,
      total_cents: t.total,
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (!(err instanceof HttpError)) console.error('checkout error', err);
    return json(res, status, { error: err.message || 'Error creando el pago', ...(err.extra || {}) });
  }
}
