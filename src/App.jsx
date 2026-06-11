import { useState, useRef, useEffect, useCallback } from "react";
import {
  doSpin, loadActivePrizes, loadAllPrizes, savePrize, deletePrize, updatePrizesOrder, resetDefaultPrizes, testConnection,
  loadStoreStats, loadSettings, saveSetting,
  loadSpins, loadSpecialWinners, loadBlacklist, loadVouchers,
  adminInvalidate, importVouchers, addBlacklist, removeBlacklist, updateSpecialStatus,
  loadPrizeVouchers, deleteVoucher, bulkDeleteVouchers,
} from "./supabase.js";

/* ─── CONSTANTS ─── */
const ADMIN_PWD = "Santhai2024";
const LOW_STOCK = 10;

/* ─── STORE MAP ─── */
const STORE_PREFIXES = [
  ["SR.NTT","SanThai - KG1 - Rạch Giá 1"],["SANTHAI","Santhai - Thới Lai"],
  ["SXVNT","SanThai - CT5 - XVNT"],["STNOT","SanThai - CT9 - Thốt Nốt"],
  ["SHVTA","SanThai - LA1 - Tân An"],["STPBL","SanThai - BL2 - Trần Phú"],
  ["SBTRE","SanThai - BT1 - Bến Tre"],["CAUKE","Santhai - Cầu Kè"],
  ["BATRI","Santhai - Ba Tri"],["THDLX","SanThai - AG1 - THĐ1"],
  ["SMT10","SanThai - CT1 - Mậu Thân"],["SMT15","SanThai - TG1 - Lê Đại Hành"],
  ["S.TNV","SanThai - VL3 - Trưng Vương"],["263AA","SanThai - CT6 - NVC2"],
  ["STCL","SanThai - Càng Long"],["DTMT","SanThai - Mỹ Thọ"],
  ["DTHH","SanThai - Đinh Tiên Hoàng"],["GCTG","Santhai - Gò Công"],
  ["TVVL","Santhai - Trà Vinh"],["THKG","Santhai - Tân Hiệp, Kiên Giang"],
  ["TOVL","Santhai - Trà Ôn, Vĩnh Long"],["TBVL","SanThai - VL5 - Tam Bình"],
  ["SNVL","SanThai - CT7 - NVL"],["STML","SanThai - KG3 - Minh Lương"],
  ["SMT2","SanThai - TG2 - Ấp Bắc"],["SDH2","SanThai - LA4 - Đức Hòa 2"],
  ["SLX4","SanThai - AG4 - THĐ2"],["SLX5","SanThai - AG5 - Phú Hòa"],
  ["SCD2","Santhai - Cờ Đỏ 2"],["S.GR","SanThai - BL1 - Giá Rai"],
  ["S.TC","SanThai - AG6 - Tân Châu"],["S.OM","SanThai - CT10 - Ô Môn"],
  ["S.CD","SanThai - LA3 - Cần Đước"],["NGA5","Santhai - Ngã 5"],
  ["SMT","SanThai - CT1 - Mậu Thân"],["SDH","SanThai - LA2 - Đức Hòa"],
  ["SLX","SanThai - AG4 - THĐ2"],["SCD","SanThai - AG9 - Châu Đốc"],
  ["SCM","SanThai - Chợ Mới / Cà Mau"],["SCT","Santhai - Cái Tắc"],
  ["S3T","SanThai - CT3 - Ba Tháng Hai"],["S30","SanThai - ST1 - 30 Tháng"],
  ["SAB","SanThai - KG5 - An Biên"],["SAC","SanThai - AG7 - An Châu"],
  ["SBD","Santhai - Bình Đại"],["SBT","SanThai - VL2 - Bình Tâm"],
  ["SCC","Santhai - Cái Côn"],["SCL","SanThai - ĐT3 - Cao Lãnh"],
  ["SGR","SanThai - KG4 - Giồng Riềng"],["SHG","SanThai - HG1 - Ngã Bảy"],
  ["SLH","SanThai - VL4 - Long Hồ"],["SLV","Santhai - Lai Vung"],
  ["SML","SanThai - ĐT8 - Mỹ Long"],["SND","SanThai - CT2 - NVC1"],
  ["SPD","SanThai - CT12 - Phong Điền"],["SPH","SanThai - CT8 - Phạm Hùng"],
  ["SPL","SanThai - BL3 - Phước Long"],["SRG","SanThai - KG2 - Rạch Giá 2"],
  ["SSD","SanThai - ĐT1 - Sa Đéc"],["STB","SanThai - ĐT7 - Thanh Bình"],
  ["STC","Santhai - Tiểu Cần"],["STM","SanThai - ĐT6 - Tháp Mười"],
  ["SVT","Santhai - Vị Thanh"],["RG3","SanThai - Rạch Giá 3"],
  ["LVO","Santhai - Lấp Vò"],["BM","SanThai - VL1 - Bình Minh"],
  ["ML","Santhai - Mỹ Luông"],["RG","SanThai - Rạch Giá 3"],
  ["CD","Santhai - Cần Đăng / Cái Dầu"],["S","Santhai - Bến Lức"],
];
function detectStore(billCode) {
  const code = (billCode||"").trim().toUpperCase().replace(/\u200b/g,"");
  for (const [prefix, name] of STORE_PREFIXES) {
    if (code.startsWith(prefix.toUpperCase())) return { id:prefix, name };
  }
  return { id:"", name:"" };
}

