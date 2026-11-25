export function parseVoucherCodes(text) {
 const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if (/^(code|mã|ma|voucher_code)$/i.test(lines[0]||'')) lines.shift();
 if (!lines.length || lines.length>10000) throw new Error('Nhập từ 1 đến 10.000 mã.');
 const codes=lines.map(s=>s.toUpperCase());
 const invalid=codes.findIndex(s=>!/^[A-Z0-9_-]{5,64}$/.test(s));
 if(invalid>=0) throw new Error(`Dòng mã ${invalid+1} không hợp lệ. Mỗi dòng một mã, 5–64 ký tự chữ, số, - hoặc _.`);
 return codes;
}
