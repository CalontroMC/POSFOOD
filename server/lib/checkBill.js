// Server-side check-bill printing.
// Triggered when a customer taps "เรียกเช็คบิล" from the QR order page — the
// browser there cannot reach a network/local printer, so the server builds and
// dispatches the bill itself (mirrors printerJob.js for kitchen tickets).

import db from "../db.js";
import { buildFinalReceipt } from "../../src/lib/escpos.js";
import { printRawToConfigured } from "./printerJob.js";

function loadSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Most-recent open order for a table (mirrors how staff close/print the bill).
function loadOpenOrderForTable(tableId) {
  const order = db
    .prepare(
      `SELECT o.*, t.table_number, sh.opened_by_name AS staff_name
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN shifts sh ON sh.id = o.shift_id
       WHERE o.table_id = ? AND o.status NOT IN ('เสร็จสิ้น','ยกเลิก','พักบิล')
       ORDER BY o.id DESC LIMIT 1`
    )
    .get(tableId);
  if (!order) return null;
  const items = db
    .prepare(
      "SELECT id, menu_item_id, name, price, qty, note, options_json FROM order_items WHERE order_id = ?"
    )
    .all(order.id);
  return {
    ...order,
    items: items.map((it) => ({
      ...it,
      options: it.options_json ? JSON.parse(it.options_json) : [],
    })),
  };
}

/**
 * Build + print the check bill for a table's open order to the configured
 * printer. Never throws — returns a {skipped|ok|error} result for logging.
 */
export async function printCheckBillForTable(tableId) {
  try {
    const s = loadSettings();
    if (s.printer_enabled !== "1") return { skipped: "printer disabled" };
    if (s.auto_print === "0") return { skipped: "auto_print off" };

    const order = loadOpenOrderForTable(tableId);
    if (!order) return { skipped: "no open order" };

    const bytes = buildFinalReceipt({
      order,
      items: order.items,
      storeName: s.store_name || "FoodPOS",
      storePhone: s.store_phone || "",
      storeAddress: s.store_address || "",
      storeTaxId: s.store_tax_id || "",
      footer: s.receipt_footer || "ขอบคุณที่ใช้บริการ / THANK YOU",
      serviceChargeRate: Number(s.service_charge_rate) || 0,
      vatRate: Number(s.vat_rate) || 0,
      vatInclusive: s.vat_inclusive === "1",
      roundingRule: s.rounding_rule || "none",
      promptPayId: s.promptpay_id || "",
      width: Number(s.printer_width) || 48,
    });

    return await printRawToConfigured(bytes);
  } catch (e) {
    return { error: e.message };
  }
}
