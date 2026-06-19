import { useState, useRef, useEffect, useCallback } from "react";
import {
  supabaseClient, checkEmailAccess,
  doSpin, loadActivePrizes, loadAllPrizes, savePrize, deletePrize, updatePrizesOrder, resetDefaultPrizes, testConnection,
  loadStoreStats, loadSettings, saveSetting,
  loadSpins, loadSpecialWinners, loadBlacklist, loadVouchers,
  adminInvalidate, importVouchers, addBlacklist, removeBlacklist, updateSpecialStatus,
  loadPrizeVouchers, deleteVoucher, bulkDeleteVouchers,
  loadAllowedEmails, addAllowedEmail, removeAllowedEmail,
  checkSpinRateLimit, deleteSpin, lookupSpinsByPhone,
} from "./supabase.js";

/* ─── CONSTANTS ─── */
const LOW_STOCK = 10;
const SUPER_ADMIN = "dangnhan.mrt@gmail.com";

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
  @keyframes hl-pulse { 0%,100%{opacity:.45} 50%{opacity:.75} }
  @keyframes hl-border { 0%,100%{stroke-opacity:.6} 50%{stroke-opacity:1} }
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

/* ─── WHEEL IMAGE SPINNER (5-Layer Architecture) ─── */
function WheelImageSpinner({ prizes, winnerId, spinning, onDone, size, settings }) {
  const segRef    = useRef(null);
  const hlRef     = useRef(null);
  const rafRef    = useRef(null);
  const prizesRef = useRef(prizes);
  const onDoneRef = useRef(onDone);
  const hlIdxRef  = useRef(0);
  const landedRef = useRef(false);
  const [loaded, setLoaded]     = useState(false);
  const [fontOk, setFontOk]     = useState(false);
  const [centerOk, setCenterOk] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => { prizesRef.current = prizes; bump(v=>v+1); }, [prizes]);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const s = settings || {};
  const bgUrl     = s.wheel_image_url || "";
  const frameUrl  = s.frame_image_url || "";
  const centerUrl = s.wheel_center_url || "";
  const fontName  = s.seg_font_name || "";
  const txtColor  = s.seg_text_color || "#FFFFFF";
  const stkColor  = s.seg_stroke_color || "#1b459c";
  const stkWidth  = parseFloat(s.seg_stroke_width) || 2;
  const badgeShow = s.seg_badge_show !== "false";
  const badgeColor= s.seg_badge_color || "";
  const badgeOp   = (parseFloat(s.seg_badge_opacity)||100)/100;
  const hlColor   = s.hl_color || "#FFFFFF";
  const hlOpacity = (parseFloat(s.hl_opacity) || 45) / 100;
  const hlBdColor = s.hl_border_color || "#FFD700";
  const hlBdWidth = parseFloat(s.hl_border_width) || 2;
  const radiusPct = parseFloat(s.wheel_seg_radius) || 93;

  const dpr    = typeof window!=="undefined" ? (window.devicePixelRatio||1) : 1;
  const cx     = size/2, cy = size/2;
  const outerR = size * (radiusPct/200);
  const hubR   = size * 0.11; /* 12% nhỏ hơn mặc định (0.125) */

  useEffect(() => {
    if (!fontName) { setFontOk(true); return; }
    const encoded = fontName.trim().replace(/\s+/g,"+");
    const url = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700;800;900&display=swap`;
    const id = "st-wheel-font";
    let link = document.getElementById(id);
    if (!link) { link=document.createElement("link"); link.id=id; link.rel="stylesheet"; document.head.appendChild(link); }
    link.href = url;
    setFontOk(false);
    const ready = () => document.fonts.ready.then(()=>setFontOk(true));
    link.onload = ready; ready();
  }, [fontName]);

  const drawSegments = useCallback(() => {
    const c = segRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,size,size);
    const list = prizesRef.current;
    const n = list.length; if (!n) return;
    const sweep = (2*Math.PI)/n;
    const FILLS = ["transparent","transparent"];
    const SP = { special_30:"#CC2136", special_15:"#1b459c", viral:"#64748b" };
    list.forEach((p,i) => {
      const start = -Math.PI/2 + i*sweep, end = start+sweep;
      let st = "normal";
      if (p.prize_type==="viral") st="viral";
      else if (p.prize_type==="special") st=(p.name||"").includes("30")?"special_30":"special_15";
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,outerR,start,end); ctx.closePath();
      ctx.fillStyle = SP[st]||FILLS[i%2]; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.lineTo(cx+outerR*Math.cos(start),cy+outerR*Math.sin(start));
      ctx.strokeStyle="rgba(255,255,255,.5)"; ctx.lineWidth=1; ctx.stroke();
    });
    const ff = fontOk && fontName ? `"${fontName}",` : "";
    list.forEach((p,i) => {
      const start = -Math.PI/2+i*sweep, mid = start+sweep/2;
      const label = (p.short_name||p.name||"").toUpperCase();
      if (!label) return;
      const segW = 2*outerR*0.6*Math.sin(sweep/2);
      const fsMod = size < 400 ? -3 : 0;
      const fs   = Math.max(5,Math.min(13,segW*0.36-label.length*0.08+fsMod));
      ctx.font   = `800 ${fs}px ${ff}Arial,sans-serif`;
      const tw   = ctx.measureText(label).width;
      const padX=5,padY=3,bW=tw+padX*2,bH=fs+padY*2,bDist=outerR*0.6;
      let st="normal";
      if(p.prize_type==="viral")st="viral";
      else if(p.prize_type==="special")st=(p.name||"").includes("30")?"special_30":"special_15";
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(mid);
      if (badgeShow) {
        const defaultBg = SP[st]||"#CC2136";
        const bgC = (st==="normal" && badgeColor) ? badgeColor : defaultBg;
        const bx=bDist-bW/2, by=-bH/2, r=3;
        ctx.globalAlpha = badgeOp;
        ctx.beginPath(); ctx.moveTo(bx+r,by); ctx.lineTo(bx+bW-r,by);
        ctx.arcTo(bx+bW,by,bx+bW,by+r,r); ctx.lineTo(bx+bW,by+bH-r);
        ctx.arcTo(bx+bW,by+bH,bx+bW-r,by+bH,r); ctx.lineTo(bx+r,by+bH);
        ctx.arcTo(bx,by+bH,bx,by+bH-r,r); ctx.lineTo(bx,by+r);
        ctx.arcTo(bx,by,bx+r,by,r); ctx.closePath();
        ctx.fillStyle=bgC; ctx.shadowColor="rgba(0,0,0,.3)"; ctx.shadowBlur=3; ctx.fill();
        ctx.shadowBlur=0; ctx.strokeStyle="rgba(255,255,255,.45)"; ctx.lineWidth=0.7; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.textAlign="center"; ctx.textBaseline="middle";
      if (stkWidth > 0) { ctx.strokeStyle=stkColor; ctx.lineWidth=stkWidth; ctx.lineJoin="round"; ctx.strokeText(label,bDist,0); }
      ctx.fillStyle=txtColor; ctx.fillText(label,bDist,0);
      ctx.restore();
    });
  }, [size,dpr,cx,cy,outerR,fontOk,fontName,txtColor,stkColor,stkWidth,badgeShow,badgeColor,badgeOp]);

  const drawHL = useCallback((idx,isLanded) => {
    const c = hlRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,size,size);
    const n = prizesRef.current.length||1;
    if (idx<0||idx>=n) return;
    const sweep = (2*Math.PI)/n;
    const startA = -Math.PI/2+idx*sweep, endA = startA+sweep;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,outerR,startA,endA); ctx.closePath();
    const hex = hlColor.replace("#","");
    const rr=parseInt(hex.substring(0,2),16)||255, gg=parseInt(hex.substring(2,4),16)||255, bb=parseInt(hex.substring(4,6),16)||255;
    const op = isLanded ? Math.min(1,hlOpacity+0.15) : hlOpacity;
    ctx.fillStyle = `rgba(${rr},${gg},${bb},${op})`;
    ctx.fill();
    ctx.strokeStyle = hlBdColor;
    ctx.lineWidth = isLanded ? hlBdWidth+1 : hlBdWidth;
    if (isLanded) { ctx.shadowColor=hlBdColor; ctx.shadowBlur=14; }
    ctx.stroke();
    ctx.shadowBlur=0;
  }, [size,dpr,cx,cy,outerR,hlColor,hlOpacity,hlBdColor,hlBdWidth]);

  useEffect(() => {
    [segRef,hlRef].forEach(ref=>{ const c=ref.current; if(c){ c.width=size*dpr; c.height=size*dpr; }});
    drawSegments(); drawHL(0,false);
  }, [size,dpr,drawSegments,drawHL]);

  useEffect(() => { drawSegments(); drawHL(hlIdxRef.current,landedRef.current); }, [drawSegments,drawHL]);

  useEffect(() => {
    if (!spinning||!winnerId) return;
    const list=prizesRef.current, n=list.length; if (!n) return;
    cancelAnimationFrame(rafRef.current); clearTimeout(rafRef.current);
    landedRef.current=false;
    const winIdx=list.findIndex(p=>String(p.id)===String(winnerId));
    const targetIdx=winIdx<0?Math.floor(Math.random()*n):winIdx;
    const totalSteps=n*4+targetIdx, dur=5000, t0=performance.now();
    let last=-1;
    const frame=()=>{
      const prog=Math.min(1,(performance.now()-t0)/dur);
      const step=Math.floor((1-Math.pow(1-prog,4))*totalSteps);
      if(step!==last){ last=step; const idx=step%n; hlIdxRef.current=idx; drawHL(idx,false); }
      if(prog<1) rafRef.current=requestAnimationFrame(frame);
      else{
        hlIdxRef.current=targetIdx; landedRef.current=true; drawHL(targetIdx,true);
        let pc=0;
        const pulse=()=>{
          pc++; drawHL(targetIdx,true);
          if(pc%2===0){ const ctx2=hlRef.current?.getContext("2d"); if(ctx2){
            ctx2.setTransform(dpr,0,0,dpr,0,0); ctx2.globalAlpha=0.25;
            const sw=(2*Math.PI)/(prizesRef.current.length||1);
            ctx2.beginPath(); ctx2.moveTo(cx,cy); ctx2.arc(cx,cy,outerR,-Math.PI/2+targetIdx*sw,-Math.PI/2+(targetIdx+1)*sw); ctx2.closePath();
            ctx2.fillStyle=hlBdColor; ctx2.fill(); ctx2.globalAlpha=1;
          }}
          if(pc<6)rafRef.current=setTimeout(pulse,180);
          else{ drawHL(targetIdx,true); setTimeout(()=>onDoneRef.current?.(),300); }
        };
        rafRef.current=setTimeout(pulse,180);
      }
    };
    rafRef.current=requestAnimationFrame(frame);
    return()=>{cancelAnimationFrame(rafRef.current);clearTimeout(rafRef.current);};
  }, [spinning,winnerId,drawHL,cx,cy,outerR,dpr,hlBdColor]); // eslint-disable-line

  useEffect(() => {
    if(!winnerId&&!spinning){ hlIdxRef.current=0; landedRef.current=false; drawHL(0,false); }
  }, [winnerId,spinning,drawHL]);

  const hasFrame  = frameUrl && frameUrl.startsWith("http");
  const hasCenter = centerUrl && centerUrl.startsWith("http");
  const hasBg     = bgUrl && bgUrl.startsWith("http");

  return (
    <div style={{ position:"relative", width:size, height:size }}>
      {/* Pointer ẩn khi custom wheel */}
      {hasBg && !loaded && (
        <div style={{ position:"absolute", top:"5%", left:"5%", width:"90%", height:"90%", borderRadius:"50%",
          background:"#f3f4f6", display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:14, color:"#9ca3af", zIndex:1 }}>Đang tải...</div>
      )}
      {/* L1: Ảnh nền — 95% size, centered (nhỏ hơn frame 5%) */}
      {hasBg && <img src={bgUrl} alt="" onLoad={()=>setLoaded(true)} draggable={false}
        style={{ position:"absolute", top:"5%", left:"5%", width:"90%", height:"90%",
          borderRadius:"50%", objectFit:"contain", zIndex:2,
          display:loaded?"block":"none", userSelect:"none" }}/>}
      {/* L2: Segments canvas — 95% size */}
      <canvas ref={segRef} style={{ position:"absolute", top:"5%", left:"5%", width:"90%", height:"90%", pointerEvents:"none", zIndex:5 }}/>
      {/* L3: Frame — 100% size (đè lên viền L1+L2) */}
      {hasFrame && <img src={frameUrl} alt="" draggable={false}
        style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%",
          objectFit:"contain", pointerEvents:"none", zIndex:10 }}/>}
      {/* L4: Highlight — 90% size (khớp với L1+L2) */}
      <canvas ref={hlRef} style={{ position:"absolute", top:"3.5%", left:"3.5%", width:"93%", height:"93%", pointerEvents:"none", zIndex:15 }}/>
      {hasCenter ? (
        <img src={centerUrl} alt="" draggable={false}
          onLoad={()=>setCenterOk(true)}
          style={{ position:"absolute", zIndex:20,
            left:cx-hubR, top:cy-hubR, width:hubR*2, height:hubR*2,
            borderRadius:"50%", objectFit:"contain", userSelect:"none",
            display:centerOk?"block":"none" }}/>
      ) : (
        <div style={{ position:"absolute", zIndex:20,
          left:cx-hubR, top:cy-hubR, width:hubR*2, height:hubR*2,
          borderRadius:"50%",
          background:"radial-gradient(circle at 35% 35%, #6BAAFF 0%, #1b65d4 40%, #0a2a6e 100%)",
          boxShadow:"0 0 0 4px rgba(200,200,200,.6), 0 0 0 8px rgba(100,100,100,.25), 0 4px 12px rgba(0,0,0,.3)" }}/>
      )}
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
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, 2*Math.PI);
    const navyG = ctx.createRadialGradient(cx-outerR*.25,cy-outerR*.25,0,cx,cy,outerR);
    navyG.addColorStop(0,"#2a5cc4"); navyG.addColorStop(.6,"#1b459c"); navyG.addColorStop(1,"#0d2d6b");
    ctx.fillStyle = navyG; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R+6, 0, 2*Math.PI);
    const gR = ctx.createLinearGradient(cx-R,cy-R,cx+R,cy+R);
    gR.addColorStop(0,"#FFE566"); gR.addColorStop(.5,"#e99849"); gR.addColorStop(1,"#FFE566");
    ctx.fillStyle = gR; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2*Math.PI);
    const yB = ctx.createRadialGradient(cx,cy,0,cx,cy,R);
    yB.addColorStop(0,"#FFE84A"); yB.addColorStop(.5,"#FFD020"); yB.addColorStop(1,"#FF9500");
    ctx.fillStyle = yB; ctx.fill();
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
    segs.forEach(({ start }) => {
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.lineTo(cx+R*Math.cos(start+rot), cy+R*Math.sin(start+rot));
      ctx.strokeStyle="rgba(255,255,255,.5)"; ctx.lineWidth=1; ctx.stroke();
    });
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
function ResultModal({ result, phone, onClose, closeLabel, settings }) {
  if (!result) return null;
  const big   = result.prize_type==="special";
  const viral = result.prize_type==="viral";
  const code  = result.voucher_code;
  const expiry = new Date(); expiry.setDate(expiry.getDate()+30);
  const dd=String(expiry.getDate()).padStart(2,"0");
  const mm=String(expiry.getMonth()+1).padStart(2,"0");
  const yy=String(expiry.getFullYear()).slice(2);
  const hsd = `${dd}/${mm}/${yy}`;
  const s = settings || {};

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
            <div style={{fontSize:22,fontWeight:900,color:"#ef4444",marginBottom:6}}>{s.viral_title||"Ôi không!"}</div>
            <div style={{fontSize:22,fontWeight:900,color:"#1c1917",marginBottom:12}}>{s.viral_subtitle||"Mất Lượt 😅"}</div>
            <div style={{background:"#fef2f2",borderRadius:12,padding:"12px 16px",fontSize:14,color:"#dc2626",marginBottom:14,lineHeight:1.7,whiteSpace:"pre-line"}}>
              {s.viral_message||"Chưa trúng lần này, nhưng bạn vẫn được\n1 topping miễn phí hôm nay!\nĐưa màn hình này cho nhân viên nhé 😊"}
            </div>
          </>
        ) : big ? (
          <>
            <div style={{fontSize:14,fontWeight:700,color:"#92400e",letterSpacing:1,marginBottom:4}}>{s.special_title||"🎉 CHÚC MỪNG!"}</div>
            <div style={{fontSize:24,fontWeight:900,color:"#e99849",marginBottom:16}}>{result.prize_name}</div>
            <div style={{background:"#FFF8EE",border:"2px dashed #e99849",borderRadius:12,padding:"14px 16px",lineHeight:1.7,fontSize:14,color:"#92400e",whiteSpace:"pre-line"}}>
              {(s.special_message||"Nhân viên SanThai sẽ liên hệ qua SĐT\ntrong vòng 24 giờ để trao giải ✨").replace("{phone}",phone)}
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
                  <span style={{fontSize:13,color:"#047857"}}>{s.normal_voucher_note||"Vui lòng lưu mã hoặc chụp màn hình để đổi thưởng nha 📸"}</span>
                </div>
              </>
            ) : code==="PENDING" ? (
              <div style={{background:"#fffbeb",border:"2px solid #e99849",borderRadius:12,padding:14,fontSize:14,color:"#92400e",lineHeight:1.7}}>
                ⏳ Hệ thống đang xử lý voucher của bạn.<br/>
                Vui lòng đưa màn hình này cho nhân viên<br/>để nhận <strong>{result.prize_name}</strong> miễn phí!
              </div>
            ) : (
              <div style={{background:"#f0fdf4",border:"2px solid #10b981",borderRadius:12,padding:14,fontSize:14,color:"#065f46",lineHeight:1.6,whiteSpace:"pre-line"}}>
                🧋 {s.normal_no_voucher_note||"Đưa màn hình này cho nhân viên để nhận thưởng miễn phí!"}
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
    bg_color:"#F5F0E8", bg_image_url:"", frame_image_url:"", wheel_image_url:"",
    wheel_center_url:"", seg_font_name:"",
    seg_text_color:"#FFFFFF", seg_stroke_color:"#1b459c", seg_stroke_width:"2",
    seg_badge_show:"true", seg_badge_color:"", seg_badge_opacity:"100",
    hl_color:"#FFFFFF", hl_opacity:"45", hl_border_color:"#FFD700", hl_border_width:"2",
    wheel_seg_radius:"93",
    rate_warn_threshold:"5", rate_block_threshold:"10",
    rate_warn_message:"⚠️ Lưu ý: SĐT này đã quay nhiều lượt — sẽ được kiểm tra kỹ.",
    rate_block_message:"⚠️ Số điện thoại này đã đạt giới hạn lượt quay trong ngày. Vui lòng quay lại ngày mai.",
    viral_title:"Ôi không!", viral_subtitle:"Mất Lượt 😅",
    viral_message:"Chưa trúng lần này, nhưng bạn vẫn được\n1 topping miễn phí hôm nay!\nĐưa màn hình này cho nhân viên nhé 😊",
    special_title:"🎉 CHÚC MỪNG!", special_message:"Nhân viên SanThai sẽ liên hệ qua SĐT\ntrong vòng 24 giờ để trao giải ✨",
    normal_voucher_note:"Vui lòng lưu mã hoặc chụp màn hình để đổi thưởng nha 📸",
    normal_no_voucher_note:"Đưa màn hình này cho nhân viên để nhận thưởng miễn phí!"
  });  const [bill,       setBill]       = useState("");
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
  const isMobile = typeof window!=="undefined" && window.innerWidth < 768;
  const wheelSize = typeof window!=="undefined" ? (isMobile ? Math.min(Math.floor(window.innerWidth*0.70), 320) : Math.min(showPrizeList?340:520,window.innerWidth/2-60)) : 380;
  const bgColor = settings.bg_color||"#F5F0E8";

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
    // Rate limit: custom thresholds from settings
    const warnAt = parseInt(settings.rate_warn_threshold) || 5;
    const blockAt = parseInt(settings.rate_block_threshold) || 10;
    const todaySpins = await checkSpinRateLimit(p);
    if (todaySpins >= blockAt) { setLoading(false); return setErr(settings.rate_block_message || "⚠️ Số điện thoại này đã đạt giới hạn lượt quay trong ngày."); }
    if (todaySpins >= warnAt) setErr(settings.rate_warn_message || "⚠️ SĐT này đã quay nhiều lượt — sẽ được kiểm tra kỹ.");
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
    <div style={{minHeight:"100vh",background:bgColor}}>
      <style>{G}</style>
      <div style={{background:"linear-gradient(135deg,#e99849,#d4822a)",padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:24,fontWeight:900,color:"#fff",fontFamily:"'Nunito',sans-serif",letterSpacing:1}}>
            🎯 {settings.event_name||"SanThai"}
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.85)",fontWeight:600}}>
            {settings.event_subtitle||"Vòng Quay May Mắn"}
          </div>
        </div>
        <div onClick={onAdmin} style={{fontSize:11,color:"rgba(255,255,255,.3)",cursor:"default",userSelect:"none"}}>v3</div>
      </div>

      <div style={{display:"flex",flexDirection:isMobile?"column":"row",minHeight:isMobile?"auto":"calc(100vh - 80px - 60px)"}}>
        {/* Mobile: wheel first, desktop: form first */}
        {isMobile&&(
          <div style={{padding:"16px",
            background:hasBg?`url(${settings.bg_image_url}) center/cover no-repeat`:"rgba(255,247,237,.7)",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,
            position:"relative",aspectRatio:"1",width:"100%"}}>
            <div style={{background:billQueue.length>0&&spinIdx<0?"#e99849":"rgba(255,255,255,.9)",borderRadius:50,padding:"6px 18px",fontSize:14,fontWeight:800,
              color:billQueue.length>0&&spinIdx<0?"#fff":"#888888",
              boxShadow:billQueue.length>0&&spinIdx<0?"0 4px 16px rgba(233,152,73,.45)":"0 2px 8px rgba(0,0,0,.1)",
              animation:billQueue.length>0&&spinIdx<0?"pulse-ring 1.5s infinite":"none"}}>
              🎯 {Math.max(0,billQueue.length-Math.max(0,spinIdx))} lượt quay
              {spinIdx>=0&&spinning&&` — Lượt ${spinIdx+1}/${billQueue.length}`}
            </div>
            <div style={{position:"relative",display:"inline-block"}}>
              {useImageWheel ? (
                <WheelImageSpinner prizes={prizes} winnerId={currentPrize?.prize_id}
                  spinning={spinning} onDone={handleSpinDone} size={wheelSize} settings={settings}/>
              ) : (
                <WheelCanvas prizes={prizes} winnerId={currentPrize?.prize_id}
                  spinning={spinning} onDone={handleSpinDone} size={wheelSize}/>
              )}
            </div>
            <button onClick={handleStartSpin} disabled={billQueue.length===0||spinning||spinIdx>=0}
              style={{padding:"14px 32px",fontSize:16,fontWeight:900,border:"none",borderRadius:50,
                cursor:billQueue.length>0&&!spinning&&spinIdx<0?"pointer":"not-allowed",
                background:billQueue.length>0&&!spinning&&spinIdx<0?"linear-gradient(135deg,#7c3aed,#6d28d9)":"rgba(255,255,255,.85)",
                color:billQueue.length>0&&!spinning&&spinIdx<0?"#fff":"#9ca3af",
                boxShadow:billQueue.length>0&&!spinning&&spinIdx<0?"0 6px 24px rgba(124,58,237,.5)":"0 2px 8px rgba(0,0,0,.1)"}}>
              {spinning?"🌀 Đang quay…":billQueue.length>0&&spinIdx<0?"🎰 QUAY NGAY!":"Nhập bill trước"}
            </button>
          </div>
        )}
        {/* LEFT: Form */}
        <div style={{flex:isMobile?"none":"1 1 50%",padding:isMobile?"20px 16px":"28px 24px",background:"rgba(255,255,255,.95)",borderRight:isMobile?"none":"1px solid #f0e6d3",display:"flex",flexDirection:"column",gap:16,overflow:"auto"}}>
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
          <div style={{fontSize:12,color:"#78716c",textAlign:"center",lineHeight:1.6}}>
            Mỗi mã bill chỉ dùng được 1 lần.<br/>
            <span style={{color:"#e99849",fontWeight:600}}>Khi đã nhập bill, cần quay ngay.</span><br/>
            <span style={{fontSize:11}}>Nếu chưa quay mà thoát game, liên hệ admin để xem lịch sử voucher.</span>
          </div>
        </div>

        {/* RIGHT: Wheel (desktop only — mobile is rendered above) */}
        {!isMobile&&(
        <div style={{flex:"1 1 50%",padding:"20px",
          background:hasBg?`url(${settings.bg_image_url}) center/cover no-repeat`:"rgba(255,247,237,.7)",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,
          minHeight:400,position:"relative",maxWidth:"50%"}}>
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
                spinning={spinning} onDone={handleSpinDone} size={wheelSize} settings={settings}/>
            ) : (
              <WheelCanvas prizes={prizes} winnerId={currentPrize?.prize_id}
                spinning={spinning} onDone={handleSpinDone} size={wheelSize}/>
            )}
            {!useImageWheel&&settings.frame_image_url&&settings.frame_image_url.startsWith("http")&&(
              <img src={settings.frame_image_url} alt="" style={{position:"absolute",inset:-10,width:"calc(100% + 20px)",height:"calc(100% + 20px)",pointerEvents:"none",objectFit:"contain",zIndex:5}}/>
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
        )}
      </div>

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

      {curResult&&<ResultModal result={curResult} phone={phone} onClose={handleNextSpin} settings={settings}
        closeLabel={spinIdx<billQueue.length-1?`Quay lượt ${spinIdx+2} →`:"Xong 🎉"}/>}
    </div>
  );
}

/* ─── TEST MODE PANEL (PHẢI trước AdminPage) ─── */
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

/* ─── VOUCHER DETAIL PANEL (PHẢI trước AdminPage) ─── */
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

/* ─── EDIT PRIZE MODAL ─── */

/* ─── ACCESS MANAGEMENT (super_admin) ─── */
function AccessManagement({ emails, onReload }) {
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole]   = useState("admin");
  const [msg, setMsg]           = useState("");
  const [adding, setAdding]     = useState(false);
  const inp = { border:"1px solid #d1d5db", borderRadius:8, padding:"8px 12px", fontSize:14, color:"#1c1917", background:"#fff" };
  const th = { padding:"8px 12px", textAlign:"left", fontSize:12, fontWeight:700, color:"#6b7280", borderBottom:"1px solid #e5e7eb", whiteSpace:"nowrap" };
  const td = { padding:"8px 12px", borderBottom:"1px solid #f3f4f6", fontSize:13, verticalAlign:"middle" };

  const handleAdd = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) return setMsg("❌ Email không hợp lệ");
    setAdding(true); setMsg("");
    const res = await addAllowedEmail(newEmail.trim(), newRole);
    setAdding(false);
    if (res.ok) { setNewEmail(""); setMsg("✅ Đã thêm"); setTimeout(()=>setMsg(""),3000); onReload(); }
    else setMsg("❌ " + (res.error || "Lỗi"));
  };

  return (
    <div>
      <h3 style={{fontSize:16,fontWeight:900,marginBottom:8}}>👥 Quản lý quyền truy cập</h3>
      <div style={{fontSize:13,color:"#6b7280",marginBottom:16}}>Thêm/xóa email được phép truy cập Admin. Dùng chung bảng <code>allowed_emails</code> với Feedback app.</div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div>
          <label style={{fontSize:12,fontWeight:700,display:"block",marginBottom:4}}>Email</label>
          <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="email@gmail.com" style={{...inp,width:260}}
            onKeyDown={e=>e.key==="Enter"&&handleAdd()}/>
        </div>
        <div>
          <label style={{fontSize:12,fontWeight:700,display:"block",marginBottom:4}}>Vai trò</label>
          <select value={newRole} onChange={e=>setNewRole(e.target.value)} style={{...inp,width:150}}>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <button onClick={handleAdd} disabled={adding||!newEmail.trim()} style={{padding:"9px 18px",background:newEmail.trim()?"linear-gradient(135deg,#e99849,#d4822a)":"#e5e7eb",border:"none",borderRadius:8,color:newEmail.trim()?"#fff":"#9ca3af",fontWeight:700,cursor:newEmail.trim()?"pointer":"not-allowed",fontSize:14}}>
          {adding?"⏳":"+"} Thêm
        </button>
        {msg&&<span style={{fontSize:13,fontWeight:700,color:msg.startsWith("✅")?"#10b981":"#dc2626"}}>{msg}</span>}
      </div>

      <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:"#f9fafb"}}>
            {["Email","Vai trò","Ngày thêm",""].map(h=><th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {emails.length===0 ? <tr><td colSpan={4} style={{...td,textAlign:"center",color:"#9ca3af"}}>Chưa có email nào</td></tr>
            : emails.map(e=>(
              <tr key={e.id}>
                <td style={{...td,fontWeight:700}}>{e.email}</td>
                <td style={td}><span style={{background:e.role==="super_admin"?"#fef3c7":e.role==="admin"?"#f0fdf4":"#f3f4f6",color:e.role==="super_admin"?"#92400e":e.role==="admin"?"#065f46":"#374151",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{e.role}</span></td>
                <td style={{...td,fontSize:12,color:"#9ca3af"}}>{e.created_at?new Date(e.created_at).toLocaleDateString("vi-VN"):"—"}</td>
                <td style={td}>
                  {e.email!==SUPER_ADMIN&&<button onClick={async()=>{if(!confirm(`Xóa quyền của ${e.email}?`))return;await removeAllowedEmail(e.id);onReload();}} style={{padding:"3px 10px",borderRadius:6,border:"1px solid #fecaca",background:"#fff",color:"#ef4444",cursor:"pointer",fontSize:12}}>🗑</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditPrizeModal({ prize, onSave, onClose }) {
  const [form, setForm] = useState({ ...prize });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = { border:"1px solid #d1d5db", borderRadius:8, padding:"8px 12px", fontSize:14, color:"#1c1917", background:"#fff", width:"100%" };

  const handleSave = async () => {
    if (!form.name?.trim()) return setErr("Tên giải không được trống");
    setSaving(true); setErr("");
    const res = await savePrize(form);
    setSaving(false);
    if (res.ok) onSave();
    else setErr(res.error || "Lỗi khi lưu");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:20,padding:28,maxWidth:480,width:"100%",boxShadow:"0 16px 48px rgba(0,0,0,.2)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:900,color:"#1b459c"}}>✏️ Chỉnh sửa giải thưởng</div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:"50%",width:32,height:32,fontSize:16,cursor:"pointer",color:"#64748b"}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Tên giải *</label>
            <input value={form.name||""} onChange={e=>upd("name",e.target.value)} style={inp}/>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Short name (hiển thị trên bánh xe)</label>
            <input value={form.short_name||""} onChange={e=>upd("short_name",e.target.value)} placeholder="Tối đa 8-10 ký tự" style={inp}/>
          </div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Loại giải</label>
              <select value={form.prize_type||"normal"} onChange={e=>upd("prize_type",e.target.value)} style={inp}>
                <option value="normal">normal</option>
                <option value="special">special</option>
                <option value="viral">viral</option>
              </select>
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Xác suất (%)</label>
              <input type="number" step="0.1" min="0" max="100" value={form.probability||0} onChange={e=>upd("probability",parseFloat(e.target.value)||0)} style={inp}/>
            </div>
          </div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Icon (emoji)</label>
              <input value={form.icon||""} onChange={e=>upd("icon",e.target.value)} placeholder="🎁" style={inp}/>
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Thứ tự hiển thị</label>
              <input type="number" min="0" value={form.display_order||0} onChange={e=>upd("display_order",parseInt(e.target.value)||0)} style={inp}/>
            </div>
          </div>
          <div style={{display:"flex",gap:20}}>
            <label style={{fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:"#374151"}}>
              <input type="checkbox" checked={!!form.has_voucher} onChange={e=>upd("has_voucher",e.target.checked)} style={{width:16,height:16}}/>
              Có voucher
            </label>
            <label style={{fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:"#374151"}}>
              <input type="checkbox" checked={form.active!==false} onChange={e=>upd("active",e.target.checked)} style={{width:16,height:16}}/>
              Active
            </label>
          </div>
        </div>
        {err&&<div style={{marginTop:12,color:"#dc2626",fontSize:13,fontWeight:700}}>{err}</div>}
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={handleSave} disabled={saving} style={{flex:1,padding:"12px",background:"linear-gradient(135deg,#e99849,#d4822a)",border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:800,cursor:saving?"not-allowed":"pointer"}}>
            {saving?"⏳ Đang lưu…":"💾 Lưu thay đổi"}
          </button>
          <button onClick={onClose} style={{padding:"12px 20px",background:"#f1f5f9",border:"none",borderRadius:12,color:"#374151",fontWeight:700,cursor:"pointer"}}>Hủy</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN PAGE — Google OAuth + allowed_emails (giống feedback app)
   ═══════════════════════════════════════════════════════════════ */
function AdminPage({ onBack }) {
  /* ── Auth state ── */
  const [user,         setUser]         = useState(null);
  const [userRole,     setUserRole]     = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [tab,     setTab]    = useState("settings");
  const [loading, setLoading]= useState(false);
  const [dbStatus,setDbStatus]=useState(null);

  const [prizes,  setPrizes] = useState([]);
  const [spins,   setSpins]  = useState([]);
  const [specials,setSpecials]=useState([]);
  const [bl,      setBl]     = useState([]);
  const [vouchers,setVouchers]=useState([]);
  const [date,    setDate]   = useState(new Date().toISOString().slice(0,10));
  const [filterPhone, setFilterPhone] = useState("");
  const [filterBill, setFilterBill]   = useState("");
  const [filterValid, setFilterValid] = useState("all");
  const [reconSelected, setReconSelected] = useState(new Set());

  const [adminSettings, setAdminSettings] = useState({
    event_name:"",event_subtitle:"",description:"",
    show_prize_list:"false",bg_color:"#F5F0E8",
    bg_image_url:"",frame_image_url:"",wheel_image_url:"",
    wheel_center_url:"",seg_font_name:"",
    seg_text_color:"#FFFFFF",seg_stroke_color:"#1b459c",seg_stroke_width:"2",
    seg_badge_show:"true",seg_badge_color:"",seg_badge_opacity:"100",
    hl_color:"#FFFFFF",hl_opacity:"45",hl_border_color:"#FFD700",hl_border_width:"2",
    wheel_seg_radius:"93",
    rate_warn_threshold:"5", rate_block_threshold:"10",
    rate_warn_message:"", rate_block_message:"",
    viral_title:"", viral_subtitle:"", viral_message:"",
    special_title:"", special_message:"",
    normal_voucher_note:"", normal_no_voucher_note:""
  });
  const [settingsSaved, setSettingsSaved] = useState("");
  const [editingPrize, setEditingPrize] = useState(null);
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [suspiciousPhones, setSuspiciousPhones] = useState([]);

  /* ── Auth: check session + role on mount ── */
  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        checkEmailAccess(session.user.email).then(access => {
          if (access && (access.role === "super_admin" || access.role === "admin")) {
            setUserRole(access.role);
          }
          setAuthChecking(false);
        });
      } else {
        setAuthChecking(false);
      }
    });

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        checkEmailAccess(session.user.email).then(access => {
          if (access && (access.role === "super_admin" || access.role === "admin")) {
            setUserRole(access.role);
          } else {
            setUserRole(null);
          }
          setAuthChecking(false);
        });
      } else {
        setUser(null);
        setUserRole(null);
        setAuthChecking(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const doLogin = () => {
    try { localStorage.setItem("st_goto_admin","1"); } catch(e){}
    supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  /* Logout SYNC — rule từ feedback app */
  const doLogout = () => {
    try { supabaseClient.auth.signOut(); } catch(e) {}
    try { localStorage.clear(); } catch(e) {}
    try { sessionStorage.clear(); } catch(e) {}
    window.location.replace(window.location.origin);
  };

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
    ...(userRole==="super_admin"?[{id:"access", label:"👥 Phân quyền"}]:[]),
  ];

  const loadAll=useCallback(async()=>{
    setLoading(true);
    const conn=await testConnection();
    setDbStatus(conn.ok?"ok":conn.error||"error");
    if(conn.ok){
      const [p,s,sp,b,v,cfg]=await Promise.all([
        loadAllPrizes(),loadSpins(date,{phone:filterPhone,bill:filterBill,valid:filterValid!=="all"?filterValid:undefined}),loadSpecialWinners(),loadBlacklist(),loadVouchers(),loadSettings(),
      ]);
      setPrizes(Array.isArray(p)?p:[]); setSpins(Array.isArray(s)?s:[]);
      setSpecials(Array.isArray(sp)?sp:[]); setBl(Array.isArray(b)?b:[]);
      setReconSelected(new Set());
      if (Array.isArray(v)&&v.length>0) {
        const map = {};
        v.forEach(r => {
          const k = r.prize_id;
          if (!map[k]) map[k] = { prize_id:k, prize_name:r.prize_name, total:0, assigned:0, redeemed:0, voided:0 };
          if (r.status==="unused")    map[k].total++;
          else if (r.status==="assigned") map[k].assigned++;
          else if (r.status==="redeemed") map[k].redeemed++;
          else if (r.status==="voided")   map[k].voided++;
          else map[k].total++;
        });
        setVouchers(Object.values(map));
      } else { setVouchers([]); }
      if(cfg&&Object.keys(cfg).length) setAdminSettings(prev=>({...prev,...cfg}));
      // Load allowed emails (for super_admin tab)
      if(userRole==="super_admin") {
        const emails = await loadAllowedEmails();
        setAllowedEmails(Array.isArray(emails)?emails:[]);
      }
      // Detect suspicious phones: 5+ spins same day
      if(Array.isArray(s)&&s.length>0){
        const phoneCount={};
        s.forEach(r=>{ const ph=r.phone; if(ph){ phoneCount[ph]=(phoneCount[ph]||0)+1; } });
        setSuspiciousPhones(Object.entries(phoneCount).filter(([,c])=>c>=5).map(([ph,c])=>({phone:ph,count:c})));
      } else { setSuspiciousPhones([]); }
    }
    setLoading(false);
  },[date,filterPhone,filterBill,filterValid]);

  /* Quick search spins only (without reloading everything) */
  const searchSpins = useCallback(async()=>{
    setLoading(true);
    const s = await loadSpins(date,{phone:filterPhone,bill:filterBill,valid:filterValid!=="all"?filterValid:undefined});
    setSpins(Array.isArray(s)?s:[]);
    setReconSelected(new Set());
    // Detect suspicious phones
    if(Array.isArray(s)&&s.length>0){
      const phoneCount={};
      s.forEach(r=>{ const ph=r.phone; if(ph){ phoneCount[ph]=(phoneCount[ph]||0)+1; } });
      setSuspiciousPhones(Object.entries(phoneCount).filter(([,c])=>c>=5).map(([ph,c])=>({phone:ph,count:c})));
    } else { setSuspiciousPhones([]); }
    setLoading(false);
  },[date,filterPhone,filterBill,filterValid]);

  useEffect(()=>{ if(userRole)loadAll(); },[userRole,loadAll]);

  /* ── REORDER PRIZES: di chuyển lên/xuống ── */
  const movePrize = async (idx, dir) => {
    const arr = [...prizes];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= arr.length) return;
    // Swap display_order values
    const tempOrder = arr[idx].display_order;
    arr[idx].display_order = arr[targetIdx].display_order;
    arr[targetIdx].display_order = tempOrder;
    // Swap positions in array
    [arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]];
    setPrizes(arr);
    // Save to DB
    await updatePrizesOrder([
      { id: arr[idx].id, display_order: arr[idx].display_order },
      { id: arr[targetIdx].id, display_order: arr[targetIdx].display_order },
    ]);
  };

  const inp={border:"1px solid #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:14,color:"#1c1917",background:"#fff",fontFamily:"inherit"};
  const th={padding:"8px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#6b7280",borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap"};
  const td={padding:"8px 12px",borderBottom:"1px solid #f3f4f6",fontSize:13,verticalAlign:"middle"};
  const arrowBtn = (disabled) => ({
    padding:"2px 7px", fontSize:14, border:"1px solid #d1d5db", borderRadius:6,
    background:disabled?"#f3f4f6":"#fff", color:disabled?"#d1d5db":"#374151",
    cursor:disabled?"not-allowed":"pointer", fontWeight:900, lineHeight:1,
  });

  /* ── LOADING STATE ── */
  if(authChecking) return (
    <div style={{minHeight:"100vh",background:"#F5F0E8",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{G}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:12,animation:"spin 1s linear infinite"}}>⏳</div>
        <div style={{fontSize:16,fontWeight:700,color:"#78716c"}}>Đang kiểm tra đăng nhập…</div>
      </div>
    </div>
  );

  /* ── LOGIN SCREEN ── */
  if(!user) return (
    <div style={{minHeight:"100vh",background:"#F5F0E8",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{G}</style>
      <div style={{background:"#fff",borderRadius:20,padding:32,maxWidth:380,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,.12)",textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:8}}>🎰</div>
        <div style={{fontSize:22,fontWeight:900,color:"#1b459c",fontFamily:"'Nunito',sans-serif",marginBottom:6}}>Admin — SanThai Spin</div>
        <div style={{fontSize:13,color:"#78716c",marginBottom:24}}>Đăng nhập bằng Google để tiếp tục</div>
        <button onClick={doLogin} style={{width:"100%",padding:"13px",background:"#fff",border:"2px solid #e5e7eb",borderRadius:12,fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,color:"#1c1917",transition:"border-color .2s,box-shadow .2s"}}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Đăng nhập bằng Google
        </button>
        <button onClick={onBack} style={{width:"100%",marginTop:12,padding:"10px",background:"#f1f5f9",border:"none",borderRadius:12,color:"#374151",fontWeight:700,cursor:"pointer"}}>← Quay lại</button>
      </div>
    </div>
  );

  /* ── ACCESS DENIED ── */
  if(!userRole) return (
    <div style={{minHeight:"100vh",background:"#F5F0E8",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{G}</style>
      <div style={{background:"#fff",borderRadius:20,padding:32,maxWidth:400,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,.12)",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:8}}>🚫</div>
        <div style={{fontSize:20,fontWeight:900,color:"#dc2626",marginBottom:8}}>Không có quyền truy cập</div>
        <div style={{fontSize:14,color:"#6b7280",marginBottom:8,lineHeight:1.6}}>
          Email <strong style={{color:"#1c1917"}}>{user.email}</strong> chưa được cấp quyền admin.
        </div>
        <div style={{fontSize:13,color:"#9ca3af",marginBottom:20}}>
          Liên hệ Super Admin (<strong>{SUPER_ADMIN}</strong>) để được thêm quyền.
        </div>
        <button onClick={doLogout} style={{width:"100%",padding:"12px",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:12,color:"#dc2626",fontWeight:700,cursor:"pointer",fontSize:15}}>
          Đăng xuất
        </button>
        <button onClick={onBack} style={{width:"100%",marginTop:10,padding:"10px",background:"#f1f5f9",border:"none",borderRadius:12,color:"#374151",fontWeight:700,cursor:"pointer"}}>← Quay lại</button>
      </div>
    </div>
  );

  /* ═══ ADMIN DASHBOARD ═══ */
  return (
    <div style={{minHeight:"100vh",background:"#F5F0E8"}}>
      <style>{G}</style>
      <div style={{background:"linear-gradient(135deg,#e99849,#d4822a)",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:18,fontWeight:900,color:"#fff",fontFamily:"'Nunito',sans-serif"}}>🎰 Admin — SanThai Spin</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {dbStatus==="ok"?<span style={{fontSize:12,color:"rgba(255,255,255,.8)"}}>✅ DB</span>:<span style={{fontSize:12,color:"#fecaca"}}>❌ DB lỗi</span>}
          <span style={{fontSize:12,color:"rgba(255,255,255,.7)",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</span>
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
              {key:"bg_color",        label:"Màu nền trang",placeholder:"#F5F0E8",type:"color",hint:""},
              {key:"bg_image_url",    label:"URL ảnh nền trang",         placeholder:"https://...",type:"url",hint:"Để trống nếu dùng màu nền"},
            ].map(({key,label,placeholder,type,hint})=>(
              <div key={key} style={{marginBottom:16}}>
                <label style={{fontSize:13,fontWeight:700,display:"block",marginBottom:4,color:"#374151"}}>{label}</label>
                {type==="color" ? (
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <input type="color" value={adminSettings[key]||"#F5F0E8"} onChange={e=>setAdminSettings(p=>({...p,[key]:e.target.value}))} style={{width:50,height:38,border:"1px solid #d1d5db",borderRadius:8,cursor:"pointer",padding:2}}/>
                    <input type="text" value={adminSettings[key]||""} onChange={e=>setAdminSettings(p=>({...p,[key]:e.target.value}))} placeholder={placeholder} style={{...inp,flex:1}}/>
                  </div>
                ) : <input type="text" value={adminSettings[key]||""} onChange={e=>setAdminSettings(p=>({...p,[key]:e.target.value}))} placeholder={placeholder} style={{...inp,width:"100%"}}/>}
                {hint&&<div style={{fontSize:12,color:"#9ca3af",marginTop:3}}>{hint}</div>}
              </div>
            ))}

            <h3 style={{fontSize:16,fontWeight:900,margin:"28px 0 8px",borderTop:"2px solid #e5e7eb",paddingTop:20}}>🎡 Tùy chỉnh vòng quay</h3>
            <div style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>Điền URL ảnh Layer 1 để kích hoạt chế độ custom (thay vì canvas mặc định)</div>

            <div style={{background:"#fffbeb",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #fde68a"}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:8,color:"#92400e"}}>Layer 1 — Ảnh nền bánh xe</div>
              <div style={{fontSize:11,color:"#78716c",marginBottom:8}}>📐 PNG/JPG, 800×800px | Chỉ viền + nền gradient, KHÔNG có text giải thưởng</div>
              <input type="text" value={adminSettings.wheel_image_url||""} onChange={e=>setAdminSettings(p=>({...p,wheel_image_url:e.target.value}))} placeholder="https://..." style={{...inp,width:"100%"}}/>
            </div>

            <div style={{background:"#eff6ff",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #bfdbfe"}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:8,color:"#1e40af"}}>Layer 2 — Text giải thưởng</div>
              <div style={{fontSize:11,color:"#6b7280",marginBottom:8}}>Code tự vẽ chia ngăn + text. Custom font để hiển thị tiếng Việt đẹp.</div>
              <div style={{marginBottom:10}}>
                <label style={{fontSize:12,fontWeight:600,color:"#374151"}}>Tên font (Google Fonts)</label>
                <input type="text" value={adminSettings.seg_font_name||""} onChange={e=>setAdminSettings(p=>({...p,seg_font_name:e.target.value}))}
                  placeholder="Be Vietnam Pro" style={{...inp,width:"100%",marginTop:2}}/>
                <div style={{fontSize:11,color:"#9ca3af"}}>Tìm tại <a href="https://fonts.google.com" target="_blank" rel="noreferrer" style={{color:"#3b82f6"}}>fonts.google.com</a> → copy tên font. Để trống = Arial mặc định</div>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {[
                  {key:"seg_text_color",   label:"Màu text",       def:"#FFFFFF"},
                  {key:"seg_stroke_color", label:"Màu viền text",  def:"#1b459c"},
                ].map(f=>(
                  <div key={f.key} style={{flex:"1 1 45%",marginBottom:8}}>
                    <label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{f.label}</label>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
                      <input type="color" value={adminSettings[f.key]||f.def} onChange={e=>setAdminSettings(p=>({...p,[f.key]:e.target.value}))} style={{width:36,height:30,border:"1px solid #d1d5db",borderRadius:6,cursor:"pointer",padding:1}}/>
                      <input type="text" value={adminSettings[f.key]||""} onChange={e=>setAdminSettings(p=>({...p,[f.key]:e.target.value}))} placeholder={f.def} style={{...inp,flex:1}}/>
                    </div>
                  </div>
                ))}
                <div style={{flex:"1 1 45%",marginBottom:8}}>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151"}}>Độ dày viền text</label>
                  <input type="text" value={adminSettings.seg_stroke_width||""} onChange={e=>setAdminSettings(p=>({...p,seg_stroke_width:e.target.value}))} placeholder="2" style={{...inp,width:"100%",marginTop:2}}/>
                  <div style={{fontSize:11,color:"#9ca3af"}}>0 = không viền, 1-4 = nhẹ → đậm</div>
                </div>
              </div>
              <div style={{borderTop:"1px solid #dbeafe",paddingTop:10,marginTop:6}}>
                <div style={{fontSize:12,fontWeight:700,color:"#1e40af",marginBottom:6}}>Badge (nền chữ)</div>
                <label style={{fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:8,color:"#374151"}}>
                  <input type="checkbox" checked={adminSettings.seg_badge_show!=="false"} onChange={e=>setAdminSettings(p=>({...p,seg_badge_show:e.target.checked?"true":"false"}))} style={{width:16,height:16}}/>
                  Hiện badge nền sau chữ
                </label>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <div style={{flex:"1 1 50%",marginBottom:6}}>
                    <label style={{fontSize:12,fontWeight:600,color:"#374151"}}>Màu badge (giải thường)</label>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
                      <input type="color" value={adminSettings.seg_badge_color||"#CC2136"} onChange={e=>setAdminSettings(p=>({...p,seg_badge_color:e.target.value}))} style={{width:36,height:30,border:"1px solid #d1d5db",borderRadius:6,cursor:"pointer",padding:1}}/>
                      <input type="text" value={adminSettings.seg_badge_color||""} onChange={e=>setAdminSettings(p=>({...p,seg_badge_color:e.target.value}))} placeholder="#CC2136" style={{...inp,flex:1}}/>
                    </div>
                    <div style={{fontSize:11,color:"#9ca3af"}}>Giải đặc biệt/viral giữ màu riêng</div>
                  </div>
                  <div style={{flex:"1 1 40%",marginBottom:6}}>
                    <label style={{fontSize:12,fontWeight:600,color:"#374151"}}>Opacity badge (%)</label>
                    <input type="text" value={adminSettings.seg_badge_opacity||""} onChange={e=>setAdminSettings(p=>({...p,seg_badge_opacity:e.target.value}))} placeholder="100" style={{...inp,width:"100%",marginTop:2}}/>
                    <div style={{fontSize:11,color:"#9ca3af"}}>0=ẩn, 50=mờ, 100=đặc</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{background:"#f0fdf4",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #bbf7d0"}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:8,color:"#166534"}}>Layer 3 — Khung trang trí</div>
              <div style={{fontSize:11,color:"#78716c",marginBottom:8}}>📐 PNG trong suốt, 800×800px | Chỉ phần viền/khung, tâm trong suốt. Đè lên L1+L2, che viền thừa.</div>
              <input type="text" value={adminSettings.frame_image_url||""} onChange={e=>setAdminSettings(p=>({...p,frame_image_url:e.target.value}))} placeholder="https://..." style={{...inp,width:"100%"}}/>
            </div>

            <div style={{background:"#fefce8",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #fef08a"}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:8,color:"#854d0e"}}>Layer 4 — Highlight chase</div>
              <div style={{fontSize:11,color:"#6b7280",marginBottom:8}}>Ô sáng chạy quanh rồi dừng ở giải trúng. Hiện ngay từ đầu ở ô 0.</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {[
                  {key:"hl_color",        label:"Màu fill",    def:"#FFFFFF"},
                  {key:"hl_border_color", label:"Màu viền",    def:"#FFD700"},
                ].map(f=>(
                  <div key={f.key} style={{flex:"1 1 45%",marginBottom:8}}>
                    <label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{f.label}</label>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
                      <input type="color" value={adminSettings[f.key]||f.def} onChange={e=>setAdminSettings(p=>({...p,[f.key]:e.target.value}))} style={{width:36,height:30,border:"1px solid #d1d5db",borderRadius:6,cursor:"pointer",padding:1}}/>
                      <input type="text" value={adminSettings[f.key]||""} onChange={e=>setAdminSettings(p=>({...p,[f.key]:e.target.value}))} placeholder={f.def} style={{...inp,flex:1}}/>
                    </div>
                  </div>
                ))}
                {[
                  {key:"hl_opacity",      label:"Opacity (%)",        ph:"45", note:"0=trong suốt, 100=đặc"},
                  {key:"hl_border_width", label:"Độ dày viền (px)",   ph:"2", note:""},
                  {key:"wheel_seg_radius",label:"Bán kính ô quay (%)",ph:"93", note:"80-98, khớp với viền khung L3"},
                ].map(f=>(
                  <div key={f.key} style={{flex:"1 1 30%",marginBottom:8}}>
                    <label style={{fontSize:12,fontWeight:600,color:"#374151"}}>{f.label}</label>
                    <input type="text" value={adminSettings[f.key]||""} onChange={e=>setAdminSettings(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph} style={{...inp,width:"100%",marginTop:2}}/>
                    {f.note&&<div style={{fontSize:11,color:"#9ca3af"}}>{f.note}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{background:"#faf5ff",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #e9d5ff"}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:8,color:"#7e22ce"}}>Layer 5 — Nút tâm</div>
              <div style={{fontSize:11,color:"#78716c",marginBottom:8}}>📐 PNG trong suốt, 200×200px, hình tròn. Để trống → dùng nút gradient mặc định.</div>
              <input type="text" value={adminSettings.wheel_center_url||""} onChange={e=>setAdminSettings(p=>({...p,wheel_center_url:e.target.value}))} placeholder="https://..." style={{...inp,width:"100%"}}/>
            </div>
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

            {/* ── CHỐNG SPAM & CẢNH BÁO ── */}
            <h3 style={{fontSize:16,fontWeight:900,margin:"28px 0 8px",borderTop:"2px solid #e5e7eb",paddingTop:20}}>🚨 Chống spam & Cảnh báo</h3>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:14}}>
              <div style={{flex:"1 1 45%"}}>
                <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Ngưỡng cảnh báo (lượt/ngày)</label>
                <input type="number" min="1" max="50" value={adminSettings.rate_warn_threshold||"5"} onChange={e=>setAdminSettings(p=>({...p,rate_warn_threshold:e.target.value}))} style={{...inp,width:"100%"}}/>
                <div style={{fontSize:11,color:"#9ca3af"}}>Đạt mốc này → hiện cảnh báo vàng cho khách</div>
              </div>
              <div style={{flex:"1 1 45%"}}>
                <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Ngưỡng chặn (lượt/ngày)</label>
                <input type="number" min="1" max="50" value={adminSettings.rate_block_threshold||"10"} onChange={e=>setAdminSettings(p=>({...p,rate_block_threshold:e.target.value}))} style={{...inp,width:"100%"}}/>
                <div style={{fontSize:11,color:"#9ca3af"}}>Đạt mốc này → chặn cứng, không cho quay</div>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Nội dung cảnh báo (hiển thị cho khách ở mốc cảnh báo)</label>
              <input type="text" value={adminSettings.rate_warn_message||""} onChange={e=>setAdminSettings(p=>({...p,rate_warn_message:e.target.value}))}
                placeholder="⚠️ Lưu ý: SĐT này đã quay nhiều lượt — sẽ được kiểm tra kỹ." style={{...inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:4}}>Nội dung chặn (hiển thị cho khách ở mốc chặn)</label>
              <input type="text" value={adminSettings.rate_block_message||""} onChange={e=>setAdminSettings(p=>({...p,rate_block_message:e.target.value}))}
                placeholder="⚠️ Số điện thoại này đã đạt giới hạn lượt quay trong ngày." style={{...inp,width:"100%"}}/>
            </div>

            {/* ── TÙY CHỈNH THÔNG BÁO KẾT QUẢ ── */}
            <h3 style={{fontSize:16,fontWeight:900,margin:"28px 0 8px",borderTop:"2px solid #e5e7eb",paddingTop:20}}>🎁 Thông báo kết quả (popup sau khi quay)</h3>

            <div style={{background:"#f3f4f6",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #e5e7eb"}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:10,color:"#64748b"}}>❌ Giải Viral (Mất Lượt)</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:8}}>
                <div style={{flex:"1 1 45%"}}>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>Tiêu đề</label>
                  <input type="text" value={adminSettings.viral_title||""} onChange={e=>setAdminSettings(p=>({...p,viral_title:e.target.value}))} placeholder="Ôi không!" style={{...inp,width:"100%"}}/>
                </div>
                <div style={{flex:"1 1 45%"}}>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>Phụ đề</label>
                  <input type="text" value={adminSettings.viral_subtitle||""} onChange={e=>setAdminSettings(p=>({...p,viral_subtitle:e.target.value}))} placeholder="Mất Lượt 😅" style={{...inp,width:"100%"}}/>
                </div>
              </div>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>Nội dung (xuống dòng = Enter)</label>
              <textarea value={adminSettings.viral_message||""} onChange={e=>setAdminSettings(p=>({...p,viral_message:e.target.value}))} rows={3}
                placeholder={"Chưa trúng lần này, nhưng bạn vẫn được\n1 topping miễn phí hôm nay!\nĐưa màn hình này cho nhân viên nhé 😊"} style={{...inp,width:"100%",resize:"vertical"}}/>
            </div>

            <div style={{background:"#fef3c7",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #fde68a"}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:10,color:"#92400e"}}>🏆 Giải Special (Thẻ 15/30 ngày)</div>
              <div style={{marginBottom:8}}>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>Tiêu đề</label>
                <input type="text" value={adminSettings.special_title||""} onChange={e=>setAdminSettings(p=>({...p,special_title:e.target.value}))} placeholder="🎉 CHÚC MỪNG!" style={{...inp,width:"100%"}}/>
              </div>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>Nội dung (dùng {"{phone}"} để chèn SĐT khách)</label>
              <textarea value={adminSettings.special_message||""} onChange={e=>setAdminSettings(p=>({...p,special_message:e.target.value}))} rows={3}
                placeholder={"Nhân viên SanThai sẽ liên hệ qua SĐT\ntrong vòng 24 giờ để trao giải ✨"} style={{...inp,width:"100%",resize:"vertical"}}/>
            </div>

            <div style={{background:"#f0fdf4",borderRadius:10,padding:14,marginBottom:14,border:"1px solid #bbf7d0"}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:10,color:"#065f46"}}>🧋 Giải Normal (Topping)</div>
              <div style={{marginBottom:8}}>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>Ghi chú khi có voucher code</label>
                <input type="text" value={adminSettings.normal_voucher_note||""} onChange={e=>setAdminSettings(p=>({...p,normal_voucher_note:e.target.value}))}
                  placeholder="Vui lòng lưu mã hoặc chụp màn hình để đổi thưởng nha 📸" style={{...inp,width:"100%"}}/>
              </div>
              <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>Ghi chú khi không có voucher</label>
              <input type="text" value={adminSettings.normal_no_voucher_note||""} onChange={e=>setAdminSettings(p=>({...p,normal_no_voucher_note:e.target.value}))}
                placeholder="Đưa màn hình này cho nhân viên để nhận thưởng miễn phí!" style={{...inp,width:"100%"}}/>
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

        {/* ── CẤU HÌNH GIẢI (+ REORDER ▲▼) ── */}
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
                  {["Vị trí","Tên giải","Short name","Loại","Xác suất %","Voucher","Icon","Active",""].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {prizes.length===0 ? <tr><td colSpan={9} style={{...td,textAlign:"center",color:"#9ca3af"}}>Chưa có giải — nhấn Load giải mặc định</td></tr>
                  : prizes.map((p,idx)=>(
                    <tr key={p.id}>
                      <td style={{...td,whiteSpace:"nowrap"}}>
                        <div style={{display:"flex",gap:3,alignItems:"center"}}>
                          <button onClick={()=>movePrize(idx,-1)} disabled={idx===0} style={arrowBtn(idx===0)} title="Di lên">▲</button>
                          <button onClick={()=>movePrize(idx,1)} disabled={idx===prizes.length-1} style={arrowBtn(idx===prizes.length-1)} title="Di xuống">▼</button>
                          <span style={{fontSize:12,color:"#9ca3af",marginLeft:4,minWidth:18,textAlign:"center"}}>{idx+1}</span>
                        </div>
                      </td>
                      <td style={{...td,fontWeight:700}}>{p.name}</td>
                      <td style={{...td,color:"#6b7280",fontSize:12}}>{p.short_name||"—"}</td>
                      <td style={td}><span style={{background:p.prize_type==="special"?"#fef3c7":p.prize_type==="viral"?"#f3f4f6":"#f0fdf4",color:p.prize_type==="special"?"#92400e":p.prize_type==="viral"?"#374151":"#065f46",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{p.prize_type}</span></td>
                      <td style={{...td,fontWeight:700,color:"#e99849"}}>{p.probability}%</td>
                      <td style={td}>{p.has_voucher?"✅":"—"}</td>
                      <td style={{...td,fontSize:20}}>{p.icon}</td>
                      <td style={td}>{p.active?"🟢":"⚪"}</td>
                      <td style={{...td,whiteSpace:"nowrap"}}>
                        <button onClick={()=>setEditingPrize(p)} style={{padding:"3px 10px",borderRadius:6,border:"1px solid #bfdbfe",background:"#eff6ff",color:"#1e40af",cursor:"pointer",fontSize:12,marginRight:4}}>✏️</button>
                        <button onClick={async()=>{ if(!confirm(`Xóa giải "${p.name}"?`))return; await deletePrize(p.id); loadAll(); }} style={{padding:"3px 10px",borderRadius:6,border:"1px solid #fecaca",background:"#fff",color:"#ef4444",cursor:"pointer",fontSize:12}}>🗑</button>
                      </td>
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
            <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              <h3 style={{fontSize:16,fontWeight:900,margin:0}}>📋 Lịch sử quay</h3>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp}/>
              <button onClick={searchSpins} disabled={loading} style={{...inp,background:"#e99849",color:"#fff",border:"none",cursor:"pointer",fontWeight:700}}>{loading?"⏳":"🔍"} Tìm</button>
              {suspiciousPhones.length>0&&<span style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"6px 12px",fontSize:12,color:"#dc2626",fontWeight:700}}>🚨 {suspiciousPhones.length} SĐT bất thường</span>}
            </div>
            {/* ── BỘ LỌC ── */}
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center",background:"#f9fafb",borderRadius:10,padding:"10px 14px",border:"1px solid #e5e7eb"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginRight:4}}>🔍 Lọc:</div>
              <input value={filterPhone} onChange={e=>setFilterPhone(e.target.value)} placeholder="SĐT..." onKeyDown={e=>e.key==="Enter"&&searchSpins()}
                style={{...inp,width:140,padding:"6px 10px",fontSize:13}}/>
              <input value={filterBill} onChange={e=>setFilterBill(e.target.value)} placeholder="Mã bill..." onKeyDown={e=>e.key==="Enter"&&searchSpins()}
                style={{...inp,width:150,padding:"6px 10px",fontSize:13}}/>
              <select value={filterValid} onChange={e=>{setFilterValid(e.target.value);}} style={{...inp,padding:"6px 10px",fontSize:13,width:120}}>
                <option value="all">Tất cả</option>
                <option value="yes">Hợp lệ</option>
                <option value="no">Không HL</option>
              </select>
              <button onClick={searchSpins} style={{padding:"6px 14px",background:"#1b459c",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>Áp dụng</button>
              {(filterPhone||filterBill||filterValid!=="all")&&<button onClick={()=>{setFilterPhone("");setFilterBill("");setFilterValid("all");}} style={{padding:"6px 12px",background:"#f3f4f6",border:"1px solid #d1d5db",borderRadius:8,color:"#6b7280",cursor:"pointer",fontSize:12}}>✕ Xóa lọc</button>}
              <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                <button onClick={()=>{
                  const rows=spins.map(s=>`${s.bill_code},${s.phone},${s.store_name||s.store_id||""},${s.prize_name||""},${s.voucher_code||""},${s.is_valid?"valid":"invalid"},${s.spun_at||""}`).join("\n");
                  const a=document.createElement("a"); a.href="data:text/csv;charset=utf-8,\uFEFFBill,SĐT,Cửa hàng,Giải,Voucher,Trạng thái,Thời gian\n"+rows; a.download=`spins_${date}.csv`; a.click();
                }} style={{padding:"6px 12px",background:"#f0fdf4",border:"1px solid #a7f3d0",borderRadius:8,color:"#065f46",cursor:"pointer",fontSize:12,fontWeight:700}}>↓ CSV</button>
                <button onClick={()=>{
                  const hdr=`<tr><th>Bill</th><th>SĐT</th><th>Cửa hàng</th><th>Giải</th><th>Voucher</th><th>Trạng thái</th><th>Thời gian</th></tr>`;
                  const body=spins.map(s=>`<tr><td>${s.bill_code}</td><td>${s.phone}</td><td>${s.store_name||""}</td><td>${s.prize_name||""}</td><td>${s.voucher_code||""}</td><td>${s.is_valid?"valid":"invalid"}</td><td>${s.spun_at||""}</td></tr>`).join("");
                  const html=`<html><head><meta charset="UTF-8"></head><body><table>${hdr}${body}</table></body></html>`;
                  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\uFEFF"+html],{type:"application/vnd.ms-excel;charset=utf-8"})); a.download=`spins_${date}.xls`; a.click();
                }} style={{padding:"6px 12px",background:"#f0fdf4",border:"1px solid #a7f3d0",borderRadius:8,color:"#1b459c",cursor:"pointer",fontSize:12,fontWeight:700}}>↓ Excel</button>
              </div>
            </div>
            <div style={{fontSize:12,color:"#9ca3af",marginBottom:8}}>Hiển thị {spins.length} kết quả{filterPhone?` · SĐT: ${filterPhone}`:""}{filterBill?` · Bill: ${filterBill}`:""}</div>
            <div style={{display:"flex",gap:16,marginBottom:12,flexWrap:"wrap"}}>
              {[["Tổng",spins.length,"#374151"],["Hợp lệ",spins.filter(s=>s.is_valid).length,"#10b981"],["Không HL",spins.filter(s=>!s.is_valid).length,"#ef4444"],["Ban",spins.filter(s=>s.shadow_ban_hit).length,"#e99849"]].map(([l,v,c])=>(
                <div key={l} style={{background:"#fff",borderRadius:10,padding:"10px 16px",border:"1px solid #e5e7eb",minWidth:80,textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
                  <div style={{fontSize:12,color:"#6b7280"}}>{l}</div>
                </div>
              ))}
            </div>
            {suspiciousPhones.length>0&&(
              <div style={{background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:12,padding:"14px 18px",marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:800,color:"#dc2626",marginBottom:8}}>🚨 Cảnh báo — SĐT có ≥5 lượt quay trong ngày</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {suspiciousPhones.map(s=>(
                    <div key={s.phone} style={{display:"flex",alignItems:"center",gap:6,background:"#fff",border:"1px solid #fecaca",borderRadius:8,padding:"6px 12px"}}>
                      <span style={{fontFamily:"monospace",fontWeight:700,fontSize:14}}>{s.phone}</span>
                      <span style={{background:"#dc2626",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700}}>{s.count} lượt</span>
                      <button onClick={async()=>{if(!confirm(`Thêm ${s.phone} vào blacklist?`))return;await addBlacklist(s.phone,"Spam ≥5 lượt/ngày");loadAll();}} style={{padding:"2px 8px",borderRadius:4,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",cursor:"pointer",fontSize:11,fontWeight:700}}>🚫 Ban</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f9fafb"}}>
                  {["Mã Bill","SĐT","Cửa hàng","Giải","Voucher","Trạng thái","Thời gian",""].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {spins.length===0 ? <tr><td colSpan={8} style={{...td,textAlign:"center",color:"#9ca3af"}}>Không có dữ liệu</td></tr>
                  : spins.map(s=>{
                    // Detect sequential bill pattern
                    const billMatch = s.bill_code?.match(/^([A-Z.]+?)(\d{3,})$/);
                    const isSeq = billMatch && spins.some(o => o.id!==s.id && o.phone===s.phone && o.bill_code?.startsWith(billMatch[1]) && Math.abs(parseInt(o.bill_code.replace(billMatch[1],"")) - parseInt(billMatch[2]))===1);
                    return (
                    <tr key={s.id} style={{background:isSeq?"#fef9f0":s.is_valid?"#fff":"#fef2f2"}}>
                      <td style={{...td,fontFamily:"monospace",fontWeight:700}}>
                        {s.bill_code}
                        {isSeq&&<span style={{marginLeft:4,fontSize:10,color:"#e99849",fontWeight:800}} title="Bill có số liên tiếp — nghi ngờ gian lận">⚠️</span>}
                      </td>
                      <td style={td}>{s.phone}</td>
                      <td style={{...td,fontSize:12,color:"#6b7280"}}>{s.store_name||s.store_id||"—"}</td>
                      <td style={{...td,fontWeight:700}}>{s.prize_name}</td>
                      <td style={{...td,fontFamily:"monospace",fontWeight:700,color:"#e99849",background:s.voucher_code&&s.voucher_code!=="PENDING"?"#fef9f0":"transparent"}}>{s.voucher_code||"—"}</td>
                      <td style={td}><span style={{borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700,background:s.is_valid?"#f0fdf4":"#fef2f2",color:s.is_valid?"#065f46":"#dc2626"}}>{s.is_valid?"✅ Hợp lệ":"❌ Không HLệ"}</span></td>
                      <td style={{...td,fontSize:12,color:"#9ca3af"}}>{timeAgo(s.spun_at)}</td>
                      <td style={td}><button onClick={async()=>{if(!confirm(`Xóa spin này? Bill "${s.bill_code}" sẽ được giải phóng để nhập lại.`))return;await deleteSpin(s.id);loadAll();}} style={{padding:"3px 8px",borderRadius:6,border:"1px solid #fecaca",background:"#fff",color:"#ef4444",cursor:"pointer",fontSize:11}} title="Xóa spin — giải phóng bill code">🗑</button></td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ĐỐI CHIẾU ── */}
        {tab==="reconcile"&&(()=>{
          const validSpins = spins.filter(s=>s.is_valid);
          return (
          <div>
            <h3 style={{fontSize:16,fontWeight:900,marginBottom:8}}>🔍 Đối chiếu bill</h3>
            <p style={{fontSize:13,color:"#6b7280",marginBottom:12}}>Lọc theo SĐT hoặc bill → Chọn → Invalidate hàng loạt. Voucher đã cấp sẽ tự động void.</p>

            {/* ── BỘ LỌC ── */}
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center",background:"#f9fafb",borderRadius:10,padding:"10px 14px",border:"1px solid #e5e7eb"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#6b7280"}}>🔍</div>
              <input value={filterPhone} onChange={e=>setFilterPhone(e.target.value)} placeholder="SĐT..." onKeyDown={e=>e.key==="Enter"&&searchSpins()}
                style={{...inp,width:140,padding:"6px 10px",fontSize:13}}/>
              <input value={filterBill} onChange={e=>setFilterBill(e.target.value)} placeholder="Mã bill..." onKeyDown={e=>e.key==="Enter"&&searchSpins()}
                style={{...inp,width:150,padding:"6px 10px",fontSize:13}}/>
              <button onClick={searchSpins} style={{padding:"6px 14px",background:"#1b459c",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>Tìm</button>
              {(filterPhone||filterBill)&&<button onClick={()=>{setFilterPhone("");setFilterBill("");setFilterValid("all");}} style={{padding:"6px 12px",background:"#f3f4f6",border:"1px solid #d1d5db",borderRadius:8,color:"#6b7280",cursor:"pointer",fontSize:12}}>✕ Xóa lọc</button>}
            </div>

            {/* ── ACTIONS ── */}
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              <button onClick={()=>{if(reconSelected.size===validSpins.length)setReconSelected(new Set());else setReconSelected(new Set(validSpins.map(s=>s.bill_code)));}}
                style={{padding:"6px 14px",background:"#f3f4f6",border:"1px solid #d1d5db",borderRadius:8,color:"#374151",cursor:"pointer",fontSize:12,fontWeight:700}}>
                {reconSelected.size===validSpins.length&&validSpins.length>0?"☑ Bỏ chọn tất cả":`☐ Chọn tất cả (${validSpins.length})`}
              </button>
              {reconSelected.size>0&&(
                <>
                  <span style={{fontSize:13,fontWeight:700,color:"#dc2626"}}>Đã chọn: {reconSelected.size}</span>
                  <button onClick={async()=>{
                    if(!confirm(`Invalidate ${reconSelected.size} bill?\n\nVoucher đã cấp sẽ bị void. Bill sẽ không thể nhập lại (trừ khi xóa spin).`))return;
                    await adminInvalidate([...reconSelected]); setReconSelected(new Set()); searchSpins();
                  }} style={{padding:"8px 18px",background:"#dc2626",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:800}}>
                    🚫 Invalidate {reconSelected.size} bill
                  </button>
                </>
              )}
              <div style={{fontSize:12,color:"#9ca3af",marginLeft:"auto"}}>{validSpins.length} bill hợp lệ{filterPhone?` · SĐT: ${filterPhone}`:""}</div>
            </div>

            <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f9fafb"}}>
                  {["☐","Bill","SĐT","Cửa hàng","Giải","Voucher","Thời gian"].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {validSpins.length===0 ? <tr><td colSpan={7} style={{...td,textAlign:"center",color:"#9ca3af"}}>{filterPhone||filterBill?"Không tìm thấy — thử filter khác":"Không có dữ liệu"}</td></tr>
                  : validSpins.map(s=>(
                    <tr key={s.id} style={{background:reconSelected.has(s.bill_code)?"#fef2f2":"#fff"}}>
                      <td style={td}><input type="checkbox" checked={reconSelected.has(s.bill_code)} onChange={e=>{const ns=new Set(reconSelected);e.target.checked?ns.add(s.bill_code):ns.delete(s.bill_code);setReconSelected(ns);}}/></td>
                      <td style={{...td,fontFamily:"monospace",fontWeight:700}}>{s.bill_code}</td>
                      <td style={td}>{s.phone}</td>
                      <td style={{...td,fontSize:12,color:"#6b7280"}}>{s.store_name||s.store_id||"—"}</td>
                      <td style={td}>{s.prize_name}</td>
                      <td style={{...td,fontFamily:"monospace",fontSize:12}}>{s.voucher_code||"—"}</td>
                      <td style={{...td,fontSize:12,color:"#9ca3af"}}>{timeAgo(s.spun_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>);
        })()}

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

        {tab==="vdetail"&&<VoucherDetailPanel prizes={prizes}/>}

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

        {/* ── PHÂN QUYỀN (super_admin only) ── */}
        {tab==="access"&&userRole==="super_admin"&&(
          <AccessManagement emails={allowedEmails} onReload={loadAll}/>
        )}
      </div>
      {editingPrize&&<EditPrizeModal prize={editingPrize} onClose={()=>setEditingPrize(null)} onSave={()=>{setEditingPrize(null);loadAll();}}/>}
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
          {activePrizes.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
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
  const [admin, setAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    const h = window.location.hash;
    // OAuth redirect trả về #access_token=... → check localStorage xem có đang login admin không
    if (h.includes("access_token")) {
      try { if (localStorage.getItem("st_goto_admin")) return true; } catch(e){}
    }
    return h.includes("admin");
  });
  useEffect(() => {
    const onHash = () => setAdmin(window.location.hash.includes("admin"));
    window.addEventListener("hashchange", onHash);
    // Nếu đang ở admin sau OAuth → set hash sạch
    if (admin && window.location.hash.includes("access_token")) {
      try { localStorage.removeItem("st_goto_admin"); } catch(e){}
      window.history.replaceState(null, "", window.location.pathname + "#admin");
    }
    return () => window.removeEventListener("hashchange", onHash);
  }, [admin]);
  if (admin) return <AdminPage onBack={() => { window.location.hash = ""; setAdmin(false); }}/>;
  return <CustomerPage onAdmin={() => { window.location.hash = "#admin"; setAdmin(true); }}/>;
}
