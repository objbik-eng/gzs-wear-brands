/* POST /api/newsletter  { email } → alta en la tabla newsletter (idempotente). */
import { cors, json, supabase, supabaseConfigured, HttpError } from './_lib.mjs';

export default async function handler(req, res) {
  cors(req, res);
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) {
      throw new HttpError(400, 'Email no válido');
    }
    if (!supabaseConfigured()) throw new HttpError(503, 'Base de datos no configurada');
    await supabase('newsletter?on_conflict=email', {
      method: 'POST',
      body: { email, source: 'web' },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    });
    return json(res, 200, { ok: true });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return json(res, status, { error: err.message });
  }
}
