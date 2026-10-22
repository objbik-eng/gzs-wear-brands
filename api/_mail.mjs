const API = 'https://api.resend.com/emails';

function esc(v='') {
  return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const eur = cents => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format((Number(cents)||0)/100);
const brand = 'GZS WEAR BRANDS';
const site = () => process.env.SITE_URL || 'https://gzswear.roadshop.online';

export async function sendTransactional({to,subject,html,text,idempotencyKey}) {
  if (process.env.EMAILS_ENABLED !== 'true') return { skipped:'emails_disabled' };
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada');
  if (!to) throw new Error('Pedido sin email de cliente');
  const response = await fetch(API, {
    method:'POST',
    headers:{
      Authorization:`Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':'application/json',
      ...(idempotencyKey ? {'Idempotency-Key':idempotencyKey} : {}),
    },
    body:JSON.stringify({
      from:process.env.RESEND_FROM || 'GZS WEAR BRANDS <Gzswear@roadshop.online>',
      to:[to],subject,html,text,
    }),
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(`Resend ${response.status}: ${data.message || data.name || 'error de envío'}`);
  return data;
}

export async function sendOrderConfirmation({to,name,sessionId,items,totalCents}) {
  const customer = esc(name || '');
  const itemLines = (items||[]).map(i=>{
    const details=[i.colorLabel||i.color,i.size].filter(Boolean).map(esc).join(' · ');
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #e3e0da"><b>${esc(i.name)}</b>${details?`<br><span style="color:#7b7771;font-size:12px">${details}</span>`:''}</td><td style="padding:12px 0;border-bottom:1px solid #e3e0da;text-align:right">×${Number(i.qty)||1}</td></tr>`;
  }).join('');
  const link=`${site()}/pedido.html?session_id=${encodeURIComponent(sessionId)}`;
  const html=`<div style="margin:0;background:#e3e0da;padding:28px 12px;font-family:Arial,sans-serif;color:#302114"><div style="max-width:620px;margin:auto;background:#f7f4ee;padding:32px 28px"><p style="font-size:11px;letter-spacing:3px;color:#7a4e27">GZS WEAR BRANDS · COLECCIÓN 001</p><h1 style="font-size:32px;margin:22px 0 8px">Pedido confirmado.</h1><p>Hola${customer?` ${customer}`:''}, hemos recibido tu pago y ya estamos preparando tu pedido para producción.</p><p style="color:#7b7771;font-size:13px">Referencia: ${esc(sessionId)}</p><table style="width:100%;border-collapse:collapse;margin:24px 0">${itemLines}<tr><td style="padding:16px 0"><b>Total pagado</b></td><td style="padding:16px 0;text-align:right"><b>${eur(totalCents)}</b></td></tr></table><p>Te avisaremos cuando el paquete salga del taller. El seguimiento también estará disponible desde el botón de abajo.</p><p style="margin:28px 0"><a href="${esc(link)}" style="background:#302114;color:#f7f4ee;padding:14px 20px;text-decoration:none;display:inline-block">Consultar mi pedido</a></p><p style="font-size:12px;color:#7b7771">¿Necesitas ayuda? Escribe a <a href="mailto:Gzswear@roadshop.online" style="color:#7a4e27">Gzswear@roadshop.online</a>.</p><p style="font-size:10px;color:#a5a19b;margin-top:28px">Diseño exclusivo. Fabricado bajo pedido en Europa.</p></div></div>`;
  const text=`GZS WEAR BRANDS — Pedido confirmado\nHola${name?` ${name}`:''}, hemos recibido tu pago y ya preparamos el pedido.\nTotal: ${eur(totalCents)}\nConsulta estado y seguimiento: ${link}\nAyuda: Gzswear@roadshop.online`;
  return sendTransactional({to,subject:'Pedido confirmado · GZS WEAR BRANDS',html,text,idempotencyKey:`gzs-order-${sessionId}`});
}

export async function sendShipmentNotification({to,name,sessionId,shipments}) {
  const tracking=(shipments||[]).map(s=>{
    const carrier=esc(s.carrier||'Transportista');
    const number=esc(s.tracking_number||'');
    const href=s.tracking_url ? `<a href="${esc(s.tracking_url)}" style="color:#7a4e27">Ver seguimiento</a>` : '';
    return `<li style="margin:12px 0"><b>${carrier}</b>${number?` · ${number}`:''}${href?` · ${href}`:''}</li>`;
  }).join('');
  const link=`${site()}/pedido.html?session_id=${encodeURIComponent(sessionId)}`;
  const html=`<div style="margin:0;background:#e3e0da;padding:28px 12px;font-family:Arial,sans-serif;color:#302114"><div style="max-width:620px;margin:auto;background:#f7f4ee;padding:32px 28px"><p style="font-size:11px;letter-spacing:3px;color:#7a4e27">GZS WEAR BRANDS · COLECCIÓN 001</p><h1 style="font-size:32px;margin:22px 0 8px">Tu pedido está en camino.</h1><p>Hola${name?` ${esc(name)}`:''}, tu pedido ha salido del taller.</p><p style="color:#7b7771;font-size:13px">Referencia: ${esc(sessionId)}</p>${tracking?`<p>Seguimiento:</p><ul>${tracking}</ul>`:'<p>El transportista está preparando el enlace de seguimiento. Consulta esta página más tarde para ver las actualizaciones.</p>'}<p style="margin:28px 0"><a href="${esc(link)}" style="background:#302114;color:#f7f4ee;padding:14px 20px;text-decoration:none;display:inline-block">Ver estado del pedido</a></p><p style="font-size:12px;color:#7b7771">Ayuda: <a href="mailto:Gzswear@roadshop.online" style="color:#7a4e27">Gzswear@roadshop.online</a></p></div></div>`;
  const text=`GZS WEAR BRANDS — Tu pedido está en camino\nReferencia: ${sessionId}\n${(shipments||[]).map(s=>`${s.carrier||'Transportista'} ${s.tracking_number||''} ${s.tracking_url||''}`).join('\n')}\nEstado: ${link}\nAyuda: Gzswear@roadshop.online`;
  return sendTransactional({to,subject:'Tu pedido está en camino · GZS WEAR BRANDS',html,text,idempotencyKey:`gzs-shipment-${sessionId}-${(shipments||[]).map(s=>s.tracking_number||'shipped').join('-').slice(0,100)}`});
}
