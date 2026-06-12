// ESC/POS receipt builders for Thai thermal printers (58mm or 80mm)
// Uses TIS-620 codepage so Thai prints correctly on most ESC/POS printers.

import { promptPayPayload } from "./promptpay.js";

const ESC = 0x1b;
const GS = 0x1d;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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
  /**
   * Set character mode via a single ESC ! command.
   * @param {boolean} bold     emphasized
   * @param {boolean} doubleW  double width  (wider)
   * @param {boolean} doubleH  double height (taller)
   */
  setMode(bold = false, doubleW = false, doubleH = false) {
    return this.push(
      ESC,
      0x21,
      (bold ? 0x08 : 0) | (doubleW ? 0x20 : 0) | (doubleH ? 0x10 : 0)
    );
  }
  /**
   * Emphasis used for item names / table no. / totals: bold + double-WIDTH
   * (normal height) — short and wide, easy to read without stretching tall.
   */
  tall() {
    return this.setMode(true, true, false);
  }
  /** Reset character size + emphasis set by size()/tall()/setMode (ESC ! 0). */
  normalSize() {
    return this.push(ESC, 0x21, 0x00);
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
  /**
   * Print a QR code using native ESC/POS GS ( k commands (Model 2).
   * Supported by the POS-80 / Epson TM thermal printer families.
   * @param {string} data  payload (URL — ASCII)
   * @param {object} opts
   * @param {number} opts.size  module dot size 1..16 (8 ≈ good for 80mm)
   * @param {string} opts.ecc   "L" | "M" | "Q" | "H"
   */
  qr(data, { size = 8, ecc = "M" } = {}) {
    const enc = [];
    for (const ch of String(data)) {
      const cp = ch.codePointAt(0);
      enc.push(cp < 0x100 ? cp : 0x3f);
    }
    const mod = Math.max(1, Math.min(16, size));
    const eccByte = { L: 48, M: 49, Q: 50, H: 51 }[ecc] ?? 49;
    // Select model 2
    this.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Module (dot) size
    this.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, mod);
    // Error correction level
    this.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, eccByte);
    // Store data in symbol buffer (pL pH = dataLen + 3)
    const len = enc.length + 3;
    this.push(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30);
    for (const bb of enc) this.bytes.push(bb);
    // Print the symbol
    this.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
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

// DD/MM/YYYY HH:MM (24h) — created_at is stored UTC, rendered in server/device local TZ
function fmtDateTime(iso) {
  const d = iso ? new Date(iso.replace(" ", "T") + "Z") : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
  // Aligned "label : value" line (label column padded to a fixed visual width)
  const field = (label, value) => {
    const cols = 12;
    const pad = Math.max(1, cols - tisLen(label));
    b.line(` ${label}${" ".repeat(pad)}: ${value}`);
  };

  // ── Header ──
  const heading = title || "ครัว (KITCHEN)";
  b.hr("=");
  b.align(1).size(true).bold(true).line(`*** ${heading} ***`).size(false).bold(false);
  b.hr("=");

  // ── Order meta ──
  b.align(0);
  const dineIn = !!order.table_number;
  // Table number — enlarged so kitchen staff can read it at a glance
  b.tall().line(` โต๊ะ (TABLE): ${dineIn ? order.table_number : "-"}`).normalSize();
  field("ประเภท", dineIn ? "ทานที่ร้าน (Dine-in)" : "กลับบ้าน (Take-away)");
  b.dashed();
  field("เลขที่บิล", `#${order.order_number || "-"}`);
  field("วันที่-เวลา", fmtDateTime(order.created_at));
  const staff = order.staff_name || order.opened_by_name;
  if (staff) field("พนักงาน", staff);
  if (order.label) field("ป้าย", order.label);

  // ── Items ──
  b.hr("=");
  b.line(" QTY | รายการอาหาร (ITEMS)");
  b.hr("=");
  b.feed(1);
  for (const it of items) {
    const opt =
      it.options && it.options.length
        ? ` (${it.options.map((o) => o.name).join(", ")})`
        : "";
    // Item name + qty — enlarged (double-height, bold) for fast reading
    b.tall().line(` [${it.qty}] ${it.name}${opt}`).normalSize();
    if (it.note) {
      for (const ln of String(it.note).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
        b.bold(true).line(`     ** หมายเหตุ: ${ln}`).bold(false);
      }
    }
    b.feed(1);
  }
  if (items.length === 0) {
    b.align(1).line("(ไม่มีรายการ)").align(0);
  }
  if (order.note) {
    b.dashed();
    b.line(` หมายเหตุรวม: ${order.note}`);
  }

  // ── Footer ──
  b.hr("=");
  b.align(1).bold(true).line("*** สิ้นสุดออเดอร์ ***").bold(false);
  b.hr("=");
  b.cut();
  return b.build();
}

