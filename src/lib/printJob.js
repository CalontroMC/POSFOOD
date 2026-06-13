// Print job dispatcher.
// Picks the right transport based on user's configured printer_type:
//   rawbt   → client (Android URL scheme, for SUNMI Inner Printer etc.)
//   browser → client (window.print() via iframe, with HTML receipt)
//   network → server (TCP ESC/POS port 9100)
//   local   → server (Windows installed printer, plain text)

import { apiGet, apiPost } from "./api.js";
import { printViaRawBT, browserPrintHtml } from "./browserPrint.js";
import {
  buildOrderTicket,
  buildFinalReceipt,
} from "./escpos.js";

function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Cache settings briefly so we don't refetch on every print
let _settingsCache = null;
let _settingsAt = 0;
async function getSettings(force = false) {
  if (!force && _settingsCache && Date.now() - _settingsAt < 60_000) return _settingsCache;
  try {
    _settingsCache = await apiGet("/settings", { auth: false });
    _settingsAt = Date.now();
  } catch {
    _settingsCache = null;
  }
  return _settingsCache;
}
export function invalidatePrintSettings() {
  _settingsCache = null;
}

// HTML version (for browser printers) — mirrors the ESC/POS layout
function htmlReceipt({ title, body }) {
  return `<div class="receipt">${title ? `<div class="center lg">${escapeHtml(title)}</div><hr>` : ""}${body}</div>`;
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function fmtTime(iso) {
  const d = iso ? new Date(iso.replace(" ", "T") + "Z") : new Date();
  return d.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function htmlOrderTicket({ title, order, items }) {
  const rows = items
    .map((it) => {
      const opts = it.options?.length
        ? `<div class="muted">- ${escapeHtml(it.options.map((o) => o.name).join(", "))}</div>`
        : "";
      const note = it.note ? `<div class="muted">* ${escapeHtml(it.note)}</div>` : "";
      return `<div class="b">${escapeHtml(it.name)} × ${it.qty}</div>${opts}${note}`;
    })
    .join("");
  return `
<div class="receipt">
  <div class="center lg">${escapeHtml(title)}</div>
  <div class="center b">${escapeHtml(order.order_number || "")}</div>
  <hr>
  <table><tbody>
    <tr><td>ที่นั่ง</td><td class="right">${
      order.table_number ? `โต๊ะ ${escapeHtml(order.table_number)}` : "ซื้อกลับบ้าน"
    }</td></tr>
    ${order.label ? `<tr><td>ป้าย</td><td class="right">${escapeHtml(order.label)}</td></tr>` : ""}
    <tr><td>เวลา</td><td class="right">${escapeHtml(fmtTime(order.created_at))}</td></tr>
  </tbody></table>
  <hr>
  ${rows || '<div class="center muted">(ไม่มีรายการ)</div>'}
  ${order.note ? `<hr><div>หมายเหตุ: ${escapeHtml(order.note)}</div>` : ""}
  <hr>
  <div class="center muted">- - - END - - -</div>
</div>`;
}

function htmlFinalReceipt({ order, items, store, paid, change }) {
  const rows = items
    .map((it) => {
      const lineTotal = (it.price || 0) * (it.qty || 0);
      const opts = it.options?.length
        ? `<div class="muted">${escapeHtml(it.options.map((o) => o.name).join(", "))}</div>`
        : "";
      return `
        <tr>
          <td>${escapeHtml(it.name)} × ${it.qty}${opts}</td>
          <td class="right b">฿${lineTotal}</td>
        </tr>`;
    })
    .join("");
  const pmName = {
    cash: "เงินสด",
    qr: "QR PromptPay",
    card: "บัตรเครดิต",
    other: "อื่นๆ",
  }[order.payment_method] || order.payment_method || "";

  return `
<div class="receipt">
  <div class="center lg">${escapeHtml(store.store_name || "FoodPOS")}</div>
  ${store.store_address ? `<div class="center muted">${escapeHtml(store.store_address)}</div>` : ""}
  ${store.store_phone ? `<div class="center muted">โทร ${escapeHtml(store.store_phone)}</div>` : ""}
  <hr>
  <table><tbody>
    <tr><td>เลขที่</td><td class="right">${escapeHtml(order.order_number || "")}</td></tr>
    <tr><td>ที่นั่ง</td><td class="right">${
      order.table_number ? `โต๊ะ ${escapeHtml(order.table_number)}` : "ซื้อกลับบ้าน"
    }</td></tr>
    ${order.label ? `<tr><td>ป้าย</td><td class="right">${escapeHtml(order.label)}</td></tr>` : ""}
    <tr><td>เวลา</td><td class="right">${escapeHtml(fmtTime(order.created_at))}</td></tr>
  </tbody></table>
  <hr>
  <table><tbody>${rows}</tbody></table>
  <hr>
  <table><tbody>
    <tr><td>ยอดรวม</td><td class="right">฿${order.subtotal || 0}</td></tr>
    ${(order.discount || 0) > 0 ? `<tr><td>ส่วนลด</td><td class="right">-฿${order.discount}</td></tr>` : ""}
    <tr class="b"><td>สุทธิ</td><td class="right">฿${order.total || 0}</td></tr>
    ${pmName ? `<tr><td>ชำระโดย</td><td class="right">${escapeHtml(pmName)}</td></tr>` : ""}
    ${paid != null ? `<tr><td>รับเงิน</td><td class="right">฿${paid}</td></tr>` : ""}
    ${change != null ? `<tr><td>เงินทอน</td><td class="right">฿${change}</td></tr>` : ""}
  </tbody></table>
  <hr>
  <div class="center">${escapeHtml(store.receipt_footer || "ขอบคุณที่ใช้บริการครับ")}</div>
  <div class="center muted">Powered by FoodPOS</div>
</div>`;
}

// ============================================================
// Dispatcher
// ============================================================

async function dispatch({ escposBytes, htmlFallback, settings, jobLabel, station }) {
  const enabled = settings.printer_enabled === "1";
  if (!enabled) return { skipped: true, reason: "เครื่องพิมพ์ปิดอยู่ใน Settings" };
  const type = settings.printer_type || "network";

  try {
    if (type === "rawbt") {
      printViaRawBT(escposBytes);
      return { ok: true, type };
    }
    if (type === "browser") {
      if (!htmlFallback) return { skipped: true, reason: "ไม่มี HTML version" };
      await browserPrintHtml(htmlFallback, { title: jobLabel || "Print" });
      return { ok: true, type };
    }
    if (type === "network") {
      let targetIp = settings.printer_ip;
      if (station === "kitchen" && settings.printer_kitchen_ip) {
        targetIp = settings.printer_kitchen_ip;
      } else if (station === "bar" && settings.printer_bar_ip) {
        targetIp = settings.printer_bar_ip;
      }
      
      if (!targetIp) return { skipped: true, reason: "ยังไม่ตั้ง IP สำหรับจุดนี้" };
      
      await apiPost("/printers/print", {
        type: "network",
        ip: targetIp,
        port: Number(settings.printer_port) || 9100,
        data_base64: bytesToBase64(escposBytes),
      });
      return { ok: true, type, ip: targetIp };
    }
    if (type === "local") {
      if (!settings.printer_name) return { skipped: true, reason: "ยังไม่ตั้งชื่อ printer" };
      // Server route /printers/print writes raw ESC/POS bytes to the Windows
      // print queue via winspool's RawPrinter helper — supports Thai TIS-620,
      // formatting, and cut commands. Browser fallback only if server fails.
      try {
        await apiPost("/printers/print", {
          type: "local",
          name: settings.printer_name,
          data_base64: bytesToBase64(escposBytes),
        });
        return { ok: true, type };
      } catch (e) {
        if (htmlFallback) {
          await browserPrintHtml(htmlFallback, { title: jobLabel || "Print" });
          return { ok: true, type: "local-via-browser", fallbackReason: e.message };
        }
        throw e;
      }
    }
    return { skipped: true, reason: `unknown printer_type=${type}` };
  } catch (e) {
    console.warn("[printJob] dispatch failed:", e);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// Public actions
// ============================================================

function splitItems(items, menuItems) {
  const kitchen = new Map();
  for (const m of menuItems) kitchen.set(m.id, !!m.kitchen);
  const food = [];
  const drinks = [];
  for (const it of items) {
    const isFood = !it.menu_item_id || kitchen.get(it.menu_item_id);
    if (isFood) food.push(it);
    else drinks.push(it);
  }
  return { food, drinks };
}

/**
 * Print kitchen + bar tickets for a freshly-confirmed order.
 * Skips a ticket if there are no items for that station.
 */
export async function printOrderTickets(order, items, { menuItems, settings } = {}) {
  if (!order || !Array.isArray(items)) return { skipped: true, reason: "missing order" };
  if (!settings) settings = await getSettings();
  if (!settings) return { skipped: true, reason: "no settings" };
  if (!Array.isArray(menuItems)) {
    try {
      menuItems = await apiGet("/menu/items", { auth: false });
    } catch {
      menuItems = [];
    }
  }
  const { food, drinks } = splitItems(items, menuItems);
  // Receipt width in chars: 32 = 58mm paper, 48 = 80mm paper
  const width = Number(settings.printer_width) || 48;

  const results = [];
  if (food.length > 0) {
    const bytes = buildOrderTicket({ title: "ครัว (KITCHEN)", order, items: food, width });
    const html = htmlOrderTicket({ title: "ครัว (KITCHEN)", order, items: food });
    results.push({
      station: "kitchen",
      ...(await dispatch({ escposBytes: bytes, htmlFallback: html, settings, jobLabel: "Kitchen", station: "kitchen" })),
    });
  }
  if (drinks.length > 0) {
    const bytes = buildOrderTicket({ title: "บาร์ (BAR)", order, items: drinks, width });
    const html = htmlOrderTicket({ title: "บาร์ (BAR)", order, items: drinks });
    results.push({
      station: "bar",
      ...(await dispatch({ escposBytes: bytes, htmlFallback: html, settings, jobLabel: "Bar", station: "bar" })),
    });
  }
  return { ok: true, results };
}

/**
 * Print the final receipt when order is closed (paid).
 */
export async function printFinalReceipt(order, items, { settings, paid, change } = {}) {
  if (!settings) settings = await getSettings();
  if (!settings) return { skipped: true, reason: "no settings" };
  const bytes = buildFinalReceipt({
    order,
    items,
    storeName: settings.store_name || "FoodPOS",
    storePhone: settings.store_phone,
    storeAddress: settings.store_address,
    storeTaxId: settings.store_tax_id,
    footer: settings.receipt_footer,
    serviceChargeRate: Number(settings.service_charge_rate) || 0,
    vatRate: Number(settings.vat_rate) || 0,
    vatInclusive: settings.vat_inclusive === "1",
    roundingRule: settings.rounding_rule || "none",
    promptPayId: settings.promptpay_id || "",
    paid,
    change,
    width: Number(settings.printer_width) || 48,
  });
  const html = htmlFinalReceipt({
    order,
    items,
    store: settings,
    paid,
    change,
  });
  return await dispatch({
    escposBytes: bytes,
    htmlFallback: html,
    settings,
    jobLabel: `Receipt ${order.order_number || ""}`,
  });
}

export function autoPrintEnabled(settings) {
  if (!settings) return false;
  return settings.auto_print !== "0";
}
