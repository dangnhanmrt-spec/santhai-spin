import {createHandler} from './handler.js';
import {config} from './config.js';
async function callRpc(name:string,params:unknown){
 const url=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)throw new Error('Missing server configuration');
 const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify(params),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('RPC failed');
 return r.json();
}
Deno.serve(createHandler({config,rpc:(params:unknown)=>callRpc('chatbot_issue_code',params),stockRpc:(params:unknown)=>callRpc('chatbot_check_stock',params),resolveCampaign:(params:unknown)=>callRpc('chatbot_resolve_campaign',params)}));