/* ─── GLOBAL CSS ─── */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Inter:wght@400;500;600&display=swap');
  :root {
    --primary:#e99849; --primary-dark:#d4822a;
    --navy:#1b459c; --navy-light:#8FA8D6;
    --cam-light:#F7D49E; --bg:#F5F0E8;
    --text:#1c1917; --muted:#78716c;
    --radius:16px;
  }
  * { box-sizing:border-box; }
  body { background:#F5F0E8 !important; margin:0; font-family:'Inter',sans-serif; }
  input, select, textarea { font-family:'Inter',sans-serif; outline:none; transition:border-color .2s,box-shadow .2s; border-radius:10px; }
  input:focus, select:focus { border-color:#e99849 !important; box-shadow:0 0 0 3px rgba(233,152,73,.3) !important; }
  label { font-family:'Inter',sans-serif; }
  button { font-family:'Nunito',sans-serif; cursor:pointer; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes bounce-in { 0%{transform:scale(.5);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
  @keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 0 rgba(233,152,73,.4)} 50%{box-shadow:0 0 0 8px rgba(233,152,73,0)} }
  @keyframes glow { 0%,100%{filter:drop-shadow(0 0 8px #e99849)} 50%{filter:drop-shadow(0 0 24px #e99849)} }
`;

/* ─── WHEEL COLORS (canvas fallback) ─── */
const WHEEL_COLORS = [
  '#e99849','#1b459c','#F7D49E','#8FA8D6',
  '#e99849','#1b459c','#F7D49E','#8FA8D6',
  '#e99849','#1b459c','#F7D49E','#8FA8D6',
  '#e99849','#1b459c','#F7D49E','#8FA8D6',
];
const WHEEL_TEXT_COLORS = [
  '#FFFFFF','#FFFFFF','#1b459c','#1b459c',
  '#FFFFFF','#FFFFFF','#1b459c','#1b459c',
  '#FFFFFF','#FFFFFF','#1b459c','#1b459c',
  '#FFFFFF','#FFFFFF','#1b459c','#1b459c',
];

/* ─── WHEEL IMAGE SPINNER ─── */
function WheelImageSpinner({ prizes, winnerId, spinning, onDone, size, imageUrl }) {
  const rotRef    = useRef(0);
  const rafRef    = useRef(null);
  const prizesRef = useRef(prizes);
  const [deg,    setDeg]    = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { prizesRef.current = prizes; }, [prizes]);

  useEffect(() => {
    if (!spinning || !winnerId) return;
    const list = prizesRef.current;
    if (!list.length) return;
    cancelAnimationFrame(rafRef.current);

    const n = list.length;
    const idx = list.findIndex(p => String(p.id) === String(winnerId));
    const targetIdx = idx < 0 ? Math.floor(Math.random() * n) : idx;

    const segDeg      = 360 / n;
    const prizeCenter = targetIdx * segDeg + segDeg / 2;
    const base        = ((360 - prizeCenter) % 360 + 360) % 360;
    const minTarget   = rotRef.current + 5 * 360;
    const loops       = Math.ceil((minTarget - base) / 360);
    const target      = base + loops * 360;

    const from = rotRef.current, dur = 5000, t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 4);

    const frame = now => {
      const t = Math.min(1, (now - t0) / dur);
      const r = from + (target - from) * ease(t);
      rotRef.current = r; setDeg(r);
      if (t < 1) rafRef.current = requestAnimationFrame(frame);
      else { rotRef.current = target; setDeg(target); onDone?.(); }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, winnerId]); // eslint-disable-line

  return (
    <div style={{ position:"relative", width:size, height:size, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ position:"absolute", top:-2, left:"50%", transform:"translateX(-50%)", zIndex:10,
        width:0, height:0, borderLeft:"13px solid transparent", borderRight:"13px solid transparent",
        borderTop:"26px solid #e99849", filter:"drop-shadow(0 2px 5px rgba(0,0,0,.5))" }}/>
      {!loaded && (
        <div style={{ width:size, height:size, borderRadius:"50%", background:"#f3f4f6",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#9ca3af" }}>
          Đang tải...
        </div>
      )}
      <img src={imageUrl} alt="vòng quay" onLoad={() => setLoaded(true)} draggable={false}
        style={{ width:size, height:size, transform:`rotate(${deg}deg)`, borderRadius:"50%",
          display:loaded?"block":"none", userSelect:"none", WebkitUserDrag:"none", willChange:"transform" }}/>
    </div>
  );
}

/* ─── WHEEL CANVAS (fallback) ─── */
function WheelCanvas({ prizes, winnerId, spinning, onDone, size }) {
  const ref    = useRef(null);
  const rotRef = useRef(0);
  const rafRef = useRef(null);

  const segs = prizes.map((p, i) => {
    const sweep = (2 * Math.PI) / prizes.length;
    const start = -Math.PI / 2 + i * sweep;
    return { ...p, sweep, start, mid: start + sweep / 2,
      color: WHEEL_COLORS[i % WHEEL_COLORS.length],
      textColor: WHEEL_TEXT_COLORS[i % WHEEL_TEXT_COLORS.length] };
  });

  const rrect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  };

  const draw = useCallback((rot) => {
    const c = ref.current; if (!c || segs.length === 0) return;
    const ctx = c.getContext("2d"), W = c.width, cx = W/2, cy = W/2;
    const outerR = W/2 - 2;
    const ringW  = Math.max(10, W * 0.045);
    const R      = outerR - ringW - 4;
    ctx.clearRect(0, 0, W, W);

    // Navy outer ring
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, 2*Math.PI);
    const navyG = ctx.createRadialGradient(cx-outerR*.25,cy-outerR*.25,0,cx,cy,outerR);
    navyG.addColorStop(0,"#2a5cc4"); navyG.addColorStop(.6,"#1b459c"); navyG.addColorStop(1,"#0d2d6b");
    ctx.fillStyle = navyG; ctx.fill();

    // Gold ring
    ctx.beginPath(); ctx.arc(cx, cy, R+6, 0, 2*Math.PI);
    const gR = ctx.createLinearGradient(cx-R,cy-R,cx+R,cy+R);
    gR.addColorStop(0,"#FFE566"); gR.addColorStop(.5,"#e99849"); gR.addColorStop(1,"#FFE566");
    ctx.fillStyle = gR; ctx.fill();

    // Yellow base
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2*Math.PI);
    const yB = ctx.createRadialGradient(cx,cy,0,cx,cy,R);
    yB.addColorStop(0,"#FFE84A"); yB.addColorStop(.5,"#FFD020"); yB.addColorStop(1,"#FF9500");
    ctx.fillStyle = yB; ctx.fill();

    // Special segment overlays
    const SEG_COLORS = {
      special_30:{bg:"#CC2136",badge:"#8B0000",text:"#FFD700"},
      special_15:{bg:"#1b459c",badge:"#0D2D6B",text:"#FFD700"},
      viral:{bg:"#64748b",badge:"#374151",text:"#FFFFFF"},
      normal:{bg:null,badge:"#CC2136",text:"#FFFFFF"},
    };
    segs.forEach(({ start, sweep, prize_type, name }) => {
      let segType = "normal";
      if (prize_type==="viral") segType="viral";
      else if (prize_type==="special") segType = (name||"").includes("30")?"special_30":"special_15";
      if (segType==="normal") return;
      const s=start+rot,e=s+sweep;
      ctx.save(); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,s,e); ctx.closePath();
      ctx.fillStyle = SEG_COLORS[segType].bg; ctx.fill(); ctx.restore();
    });

    // Dividers
    segs.forEach(({ start }) => {
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.lineTo(cx+R*Math.cos(start+rot), cy+R*Math.sin(start+rot));
      ctx.strokeStyle="rgba(255,255,255,.7)"; ctx.lineWidth=1.5; ctx.stroke();
    });

    // Badges
    segs.forEach(({ start, sweep, prize_type, name, short_name }) => {
      if (sweep<0.05) return;
      const mid=start+rot+sweep/2;
      let segType="normal";
      if (prize_type==="viral") segType="viral";
      else if (prize_type==="special") segType=(name||"").includes("30")?"special_30":"special_15";
      const col = SEG_COLORS[segType];
      const label = ((short_name||name||"")).toUpperCase();
      if (!label) return;
      const segW = 2*R*0.58*Math.sin(sweep/2);
      const fs = Math.max(6.5, Math.min(10.5, segW*0.38 - label.length*0.12));
      ctx.font = `800 ${fs}px Arial,sans-serif`;
      const tw = ctx.measureText(label).width;
      const padX=5, padY=3, bW=tw+padX*2, bH=fs+padY*2, bCx=R*0.58;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(mid);
      rrect(ctx, bCx-bW/2,-bH/2,bW,bH,3);
      ctx.fillStyle=col.badge; ctx.shadowColor="rgba(0,0,0,.4)"; ctx.shadowBlur=3; ctx.fill();
      ctx.shadowBlur=0; ctx.strokeStyle="rgba(255,255,255,.5)"; ctx.lineWidth=0.8; ctx.stroke();
      ctx.fillStyle=col.text; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(label,bCx,0); ctx.restore();
    });

    // Hub
    const hubR = Math.max(14, R*0.13);
    const chrG = ctx.createRadialGradient(cx-hubR*.3,cy-hubR*.3,1,cx,cy,hubR+8);
    chrG.addColorStop(0,"#f0f0f0"); chrG.addColorStop(.35,"#c8c8c8"); chrG.addColorStop(.7,"#888"); chrG.addColorStop(1,"#aaa");
    ctx.beginPath(); ctx.arc(cx,cy,hubR+8,0,2*Math.PI); ctx.fillStyle=chrG; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,hubR+3,0,2*Math.PI); ctx.fillStyle="rgba(0,0,0,.25)"; ctx.fill();
    const blG = ctx.createRadialGradient(cx-hubR*.35,cy-hubR*.35,0,cx,cy,hubR);
    blG.addColorStop(0,"#6BAAFF"); blG.addColorStop(.4,"#1b65d4"); blG.addColorStop(1,"#0a2a6e");
    ctx.beginPath(); ctx.arc(cx,cy,hubR,0,2*Math.PI); ctx.fillStyle=blG; ctx.fill();
    ctx.beginPath(); ctx.arc(cx-hubR*.28,cy-hubR*.3,hubR*.28,0,2*Math.PI);
    ctx.fillStyle="rgba(255,255,255,.35)"; ctx.fill();

    // Pointer
    ctx.save(); ctx.translate(cx,5);
    ctx.beginPath(); ctx.moveTo(0,17); ctx.lineTo(-11,-1); ctx.lineTo(11,-1); ctx.closePath();
    const pG = ctx.createLinearGradient(0,-1,0,17);
    pG.addColorStop(0,"#FFE566"); pG.addColorStop(1,"#e99849");
    ctx.fillStyle=pG; ctx.shadowColor="rgba(0,0,0,.5)"; ctx.shadowBlur=6; ctx.fill();
    ctx.strokeStyle="#CC8020"; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
  }, [segs]);

  const getTargetRot = useCallback((prizeId) => {
    const idx = segs.findIndex(s => String(s.id) === String(prizeId));
    if (idx<0) return null;
    const mid = segs[idx].mid;
    let base = -Math.PI/2 - mid;
    const min = rotRef.current + 5*2*Math.PI;
    const n = Math.ceil((min - base)/(2*Math.PI));
    return base + n*2*Math.PI;
  }, [segs]);

  useEffect(() => {
    if (!spinning || !winnerId || segs.length===0) return;
    cancelAnimationFrame(rafRef.current);
    const target = getTargetRot(winnerId);
    if (target===null) { onDone?.(); return; }
    const from=rotRef.current, dur=5000, t0=performance.now();
    const ease = t => 1-Math.pow(1-t,4);
    const frame = now => {
      const t=Math.min(1,(now-t0)/dur), r=from+(target-from)*ease(t);
      rotRef.current=r; draw(r);
      if(t<1) rafRef.current=requestAnimationFrame(frame);
      else { rotRef.current=target; draw(target); onDone?.(); }
    };
    rafRef.current=requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, winnerId, draw, getTargetRot, onDone, segs.length]);

  useEffect(() => { draw(rotRef.current); }, [draw]);

  return <canvas ref={ref} width={size} height={size}
    style={{ display:"block", borderRadius:"50%", filter:"drop-shadow(0 4px 16px rgba(0,0,0,.15))" }}/>;
}

/* ─── CONFETTI ─── */
function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const c=ref.current; if(!c)return;
    const ctx=c.getContext("2d");
    c.width=window.innerWidth; c.height=window.innerHeight;
    const particles = Array.from({length:120},()=>({
      x:Math.random()*c.width, y:-10,
      vx:(Math.random()-0.5)*4, vy:Math.random()*4+2,
      r:Math.random()*6+3, color:["#e99849","#1b459c","#FFD700","#fff","#F7D49E"][Math.floor(Math.random()*5)],
      angle:Math.random()*360, spin:Math.random()*10-5
    }));
    let frame = requestAnimationFrame(function loop(){
      ctx.clearRect(0,0,c.width,c.height);
      particles.forEach(p=>{
        p.y+=p.vy; p.x+=p.vx; p.angle+=p.spin;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle*Math.PI/180);
        ctx.fillStyle=p.color; ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r); ctx.restore();
      });
      frame=requestAnimationFrame(loop);
    });
    return ()=>cancelAnimationFrame(frame);
  },[]);
  return <canvas ref={ref} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:999}}/>;
}

/* ─── RESULT MODAL ─── */
function ResultModal({ result, phone, onClose, closeLabel }) {
  if (!result) return null;
  const big   = result.prize_type==="special";
  const viral = result.prize_type==="viral";
  const code  = result.voucher_code;
  const expiry = new Date(); expiry.setDate(expiry.getDate()+30);
  const dd=String(expiry.getDate()).padStart(2,"0");
  const mm=String(expiry.getMonth()+1).padStart(2,"0");
  const yy=String(expiry.getFullYear()).slice(2);
  const hsd = `${dd}/${mm}/${yy}`;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      {big && <Confetti/>}
      <div style={{background:"#fff",borderRadius:24,padding:32,maxWidth:380,width:"100%",textAlign:"center",animation:"bounce-in .4s ease",boxShadow:"0 24px 64px rgba(0,0,0,.3)",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:14,background:"#f1f5f9",border:"none",borderRadius:"50%",width:32,height:32,fontSize:18,cursor:"pointer",color:"#64748b"}}>✕</button>
        <div style={{fontSize:big?72:viral?60:56,marginBottom:8,animation:big?"glow 1.5s infinite":undefined}}>
          {result.prize_icon||"🎁"}
        </div>
        {viral ? (
          <>
            <div style={{fontSize:22,fontWeight:900,color:"#ef4444",marginBottom:6}}>Ôi không!</div>
            <div style={{fontSize:22,fontWeight:900,color:"#1c1917",marginBottom:12}}>Mất Lượt 😅</div>
            <div style={{background:"#fef2f2",borderRadius:12,padding:"12px 16px",fontSize:14,color:"#dc2626",marginBottom:14,lineHeight:1.7}}>
              Chưa trúng lần này, nhưng bạn vẫn được<br/>
              <strong>1 topping miễn phí</strong> hôm nay!<br/>
              <span style={{fontSize:12}}>Đưa màn hình này cho nhân viên nhé 😊</span>
            </div>
          </>
        ) : big ? (
          <>
            <div style={{fontSize:14,fontWeight:700,color:"#92400e",letterSpacing:1,marginBottom:4}}>🎉 CHÚC MỪNG!</div>
            <div style={{fontSize:24,fontWeight:900,color:"#e99849",marginBottom:16}}>{result.prize_name}</div>
            <div style={{background:"#FFF8EE",border:"2px dashed #e99849",borderRadius:12,padding:"14px 16px",lineHeight:1.7,fontSize:14,color:"#92400e"}}>
              Nhân viên SanThai sẽ liên hệ qua<br/>
              <strong style={{fontSize:18,color:"#d4822a"}}>{phone}</strong><br/>
              <span style={{fontSize:12,color:"#a16207"}}>trong vòng 24 giờ để trao giải ✨</span>
            </div>
          </>
        ) : (
          <>
            <div style={{fontSize:14,fontWeight:700,color:"#92400e",letterSpacing:1,marginBottom:4}}>BẠN TRÚNG!</div>
            <div style={{fontSize:22,fontWeight:900,color:"#1c1917",marginBottom:14}}>{result.prize_name}</div>
            {code && code!=="PENDING" ? (
              <>
                <div style={{background:"linear-gradient(135deg,#FFF8EE,#fef3c7)",border:"2px solid #e99849",borderRadius:14,padding:"16px 18px",marginBottom:12}}>
                  <div style={{fontSize:11,color:"#92400e",fontWeight:700,letterSpacing:1,marginBottom:8}}>MÃ VOUCHER CỦA BẠN</div>
                  <div style={{fontSize:30,fontWeight:900,color:"#d4822a",letterSpacing:4,wordBreak:"break-all",marginBottom:4}}>{code}</div>
                </div>
                <div style={{background:"#f0fdf4",border:"2px solid #10b981",borderRadius:12,padding:"13px 16px",fontSize:14,color:"#065f46",lineHeight:1.8,textAlign:"left"}}>
                  🧋 Mã voucher của bạn là <strong style={{color:"#d4822a",fontFamily:"monospace"}}>"{code}"</strong>.<br/>
                  HSD là <strong>{hsd}</strong> <span style={{fontSize:12,color:"#6b7280"}}>(30 ngày từ ngày up lên)</span>.<br/>
                  <span style={{fontSize:13,color:"#047857"}}>Vui lòng lưu mã hoặc chụp màn hình để đổi thưởng nha 📸</span>
                </div>
              </>
            ) : code==="PENDING" ? (
              <div style={{background:"#fffbeb",border:"2px solid #e99849",borderRadius:12,padding:14,fontSize:14,color:"#92400e",lineHeight:1.7}}>
                ⏳ Hệ thống đang xử lý voucher của bạn.<br/>
                Vui lòng đưa màn hình này cho nhân viên<br/>để nhận <strong>{result.prize_name}</strong> miễn phí!
              </div>
            ) : (
              <div style={{background:"#f0fdf4",border:"2px solid #10b981",borderRadius:12,padding:14,fontSize:14,color:"#065f46",lineHeight:1.6}}>
                🧋 Đưa màn hình này cho nhân viên<br/>để nhận <strong>{result.prize_name}</strong> miễn phí!
              </div>
            )}
          </>
        )}
        <button onClick={onClose} style={{marginTop:16,width:"100%",padding:"13px",background:"linear-gradient(135deg,#e99849,#d4822a)",border:"none",borderRadius:12,color:"#fff",fontSize:16,fontWeight:800,cursor:"pointer"}}>
          {closeLabel||"Đóng"}
        </button>
      </div>
    </div>
  );
}

/* ─── TIME AGO ─── */
function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff=Date.now()-new Date(dateStr).getTime(), m=Math.floor(diff/60000);
  if (m<1) return "Vừa xong";
  if (m<60) return `${m} phút trước`;
  const h=Math.floor(m/60);
  if (h<24) return `${h} giờ trước`;
  const d=Math.floor(h/24);
  if (d===1) return "Hôm qua";
  if (d<7) return `${d} ngày trước`;
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

/* ─── CUSTOMER PAGE ─── */
function CustomerPage({ onAdmin }) {
  const [prizes,   setPrizes]   = useState([]);
  const [stats,    setStats]    = useState([]);
  const [settings, setSettings] = useState({
    event_name:"SanThai", event_subtitle:"Vòng Quay May Mắn",
    description:"", show_prize_list:"false",
    bg_color:"#F5F0E8", bg_image_url:"", frame_image_url:"", wheel_image_url:""
  });
  const [bill,       setBill]       = useState("");
  const [phone,      setPhone]      = useState(()=>{ try{return localStorage.getItem("st_phone")||""}catch{return""} });
  const [billQueue,  setBillQueue]  = useState([]);
  const [err,        setErr]        = useState("");
  const [loading,    setLoading]    = useState(false);
  const [spinIdx,    setSpinIdx]    = useState(-1);
  const [spinning,   setSpinning]   = useState(false);
  const [curResult,  setCurResult]  = useState(null);
  const [descOpen,   setDescOpen]   = useState(false);

  const showPrizeList = settings.show_prize_list!=="false";
  const hasBg = settings.bg_image_url&&settings.bg_image_url.startsWith("http");
  const useImageWheel = settings.wheel_image_url&&settings.wheel_image_url.startsWith("http");
  const wheelSize = typeof window!=="undefined" ? Math.min(showPrizeList?300:420,window.innerWidth-48) : 340;
  const bgStyle = hasBg ? {backgroundImage:`url(${settings.bg_image_url})`,backgroundSize:"cover",backgroundPosition:"center"} : {background:settings.bg_color||"#F5F0E8"};

  useEffect(() => {
    loadActivePrizes().then(setPrizes);
    loadStoreStats().then(setStats);
    loadSettings().then(s=>{ if(Object.keys(s).length) setSettings(prev=>({...prev,...s})); });
    const t=setInterval(()=>loadStoreStats().then(setStats),60000);
    return()=>clearInterval(t);
  },[]);

  const handleBillChange = v => { setBill(v.toUpperCase()); setErr(""); };

  const handleAddBill = async () => {
    const b=bill.trim().toUpperCase(), p=phone.replace(/\D/g,"");
    if(!b||b.length<4) return setErr("Vui lòng nhập mã bill hợp lệ.");
    if(p.length<9||p.length>11) return setErr("Số điện thoại không hợp lệ.");
    if(billQueue.some(q=>q.billCode===b)) return setErr("Mã bill này đã thêm vào rồi.");
    setLoading(true); setErr("");
    try{ localStorage.setItem("st_phone",p); }catch{}
    const store=detectStore(b);
    const res=await doSpin(b,p,store.id||null,store.name||null);
    setLoading(false);
    if(!res||res.error==="network") return setErr("Không kết nối được. Kiểm tra mạng.");
    if(res.error==="bill_used") return setErr("Mã bill này đã được sử dụng rồi.");
    if(res.error==="setup_required") return setErr("Hệ thống chưa sẵn sàng. Liên hệ quản lý.");
    if(res.error) return setErr(res.message||"Lỗi hệ thống, thử lại.");
    if(res.ok){ setBillQueue(q=>[...q,{billCode:b,store:store.name,result:res}]); setBill(""); }
  };

  const handleStartSpin = () => {
    if(billQueue.length===0||spinning) return;
    setSpinIdx(0); setSpinning(true);
  };

  const handleSpinDone = useCallback(()=>{
    setTimeout(()=>{ setCurResult(billQueue[spinIdx]?.result||null); setSpinning(false); },400);
  },[spinIdx,billQueue]);

  const handleNextSpin = () => {
    setCurResult(null);
    const next=spinIdx+1;
    if(next<billQueue.length){ setSpinIdx(next); setSpinning(true); }
    else{ setSpinIdx(-1); setBillQueue([]); }
  };

  const currentPrize = (spinning||curResult) ? billQueue[spinIdx]?.result : null;
  const tooManySpins = billQueue.length>=5;

  return (
    <div style={{minHeight:"100vh",...bgStyle}}>
      <style>{G}</style>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#e99849,#d4822a)",padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:24,fontWeight:900,color:"#fff",fontFamily:"'Nunito',sans-serif",letterSpacing:1}}>
            🎯 {settings.event_name||"SanThai"}
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.85)",fontWeight:600}}>
            {settings.event_subtitle||"Vòng Quay May Mắn"}
          </div>
        </div>
        <div onClick={onAdmin} style={{fontSize:11,color:"rgba(255,255,255,.3)",cursor:"default",userSelect:"none"}}>v2</div>
      </div>

      {/* Main */}
      <div style={{display:"flex",flexWrap:"wrap",minHeight:"calc(100vh - 80px - 60px)"}}>
        {/* LEFT */}
        <div style={{flex:"1 1 320px",padding:"28px 24px",background:"rgba(255,255,255,.92)",borderRight:"1px solid #f0e6d3",display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:"#FFF8EE",borderRadius:10,padding:"10px 14px",borderLeft:"4px solid #e99849",fontSize:13,color:"#92400e",lineHeight:1.6}}>
            ⚠️ Mã bill sẽ được đối chiếu POS cuối ngày. Dùng mã không hợp lệ có thể bị hạn chế tham gia.
          </div>
          {settings.description&&(
            <div>
              <button onClick={()=>setDescOpen(o=>!o)} style={{background:"rgba(233,152,73,.1)",border:"1px solid rgba(233,152,73,.3)",borderRadius:8,padding:"8px 14px",fontSize:13,color:"#d4822a",fontWeight:700,cursor:"pointer",width:"100%",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>📋 Thể lệ & Thông tin sự kiện</span><span>{descOpen?"▲":"▼"}</span>
              </button>
              {descOpen&&<div style={{background:"#FFF8EE",borderRadius:"0 0 10px 10px",padding:"12px 14px",fontSize:14,color:"#78350f",lineHeight:1.8,whiteSpace:"pre-wrap",borderTop:"1px solid #fed7aa"}}>{settings.description}</div>}
            </div>
          )}
          <div>
            <label style={{display:"block",fontSize:14,fontWeight:700,color:"#44403c",marginBottom:8}}>📱 Số điện thoại</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" placeholder="VD: 0901234567" maxLength={11}
              style={{width:"100%",padding:"12px 14px",border:"2px solid #e8d5b7",borderRadius:10,fontSize:15,color:"#1c1917"}}/>
            <div style={{fontSize:12,color:"#a8a29e",marginTop:4}}>Số được lưu để không cần nhập lại lần sau</div>
          </div>
          <div>
            <label style={{display:"block",fontSize:14,fontWeight:700,color:"#44403c",marginBottom:8}}>🧾 Mã bill (in trên hóa đơn)</label>
            <input value={bill} onChange={e=>handleBillChange(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleAddBill()}
              placeholder="VD: SXVNT212106" maxLength={30} disabled={loading||spinning} autoCapitalize="characters"
              style={{width:"100%",padding:"13px 16px",border:`2px solid ${detectStore(bill).name?"#10b981":"#e8d5b7"}`,borderRadius:10,fontSize:16,fontWeight:700,letterSpacing:1,color:"#1c1917"}}/>
            {detectStore(bill).name ? (
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
                <span>🏪</span><span style={{fontSize:13,color:"#059669",fontWeight:700}}>{detectStore(bill).name}</span>
              </div>
            ) : bill.length>=2 ? (
              <div style={{fontSize:12,color:"#e99849",marginTop:4}}>⚠ Không nhận ra mã CH — vẫn có thể quay</div>
            ) : null}
          </div>
          {err&&<div style={{background:"#fef2f2",border:"2px solid #fecaca",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#dc2626"}}>{err}</div>}
          {tooManySpins&&<div style={{background:"#fef2f2",border:"2px solid #ef4444",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#dc2626",lineHeight:1.6}}>⚠️ Tích lũy nhiều bill sẽ được kiểm tra kỹ trong đợt đối chiếu cuối ngày.</div>}
          <button onClick={handleAddBill} disabled={loading||spinning||!bill.trim()}
            style={{padding:"14px",background:bill.trim()&&!loading&&!spinning?"#e99849":"#e5e7eb",border:"none",borderRadius:12,
              color:bill.trim()&&!loading&&!spinning?"#fff":"#9ca3af",fontSize:16,fontWeight:700,
              cursor:bill.trim()&&!loading&&!spinning?"pointer":"not-allowed",
              boxShadow:bill.trim()&&!loading&&!spinning?"0 4px 20px rgba(233,152,73,.4)":"none",transition:"background .2s"}}>
            {loading?"⏳ Đang xác nhận…":"🎡 NHẬN LƯỢT QUAY"}
          </button>
          {billQueue.length>0&&(
            <div style={{background:"#f0fdf4",borderRadius:12,padding:"12px 14px",border:"2px solid #a7f3d0"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#065f46",marginBottom:8}}>🎯 Đã nhận {billQueue.length} lượt quay:</div>
              {billQueue.map((q,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#374151",marginBottom:4,padding:"4px 0",borderBottom:"1px solid #d1fae5"}}>
                  <span style={{fontFamily:"monospace",fontWeight:700}}>{q.billCode}</span>
                  <span style={{color:"#6b7280"}}>{q.store||"—"}</span>
                  <span style={{color:i<spinIdx?"#10b981":i===spinIdx&&spinning?"#e99849":"#94a3b8"}}>
                    {i<spinIdx?"✓ Đã quay":i===spinIdx&&spinning?"🌀 Đang quay…":"⏳ Chờ"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{fontSize:11,color:"#a8a29e",textAlign:"center"}}>Mỗi mã bill chỉ dùng được 1 lần</div>
        </div>

        {/* RIGHT */}
        <div style={{flex:"1 1 320px",padding:"28px 20px",background:"rgba(255,247,237,.7)",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
          <div style={{background:billQueue.length>0&&spinIdx<0?"#e99849":"#F0F0F0",borderRadius:50,padding:"8px 22px",fontSize:16,fontWeight:800,
            color:billQueue.length>0&&spinIdx<0?"#fff":"#888888",
            boxShadow:billQueue.length>0&&spinIdx<0?"0 4px 16px rgba(233,152,73,.45)":"none",
            animation:billQueue.length>0&&spinIdx<0?"pulse-ring 1.5s infinite":"none",transition:"all .35s ease"}}>
            🎯 {Math.max(0,billQueue.length-Math.max(0,spinIdx))} lượt quay
            {spinIdx>=0&&spinning&&` — Lượt ${spinIdx+1}/${billQueue.length}`}
          </div>

          <div style={{position:"relative",display:"inline-block"}}>
            {useImageWheel ? (
              <WheelImageSpinner prizes={prizes} winnerId={currentPrize?.prize_id}
                spinning={spinning} onDone={handleSpinDone} size={wheelSize} imageUrl={settings.wheel_image_url}/>
            ) : (
              <WheelCanvas prizes={prizes} winnerId={currentPrize?.prize_id}
                spinning={spinning} onDone={handleSpinDone} size={wheelSize}/>
            )}
            {settings.frame_image_url&&settings.frame_image_url.startsWith("http")&&(
              <img src={settings.frame_image_url} alt="" style={{position:"absolute",inset:-10,width:"calc(100% + 20px)",height:"calc(100% + 20px)",pointerEvents:"none",objectFit:"contain"}}/>
            )}
          </div>

          <div style={{display:"flex",gap:10}}>
            <button onClick={handleStartSpin} disabled={billQueue.length===0||spinning||spinIdx>=0}
              style={{padding:"14px 28px",fontSize:17,fontWeight:900,border:"none",borderRadius:50,
                cursor:billQueue.length>0&&!spinning&&spinIdx<0?"pointer":"not-allowed",
                background:billQueue.length>0&&!spinning&&spinIdx<0?"linear-gradient(135deg,#7c3aed,#6d28d9)":"#e5e7eb",
                color:billQueue.length>0&&!spinning&&spinIdx<0?"#fff":"#9ca3af",
                boxShadow:billQueue.length>0&&!spinning&&spinIdx<0?"0 6px 24px rgba(124,58,237,.5)":"none",
                animation:billQueue.length>0&&!spinning&&spinIdx<0?"pulse-ring 1.5s infinite":"none"}}>
              {spinning?"🌀 Đang quay…":billQueue.length>0&&spinIdx<0?"🎰 QUAY NGAY!":"Nhập bill trước"}
            </button>
          </div>

          {showPrizeList&&prizes.length>0&&(
            <div style={{width:"100%",maxWidth:400}}>
              <div style={{fontSize:13,fontWeight:700,color:"#92400e",marginBottom:8,textAlign:"center"}}>Danh sách phần thưởng</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:6}}>
                {prizes.map((p,i)=>(
                  <div key={p.id} style={{background:"#fff",borderRadius:10,padding:"8px 6px",textAlign:"center",border:"2px solid #fed7aa",fontSize:11,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:WHEEL_COLORS[i%WHEEL_COLORS.length]}}/>
                    <div style={{fontSize:16}}>{p.icon}</div>
                    <div style={{fontWeight:700,color:"#44403c",lineHeight:1.3}}>{p.short_name||p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{background:"rgba(255,255,255,.95)",borderTop:"2px solid #e99849",padding:"28px 24px"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <div style={{fontSize:20,fontWeight:900,color:"#1b459c",marginBottom:4,fontFamily:"'Nunito',sans-serif"}}>🐱 Bảng xếp hạng cửa hàng</div>
          <div style={{fontSize:13,color:"#78716c",marginBottom:16}}>Cập nhật mỗi phút</div>
          <div style={{overflowX:"auto",borderRadius:14,border:"2px solid #e99849",boxShadow:"0 2px 12px rgba(233,152,73,.12)"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
              <thead>
                <tr style={{background:"#1b459c"}}>
                  {["#","Cửa hàng","Tổng lượt quay","Giải lớn 🏆","Hoạt động gần nhất"].map(h=>(
                    <th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:13,fontWeight:600,color:"#FFFFFF",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.length===0 ? (
                  <tr><td colSpan={5} style={{padding:24,textAlign:"center",color:"#a8a29e",fontSize:14}}>Chưa có dữ liệu — event chưa bắt đầu</td></tr>
                ) : stats.map((s,i)=>(
                  <tr key={s.store_id} style={{borderTop:"1px solid #e8d5b7",background:i%2===0?"#FFFFFF":"#FFF8EE"}}>
                    <td style={{padding:"11px 14px",fontWeight:900,color:i<3?"#e99849":"#78716c",fontSize:16}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
                    <td style={{padding:"11px 14px",fontWeight:700,color:"#1c1917"}}>{s.store_name||s.store_id}</td>
                    <td style={{padding:"11px 14px",color:"#e99849",fontWeight:800,fontSize:16}}>{s.total_spins}</td>
                    <td style={{padding:"11px 14px"}}>
                      {s.big_wins>0 ? <span style={{background:"#FFF8EE",border:"2px solid #e99849",borderRadius:20,padding:"3px 10px",fontSize:13,fontWeight:800,color:"#1b459c"}}>🏆 {s.big_wins}</span>
                      : <span style={{color:"#a8a29e",fontSize:13}}>—</span>}
                    </td>
                    <td style={{padding:"11px 14px",color:"#78716c",fontSize:13}}>{timeAgo(s.last_spin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {curResult&&<ResultModal result={curResult} phone={phone} onClose={handleNextSpin}
        closeLabel={spinIdx<billQueue.length-1?`Quay lượt ${spinIdx+2} →`:"Xong 🎉"}/>}
    </div>
  );
}

/* ─── TEST MODE PANEL ─── */
function buildTestSequence(prizes) {
  if(!prizes.length) return [];
  const seq=[...prizes];
  while(seq.length<30) seq.push(prizes[Math.floor(Math.random()*prizes.length)]);
  for(let i=seq.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[seq[i],seq[j]]=[seq[j],seq[i]];}
  return seq.slice(0,30);
}

function TestModePanel({ allPrizes }) {
  const [seq,setSeq]=useState([]);
  const [idx,setIdx]=useState(-1);
  const [done,setDone]=useState(false);
  const [preview,setPreview]=useState(null);

  const start=()=>{
    const active=allPrizes.filter(p=>p.active);
    if(!active.length){alert("Chưa có giải nào active. Load giải mặc định trước.");return;}
    setSeq(buildTestSequence(active));setIdx(0);setDone(false);
  };
  const next=()=>{ if(idx<seq.length-1)setIdx(i=>i+1); else setDone(true); };
  const cur=seq[idx];

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div>
        <h3 style={{fontSize:15,fontWeight:800,marginBottom:10}}>🎰 30-lượt test — cover toàn bộ giải</h3>
        <div style={{background:"#f0fdf4",border:"1px solid #a7f3d0",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#065f46",lineHeight:1.6}}>
          Sequence 30 lượt tự động cover đủ tất cả {allPrizes.filter(p=>p.active).length} giải active. Không ghi vào DB.
        </div>
        {idx<0&&!done&&<button onClick={start} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",border:"none",borderRadius:12,color:"#fff",fontSize:16,fontWeight:800,cursor:"pointer",marginBottom:12}}>▶ Bắt đầu test 30 lượt</button>}
        {idx>=0&&!done&&cur&&(
          <div style={{background:"#fff",border:"2px solid #7c3aed",borderRadius:14,padding:20,textAlign:"center"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#7c3aed",letterSpacing:1,marginBottom:4}}>LƯỢT {idx+1}/30</div>
            <div style={{fontSize:48,marginBottom:8}}>{cur.icon||"🎁"}</div>
            <div style={{fontSize:20,fontWeight:900,marginBottom:4}}>{cur.name}</div>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:14}}>Loại: <strong>{cur.prize_type}</strong></div>
            {cur.prize_type==="normal"&&cur.has_voucher&&<div style={{background:"#fef3c7",border:"2px solid #e99849",borderRadius:10,padding:10,marginBottom:14,fontFamily:"monospace",fontWeight:900,fontSize:18,color:"#92400e",letterSpacing:3}}>TEST-{String(idx+1).padStart(3,"0")}</div>}
            <button onClick={next} style={{padding:"11px 30px",background:"linear-gradient(135deg,#e99849,#d4822a)",border:"none",borderRadius:10,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer"}}>
              {idx<seq.length-1?"Lượt tiếp →":"✅ Kết thúc"}
            </button>
          </div>
        )}
        {done&&<div style={{background:"#f0fdf4",border:"2px solid #10b981",borderRadius:14,padding:20,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:8}}>🎉</div>
          <div style={{fontSize:20,fontWeight:900,color:"#065f46",marginBottom:4}}>Test hoàn thành!</div>
          <button onClick={()=>{setIdx(-1);setDone(false);setSeq([]);}} style={{padding:"10px 24px",background:"#f3f4f6",border:"none",borderRadius:10,color:"#374151",fontWeight:700,cursor:"pointer"}}>Reset</button>
        </div>}
      </div>
      <div>
        <h3 style={{fontSize:15,fontWeight:800,marginBottom:10}}>👁 Preview từng giải</h3>
        <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:380,overflowY:"auto"}}>
          {allPrizes.filter(p=>p.active).map(p=>(
            <button key={p.id} onClick={()=>setPreview(p)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:preview?.id===p.id?"#FFF8EE":"#fff",border:`1px solid ${preview?.id===p.id?"#e99849":"#e5e7eb"}`,borderRadius:10,cursor:"pointer",textAlign:"left"}}>
              <span style={{fontSize:22}}>{p.icon||"🎁"}</span>
              <div><div style={{fontWeight:700,fontSize:14}}>{p.name}</div><div style={{fontSize:11,color:"#9ca3af"}}>{p.prize_type} · {p.probability}%</div></div>
            </button>
          ))}
        </div>
        {preview&&<div style={{marginTop:12,background:"#fff",border:"2px solid #e99849",borderRadius:14,padding:16,textAlign:"center"}}>
          <div style={{fontSize:44,marginBottom:6}}>{preview.icon||"🎁"}</div>
          <div style={{fontSize:18,fontWeight:900}}>{preview.name}</div>
          {preview.prize_type==="normal"&&preview.has_voucher&&<div style={{margin:"10px 0",background:"#fef3c7",border:"2px solid #e99849",borderRadius:8,padding:8,fontFamily:"monospace",fontWeight:900,fontSize:16,letterSpacing:3,color:"#92400e"}}>ABCD1234</div>}
          {preview.prize_type==="special"&&<div style={{margin:"10px 0",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:8,fontSize:13,color:"#dc2626"}}>Nhân viên liên hệ SĐT</div>}
          {preview.prize_type==="viral"&&<div style={{margin:"10px 0",fontSize:13,color:"#ef4444",fontWeight:700}}>😅 Mất lượt — nhận 1 topping tự chọn</div>}
        </div>}
      </div>
    </div>
  );
}

/* ─── VOUCHER DETAIL PANEL ─── */
function VoucherDetailPanel({ prizes }) {
  const [selPrize,setSelPrize]=useState("");
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(false);
  const [selected,setSelected]=useState(new Set());
  const [filterSt,setFilterSt]=useState("all");
  const [msg,setMsg]=useState("");

  const fetchVouchers=useCallback(async()=>{
    if(!selPrize){setItems([]);return;}
    setLoading(true);
    const data=await loadPrizeVouchers(+selPrize,filterSt==="all"?null:filterSt);
    setItems(Array.isArray(data)?data:[]); setSelected(new Set()); setLoading(false);
  },[selPrize,filterSt]);

  useEffect(()=>{fetchVouchers();},[fetchVouchers]);

  const inp2={border:"1px solid #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:14,color:"#1c1917",background:"#fff"};
  const th2={padding:"8px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#6b7280",borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap"};
  const td2={padding:"8px 12px",borderBottom:"1px solid #f3f4f6",fontSize:13,verticalAlign:"middle"};
  const SC={unused:"#10b981",assigned:"#e99849",redeemed:"#6b7280",voided:"#ef4444"};
  const SL={unused:"Chưa cấp",assigned:"Đã cấp",redeemed:"Đã dùng",voided:"Đã hủy"};

  return (
    <div>
      <h3 style={{fontSize:15,fontWeight:800,marginBottom:10}}>🔍 Quản lý voucher chi tiết</h3>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <select value={selPrize} onChange={e=>setSelPrize(e.target.value)} style={{...inp2,minWidth:200}}>
          <option value="">-- Chọn giải --</option>
          {prizes.filter(p=>p.prize_type==="normal"&&p.has_voucher).map(p=>(
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={filterSt} onChange={e=>setFilterSt(e.target.value)} style={inp2}>
          <option value="all">Tất cả</option>
          <option value="unused">Chưa cấp</option>
          <option value="assigned">Đã cấp</option>
          <option value="redeemed">Đã dùng</option>
          <option value="voided">Đã hủy</option>
        </select>
        {selected.size>0&&<button onClick={async()=>{
          if(!confirm(`Xóa ${selected.size} voucher?`))return;
          await bulkDeleteVouchers([...selected]);
          setMsg(`✅ Đã xóa ${selected.size} voucher`); setTimeout(()=>setMsg(""),3000); fetchVouchers();
        }} style={{...inp2,background:"#fef2f2",borderColor:"#fca5a5",color:"#dc2626",cursor:"pointer",fontWeight:700}}>🗑 Xóa {selected.size} mã</button>}
        {items.filter(v=>v.status==="unused").length>0&&<button onClick={async()=>{
          const ids=items.filter(v=>v.status==="unused").map(v=>v.id);
          if(!confirm(`Xóa ${ids.length} voucher CHƯA CẤP?`))return;
          await bulkDeleteVouchers(ids); setMsg(`✅ Đã xóa ${ids.length} voucher`); setTimeout(()=>setMsg(""),3000); fetchVouchers();
        }} style={{...inp2,background:"#fef2f2",borderColor:"#fca5a5",color:"#dc2626",cursor:"pointer",fontWeight:700}}>
          🗑 Xóa toàn bộ chưa cấp ({items.filter(v=>v.status==="unused").length})
        </button>}
      </div>
      {msg&&<div style={{color:"#10b981",fontWeight:700,fontSize:14,marginBottom:10,background:"#f0fdf4",border:"1px solid #a7f3d0",borderRadius:8,padding:"8px 12px"}}>{msg}</div>}
      {!selPrize ? <div style={{padding:24,textAlign:"center",color:"#9ca3af",border:"2px dashed #e5e7eb",borderRadius:12}}>Chọn giải thưởng để xem danh sách voucher</div>
      : loading ? <div style={{padding:24,textAlign:"center",color:"#9ca3af"}}>Đang tải…</div>
      : (
        <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#f9fafb"}}>
              <th style={{...th2,width:36}}><input type="checkbox" onChange={e=>{if(e.target.checked)setSelected(new Set(items.map(v=>v.id)));else setSelected(new Set());}} checked={selected.size===items.length&&items.length>0}/></th>
              {["Mã Voucher","Trạng thái","Bill","SĐT","Ngày tạo",""].map(h=><th key={h} style={th2}>{h}</th>)}
            </tr></thead>
            <tbody>
              {items.length===0 ? <tr><td colSpan={7} style={{...td2,textAlign:"center",color:"#9ca3af"}}>Không có voucher</td></tr>
              : items.map(v=>(
                <tr key={v.id}>
                  <td style={td2}><input type="checkbox" checked={selected.has(v.id)} onChange={e=>{const ns=new Set(selected);e.target.checked?ns.add(v.id):ns.delete(v.id);setSelected(ns);}}/></td>
                  <td style={{...td2,fontFamily:"monospace",fontWeight:700,fontSize:14}}>{v.code}</td>
                  <td style={td2}><span style={{background:`${SC[v.status]}20`,color:SC[v.status],border:`1px solid ${SC[v.status]}44`,borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{SL[v.status]||v.status}</span></td>
                  <td style={{...td2,fontFamily:"monospace",fontSize:12,color:"#6b7280"}}>{v.assigned_bill||"—"}</td>
                  <td style={{...td2,fontSize:12,color:"#6b7280"}}>{v.assigned_phone||"—"}</td>
                  <td style={{...td2,fontSize:12,color:"#9ca3af"}}>{v.created_at?new Date(v.created_at).toLocaleDateString("vi-VN"):"—"}</td>
                  <td style={td2}>{v.status==="unused"&&<button onClick={async()=>{if(!confirm("Xóa voucher này?"))return;await deleteVoucher(v.id);fetchVouchers();}} style={{padding:"3px 10px",borderRadius:6,border:"1px solid #fecaca",background:"#fff",color:"#ef4444",cursor:"pointer",fontSize:12}}>🗑</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{padding:"8px 12px",fontSize:12,color:"#9ca3af"}}>{items.length} voucher</div>
        </div>
      )}
    </div>
  );
}

/* ─── ADMIN PAGE ─── */
const ADMIN_TOKEN = typeof btoa!=="undefined" ? btoa(ADMIN_PWD+"_st26") : "";

function AdminPage({ onBack }) {
  const [authed, setAuthed] = useState(false);
  const [pwd,    setPwd]    = useState("");
  const [pwdErr, setPwdErr] = useState("");

  const [tab,     setTab]    = useState("settings");
  const [loading, setLoading]= useState(false);
  const [dbStatus,setDbStatus]=useState(null);

  const [prizes,  setPrizes] = useState([]);
  const [spins,   setSpins]  = useState([]);
  const [specials,setSpecials]=useState([]);
  const [bl,      setBl]     = useState([]);
  const [vouchers,setVouchers]=useState([]);
  const [date,    setDate]   = useState(new Date().toISOString().slice(0,10));

  const [adminSettings, setAdminSettings] = useState({
    event_name:"",event_subtitle:"",description:"",
    show_prize_list:"false",bg_color:"#F5F0E8",
    bg_image_url:"",frame_image_url:"",wheel_image_url:""
  });
  const [settingsSaved, setSettingsSaved] = useState("");

  useEffect(()=>{
    try{ if(localStorage.getItem("santhai_admin_v2")===ADMIN_TOKEN)setAuthed(true); }catch{}
  },[]);

  const doLogin=()=>{
    if(pwd===ADMIN_PWD){ localStorage.setItem("santhai_admin_v2",ADMIN_TOKEN); setAuthed(true); }
    else setPwdErr("Sai mật khẩu");
  };
  const doLogout=()=>{ localStorage.removeItem("santhai_admin_v2"); window.location.replace(window.location.origin); };

  const TABS=[
    {id:"settings",  label:"⚙️ Cài đặt"},
    {id:"prizes",    label:"🎁 Cấu hình giải"},
    {id:"spins",     label:"📋 Lịch sử"},
    {id:"reconcile", label:"🔍 Đối chiếu"},
    {id:"vouchers",  label:"🎟 Vouchers"},
    {id:"vdetail",   label:"🔧 Chi tiết voucher"},
    {id:"test",      label:"🧪 Test Mode"},
    {id:"special",   label:"🏆 Giải đặc biệt"},
    {id:"blacklist", label:"🚫 Blacklist"},
  ];

  const loadAll=useCallback(async()=>{
    setLoading(true);
    const conn=await testConnection();
    setDbStatus(conn.ok?"ok":conn.error||"error");
    if(conn.ok){
      const [p,s,sp,b,v,cfg]=await Promise.all([
        loadAllPrizes(),loadSpins(date),loadSpecialWinners(),loadBlacklist(),loadVouchers(),loadSettings(),
      ]);
      setPrizes(Array.isArray(p)?p:[]); setSpins(Array.isArray(s)?s:[]);
      setSpecials(Array.isArray(sp)?sp:[]); setBl(Array.isArray(b)?b:[]);
      setVouchers(Array.isArray(v)?v:[]);
      if(cfg&&Object.keys(cfg).length) setAdminSettings(prev=>({...prev,...cfg}));
    }
    setLoading(false);
  },[date]);

  useEffect(()=>{ if(authed)loadAll(); },[authed,loadAll]);

  const inp={border:"1px solid #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:14,color:"#1c1917",background:"#fff",fontFamily:"inherit"};
  const th={padding:"8px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#6b7280",borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap"};
  const td={padding:"8px 12px",borderBottom:"1px solid #f3f4f6",fontSize:13,verticalAlign:"middle"};

  if(!authed) return (
    <div style={{minHeight:"100vh",background:"#F5F0E8",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{G}</style>
      <div style={{background:"#fff",borderRadius:20,padding:32,maxWidth:360,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,.12)"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:8}}>🎰</div>
          <div style={{fontSize:22,fontWeight:900,color:"#1b459c",fontFamily:"'Nunito',sans-serif"}}>Admin — SanThai Spin</div>
        </div>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="Mật khẩu admin"
          style={{...inp,width:"100%",marginBottom:12}}/>
        {pwdErr&&<div style={{color:"#dc2626",fontSize:13,marginBottom:8}}>{pwdErr}</div>}
        <button onClick={doLogin} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#e99849,#d4822a)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer"}}>Đăng nhập</button>
        <button onClick={onBack} style={{width:"100%",marginTop:10,padding:"10px",background:"#f1f5f9",border:"none",borderRadius:12,color:"#374151",fontWeight:700,cursor:"pointer"}}>← Quay lại</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#F5F0E8"}}>
      <style>{G}</style>
      <div style={{background:"linear-gradient(135deg,#e99849,#d4822a)",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:18,fontWeight:900,color:"#fff",fontFamily:"'Nunito',sans-serif"}}>🎰 Admin — SanThai Spin</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {dbStatus==="ok"?<span style={{fontSize:12,color:"rgba(255,255,255,.8)"}}>✅ DB</span>:<span style={{fontSize:12,color:"#fecaca"}}>❌ DB lỗi</span>}
          <button onClick={loadAll} disabled={loading} style={{padding:"6px 14px",background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.4)",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>
            {loading?"⏳":"🔄"} Làm mới
          </button>
          <button onClick={doLogout} style={{padding:"6px 14px",background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:13}}>← Thoát</button>
        </div>
      </div>

      <div style={{display:"flex",gap:6,padding:"12px 16px",background:"rgba(255,255,255,.8)",borderBottom:"1px solid #e8d5b7",flexWrap:"wrap"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",borderRadius:8,border:"none",fontSize:13,fontWeight:700,cursor:"pointer",
            background:tab===t.id?"#e99849":"#f3f4f6",color:tab===t.id?"#fff":"#374151"}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:20,maxWidth:1200,margin:"0 auto"}}>

        {/* ── CÀI ĐẶT ── */}
        {tab==="settings"&&(
          <div style={{maxWidth:620}}>
            <h3 style={{fontSize:16,fontWeight:900,marginBottom:16}}>⚙️ Cài đặt sự kiện</h3>
            {[
              {key:"event_name",      label:"Tên sự kiện",        placeholder:"SanThai",type:"text",hint:"Hiển thị ở header"},
              {key:"event_subtitle",  label:"Tagline / Phụ đề",   placeholder:"Vòng Quay May Mắn — Thất Kiếm Lệnh",type:"text",hint:"Dòng nhỏ dưới tên"},
              {key:"bg_color",        label:"Màu nền (nếu không dùng ảnh)",placeholder:"#F5F0E8",type:"color",hint:""},
              {key:"bg_image_url",    label:"URL ảnh nền",         placeholder:"https://...",type:"url",hint:"Để trống nếu dùng màu nền"},
              {key:"wheel_image_url", label:"⭐ URL ảnh vòng quay tùy chỉnh",placeholder:"https://... (PNG/JPG vòng quay đầy đủ)",type:"url",hint:"Nếu điền → dùng ảnh thay vì canvas. Ô số 1 (ngay bên phải mũi tên 12h, chiều CW) phải khớp giải đầu tiên trong DB"},
              {key:"frame_image_url", label:"URL ảnh khung vòng quay (tùy chọn)",placeholder:"https://... (PNG trong suốt, chỉ phần viền)",type:"url",hint:"Overlay decorative lên vòng quay"},
            ].map(({key,label,placeholder,type,hint})=>(
              <div key={key} style={{marginBottom:16}}>
                <label style={{fontSize:13,fontWeight:700,display:"block",marginBottom:4,color:"#374151"}}>{label}</label>
                {type==="color" ? (
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <input type="color" value={adminSettings[key]||"#F5F0E8"} onChange={e=>setAdminSettings(p=>({...p,[key]:e.target.value}))} style={{width:50,height:38,border:"1px solid #d1d5db",borderRadius:8,cursor:"pointer",padding:2}}/>
                    <input type="text" value={adminSettings[key]||""} onChange={e=>setAdminSettings(p=>({...p,[key]:e.target.value}))} placeholder={placeholder} style={{...inp,flex:1}}/>
                  </div>
                ) : <input type={type==="url"?"text":type} value={adminSettings[key]||""} onChange={e=>setAdminSettings(p=>({...p,[key]:e.target.value}))} placeholder={placeholder} style={{...inp,width:"100%"}}/>}
                {hint&&<div style={{fontSize:12,color:"#9ca3af",marginTop:3}}>{hint}</div>}
              </div>
            ))}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:13,fontWeight:700,display:"block",marginBottom:4,color:"#374151"}}>Thể lệ / Mô tả sự kiện</label>
              <textarea value={adminSettings.description||""} onChange={e=>setAdminSettings(p=>({...p,description:e.target.value}))}
                rows={6} placeholder={"VD:\n- Mỗi hóa đơn từ 3 ly trở lên được 1 lượt quay\n- Phần thưởng quy đổi trong vòng 30 ngày\n- Hotline: 1900..."}
                style={{...inp,width:"100%",resize:"vertical",lineHeight:1.7}}/>
              <div style={{fontSize:12,color:"#9ca3af",marginTop:3}}>Hiển thị ở nút "Thể lệ & Thông tin" trên trang khách</div>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:10,cursor:"pointer",color:"#374151"}}>
                <input type="checkbox" checked={adminSettings.show_prize_list==="true"} onChange={e=>setAdminSettings(p=>({...p,show_prize_list:e.target.checked?"true":"false"}))} style={{width:18,height:18}}/>
                Hiển thị danh sách phần thưởng (ở trang khách)
              </label>
            </div>
            <button onClick={async()=>{
              setSettingsSaved("⏳ Đang lưu…");
              const results=await Promise.all(Object.entries(adminSettings).map(([k,v])=>saveSetting(k,v)));
              const allOk=results.every(Boolean);
              setSettingsSaved(allOk?"✅ Đã lưu! F5 trang khách để thấy thay đổi.":"❌ Lưu thất bại — chạy schema_settings.sql trong Supabase chưa?");
              setTimeout(()=>setSettingsSaved(""),6000);
            }} style={{padding:"12px 28px",background:"linear-gradient(135deg,#e99849,#d4822a)",border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer"}}>
              💾 Lưu cài đặt
            </button>
            {settingsSaved&&<div style={{marginTop:10,fontSize:14,color:settingsSaved.startsWith("✅")?"#10b981":"#dc2626",fontWeight:700}}>{settingsSaved}</div>}
          </div>
        )}

        {/* ── CẤU HÌNH GIẢI ── */}
        {tab==="prizes"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <h3 style={{fontSize:16,fontWeight:900,margin:0}}>🎁 Cấu hình giải thưởng</h3>
              <button onClick={async()=>{
                if(!confirm("Reset về 16 giải mặc định? Dữ liệu giải hiện tại sẽ bị ghi đè."))return;
                await resetDefaultPrizes(); loadAll();
              }} style={{padding:"8px 16px",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,color:"#dc2626",fontWeight:700,cursor:"pointer",fontSize:13}}>
                🔄 Load giải mặc định
              </button>
            </div>
            <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f9fafb"}}>
                  {["Tên giải","Short name","Loại","Xác suất %","Voucher","Icon","Active",""].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {prizes.length===0 ? <tr><td colSpan={8} style={{...td,textAlign:"center",color:"#9ca3af"}}>Chưa có giải — nhấn Load giải mặc định</td></tr>
                  : prizes.map(p=>(
                    <tr key={p.id}>
                      <td style={{...td,fontWeight:700}}>{p.name}</td>
                      <td style={{...td,color:"#6b7280",fontSize:12}}>{p.short_name||"—"}</td>
                      <td style={td}><span style={{background:p.prize_type==="special"?"#fef3c7":p.prize_type==="viral"?"#f3f4f6":"#f0fdf4",color:p.prize_type==="special"?"#92400e":p.prize_type==="viral"?"#374151":"#065f46",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{p.prize_type}</span></td>
                      <td style={{...td,fontWeight:700,color:"#e99849"}}>{p.probability}%</td>
                      <td style={td}>{p.has_voucher?"✅":"—"}</td>
                      <td style={{...td,fontSize:20}}>{p.icon}</td>
                      <td style={td}>{p.active?"🟢":"⚪"}</td>
                      <td style={td}><button onClick={async()=>{ if(!confirm(`Xóa giải "${p.name}"?`))return; await deletePrize(p.id); loadAll(); }} style={{padding:"3px 10px",borderRadius:6,border:"1px solid #fecaca",background:"#fff",color:"#ef4444",cursor:"pointer",fontSize:12}}>🗑</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── LỊCH SỬ ── */}
        {tab==="spins"&&(
          <div>
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
              <h3 style={{fontSize:16,fontWeight:900,margin:0}}>📋 Lịch sử quay</h3>
              <input type="date" value={date} onChange={e=>{setDate(e.target.value);}} style={inp}/>
              <button onClick={loadAll} style={{...inp,background:"#e99849",color:"#fff",border:"none",cursor:"pointer",fontWeight:700}}>Tìm</button>
              <button onClick={()=>{
                const rows=spins.map(s=>`${s.bill_code},${s.phone},${s.store_name||s.store_id||""},${s.prize_name||""},${s.voucher_code||""},${s.is_valid?"valid":"invalid"},${s.spun_at||""}`).join("\n");
                const a=document.createElement("a"); a.href="data:text/csv;charset=utf-8,\uFEFFBill,SĐT,Cửa hàng,Giải,Voucher,Trạng thái,Thời gian\n"+rows; a.download=`spins_${date}.csv`; a.click();
              }} style={{...inp,cursor:"pointer",fontWeight:700,background:"#f0fdf4",borderColor:"#a7f3d0",color:"#065f46"}}>↓ CSV</button>
              <button onClick={()=>{
                const hdr=`<tr><th>Bill</th><th>SĐT</th><th>Cửa hàng</th><th>Giải</th><th>Voucher</th><th>Trạng thái</th><th>Thời gian</th></tr>`;
                const body=spins.map(s=>`<tr><td>${s.bill_code}</td><td>${s.phone}</td><td>${s.store_name||""}</td><td>${s.prize_name||""}</td><td>${s.voucher_code||""}</td><td>${s.is_valid?"valid":"invalid"}</td><td>${s.spun_at||""}</td></tr>`).join("");
                const html=`<html><head><meta charset="UTF-8"></head><body><table>${hdr}${body}</table></body></html>`;
                const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\uFEFF"+html],{type:"application/vnd.ms-excel;charset=utf-8"})); a.download=`spins_${date}.xls`; a.click();
              }} style={{...inp,cursor:"pointer",fontWeight:700,background:"#f0fdf4",borderColor:"#a7f3d0",color:"#1b459c"}}>↓ Excel (.xls)</button>
            </div>
            <div style={{display:"flex",gap:16,marginBottom:12,flexWrap:"wrap"}}>
              {[["Tổng",spins.length,"#374151"],["Hợp lệ",spins.filter(s=>s.is_valid).length,"#10b981"],["Không HL",spins.filter(s=>!s.is_valid).length,"#ef4444"],["Ban",spins.filter(s=>s.shadow_ban_hit).length,"#e99849"]].map(([l,v,c])=>(
                <div key={l} style={{background:"#fff",borderRadius:10,padding:"10px 16px",border:"1px solid #e5e7eb",minWidth:80,textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
                  <div style={{fontSize:12,color:"#6b7280"}}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f9fafb"}}>
                  {["Mã Bill","SĐT","Cửa hàng","Giải","Voucher","Trạng thái","Thời gian"].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {spins.length===0 ? <tr><td colSpan={7} style={{...td,textAlign:"center",color:"#9ca3af"}}>Không có dữ liệu</td></tr>
                  : spins.map(s=>(
                    <tr key={s.id} style={{background:s.is_valid?"#fff":"#fef2f2"}}>
                      <td style={{...td,fontFamily:"monospace",fontWeight:700}}>{s.bill_code}</td>
                      <td style={td}>{s.phone}</td>
                      <td style={{...td,fontSize:12,color:"#6b7280"}}>{s.store_name||s.store_id||"—"}</td>
                      <td style={{...td,fontWeight:700}}>{s.prize_name}</td>
                      <td style={{...td,fontFamily:"monospace",fontWeight:700,color:"#e99849",background:s.voucher_code&&s.voucher_code!=="PENDING"?"#fef9f0":"transparent"}}>{s.voucher_code||"—"}</td>
                      <td style={td}><span style={{borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700,background:s.is_valid?"#f0fdf4":"#fef2f2",color:s.is_valid?"#065f46":"#dc2626"}}>{s.is_valid?"✅ Hợp lệ":"❌ Không HLệ"}</span></td>
                      <td style={{...td,fontSize:12,color:"#9ca3af"}}>{timeAgo(s.spun_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ĐỐI CHIẾU ── */}
        {tab==="reconcile"&&(
          <div>
            <h3 style={{fontSize:16,fontWeight:900,marginBottom:16}}>🔍 Đối chiếu bill</h3>
            <p style={{fontSize:13,color:"#6b7280",marginBottom:16}}>Chọn các bill không hợp lệ → Void voucher + Blacklist SĐT nếu cần.</p>
            <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f9fafb"}}>{["Chọn","Bill","SĐT","Giải","Voucher","Thời gian"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {spins.filter(s=>s.is_valid).length===0 ? <tr><td colSpan={6} style={{...td,textAlign:"center",color:"#9ca3af"}}>Không có dữ liệu</td></tr>
                  : spins.filter(s=>s.is_valid).map(s=>(
                    <tr key={s.id}><td style={td}><input type="checkbox" data-bill={s.bill_code}/></td>
                    <td style={{...td,fontFamily:"monospace",fontWeight:700}}>{s.bill_code}</td>
                    <td style={td}>{s.phone}</td>
                    <td style={td}>{s.prize_name}</td>
                    <td style={{...td,fontFamily:"monospace",fontSize:12}}>{s.voucher_code||"—"}</td>
                    <td style={{...td,fontSize:12,color:"#9ca3af"}}>{timeAgo(s.spun_at)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={async()=>{
              const checked=[...document.querySelectorAll("[data-bill]:checked")].map(el=>el.dataset.bill);
              if(!checked.length){alert("Chưa chọn bill nào.");return;}
              if(!confirm(`Invalidate ${checked.length} bill?`))return;
              await adminInvalidate(checked); loadAll();
            }} style={{marginTop:12,padding:"10px 20px",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,color:"#dc2626",fontWeight:700,cursor:"pointer"}}>
              🚫 Invalidate các bill đã chọn
            </button>
          </div>
        )}

        {/* ── VOUCHERS ── */}
        {tab==="vouchers"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div>
              <h3 style={{fontSize:15,fontWeight:800,marginBottom:12}}>Pool Voucher</h3>
              {vouchers.filter(g=>g.total<LOW_STOCK&&g.total>0).length>0&&(
                <div style={{background:"#fffbeb",border:"1px solid #e99849",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#92400e"}}>
                  ⚠️ Sắp hết: {vouchers.filter(g=>g.total<LOW_STOCK&&g.total>0).map(g=>g.prize_name).join(", ")}
                </div>
              )}
              <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:"#f9fafb"}}>{["Giải thưởng","Còn lại","Đã cấp","Đã dùng","Đã hủy"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {vouchers.length===0 ? <tr><td colSpan={5} style={{...td,textAlign:"center",color:"#9ca3af"}}>Chưa có voucher</td></tr>
                    : vouchers.map(g=>(
                      <tr key={g.prize_id}>
                        <td style={{...td,fontWeight:700}}>{g.prize_name}</td>
                        <td style={td}><span style={{background:g.total===0?"#fef2f2":g.total<LOW_STOCK?"#fffbeb":"#f0fdf4",color:g.total===0?"#dc2626":g.total<LOW_STOCK?"#92400e":"#065f46",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{g.total===0?"🚨 0":g.total<LOW_STOCK?`⚠ ${g.total}`:g.total}</span></td>
                        <td style={td}>{g.assigned||0}</td>
                        <td style={td}>{g.redeemed||0}</td>
                        <td style={td}>{g.voided||0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{padding:"6px 12px",fontSize:11,color:"#9ca3af"}}>Còn lại = chưa cấp · Đã cấp = khách trúng chưa đổi · Đã dùng = đổi tại quầy · Đã hủy = bill invalid</div>
              </div>
            </div>
            <div>
              <h3 style={{fontSize:15,fontWeight:800,marginBottom:12}}>Import Voucher</h3>
              <div style={{background:"#f0fdf4",border:"1px solid #a7f3d0",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#065f46"}}>
                💡 Mỗi giải cần pool riêng. Khi khách trúng, hệ thống tự cấp 1 mã và xóa khỏi pool "Còn lại".
              </div>
              <ImportVouchers prizes={prizes} onDone={loadAll}/>
            </div>
          </div>
        )}

        {/* ── CHI TIẾT VOUCHER ── */}
        {tab==="vdetail"&&<VoucherDetailPanel prizes={prizes}/>}

        {/* ── TEST MODE ── */}
        {tab==="test"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div>
                <h3 style={{fontSize:16,fontWeight:900,marginBottom:4}}>🧪 Test Mode</h3>
                <div style={{fontSize:13,color:"#6b7280"}}>Không ghi vào DB. Dùng để kiểm tra hiển thị trước khi event.</div>
              </div>
              <button onClick={()=>genTestVoucherXLS(prizes)} style={{padding:"10px 18px",background:"linear-gradient(135deg,#e99849,#d4822a)",border:"none",borderRadius:12,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer"}}>
                📥 Xuất mã test (.xls)
              </button>
            </div>
            <div style={{background:"#fffbeb",border:"1px solid #e99849",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#92400e",lineHeight:1.6}}>
              ⚡ <strong>Quy trình:</strong> Xuất mã test → Import vào Vouchers → Chạy 30-lượt → Vào Chi tiết voucher → Xóa toàn bộ chưa cấp.
            </div>
            <TestModePanel allPrizes={prizes}/>
          </div>
        )}

        {/* ── GIẢI ĐẶC BIỆT ── */}
        {tab==="special"&&(
          <div>
            <h3 style={{fontSize:16,fontWeight:900,marginBottom:16}}>🏆 Giải đặc biệt</h3>
            <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f9fafb"}}>{["SĐT","Bill","Giải","Trạng thái","Note","Thời gian",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {specials.length===0 ? <tr><td colSpan={7} style={{...td,textAlign:"center",color:"#9ca3af"}}>Chưa có giải đặc biệt</td></tr>
                  : specials.map(s=>(
                    <tr key={s.id}>
                      <td style={{...td,fontWeight:700}}>{s.phone}</td>
                      <td style={{...td,fontFamily:"monospace",fontSize:12}}>{s.bill_code}</td>
                      <td style={td}>{s.prize_name}</td>
                      <td style={td}><span style={{borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700,background:s.status==="pending"?"#fffbeb":s.status==="awarded"?"#f0fdf4":"#fef2f2",color:s.status==="pending"?"#92400e":s.status==="awarded"?"#065f46":"#dc2626"}}>{s.status}</span></td>
                      <td style={{...td,fontSize:12,color:"#6b7280"}}>{s.note||"—"}</td>
                      <td style={{...td,fontSize:12,color:"#9ca3af"}}>{timeAgo(s.spun_at)}</td>
                      <td style={td}>
                        <select value={s.status} onChange={async e=>{await updateSpecialStatus(s.id,e.target.value,"");loadAll();}} style={{...inp,padding:"4px 8px",fontSize:12}}>
                          <option value="pending">pending</option>
                          <option value="contacted">contacted</option>
                          <option value="awarded">awarded</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BLACKLIST ── */}
        {tab==="blacklist"&&(
          <div>
            <h3 style={{fontSize:16,fontWeight:900,marginBottom:16}}>🚫 Blacklist</h3>
            <AddBlacklist onDone={loadAll}/>
            <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb",marginTop:16}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f9fafb"}}>{["SĐT","Lý do","Thời gian",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {bl.length===0 ? <tr><td colSpan={4} style={{...td,textAlign:"center",color:"#9ca3af"}}>Danh sách trống</td></tr>
                  : bl.map(b=>(
                    <tr key={b.id}>
                      <td style={{...td,fontWeight:700,fontFamily:"monospace"}}>{b.phone}</td>
                      <td style={{...td,color:"#6b7280"}}>{b.reason||"—"}</td>
                      <td style={{...td,fontSize:12,color:"#9ca3af"}}>{timeAgo(b.created_at)}</td>
                      <td style={td}><button onClick={async()=>{if(!confirm(`Xóa ${b.phone} khỏi blacklist?`))return;await removeBlacklist(b.phone);loadAll();}} style={{padding:"3px 10px",borderRadius:6,border:"1px solid #fecaca",background:"#fff",color:"#ef4444",cursor:"pointer",fontSize:12}}>Xóa</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── HELPER SUB-COMPONENTS ─── */
function ImportVouchers({ prizes, onDone }) {
  const [prizeId, setPrizeId] = useState("");
  const [codes,   setCodes]   = useState("");
  const [msg,     setMsg]     = useState("");
  const inp={border:"1px solid #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:14,color:"#1c1917",background:"#fff"};
  const activePrizes = prizes.filter(p=>p.prize_type==="normal"&&p.has_voucher&&p.active);
  const selPrize = activePrizes.find(p=>String(p.id)===String(prizeId));
  const parsedCodes = codes.split("\n").map(c=>c.trim()).filter(Boolean);

  return (
    <div>
      <div style={{marginBottom:10}}>
        <label style={{fontSize:13,fontWeight:700,display:"block",marginBottom:4}}>Loại phần thưởng cần nạp</label>
        <select value={prizeId} onChange={e=>setPrizeId(e.target.value)} style={{...inp,width:"100%"}}>
          <option value="">-- Chọn giải --</option>
          {activePrizes.map(p=>{
            const pool=prizes.filter?undefined:undefined;
            return <option key={p.id} value={p.id}>{p.name}</option>;
          })}
        </select>
      </div>
      <div style={{marginBottom:10}}>
        <label style={{fontSize:13,fontWeight:700,display:"block",marginBottom:4}}>Danh sách mã (mỗi mã 1 dòng)</label>
        <textarea value={codes} onChange={e=>setCodes(e.target.value)} rows={6} placeholder={"VD001\nVD002\nVD003"} style={{...inp,width:"100%",resize:"vertical"}}/>
      </div>
      {msg&&<div style={{fontSize:13,fontWeight:700,color:"#10b981",marginBottom:8}}>{msg}</div>}
      <button disabled={!prizeId||parsedCodes.length===0} onClick={async()=>{
        if(!selPrize)return;
        await importVouchers(parsedCodes,selPrize.id,selPrize.name);
        setMsg(`✅ Đã import ${parsedCodes.length} mã → ${selPrize.name}`);
        setCodes(""); setTimeout(()=>setMsg(""),4000); onDone();
      }} style={{width:"100%",padding:"11px",background:prizeId&&parsedCodes.length>0?"linear-gradient(135deg,#e99849,#d4822a)":"#e5e7eb",border:"none",borderRadius:12,color:prizeId&&parsedCodes.length>0?"#fff":"#9ca3af",fontWeight:800,fontSize:15,cursor:prizeId&&parsedCodes.length>0?"pointer":"not-allowed"}}>
        ↑ Import {parsedCodes.length} mã{selPrize?` → ${selPrize.name}`:""}
      </button>
    </div>
  );
}

function AddBlacklist({ onDone }) {
  const [phone,setPhone]=useState(""),  [reason,setReason]=useState(""), [msg,setMsg]=useState("");
  const inp={border:"1px solid #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:14,color:"#1c1917",background:"#fff"};
  return (
    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
      <div><label style={{fontSize:12,fontWeight:700,display:"block",marginBottom:4}}>SĐT</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="09..." style={{...inp,width:160}}/></div>
      <div><label style={{fontSize:12,fontWeight:700,display:"block",marginBottom:4}}>Lý do</label><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Gian lận bill..." style={{...inp,width:200}}/></div>
      <button onClick={async()=>{if(!phone)return;await addBlacklist(phone,reason);setPhone("");setReason("");setMsg("✅ Đã thêm");setTimeout(()=>setMsg(""),3000);onDone();}} style={{padding:"9px 18px",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,color:"#dc2626",fontWeight:700,cursor:"pointer"}}>+ Thêm</button>
      {msg&&<span style={{color:"#10b981",fontWeight:700,fontSize:13}}>{msg}</span>}
    </div>
  );
}

function genTestVoucherXLS(prizes) {
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const mkCode=()=>"ST-"+Array.from({length:8},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
  const rows=[];
  prizes.filter(p=>p.prize_type==="normal"&&p.has_voucher&&p.active).forEach(p=>{
    for(let i=0;i<10;i++) rows.push({prize:p.name,code:mkCode(),prizeId:p.id});
  });
  const hdr=`<tr><th style="background:#f97316;color:#fff">Giải thưởng</th><th style="background:#f97316;color:#fff">Mã Voucher</th><th style="background:#f97316;color:#fff">Prize ID</th></tr>`;
  const body=rows.map(r=>`<tr><td>${r.prize}</td><td style="font-family:monospace;font-weight:bold">${r.code}</td><td>${r.prizeId}</td></tr>`).join("");
  const html=`<html><head><meta charset="UTF-8"></head><body><table>${hdr}${body}</table></body></html>`;
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob(["\uFEFF"+html],{type:"application/vnd.ms-excel;charset=utf-8"}));
  a.download="santhai_test_vouchers.xls"; a.click();
}

/* ─── APP ROOT ─── */
export default function App() {
  const [admin, setAdmin] = useState(() => typeof window !== "undefined" && window.location.hash === "#admin");
  useEffect(() => {
    const onHash = () => setAdmin(window.location.hash === "#admin");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  if (admin) return <AdminPage onBack={() => { window.location.hash = ""; setAdmin(false); }}/>;
  return <CustomerPage onAdmin={() => { window.location.hash = "#admin"; setAdmin(true); }}/>;
}
