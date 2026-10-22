/* POST /api/printify-webhook — actualiza estado y seguimiento desde Printify. */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const config = { api: { bodyParser: false } };
const SHOP_ID = '29311670';

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks=[];
    req.on('data', c=>chunks.push(Buffer.from(c)));
    req.on('end', ()=>resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function validSignature(raw, signature, secret) {
  if(!signature || !secret || !signature.startsWith('sha256=')) return false;
  const expected='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
  const a=Buffer.from(signature); const b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
const sbHeaders=()=>({apikey:process.env.SUPABASE_SECRET,Authorization:`Bearer ${process.env.SUPABASE_SECRET}`,'Content-Type':'application/json'});
async function sb(path,{method='GET',body=null,prefer=null}={}){
  const h=sbHeaders(); if(prefer) h.Prefer=prefer;
  const r=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`,{method,headers:h,body:body?JSON.stringify(body):undefined});
  const t=await r.text(); if(!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0,240)}`);
  return t?JSON.parse(t):null;
}
async function getPrintifyOrder(id){
  const r=await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders/${encodeURIComponent(id)}.json`,{
    headers:{Authorization:`Bearer ${process.env.PRINTIFY_TOKEN}`,'User-Agent':'gzs-web'},
  });
  const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(`Printify ${r.status}: ${JSON.stringify(d).slice(0,200)}`); return d;
}
function normalizeShipments(order,eventData={}){
  const raw=Array.isArray(order.shipments)&&order.shipments.length?order.shipments:[eventData];
  return raw.map(s=>{
    const carrier=typeof s.carrier==='string'?s.carrier:(s.carrier?.name||s.carrier?.code||s.carrier_name||'');
    return {
      carrier,
      tracking_number:s.tracking_number||s.tracking_id||s.tracking||'',
      tracking_url:s.tracking_url||s.url||s.tracking_link||'',
      shipped_at:s.shipped_at||s.created_at||null,
    };
  }).filter(s=>s.tracking_number||s.tracking_url||s.carrier);
}
function reply(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));}

export default async function handler(req,res){
  if(req.method!=='POST') return reply(res,405,{error:'Method not allowed'});
  const raw=await rawBody(req);
  if(!validSignature(raw,req.headers['x-pfy-signature'],process.env.PRINTIFY_WEBHOOK_SECRET)) return reply(res,401,{error:'Firma Printify no válida'});
  let event; try{event=JSON.parse(raw.toString('utf8'));}catch{return reply(res,400,{error:'JSON no válido'});}
  try{
    const topic=event.type||event.topic||'';
    const resource=event.resource||{};
    const pId=resource.id||event.data?.id;
    if(!pId) return reply(res,200,{received:true,ignored:'sin order id'});
    const pOrder=await getPrintifyOrder(pId);
    const sessionId=pOrder.external_id||resource.data?.external_id||event.data?.external_id;
    let rows=sessionId?await sb(`orders?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=id,stripe_session_id,email,customer_name,fulfillment_status,tracking_info,shipment_email_sent_at`):[];
    if(!rows?.length) rows=await sb(`orders?printify_order_id=eq.${encodeURIComponent(pId)}&select=id,stripe_session_id,email,customer_name,fulfillment_status,tracking_info,shipment_email_sent_at`);
    const order=rows?.[0];
    if(!order) return reply(res,200,{received:true,ignored:'pedido no asociado en Supabase'});

    const base={printify_status:pOrder.status||topic};
    if(topic==='order:sent-to-production'){
      base.fulfillment_status='in-production';
      await sb(`orders?id=eq.${order.id}`,{method:'PATCH',body:base,prefer:'return=minimal'});
      return reply(res,200,{received:true,updated:'in-production'});
    }
    if(topic==='order:shipment:delivered'){
      base.fulfillment_status='delivered';
      await sb(`orders?id=eq.${order.id}`,{method:'PATCH',body:base,prefer:'return=minimal'});
      return reply(res,200,{received:true,updated:'delivered'});
    }
    if(topic==='order:shipment:created'){
      const shipments=normalizeShipments(pOrder,resource.data||event.data||{});
      base.fulfillment_status='shipped';
      base.tracking_info=shipments;
      await sb(`orders?id=eq.${order.id}`,{method:'PATCH',body:base,prefer:'return=minimal'});
      // Printify envía su propio email de tracking (send_shipping_notification=true); aquí guardamos el tracking para la página del pedido.
      return reply(res,200,{received:true,updated:'shipped',tracking_count:shipments.length});
    }
    if(topic==='order:updated'){
      const status=String(pOrder.status||'').toLowerCase();
      if(status.includes('delivered')) base.fulfillment_status='delivered';
      else if(status.includes('ship')||status.includes('fulfill')) base.fulfillment_status='shipped';
      else if(status.includes('production')) base.fulfillment_status='in-production';
      await sb(`orders?id=eq.${order.id}`,{method:'PATCH',body:base,prefer:'return=minimal'});
    }
    return reply(res,200,{received:true});
  }catch(e){
    console.error('printify_webhook',e);
    return reply(res,500,{error:'No se pudo procesar la actualización de Printify'});
  }
}
