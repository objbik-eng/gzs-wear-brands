// Regenera api/_prices.mjs (fuente de precios del servidor) desde data/products.json
import { readFileSync, writeFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url)));
const products = {};
for (const p of d.products) {
  products[p.id] = {
    slug: p.slug, name: p.name, price_cents: Math.round(p.price * 100),
    cat: p.cat, sizes: p.sizes || [], colors: p.colors || [],
    image: p.images[0].split('?')[0],
  };
}
const src = '/* GENERADO por scripts/sync-precios.mjs desde data/products.json — no editar a mano */\n'
  + 'export default ' + JSON.stringify({ generated_from: 'data/products.json', products }, null, 2) + ';\n';
writeFileSync(new URL('../api/_prices.mjs', import.meta.url), src);
console.log('OK', Object.keys(products).length, 'productos');
