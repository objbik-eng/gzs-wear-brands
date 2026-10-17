// Regenera api/_printify.mjs (mapa producto web → variante Printify).
// Uso: PRINTIFY_TOKEN=... node scripts/sync-printify.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const TOKEN = process.env.PRINTIFY_TOKEN;
const SHOP_ID = 29311670;
if (!TOKEN) { console.error('Falta PRINTIFY_TOKEN'); process.exit(1); }

const api = (p) => fetch(`https://api.printify.com/v1${p}`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then((r) => r.json());

const shop = await api(`/shops/${SHOP_ID}/products.json?limit=50`);
const titulos = new Map(shop.data.map((p) => [p.id, p.title]));
const catalogo = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url))).products;

const MAP = {};
for (const p of catalogo) {
  // empareja por la parte significativa del slug
  const clave = p.name.toLowerCase().split(' ').slice(0, 2).join(' ');
  const cand = [...titulos].filter(([, t]) => t.toLowerCase().includes(clave));
  if (cand.length !== 1) { console.warn('sin emparejar:', p.slug, cand.length); continue; }
  const [pid] = cand[0];
  const d = await api(`/shops/${SHOP_ID}/products/${pid}.json`);
  const opt = {};
  for (const o of d.options) for (const v of o.values) opt[v.id] = [o.type, v.title];
  const variants = {};
  for (const v of d.variants) {
    if (!v.is_enabled) continue;
    let color = '', size = '';
    for (const id of v.options || []) {
      const [t, val] = opt[id] || [];
      if (t === 'color') color = val; else if (t === 'size') size = val;
    }
    variants[`${color}|${size}`] = v.id;
  }
  MAP[p.id] = { printify_id: pid, slug: p.slug, variants };
}
const cabecera = '/* GENERADO desde la API de Printify (shop 29311670) — mapa producto web → producto/variante Printify. */\n\n';
const cuerpo = JSON.stringify({ SHOP_ID, MAP }, null, 1);
writeFileSync(new URL('../api/_printify.mjs', import.meta.url), cabecera + 'export const SHOP_ID = 29311670;\n\nexport const MAP = ' + JSON.stringify(MAP, null, 1) + ';\n');
console.log('OK', Object.keys(MAP).length, 'productos');
