import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/supabase.js',import.meta.url),'utf8');
let session=null, authError=null, calls=[], reply=[];
globalThis.__spinAuthFactory=()=>({auth:{getSession:async()=>({data:{session},error:authError})}});
const client=await import('data:text/javascript;base64,'+Buffer.from(source.replace(/import \{ createClient \} from "@supabase\/supabase-js";/,'const createClient=globalThis.__spinAuthFactory;')).toString('base64'));
const originalFetch=globalThis.fetch;
const callbackSource=await readFile(new URL('../api/voucher-check.js',import.meta.url),'utf8');
const savedCallbackToken=process.env.VOUCHER_CALLBACK_TOKEN;
process.env.VOUCHER_CALLBACK_TOKEN='test-server-secret';
const {default:callback}=await import('data:text/javascript;base64,'+Buffer.from(callbackSource).toString('base64'));
function mockFetch(handler=()=>reply){calls=[];globalThis.fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,status:200,json:async()=>handler(url,options),text:async()=>''};};}
function response(){return {statusCode:200,payload:null,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.payload=body;return this;},end(){return this;}};}
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__spinAuthFactory;if(savedCallbackToken===undefined)delete process.env.VOUCHER_CALLBACK_TOKEN;else process.env.VOUCHER_CALLBACK_TOKEN=savedCallbackToken;});
test('admin reads and writes use the signed-in access token',async()=>{
 session={access_token:'signed-in-user'};authError=null;reply=[{role:'admin'}];mockFetch();
 assert.equal((await client.checkEmailAccess('owner@example.invalid')).role,'admin');
 assert.equal(calls[0].options.headers.Authorization,'Bearer signed-in-user');
 await client.addBlacklist('0000000000','test');
 assert.equal(calls[1].options.headers.Authorization,'Bearer signed-in-user');
 assert.equal(calls[1].options.method,'POST');
});
test('public metadata keeps the publishable token after sign-out',async()=>{
 session=null;reply=[];mockFetch();await client.loadActivePrizes();
 const headers=calls[0].options.headers;assert.equal(headers.Authorization,'Bearer '+headers.apikey);
});
test('rate checks use the scoped endpoint and return counts',async()=>{
 session=null;reply={today_spins:4,extra_spins:2};mockFetch();
 assert.equal(await client.checkSpinRateLimit('000 000 0000'),4);
 assert.deepEqual(await client.checkPhoneAllowance('0000000000'),{phone:'0000000000',extra_spins:2});
 assert.ok(calls.every(c=>c.url.endsWith('/rpc/spin_phone_status')));
});
test('rate-check errors stop the customer flow',async()=>{
 reply={error:'unavailable',message:'Try again'};mockFetch();
 await assert.rejects(()=>client.checkSpinRateLimit('0000000000'),/Try again/);
});
test('voucher callback fails closed when its server credential is absent',async()=>{
 delete process.env.VOUCHER_CALLBACK_TOKEN;mockFetch();const res=response();
 await callback({method:'POST',body:{Coupon_Code:'TEST-0000000000'}},res);
 assert.equal(res.statusCode,503);assert.equal(calls.length,0);
});
test('voucher callback sends its server credential and avoids private table reads',async()=>{
 process.env.VOUCHER_CALLBACK_TOKEN='test-server-secret';
 mockFetch(url=>url.includes('/mega_drink_codes')?[{item_id:'ITEM-TEST'}]:{ok:false,error:'not_found'});
 const res=response();
 await callback({method:'POST',body:{Coupon_Code:'TEST-0000000000',Voucher_Order_Line:[{Item_Id:'ITEM-TEST',Price_Sale:1,Quantity:1}]}},res);
 assert.equal(res.statusCode,200);assert.equal(res.payload.code,0);
 assert.equal(calls.length,2);assert.ok(calls.every(c=>!c.url.includes('/mega_vouchers')));
 assert.ok(calls[1].url.endsWith('/rpc/redeem_mega_voucher'));
 assert.equal(calls[1].options.headers['X-Voucher-Callback-Token'],'test-server-secret');
});
