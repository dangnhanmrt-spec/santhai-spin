import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHandler} from '../supabase/functions/chatbot-voucher-issue/handler.js';
const token='a'.repeat(43),config={tokenHash:createHash('sha256').update(token).digest('hex'),poolId:'pool',campaignId:'TEST',prizeCode:'TP10k'};
const body={campaign_id:'TEST',prize_code:'TP10k',customer_id:'123456789',event_id:'win-1'};
function request(data=body,auth=token){return new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${auth}`},body:JSON.stringify(data)});}
test('reject unauthorized requests before database calls',async()=>{let calls=0;const h=createHandler({config,rpc:async()=>{calls++;}});assert.equal((await h(request(body,'wrong'))).status,401);assert.equal(calls,0);});
test('require valid event customer and campaign; no allocation on bad input',async()=>{const h=createHandler({config,rpc:async()=>assert.fail('unexpected call')});for(const data of [{...body,event_id:''},{...body,event_id:'{{user.event}}'},{...body,customer_id:'{{user.id}}'},{...body,campaign_id:'LIVE'}])assert.equal((await h(request(data))).status,400);});
test('bind customer and event, return code and replay flag',async()=>{const h=createHandler({config,rpc:async p=>{assert.equal(p.p_event_id,'123456789:win-1');assert.equal(p.p_pool_id,'pool');return {status:'success',voucher_code:'ABCDE',replayed:true};}});assert.deepEqual(await (await h(request())).json(),{voucher_code:'ABCDE',status:'success',replayed:true,source:'main',is_test:true,prize_code:'TP10k'});});
test('empty stock clears code so previous value is not reused',async()=>{const h=createHandler({config,rpc:async()=>({status:'out_of_stock'})});assert.deepEqual(await (await h(request())).json(),{voucher_code:'',status:'out_of_stock',is_test:true});});
test('database failure never leaks details or stale code',async()=>{const h=createHandler({config,rpc:async()=>{throw Error('private details');}});const r=await h(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{voucher_code:'',status:'temporarily_unavailable'});});
test('reject oversized input',async()=>{const h=createHandler({config,rpc:async()=>assert.fail('unexpected call')});assert.equal((await h(request({...body,note:'x'.repeat(5000)}))).status,413);});

test('requests without event allocate a new internal event each time',async()=>{const ids=[];const h=createHandler({config,rpc:async p=>{ids.push(p.p_event_id);return {status:'success',voucher_code:'ABCDE'};}});const {event_id,...data}=body;await h(request(data));await h(request(data));assert.equal(ids.length,2);assert.notEqual(ids[0],ids[1]);});

test('routes every prize to its own test/live pool and rejects unknown prizes',async()=>{
 const prizes=['TP10k','x2TP','M2T1','Upsiz','15%'];
 const pools=['TEST','LIVE'].flatMap(c=>prizes.map(p=>({campaignId:c,prizeCode:p,poolId:c+':'+p,isTest:c==='TEST'})));
 let calls=0;const h=createHandler({config:{tokenHash:config.tokenHash,pools},rpc:async p=>{calls++;return {status:'success',voucher_code:'ABCDE',pool:p.p_pool_id};}});
 for(const pool of pools){const check=createHandler({config:{tokenHash:config.tokenHash,pools},rpc:async p=>{assert.equal(p.p_pool_id,pool.poolId);return {status:'success',voucher_code:'ABCDE'};}});const result=await(await check(request({...body,campaign_id:pool.campaignId,prize_code:pool.prizeCode}))).json();assert.equal(result.is_test,pool.isTest);assert.equal(result.prize_code,pool.prizeCode);}
 for(const prize of ['TRUOT','__proto__','missing'])assert.equal((await h(request({...body,prize_code:prize}))).status,400);
 assert.equal(calls,0);
});

test('stock check is read only and selects exactly the campaign main pools',async()=>{
 const pools=['TEST','LIVE'].flatMap(c=>[1,2,3,4,5].map(i=>({campaignId:c,poolId:c+i})));
 const h=createHandler({config:{...config,pools},rpc:async()=>assert.fail('stock must not allocate'),stockRpc:async p=>{assert.deepEqual(p.p_pool_ids,['TEST1','TEST2','TEST3','TEST4','TEST5']);return {status:'success',stock_gate:'OPEN',empty_main_pools:2};}});
 assert.equal((await(await h(request({action:'check_stock',campaign_id:'TEST'}))).json()).stock_gate,'OPEN');
 assert.equal((await h(request({action:'check_stock',campaign_id:'UNKNOWN'}))).status,400);
});
test('stock errors fail closed and invalid actions never allocate',async()=>{
 const h=createHandler({config:{...config,pools:[1,2,3,4,5].map(i=>({campaignId:'TEST',poolId:String(i)}))},rpc:async()=>assert.fail('no allocation'),stockRpc:async()=>{throw Error('private');}});
 const r=await h(request({action:'check_stock',campaign_id:'TEST'}));assert.equal(r.status,503);assert.equal((await r.json()).stock_gate,'CLOSED');
 assert.equal((await h(request({...body,action:'unknown'}))).status,400);
});
