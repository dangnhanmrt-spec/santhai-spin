import { useState, useRef, useEffect, useCallback } from "react";
import {
  doSpin, loadActivePrizes, loadAllPrizes, savePrize, deletePrize, updatePrizesOrder, resetDefaultPrizes,
  loadStoreStats, loadStores,
  loadSpins, loadSpecialWinners, loadBlacklist, loadVouchers,
  adminInvalidate, importVouchers, addBlacklist, removeBlacklist, updateSpecialStatus,
} from "./supabase.js";

const ADMIN_PWD = "Santhai2024";

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
function ResultModal({ result, phone, onClose }) {
  if (!result) return null;
  const big   = result.prize_type === "special";
  const viral = result.prize_type === "viral";
  const code  = result.voucher_code;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:900, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      {big && <Confetti/>}
      <div style={{ background:"#fff", borderRadius:24, padding:32, maxWidth:360, width:"100%", textAlign:"center", animation:"bounce-in .4s ease", boxShadow:"0 24px 64px rgba(0,0,0,.3)", position:"relative" }}>
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
              <div style={{ background:"linear-gradient(135deg,#fff7ed,#fef3c7)", border:"2px solid #f59e0b", borderRadius:14, padding:18, marginBottom:12 }}>
                <div style={{ fontSize:11, color:"#92400e", fontWeight:700, letterSpacing:1, marginBottom:6 }}>MÃ VOUCHER CỦA BẠN</div>
                <div style={{ fontSize:28, fontWeight:900, color:"#ea580c", letterSpacing:4, wordBreak:"break-all" }}>{code}</div>
                <div style={{ fontSize:12, color:"#a16207", marginTop:6 }}>Đưa mã này cho nhân viên để nhận thưởng</div>
              </div>
            ) : (
              <div style={{ background:"#f0fdf4", border:"2px solid #10b981", borderRadius:12, padding:14, fontSize:14, color:"#065f46", lineHeight:1.6 }}>
                🧋 Đưa màn hình này cho nhân viên<br/>để nhận <strong>{result.prize_name}</strong> miễn phí!
              </div>
            )}
          </>
        )}
        <button onClick={onClose} style={{ marginTop:16, width:"100%", padding:"13px", background:"linear-gradient(135deg,#f97316,#ea580c)", border:"none", borderRadius:12, color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer" }}>
          Đóng
        </button>
      </div>
    </div>
  );
}

