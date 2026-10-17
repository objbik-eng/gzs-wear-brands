/* POST /api/stripe-webhook — Edge runtime (necesita el cuerpo crudo para verificar la firma).
   Eventos: checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded */

import { crearPedidoBorrador } from './_printify.mjs';

export const config = { runtime: 'edge' };

const STRIPE_API = 'https://api.stripe.com/v1';

/* ---------------- firma ---------------- */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verificarFirma(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  let timestamp = null;
  const firmas = [];
  for (const part of sigHeader.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v;
    if (k === 'v1') firmas.push(v);
  }
  if (!timestamp || !firmas.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`));
  const esperado = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return firmas.some((f) => timingSafeEqual(f, esperado));
}

/* ---------------- supabase ---------------- */
const SB_HEADERS = () => ({
  apikey: process.env.SUPABASE_SECRET,
  Authorization: `Bearer ${process.env.SUPABASE_SECRET}`,
  'Content-Type': 'application/json',
});

async function sb(path, { method = 'GET', body = null, prefer = null } = {}) {
  const headers = SB_HEADERS();
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function stripeGet(path) {
  const r = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Stripe-Version': '2024-06-20' },
  });
  if (!r.ok) throw new Error(`Stripe ${r.status}`);
  return r.json();
}

const cents = (n) => (typeof n === 'number' ? n : 0);

/* ---------------- pedido pagado ---------------- */
async function guardarPedido(session) {
  const items = (session.line_items?.data || []).map((li) => ({
    product_id: li.price?.product?.metadata?.product_id || '',
    name: li.description || li.price?.product?.name || 'Artículo',
    qty: li.quantity,
    color: li.price?.product?.metadata?.color || '',
    size: li.price?.product?.metadata?.size || '',
    unit_price_cents: cents(li.price?.unit_amount) || Math.round(cents(li.amount_total) / Math.max(1, li.quantity)),
  })).filter((i) => i.product_id);
  session._items = items;

  const meta = session.metadata || {};
  const fila = {
    stripe_session_id: session.id,
    stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
    email: session.customer_details?.email || session.customer_email || null,
    customer_name: session.customer_details?.name || meta.cliente || null,
    amount_total_cents: cents(session.amount_total),
    shipping_cents: Number(meta.envio_cents || 0),
    discount_cents: Number(meta.descuento_cents || 0),
    currency: session.currency || 'eur',
    status: session.payment_status === 'paid' ? 'paid' : session.payment_status || 'pending',
    shipping_address: session.shipping_details?.address
      ? { ...session.shipping_details.address, name: session.shipping_details.name }
      : null,
    promo_code: meta.promo || null,
  };

  // ¿existe ya? (idempotencia)
  const existente = await sb(`orders?stripe_session_id=eq.${encodeURIComponent(session.id)}&select=id,status`);
  if (existente?.length) {
    await sb(`orders?id=eq.${existente[0].id}`, {
      method: 'PATCH',
      body: { ...fila },
      prefer: 'return=minimal',
    });
    if (existente[0].status === 'paid') return { duplicado: true };
    const orderId = existente[0].id;
    await insertarItems(orderId, items);
    await descontarStock(items);
    return { id: orderId, actualizado: true };
  }

  const creado = await sb('orders', { method: 'POST', body: fila, prefer: 'return=representation' });
  const orderId = creado[0].id;
  await insertarItems(orderId, items);
  await descontarStock(items);
  return { id: orderId, creado: true };
}

async function insertarItems(orderId, items) {
  if (!items.length) return;
  await sb('order_items', {
    method: 'POST',
    body: items.map((i) => ({ ...i, order_id: orderId })),
    prefer: 'return=minimal',
  });
}

async function descontarStock(items) {
  if (!items.length) return;
  try {
    await sb('rpc/gzs_take_stock', {
      method: 'POST',
      body: { p_items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })) },
    });
  } catch (e) { console.error('stock', e.message); }
}

/* ---------------- handler ---------------- */
export default async function handler(request) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const payload = await request.text();
  const firma = request.headers.get('stripe-signature');
  const ok = await verificarFirma(payload, firma, process.env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response(JSON.stringify({ error: 'Firma no válida' }), { status: 400 });

  let event;
  try { event = JSON.parse(payload); } catch { return new Response('Bad JSON', { status: 400 }); }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const s = event.data.object;
      if (s.payment_status === 'paid' || event.type === 'checkout.session.async_payment_succeeded') {
        const completo = await stripeGet(`/checkout/sessions/${s.id}?expand[]=line_items`);
        const r = await guardarPedido(completo);
        if (r?.id && !r.duplicado) {
          try {
            const pr = await crearPedidoBorrador({
              sessionId: completo.id,
              email: completo.customer_details?.email || completo.customer_email,
              nombre: completo.customer_details?.name || completo.metadata?.cliente,
              telefono: completo.customer_details?.phone || completo.metadata?.telefono,
              direccion: completo.shipping_details?.address || null,
              items: completo._items || [],
            });
            if (pr?.id) {
              await sb(`orders?id=eq.${r.id}`, {
                method: 'PATCH', body: { printify_order_id: pr.id }, prefer: 'return=minimal',
              });
            }
          } catch (e) { console.error('printify', e.message); }
        }
      }
    } else if (event.type === 'charge.refunded') {
      const pi = event.data.object.payment_intent;
      if (pi) await sb(`orders?stripe_payment_intent=eq.${encodeURIComponent(pi)}`, {
        method: 'PATCH', body: { status: 'refunded' }, prefer: 'return=minimal',
      });
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('webhook', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
