import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";
import { loadConfig, testConnection, listItems, listPaymentTypes } from "../lib/loyverse.js";
import { syncOrderToLoyverse } from "../lib/loyverseSync.js";

const r = Router();

r.get("/status", adminRequired, async (req, res) => {
  const cfg = loadConfig(db);
  if (!cfg.token) return res.json({ ok: false, error: "ยังไม่ได้ตั้งค่า token" });
  const out = await testConnection({ token: cfg.token });
  res.json({ ...out, enabled: cfg.enabled, storeId: cfg.storeId });
});

r.get("/payment-types", adminRequired, async (req, res) => {
  const cfg = loadConfig(db);
  try {
    res.json(await listPaymentTypes({ token: cfg.token }));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

r.get("/items", adminRequired, async (req, res) => {
  const cfg = loadConfig(db);
  try {
    const { items, cursor } = await listItems({ token: cfg.token, cursor: req.query.cursor });
    const variants = items.flatMap((it) =>
      (it.variants || []).map((v) => ({
        variant_id: v.variant_id,
        item_name: it.item_name,
        sku: v.sku,
        price: v.default_price,
      }))
    );
    res.json({ variants, cursor });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

r.get("/sync-log", adminRequired, (req, res) => {
  const status = req.query.status;
  const rows = status
    ? db.prepare("SELECT * FROM loyverse_sync_log WHERE status=? ORDER BY updated_at DESC LIMIT 100").all(status)
    : db.prepare("SELECT * FROM loyverse_sync_log ORDER BY updated_at DESC LIMIT 100").all();
  res.json(rows);
});

r.post("/sync/:orderId", adminRequired, async (req, res) => {
  await syncOrderToLoyverse(Number(req.params.orderId));
  const log = db.prepare("SELECT * FROM loyverse_sync_log WHERE order_id=?").get(Number(req.params.orderId));
  res.json(log || { ok: false });
});

export default r;