/* ─── MAIN CUSTOMER PAGE ─── */
function CustomerPage({ onAdmin }) {
  const [prizes,   setPrizes]   = useState([]);
  const [stores,   setStores]   = useState([]);
  const [stats,    setStats]    = useState([]);
  const [storeId,  setStoreId]  = useState("");
  const [storeName,setStoreName]= useState("");
  const [bill,     setBill]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [err,      setErr]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [spins,    setSpins]    = useState(0);    // lượt quay đang có
  const [pendingResult, setPendingResult] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(null);
  const wheelSize = typeof window !== "undefined" ? Math.min(300, window.innerWidth - 48) : 300;

  useEffect(() => {
    loadActivePrizes().then(setPrizes);
    loadStores().then(s => setStores(Array.isArray(s) ? s : []));
    loadStoreStats().then(setStats);
    const t = setInterval(() => loadStoreStats().then(setStats), 60000);
    return () => clearInterval(t);
  }, []);

  const handleGetSpin = async () => {
    const b = bill.trim().toUpperCase();
    const p = phone.replace(/\D/g, "");
    if (!b || b.length < 4) return setErr("Vui lòng nhập mã bill hợp lệ.");
    if (p.length < 9 || p.length > 11) return setErr("Số điện thoại không hợp lệ.");
    setLoading(true); setErr("");
    const res = await doSpin(b, p, storeId || null, storeName || null);
    setLoading(false);
    if (!res || res.error === "network") return setErr("Không kết nối được. Kiểm tra mạng.");
    if (res.error === "bill_used")       return setErr("Mã bill này đã được sử dụng rồi.");
    if (res.error === "setup_required")  return setErr("Hệ thống chưa sẵn sàng. Liên hệ quản lý.");
    if (res.error)                       return setErr(res.message || "Lỗi hệ thống, thử lại.");
    if (res.ok) {
      setPendingResult(res);
      setSpins(n => n + 1);
      setBill(""); setPhone("");
    }
  };

  const handleSpin = () => {
    if (!pendingResult || spinning) return;
    setSpinning(true);
  };

  const handleSpinDone = useCallback(() => {
    setTimeout(() => {
      setShowResult(pendingResult);
      setSpinning(false);
      setPendingResult(null);
      setSpins(0);
    }, 300);
  }, [pendingResult]);

  const totalProb = prizes.reduce((s, p) => s + (p.probability || 0), 0);

  return (
    <div style={{ minHeight:"100vh", background:"#fff7ed" }}>
      <style>{G}</style>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#f97316,#ea580c,#dc2626)", padding:"18px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:24, fontWeight:900, color:"#fff", fontFamily:"'Baloo 2',sans-serif", letterSpacing:1 }}>
            🎯 SanThai
          </div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.8)", fontWeight:600 }}>
            Vòng Quay May Mắn — Thất Kiếm Lệnh
          </div>
        </div>
        <div onClick={onAdmin} style={{ fontSize:11, color:"rgba(255,255,255,.4)", cursor:"default", userSelect:"none" }}>v2</div>
      </div>

      {/* Main split layout */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:0, minHeight:"calc(100vh - 80px - 60px)" }}>

        {/* LEFT — Input form */}
        <div style={{ flex:"1 1 320px", padding:"32px 28px", background:"#fff", borderRight:"1px solid #fed7aa", display:"flex", flexDirection:"column", gap:20 }}>

          <div style={{ background:"linear-gradient(135deg,#fff7ed,#fef3c7)", borderRadius:12, padding:"12px 16px", borderLeft:"4px solid #f59e0b", fontSize:13, color:"#92400e", lineHeight:1.6 }}>
            ⚠️ Mã bill sẽ được đối chiếu POS cuối ngày. Dùng mã không hợp lệ có thể bị hạn chế tham gia.
          </div>

          {/* Store selector */}
          <div>
            <label style={{ display:"block", fontSize:14, fontWeight:700, color:"#44403c", marginBottom:8 }}>
              🏪 Cửa hàng của bạn
            </label>
            {stores.length > 0 ? (
              <select value={storeId} onChange={e => { setStoreId(e.target.value); setStoreName(e.target.options[e.target.selectedIndex]?.text || ""); }}
                style={{ width:"100%", padding:"12px 14px", border:"2px solid #fed7aa", borderRadius:12, fontSize:15, color:"#1c1917", background:"#fff" }}>
                <option value="">-- Chọn cửa hàng --</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <input value={storeName} onChange={e => setStoreName(e.target.value)}
                placeholder="Nhập tên cửa hàng"
                style={{ width:"100%", padding:"12px 14px", border:"2px solid #fed7aa", borderRadius:12, fontSize:15, color:"#1c1917" }}/>
            )}
          </div>

          {/* Bill code */}
          <div>
            <label style={{ display:"block", fontSize:14, fontWeight:700, color:"#44403c", marginBottom:8 }}>
              🧾 Mã bill (in trên hóa đơn)
            </label>
            <input value={bill} onChange={e => setBill(e.target.value.toUpperCase())}
              onKeyDown={e => e.key==="Enter" && handleGetSpin()}
              placeholder="VD: HD20250601001" maxLength={30} disabled={loading}
              autoCapitalize="characters"
              style={{ width:"100%", padding:"13px 16px", border:"2px solid #fed7aa", borderRadius:12, fontSize:16, fontWeight:700, letterSpacing:1, color:"#1c1917" }}/>
          </div>

          {/* Phone */}
          <div>
            <label style={{ display:"block", fontSize:14, fontWeight:700, color:"#44403c", marginBottom:8 }}>
              📱 Số điện thoại
            </label>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
              onKeyDown={e => e.key==="Enter" && handleGetSpin()}
              placeholder="VD: 0901234567" maxLength={11} disabled={loading}
              style={{ width:"100%", padding:"13px 16px", border:"2px solid #fed7aa", borderRadius:12, fontSize:15, color:"#1c1917" }}/>
            <div style={{ fontSize:12, color:"#a8a29e", marginTop:5 }}>Dùng để liên hệ khi trúng giải lớn</div>
          </div>

          {err && (
            <div style={{ background:"#fef2f2", border:"2px solid #fecaca", borderRadius:10, padding:"10px 14px", fontSize:14, color:"#dc2626", animation:"shake .3s ease" }}>
              {err}
            </div>
          )}

          <button onClick={handleGetSpin} disabled={loading || !!pendingResult}
            style={{ padding:"15px", background: pendingResult?"#d1fae5":"linear-gradient(135deg,#f97316,#ea580c)",
              border:"none", borderRadius:14, color:"#fff", fontSize:17, fontWeight:900, cursor:loading||pendingResult?"not-allowed":"pointer",
              opacity: loading || pendingResult ? .7 : 1, letterSpacing:.5,
              boxShadow:"0 4px 20px rgba(249,115,22,.4)", transition:"all .2s" }}>
            {loading ? "⏳ Đang xác nhận…" : pendingResult ? "✅ Đã nhận lượt — Quay ngay!" : "🎟 NHẬN LƯỢT QUAY"}
          </button>

          <div style={{ fontSize:12, color:"#a8a29e", textAlign:"center" }}>Mỗi mã bill chỉ dùng được 1 lần</div>
        </div>

        {/* RIGHT — Wheel */}
        <div style={{ flex:"1 1 320px", padding:"32px 24px", background:"linear-gradient(160deg,#fff7ed,#fef3c7)", display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>

          {/* Spin count badge */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              background: spins > 0 ? "linear-gradient(135deg,#f97316,#ea580c)" : "#e5e7eb",
              borderRadius:50, padding:"8px 20px", fontSize:16, fontWeight:800,
              color: spins > 0 ? "#fff" : "#9ca3af",
              boxShadow: spins > 0 ? "0 4px 16px rgba(249,115,22,.4)" : "none",
              animation: spins > 0 ? "pulse-ring 1.5s infinite" : "none",
              transition: "all .4s",
            }}>
              🎯 {spins} lượt quay
            </div>
          </div>

          <WheelCanvas prizes={prizes} winnerId={pendingResult?.prize_id} spinning={spinning} onDone={handleSpinDone} size={wheelSize}/>

          <button onClick={handleSpin}
            disabled={!pendingResult || spinning}
            style={{
              padding:"15px 40px", fontSize:19, fontWeight:900, border:"none", borderRadius:50, cursor: pendingResult&&!spinning?"pointer":"not-allowed",
              background: pendingResult&&!spinning ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "#e5e7eb",
              color: pendingResult&&!spinning ? "#fff" : "#9ca3af",
              boxShadow: pendingResult&&!spinning ? "0 6px 24px rgba(124,58,237,.5)" : "none",
              transition:"all .3s", letterSpacing:.5,
              animation: pendingResult&&!spinning ? "pulse-ring 1.5s infinite" : "none",
            }}>
            {spinning ? "🌀 Đang quay…" : pendingResult ? "🎰 QUAY NGAY!" : "Nhập mã bill trước"}
          </button>

          {/* Prize grid preview */}
          {prizes.length > 0 && (
            <div style={{ width:"100%", maxWidth:380 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#92400e", marginBottom:8, textAlign:"center" }}>Danh sách phần thưởng</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:6 }}>
                {prizes.map((p, i) => (
                  <div key={p.id} style={{ background:"#fff", borderRadius:10, padding:"8px 6px", textAlign:"center",
                    border:"2px solid #fed7aa", fontSize:11, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <div style={{ width:12, height:12, borderRadius:"50%", background:WHEEL_COLORS[i%WHEEL_COLORS.length] }}/>
                    <div style={{ fontSize:16 }}>{p.icon}</div>
                    <div style={{ fontWeight:700, color:"#44403c", lineHeight:1.3 }}>{p.short_name || p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PUBLIC LEADERBOARD */}
      <div style={{ background:"#fff", borderTop:"2px solid #fed7aa", padding:"28px 24px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#1c1917", marginBottom:4, fontFamily:"'Baloo 2',sans-serif" }}>
            🏆 Bảng xếp hạng cửa hàng
          </div>
          <div style={{ fontSize:13, color:"#78716c", marginBottom:16 }}>Cập nhật mỗi phút</div>
          <div style={{ overflowX:"auto", borderRadius:14, border:"2px solid #fed7aa" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
              <thead>
                <tr style={{ background:"linear-gradient(135deg,#fff7ed,#fef3c7)" }}>
                  {["#","Cửa hàng","Tổng lượt quay","Giải lớn 🏆","Hoạt động gần nhất"].map(h => (
                    <th key={h} style={{ padding:"12px 14px", textAlign:"left", fontSize:13, fontWeight:800, color:"#92400e", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding:24, textAlign:"center", color:"#a8a29e", fontSize:14 }}>
                    Chưa có dữ liệu — event chưa bắt đầu
                  </td></tr>
                ) : stats.map((s, i) => (
                  <tr key={s.store_id} style={{ borderTop:"1px solid #fed7aa", background: i===0?"#fff7ed":i===1?"#fefce8":i===2?"#f0fdf4":"#fff" }}>
                    <td style={{ padding:"11px 14px", fontWeight:900, color:i<3?"#f97316":"#78716c", fontSize:16 }}>
                      {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                    </td>
                    <td style={{ padding:"11px 14px", fontWeight:700, color:"#1c1917" }}>{s.store_name || s.store_id}</td>
                    <td style={{ padding:"11px 14px", color:"#f97316", fontWeight:800, fontSize:16 }}>{s.total_spins}</td>
                    <td style={{ padding:"11px 14px" }}>
                      {s.big_wins > 0 ? (
                        <span style={{ background:"#fef3c7", border:"2px solid #f59e0b", borderRadius:20, padding:"3px 10px", fontSize:13, fontWeight:800, color:"#92400e" }}>
                          🏆 {s.big_wins} giải
                        </span>
                      ) : <span style={{ color:"#a8a29e", fontSize:13 }}>—</span>}
                    </td>
                    <td style={{ padding:"11px 14px", color:"#a8a29e", fontSize:13 }}>
                      {s.last_spin ? new Date(s.last_spin).toLocaleString("vi-VN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showResult && <ResultModal result={showResult} phone={phone} onClose={() => setShowResult(null)}/>}
    </div>
  );
}

/* ─── ADMIN PAGE ─── */
function AdminPage({ onBack }) {
  const [pwd, setPwd]         = useState("");
  const [authed, setAuthed]   = useState(false);
  const [pwdErr, setPwdErr]   = useState("");
  const [tab, setTab]         = useState("prizes");
  const [loading, setLoading] = useState(false);

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
  const [selected, setSelected]     = useState(new Set());
  const [reconResult, setReconResult] = useState(null);

  // Voucher import
  const [importTxt, setImportTxt] = useState("");
  const [importPid, setImportPid] = useState("");
  const [importMsg, setImportMsg] = useState("");

  // Blacklist
  const [blPhone, setBlPhone] = useState("");

  const login = () => {
    if (pwd === ADMIN_PWD) { setAuthed(true); setPwdErr(""); }
    else setPwdErr("Sai mật khẩu.");
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [p, s, sp, b, v] = await Promise.all([
      loadAllPrizes(), loadSpins(date), loadSpecialWinners(), loadBlacklist(), loadVouchers(),
    ]);
    setPrizes(Array.isArray(p)?p:[]); setSpins(Array.isArray(s)?s:[]);
    setSpecials(Array.isArray(sp)?sp:[]); setBl(Array.isArray(b)?b:[]);
    setVouchers(Array.isArray(v)?v:[]);
    setLoading(false);
  }, [date]);

  useEffect(() => { if (authed) loadAll(); }, [authed, loadAll]);

  // Prize CRUD
  const handleSavePrize = async () => {
    const name = editPrize?.name?.trim();
    const prob = parseFloat(editPrize?.probability);
    if (!name)              return setPrizeMsg("❌ Cần nhập tên giải thưởng");
    if (isNaN(prob) || prob < 0) return setPrizeMsg("❌ Xác suất không hợp lệ");
    setPrizeMsg("⏳ Đang lưu…");
    const ok = await savePrize(editPrize);
    if (ok) {
      setPrizeMsg("✅ Đã lưu thành công!");
      setEditPrize(null);
      loadAll();
    } else {
      setPrizeMsg("❌ Lỗi khi lưu. Kiểm tra Supabase hoặc chạy lại schema_v2.sql");
    }
    setTimeout(() => setPrizeMsg(""), 4000);
  };
  const handleDeletePrize = async (id) => {
    if (!confirm("Xóa giải thưởng này?")) return;
    await deletePrize(id); loadAll();
  };
  const totalProb = prizes.filter(p=>p.active).reduce((s,p) => s+(+p.probability||0), 0);

  const exportCSV = () => {
    const rows=[["Mã Bill","SĐT","Cửa hàng","Giải","Voucher","Hợp lệ","Thời gian"].join(",")];
    spins.forEach(s=>rows.push([s.bill_code,s.phone,`"${s.store_name||""}"`,`"${s.prize_name}"`,s.voucher_code||"",s.is_valid?"✓":"✗",s.spun_at].join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF"+rows.join("\n")],{type:"text/csv;charset=utf-8;"}));
    a.download=`santhai_spins_${date}.csv`; a.click();
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

  const TABS=[{id:"prizes",label:"🎁 Cấu hình giải"},{id:"spins",label:"📋 Lịch sử"},{id:"reconcile",label:"🔍 Đối chiếu"},{id:"vouchers",label:"🎟 Vouchers"},{id:"special",label:"🏆 Giải đặc biệt"},{id:"blacklist",label:"🚫 Blacklist"}];

  return (
    <div style={{ minHeight:"100vh",background:"#f9fafb",fontFamily:"Nunito,sans-serif" }}>
      <style>{G}</style>
      <div style={{ background:"linear-gradient(135deg,#f97316,#ea580c)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ fontSize:17,fontWeight:900,color:"#fff" }}>⚙️ Admin — SanThai Spin</div>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",padding:"6px 14px",cursor:"pointer",fontSize:13 }}>← Thoát</button>
      </div>
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
              <button onClick={exportCSV} style={{ ...inp,background:"#d1fae5",borderColor:"#a7f3d0",color:"#065f46",cursor:"pointer",fontWeight:700 }}>↓ Tải CSV</button>
              <span style={{ fontSize:13,color:"#6b7280" }}>{spins.length} bản ghi</span>
            </div>
            <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
              {[["Tổng",spins.length,"#f97316"],["Hợp lệ",spins.filter(s=>s.is_valid).length,"#10b981"],["Không hợp lệ",spins.filter(s=>!s.is_valid).length,"#ef4444"],["Ban",spins.filter(s=>s.shadow_ban_hit).length,"#7c3aed"]].map(([l,v,c])=>(
                <div key={l} style={{ background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 14px" }}>
                  <div style={{ fontSize:18,fontWeight:900,color:c }}>{v}</div>
                  <div style={{ fontSize:11,color:"#9ca3af" }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb" }}>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#f9fafb" }}>
                  {["Mã Bill","SĐT","Cửa hàng","Giải","Voucher","Status","Thời gian"].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {loading?<tr><td colSpan={7} style={{ ...td,textAlign:"center",color:"#9ca3af" }}>Đang tải…</td></tr>
                  :spins.length===0?<tr><td colSpan={7} style={{ ...td,textAlign:"center",color:"#9ca3af" }}>Không có dữ liệu</td></tr>
                  :spins.map(s=>(
                    <tr key={s.id} style={{ opacity:s.is_valid?1:.5 }}>
                      <td style={{ ...td,fontFamily:"monospace",color:"#6b7280",fontSize:12 }}>{s.bill_code}</td>
                      <td style={{ ...td,fontSize:12 }}>{s.phone}</td>
                      <td style={{ ...td,fontSize:12 }}>{s.store_name||"—"}</td>
                      <td style={{ ...td,fontWeight:700 }}>{s.prize_name}</td>
                      <td style={{ ...td,fontFamily:"monospace",fontSize:12,color:"#f97316" }}>{s.voucher_code||"—"}</td>
                      <td style={td}>
                        {!s.is_valid?<span style={{ color:"#ef4444",fontSize:12 }}>✗ Hủy</span>
                        :s.shadow_ban_hit?<span style={{ color:"#7c3aed",fontSize:12 }}>🚫 Ban</span>
                        :<span style={{ color:"#10b981",fontSize:12 }}>✓</span>}
                      </td>
                      <td style={{ ...td,fontSize:12,color:"#9ca3af",whiteSpace:"nowrap" }}>{new Date(s.spun_at).toLocaleString("vi-VN")}</td>
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
              <div style={{ overflowX:"auto",borderRadius:12,border:"1px solid #e5e7eb" }}>
                <table style={{ width:"100%",borderCollapse:"collapse" }}>
                  <thead><tr style={{ background:"#f9fafb" }}>
                    {["Giải","Còn","Gán","Dùng","Hủy"].map(h=><th key={h} style={{ ...th,textAlign:h==="Giải"?"left":"right" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {vSum.length===0?<tr><td colSpan={5} style={{ ...td,textAlign:"center",color:"#9ca3af" }}>Chưa có voucher</td></tr>
                    :vSum.map(([pid,s])=>(
                      <tr key={pid}>
                        <td style={td}>{s.name}</td>
                        <td style={{ ...td,textAlign:"right",color:"#10b981",fontWeight:700 }}>{s.unused||0}</td>
                        <td style={{ ...td,textAlign:"right",color:"#f59e0b" }}>{s.assigned||0}</td>
                        <td style={{ ...td,textAlign:"right",color:"#6b7280" }}>{s.redeemed||0}</td>
                        <td style={{ ...td,textAlign:"right",color:"#ef4444" }}>{s.voided||0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 style={{ fontSize:15,fontWeight:800,marginBottom:10 }}>Import voucher</h3>
              <div style={{ marginBottom:8 }}>
                <label style={{ fontSize:13,fontWeight:700,display:"block",marginBottom:4 }}>Loại phần thưởng</label>
                <select value={importPid} onChange={e=>setImportPid(e.target.value)} style={{ ...inp,width:"100%" }}>
                  <option value="">-- Chọn giải --</option>
                  {prizes.filter(p=>p.prize_type==="normal"&&p.has_voucher).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={{ fontSize:13,fontWeight:700,display:"block",marginBottom:4 }}>Danh sách mã (mỗi dòng 1 mã)</label>
                <textarea value={importTxt} onChange={e=>setImportTxt(e.target.value)} rows={6}
                  style={{ ...inp,width:"100%",resize:"vertical" }} placeholder={"ABC001\nABC002"}/>
              </div>
              <button onClick={doImport} style={{ ...inp,background:"#d1fae5",borderColor:"#a7f3d0",color:"#065f46",cursor:"pointer",fontWeight:700,width:"100%" }}>
                ↑ Import {importTxt.split(/[\n,]+/).filter(Boolean).length} mã
              </button>
              {importMsg && <div style={{ color:"#10b981",fontSize:13,marginTop:8 }}>{importMsg}</div>}
            </div>
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