/**
 * Build the customer check bill (ใบแจ้งยอดค่าอาหาร / CHECK BILL) with totals,
 * optional service charge + VAT, and an optional PromptPay "SCAN TO PAY" QR.
 *
 * Service charge / VAT are display-and-compute only — they do NOT change the
 * order.total stored in the DB. When enabled the printed GRAND TOTAL is the
 * amount the customer pays; recorded revenue (reports) still reflects goods.
 */
export function buildFinalReceipt({
  order,
  items,
  storeName = "FoodPOS",
  storePhone = "",
  storeAddress = "",
  storeTaxId = "",
  footer = "ขอบคุณที่ใช้บริการ / THANK YOU",
  serviceChargeRate = 0,
  vatRate = 0,
  vatInclusive = false,
  promptPayId = "",
  paid = null,
  change = null,
  width = 48,
}) {
  const b = new EscPosBuilder({ width });
  const money = (n) =>
    Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const field = (label, value) => {
    const cols = 12;
    const pad = Math.max(1, cols - tisLen(label));
    b.line(` ${label}${" ".repeat(pad)}: ${value}`);
  };
  // label left + amount right-aligned to full width.
  // big = render the amount double-width+bold (2 cells/char) for the grand total,
  // keeping the (long) label at normal size so it never overflows the line.
  const amountRow = (label, value, { big = false } = {}) => {
    const valStr = money(value);
    const leftRaw = ` ${label}`;
    if (big) {
      const valueCells = valStr.length * 2;
      const space = Math.max(1, width - tisLen(leftRaw) - valueCells);
      b.text(leftRaw).text(" ".repeat(space));
      b.setMode(true, true, false).text(valStr).normalSize().feed(1);
    } else {
      const space = Math.max(1, width - tisLen(leftRaw) - valStr.length);
      b.text(leftRaw).text(" ".repeat(space)).line(valStr);
    }
  };

  // ── Header: store identity ──
  b.hr("=");
  b.align(1).size(true).bold(true).line(storeName).size(false).bold(false);
  if (storeAddress) b.line(storeAddress);
  if (storePhone) b.line(`โทร. ${storePhone}`);
  if (storeTaxId) b.line(`TAX ID: ${storeTaxId}`);
  b.hr("=");
  b.align(1).bold(true).line("ใบแจ้งยอดค่าอาหาร / CHECK BILL").bold(false);
  b.hr("=");

  // ── Meta ──
  b.align(0);
  const dineIn = !!order.table_number;
  field("โต๊ะ (TABLE)", dineIn ? order.table_number : "-");
  field("เลขที่บิล", `#${order.order_number || "-"}`);
  field("วันที่-เวลา", fmtDateTime(order.created_at));
  const staff = order.staff_name || order.opened_by_name;
  if (staff) field("พนักงาน", staff);
  if (order.label) field("ป้าย", order.label);

  // ── Items header ──
  b.hr("=");
  {
    const left = " รายการอาหาร (ITEMS)";
    const right = "จำนวน |  ราคา";
    const space = Math.max(1, width - tisLen(left) - tisLen(right));
    b.text(left).text(" ".repeat(space)).line(right);
  }
  b.hr("=");

  // ── Items ──
  for (const it of items) {
    const opt =
      it.options && it.options.length
        ? ` (${it.options.map((o) => o.name).join(", ")})`
        : "";
    const lineTotal = (it.price || 0) * (it.qty || 0);
    const right = String(it.qty || 0).padStart(4) + "   " + money(lineTotal).padStart(9);
    const leftRaw = ` ${it.name}${opt}`;
    const space = Math.max(1, width - tisLen(leftRaw) - right.length);
    b.text(leftRaw).text(" ".repeat(space)).line(right);
  }

  // ── Totals ──
  b.dashed();
  const subtotal = order.subtotal || 0;
  const discount = order.discount || 0;
  const pointsRedeemed = order.points_redeemed || 0;
  const net = Math.max(0, subtotal - discount - pointsRedeemed);

  amountRow("รวมเงิน (Subtotal)", subtotal);
  if (discount > 0) amountRow("ส่วนลด (Discount)", -discount);
  if (pointsRedeemed > 0) amountRow(`ใช้แต้ม (Points ${pointsRedeemed})`, -pointsRedeemed);

  const scRate = Number(serviceChargeRate) || 0;
  const vRate = Number(vatRate) || 0;
  let serviceCharge = 0;
  if (scRate > 0) {
    serviceCharge = round2((net * scRate) / 100);
    amountRow(`Service Charge (${scRate}%)`, serviceCharge);
  }
  const baseForVat = net + serviceCharge;
  let grandTotal = baseForVat;
  if (vRate > 0) {
    if (vatInclusive) {
      const vatAmount = round2((baseForVat * vRate) / (100 + vRate));
      amountRow(`VAT (${vRate}% รวมใน)`, vatAmount);
      grandTotal = baseForVat;
    } else {
      const vatAmount = round2((baseForVat * vRate) / 100);
      amountRow(`VAT (${vRate}%)`, vatAmount);
      grandTotal = round2(baseForVat + vatAmount);
    }
  }

  // ── Grand total ──
  b.hr("=");
  amountRow("ยอดรวมทั้งสิ้น (GRAND TOTAL)", grandTotal, { big: true });
  b.hr("=");
  if (paid != null) amountRow("รับเงิน (Paid)", paid);
  if (change != null) amountRow("เงินทอน (Change)", change);

  // ── PromptPay QR ──
  const payload = promptPayId ? promptPayPayload(promptPayId, grandTotal) : "";
  if (payload) {
    b.feed(1);
    b.align(1).bold(true).line("SCAN TO PAY").bold(false);
    b.align(1).qr(payload, { size: width >= 48 ? 7 : 5, ecc: "M" });
    b.align(0);
  }

  // ── Footer ──
  b.dashed();
  b.align(1);
  if (vRate > 0 && vatInclusive) b.line("* ราคานี้รวมภาษีมูลค่าเพิ่มแล้ว *");
  b.line(footer || "ขอบคุณที่ใช้บริการ / THANK YOU");
  b.feed(1);
  b.cut();
  return b.build();
}

