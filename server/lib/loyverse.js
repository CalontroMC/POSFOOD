export class UnmappedItemError extends Error {
  constructor(names) {
    super(`เมนูยังไม่ได้แมป Loyverse variant: ${names.join(", ")}`);
    this.name = "UnmappedItemError";
    this.names = names;
  }
}

export class ReceiptTotalMismatchError extends Error {
  constructor(sum, total) {
    super(`ยอดรวมรายการ (${sum}) ไม่ตรงกับยอดบิล (${total}) — มีส่วนลด/ใช้แต้ม ยังไม่รองรับใน v1`);
    this.name = "ReceiptTotalMismatchError";
    this.sum = sum;
    this.total = total;
  }
}

const BASE = "https://api.loyverse.com/v1.0";

async function call(pathAndQuery, { token, method = "GET", body, fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(`${BASE}${pathAndQuery}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    const err = new Error(`Loyverse ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function testConnection({ token, fetchImpl } = {}) {
  try {
    const data = await call("/stores", { token, fetchImpl });
    return { ok: true, stores: data.stores || [] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function listPaymentTypes({ token, fetchImpl } = {}) {
  const data = await call("/payment_types", { token, fetchImpl });
  return data.payment_types || [];
}

export async function listItems({ token, cursor, fetchImpl } = {}) {
  const q = cursor ? `?limit=250&cursor=${encodeURIComponent(cursor)}` : "?limit=250";
  const data = await call(`/items${q}`, { token, fetchImpl });
  return { items: data.items || [], cursor: data.cursor || null };
}

export async function createReceipt(payload, { token, fetchImpl } = {}) {
  return call("/receipts", { token, method: "POST", body: payload, fetchImpl });
}

// pure: order + lineItems + config -> Loyverse POST /receipts payload
export function buildReceiptPayload(order, lineItems, config) {
  const unmapped = lineItems.filter((it) => !it.loyverse_variant_id).map((it) => it.name);
  if (unmapped.length) throw new UnmappedItemError(unmapped);

  const sum = lineItems.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  if (Math.round(sum * 100) !== Math.round(Number(order.total) * 100))
    throw new ReceiptTotalMismatchError(sum, order.total);

  const method = order.payment_method || "cash";
  const ptId = config.paymentTypeMap[method];
  if (!ptId) throw new Error(`ยังไม่ได้ตั้งค่า payment type สำหรับ '${method}'`);

  return {
    store_id: config.storeId,
    receipt_date: order.receipt_date || new Date().toISOString(),
    note: `FoodPOS #${order.order_number}`,
    line_items: lineItems.map((it) => ({
      variant_id: it.loyverse_variant_id,
      quantity: Number(it.qty),
      price: Number(it.price),
      line_note: it.note ?? null,
    })),
    payments: [{ payment_type_id: ptId, money_amount: Number(order.total) }],
  };
}

export function loadConfig(db) {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'loyverse_%'").all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: s.loyverse_enabled === "1",
    token: s.loyverse_token || "",
    storeId: s.loyverse_store_id || "",
    paymentTypeMap: {
      cash: s.loyverse_pt_cash || "",
      qr: s.loyverse_pt_qr || "",
      card: s.loyverse_pt_card || "",
      other: s.loyverse_pt_other || "",
    },
  };
}
