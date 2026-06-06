// supabase.js — SanThai Spin v2
const SUPA_URL = "https://stxymyjwxdtfxkvmsgmz.supabase.co";
const KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0eHlteWp3eGR0Znhrdm1zZ216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Nzg4ODIsImV4cCI6MjA5MjQ1NDg4Mn0.dxF-84q5CSoT21b__zq8XgUfyRuSAwIov9PL269WWm4";
const H    = { apikey:KEY, Authorization:`Bearer ${KEY}`, "Content-Type":"application/json" };

async function rpc(fn, params) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, { method:"POST", headers:H, body:JSON.stringify(params) });
    if (!r.ok) {
      const t = await r.text();
      if (t.includes("does not exist") || r.status===404)
        return { error:"setup_required", message:"Cần chạy schema_v2.sql trong Supabase." };
      return { error:"server_error", message:`Lỗi máy chủ (${r.status})` };
    }
    return r.json();
  } catch { return { error:"network", message:"Không kết nối được. Kiểm tra mạng." }; }
}

async function get(table, params="") {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, { headers:H });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

async function post(table, body, prefer="return=minimal") {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method:"POST", headers:{...H,Prefer:prefer}, body:JSON.stringify(body)
    });
    return r.ok;
  } catch { return false; }
}

async function patch(table, match, body) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${match}`, {
      method:"PATCH", headers:H, body:JSON.stringify(body)
    });
    return r.ok;
  } catch { return false; }
}

async function remove(table, match) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${match}`, { method:"DELETE", headers:H });
    return r.ok;
  } catch { return false; }
}

function dayRange(date) {
  return { start:`${date}T00:00:00+07:00`, end:`${date}T23:59:59+07:00` };
}

// ─── CUSTOMER ───
export async function doSpin(bill, phone, storeId, storeName) {
  return rpc("do_spin", {
    p_bill: bill.trim().toUpperCase(),
    p_phone: phone.replace(/\D/g,""),
    p_store_id: storeId || null,
    p_store_name: storeName || null,
  });
}

// ─── PRIZES (public + admin) ───
export async function loadActivePrizes() {
  return get("spin_prizes", "active=eq.true&order=display_order,id");
}

export async function loadAllPrizes() {
  return get("spin_prizes", "order=display_order,id");
}

export async function savePrize(prize) {
  const { id, created_at, ...data } = prize;
  data.probability   = parseFloat(data.probability)   || 0;
  data.display_order = parseInt(data.display_order)   || 0;
  data.has_voucher   = Boolean(data.has_voucher);
  data.active        = Boolean(data.active);

  try {
    let r;
    if (id) {
      r = await fetch(`${SUPA_URL}/rest/v1/spin_prizes?id=eq.${id}`, {
        method: "PATCH", headers: H, body: JSON.stringify(data),
      });
    } else {
      r = await fetch(`${SUPA_URL}/rest/v1/spin_prizes`, {
        method: "POST",
        headers: { ...H, Prefer: "return=representation" },
        body: JSON.stringify(data),
      });
    }
    if (!r.ok) {
      const txt = await r.text();
      if (txt.includes("does not exist") || r.status === 404)
        return { ok: false, error: "Bảng spin_prizes chưa tồn tại. Chạy schema_v2.sql trong Supabase!" };
      return { ok: false, error: `Lỗi HTTP ${r.status}: ${txt.slice(0,100)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Không kết nối được Supabase: " + e.message };
  }
}


// Kiểm tra bảng spin_prizes đã tồn tại chưa
export async function testConnection() {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/spin_prizes?limit=1`, { headers: H });
    if (r.status === 404 || r.status === 400) return { ok: false, error: "table_missing" };
    if (!r.ok) return { ok: false, error: `http_${r.status}` };
    return { ok: true };
  } catch { return { ok: false, error: "network" }; }
}


// Reset về 16 giải mặc định
export async function resetDefaultPrizes() {
  const defaults = [
    { id:1,  name:"Thẻ 30 ngày",       short_name:"30 ngày",   color:"#ef4444", icon:"🏆", probability:0.50,  prize_type:"special", has_voucher:false, active:true, display_order:1  },
    { id:2,  name:"Thẻ 15 ngày",       short_name:"15 ngày",   color:"#a855f7", icon:"🎫", probability:1.00,  prize_type:"special", has_voucher:false, active:true, display_order:2  },
    { id:3,  name:"Mất Lượt",          short_name:"❌",          color:"#64748b", icon:"❌", probability:0.50,  prize_type:"viral",   has_voucher:false, active:true, display_order:3  },
    { id:4,  name:"Thái Đỏ Mật Ong",   short_name:"Mật Ong",   color:"#3b82f6", icon:"🍯", probability:2.00,  prize_type:"normal",  has_voucher:true,  active:true, display_order:4  },
    { id:5,  name:"Thái Đỏ Sủi Bọt",   short_name:"T.Đỏ SB",   color:"#0891b2", icon:"🧋", probability:3.00,  prize_type:"normal",  has_voucher:true,  active:true, display_order:5  },
    { id:6,  name:"Lục Trà Sủi Bọt",   short_name:"Lục Trà",   color:"#059669", icon:"🌿", probability:3.00,  prize_type:"normal",  has_voucher:true,  active:true, display_order:6  },
    { id:7,  name:"Trà Tắc Thái Xanh", short_name:"Trà Tắc",   color:"#0c4a6e", icon:"🍹", probability:4.00,  prize_type:"normal",  has_voucher:true,  active:true, display_order:7  },
    { id:8,  name:"Phô Mai Mặn",        short_name:"P.Mai Mặn", color:"#15803d", icon:"🧀", probability:6.00,  prize_type:"normal",  has_voucher:true,  active:true, display_order:8  },
    { id:9,  name:"Thạch Củ Năng",      short_name:"Củ Năng",   color:"#065f46", icon:"🌰", probability:6.00,  prize_type:"normal",  has_voucher:true,  active:true, display_order:9  },
    { id:10, name:"Khúc Bạch",          short_name:"Khúc Bạch", color:"#134e4a", icon:"🍡", probability:6.00,  prize_type:"normal",  has_voucher:true,  active:true, display_order:10 },
    { id:11, name:"Thạch Dừa",          short_name:"Thạch Dừa", color:"#92400e", icon:"🥥", probability:7.00,  prize_type:"normal",  has_voucher:true,  active:true, display_order:11 },
    { id:12, name:"Pudding Socola",      short_name:"Pudding",   color:"#7c2d12", icon:"🍫", probability:7.00,  prize_type:"normal",  has_voucher:true,  active:true, display_order:12 },
    { id:13, name:"Pudding Trứng",       short_name:"P.Trứng",   color:"#451a03", icon:"🍮", probability:9.00,  prize_type:"normal",  has_voucher:true,  active:true, display_order:13 },
    { id:14, name:"Trân Châu Trắng",     short_name:"TC Trắng",  color:"#374151", icon:"⚪", probability:14.00, prize_type:"normal",  has_voucher:true,  active:true, display_order:14 },
    { id:15, name:"Thạch Sương Sáo",     short_name:"S.Sáo",     color:"#1e3a5f", icon:"🍃", probability:15.00, prize_type:"normal",  has_voucher:true,  active:true, display_order:15 },
    { id:16, name:"Thạch Aiyu",          short_name:"Aiyu",      color:"#1e1b4b", icon:"🌸", probability:16.00, prize_type:"normal",  has_voucher:true,  active:true, display_order:16 },
  ];
  const r = await fetch(`${SUPA_URL}/rest/v1/spin_prizes`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(defaults),
  });
  return r.ok;
}