/**
 * Build a per-table "scan to order" QR card for thermal printers (80mm/58mm).
 * Layout:
 *   ===========================
 *           [ชื่อร้าน]
 *   ===========================
 *        โต๊ะที่ / TABLE NO.
 *              [ 09 ]
 *   ===========================
 *         สแกนเพื่อสั่งอาหาร
 *           SCAN TO ORDER
 *            [ QR CODE ]
 *   ===========================
 *          ขั้นตอนการสั่ง
 *     1. สแกน QR Code ด้านบน
 *     2. เลือกเมนูและกดยืนยัน
 *     3. รอรับอาหารที่โต๊ะได้เลย!
 *   ===========================
 *     WIFI: <ssid>
 *     PASS: <password>
 *   ===========================
 *       <footer>
 *   ===========================
 */
export function buildTableQR({
  tableNumber,
  url,
  storeName = "FoodPOS",
  wifiSsid = "",
  wifiPassword = "",
  footer = "ขอให้อร่อยกับมื้อนี้นะครับ :)",
  width = 48,
  qrSize,
} = {}) {
  const b = new EscPosBuilder({ width });
  const size = qrSize || (width >= 48 ? 8 : 5);

  // Header — store name
  b.hr("=");
  b.align(1).size(true).bold(true).line(storeName).size(false).bold(false);

  // Table number
  b.hr("=");
  b.align(1).line("โต๊ะที่ / TABLE NO.");
  b.size(true).bold(true).line(String(tableNumber)).size(false).bold(false);

  // QR
  b.hr("=");
  b.align(1).bold(true).line("สแกนเพื่อสั่งอาหาร").bold(false);
  b.line("SCAN TO ORDER");
  b.feed(1);
  b.align(1).qr(url, { size, ecc: "M" });
  b.feed(1);

  // How-to
  b.hr("=");
  b.align(0).bold(true).line("ขั้นตอนการสั่ง").bold(false);
  b.line("1. สแกน QR Code ด้านบน");
  b.line("2. เลือกเมนูและกดยืนยัน");
  b.line("3. รอรับอาหารที่โต๊ะได้เลย!");

  // Wi-Fi
  if (wifiSsid) {
    b.hr("=");
    b.align(0).line(`WIFI: ${wifiSsid}`);
    if (wifiPassword) b.line(`PASS: ${wifiPassword}`);
  }

  // Footer
  b.hr("=");
  b.align(1).line(footer || "ขอบคุณที่ใช้บริการครับ");
  b.cut();
  return b.build();
}

export { encodeTIS620, EscPosBuilder };
