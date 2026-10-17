/* GET /api/health → estado de las integraciones (sin exponer secretos). */
import PRICES from './_prices.mjs';
import { cors, json, stripeConfigured, supabaseConfigured, supabase } from './_lib.mjs';

export default async function handler(req, res) {
  cors(req, res);
  const out = {
    ok: true,
    productos: Object.keys(PRICES.products).length,
    stripe: { configurado: stripeConfigured() },
    supabase: { configurado: supabaseConfigured(), conexion: null, filas_stock: null },
    webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    printify: { configurado: Boolean(process.env.PRINTIFY_TOKEN) },
    site_url: process.env.SITE_URL || null,
  };
  if (stripeConfigured()) {
    try {
      const { stripe } = await import('./_lib.mjs');
      const acc = await stripe('/account');
      out.stripe.cuenta = acc.id;
      out.stripe.pais = acc.country;
      out.stripe.moneda = acc.default_currency;
      out.stripe.cobros_activos = acc.charges_enabled;   // ← lo que falta para vender
      out.stripe.pagos_activos = acc.payouts_enabled;
    } catch (e) { out.stripe.error = e.message; }
  }
  if (supabaseConfigured()) {
    try {
      const rows = await supabase('inventory?select=product_id');
      out.supabase.conexion = 'ok';
      out.supabase.filas_stock = rows.length;
    } catch (e) { out.supabase.conexion = 'error'; out.supabase.error = e.message; }
  }
  return json(res, 200, out);
}
