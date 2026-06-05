import { useState, useRef, useEffect, useCallback } from "react";

/* ─── CONFIG ─── */
const SUPA_URL = "https://stxymyjwxdtfxkvmsgmz.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0eHlteWp3eGR0Znhrdm1zZ216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Nzg4ODIsImV4cCI6MjA5MjQ1NDg4Mn0.dxF-84q5CSoT21b__zq8XgUfyRuSAwIov9PL269WWm4";
const ADMIN_PWD = "Santhai2024!";
const H = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" };

/* ─── API HELPERS ─── */
const rpc = async (fn, params) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: H, body: JSON.stringify(params)
  });
  return r.json();
};
const query = async (table, params = "") => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, { headers: H });
  return r.json();
};
const insert = async (table, data) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(data)
  });
  return r.json();
};
const update = async (table, match, data) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${match}`, {
    method: "PATCH", headers: H, body: JSON.stringify(data)
  });
  return r.ok;
};
const del = async (table, match) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${match}`, { method: "DELETE", headers: H });
  return r.ok;
};

/* ─── PRIZES META ─── */
const PRIZES = {
  1:  { name:"Thẻ 30 ngày",       emoji:"🏆", color:"#ef4444", group:"special" },
  2:  { name:"Thẻ 15 ngày",       emoji:"🎫", color:"#a855f7", group:"special" },
  3:  { name:"Mất Lượt",           emoji:"❌", color:"#475569", group:"viral"   },
  4:  { name:"Thái Đỏ Mật Ong",   emoji:"🍯", color:"#3b82f6", group:"normal"  },
  5:  { name:"Thái Đỏ Sủi Bọt",   emoji:"🧋", color:"#0891b2", group:"normal"  },
  6:  { name:"Lục Trà Sủi Bọt",   emoji:"🌿", color:"#15803d", group:"normal"  },
  7:  { name:"Trà Tắc Thái Xanh", emoji:"🍹", color:"#0c4a6e", group:"normal"  },
  8:  { name:"Phô Mai Mặn",        emoji:"🧀", color:"#14532d", group:"normal"  },
  9:  { name:"Thạch Củ Năng",      emoji:"🌰", color:"#064e3b", group:"normal"  },
  10: { name:"Khúc Bạch",          emoji:"🍡", color:"#134e4a", group:"normal"  },
  11: { name:"Thạch Dừa",          emoji:"🥥", color:"#78350f", group:"normal"  },
  12: { name:"Pudding Socola",      emoji:"🍫", color:"#431407", group:"normal"  },
  13: { name:"Pudding Trứng",       emoji:"🍮", color:"#1c1917", group:"normal"  },
  14: { name:"Trân Châu Trắng",     emoji:"⚪", color:"#1c1917", group:"normal"  },
  15: { name:"Thạch Sương Sáo",     emoji:"🍃", color:"#0f172a", group:"normal"  },
  16: { name:"Thạch Aiyu",          emoji:"🌸", color:"#161b22", group:"normal"  },
};

/* ─── STYLES ─── */
const S = {
  page: { minHeight:"100vh", background:"linear-gradient(160deg,#0d0000,#1a0505,#0a0014)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px 16px", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:"#fef3c7" },
  logo: { fontSize:26, fontWeight:900, letterSpacing:2, color:"#f59e0b", textShadow:"0 0 20px rgba(245,158,11,.5)", marginBottom:3 },
  sub:  { fontSize:12, color:"#92400e", letterSpacing:1, marginBottom:24 },
  card: { background:"rgba(255,255,255,.04)", border:"1px solid rgba(245,158,11,.25)", borderRadius:14, padding:22, width:"100%", maxWidth:360 },
  label:{ fontSize:13, color:"#92400e", marginBottom:6, fontWeight:600, letterSpacing:.4 },
  input:{ width:"100%", padding:"12px 14px", background:"rgba(0,0,0,.5)", border:"1px solid rgba(245,158,11,.3)", borderRadius:9, color:"#fef3c7", fontSize:16, outline:"none", boxSizing:"border-box", fontFamily:"inherit" },
  btn:  { width:"100%", padding:"14px", background:"linear-gradient(135deg,#b45309,#f59e0b)", border:"none", borderRadius:9, color:"#0d0000", fontSize:16, fontWeight:800, cursor:"pointer", marginTop:12 },
  err:  { background:"rgba(239,68,68,.15)", border:"1px solid rgba(239,68,68,.4)", borderRadius:7, padding:"9px 13px", fontSize:13, color:"#fca5a5", marginTop:10 },
  warn: { background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.35)", borderRadius:7, padding:"10px 13px", fontSize:13, color:"#fca5a5", marginBottom:14, lineHeight:1.6 },
};

