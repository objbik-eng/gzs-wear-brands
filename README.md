# GZS WEAR BRANDS — Ecommerce

Tienda online **estática, sin dependencias y lista para producción** de la marca GZS WEAR BRANDS
(Colección 001: 15 piezas). Carrito completo, checkout, panel de pedidos local y puntos de
integración preparados para **Stripe** y **Supabase**.

🔗 **Web en vivo:** https://objbik-eng.github.io/gzs-wear-brands/

---

## ✨ Qué incluye

| Módulo | Estado |
|---|---|
| Catálogo (15 productos, 59 imágenes optimizadas a WebP) | ✅ |
| Carrito (localStorage, persistente, con cantidades y borrado + deshacer) | ✅ |
| Carrito lateral (drawer) con barra de **envío gratis** | ✅ |
| Checkout con validación + resumen del pedido | ✅ |
| Códigos promocionales (`GZS10`, `ENVIOGRATIS`) | ✅ |
| Newsletter (apunta a Supabase cuando lo conectes) | ✅ |
| Buscador y filtros por categoría + ordenación | ✅ |
| Página de producto con galería, colores, tallas y JSON-LD (SEO) | ✅ |
| Responsive completo (móvil, tablet, escritorio) | ✅ |
| Legales (aviso legal, privacidad, cookies, términos, envíos) | ✅ |
| Sitemap, robots.txt, 404 personalizada, Open Graph | ✅ |
| **Stripe (pagos reales)** | 🔌 pendiente de claves |
| **Supabase (pedidos y suscriptores en la nube)** | 🔌 pendiente de claves |

**Stack:** HTML + CSS + JavaScript vanilla. Cero frameworks, cero build, cero CDN:
funciona abriendo `index.html` y se despliega como sitio estático en GitHub Pages.

```
gzs-wear-brands/
├── index.html              · Home (hero, destacados, editorial, manifesto, newsletter)
├── shop.html               · Tienda con filtros, buscador y ordenación
├── product.html            · Ficha de producto (?p=slug)
├── cart.html               · Carrito (paso 1)
├── checkout.html           · Checkout (paso 2)
├── about.html              · La marca + FAQ
├── envios-devoluciones.html· Envíos, devoluciones y guía de tallas
├── aviso-legal.html · privacidad.html · cookies.html · terminos.html
├── 404.html
├── data/
│   ├── products.json       · Catálogo (fuente de verdad)
│   └── catalog.js          · Copia incrustada (para abrir sin servidor)
├── assets/
│   ├── img/looks/          · 📸 Fotos de modelo (lookbook de producto)
│   ├── css/styles.css      · Sistema de diseño completo
│   ├── js/config.js        · ⚙️ CONFIGURACIÓN (Stripe, Supabase, envíos, promo)
│   ├── js/cart.js          · Lógica del carrito
│   ├── js/catalog.js       · Catálogo y componentes de producto
│   ├── js/ui.js            · Cabecera, pie, drawer, toasts, modales
│   ├── js/pages.js         · Lógica de cada página + integraciones
│   ├── fonts/              · Fraunces, Inter y Space Mono (locales)
│   └── img/                · Productos + campaña (edición, lookbook)
└── README.md
```

---

## 🔌 Integrar Stripe (pagos reales)

El botón **«Pagar ahora»** ya está cableado: guarda el pedido y llama a tu backend. Solo falta
tu clave y el endpoint.

### 1. Crea la cuenta y las claves
1. Entra en https://dashboard.stripe.com y crea tu cuenta.
2. Activa el modo de pruebas y copia las claves en *Developers → API keys*.

### 2. Necesitas un backend (obligatorio por seguridad)
Stripe **no permite** crear cobros con la clave pública desde el navegador, así que necesitas un
pequeño endpoint que cree la sesión de pago. Dos opciones:

**A) Supabase Edge Function (gratis, encaja con el resto del stack)**

```ts
// supabase/functions/create-checkout-session/index.ts
import Stripe from 'https://esm.sh/stripe@14?target=denonext';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

Deno.serve(async (req) => {
  const { items, totals } = await req.json();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: items.map((i: any) => ({
      quantity: i.qty,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(i.price * 100),
        product_data: { name: `${i.name} ${i.color ?? ''} ${i.size ?? ''}`.trim(),
                        images: [i.image] },
      },
    })),
    success_url: 'https://objbik-eng.github.io/gzs-wear-brands/?pedido=ok',
    cancel_url:  'https://objbik-eng.github.io/gzs-wear-brands/cart.html',
    metadata: { ref: 'pendiente' },
  });
  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Despliega con `supabase functions deploy create-checkout-session` y guarda el secreto:
`supabase secrets set STRIPE_SECRET_KEY=sk_test_…`

**B) Cualquier serverless** (Vercel, Netlify, Cloudflare Workers): el cuerpo es el mismo,
devuelve `{ "url": "<checkout url>" }`.

### 3. Rellena `assets/js/config.js`

```js
stripe: {
  enabled: true,
  publishableKey: 'pk_test_…',
  checkoutEndpoint: 'https://xxxx.supabase.co/functions/v1/create-checkout-session',
},
```

Listo: el botón redirige a Stripe Checkout y, al volver, verás `?pedido=ok`.

> 💡 Webhooks: para marcar pedidos como pagados usa el evento `checkout.session.completed`
> y actualiza la fila de `orders` en Supabase (campo `status`).

---

## 🗄️ Integrar Supabase (pedidos y newsletter)

### 1. Crea el proyecto
https://supabase.com → *New project*. Copia **Project URL** y **anon public key**.

### 2. Ejecuta este SQL (SQL Editor → New query)

```sql
-- Pedidos
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  ref         text unique not null,
  created_at  timestamptz default now(),
  customer    jsonb not null,
  address     jsonb not null,
  items       jsonb not null,
  totals      jsonb not null,
  promo       text,
  status      text default 'pending',
  amount      numeric generated always as ((totals->>'total')::numeric) stored
);

