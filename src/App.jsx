import { useState, useRef, useEffect, useCallback } from "react";
import {
  doSpin, loadActivePrizes, loadAllPrizes, savePrize, deletePrize, updatePrizesOrder, resetDefaultPrizes, testConnection,
  loadStoreStats, loadSettings, saveSetting,
  loadSpins, loadSpecialWinners, loadBlacklist, loadVouchers,
  adminInvalidate, importVouchers, addBlacklist, removeBlacklist, updateSpecialStatus,
  loadPrizeVouchers, deleteVoucher, bulkDeleteVouchers,
} from "./supabase.js";

const ADMIN_PWD   = "Santhai2024";
const LOW_STOCK   = 10; // cảnh báo khi số voucher còn lại < 10

/* ─── STORE MAP — Auto-detect từ bill code ─── */
// Source: accounting_sale.xlsx — 75 stores, sorted by prefix length DESC
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
  const code = billCode.trim().toUpperCase().replace(/\u200b/g,"");
  for (const [prefix, name] of STORE_PREFIXES) {
    if (code.startsWith(prefix.toUpperCase())) return { id:prefix, name };
  }
  return { id:"", name:"" };
}

/* ─── GLOBAL STYLES ─── */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Baloo+2:wght@700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Nunito', sans-serif; background: #fff7ed; color: #1c1917; }
  :root {
    --primary: #f97316;
    --primary-dark: #ea580c;
    --gold: #f59e0b;
    --purple: #7c3aed;
    --green: #10b981;
    --red: #ef4444;
    --bg: #fff7ed;
    --card: #ffffff;
    --text: #1c1917;
    --muted: #78716c;
    --border: #fed7aa;
    --radius: 16px;
    --shadow: 0 4px 24px rgba(249,115,22,.15);
  }
  input, select, textarea {
    font-family: 'Nunito', sans-serif;
    outline: none;
    transition: border-color .2s, box-shadow .2s;
  }
  input:focus, select:focus { border-color: var(--primary) !important; box-shadow: 0 0 0 3px rgba(249,115,22,.2); }
  button { font-family: 'Nunito', sans-serif; cursor: pointer; }
  @keyframes bounce-in { 0%{transform:scale(.5);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
  @keyframes fall { to { transform: translateY(110vh) rotate(720deg); opacity:0; } }
  @keyframes pulse-ring { 0%{box-shadow:0 0 0 0 rgba(249,115,22,.5)} 70%{box-shadow:0 0 0 20px transparent} 100%{box-shadow:0 0 0 0 transparent} }
  @keyframes slide-up { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes spin-count { 0%{transform:scale(1)} 50%{transform:scale(1.4)} 100%{transform:scale(1)} }
  @keyframes glow { 0%,100%{filter:drop-shadow(0 0 8px var(--gold))} 50%{filter:drop-shadow(0 0 20px var(--gold))} }
`;

const WHEEL_COLORS = [
  '#FF6B6B','#FF9F43','#FECA57','#48DB71','#1DD1A1',
  '#54A0FF','#5F27CD','#FF6B81','#FF9FF3','#00D2D3',
  '#F368E0','#FF9F43','#576574','#C4E538','#EE5A24','#9B59B6',
];

/* ─── WHEEL CANVAS ─── */
function WheelCanvas({ prizes, winnerId, spinning, onDone, size }) {
  const ref    = useRef(null);
  const rotRef = useRef(0);
  const rafRef = useRef(null);

  const segs = prizes.map((p, i) => {
    const sweep = (2 * Math.PI) / prizes.length;
    const start = -Math.PI / 2 + i * sweep;
    return { ...p, sweep, start, mid: start + sweep / 2, color: WHEEL_COLORS[i % WHEEL_COLORS.length] };
  });

  const draw = useCallback((rot) => {
    const c = ref.current; if (!c || segs.length === 0) return;
    const ctx = c.getContext("2d"), W = c.width, cx = W/2, cy = W/2, R = W/2 - 6;
    ctx.clearRect(0, 0, W, W);

    // Outer ring
    ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, 2*Math.PI);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = var_gold(); ctx.lineWidth = 6; ctx.stroke();

    segs.forEach(({ start, sweep, color, icon, short_name, name }) => {
      const s = start + rot, e = s + sweep;
      // Segment
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, s, e); ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2; ctx.stroke();
      // Text
      const mid = start + rot + sweep / 2;
      const lr  = R * 0.62;
      ctx.save();
      ctx.translate(cx + lr * Math.cos(mid), cy + lr * Math.sin(mid));
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = "#fff";
      ctx.textAlign  = "center";
      ctx.textBaseline = "middle";
      const fs = Math.max(8, Math.min(13, sweep * 50));
      // Icon
      ctx.font = `${Math.max(10, fs + 2)}px sans-serif`;
      ctx.fillText(icon || "🎁", 0, -fs * 0.7);
      // Label
      ctx.font = `700 ${fs}px Nunito,sans-serif`;
      const label = short_name || name;
      if (label.length > 8) {
        ctx.font = `700 ${Math.max(6, fs - 2)}px Nunito,sans-serif`;
      }
      ctx.fillText(label, 0, fs * 0.8);
      ctx.restore();
    });

    // Center hub
    const hR = R * 0.12;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, hR);
    grad.addColorStop(0, "#fef3c7");
    grad.addColorStop(1, "#f59e0b");
    ctx.beginPath(); ctx.arc(cx, cy, hR + 3, 0, 2*Math.PI);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, hR, 0, 2*Math.PI);
    ctx.fillStyle = grad; ctx.fill();

    // Pointer ▼
    ctx.save(); ctx.translate(cx, 4);
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(-13, -2); ctx.lineTo(13, -2); ctx.closePath();
    ctx.fillStyle = "#f59e0b";
    ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 12;
    ctx.fill(); ctx.restore();
  }, [segs]);

  function var_gold() { return "#f59e0b"; }

  useEffect(() => { draw(0); }, [draw]);

  useEffect(() => {
    if (!spinning || !winnerId || segs.length === 0) return;
    cancelAnimationFrame(rafRef.current);
    const idx = segs.findIndex(s => s.id === winnerId);
    if (idx < 0) { onDone?.(); return; }
    const targetMid = segs[idx].mid;
    let base = -Math.PI / 2 - targetMid;
    const min = rotRef.current + 5 * 2 * Math.PI;
    const n = Math.ceil((min - base) / (2 * Math.PI));
    const target = base + n * 2 * Math.PI;
    const from = rotRef.current, dur = 5000, t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 4);
    const frame = now => {
      const t = Math.min(1, (now - t0) / dur);
      const r = from + (target - from) * ease(t);
      rotRef.current = r; draw(r);
      if (t < 1) rafRef.current = requestAnimationFrame(frame);
      else { rotRef.current = target; draw(target); onDone?.(); }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, winnerId, draw, onDone]);

  if (prizes.length === 0) return (
    <div style={{ width:size, height:size, display:"flex", alignItems:"center", justifyContent:"center",
      borderRadius:"50%", background:"#f1f5f9", color:"#94a3b8", fontSize:14, textAlign:"center", padding:20 }}>
      Chưa có giải thưởng.<br/>Admin cần cấu hình.
    </div>
  );
  return <canvas ref={ref} width={size} height={size} style={{ borderRadius:"50%", display:"block", filter:"drop-shadow(0 8px 24px rgba(249,115,22,.3))" }}/>;
}

/* ─── CONFETTI ─── */
function Confetti() {
  const colors = ["#f59e0b","#ef4444","#a855f7","#10b981","#3b82f6","#fff","#f97316","#ec4899"];
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:999 }}>
      {Array.from({length:60}).map((_,i)=>(
        <div key={i} style={{
          position:"absolute", top:"-10px", left:`${Math.random()*100}%`,
          width:`${5+Math.random()*10}px`, height:`${5+Math.random()*10}px`,
          background:colors[Math.floor(Math.random()*colors.length)],
          borderRadius:Math.random()>.5?"50%":"2px",
          animation:`fall ${2+Math.random()*2}s ${Math.random()*.8}s ease-in forwards`,
          transform:`rotate(${Math.random()*360}deg)`,
        }}/>
      ))}
    </div>
  );
}

/* ─── RESULT MODAL ─── */
function ResultModal({ result, phone, onClose, closeLabel }) {
  if (!result) return null;
  const big   = result.prize_type === "special";
  const viral = result.prize_type === "viral";
  const code  = result.voucher_code;

  // Tính HSD: 30 ngày từ hôm nay
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  const dd = String(expiry.getDate()).padStart(2,"0");
  const mm = String(expiry.getMonth()+1).padStart(2,"0");
  const yy = String(expiry.getFullYear()).slice(2);
  const hsd = `${dd}/${mm}/${yy}`;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:900, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      {big && <Confetti/>}
      <div style={{ background:"#fff", borderRadius:24, padding:32, maxWidth:380, width:"100%", textAlign:"center", animation:"bounce-in .4s ease", boxShadow:"0 24px 64px rgba(0,0,0,.3)", position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute", top:14, right:14, background:"#f1f5f9", border:"none", borderRadius:"50%", width:32, height:32, fontSize:18, cursor:"pointer", color:"#64748b" }}>✕</button>

        <div style={{ fontSize:big?72:viral?60:56, marginBottom:8, animation:big?"glow 1.5s infinite":undefined }}>
          {result.prize_icon || "🎁"}
        </div>

        {viral ? (
          <>
            <div style={{ fontSize:22, fontWeight:900, color:"#ef4444", marginBottom:6 }}>Ôi không!</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#1c1917", marginBottom:12 }}>Mất Lượt 😅</div>
            <div style={{ background:"#fef2f2", borderRadius:12, padding:"12px 16px", fontSize:14, color:"#dc2626", marginBottom:14, lineHeight:1.7 }}>
              Chưa trúng lần này, nhưng bạn vẫn được<br/>
              <strong>1 topping miễn phí</strong> hôm nay!<br/>
              <span style={{ fontSize:12, color:"#ef4444" }}>Đưa màn hình này cho nhân viên nhé 😊</span>
            </div>
            <div style={{ background:"#fff7ed", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#92400e", lineHeight:1.6 }}>
              📸 Share lên story tag @santhai → nhận thêm 1 lượt quay!
            </div>
          </>
        ) : big ? (
          <>
            <div style={{ fontSize:14, fontWeight:700, color:"#92400e", letterSpacing:1, marginBottom:4 }}>🎉 CHÚC MỪNG!</div>
            <div style={{ fontSize:24, fontWeight:900, color:"#f97316", marginBottom:16 }}>{result.prize_name}</div>
            <div style={{ background:"#fff7ed", border:"2px dashed #f97316", borderRadius:12, padding:"14px 16px", lineHeight:1.7, fontSize:14, color:"#92400e" }}>
              Nhân viên SanThai sẽ liên hệ qua<br/>
              <strong style={{ fontSize:18, color:"#ea580c" }}>{phone}</strong><br/>
              <span style={{ fontSize:12, color:"#a16207" }}>trong vòng 24 giờ để trao giải ✨</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize:14, fontWeight:700, color:"#92400e", letterSpacing:1, marginBottom:4 }}>BẠN TRÚNG!</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#1c1917", marginBottom:14 }}>{result.prize_name}</div>
            {code && code !== "PENDING" ? (
              <>
                {/* Voucher code box */}
                <div style={{ background:"linear-gradient(135deg,#fff7ed,#fef3c7)", border:"2px solid #f59e0b", borderRadius:14, padding:"16px 18px", marginBottom:12 }}>
                  <div style={{ fontSize:11, color:"#92400e", fontWeight:700, letterSpacing:1, marginBottom:8 }}>MÃ VOUCHER CỦA BẠN</div>
                  <div style={{ fontSize:30, fontWeight:900, color:"#ea580c", letterSpacing:4, wordBreak:"break-all", marginBottom:4 }}>{code}</div>
                </div>
                {/* Instruction message */}
                <div style={{ background:"#f0fdf4", border:"2px solid #10b981", borderRadius:12, padding:"13px 16px", fontSize:14, color:"#065f46", lineHeight:1.8, textAlign:"left" }}>
                  🧋 Mã voucher của bạn là <strong style={{ color:"#ea580c", fontFamily:"monospace" }}>"{code}"</strong>.<br/>
                  HSD là <strong>{hsd}</strong> <span style={{ fontSize:12, color:"#6b7280" }}>(30 ngày từ ngày up lên)</span>.<br/>
                  <span style={{ fontSize:13, color:"#047857" }}>Vui lòng lưu mã hoặc chụp màn hình để đổi thưởng nha 📸</span>
                </div>
              </>
            ) : code === "PENDING" ? (
              <div style={{ background:"#fffbeb", border:"2px solid #f59e0b", borderRadius:12, padding:14, fontSize:14, color:"#92400e", lineHeight:1.7 }}>
                ⏳ Hệ thống đang xử lý voucher của bạn.<br/>
                Vui lòng đưa màn hình này cho nhân viên<br/>để nhận <strong>{result.prize_name}</strong> miễn phí!
              </div>
            ) : (
              <div style={{ background:"#f0fdf4", border:"2px solid #10b981", borderRadius:12, padding:14, fontSize:14, color:"#065f46", lineHeight:1.6 }}>
                🧋 Đưa màn hình này cho nhân viên<br/>để nhận <strong>{result.prize_name}</strong> miễn phí!
              </div>
            )}
          </>
        )}
        <button onClick={onClose} style={{ marginTop:16, width:"100%", padding:"13px", background:"linear-gradient(135deg,#f97316,#ea580c)", border:"none", borderRadius:12, color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer" }}>
          {closeLabel||"Đóng"}
        </button>
      </div>
    </div>
  );
}

/* ─── MAIN CUSTOMER PAGE ─── */
function CustomerPage({ onAdmin }) {
  const [prizes,   setPrizes]   = useState([]);
  const [stats,    setStats]    = useState([]);
  const [settings, setSettings] = useState({
    event_name:"SanThai", event_subtitle:"Vòng Quay May Mắn",
    description:"", show_prize_list:"false",
    bg_color:"#fff7ed", bg_image_url:"", frame_image_url:""
  });

  // Multi-bill queue
  const [bill,       setBill]       = useState("");
  const [phone,      setPhone]      = useState(()=>{ try{return localStorage.getItem("st_phone")||""}catch{return""} });
  const [billQueue,  setBillQueue]  = useState([]); // [{billCode, result}]
  const [err,        setErr]        = useState("");
  const [loading,    setLoading]    = useState(false);

  // Spin state
  const [spinIdx,    setSpinIdx]    = useState(-1);  // which result we're animating
  const [spinning,   setSpinning]   = useState(false);
  const [curResult,  setCurResult]  = useState(null); // result modal after each spin
  const [descOpen,   setDescOpen]   = useState(false);

  const showPrizeList = settings.show_prize_list !== "false";
  const hasBg = settings.bg_image_url && settings.bg_image_url.startsWith("http");
  const wheelSize = typeof window!=="undefined"
    ? Math.min(showPrizeList?300:420, window.innerWidth-48)
    : 340;

  const bgStyle = hasBg
    ? { backgroundImage:`url(${settings.bg_image_url})`, backgroundSize:"cover", backgroundPosition:"center" }
    : { background: settings.bg_color || "#fff7ed" };

  useEffect(() => {
    loadActivePrizes().then(setPrizes);
    loadStoreStats().then(setStats);
    loadSettings().then(s => { if(Object.keys(s).length) setSettings(prev=>({...prev,...s})); });
    const t = setInterval(()=>loadStoreStats().then(setStats), 60000);
    return ()=>clearInterval(t);
  }, []);

  // Auto-detect store from bill prefix
  const handleBillChange = (val) => {
    setBill(val.toUpperCase());
    setErr("");
  };

  // Submit one bill → add to queue
  const handleAddBill = async () => {
    const b = bill.trim().toUpperCase();
    const p = phone.replace(/\D/g,"");
    if (!b || b.length < 4) return setErr("Vui lòng nhập mã bill hợp lệ.");
    if (p.length < 9 || p.length > 11) return setErr("Số điện thoại không hợp lệ.");
    if (billQueue.some(q=>q.billCode===b)) return setErr("Mã bill này đã thêm vào rồi.");
    setLoading(true); setErr("");
    // Save phone to localStorage
    try { localStorage.setItem("st_phone", p); } catch {}
    const store = detectStore(b);
    const res   = await doSpin(b, p, store.id||null, store.name||null);
    setLoading(false);
    if (!res || res.error==="network")     return setErr("Không kết nối được. Kiểm tra mạng.");
    if (res.error==="bill_used")           return setErr("Mã bill này đã được sử dụng rồi.");
    if (res.error==="setup_required")      return setErr("Hệ thống chưa sẵn sàng. Liên hệ quản lý.");
    if (res.error)                         return setErr(res.message||"Lỗi hệ thống, thử lại.");
    if (res.ok) {
      setBillQueue(q=>[...q, { billCode:b, store:store.name, result:res }]);
      setBill("");
    }
  };

  // Start spinning through queue
  const handleStartSpin = () => {
    if (billQueue.length===0 || spinning) return;
    setSpinIdx(0);
    setSpinning(true);
  };

  const handleSpinDone = useCallback(()=>{
    setTimeout(()=>{
      setCurResult(billQueue[spinIdx]?.result || null);
      setSpinning(false);
    }, 400);
  }, [spinIdx, billQueue]);

  const handleNextSpin = () => {
    setCurResult(null);
    const next = spinIdx + 1;
    if (next < billQueue.length) {
      setSpinIdx(next);
      setSpinning(true);
    } else {
      // All done
      setSpinIdx(-1);
      setBillQueue([]);
    }
  };

  const currentPrize = spinning || curResult
    ? billQueue[spinIdx]?.result
    : null;

  const tooManySpins = billQueue.length >= 5;

  return (
    <div style={{ minHeight:"100vh", ...bgStyle }}>
      <style>{G}</style>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#f97316,#ea580c,#dc2626)", padding:"18px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:24, fontWeight:900, color:"#fff", fontFamily:"'Baloo 2',sans-serif", letterSpacing:1 }}>
            🎯 {settings.event_name||"SanThai"}
          </div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.8)", fontWeight:600 }}>
            {settings.event_subtitle||"Vòng Quay May Mắn"}
          </div>
        </div>
        <div onClick={onAdmin} style={{ fontSize:11, color:"rgba(255,255,255,.3)", cursor:"default", userSelect:"none" }}>v2</div>
      </div>

      {/* Main split */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:0, minHeight:"calc(100vh - 80px - 60px)" }}>

        {/* LEFT — Form */}
        <div style={{ flex:"1 1 320px", padding:"28px 24px", background:"rgba(255,255,255,.92)", borderRight:"1px solid #fed7aa", display:"flex", flexDirection:"column", gap:16 }}>

          {/* Warning banner */}
          <div style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)", borderRadius:10, padding:"10px 14px", borderLeft:"4px solid #f59e0b", fontSize:13, color:"#92400e", lineHeight:1.6 }}>
            ⚠️ Mã bill sẽ được đối chiếu POS cuối ngày. Dùng mã không hợp lệ có thể bị hạn chế tham gia.
          </div>

          {/* Description toggle */}
          {settings.description && (
            <div>
              <button onClick={()=>setDescOpen(o=>!o)}
                style={{ background:"rgba(249,115,22,.1)", border:"1px solid rgba(249,115,22,.3)", borderRadius:8, padding:"8px 14px", fontSize:13, color:"#ea580c", fontWeight:700, cursor:"pointer", width:"100%", textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>📋 Thể lệ & Thông tin sự kiện</span>
                <span>{descOpen?"▲":"▼"}</span>
              </button>
              {descOpen && (
                <div style={{ background:"#fff7ed", borderRadius:"0 0 10px 10px", padding:"12px 14px", fontSize:14, color:"#78350f", lineHeight:1.8, whiteSpace:"pre-wrap", borderTop:"1px solid #fed7aa" }}>
                  {settings.description}
                </div>
              )}
            </div>
          )}

          {/* Phone (saved via localStorage) */}
          <div>
            <label style={{ display:"block", fontSize:14, fontWeight:700, color:"#44403c", marginBottom:8 }}>
              📱 Số điện thoại
            </label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} type="tel"
              placeholder="VD: 0901234567" maxLength={11} disabled={billQueue.length>0&&spinning}
              style={{ width:"100%", padding:"12px 14px", border:"2px solid #fed7aa", borderRadius:12, fontSize:15, color:"#1c1917", boxSizing:"border-box" }}/>
            <div style={{ fontSize:12, color:"#a8a29e", marginTop:4 }}>Số được lưu để không cần nhập lại lần sau</div>
          </div>

          {/* Bill input */}
          <div>
            <label style={{ display:"block", fontSize:14, fontWeight:700, color:"#44403c", marginBottom:8 }}>
              🧾 Mã bill (in trên hóa đơn)
            </label>
            <input value={bill} onChange={e=>handleBillChange(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleAddBill()}
              placeholder="VD: SXVNT212106" maxLength={30} disabled={loading||spinning}
              autoCapitalize="characters"
              style={{ width:"100%", padding:"13px 16px", border:`2px solid ${detectStore(bill).name?"#10b981":"#fed7aa"}`, borderRadius:12, fontSize:16, fontWeight:700, letterSpacing:1, color:"#1c1917", boxSizing:"border-box" }}/>
            {detectStore(bill).name ? (
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                <span>🏪</span>
                <span style={{ fontSize:13, color:"#059669", fontWeight:700 }}>{detectStore(bill).name}</span>
              </div>
            ) : bill.length>=2 ? (
              <div style={{ fontSize:12, color:"#f59e0b", marginTop:4 }}>⚠ Không nhận ra mã CH — vẫn có thể quay</div>
            ) : null}
          </div>

          {err && <div style={{ background:"#fef2f2", border:"2px solid #fecaca", borderRadius:10, padding:"10px 14px", fontSize:14, color:"#dc2626" }}>{err}</div>}

          {/* Too many spins warning */}
          {tooManySpins && (
            <div style={{ background:"#fef2f2", border:"2px solid #ef4444", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#dc2626", lineHeight:1.6 }}>
              ⚠️ Tích lũy nhiều bill sẽ được kiểm tra kỹ trong đợt đối chiếu cuối ngày.
            </div>
          )}

          {/* Add bill button */}
          <button onClick={handleAddBill} disabled={loading||spinning||!bill.trim()}
            style={{ padding:"14px", background: bill.trim()&&!loading&&!spinning?"linear-gradient(135deg,#f97316,#ea580c)":"#e5e7eb",
              border:"none", borderRadius:14, color: bill.trim()&&!loading&&!spinning?"#fff":"#9ca3af",
              fontSize:16, fontWeight:900, cursor:bill.trim()&&!loading&&!spinning?"pointer":"not-allowed",
              boxShadow: bill.trim()&&!loading&&!spinning?"0 4px 20px rgba(249,115,22,.4)":"none" }}>
            {loading?"⏳ Đang xác nhận…":"✅ NHẬN LƯỢT QUAY"}
          </button>

          {/* Queue list */}
          {billQueue.length>0 && (
            <div style={{ background:"#f0fdf4", borderRadius:12, padding:"12px 14px", border:"2px solid #a7f3d0" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#065f46", marginBottom:8 }}>
                🎯 Đã nhận {billQueue.length} lượt quay:
              </div>
              {billQueue.map((q,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#374151", marginBottom:4, padding:"4px 0", borderBottom:"1px solid #d1fae5" }}>
                  <span style={{ fontFamily:"monospace", fontWeight:700 }}>{q.billCode}</span>
                  <span style={{ color:"#6b7280" }}>{q.store||"—"}</span>
                  <span style={{ color: i<spinIdx?"#10b981":i===spinIdx&&spinning?"#f97316":"#94a3b8" }}>
                    {i<spinIdx?"✓ Đã quay":i===spinIdx&&spinning?"🌀 Đang quay…":"⏳ Chờ"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize:11, color:"#a8a29e", textAlign:"center" }}>Mỗi mã bill chỉ dùng được 1 lần</div>
        </div>

        {/* RIGHT — Wheel */}
        <div style={{ flex:"1 1 320px", padding:"28px 20px", background:"rgba(255,247,237,.7)", display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>

          {/* Spin count */}
          <div style={{
            background: billQueue.length>0&&spinIdx<0?"linear-gradient(135deg,#f97316,#ea580c)":"#e5e7eb",
            borderRadius:50, padding:"8px 22px", fontSize:16, fontWeight:800,
            color: billQueue.length>0&&spinIdx<0?"#fff":"#9ca3af",
            boxShadow: billQueue.length>0&&spinIdx<0?"0 4px 16px rgba(249,115,22,.4)":"none",
            animation: billQueue.length>0&&spinIdx<0?"pulse-ring 1.5s infinite":"none",
            transition:"all .4s",
          }}>
            🎯 {Math.max(0, billQueue.length - Math.max(0,spinIdx))} lượt quay
            {spinIdx>=0&&spinning&&` — Lượt ${spinIdx+1}/${billQueue.length}`}
          </div>

          {/* Wheel with optional frame overlay */}
          <div style={{ position:"relative", display:"inline-block" }}>
            <WheelCanvas
              prizes={prizes}
              winnerId={currentPrize?.prize_id}
              spinning={spinning}
              onDone={handleSpinDone}
              size={wheelSize}/>
            {settings.frame_image_url && settings.frame_image_url.startsWith("http") && (
              <img src={settings.frame_image_url} alt="" style={{
                position:"absolute", inset:-10, width:"calc(100% + 20px)", height:"calc(100% + 20px)",
                pointerEvents:"none", objectFit:"contain",
              }}/>
            )}
          </div>

          {/* Spin / Add more buttons */}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleStartSpin}
              disabled={billQueue.length===0||spinning||spinIdx>=0}
              style={{
                padding:"14px 28px", fontSize:17, fontWeight:900, border:"none", borderRadius:50, cursor:billQueue.length>0&&!spinning&&spinIdx<0?"pointer":"not-allowed",
                background:billQueue.length>0&&!spinning&&spinIdx<0?"linear-gradient(135deg,#7c3aed,#6d28d9)":"#e5e7eb",
                color:billQueue.length>0&&!spinning&&spinIdx<0?"#fff":"#9ca3af",
                boxShadow:billQueue.length>0&&!spinning&&spinIdx<0?"0 6px 24px rgba(124,58,237,.5)":"none",
                animation:billQueue.length>0&&!spinning&&spinIdx<0?"pulse-ring 1.5s infinite":"none",
              }}>
              {spinning?"🌀 Đang quay…":billQueue.length>0&&spinIdx<0?"🎰 QUAY NGAY!":"Nhập bill trước"}
            </button>
          </div>

          {/* Prize list (toggleable) */}
          {showPrizeList && prizes.length>0 && (
            <div style={{ width:"100%", maxWidth:400 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#92400e", marginBottom:8, textAlign:"center" }}>Danh sách phần thưởng</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))", gap:6 }}>
                {prizes.map((p,i)=>(
                  <div key={p.id} style={{ background:"#fff", borderRadius:10, padding:"8px 6px", textAlign:"center", border:"2px solid #fed7aa", fontSize:11, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:WHEEL_COLORS[i%WHEEL_COLORS.length] }}/>
                    <div style={{ fontSize:16 }}>{p.icon}</div>
                    <div style={{ fontWeight:700, color:"#44403c", lineHeight:1.3 }}>{p.short_name||p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PUBLIC LEADERBOARD */}
      <div style={{ background:"rgba(255,255,255,.95)", borderTop:"2px solid #fed7aa", padding:"28px 24px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#1c1917", marginBottom:4, fontFamily:"'Baloo 2',sans-serif" }}>
            🏆 Bảng xếp hạng cửa hàng
          </div>
          <div style={{ fontSize:13, color:"#78716c", marginBottom:16 }}>Cập nhật mỗi phút</div>
          <div style={{ overflowX:"auto", borderRadius:14, border:"2px solid #fed7aa" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
              <thead>
                <tr style={{ background:"linear-gradient(135deg,#fff7ed,#fef3c7)" }}>
                  {["#","Cửa hàng","Tổng lượt quay","Giải lớn 🏆","Hoạt động gần nhất"].map(h=>(
                    <th key={h} style={{ padding:"12px 14px", textAlign:"left", fontSize:13, fontWeight:800, color:"#92400e", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.length===0?(
                  <tr><td colSpan={5} style={{ padding:24, textAlign:"center", color:"#a8a29e", fontSize:14 }}>
                    Chưa có dữ liệu — event chưa bắt đầu
                  </td></tr>
                ):stats.map((s,i)=>(
                  <tr key={s.store_id} style={{ borderTop:"1px solid #fed7aa", background:i===0?"#fff7ed":i===1?"#fefce8":i===2?"#f0fdf4":"#fff" }}>
                    <td style={{ padding:"11px 14px", fontWeight:900, color:i<3?"#f97316":"#78716c", fontSize:16 }}>
                      {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                    </td>
                    <td style={{ padding:"11px 14px", fontWeight:700, color:"#1c1917" }}>{s.store_name||s.store_id}</td>
                    <td style={{ padding:"11px 14px", color:"#f97316", fontWeight:800, fontSize:16 }}>{s.total_spins}</td>
                    <td style={{ padding:"11px 14px" }}>
                      {s.big_wins>0?(
                        <span style={{ background:"#fef3c7", border:"2px solid #f59e0b", borderRadius:20, padding:"3px 10px", fontSize:13, fontWeight:800, color:"#92400e" }}>
                          🏆 {s.big_wins}
                        </span>
                      ):<span style={{ color:"#a8a29e", fontSize:13 }}>—</span>}
                    </td>
                    <td style={{ padding:"11px 14px", color:"#a8a29e", fontSize:13 }}>
                      {s.last_spin?new Date(s.last_spin).toLocaleString("vi-VN"):"—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Result modal after each spin */}
      {curResult && (
        <ResultModal
          result={curResult}
          phone={phone}
          onClose={handleNextSpin}
          closeLabel={spinIdx<billQueue.length-1?`Quay lượt ${spinIdx+2} →`:"Xong 🎉"}
        />
      )}
    </div>
  );
}


/* ─── TEST MODE PANEL ─── */
function buildTestSequence(prizes) {
  if (!prizes.length) return [];
  const seq = [...prizes];
  while (seq.length < 30) seq.push(prizes[Math.floor(Math.random()*prizes.length)]);
  for (let i=seq.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [seq[i],seq[j]]=[seq[j],seq[i]]; }
  return seq.slice(0,30);
}

function TestModePanel({ prizes, allPrizes }) {
  const [seq,     setSeq]     = useState([]);
  const [idx,     setIdx]     = useState(-1);
  const [done,    setDone]    = useState(false);
  const [preview, setPreview] = useState(null);

  const start = () => {
    const active = allPrizes.filter(p=>p.active);
    if (!active.length) { alert("Chưa có giải nào active. Load giải mặc định trước."); return; }
    setSeq(buildTestSequence(active)); setIdx(0); setDone(false);
  };
  const next = () => {
    if (idx < seq.length-1) setIdx(i=>i+1);
    else setDone(true);
  };
  const cur = seq[idx];
  const covered = new Set(seq.slice(0,Math.max(0,idx+1)).map(p=>p.id));
  const missing = allPrizes.filter(p=>p.active && !covered.has(p.id));

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
      {/* Left: sequence runner */}
      <div>
        <h3 style={{ fontSize:15, fontWeight:800, marginBottom:10 }}>🎰 30-lượt test — cover toàn bộ giải</h3>
        <div style={{ background:"#f0fdf4", border:"1px solid #a7f3d0", borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:13, color:"#065f46", lineHeight:1.6 }}>
          Sequence 30 lượt tự động cover đủ tất cả {allPrizes.filter(p=>p.active).length} giải active, sau đó shuffle. Không ghi vào DB.
        </div>
        {idx<0 && !done && (
          <button onClick={start} style={{ width:"100%", padding:"13px", background:"linear-gradient(135deg,#7c3aed,#6d28d9)", border:"none", borderRadius:12, color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer", marginBottom:12 }}>
            ▶ Bắt đầu test 30 lượt
          </button>
        )}
        {idx>=0 && !done && cur && (
          <div style={{ background:"#fff", border:"2px solid #7c3aed", borderRadius:14, padding:20, textAlign:"center" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#7c3aed", letterSpacing:1, marginBottom:4 }}>LƯỢT {idx+1}/30</div>
            <div style={{ fontSize:56, marginBottom:8 }}>{cur.icon||"🎁"}</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#1c1917", marginBottom:4 }}>{cur.name}</div>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:14 }}>
              Loại: <strong>{cur.prize_type}</strong> · {cur.prize_type==="normal"&&cur.has_voucher?"Sẽ cấp voucher":cur.prize_type==="special"?"Liên hệ SĐT":"Mất lượt"}
            </div>
            {cur.prize_type==="normal"&&cur.has_voucher&&(
              <div style={{ background:"#fef3c7", border:"2px solid #f59e0b", borderRadius:10, padding:10, marginBottom:14, fontFamily:"monospace", fontWeight:900, fontSize:18, color:"#92400e", letterSpacing:3 }}>
                TEST-{String(idx+1).padStart(3,"0")}
              </div>
            )}
            {cur.prize_type==="special"&&(
              <div style={{ background:"#fef2f2", border:"2px solid #ef4444", borderRadius:10, padding:10, marginBottom:14, fontSize:13, color:"#dc2626" }}>
                Nhân viên sẽ gọi: <strong>0901234567</strong>
              </div>
            )}
            <button onClick={next} style={{ padding:"11px 30px", background:"linear-gradient(135deg,#f97316,#ea580c)", border:"none", borderRadius:10, color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer" }}>
              {idx<seq.length-1?"Lượt tiếp →":"✅ Kết thúc"}
            </button>
          </div>
        )}
        {done && (
          <div style={{ background:"#f0fdf4", border:"2px solid #10b981", borderRadius:14, padding:20, textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🎉</div>
            <div style={{ fontSize:20, fontWeight:900, color:"#065f46", marginBottom:4 }}>Test hoàn thành!</div>
            <div style={{ fontSize:14, color:"#6b7280", marginBottom:14 }}>30/30 lượt · Cover {allPrizes.filter(p=>p.active).length} giải</div>
            <button onClick={()=>{setIdx(-1);setDone(false);setSeq([]);}} style={{ padding:"10px 24px", background:"#f3f4f6", border:"none", borderRadius:10, color:"#374151", fontWeight:700, cursor:"pointer" }}>Reset</button>
          </div>
        )}
        {idx>=0 && !done && (
          <div style={{ marginTop:12, fontSize:12, color:"#9ca3af" }}>
            {missing.length>0?`⏳ Chưa cover: ${missing.map(p=>p.short_name||p.name).join(", ")}`:"✅ Đã cover tất cả!"}
          </div>
        )}
      </div>
      {/* Right: preview */}
      <div>
        <h3 style={{ fontSize:15, fontWeight:800, marginBottom:10 }}>👁 Preview từng giải</h3>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:10 }}>Click vào giải để xem màn hình kết quả.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:380, overflowY:"auto" }}>
          {allPrizes.filter(p=>p.active).map(p=>(
            <button key={p.id} onClick={()=>setPreview(p)} style={{
              display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"#fff",
              border:`1px solid ${preview?.id===p.id?"#f97316":"#e5e7eb"}`,
              background:preview?.id===p.id?"#fff7ed":"#fff",
              borderRadius:10, cursor:"pointer", textAlign:"left"
            }}>
              <span style={{ fontSize:22 }}>{p.icon||"🎁"}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{p.name}</div>
                <div style={{ fontSize:11, color:"#9ca3af" }}>{p.prize_type} · {p.probability}%</div>
              </div>
            </button>
          ))}
        </div>
        {preview && (
          <div style={{ marginTop:12, background:"#fff", border:"2px solid #f97316", borderRadius:14, padding:16, textAlign:"center" }}>
            <div style={{ fontSize:11, color:"#92400e", fontWeight:700, marginBottom:4 }}>PREVIEW</div>
            <div style={{ fontSize:44, marginBottom:6 }}>{preview.icon||"🎁"}</div>
            <div style={{ fontSize:18, fontWeight:900 }}>{preview.name}</div>
            {preview.prize_type==="normal"&&preview.has_voucher&&<div style={{ margin:"10px 0", background:"#fef3c7", border:"2px solid #f59e0b", borderRadius:8, padding:8, fontFamily:"monospace", fontWeight:900, fontSize:16, letterSpacing:3, color:"#92400e" }}>ABCD1234</div>}
            {preview.prize_type==="special"&&<div style={{ margin:"10px 0", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:8, fontSize:13, color:"#dc2626" }}>Nhân viên liên hệ SĐT</div>}
            {preview.prize_type==="viral"&&<div style={{ margin:"10px 0", fontSize:13, color:"#ef4444", fontWeight:700 }}>😅 Mất lượt — nhận 1 topping tự chọn</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── VOUCHER DETAIL PANEL ─── */
function VoucherDetailPanel({ prizes }) {
  const [selPrize, setSelPrize] = useState("");
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [filterSt, setFilterSt] = useState("all");
  const [msg,      setMsg]      = useState("");

  const fetchVouchers = useCallback(async () => {
    if (!selPrize) { setItems([]); return; }
    setLoading(true);
    const data = await loadPrizeVouchers(+selPrize, filterSt==="all"?null:filterSt);
    setItems(Array.isArray(data)?data:[]); setSelected(new Set());
    setLoading(false);
  }, [selPrize, filterSt]);

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  const handleDelete = async (id) => {
    if (!confirm("Xóa voucher này?")) return;
    await deleteVoucher(id); fetchVouchers();
  };

  const handleBulkDelete = async () => {
    if (selected.size===0||!confirm(`Xóa ${selected.size} voucher?`)) return;
    await bulkDeleteVouchers([...selected]);
    setMsg(`✅ Đã xóa ${selected.size} voucher`);
    setTimeout(()=>setMsg(""),3000);
    fetchVouchers();
  };

  const inp2 = {border:"1px solid #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:14,color:"#1c1917",background:"#fff",fontFamily:"inherit"};
  const th2  = {padding:"8px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#6b7280",borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap"};
  const td2  = {padding:"8px 12px",borderBottom:"1px solid #f3f4f6",fontSize:13,verticalAlign:"middle"};
  const STATUS_COLOR = {unused:"#10b981",assigned:"#f59e0b",redeemed:"#6b7280",voided:"#ef4444"};
  const STATUS_LABEL = {unused:"Chưa cấp",assigned:"Đã cấp",redeemed:"Đã dùng",voided:"Đã hủy"};

  return (
    <div>
      <h3 style={{ fontSize:15, fontWeight:800, marginBottom:10 }}>🔍 Quản lý voucher chi tiết</h3>
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
        <select value={selPrize} onChange={e=>setSelPrize(e.target.value)} style={{ ...inp2, minWidth:200 }}>
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
        {selected.size>0&&<button onClick={handleBulkDelete} style={{ ...inp2, background:"#fef2f2", borderColor:"#fca5a5", color:"#dc2626", cursor:"pointer", fontWeight:700 }}>🗑 Xóa {selected.size} mã</button>}
        {items.filter(v=>v.status==="unused").length>0&&(
          <button onClick={async()=>{
            const ids=items.filter(v=>v.status==="unused").map(v=>v.id);
            if(!confirm(`Xóa ${ids.length} voucher CHƯA CẤP?`)) return;
            await bulkDeleteVouchers(ids);
            setMsg(`✅ Đã xóa ${ids.length} voucher`);
            setTimeout(()=>setMsg(""),3000);
            fetchVouchers();
          }} style={{ ...inp2, background:"#fef2f2", borderColor:"#fca5a5", color:"#dc2626", cursor:"pointer", fontWeight:700 }}>
            🗑 Xóa toàn bộ chưa cấp ({items.filter(v=>v.status==="unused").length})
          </button>
        )}
      </div>
      {msg&&<div style={{ color:"#10b981", fontWeight:700, fontSize:14, marginBottom:10, background:"#f0fdf4", border:"1px solid #a7f3d0", borderRadius:8, padding:"8px 12px" }}>{msg}</div>}
      {!selPrize?(
        <div style={{ padding:24, textAlign:"center", color:"#9ca3af", border:"2px dashed #e5e7eb", borderRadius:12 }}>Chọn giải thưởng để xem danh sách voucher</div>
      ):loading?(
        <div style={{ padding:24, textAlign:"center", color:"#9ca3af" }}>Đang tải…</div>
      ):(
        <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e5e7eb" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#f9fafb" }}>
              <th style={{ ...th2, width:36 }}>
                <input type="checkbox" onChange={e=>{ if(e.target.checked) setSelected(new Set(items.map(v=>v.id))); else setSelected(new Set()); }} checked={selected.size===items.length&&items.length>0}/>
              </th>
              {["Mã Voucher","Trạng thái","Bill","SĐT","Ngày tạo",""].map(h=><th key={h} style={th2}>{h}</th>)}
            </tr></thead>
            <tbody>
              {items.length===0?(
                <tr><td colSpan={7} style={{ ...td2, textAlign:"center", color:"#9ca3af" }}>Không có voucher</td></tr>
              ):items.map(v=>(
                <tr key={v.id}>
                  <td style={td2}><input type="checkbox" checked={selected.has(v.id)} onChange={e=>{ const ns=new Set(selected); e.target.checked?ns.add(v.id):ns.delete(v.id); setSelected(ns); }}/></td>
                  <td style={{ ...td2, fontFamily:"monospace", fontWeight:700, fontSize:14 }}>{v.code}</td>
                  <td style={td2}>
                    <span style={{ background:`${STATUS_COLOR[v.status]}20`, color:STATUS_COLOR[v.status], border:`1px solid ${STATUS_COLOR[v.status]}44`, borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:700 }}>
                      {STATUS_LABEL[v.status]||v.status}
                    </span>
                  </td>
                  <td style={{ ...td2, fontFamily:"monospace", fontSize:12, color:"#6b7280" }}>{v.assigned_bill||"—"}</td>
                  <td style={{ ...td2, fontSize:12, color:"#6b7280" }}>{v.assigned_phone||"—"}</td>
                  <td style={{ ...td2, fontSize:12, color:"#9ca3af" }}>{v.created_at?new Date(v.created_at).toLocaleDateString("vi-VN"):"—"}</td>
                  <td style={td2}>{v.status==="unused"&&<button onClick={()=>handleDelete(v.id)} style={{ padding:"3px 10px", borderRadius:6, border:"1px solid #fecaca", background:"#fff", color:"#ef4444", cursor:"pointer", fontSize:12 }}>🗑</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:"8px 12px", fontSize:12, color:"#9ca3af" }}>{items.length} voucher</div>
        </div>
      )}
    </div>
  );
}

/* ─── ADMIN PAGE ─── */
const ADMIN_TOKEN = typeof btoa !== "undefined" ? btoa(ADMIN_PWD + "_st26") : "";

function AdminPage({ onBack }) {
  // ── Auth với localStorage ──
  const [pwd, setPwd]       = useState("");
  const [authed, setAuthed] = useState(false);
  const [pwdErr, setPwdErr] = useState("");

  // Kiểm tra session đã lưu chưa (chạy 1 lần khi mount)
  useEffect(() => {
    try {
      if (localStorage.getItem("santhai_admin_v2") === ADMIN_TOKEN) setAuthed(true);
    } catch {}
  }, []);

  const login = () => {
    if (pwd === ADMIN_PWD) {
      try { localStorage.setItem("santhai_admin_v2", ADMIN_TOKEN); } catch {}
      setAuthed(true); setPwdErr("");
    } else {
      setPwdErr("Sai mật khẩu.");
    }
  };

  // Logout SYNC — không dùng async
  const doLogout = () => {
    try { localStorage.removeItem("santhai_admin_v2"); } catch {}
    window.location.replace(window.location.origin);
  };

  const [tab, setTab]       = useState("settings");
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);

  // Admin settings state
  const [adminSettings, setAdminSettings] = useState({
    event_name:"", event_subtitle:"", description:"",
    show_prize_list:"false", bg_color:"#fff7ed",
    bg_image_url:"", frame_image_url:""
  });
  const [settingsSaved, setSettingsSaved] = useState(""); // null | "ok" | "error"

  // Data
  const [prizes,   setPrizes]   = useState([]);
  const [spins,    setSpins]    = useState([]);
  const [specials, setSpecials] = useState([]);
  const [bl,       setBl]       = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [date, setDate]         = useState(new Date().toISOString().slice(0,10));

  // Prize editor
  const [editPrize, setEditPrize] = useState(null);
  const [prizeMsg,  setPrizeMsg]  = useState("");

  // Reconcile
  const [selected,    setSelected]    = useState(new Set());
  const [reconResult, setReconResult] = useState(null);

  // Voucher import
  const [importTxt, setImportTxt] = useState("");
  const [importPid, setImportPid] = useState("");
  const [importMsg, setImportMsg] = useState("");

  // Blacklist
  const [blPhone, setBlPhone] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    const conn = await testConnection();
    setDbStatus(conn.ok ? "ok" : conn.error || "error");
    if (conn.ok) {
      const [p, s, sp, b, v, cfg] = await Promise.all([
        loadAllPrizes(), loadSpins(date), loadSpecialWinners(), loadBlacklist(), loadVouchers(), loadSettings(),
      ]);
      setPrizes(Array.isArray(p)?p:[]); setSpins(Array.isArray(s)?s:[]);
      setSpecials(Array.isArray(sp)?sp:[]); setBl(Array.isArray(b)?b:[]);
      setVouchers(Array.isArray(v)?v:[]);
      if (cfg && Object.keys(cfg).length) setAdminSettings(prev=>({...prev,...cfg}));
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { if (authed) loadAll(); }, [authed, loadAll]);

  // Prize CRUD
  const handleSavePrize = async () => {
    const name = editPrize?.name?.trim();
    const prob = parseFloat(editPrize?.probability);
    if (!name)                   return setPrizeMsg("❌ Cần nhập tên giải thưởng");
    if (isNaN(prob) || prob < 0) return setPrizeMsg("❌ Xác suất không hợp lệ");
    setPrizeMsg("⏳ Đang lưu…");
    const res = await savePrize(editPrize);
    if (res?.ok) {
      setPrizeMsg("✅ Đã lưu thành công!");
      setEditPrize(null);
      loadAll();
    } else {
      // Hiển thị lỗi thật từ server
      setPrizeMsg("❌ " + (res?.error || "Lỗi không xác định"));
    }
    setTimeout(() => setPrizeMsg(""), 6000);
  };
  const handleDeletePrize = async (id) => {
    if (!confirm("Xóa giải thưởng này?")) return;
    await deletePrize(id); loadAll();
  };
  const totalProb = prizes.filter(p=>p.active).reduce((s,p) => s+(+p.probability||0), 0);

  const exportCSV = () => {
    const rows=[["Mã Bill","SĐT","Cửa hàng","Giải thưởng","Mã Voucher","Hợp lệ","Thời gian"].join(",")];
    spins.forEach(s=>rows.push([
      s.bill_code, s.phone, `"${s.store_name||""}"`, `"${s.prize_name}"`,
      s.voucher_code||"", s.is_valid?"Có":"Không",
      new Date(s.spun_at).toLocaleString("vi-VN")
    ].join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF"+rows.join("\n")],{type:"text/csv;charset=utf-8;"}));
    a.download=`santhai_spins_${date}.csv`; a.click();
  };

  const exportXLSX = () => {
    // HTML table → Excel (không cần npm package, Excel đọc được bình thường)
    const H2 = ["Mã Bill","SĐT","Cửa hàng","Giải thưởng","Mã Voucher","Hợp lệ","Shadow Ban","Thời gian"];
    const rows = spins.map(s=>[
      s.bill_code, s.phone, s.store_name||"", s.prize_name,
      s.voucher_code||"", s.is_valid?"Có":"Không",
      s.shadow_ban_hit?"Có":"Không",
      new Date(s.spun_at).toLocaleString("vi-VN"),
    ]);
    const headerRow = `<tr>${H2.map(h=>`<th style="background:#f97316;color:#fff;font-weight:bold">${h}</th>`).join("")}</tr>`;
    const dataRows  = rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
      <x:ExcelWorksheet><x:Name>Lịch sử quay</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head><body><table>${headerRow}${dataRows}</table></body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF"+html],{type:"application/vnd.ms-excel;charset=utf-8"}));
    a.download = `santhai_spins_${date}.xls`;
    a.click();
  };

  const applyInvalid = async () => {
    if (selected.size===0) return;
    const res = await adminInvalidate([...selected]);
    setReconResult(res); setSelected(new Set()); loadAll();
  };

  const doImport = async () => {
    const codes = importTxt.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
    if (!codes.length || !importPid) return;
    const prize = prizes.find(p=>p.id===+importPid);
    const n = await importVouchers(codes, +importPid, prize?.name||"");
    setImportMsg(`✅ Đã import ${n} voucher`); setImportTxt(""); loadAll();
  };

  const doAddBl = async () => {
    if (blPhone.replace(/\D/g,"").length<9) return;
    await addBlacklist(blPhone,"Thêm thủ công bởi admin"); setBlPhone(""); loadAll();
  };

  const vSum = (() => {
    const m={};
    vouchers.forEach(v=>{ if(!m[v.prize_id]) m[v.prize_id]={name:v.prize_name,unused:0,assigned:0,redeemed:0,voided:0}; m[v.prize_id][v.status]=(m[v.prize_id][v.status]||0)+1; });
    return Object.entries(m).sort(([a],[b])=>+a-+b);
  })();

  const inp = {border:"1px solid #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:14,color:"#1c1917",background:"#fff",fontFamily:"Nunito,sans-serif"};
  const th  = {padding:"8px 12px",textAlign:"left",fontSize:12,fontWeight:700,color:"#6b7280",borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap"};
  const td  = {padding:"8px 12px",borderBottom:"1px solid #f3f4f6",fontSize:13,verticalAlign:"middle"};

  if (!authed) return (
    <div style={{ minHeight:"100vh",background:"#f9fafb",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
      <style>{G}</style>
      <div style={{ background:"#fff",borderRadius:20,padding:32,maxWidth:320,width:"100%",boxShadow:"0 4px 32px rgba(0,0,0,.1)" }}>
        <div style={{ fontSize:20,fontWeight:900,marginBottom:20,textAlign:"center",color:"#f97316" }}>🔐 Admin Login</div>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}
          placeholder="Mật khẩu admin" style={{ ...inp,width:"100%",marginBottom:10,padding:"12px 14px",fontSize:15 }}/>
        {pwdErr && <div style={{ color:"#ef4444",fontSize:13,marginBottom:10 }}>{pwdErr}</div>}
        <button onClick={login} style={{ width:"100%",padding:"13px",background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",borderRadius:12,color:"#fff",fontSize:16,fontWeight:800,cursor:"pointer" }}>Đăng nhập</button>
        <button onClick={onBack} style={{ width:"100%",padding:"13px",background:"#f3f4f6",border:"none",borderRadius:12,color:"#6b7280",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:8 }}>← Quay về</button>
      </div>
    </div>
  );

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

  return (
    <div style={{ minHeight:"100vh",background:"#f9fafb",fontFamily:"Nunito,sans-serif" }}>
      <style>{G}</style>
      <div style={{ background:"linear-gradient(135deg,#f97316,#ea580c)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ fontSize:17,fontWeight:900,color:"#fff" }}>⚙️ Admin — SanThai Spin</div>
        <button onClick={doLogout} style={{ background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",padding:"6px 14px",cursor:"pointer",fontSize:13 }}>← Thoát</button>
      </div>
      {/* DB Status Banner */}
      {dbStatus && dbStatus !== "ok" && (
        <div style={{ background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:0,padding:"12px 20px",fontSize:14,color:"#dc2626",display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div>
            <strong>Chưa kết nối được database:</strong> {dbStatus}<br/>
            <span style={{ fontSize:13 }}>→ Vào <strong>Supabase SQL Editor</strong> → chạy file <strong>schema_v2.sql</strong> → nhấn <strong>🔄 Làm mới</strong></span>
          </div>
        </div>
      )}
      {dbStatus === "ok" && prizes.length === 0 && (
        <div style={{ background:"#fffbeb",border:"2px solid #f59e0b",borderRadius:0,padding:"12px 20px",fontSize:14,color:"#92400e",display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:20 }}>💡</span>
          <div>Kết nối OK nhưng chưa có giải thưởng. Nhấn <strong>🔄 Load giải mặc định</strong> để thêm 16 giải sẵn có.</div>
        </div>
      )}
      <div style={{ padding:16 }}>
        <div style={{ display:"flex",gap:6,marginBottom:16,flexWrap:"wrap" }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"8px 14px",borderRadius:8,border:"2px solid",fontSize:13,fontWeight:700,cursor:"pointer",
              borderColor:tab===t.id?"#f97316":"#e5e7eb",
              background:tab===t.id?"#fff7ed":"#fff",
              color:tab===t.id?"#f97316":"#6b7280",
            }}>{t.label}</button>
          ))}
          <button onClick={loadAll} style={{ padding:"8px 14px",borderRadius:8,border:"2px solid #e5e7eb",background:"#fff",color:"#6b7280",cursor:"pointer",fontSize:13 }}>
            {loading?"⏳":"🔄"} Làm mới
          </button>
        </div>

        {/* ── CÀI ĐẶT SỰ KIỆN ── */}
        {tab==="settings" && (
          <div style={{ maxWidth:620 }}>
            <h3 style={{ fontSize:16,fontWeight:900,marginBottom:16 }}>⚙️ Cài đặt sự kiện</h3>
            {[
              {key:"event_name",      label:"Tên sự kiện",          placeholder:"SanThai",                        type:"text",     hint:"Hiển thị ở header"},
              {key:"event_subtitle",  label:"Tagline / Phụ đề",      placeholder:"Vòng Quay May Mắn — Thất Kiếm Lệnh", type:"text", hint:"Dòng nhỏ dưới tên"},
              {key:"bg_color",        label:"Màu nền (nếu không dùng ảnh)", placeholder:"#fff7ed",              type:"color",    hint:""},
              {key:"bg_image_url",    label:"URL ảnh nền",           placeholder:"https://...",                    type:"url",      hint:"Để trống nếu dùng màu nền"},
              {key:"frame_image_url", label:"URL ảnh khung vòng quay", placeholder:"https://... (PNG có trong suốt)", type:"url",  hint:"Overlay lên trên wheel — nên dùng PNG trong suốt"},
            ].map(({key,label,placeholder,type,hint})=>(
              <div key={key} style={{ marginBottom:16 }}>
                <label style={{ fontSize:13,fontWeight:700,display:"block",marginBottom:4,color:"#374151" }}>{label}</label>
                {type==="color" ? (
                  <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                    <input type="color" value={adminSettings[key]||"#fff7ed"} onChange={e=>setAdminSettings(p=>({...p,[key]:e.target.value}))} style={{ width:50,height:38,border:"1px solid #d1d5db",borderRadius:8,cursor:"pointer",padding:2 }}/>
                    <input type="text" value={adminSettings[key]||""} onChange={e=>setAdminSettings(p=>({...p,[key]:e.target.value}))} placeholder={placeholder} style={{ ...inp,flex:1 }}/>
                  </div>
                ) : (
                  <input type={type==="url"?"text":type} value={adminSettings[key]||""} onChange={e=>setAdminSettings(p=>({...p,[key]:e.target.value}))} placeholder={placeholder} style={{ ...inp,width:"100%" }}/>
                )}
                {hint && <div style={{ fontSize:12,color:"#9ca3af",marginTop:3 }}>{hint}</div>}
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13,fontWeight:700,display:"block",marginBottom:4,color:"#374151" }}>Thể lệ / Mô tả sự kiện</label>
              <textarea value={adminSettings.description||""} onChange={e=>setAdminSettings(p=>({...p,description:e.target.value}))}
                rows={6} placeholder={"VD:\n- Mỗi hóa đơn từ 3 ly trở lên được 1 lượt quay\n- Phần thưởng quy đổi trong vòng 30 ngày\n- Hotline: 1900..."}
                style={{ ...inp,width:"100%",resize:"vertical",lineHeight:1.7 }}/>
              <div style={{ fontSize:12,color:"#9ca3af",marginTop:3 }}>Hiển thị ở nút "Thể lệ & Thông tin" trên trang khách</div>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:10,cursor:"pointer",color:"#374151" }}>
                <input type="checkbox" checked={adminSettings.show_prize_list==="true"}
                  onChange={e=>setAdminSettings(p=>({...p,show_prize_list:e.target.checked?"true":"false"}))}
                  style={{ width:18,height:18 }}/>
                Hiển thị danh sách phần thưởng (ở trang khách)
              </label>
              <div style={{ fontSize:12,color:"#9ca3af",marginTop:4,marginLeft:28 }}>Tắt đi để vòng quay to hơn — thông tin giải cung cấp qua thể lệ</div>
            </div>
            <button onClick={async()=>{
              setSettingsSaved("⏳ Đang lưu…");
              const entries = Object.entries(adminSettings);
              await Promise.all(entries.map(([k,v])=>saveSetting(k,v)));
              setSettingsSaved("✅ Đã lưu! Reload trang khách để thấy thay đổi.");
              setTimeout(()=>setSettingsSaved(""),4000);
            }} style={{ padding:"12px 28px",background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer" }}>
              💾 Lưu cài đặt
            </button>
            {settingsSaved && <div style={{ marginTop:10,fontSize:14,color:"#10b981",fontWeight:700 }}>{settingsSaved}</div>}
          </div>
        )}

        {/* ── CẤU HÌNH GIẢI ── */}
        {tab==="prizes" && (
          <div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
              <div style={{ fontSize:14,fontWeight:700 }}>
                Tổng xác suất: <span style={{ color:Math.abs(totalProb-100)<0.01?"#10b981":"#ef4444",fontSize:16 }}>{totalProb.toFixed(2)}%</span>
                {Math.abs(totalProb-100)<0.01 ? " ✅" : " ⚠️ Phải đúng 100%"}
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={async()=>{ if(!confirm("Load lại 16 giải mặc định? Sẽ ghi đè giải hiện có.")) return; const ok=await resetDefaultPrizes(); setPrizeMsg(ok?"✅ Đã load giải mặc định":"❌ Lỗi"); loadAll(); setTimeout(()=>setPrizeMsg(""),3000); }}
                  style={{ padding:"8px 14px",background:"#f0fdf4",border:"2px solid #a7f3d0",borderRadius:10,color:"#065f46",fontSize:13,fontWeight:700,cursor:"pointer" }}>
                  🔄 Load giải mặc định
                </button>
                <button onClick={()=>setEditPrize({ name:"",short_name:"",color:"#f59e0b",icon:"🎁",probability:0,prize_type:"normal",has_voucher:true,active:true,display_order:prizes.length+1 })}
                  style={{ padding:"8px 16px",background:"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer" }}>
                  + Thêm giải thưởng
                </button>
              </div>
            </div>

            {prizeMsg && <div style={{ color:"#10b981",fontSize:14,marginBottom:10 }}>{prizeMsg}</div>}

            {/* Edit modal */}
            {editPrize && (
              <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
                <div style={{ background:"#fff",borderRadius:20,padding:28,maxWidth:420,width:"100%",maxHeight:"90vh",overflowY:"auto" }}>
                  <div style={{ fontSize:16,fontWeight:900,marginBottom:16 }}>{editPrize.id?"Sửa":"Thêm"} giải thưởng</div>
                  {[
                    ["Tên giải thưởng","name","text",{}],
                    ["Tên ngắn (hiển thị trên vòng quay)","short_name","text",{}],
                    ["Icon (emoji)","icon","text",{style:{fontSize:22}}],
                    ["Màu vòng quay","color","color",{}],
                    ["Xác suất (%)","probability","number",{step:"0.01",min:"0",max:"100"}],
                  ].map(([label,key,type,extra])=>(
                    <div key={key} style={{ marginBottom:12 }}>
                      <label style={{ fontSize:13,fontWeight:700,color:"#44403c",display:"block",marginBottom:4 }}>{label}</label>
                      <input type={type} value={editPrize[key]||""} onChange={e=>setEditPrize(p=>({...p,[key]:e.target.value}))}
                        style={{ ...inp,width:"100%",...(extra.style||{}) }} {...extra}/>
                    </div>
                  ))}
                  <div style={{ marginBottom:12 }}>
                    <label style={{ fontSize:13,fontWeight:700,color:"#44403c",display:"block",marginBottom:4 }}>Loại giải</label>
                    <select value={editPrize.prize_type} onChange={e=>setEditPrize(p=>({...p,prize_type:e.target.value,has_voucher:e.target.value==="normal"}))}
                      style={{ ...inp,width:"100%" }}>
                      <option value="normal">Bình thường (có voucher)</option>
                      <option value="special">Đặc biệt (liên hệ SĐT, không voucher)</option>
                      <option value="viral">Mất Lượt (viral)</option>
                    </select>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
                    <input type="checkbox" id="active" checked={editPrize.active} onChange={e=>setEditPrize(p=>({...p,active:e.target.checked}))} style={{ width:18,height:18 }}/>
                    <label htmlFor="active" style={{ fontSize:14,fontWeight:600 }}>Đang hoạt động</label>
                  </div>
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={handleSavePrize} style={{ flex:1,padding:"12px",background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",borderRadius:10,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer" }}>Lưu</button>
                    <button onClick={()=>setEditPrize(null)} style={{ flex:1,padding:"12px",background:"#f3f4f6",border:"none",borderRadius:10,color:"#6b7280",fontSize:14,fontWeight:600,cursor:"pointer" }}>Hủy</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
                <thead><tr style={{ background:"#f9fafb" }}>
                  {["#","Icon","Tên giải","Tên ngắn","Loại","Xác suất","Hoạt động",""].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {prizes.map(p=>(
                    <tr key={p.id} style={{ opacity:p.active?1:.5 }}>
                      <td style={{ ...td,color:"#9ca3af" }}>{p.display_order}</td>
                      <td style={td}><span style={{ fontSize:20 }}>{p.icon}</span></td>
                      <td style={{ ...td,fontWeight:700 }}>{p.name}</td>
                      <td style={{ ...td,color:"#6b7280" }}>{p.short_name||"—"}</td>
                      <td style={td}><span style={{ fontSize:11,padding:"3px 8px",borderRadius:20,fontWeight:700,
                        background:p.prize_type==="special"?"#fef3c7":p.prize_type==="viral"?"#f1f5f9":"#d1fae5",
                        color:p.prize_type==="special"?"#92400e":p.prize_type==="viral"?"#6b7280":"#065f46" }}>
                        {p.prize_type}</span></td>
                      <td style={{ ...td,fontWeight:800,color:"#f97316",fontSize:15 }}>{p.probability}%</td>
                      <td style={td}>{p.active?<span style={{ color:"#10b981" }}>✅</span>:<span style={{ color:"#ef4444" }}>❌</span>}</td>
                      <td style={td}>
                        <div style={{ display:"flex",gap:5 }}>
                          <button onClick={()=>setEditPrize({...p})} style={{ padding:"4px 10px",borderRadius:6,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer",fontSize:12 }}>✏️</button>
                          <button onClick={()=>handleDeletePrize(p.id)} style={{ padding:"4px 10px",borderRadius:6,border:"1px solid #fecaca",background:"#fff",cursor:"pointer",fontSize:12,color:"#ef4444" }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── LỊCH SỬ ── */}
        {tab==="spins" && (
          <div>
            <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center" }}>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ ...inp }}/>
              <button onClick={exportCSV} style={{ ...inp,background:"#d1fae5",borderColor:"#a7f3d0",color:"#065f46",cursor:"pointer",fontWeight:700 }}>
                ↓ CSV
              </button>
              <button onClick={exportXLSX} style={{ ...inp,background:"#dbeafe",borderColor:"#93c5fd",color:"#1d4ed8",cursor:"pointer",fontWeight:700 }}>
                ↓ Excel (.xlsx)
              </button>
              <span style={{ fontSize:13,color:"#6b7280" }}>{spins.length} bản ghi</span>
            </div>
            <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
              {[["Tổng",spins.length,"#f97316"],["Hợp lệ",spins.filter(s=>s.is_valid).length,"#10b981"],
                ["Không hợp lệ",spins.filter(s=>!s.is_valid).length,"#ef4444"],
                ["Ban",spins.filter(s=>s.shadow_ban_hit).length,"#7c3aed"]].map(([l,v,c])=>(
                <div key={l} style={{ background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 14px" }}>
                  <div style={{ fontSize:18,fontWeight:900,color:c }}>{v}</div>
                  <div style={{ fontSize:11,color:"#9ca3af" }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb" }}>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#f9fafb" }}>
                  {["Mã Bill","SĐT","Cửa hàng","Giải thưởng","Mã Voucher","Trạng thái","Thời gian"].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={7} style={{ ...td,textAlign:"center",color:"#9ca3af" }}>Đang tải…</td></tr>
                  : spins.length===0 ? <tr><td colSpan={7} style={{ ...td,textAlign:"center",color:"#9ca3af" }}>Không có dữ liệu ngày này</td></tr>
                  : spins.map(s=>(
                    <tr key={s.id} style={{ opacity:s.is_valid?1:.5 }}>
                      <td style={{ ...td,fontFamily:"monospace",color:"#6b7280",fontSize:12 }}>{s.bill_code}</td>
                      <td style={{ ...td,fontSize:12 }}>{s.phone}</td>
                      <td style={{ ...td,fontSize:12,color:"#6b7280" }}>{s.store_name||"—"}</td>
                      <td style={{ ...td,fontWeight:700 }}>{s.prize_name}</td>
                      <td style={{ ...td }}>
                        {s.voucher_code && s.voucher_code !== "PENDING"
                          ? <span style={{ fontFamily:"monospace",fontSize:13,background:"#fef3c7",border:"1px solid #f59e0b",borderRadius:6,padding:"2px 8px",color:"#92400e",fontWeight:700 }}>{s.voucher_code}</span>
                          : s.voucher_code === "PENDING"
                          ? <span style={{ fontSize:12,color:"#ef4444" }}>⚠ PENDING</span>
                          : <span style={{ color:"#d1d5db",fontSize:12 }}>—</span>}
                      </td>
                      <td style={td}>
                        {!s.is_valid ? <span style={{ color:"#ef4444",fontSize:12,fontWeight:700 }}>✗ Hủy</span>
                        : s.shadow_ban_hit ? <span style={{ color:"#7c3aed",fontSize:12 }}>🚫 Ban</span>
                        : <span style={{ color:"#10b981",fontSize:12 }}>✓ OK</span>}
                      </td>
                      <td style={{ ...td,fontSize:12,color:"#9ca3af",whiteSpace:"nowrap" }}>
                        {new Date(s.spun_at).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ĐỐI CHIẾU ── */}
        {tab==="reconcile" && (
          <div>
            <div style={{ background:"#fffbeb",border:"2px solid #f59e0b",borderRadius:12,padding:"12px 16px",marginBottom:12,fontSize:14,color:"#92400e",lineHeight:1.7 }}>
              <strong>Quy trình:</strong> Lấy CSV (tab Lịch sử) → so sánh với POS export → tick bill không khớp → nhấn Xử lý
            </div>
            {reconResult && <div style={{ background:"#d1fae5",borderRadius:10,padding:"11px 14px",marginBottom:12,fontSize:14,color:"#065f46" }}>✅ Xong: {reconResult.voided||0} void · {reconResult.blacklisted||0} blacklist</div>}
            <div style={{ display:"flex",gap:8,marginBottom:10 }}>
              <button onClick={applyInvalid} disabled={selected.size===0} style={{ padding:"9px 16px",borderRadius:10,border:"none",cursor:selected.size>0?"pointer":"not-allowed",fontSize:13,fontWeight:700,background:selected.size>0?"#ef4444":"#e5e7eb",color:selected.size>0?"#fff":"#9ca3af" }}>
                ⚠ Xử lý {selected.size} bill không hợp lệ
              </button>
              <button onClick={()=>setSelected(new Set())} style={{ padding:"9px 13px",borderRadius:10,border:"1px solid #e5e7eb",background:"#fff",color:"#6b7280",cursor:"pointer",fontSize:13 }}>Bỏ chọn</button>
            </div>
            <div style={{ overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb" }}>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#f9fafb" }}>
                  <th style={{ ...th,width:40 }}></th>
                  {["Mã Bill","SĐT","Cửa hàng","Giải","Voucher"].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {spins.filter(s=>s.is_valid).map(s=>(
                    <tr key={s.id} style={{ background:selected.has(s.bill_code)?"#fef2f2":"#fff" }}>
                      <td style={td}><input type="checkbox" checked={selected.has(s.bill_code)} onChange={e=>{ const ns=new Set(selected); e.target.checked?ns.add(s.bill_code):ns.delete(s.bill_code); setSelected(ns); }}/></td>
                      <td style={{ ...td,fontFamily:"monospace",fontSize:12 }}>{s.bill_code}</td>
                      <td style={{ ...td,fontSize:12 }}>{s.phone}</td>
                      <td style={{ ...td,fontSize:12 }}>{s.store_name||"—"}</td>
                      <td style={td}>{s.prize_name}</td>
                      <td style={{ ...td,fontFamily:"monospace",fontSize:12 }}>{s.voucher_code||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── VOUCHERS ── */}
        {tab==="vouchers" && (
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            <div>
              <h3 style={{ fontSize:15,fontWeight:800,marginBottom:10 }}>Pool voucher</h3>
              {vSum.filter(([,s])=>(s.unused||0)<LOW_STOCK&&(s.unused||0)>0).length>0 && (
                <div style={{ background:"#fffbeb",border:"2px solid #f59e0b",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:13,color:"#92400e" }}>
                  ⚠️ <strong>Sắp hết:</strong> {vSum.filter(([,s])=>(s.unused||0)<LOW_STOCK&&(s.unused||0)>0).map(([,s])=>s.name).join(", ")}
                </div>
              )}
              {vSum.filter(([,s])=>(s.unused||0)===0&&((s.assigned||0)+(s.redeemed||0))>0).length>0 && (
                <div style={{ background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:13,color:"#dc2626" }}>
                  🚨 <strong>Hết voucher:</strong> {vSum.filter(([,s])=>(s.unused||0)===0&&((s.assigned||0)+(s.redeemed||0))>0).map(([,s])=>s.name).join(", ")}. Nạp ngay!
                </div>
              )}
              <div style={{ overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb" }}>
                <table style={{ width:"100%",borderCollapse:"collapse" }}>
                  <thead><tr style={{ background:"#f9fafb" }}>
                    {["Giải thưởng","Còn lại","Đã cấp","Đã dùng","Đã hủy"].map(h=>(
                      <th key={h} style={{ ...th,textAlign:h==="Giải thưởng"?"left":"right" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {vSum.length===0
                      ? <tr><td colSpan={5} style={{ ...td,textAlign:"center",color:"#9ca3af" }}>Chưa có voucher</td></tr>
                      : vSum.map(([pid,s])=>{
                          const unused=s.unused||0;
                          const isLow=unused<LOW_STOCK&&unused>0;
                          const isEmpty=unused===0&&((s.assigned||0)+(s.redeemed||0))>0;
                          return (
                            <tr key={pid} style={{ background:isEmpty?"#fef2f2":isLow?"#fffbeb":"#fff" }}>
                              <td style={{ ...td,fontWeight:600 }}>{s.name}</td>
                              <td style={{ ...td,textAlign:"right" }}>
                                <span style={{ fontWeight:800,color:isEmpty?"#dc2626":isLow?"#d97706":"#10b981",
                                  background:isEmpty?"#fef2f2":isLow?"#fffbeb":"#f0fdf4",
                                  border:`1px solid ${isEmpty?"#fca5a5":isLow?"#fcd34d":"#a7f3d0"}`,
                                  borderRadius:20,padding:"2px 10px",fontSize:13,display:"inline-block" }}>
                                  {isEmpty?"🚨 Hết":isLow?`⚠ ${unused}`:unused}
                                </span>
                              </td>
                              <td style={{ ...td,textAlign:"right",color:"#f59e0b",fontWeight:700 }}>{s.assigned||0}</td>
                              <td style={{ ...td,textAlign:"right",color:"#6b7280" }}>{s.redeemed||0}</td>
                              <td style={{ ...td,textAlign:"right",color:"#ef4444" }}>{s.voided||0}</td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize:12,color:"#9ca3af",marginTop:8,lineHeight:1.6 }}>
                <strong>Còn lại</strong> = chưa cấp · <strong>Đã cấp</strong> = khách trúng chưa đổi · <strong>Đã dùng</strong> = đã đổi tại quầy
              </div>
            </div>
            <div>
              <h3 style={{ fontSize:15,fontWeight:800,marginBottom:10 }}>Import voucher</h3>
              <div style={{ background:"#f0fdf4",border:"1px solid #a7f3d0",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#065f46",lineHeight:1.6 }}>
                💡 Mỗi giải cần pool riêng. Khi khách trúng, hệ thống tự cấp 1 mã và xóa khỏi pool "Còn lại".
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={{ fontSize:13,fontWeight:700,display:"block",marginBottom:4 }}>Loại phần thưởng cần nạp</label>
                <select value={importPid} onChange={e=>setImportPid(e.target.value)}
                  style={{ ...inp,width:"100%",borderColor:importPid?"#f97316":"#d1d5db",fontWeight:importPid?700:400 }}>
                  <option value="">-- Chọn giải cần nạp voucher --</option>
                  {prizes.filter(p=>p.prize_type==="normal"&&p.has_voucher&&p.active).map(p=>{
                    const pool=vSum.find(([pid])=>+pid===p.id);
                    const unused=pool?(pool[1].unused||0):0;
                    const warn=unused<LOW_STOCK?(unused===0?"🚨 ":"⚠ "):"";
                    return <option key={p.id} value={p.id}>{warn}{p.name} (còn: {unused})</option>;
                  })}
                </select>
                {prizes.filter(p=>p.prize_type==="normal"&&p.has_voucher&&p.active).length===0&&(
                  <div style={{ fontSize:12,color:"#ef4444",marginTop:4 }}>Chưa có giải. Vào Cấu hình giải → Load giải mặc định trước.</div>
                )}
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={{ fontSize:13,fontWeight:700,display:"block",marginBottom:4 }}>
                  Danh sách mã <span style={{ fontWeight:400,color:"#6b7280" }}>(mỗi mã 1 dòng)</span>
                </label>
                <textarea value={importTxt} onChange={e=>setImportTxt(e.target.value)} rows={7}
                  style={{ ...inp,width:"100%",resize:"vertical",fontFamily:"monospace",fontSize:13 }}
                  placeholder={"VD001\nVD002\nVD003"}/>
              </div>
              <button onClick={doImport} disabled={!importPid||!importTxt.trim()}
                style={{ ...inp,
                  background:importPid&&importTxt.trim()?"#d1fae5":"#f3f4f6",
                  borderColor:importPid&&importTxt.trim()?"#a7f3d0":"#e5e7eb",
                  color:importPid&&importTxt.trim()?"#065f46":"#9ca3af",
                  cursor:importPid&&importTxt.trim()?"pointer":"not-allowed",
                  fontWeight:700,width:"100%",textAlign:"center",padding:"11px" }}>
                ↑ Import {importTxt.split(/[\n,]+/).filter(Boolean).length} mã
                {importPid?` → ${prizes.find(p=>p.id===+importPid)?.name||""}`:""}</button>
              {importMsg&&(
                <div style={{ color:"#10b981",fontSize:14,marginTop:10,fontWeight:700,
                  background:"#f0fdf4",border:"1px solid #a7f3d0",borderRadius:8,padding:"8px 12px" }}>
                  {importMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VOUCHER CHI TIẾT ── */}
        {tab==="vdetail" && <VoucherDetailPanel prizes={prizes}/>}

        {/* ── TEST MODE ── */}
        {tab==="test" && (
          <div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10 }}>
              <div>
                <h3 style={{ fontSize:16,fontWeight:900,marginBottom:4 }}>🧪 Test Mode</h3>
                <div style={{ fontSize:13,color:"#6b7280" }}>Không ghi vào DB. Dùng để kiểm tra hiển thị trước khi event.</div>
              </div>
              <button onClick={()=>{
                if(prizes.filter(p=>p.active).length===0){alert("Cần load giải mặc định trước!"); return;}
                genTestVoucherXLS(prizes);
              }}
                style={{ padding:"10px 18px",background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",borderRadius:12,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer" }}>
                📥 Xuất {prizes.filter(p=>p.prize_type==="normal"&&p.has_voucher&&p.active).length * 10} mã test (.xls)
              </button>
            </div>
            <div style={{ background:"#fffbeb",border:"1px solid #f59e0b",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#92400e",lineHeight:1.6 }}>
              ⚡ <strong>Quy trình test:</strong> Xuất mã test → Import vào từng giải (tab Vouchers) → Chạy 30-lượt test bên dưới → Sau khi test xong, vào <strong>Chi tiết voucher</strong> → Chọn từng giải → Xóa toàn bộ mã chưa cấp.
            </div>
            <TestModePanel prizes={prizes} allPrizes={prizes}/>
          </div>
        )}

        {/* ── GIẢI ĐẶC BIỆT ── */}
        {tab==="special" && (
          <div style={{ overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb" }}>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <thead><tr style={{ background:"#f9fafb" }}>
                {["Bill","SĐT","Giải","Hợp lệ","Trạng thái","Thời gian"].map(h=><th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {specials.length===0?<tr><td colSpan={6} style={{ ...td,textAlign:"center",color:"#9ca3af" }}>Chưa có giải đặc biệt</td></tr>
                :specials.map(s=>(
                  <tr key={s.id}>
                    <td style={{ ...td,fontFamily:"monospace",fontSize:12 }}>{s.bill_code}</td>
                    <td style={{ ...td,fontWeight:700 }}>{s.phone}</td>
                    <td style={{ ...td,color:"#f97316" }}>{s.prize_name}</td>
                    <td style={td}>{s.is_valid?<span style={{ color:"#10b981" }}>✓</span>:<span style={{ color:"#ef4444" }}>✗</span>}</td>
                    <td style={td}>
                      <select value={s.contact_status} onChange={e=>updateSpecialStatus(s.id,e.target.value).then(loadAll)}
                        style={{ ...inp,padding:"5px 8px",fontSize:12 }}>
                        <option value="pending">Chờ liên hệ</option>
                        <option value="contacted">Đã liên hệ</option>
                        <option value="delivered">Đã trao</option>
                        <option value="cancelled">Hủy</option>
                      </select>
                    </td>
                    <td style={{ ...td,fontSize:12,color:"#9ca3af",whiteSpace:"nowrap" }}>{new Date(s.won_at).toLocaleString("vi-VN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── BLACKLIST ── */}
        {tab==="blacklist" && (
          <div>
            <div style={{ display:"flex",gap:8,marginBottom:12 }}>
              <input value={blPhone} onChange={e=>setBlPhone(e.target.value)} placeholder="SĐT cần chặn" type="tel" style={{ ...inp,flex:1 }}/>
              <button onClick={doAddBl} style={{ ...inp,background:"#fef2f2",borderColor:"#fecaca",color:"#dc2626",cursor:"pointer",fontWeight:700 }}>+ Thêm</button>
            </div>
            <div style={{ overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb" }}>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#f9fafb" }}>
                  {["SĐT","Lý do","Ngày chặn",""].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {bl.length===0?<tr><td colSpan={4} style={{ ...td,textAlign:"center",color:"#9ca3af" }}>Trống</td></tr>
                  :bl.map(b=>(
                    <tr key={b.phone}>
                      <td style={{ ...td,fontWeight:700,color:"#dc2626" }}>{b.phone}</td>
                      <td style={{ ...td,color:"#6b7280",fontSize:13 }}>{b.reason}</td>
                      <td style={{ ...td,fontSize:12,color:"#9ca3af" }}>{new Date(b.added_at).toLocaleDateString("vi-VN")}</td>
                      <td style={td}><button onClick={()=>removeBlacklist(b.phone).then(loadAll)} style={{ padding:"4px 10px",borderRadius:6,border:"1px solid #fecaca",background:"#fff",color:"#ef4444",cursor:"pointer",fontSize:12 }}>Gỡ</button></td>
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

/* ─── ROOT ─── */
export default function App() {
  const [page, setPage] = useState("customer");
  useEffect(() => { if (window.location.hash==="#admin") setPage("admin"); }, []);
  const toAdmin   = () => { window.location.hash="admin";   setPage("admin"); };
  const toCustomer= () => { window.location.hash="";         setPage("customer"); };
  return page==="admin"
    ? <AdminPage    onBack={toCustomer}/>
    : <CustomerPage onAdmin={toAdmin}/>;
}