/* ─── CANVAS WHEEL ─── */
const SEGS = (() => {
  const weights = [50,100,50,200,300,300,400,600,600,600,700,700,900,1400,1500,1600];
  const total = 10000;
  const segs = [];
  let start = -Math.PI / 2;
  for (let i = 0; i < weights.length; i++) {
    const sweep = (weights[i] / total) * 2 * Math.PI;
    segs.push({ prizeId: i+1, start, sweep, mid: start + sweep/2, ...PRIZES[i+1] });
    start += sweep;
  }
  return segs;
})();

function getTargetRot(prizeId, curRot) {
  const seg = SEGS.find(s => s.prizeId === prizeId);
  if (!seg) return curRot + 6 * 2 * Math.PI;
  let base = -Math.PI / 2 - seg.mid;
  const min = curRot + 5 * 2 * Math.PI;
  const n = Math.ceil((min - base) / (2 * Math.PI));
  return base + n * 2 * Math.PI;
}

function WheelCanvas({ prizeId, spinning, onDone, size }) {
  const ref = useRef(null);
  const rotRef = useRef(0);
  const rafRef = useRef(null);

  const draw = useCallback((rot) => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width, H = c.height, cx = W/2, cy = H/2, R = Math.min(W,H)/2 - 8;
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(cx,cy,R+4,0,2*Math.PI); ctx.fillStyle="#1a0000"; ctx.fill();
    SEGS.forEach(({ start, sweep, color }) => {
      const s = start+rot, e = s+sweep;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,s,e); ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle="rgba(245,158,11,.35)"; ctx.lineWidth=1; ctx.stroke();
    });
    SEGS.forEach(({ start, sweep, emoji, prizeId: pid }) => {
      if (sweep < 0.07) return;
      const mid = start+rot+sweep/2;
      const lr = R*0.65, tx = cx+lr*Math.cos(mid), ty = cy+lr*Math.sin(mid);
      ctx.save(); ctx.translate(tx,ty); ctx.rotate(mid+Math.PI/2);
      ctx.font=`${Math.max(8,Math.min(13,sweep*50))}px sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(pid===3?"❌":emoji,0,0);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx,cy,R+2,0,2*Math.PI); ctx.strokeStyle="#f59e0b"; ctx.lineWidth=3; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,R*.1,0,2*Math.PI); ctx.fillStyle="#f59e0b"; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,R*.07,0,2*Math.PI); ctx.fillStyle="#0d0000"; ctx.fill();
    ctx.save(); ctx.translate(cx,6);
    ctx.beginPath(); ctx.moveTo(0,16); ctx.lineTo(-11,-2); ctx.lineTo(11,-2); ctx.closePath();
    ctx.fillStyle="#f59e0b"; ctx.shadowColor="rgba(245,158,11,.9)"; ctx.shadowBlur=10; ctx.fill();
    ctx.restore();
  }, []);

  useEffect(() => { draw(0); }, [draw]);

  useEffect(() => {
    if (!spinning || !prizeId) return;
    cancelAnimationFrame(rafRef.current);
    const target = getTargetRot(prizeId, rotRef.current);
    const from = rotRef.current, dur = 4800, t0 = performance.now();
    const ease = t => 1 - Math.pow(1-t, 4);
    const frame = now => {
      const t = Math.min(1, (now-t0)/dur);
      const rot = from + (target-from)*ease(t);
      rotRef.current = rot; draw(rot);
      if (t < 1) rafRef.current = requestAnimationFrame(frame);
      else { rotRef.current = target; draw(target); onDone?.(); }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, prizeId, draw, onDone]);

  return <canvas ref={ref} width={size} height={size} style={{ borderRadius:"50%", display:"block" }} />;
}

/* ─── CONFETTI ─── */
function Confetti() {
  const colors = ["#f59e0b","#ef4444","#a855f7","#22c55e","#3b82f6","#fff"];
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:100 }}>
      {Array.from({length:40}).map((_,i) => (
        <div key={i} style={{
          position:"absolute", top:"-10px", left:`${Math.random()*100}%`,
          width:`${6+Math.random()*8}px`, height:`${6+Math.random()*8}px`,
          background:colors[Math.floor(Math.random()*colors.length)],
          borderRadius:Math.random()>.5?"50%":"0",
          animation:`fall ${2+Math.random()*2}s ${Math.random()*.5}s ease-in forwards`,
          transform:`rotate(${Math.random()*360}deg)`,
        }}/>
      ))}
      <style>{`@keyframes fall{to{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CUSTOMER SCREENS
═══════════════════════════════════════════════ */

function InputScreen({ onSpin }) {
  const [bill, setBill] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const b = bill.trim().toUpperCase();
    const p = phone.replace(/\D/g,"");
    if (!b) return setErr("Vui lòng nhập mã bill.");
    if (b.length < 4) return setErr("Mã bill không hợp lệ.");
    if (p.length < 9 || p.length > 11) return setErr("Số điện thoại không hợp lệ.");
    setLoading(true); setErr("");
    const res = await rpc("do_spin", { p_bill: b, p_phone: p });
    setLoading(false);
    if (res?.error === "bill_used") return setErr("Mã bill này đã được sử dụng để quay.");
    if (res?.error) return setErr(res?.message || "Lỗi hệ thống, vui lòng thử lại.");
    if (res?.ok) onSpin(b, p, res);
    else setErr("Không nhận được phản hồi từ máy chủ.");
  };

  return (
    <div style={S.page}>
      <div style={S.logo}>SAN THAI</div>
      <div style={S.sub}>✦ VÒNG QUAY MAY MẮN ✦</div>
      <div style={{ ...S.warn, maxWidth:360, width:"100%" }}>
        ⚠️ <strong>Lưu ý:</strong> Mã bill sẽ được đối chiếu với dữ liệu POS vào cuối mỗi ngày.
        Sử dụng mã không hợp lệ có thể dẫn đến hủy phần thưởng và hạn chế tham gia.
      </div>
      <div style={S.card}>
        <div style={S.label}>MÃ BILL (in trên hóa đơn)</div>
        <input style={S.input} value={bill} onChange={e=>setBill(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="VD: HD20250601001" maxLength={30} disabled={loading}/>
        <div style={{ ...S.label, marginTop:14 }}>SỐ ĐIỆN THOẠI</div>
        <input style={S.input} value={phone} onChange={e=>setPhone(e.target.value)} type="tel"
          onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="VD: 0901234567" maxLength={11} disabled={loading}/>
        <div style={{ fontSize:12, color:"#57534e", marginTop:6 }}>
          Dùng để liên hệ khi trúng giải đặc biệt
        </div>
        {err && <div style={S.err}>{err}</div>}
        <button style={{ ...S.btn, opacity:loading?.5:1 }} onClick={submit} disabled={loading}>
          {loading ? "Đang xử lý…" : "🎰 QUAY NGAY"}
        </button>
        <div style={{ fontSize:11, color:"#44403c", marginTop:10, textAlign:"center" }}>
          Mỗi mã bill chỉ quay được 1 lần duy nhất
        </div>
      </div>
    </div>
  );
}

function SpinScreen({ bill, phone, result, onDone }) {
  const [spinning, setSpinning] = useState(false);
  const size = Math.min(320, (typeof window!=="undefined"?window.innerWidth:360) - 40);
  useEffect(() => { const t = setTimeout(()=>setSpinning(true),400); return()=>clearTimeout(t); }, []);
  const handleDone = useCallback(() => setTimeout(onDone, 700), [onDone]);
  return (
    <div style={S.page}>
      <div style={S.logo}>SAN THAI</div>
      <div style={{ fontSize:13, color:"#92400e", marginBottom:20, letterSpacing:1 }}>
        {spinning?"ĐANG QUAY…":"CHUẨN BỊ…"}
      </div>
      <WheelCanvas prizeId={result?.prize_id} spinning={spinning} onDone={handleDone} size={size}/>
      <div style={{ marginTop:16, fontSize:12, color:"#44403c" }}>Bill: {bill}</div>
    </div>
  );
}

function ResultScreen({ bill, phone, result, onRestart }) {
  const p = PRIZES[result?.prize_id] || {};
  const big = p.group === "special";
  const viral = p.group === "viral";

  const claimContent = () => {
    if (big) return (
      <div style={{ fontSize:13, color:"#94a3b8", lineHeight:1.7 }}>
        🎉 Chúc mừng! Bạn trúng <strong style={{ color:"#fef3c7" }}>{p.name}</strong>.<br/>
        Nhân viên SanThai sẽ liên hệ qua SĐT <strong style={{ color:"#f59e0b" }}>{phone}</strong> để trao giải.<br/>
        <span style={{ fontSize:12, color:"#64748b" }}>Vui lòng giữ điện thoại để nhận cuộc gọi.</span>
      </div>
    );
    if (viral) return (
      <div>
        <div style={{ fontSize:16, fontWeight:700, color:"#ef4444", marginBottom:8 }}>Lần này chưa trúng!</div>
        <div style={{ fontSize:13, color:"#94a3b8", lineHeight:1.7, marginBottom:12 }}>
          Nhưng bạn vẫn được <strong style={{ color:"#f59e0b" }}>1 topping miễn phí</strong> hôm nay — đưa màn hình này cho nhân viên nhé!
        </div>
        <div style={{ fontSize:12, color:"#6b7280", background:"rgba(239,68,68,.1)", padding:"10px 12px", borderRadius:7, lineHeight:1.6 }}>
          📸 Share ảnh màn hình này lên story, tag <strong>@santhai</strong> để nhận thêm 1 lượt quay!
        </div>
      </div>
    );
    // Normal prize with voucher
    const code = result?.voucher_code;
    return (
      <div>
        <div style={{ fontSize:13, color:"#94a3b8", marginBottom:10 }}>
          Bạn trúng <strong style={{ color:"#fef3c7" }}>{p.name}</strong>!
        </div>
        {code && code !== "PENDING" ? (
          <div style={{ background:"rgba(0,0,0,.4)", border:"1px solid rgba(245,158,11,.4)", borderRadius:9, padding:"14px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:"#92400e", marginBottom:4, letterSpacing:.5 }}>MÃ VOUCHER CỦA BẠN</div>
            <div style={{ fontSize:26, fontWeight:900, color:"#f59e0b", letterSpacing:3, wordBreak:"break-all" }}>{code}</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:6 }}>Đưa mã này cho nhân viên SanThai để nhận thưởng</div>
          </div>
        ) : (
          <div style={{ fontSize:13, color:"#f59e0b" }}>
            Đưa màn hình này cho nhân viên để nhận {p.name} miễn phí hôm nay.
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={S.page}>
      {big && <Confetti/>}
      <div style={S.logo}>SAN THAI</div>
      <div style={{ fontSize:big?64:viral?48:52, marginBottom:8, filter:big?"drop-shadow(0 0 20px rgba(245,158,11,.8))":"none" }}>
        {p.emoji}
      </div>
      <div style={{ ...S.card, textAlign:"center", borderColor:big?"rgba(245,158,11,.5)":viral?"rgba(239,68,68,.3)":"rgba(245,158,11,.2)" }}>
        {claimContent()}
      </div>
      <div style={{ marginTop:14, fontSize:11, color:"#292524" }}>Bill: {bill}</div>
      <button onClick={onRestart} style={{ marginTop:18, padding:"9px 26px", background:"transparent", border:"1px solid rgba(245,158,11,.3)", borderRadius:7, color:"#92400e", fontSize:13, cursor:"pointer" }}>
        ← Quay về
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ADMIN SCREENS
═══════════════════════════════════════════════ */

function AdminScreen({ onBack }) {
  const [pwd, setPwd] = useState(""); const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("spins");
  const [err, setErr] = useState("");
  // Data states
  const [spins, setSpins] = useState([]);
  const [specials, setSpecials] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0,10));
  // Reconcile
  const [selectedBills, setSelectedBills] = useState(new Set());
  const [reconResult, setReconResult] = useState(null);
  // Voucher import
  const [importText, setImportText] = useState("");
  const [importPrizeId, setImportPrizeId] = useState(4);
  const [importStatus, setImportStatus] = useState("");
  // Blacklist add
  const [blPhone, setBlPhone] = useState("");

  const login = () => { if (pwd===ADMIN_PWD) { setAuthed(true); } else setErr("Sai mật khẩu."); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, sp, bl, v] = await Promise.all([
      query("spin_records", `order=spun_at.desc&limit=500&spun_at=gte.${dateFilter}T00:00:00&spun_at=lte.${dateFilter}T23:59:59`),
      query("spin_special_winners", "order=won_at.desc&limit=200"),
      query("spin_blacklist", "order=added_at.desc"),
      query("spin_vouchers", "select=prize_id,prize_name,status&limit=10000"),
    ]);
    setSpins(Array.isArray(s)?s:[]); setSpecials(Array.isArray(sp)?sp:[]);
    setBlacklist(Array.isArray(bl)?bl:[]); setVouchers(Array.isArray(v)?v:[]);
    setLoading(false);
  }, [dateFilter]);

  useEffect(() => { if (authed) loadAll(); }, [authed, loadAll]);

  const exportCSV = () => {
    const rows = [["Mã Bill","SĐT","Giải","Voucher","Hợp lệ","Thời gian"].join(",")];
    spins.forEach(s => rows.push([s.bill_code,s.phone,s.prize_name,s.voucher_code||"",s.is_valid?"✓":"✗",s.spun_at].join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8;"}));
    a.download = `santhai_spins_${dateFilter}.csv`; a.click();
  };

  const applyInvalid = async () => {
    if (selectedBills.size === 0) return;
    const res = await rpc("admin_invalidate", { p_bills: [...selectedBills] });
    setReconResult(res); setSelectedBills(new Set()); loadAll();
  };

  const importVouchers = async () => {
    const codes = importText.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
    if (!codes.length) return;
    const pName = PRIZES[importPrizeId]?.name || "";
    const rows = codes.map(code => ({ prize_id: importPrizeId, prize_name: pName, code, status:"unused" }));
    // Insert in batches of 100
    let ok = 0;
    for (let i=0;i<rows.length;i+=100) {
      const batch = rows.slice(i,i+100);
      await fetch(`${SUPA_URL}/rest/v1/spin_vouchers`, { method:"POST", headers:{...H,Prefer:"resolution=ignore-duplicates"}, body:JSON.stringify(batch) });
      ok += batch.length;
    }
    setImportStatus(`✅ Đã import ${ok} voucher`); setImportText(""); loadAll();
  };

  const addBlacklist = async () => {
    const p = blPhone.replace(/\D/g,"");
    if (p.length < 9) return;
    await insert("spin_blacklist", { phone:p, reason:"Thêm thủ công bởi admin" });
    setBlPhone(""); loadAll();
  };

  const removeBlacklist = async (phone) => {
    await del("spin_blacklist", `phone=eq.${phone}`);
    loadAll();
  };

  const updateSpecialStatus = async (id, status) => {
    await update("spin_special_winners", `id=eq.${id}`, { contact_status: status });
    loadAll();
  };

  // Voucher summary by prize
  const voucherSummary = (() => {
    const m = {};
    vouchers.forEach(v => {
      if (!m[v.prize_id]) m[v.prize_id] = { name:v.prize_name, unused:0, assigned:0, redeemed:0, voided:0 };
      m[v.prize_id][v.status] = (m[v.prize_id][v.status]||0)+1;
    });
    return Object.entries(m).sort(([a],[b])=>+a-+b);
  })();

  const tbStyle = { width:"100%", borderCollapse:"collapse", fontSize:13 };
  const thStyle = { padding:"7px 10px", textAlign:"left", fontSize:12, fontWeight:600, color:"#475569", borderBottom:"1px solid #1e2a3a" };
  const tdStyle = { padding:"7px 10px", borderBottom:"1px solid #0f162566", fontSize:13 };
  const inpStyle = { background:"rgba(0,0,0,.4)", border:"1px solid #2d3a4a", borderRadius:7, padding:"8px 12px", color:"#fef3c7", fontSize:14, fontFamily:"inherit" };

  if (!authed) return (
    <div style={{ ...S.page }}>
      <div style={S.logo}>ADMIN</div>
      <div style={{ ...S.card, maxWidth:320 }}>
        <div style={S.label}>MẬT KHẨU</div>
        <input type="password" style={S.input} value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
        {err&&<div style={S.err}>{err}</div>}
        <button style={S.btn} onClick={login}>Đăng nhập</button>
        <button onClick={onBack} style={{ ...S.btn, background:"transparent", border:"1px solid rgba(245,158,11,.3)", color:"#92400e", marginTop:8 }}>← Quay về</button>
      </div>
    </div>
  );

  const TABS = [
    {id:"spins",    label:"Lịch sử"},
    {id:"reconcile",label:"Đối chiếu"},
    {id:"vouchers", label:"Vouchers"},
    {id:"special",  label:"Giải đặc biệt"},
    {id:"blacklist",label:"Blacklist"},
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a14", color:"#fef3c7", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding:14 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:18, fontWeight:800, color:"#f59e0b" }}>ADMIN — SanThai Spin</div>
        <button onClick={onBack} style={{ background:"transparent", border:"1px solid #2d3a4a", borderRadius:6, color:"#64748b", padding:"5px 12px", cursor:"pointer", fontSize:12 }}>← Ra ngoài</button>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"7px 14px", borderRadius:7, border:"1px solid",
            borderColor: tab===t.id?"#f59e0b":"#2d3a4a",
            background: tab===t.id?"rgba(245,158,11,.15)":"transparent",
            color: tab===t.id?"#f59e0b":"#64748b", cursor:"pointer", fontSize:13, fontWeight:600,
          }}>{t.label}</button>
        ))}
        <button onClick={loadAll} style={{ padding:"7px 14px", borderRadius:7, border:"1px solid #2d3a4a", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:13 }}>
          {loading?"Đang tải…":"🔄 Làm mới"}
        </button>
      </div>

      {/* ── TAB: LỊCH SỬ ── */}
      {tab==="spins" && (
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
            <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={{ ...inpStyle, width:"auto" }}/>
            <button onClick={exportCSV} style={{ ...inpStyle, background:"rgba(34,197,94,.15)", borderColor:"#22c55e55", color:"#22c55e", cursor:"pointer", fontWeight:700 }}>
              ↓ Tải CSV
            </button>
            <div style={{ fontSize:13, color:"#475569" }}>{spins.length} bản ghi</div>
          </div>
          {/* Stats row */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            {[
              ["Tổng quay", spins.length, "#f59e0b"],
              ["Hợp lệ", spins.filter(s=>s.is_valid).length, "#22c55e"],
              ["Không hợp lệ", spins.filter(s=>!s.is_valid).length, "#ef4444"],
              ["Shadow ban", spins.filter(s=>s.shadow_ban_hit).length, "#a855f7"],
            ].map(([l,v,c]) => (
              <div key={l} style={{ background:"rgba(255,255,255,.04)", border:"1px solid #1e2a3a", borderRadius:8, padding:"8px 14px" }}>
                <div style={{ fontSize:18, fontWeight:800, color:c }}>{v}</div>
                <div style={{ fontSize:11, color:"#475569" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ overflowX:"auto", border:"1px solid #1e2a3a", borderRadius:8 }}>
            <table style={tbStyle}>
              <thead><tr>
                <th style={thStyle}>Mã Bill</th><th style={thStyle}>SĐT</th>
                <th style={thStyle}>Giải</th><th style={thStyle}>Voucher</th>
                <th style={thStyle}>Trạng thái</th><th style={thStyle}>Thời gian</th>
              </tr></thead>
              <tbody>
                {spins.length===0 ? <tr><td colSpan={6} style={{ ...tdStyle, textAlign:"center", color:"#475569" }}>Không có dữ liệu</td></tr>
                : spins.map(s => (
                  <tr key={s.id} style={{ opacity: s.is_valid?1:.5 }}>
                    <td style={{ ...tdStyle, fontFamily:"monospace", color:"#a8a29e", fontSize:12 }}>{s.bill_code}</td>
                    <td style={{ ...tdStyle, fontSize:12 }}>{s.phone}</td>
                    <td style={{ ...tdStyle, color:"#fef3c7" }}>{s.prize_name}</td>
                    <td style={{ ...tdStyle, fontFamily:"monospace", fontSize:12, color:"#f59e0b" }}>{s.voucher_code||"—"}</td>
                    <td style={tdStyle}>
                      {!s.is_valid ? <span style={{ color:"#ef4444", fontSize:12 }}>✗ Hủy</span>
                      : s.shadow_ban_hit ? <span style={{ color:"#a855f7", fontSize:12 }}>🚫 Ban</span>
                      : <span style={{ color:"#22c55e", fontSize:12 }}>✓</span>}
                    </td>
                    <td style={{ ...tdStyle, fontSize:12, color:"#475569", whiteSpace:"nowrap" }}>
                      {new Date(s.spun_at).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: ĐỐI CHIẾU ── */}
      {tab==="reconcile" && (
        <div>
          <div style={{ background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.3)", borderRadius:8, padding:"12px 14px", marginBottom:14, fontSize:14, color:"#fde68a", lineHeight:1.7 }}>
            <strong>Quy trình đối chiếu cuối ngày:</strong><br/>
            1. Tải CSV (tab Lịch sử) → so sánh với export POS<br/>
            2. Chọn (tick) các bill không khớp bên dưới<br/>
            3. Nhấn "Xử lý bill không hợp lệ" → hệ thống tự void/blacklist
          </div>
          {reconResult && (
            <div style={{ background:"rgba(34,197,94,.1)", border:"1px solid #22c55e44", borderRadius:8, padding:"11px 14px", marginBottom:12, fontSize:14, color:"#86efac" }}>
              ✅ Xử lý xong: {reconResult.voided} voucher đã void · {reconResult.blacklisted} SĐT đã blacklist
            </div>
          )}
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <button onClick={applyInvalid} disabled={selectedBills.size===0} style={{
              padding:"9px 16px", borderRadius:7, border:"none",
              background: selectedBills.size>0?"#ef4444":"#2d3a4a",
              color:selectedBills.size>0?"#fff":"#64748b", cursor:selectedBills.size>0?"pointer":"not-allowed", fontSize:13, fontWeight:700,
            }}>
              ⚠ Xử lý {selectedBills.size} bill không hợp lệ
            </button>
            <button onClick={()=>setSelectedBills(new Set())} style={{ padding:"9px 14px", borderRadius:7, border:"1px solid #2d3a4a", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:13 }}>
              Bỏ chọn tất cả
            </button>
          </div>
          <div style={{ overflowX:"auto", border:"1px solid #1e2a3a", borderRadius:8 }}>
            <table style={tbStyle}>
              <thead><tr>
                <th style={{ ...thStyle, width:40 }}></th>
                <th style={thStyle}>Mã Bill</th><th style={thStyle}>SĐT</th>
                <th style={thStyle}>Giải</th><th style={thStyle}>Voucher</th>
                <th style={thStyle}>Trạng thái voucher</th>
              </tr></thead>
              <tbody>
                {spins.filter(s=>s.is_valid).map(s => (
                  <tr key={s.id} style={{ background: selectedBills.has(s.bill_code)?"rgba(239,68,68,.08)":"" }}>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={selectedBills.has(s.bill_code)}
                        onChange={e => {
                          const ns = new Set(selectedBills);
                          e.target.checked ? ns.add(s.bill_code) : ns.delete(s.bill_code);
                          setSelectedBills(ns);
                        }}/>
                    </td>
                    <td style={{ ...tdStyle, fontFamily:"monospace", color:"#a8a29e", fontSize:12 }}>{s.bill_code}</td>
                    <td style={{ ...tdStyle, fontSize:12 }}>{s.phone}</td>
                    <td style={tdStyle}>{s.prize_name}</td>
                    <td style={{ ...tdStyle, fontFamily:"monospace", fontSize:12 }}>{s.voucher_code||"—"}</td>
                    <td style={tdStyle}>
                      {s.prize_group==="special"?<span style={{ color:"#a855f7" }}>Giải đặc biệt</span>
                      : s.prize_group==="viral" ? <span style={{ color:"#475569" }}>Không có voucher</span>
                      : s.voucher_code==="PENDING" ? <span style={{ color:"#f59e0b" }}>PENDING</span>
                      : <span style={{ color:"#06b6d4" }}>Đã gán</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: VOUCHERS ── */}
      {tab==="vouchers" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <h3 style={{ color:"#94a3b8", marginBottom:10, fontSize:15 }}>Trạng thái pool voucher</h3>
              <div style={{ overflowX:"auto", border:"1px solid #1e2a3a", borderRadius:8 }}>
                <table style={tbStyle}>
                  <thead><tr>
                    <th style={thStyle}>Giải</th>
                    <th style={{ ...thStyle, textAlign:"right" }}>Còn</th>
                    <th style={{ ...thStyle, textAlign:"right" }}>Đã gán</th>
                    <th style={{ ...thStyle, textAlign:"right" }}>Đã dùng</th>
                    <th style={{ ...thStyle, textAlign:"right" }}>Đã hủy</th>
                  </tr></thead>
                  <tbody>
                    {voucherSummary.map(([pid, s]) => (
                      <tr key={pid}>
                        <td style={tdStyle}>{s.name}</td>
                        <td style={{ ...tdStyle, textAlign:"right", color:"#22c55e" }}>{s.unused||0}</td>
                        <td style={{ ...tdStyle, textAlign:"right", color:"#f59e0b" }}>{s.assigned||0}</td>
                        <td style={{ ...tdStyle, textAlign:"right", color:"#94a3b8" }}>{s.redeemed||0}</td>
                        <td style={{ ...tdStyle, textAlign:"right", color:"#ef4444" }}>{s.voided||0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 style={{ color:"#94a3b8", marginBottom:10, fontSize:15 }}>Import voucher (CSV)</h3>
              <div style={{ marginBottom:8 }}>
                <label style={{ fontSize:13, color:"#64748b", display:"block", marginBottom:6 }}>Loại phần thưởng</label>
                <select value={importPrizeId} onChange={e=>setImportPrizeId(+e.target.value)} style={{ ...inpStyle, width:"100%" }}>
                  {Object.entries(PRIZES).filter(([,p])=>p.group==="normal").map(([id,p])=>(
                    <option key={id} value={id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={{ fontSize:13, color:"#64748b", display:"block", marginBottom:6 }}>Dán danh sách mã (mỗi mã 1 dòng hoặc phân cách bằng dấu phẩy)</label>
                <textarea value={importText} onChange={e=>setImportText(e.target.value)}
                  rows={6} style={{ ...inpStyle, width:"100%", resize:"vertical" }}
                  placeholder={"ABC001\nABC002\nABC003"}/>
              </div>
              <button onClick={importVouchers} style={{ ...inpStyle, background:"rgba(34,197,94,.2)", borderColor:"#22c55e55", color:"#22c55e", cursor:"pointer", fontWeight:700, width:"100%" }}>
                ↑ Import {importText.split(/[\n,]+/).filter(Boolean).length} mã
              </button>
              {importStatus && <div style={{ color:"#86efac", fontSize:13, marginTop:8 }}>{importStatus}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: GIẢI ĐẶC BIỆT ── */}
      {tab==="special" && (
        <div>
          <div style={{ overflowX:"auto", border:"1px solid #1e2a3a", borderRadius:8 }}>
            <table style={tbStyle}>
              <thead><tr>
                <th style={thStyle}>Bill</th><th style={thStyle}>SĐT</th>
                <th style={thStyle}>Giải</th><th style={thStyle}>Hợp lệ</th>
                <th style={thStyle}>Trạng thái</th><th style={thStyle}>Thao tác</th>
                <th style={thStyle}>Thời gian</th>
              </tr></thead>
              <tbody>
                {specials.length===0 ? <tr><td colSpan={7} style={{ ...tdStyle, textAlign:"center", color:"#475569" }}>Chưa có giải đặc biệt</td></tr>
                : specials.map(s => {
                  const statusColors = { pending:"#f59e0b", contacted:"#3b82f6", delivered:"#22c55e", cancelled:"#ef4444" };
                  return (
                    <tr key={s.id}>
                      <td style={{ ...tdStyle, fontFamily:"monospace", fontSize:12 }}>{s.bill_code}</td>
                      <td style={{ ...tdStyle, fontWeight:700 }}>{s.phone}</td>
                      <td style={{ ...tdStyle, color:"#f59e0b" }}>{s.prize_name}</td>
                      <td style={tdStyle}>{s.is_valid?<span style={{ color:"#22c55e" }}>✓</span>:<span style={{ color:"#ef4444" }}>✗</span>}</td>
                      <td style={{ ...tdStyle, color: statusColors[s.contact_status]||"#94a3b8" }}>
                        {s.contact_status}
                      </td>
                      <td style={tdStyle}>
                        <select value={s.contact_status} onChange={e=>updateSpecialStatus(s.id,e.target.value)}
                          style={{ ...inpStyle, padding:"4px 8px", fontSize:12 }}>
                          <option value="pending">Chờ liên hệ</option>
                          <option value="contacted">Đã liên hệ</option>
                          <option value="delivered">Đã trao</option>
                          <option value="cancelled">Hủy</option>
                        </select>
                      </td>
                      <td style={{ ...tdStyle, fontSize:12, color:"#475569" }}>
                        {new Date(s.won_at).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: BLACKLIST ── */}
      {tab==="blacklist" && (
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <input value={blPhone} onChange={e=>setBlPhone(e.target.value)} placeholder="Nhập SĐT cần chặn"
              style={{ ...inpStyle, flex:1 }} type="tel"/>
            <button onClick={addBlacklist} style={{ ...inpStyle, background:"rgba(239,68,68,.2)", borderColor:"#ef444455", color:"#ef4444", cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}>
              + Thêm
            </button>
          </div>
          <div style={{ overflowX:"auto", border:"1px solid #1e2a3a", borderRadius:8 }}>
            <table style={tbStyle}>
              <thead><tr>
                <th style={thStyle}>SĐT</th><th style={thStyle}>Lý do</th>
                <th style={thStyle}>Ngày chặn</th><th style={thStyle}></th>
              </tr></thead>
              <tbody>
                {blacklist.length===0 ? <tr><td colSpan={4} style={{ ...tdStyle, textAlign:"center", color:"#475569" }}>Danh sách trống</td></tr>
                : blacklist.map(b => (
                  <tr key={b.phone}>
                    <td style={{ ...tdStyle, fontWeight:700, color:"#fca5a5" }}>{b.phone}</td>
                    <td style={{ ...tdStyle, color:"#94a3b8", fontSize:13 }}>{b.reason}</td>
                    <td style={{ ...tdStyle, fontSize:12, color:"#475569" }}>{new Date(b.added_at).toLocaleDateString("vi-VN")}</td>
                    <td style={tdStyle}>
                      <button onClick={()=>removeBlacklist(b.phone)} style={{ padding:"4px 10px", borderRadius:5, border:"1px solid #ef444455", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:12 }}>
                        Gỡ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState("input");
  const [bill, setBill] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (window.location.hash === "#admin") setScreen("admin");
  }, []);

  const handleSpin = (b, p, res) => { setBill(b); setPhone(p); setResult(res); setScreen("spin"); };
  const handleDone = () => setScreen("result");
  const handleRestart = () => { setBill(""); setPhone(""); setResult(null); setScreen("input"); };
  const handleAdmin = () => { window.location.hash = "admin"; setScreen("admin"); };
  const handleAdminBack = () => { window.location.hash = ""; setScreen("input"); };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
      {screen==="input"  && <InputScreen  onSpin={handleSpin}/>}
      {screen==="spin"   && <SpinScreen   bill={bill} phone={phone} result={result} onDone={handleDone}/>}
      {screen==="result" && <ResultScreen bill={bill} phone={phone} result={result} onRestart={handleRestart}/>}
      {screen==="admin"  && <AdminScreen  onBack={handleAdminBack}/>}
      {screen==="input"  && (
        <div onClick={handleAdmin} style={{ position:"fixed", bottom:8, right:8, padding:"8px 12px", fontSize:11, color:"#1c1917", cursor:"default", userSelect:"none" }}>
          v2.0
        </div>
      )}
    </>
  );
}
