import React, {useEffect, useState} from 'react';
import {supabaseClient as db} from './supabase';
import ChatbotWarehouse from './ChatbotWarehouse';

const OWNER='dangnhan.mrt@gmail.com';
const button={border:'1px solid #ddd',borderRadius:8,padding:'10px 16px',background:'#fff',cursor:'pointer',fontWeight:600};
export default function WarehouseApp(){
 const [user,setUser]=useState(null),[checking,setChecking]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let live=true;let authEventSeen=false;
  const {data:{subscription}}=db.auth.onAuthStateChange((_event,session)=>{
   authEventSeen=true;if(!live)return;setUser(session?.user??null);setChecking(false);
  });
  db.auth.getSession().then(({data,error})=>{if(!live||authEventSeen)return;if(error)setError('Không tải được phiên đăng nhập. Anh thử tải lại trang.');setUser(data.session?.user??null);setChecking(false);}).catch(()=>{if(live){setError('Không kết nối được dịch vụ đăng nhập.');setChecking(false);}});
  return()=>{live=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{if(user&&window.location.hash.includes('access_token'))window.history.replaceState(null,'',window.location.pathname);},[user]);
 async function login(){setBusy(true);setError('');try{const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});if(error)throw error;}catch(e){setError('Chưa đăng nhập được: '+e.message);setBusy(false);}}
 async function logout(){setBusy(true);setError('');try{const {error}=await db.auth.signOut({scope:'local'});if(error)throw error;setUser(null);}catch(e){setError('Chưa đăng xuất được: '+e.message);}finally{setBusy(false);}}
 // UI identity check only; database RLS independently verifies the confirmed owner.
 const allowed=user?.email?.toLowerCase()===OWNER;
 return <div style={{minHeight:'100vh',background:'#f6f5f2',fontFamily:'Arial, sans-serif',color:'#1c1917'}}>
  <style>{`body{margin:0}button:disabled{cursor:not-allowed;opacity:.55}button,input,textarea,select{font:inherit}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #b86b24;outline-offset:2px}th,td{white-space:nowrap}@media(max-width:600px){.warehouse-shell{padding:14px!important}.warehouse-header{padding:14px!important}}`}</style>
  <header className="warehouse-header" style={{background:'#fff',borderBottom:'1px solid #e7e5e4',padding:'18px 28px',display:'flex',gap:16,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
   <div><strong style={{color:'#b66a24',fontSize:21}}>SanThai</strong><span style={{marginLeft:12,color:'#57534e'}}>Quản lý voucher chatbot</span></div>
   {user&&<div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}><span style={{fontSize:13,color:'#78716c'}}>{user.email}</span><button style={button} disabled={busy} onClick={logout}>Đăng xuất</button></div>}
  </header>
  <main className="warehouse-shell" style={{maxWidth:1180,margin:'0 auto',padding:28}}>
   {error&&<p role="alert" style={{background:'#fef2f2',color:'#b91c1c',padding:12,borderRadius:8}}>{error}</p>}
   {checking?<p role="status">Đang kiểm tra đăng nhập…</p>:!user?<section style={{maxWidth:420,margin:'70px auto',padding:32,background:'#fff',border:'1px solid #e7e5e4',borderRadius:16,textAlign:'center'}}><h1 style={{fontSize:24}}>Kho mã chatbot</h1><p style={{color:'#78716c',lineHeight:1.6}}>Đăng nhập để nhập mã, quản lý tồn kho và theo dõi voucher đã phát.</p><button style={{...button,background:'#b66a24',color:'#fff',border:0,width:'100%',marginTop:12}} disabled={busy} onClick={login}>{busy?'Đang chuyển đến Google…':'Đăng nhập bằng Google'}</button></section>:allowed?<ChatbotWarehouse/>:<section><h1>Tài khoản chưa có quyền truy cập</h1><p>Anh vui lòng đăng nhập tài khoản quản lý kho mã.</p></section>}
  </main>
 </div>;
}