export async function deletePrize(id) {
  return remove("spin_prizes", `id=eq.${id}`);
}

export async function updatePrizesOrder(prizes) {
  for (const p of prizes) {
    await patch("spin_prizes", `id=eq.${p.id}`, { display_order: p.display_order });
  }
}

// ─── PUBLIC STATS ───
export async function loadStoreStats() {
  return get("store_spin_stats", "limit=100");
}

// ─── STORES (from feedback app stores table) ───
export async function loadStores() {
  const r = await get("stores", "active=eq.true&order=name&limit=200");
  return r.length > 0 ? r : [];
}

// ─── ADMIN ───
export async function loadSpins(date) {
  const { start, end } = dayRange(date);
  return get("spin_records", `order=spun_at.desc&limit=500&spun_at=gte.${encodeURIComponent(start)}&spun_at=lte.${encodeURIComponent(end)}`);
}

export async function loadSpecialWinners() {
  return get("spin_special_winners", "order=won_at.desc&limit=200");
}

export async function loadBlacklist() {
  return get("spin_blacklist", "order=added_at.desc");
}

export async function loadVouchers() {
  return get("spin_vouchers", "select=prize_id,prize_name,status&limit=10000");
}

export async function adminInvalidate(bills) {
  return rpc("admin_invalidate", { p_bills: bills });
}

export async function importVouchers(codes, prizeId, prizeName) {
  const rows = codes.map(c => ({ prize_id:prizeId, prize_name:prizeName, code:c.trim(), status:"unused" }));
  for (let i=0; i<rows.length; i+=100) {
    await fetch(`${SUPA_URL}/rest/v1/spin_vouchers`, {
      method:"POST",
      headers:{...H, Prefer:"resolution=ignore-duplicates"},
      body:JSON.stringify(rows.slice(i,i+100)),
    });
  }
  return rows.length;
}

export async function addBlacklist(phone, reason) {
  return post("spin_blacklist", { phone:phone.replace(/\D/g,""), reason, added_by:"admin" });
}

export async function removeBlacklist(phone) {
  return remove("spin_blacklist", `phone=eq.${phone}`);
}

export async function updateSpecialStatus(id, status, note="") {
  return patch("spin_special_winners", `id=eq.${id}`, { contact_status:status, staff_note:note });
}

// ─── VOUCHER DETAIL MANAGEMENT ───
export async function loadPrizeVouchers(prizeId, status = null) {
  const f = status ? `&status=eq.${status}` : "";
  return get("spin_vouchers", `prize_id=eq.${prizeId}&order=created_at.desc&limit=500${f}`);
}

export async function deleteVoucher(id) {
  return remove("spin_vouchers", `id=eq.${id}`);
}

export async function bulkDeleteVouchers(ids) {
  if (!ids.length) return false;
  return remove("spin_vouchers", `id=in.(${ids.join(",")})`);
}
