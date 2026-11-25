import {createHandler} from './handler.js';
import {config} from './config.js';
const handler=createHandler({config,rpc:async (params:Record<string,string>)=>{
 const url=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)throw new Error('Missing server configuration');
 const r=await fetch(`${url}/rest/v1/rpc/chatbot_issue_code`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify(params),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('RPC failed');
 return r.json();
}});
Deno.serve(handler);
