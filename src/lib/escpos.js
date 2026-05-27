// ESC/POS receipt builders for Thai thermal printers (58mm or 80mm)
// Uses TIS-620 codepage so Thai prints correctly on most ESC/POS printers.

const ESC = 0x1b;
const GS = 0x1d;

// Thai (U+0E00..U+0E7F) → TIS-620 byte (0xA0..0xFF)
function encodeTIS620(text) {
  const out = [];
  for (const ch of String(text || "")) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x0e00 && cp <= 0x0e7f) {
      out.push(cp - 0x0e00 + 0xa0);
    } else if (cp < 0x80) {
      out.push(cp);
    } else {
      out.push(0x3f); // ?
    }
  }
  return out;
}

function tisLen(text) {
  // Each Thai char in TIS-620 takes 1 byte, but visually most thai chars take 1 column except combining marks
  // Approximate: combining marks (above/below) don't add width.
  let n = 0;
  for (const ch of String(text || "")) {
    const cp = ch.codePointAt(0);
    // Thai combining: 0E31, 0E34..0E3A, 0E47..0E4E
    if (
      cp === 0x0e31 ||
      (cp >= 0x0e34 && cp <= 0x0e3a) ||
      (cp >= 0x0e47 && cp <= 0x0e4e)
    ) {
      // combining — no width
      continue;
    }
    n += 1;
  }
  return n;
}

class EscPosBuilder {
  constructor({ width = 32 } = {}) {
    this.bytes = [];
    this.width = width; // chars per line: 32 (58mm) or 48 (80mm)
    this.init();
  }
  push(...bs) {
    for (const b of bs) this.bytes.push(b);
    return this;
  }
  init() {
    // ESC @       reset state
    // ESC t 0xFF  select codepage 255 (Thai on this Chinese OEM POS-80 family;
    //             Epson std codepage table doesn't apply — discovered via probe).
    //             Bytes still encoded as TIS-620 mapping (0xA0..0xFF range).
    return this.push(ESC, 0x40).push(ESC, 0x74, 0xff);
  }
  align(a) {
    // 0=left,1=center,2=right
    return this.push(ESC, 0x61, a);
  }
  size(big = false) {
    return this.push(ESC, 0x21, big ? 0x30 : 0x00);
  }
  bold(on = true) {
    return this.push(ESC, 0x45, on ? 1 : 0);
  }
  feed(n = 1) {
    for (let i = 0; i < n; i++) this.bytes.push(0x0a);
    return this;
  }
  text(s) {
    for (const b of encodeTIS620(s)) this.bytes.push(b);
    return this;
  }
  line(s = "") {
    return this.text(s).feed(1);
  }
  hr(ch = "-") {
    return this.line(ch.repeat(this.width));
  }
  dashed() {
    return this.hr("-");
  }
  /** Right-align value within width, prefix with label (truncates label if needed). */
  kv(label, value) {
    const valStr = String(value);
    const valLen = tisLen(valStr);
    const labLen = tisLen(label);
    const spaces = Math.max(1, this.width - labLen - valLen);
    return this.text(label).text(" ".repeat(spaces)).line(valStr);
  }
  /** A line with item name + qty + price */
  itemLine({ name, qty, total }) {
    // First line: name x qty   (right-aligned ฿total if provided)
    const qtyStr = qty != null ? ` x${qty}` : "";
    const leftRaw = name + qtyStr;
    if (total != null) {
      const right = `฿${total}`;
      const space = Math.max(1, this.width - tisLen(leftRaw) - tisLen(right));
      this.text(leftRaw).text(" ".repeat(space)).line(right);
    } else {
      this.line(leftRaw);
    }
    return this;
  }
  cut() {
    return this.feed(3).push(GS, 0x56, 0x00);
  }
  build() {
    return new Uint8Array(this.bytes);
  }
}

// ============================================================
// Receipt builders
// ============================================================

