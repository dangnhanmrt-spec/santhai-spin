const json=(status,body)=>new Response(JSON.stringify({voucher_code:'',...body}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export function createHandler({config,rpc}){
 return async function handler(req){
  if(req.method!=='POST')return json(405,{status:'method_not_allowed'});
  const token=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if(!token)return json(401,{status:'unauthorized'});
  const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
  if(digest!==config.tokenHash)return json(401,{status:'unauthorized'});
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json(415,{status:'invalid_content_type'});
  if(Number(req.headers.get('content-length'))>4096)return json(413,{status:'payload_too_large'});
  let body;
  try{
   const reader=req.body?.getReader();if(!reader)return json(400,{status:'invalid_json'});
   let size=0;const parts=[];
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return json(413,{status:'payload_too_large'});}parts.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}body=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return json(400,{status:'invalid_json'});}
  if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{status:'invalid_request'});
  const pool=(config.pools??[{...config,isTest:true}]).find(p=>p.campaignId===body.campaign_id&&p.prizeCode===body.prize_code);
  if(!pool)return json(400,{status:'invalid_campaign'});
  if(typeof body.customer_id!=='string'||!/^\d{5,30}$/.test(body.customer_id))return json(400,{status:'invalid_customer'});
  if(body.event_id!==undefined && (typeof body.event_id!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(body.event_id)))return json(400,{status:'invalid_event'});
  const eventId=body.event_id??crypto.randomUUID();
  try{
   // No event supplied: each invocation allocates a fresh code, as requested.
   // An optional explicit event remains available for clients that support retries.
   const result=await rpc({p_pool_id:pool.poolId,p_customer_id:body.customer_id,p_event_id:`${body.customer_id}:${eventId}`});
   if(result?.status==='success'&&typeof result.voucher_code==='string'&&/^[A-Z0-9_-]{5,64}$/.test(result.voucher_code))return json(200,{status:'success',voucher_code:result.voucher_code,replayed:result.replayed===true,is_test:pool.isTest,prize_code:pool.prizeCode});
   if(['out_of_stock','disabled','expired'].includes(result?.status))return json(200,{status:result.status,is_test:pool.isTest});
   return json(502,{status:'upstream_error'});
  }catch{return json(503,{status:'temporarily_unavailable'});}
 };
}
