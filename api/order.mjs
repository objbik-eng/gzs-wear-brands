/* GET /api/order?session_id=cs_... → resumen del pedido para la página de gracias. */
import { cors, json, stripe, supabase, supabaseConfigured, HttpError } from './_lib.mjs';

export default async function handler(req, res) {
  cors(req, res);
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' });
  try {
    const id = String(req.query?.session_id || '').trim();
    if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw new HttpError(400, 'Sesión no válida');

    const s = await stripe(`/checkout/sessions/${id}?expand[]=line_items`);
    let fulfillment = {};
    if (supabaseConfigured()) {
      try {
        const rows = await supabase(`orders?stripe_session_id=eq.${encodeURIComponent(id)}&select=fulfillment_status,tracking_info,printify_status`);
        if (rows?.[0]) fulfillment = rows[0];
      } catch { /* el resumen de Stripe sigue disponible si falla la consulta logística */ }
    }
    return json(res, 200, {
      id: s.id,
      status: s.status,
      payment_status: s.payment_status,
      email: s.customer_details?.email || s.customer_email || null,
      name: s.customer_details?.name || s.metadata?.cliente || null,
      amount_total_cents: s.amount_total,
      currency: s.currency,
      created: s.created,
      fulfillment_status: fulfillment.fulfillment_status || null,
      printify_status: fulfillment.printify_status || null,
      tracking_info: Array.isArray(fulfillment.tracking_info) ? fulfillment.tracking_info : [],
      items: (s.line_items?.data || []).map((li) => ({
        name: li.description || li.price?.product?.name,
        qty: li.quantity,
        amount_cents: li.amount_total,
        product_id: li.price?.product?.metadata?.product_id || null,
      })),
      shipping: s.shipping_details?.address
        ? { ...s.shipping_details.address, name: s.shipping_details.name }
        : null,
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 502;
    return json(res, status, { error: err.message });
  }
}
