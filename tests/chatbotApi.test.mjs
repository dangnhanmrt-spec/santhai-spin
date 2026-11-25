import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHandler} from '../supabase/functions/chatbot-voucher-issue/handler.js';
const token='a'.repeat(43),config={tokenHash:createHash('sha256').update(token).digest('hex'),poolId:'pool',campaignId:'TEST',prizeCode:'TP10k'};
const body={campaign_id:'TEST',prize_code:'TP10k',customer_id:'123456789',event_id:'win-1'};
function request(data=body,auth=token){return new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${auth}`},body:JSON.stringify(data)});}
test('reject unauthorized requests before database calls',async()=>{let calls=0;const h=createHandler({config,rpc:async()=>{calls++;}});assert.equal((await h(request(body,'wrong'))).status,401);assert.equal(calls,0);});
test('require valid event customer and campaign; no allocation on bad input',async()=>{const h=createHandler({config,rpc:async()=>assert.fail('unexpected call')});for(const data of [{...body,event_id:''},{...body,event_id:'{{user.event}}'},{...body,customer_id:'{{user.id}}'},{...body,campaign_id:'LIVE'}])assert.equal((await h(request(data))).status,400);});
test('bind customer and event, return code and replay flag',async()=>{const h=createHandler({config,rpc:async p=>{assert.equal(p.p_event_id,'123456789:win-1');assert.equal(p.p_pool_id,'pool');return {status:'success',voucher_code:'ABCDE',replayed:true};}});assert.deepEqual(await (await h(request())).json(),{voucher_code:'ABCDE',status:'success',replayed:true,is_test:true,prize_code:'TP10k'});});
test('empty stock clears code so previous value is not reused',async()=>{const h=createHandler({config,rpc:async()=>({status:'out_of_stock'})});assert.deepEqual(await (await h(request())).json(),{voucher_code:'',status:'out_of_stock',is_test:true});});
test('database failure never leaks details or stale code',async()=>{const h=createHandler({config,rpc:async()=>{throw Error('private details');}});const r=await h(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{voucher_code:'',status:'temporarily_unavailable'});});
test('reject oversized input',async()=>{const h=createHandler({config,rpc:async()=>assert.fail('unexpected call')});assert.equal((await h(request({...body,note:'x'.repeat(5000)}))).status,413);});