alter table public.orders enable row level security;

-- Cualquiera puede CREAR un pedido (checkout), nadie puede leerlo sin autenticarse
create policy "insert orders" on public.orders for insert to anon with check (true);
create policy "read orders"   on public.orders for select to authenticated using (true);

-- Newsletter
create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  created_at timestamptz default now()
);

alter table public.subscribers enable row level security;
create policy "insert subs" on public.subscribers for insert to anon with check (true);
create policy "read subs"   on public.subscribers for select to authenticated using (true);
```

### 3. Rellena `assets/js/config.js`

```js
supabase: {
  enabled: true,
  url: 'https://xxxx.supabase.co',
  anonKey: 'eyJhbGciOi…',   // anon public (es seguro exponerla con RLS activo)
  tables: { orders: 'orders', subscribers: 'subscribers' },
},
```

Mientras no esté conectado, el sitio funciona en **modo demo**: guarda pedidos y suscriptores
en `localStorage` y te avisa por toast. Nada se rompe.

---

## 🚀 Desplegar en GitHub Pages

El repo ya está preparado y publicado. Para actualizar tras un cambio:

```bash
git add -A
git commit -m "mi cambio"
git push
```

GitHub Pages vuelve a publicar solo (Settings → Pages → *Deploy from a branch* → `main` / `/root`).
La web queda en `https://objbik-eng.github.io/gzs-wear-brands/`.

### Dominio propio (opcional)
1. En `Settings → Pages → Custom domain` escribe `gzswear.gazetastudio.com` (o el que quieras).
2. En tu proveedor DNS crea un `CNAME` apuntando a `objbik-eng.github.io`.
3. Marca *Enforce HTTPS*.

---

## ✏️ Cómo mantener el catálogo

Todo el contenido de producto vive en `data/products.json` (`index` → `products[]`):

```json
{
  "id": "…",                       // referencia interna del producto
  "slug": "tee-lets-play",         // usado en la URL: product.html?p=…
  "name": "Let's Play Oversized",
  "cat": "Oversize",               // Camisetas | Oversize | Sudaderas | Accesorios
  "badge": "Nuevo",                // "" | Nuevo | Best Seller
  "desc": "…", "feats": ["…"], "tags": ["…"],
  "price": 37.54, "priceMax": 38.97,
  "colorsUI": [{ "name": "Blanco", "hex": "#f2efe9", "raw": "Blanc White" }],
  "sizes": ["XS","S","M","L","XL","2XL"],
  "images": ["assets/img/products/tee-lets-play-1.webp", "…"]
}
```

Los datos de cada ficha (variantes, precios, tallas, colores e imágenes) se importaron desde tu
proveedor de producción. Si añades una pieza nueva y quieres traerla aquí, copia su ficha siguiendo
este esquema y duplica la entrada. *Tras editar `products.json`, regenera `catalog.js`*:

```bash
python3 - <<'EOF'
import json
d = json.load(open('data/products.json'))
open('data/catalog.js','w').write(
  "window.GZS_CATALOG = " + json.dumps(d, ensure_ascii=False) + ";\n")
EOF
```

### Precios y envío
En `assets/js/config.js`: `shipping.freeFrom` (60 €), `shipping.flatRate` (4,95 €) y
`promo` (códigos de descuento).

---

## 🧪 Prueba local

```bash
cd gzs-wear-brands
python3 -m http.server 4173       # o cualquier servidor estático
# abre http://localhost:4173
```

También funciona abriendo `index.html` con doble clic (gracias al catálogo incrustado),
aunque para probar el carrito y las rutas lo recomendable es el servidor.

### Tarjetas de prueba de Stripe
`4242 4242 4242 4242` · cualquier fecha futura · cualquier CVC.

---

## ✅ Checklist antes de vender de verdad

- [ ] Rellenar los datos fiscales en `aviso-legal.html` y `terminos.html` (marcados con `[corchetes]`)
- [ ] Cambiar el email real en `assets/js/config.js` (`brand.email`) y en el pie
- [ ] Poner los enlaces reales de Instagram/TikTok (`brand.instagram`, `brand.tiktok`)
- [ ] Conectar Stripe (claves + endpoint) → probar una compra real con `4242…`
- [ ] Conectar Supabase y ejecutar el SQL → comprobar que los pedidos llegan
- [ ] Añadir webhook de Stripe para marcar pedidos como pagados
- [ ] Revisar la guía de tallas con las medidas del taller
- [ ] Configurar el dominio propio (opcional)

---

## 📄 Licencia y créditos

© GZS WEAR BRANDS. Diseño y desarrollo propios. Tipografías: Fraunces, Inter y Space Mono
(SIL Open Font License). Productos elaborados en talleres europeos.
