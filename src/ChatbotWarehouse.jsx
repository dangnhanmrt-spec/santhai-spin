import React,{useEffect,useState} from 'react';
import {supabaseClient as db} from './supabase';
import {parseVoucherCodes} from './voucherImport';
const box={background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:18};
const input={padding:10,border:'1px solid #d1d5db',borderRadius:8,fontSize:14};
const button={...input,background:'#fff',cursor:'pointer',fontWeight:700};
const labels={available:'Chưa phát',issued:'Đã phát',redeemed:'Đã sử dụng',void:'Đã hủy'};
export default function ChatbotWarehouse(){
 const [pools,setPools]=useState([]),[poolId,setPoolId]=useState(''),[rows,setRows]=useState([]),[counts,setCounts]=useState({}),[text,setText]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(0);
 const pool=pools.find(p=>p.id===poolId);
 useEffect(()=>{let alive=true;db.from('chatbot_voucher_pools').select('*').order('created_at',{ascending:false}).then(({data,error})=>{if(!alive)return;if(error)setError(error.message);else{setPools(data);setPoolId(data[0]?.id||'');}});return()=>{alive=false;};},[]);
 async function load(id=poolId){
  if(!id)return;setLoading(true);setError('');
  try{
   let query=db.from('chatbot_vouchers').select('*').eq('pool_id',id).order('created_at',{ascending:false}).order('id').range(page*100,page*100+99);
   if(filter!=='all')query=query.eq('status',filter);
   const [list,...totals]=await Promise.all([query,...Object.keys(labels).map(status=>db.from('chatbot_vouchers').select('id',{count:'exact',head:true}).eq('pool_id',id).eq('status',status))]);
   for(const r of [list,...totals])if(r.error)throw r.error;
   setRows(list.data);setCounts(Object.fromEntries(Object.keys(labels).map((s,i)=>[s,totals[i].count])));
  }catch(e){setError(e.message);setRows([]);}finally{setLoading(false);}
 }
 useEffect(()=>{load();},[poolId,filter,page]);
 async function importCodes(){setBusy(true);setError('');setMessage('');try{
  const codes=parseVoucherCodes(text);
  const {data,error}=await db.rpc('chatbot_import_codes',{p_pool_id:poolId,p_codes:codes});if(error)throw error;
  setMessage(`Đã nhập ${data.inserted} mã mới · Bỏ qua ${data.duplicates} mã trùng.`);setText('');await load();
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 async function download(){setBusy(true);setError('');try{
  const all=[];let offset=0;
  for(;;){let q=db.from('chatbot_vouchers').select('code,status').eq('pool_id',poolId).order('created_at').order('id').range(offset,offset+999);if(filter!=='all')q=q.eq('status',filter);
   const {data,error}=await q;if(error)throw error;all.push(...data);if(data.length<1000)break;offset+=1000;
  }
  const url=URL.createObjectURL(new Blob(['\uFEFFcode\n'+all.map(r=>r.code).join('\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`voucher-${pool?.prize_code||'codes'}-${pool?.is_test?'TEST':'LIVE'}-${filter}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section style={{color:'#1c1917'}}>
  <h2 style={{margin:'0 0 8px'}}>Kho mã chatbot</h2><p style={{color:'#6b7280',marginTop:0}}>Nhập mã cho từng giải thưởng · Theo dõi mã chưa phát và lịch sử cấp mã</p>
  <div style={{...box,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
   <label>Kho voucher <select aria-label="Kho voucher" style={{...input,marginLeft:10}} value={poolId} onChange={e=>{setPoolId(e.target.value);setPage(0);setText('');setMessage('');}}>{pools.map(p=><option key={p.id} value={p.id}>{p.name} · {p.is_test?'TEST':'THẬT'}</option>)}</select></label>
   <button style={button} disabled={loading||busy} onClick={()=>load()}>Làm mới</button>
  </div>
  {pool?.is_test&&<p style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:12}}>Kho thử nghiệm — mã chỉ dùng kiểm tra chatbot, không có giá trị đổi thưởng tại cửa hàng.</p>}
  {pool&&<p style={{color:'#57534e'}}>Chiến dịch: <code>{pool.campaign}</code> · Loại giải: <code>{pool.prize_code}</code> · {pool.enabled?'Đang cho phép cấp mã':'Đang tắt cấp mã'}</p>}
  {!poolId&&!error&&<p>Chưa có kho hoặc tài khoản không có quyền quản lý kho chatbot.</p>}
  {error&&<p role="alert" style={{color:'#b91c1c',background:'#fef2f2',padding:12}}>{error}</p>}
  {message&&<p role="status" style={{color:'#166534',background:'#f0fdf4',padding:12}}>{message}</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,margin:'16px 0'}}>{Object.entries(labels).map(([key,label])=><div style={box} key={key}><div style={{color:'#6b7280'}}>{label}</div><strong style={{fontSize:28}}>{loading?'…':counts[key]??0}</strong></div>)}</div>
  <div style={box}><h3 style={{marginTop:0}}>Nhập mã voucher</h3><p>Chọn file CSV/TXT một cột hoặc dán mỗi mã một dòng. Mã trùng được bỏ qua, không ghi đè mã cũ.</p>
   <input aria-label="Chọn file mã voucher" type="file" accept=".csv,.txt" disabled={busy} onChange={async e=>{const f=e.target.files?.[0];if(!f)return;setError('');try{if(f.size>1024*1024)throw new Error('File tối đa 1 MB.');setText(await f.text());}catch(err){setError(err.message);}e.target.value='';}}/>
   <textarea aria-label="Danh sách mã" placeholder={'ABCDE\nF7H9K'} rows={5} value={text} onChange={e=>setText(e.target.value)} disabled={busy} style={{...input,display:'block',width:'100%',boxSizing:'border-box',margin:'12px 0',fontFamily:'monospace'}}/>
   <button style={{...button,background:'#e99849',color:'#fff',border:0}} disabled={busy||!poolId||!text.trim()} onClick={importCodes}>{busy?'Đang xử lý…':'Nhập vào kho'}</button>
  </div>
  <div style={{...box,marginTop:16,overflowX:'auto'}}><div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between'}}><h3>Danh sách mã</h3><div><select aria-label="Trạng thái mã" value={filter} style={input} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="all">Tất cả trạng thái</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select> <button disabled={busy||!poolId} style={button} onClick={download}>Tải mã CSV</button></div></div>
   <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['Mã voucher','Trạng thái','Khách nhận','Ngày phát'].map(h=><th style={{padding:12,background:'#f9fafb'}} key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td style={{padding:12,fontFamily:'monospace',fontWeight:800,borderBottom:'1px solid #eee'}}>{r.code}</td><td>{labels[r.status]}</td><td>{r.customer_id||'—'}</td><td>{r.issued_at?new Date(r.issued_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—'}</td></tr>)}</tbody></table>
   {!rows.length&&<p>{loading?'Đang tải…':'Không có mã ở trạng thái này.'}</p>}
   <div style={{display:'flex',gap:12,marginTop:12}}><button style={button} disabled={!page||loading} onClick={()=>setPage(p=>p-1)}>Trước</button><span>Trang {page+1}</span><button style={button} disabled={rows.length<100||loading} onClick={()=>setPage(p=>p+1)}>Sau</button></div>
  </div>
 </section>;
}
