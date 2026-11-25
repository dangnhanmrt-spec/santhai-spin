import json,urllib.request,urllib.error,concurrent.futures
from pathlib import Path
url='https://stxymyjwxdtfxkvmsgmz.supabase.co/functions/v1/chatbot-voucher-issue'
token=Path('.env.botcake-test').read_text().strip()
base={'campaign_id':'BOTCAKE_TEST_20261126','prize_code':'TP10k','customer_id':'990000000000026'}
def call(event,auth=token):
 data={**base,'event_id':event}
 req=urllib.request.Request(url,data=json.dumps(data).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+auth})
 try:
  with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
assert call('API_QA_1','invalid')[0]==401
assert call('')[0]==400
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 pairs=list(ex.map(call,['API_QA_1']*4))
assert all(s==200 and b['status']=='success' for s,b in pairs),pairs
assert len({b['voucher_code'] for _,b in pairs})==1
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 results=list(ex.map(call,['API_QA_'+str(i) for i in range(2,11)]))
assert all(s==200 and b['status']=='success' for s,b in results),results
codes={b['voucher_code'] for _,b in results}|{pairs[0][1]['voucher_code']}
assert len(codes)==10,codes
s,b=call('API_QA_11');assert s==200 and b['status']=='out_of_stock' and b['voucher_code']=='',(s,b)
s,b=call('API_QA_1');assert s==200 and b['voucher_code']==pairs[0][1]['voucher_code'] and b['replayed']
print(json.dumps({'checks':'PASS','unique_codes':len(codes),'concurrent_same_event':'one code','concurrent_different_events':'distinct codes','invalid_auth':401,'missing_event':400,'stock_exhausted':'out_of_stock','retry_after_exhaustion':'original code'}))