function fmtTime(iso) {
  const d = iso ? new Date(iso.replace(" ", "T") + "Z") : new Date();
  return d.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Build a kitchen / bar ticket — no prices, just items + qty + notes.
 *  @param {object} opts
 *  @param {string} opts.title  — "ใบสั่งครัว" or "ใบสั่งบาร์"
 *  @param {object} opts.order  — order object with order_number, table_number, label, created_at
 *  @param {Array} opts.items   — array of order items with name, qty, options, note
 *  @param {number} opts.width  — printer width chars (default 32)
 */
export function buildOrderTicket({ title, order, items, width = 32 }) {
  const b = new EscPosBuilder({ width });
  b.align(1).size(true).bold(true).line(title);
  b.size(false).bold(false);
  b.line(order.order_number || "");
  b.hr("=");
  b.align(0);
  const where = order.table_number ? `โต๊ะ ${order.table_number}` : "ซื้อกลับบ้าน";
  b.kv("ที่นั่ง", where);
  if (order.label) b.kv("ป้าย", order.label);
  b.kv("เวลา", fmtTime(order.created_at));
  b.dashed();

  for (const it of items) {
    b.bold(true).itemLine({ name: it.name, qty: it.qty }).bold(false);
    if (it.options && it.options.length) {
      b.line("  - " + it.options.map((o) => o.name).join(", "));
    }
    if (it.note) b.line(`  * ${it.note}`);
  }
  if (items.length === 0) {
    b.align(1).line("(ไม่มีรายการ)").align(0);
  }
  if (order.note) {
    b.dashed();
    b.line(`หมายเหตุ: ${order.note}`);
  }
  b.feed(1).align(1).line("- - - - - END - - - - -").cut();
  return b.build();
}

/**
 * Build the final receipt with totals + payment.
 */
export function buildFinalReceipt({
  order,
  items,
  storeName = "FoodPOS",
  storePhone = "",
  storeAddress = "",
  footer = "ขอบคุณที่ใช้บริการครับ",
  paid = null,
  change = null,
  width = 32,
}) {
  const b = new EscPosBuilder({ width });
  b.align(1).size(true).bold(true).line(storeName);
  b.size(false).bold(false);
  if (storeAddress) b.line(storeAddress);
  if (storePhone) b.line(`โทร ${storePhone}`);
  b.hr("=");
  b.align(0);
  b.kv("เลขที่", order.order_number || "");
  const where = order.table_number ? `โต๊ะ ${order.table_number}` : "ซื้อกลับบ้าน";
  b.kv("ที่นั่ง", where);
  if (order.label) b.kv("ป้าย", order.label);
  b.kv("เวลา", fmtTime(order.created_at));
  b.dashed();

  for (const it of items) {
    const lineTotal = (it.price || 0) * (it.qty || 0);
    b.itemLine({ name: it.name, qty: it.qty, total: lineTotal });
    if (it.options && it.options.length) {
      b.line("  " + it.options.map((o) => o.name).join(", "));
    }
  }

  b.dashed();
  b.kv("ยอดรวม", `฿${order.subtotal || 0}`);
  if ((order.discount || 0) > 0) {
    b.kv("ส่วนลด", `-฿${order.discount}`);
  }
  if ((order.points_redeemed || 0) > 0) {
    b.kv(`ใช้แต้ม (${order.points_redeemed})`, `-฿${order.points_redeemed}`);
  }
  b.bold(true).kv("สุทธิ", `฿${order.total || 0}`).bold(false);
  if (order.payment_method) {
    const pmName = {
      cash: "เงินสด",
      qr: "QR PromptPay",
      card: "บัตรเครดิต",
      other: "อื่นๆ",
    }[order.payment_method] || order.payment_method;
    b.kv("ชำระโดย", pmName);
  }
  if (paid != null) b.kv("รับเงิน", `฿${paid}`);
  if (change != null) b.kv("เงินทอน", `฿${change}`);

  b.dashed();
  b.align(1).line(footer);
  b.line("Powered by FoodPOS").feed(1);
  b.cut();
  return b.build();
}

export { encodeTIS620, EscPosBuilder };
