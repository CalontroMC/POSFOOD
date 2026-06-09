import realDb from "../db.js";
import { loadConfig, buildReceiptPayload, createReceipt } from "./loyverse.js";

const upsertLog = (db) => db.prepare(`
  INSERT INTO loyverse_sync_log (order_id, status, attempts, updated_at)
  VALUES (?, 'pending', 1, datetime('now'))
  ON CONFLICT(order_id) DO UPDATE SET attempts = attempts + 1, status='pending', updated_at=datetime('now')
`);

const finishLog = (db) => db.prepare(`
  UPDATE loyverse_sync_log
  SET status=?, receipt_number=?, error=?, payload_json=?, updated_at=datetime('now')
  WHERE order_id=?
`);

// SQLite datetime('now') is UTC, space-separated, no zone -> ISO8601
function sqliteUtcToIso(s) {
  if (!s) return new Date().toISOString();
  const d = new Date(s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function syncOrderToLoyverse(orderId, { db = realDb, fetchImpl } = {}) {
  try {
    const cfg = loadConfig(db);
    if (!cfg.enabled) return;

    // idempotency: already-synced order is never re-posted
    const prev = db.prepare("SELECT status FROM loyverse_sync_log WHERE order_id=?").get(orderId);
    if (prev && prev.status === "ok") return;

    const order = db.prepare(
      "SELECT id, order_number, payment_method, total, discount, points_redeemed FROM orders WHERE id=?"
    ).get(orderId);
    if (!order) return;

    const items = db.prepare(`
      SELECT oi.name, oi.price, oi.qty, oi.note, mi.loyverse_variant_id
      FROM order_items oi
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = ?
    `).all(orderId);

    upsertLog(db).run(orderId);

    // canonical bill-close time = first sync_log creation (preserved across retries)
    const logRow = db.prepare("SELECT created_at FROM loyverse_sync_log WHERE order_id=?").get(orderId);
    const receiptDate = sqliteUtcToIso(logRow && logRow.created_at);

    let payload = null;
    try {
      payload = buildReceiptPayload(
        { ...order, receipt_date: receiptDate },
        items,
        { storeId: cfg.storeId, paymentTypeMap: cfg.paymentTypeMap }
      );
      const out = await createReceipt(payload, { token: cfg.token, fetchImpl });
      finishLog(db).run("ok", out.receipt_number || null, null, JSON.stringify(payload), orderId);
    } catch (e) {
      finishLog(db).run("failed", null, e.message, payload ? JSON.stringify(payload) : null, orderId);
    }
  } catch (outer) {
    // DB/config itself is in a bad state — best effort log, never re-throw
    try {
      db.prepare(
        "UPDATE loyverse_sync_log SET status='failed', error=?, updated_at=datetime('now') WHERE order_id=?"
      ).run(String(outer && outer.message || outer), orderId);
    } catch { /* nothing more we can do */ }
  }
}
