// supabase.js — SanThai Spin v2
const URL  = "https://stxymyjwxdtfxkvmsgmz.supabase.co";
const KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0eHlteWp3eGR0Znhrdm1zZ216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Nzg4ODIsImV4cCI6MjA5MjQ1NDg4Mn0.dxF-84q5CSoT21b__zq8XgUfyRuSAwIov9PL269WWm4";
const H    = { apikey:KEY, Authorization:`Bearer ${KEY}`, "Content-Type":"application/json" };

async function rpc(fn, params) {
  try {
    const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method:"POST", headers:H, body:JSON.stringify(params) });
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
    const r = await fetch(`${URL}/rest/v1/${table}?${params}`, { headers:H });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

async function post(table, body, prefer="return=minimal") {
  try {
    const r = await fetch(`${URL}/rest/v1/${table}`, {
      method:"POST", headers:{...H,Prefer:prefer}, body:JSON.stringify(body)
    });
    return r.ok;
  } catch { return false; }
}

async function patch(table, match, body) {
  try {
    const r = await fetch(`${URL}/rest/v1/${table}?${match}`, {
      method:"PATCH", headers:H, body:JSON.stringify(body)
    });
    return r.ok;
  } catch { return false; }
}

async function remove(table, match) {
  try {
    const r = await fetch(`${URL}/rest/v1/${table}?${match}`, { method:"DELETE", headers:H });
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
  if (prize.id) {
    return patch("spin_prizes", `id=eq.${prize.id}`, prize);
  } else {
    return post("spin_prizes", prize);
  }
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
    await fetch(`${URL}/rest/v1/spin_vouchers`, {
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
