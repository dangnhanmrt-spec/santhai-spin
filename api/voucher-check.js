// api/voucher-check.js
// Vercel Serverless Function — iPOS Callback API
// Deploy: đặt file này tại /api/voucher-check.js trong repo santhai-spin
// iPOS callback URL: https://santhai-spin.vercel.app/api/voucher-check

const SUPA_URL = "https://stxymyjwxdtfxkvmsgmz.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0eHlteWp3eGR0Znhrdm1zZ216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Nzg4ODIsImV4cCI6MjA5MjQ1NDg4Mn0.dxF-84q5CSoT21b__zq8XgUfyRuSAwIov9PL269WWm4";
const HEADERS = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
};

// ─── Helper: gọi Supabase REST ───
async function supaGet(table, params = "") {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, { headers: HEADERS });
  if (!r.ok) return [];
  const d = await r.json();
  return Array.isArray(d) ? d : [];
}

async function supaRpc(fn, params) {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(params),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: `RPC error: ${t.slice(0, 200)}` };
  }
  return r.json();
}

// ─── Format response cho iPOS ───
function iposResponse(body, code, discountAmount, description) {
  return {
    ...body,
    code: code,
    Discount_Amount: discountAmount,
    Discount_Description: description,
  };
}

// ─── MAIN HANDLER ───
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const couponCode = (body.Coupon_Code || "").trim();
    const orderLines = body.Voucher_Order_Line || [];
    const saleTranId = body.Sale_Tran_Id || "";
    const posId = body.Pos_Id || 0;

    // ── 1. Parse CODE-SĐT ──
    // Format: MEGA30-0934388103 hoặc VIP50-0912345678
    const sepIdx = couponCode.indexOf("-");
    if (sepIdx < 1) {
      return res.json(iposResponse(body, 0, 0,
        "Sai format. Nhập: MÃ-SĐT (VD: MEGA30-0934388103)"));
    }

    const voucherCode = couponCode.substring(0, sepIdx).toUpperCase();
    const phone = couponCode.substring(sepIdx + 1).replace(/\D/g, "");

    if (phone.length < 9) {
      return res.json(iposResponse(body, 0, 0, "SĐT không hợp lệ"));
    }

    // ── 2. Kiểm tra đây có phải mega voucher không ──
    // Nếu mã không tồn tại trong mega_vouchers → trả code 0 để iPOS check tiếp các rule khác
    const vouchers = await supaGet("mega_vouchers", `code=eq.${voucherCode}&limit=1`);
    if (!vouchers.length) {
      return res.json(iposResponse(body, 0, 0, "Mã voucher không tồn tại"));
    }

    // ── 3. Load danh sách mã món tính là "ly" ──
    const drinkCodes = await supaGet("mega_drink_codes", "active=eq.true&select=item_id");
    const drinkSet = new Set(drinkCodes.map((d) => d.item_id));

    if (drinkSet.size === 0) {
      return res.json(iposResponse(body, 0, 0,
        "Hệ thống chưa cấu hình danh sách mã thức uống. Liên hệ admin."));
    }

    // ── 4. Lọc món hợp lệ từ đơn hàng ──
    // Tách từng ly riêng (nếu Quantity > 1 → nhiều ly)
    const eligible = [];
    for (const line of orderLines) {
      if (drinkSet.has(line.Item_Id)) {
        const unitPrice = line.Price_Sale || (line.Amount / (line.Quantity || 1));
        const qty = line.Quantity || 1;
        for (let i = 0; i < qty; i++) {
          eligible.push({
            item_id: line.Item_Id,
            description: line.Description || "",
            amount: unitPrice,
          });
        }
      }
    }

    if (eligible.length === 0) {
      return res.json(iposResponse(body, 0, 0,
        "Đơn hàng không có món thức uống nằm trong danh sách voucher"));
    }

    // ── 5. Sort giá giảm dần → free ly đắt nhất trước ──
    eligible.sort((a, b) => b.amount - a.amount);

    // ── 6. Gọi RPC atomic (lock + validate + update + record) ──
    const result = await supaRpc("redeem_mega_voucher", {
      p_code: voucherCode,
      p_phone: phone,
      p_eligible_items: eligible,
      p_sale_tran_id: saleTranId,
      p_pos_id: posId,
      p_store_name: "", // có thể bổ sung nếu iPOS gửi store info
    });

    // ── 7. Trả kết quả cho iPOS ──
    if (result.ok) {
      const desc = [
        `✅ Free ${result.qty_freed} ly`,
        `(còn ${result.remaining}/${result.max_qty})`,
        `SĐT: ${result.phone}`,
      ].join(" ");
      return res.json(iposResponse(body, 4, result.discount_amount, desc));
    } else {
      return res.json(iposResponse(body, 0, 0, `❌ ${result.error}`));
    }

  } catch (err) {
    console.error("Mega voucher error:", err);
    return res.json(iposResponse(req.body || {}, 0, 0,
      "Lỗi hệ thống. Vui lòng thử lại hoặc liên hệ admin."));
  }
}
