import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

r.get("/", (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const obj = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  delete obj.admin_pin;
  // อย่าส่ง token ออก client — แทนด้วย flag ว่ามีค่าตั้งไว้แล้วหรือยัง
  obj.loyverse_token_set = obj.loyverse_token ? "1" : "0";
  delete obj.loyverse_token;
  res.json(obj);
});

r.put("/", adminRequired, (req, res) => {
  const body = req.body || {};
  const ins = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) ins.run(k, String(v ?? ""));
  });
  tx(Object.entries(body));
  res.json({ ok: true });
});

r.put("/pin", adminRequired, (req, res) => {
  const { pin } = req.body || {};
  if (!/^\d{4}$/.test(String(pin || "")))
    return res.status(400).json({ error: "pin must be 4 digits" });
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('admin_pin', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(String(pin));
  res.json({ ok: true });
});

// Factory reset — wipe operational + (optionally) master data
// Body: {
//   confirm: 'ลบทั้งหมด',  // must match exactly
//   scopes: {
//     transactions: true,   // orders, items, shifts, drops, stock movements, clock events
//     resetMemberStats: true,  // members.points/spending/visits → 0 (keep records)
//     menu: false,          // delete menu items + categories + option groups + options + recipes
//     tables: false,        // delete tables
//     members: false,       // delete members
//     employees: false,     // delete employees
//     ingredients: false,   // delete ingredients
//   }
// }
r.post("/factory-reset", adminRequired, (req, res) => {
  const { confirm, scopes } = req.body || {};
  if (confirm !== "ลบทั้งหมด") {
    return res.status(400).json({ error: "ต้องพิมพ์ 'ลบทั้งหมด' เพื่อยืนยัน" });
  }
  const s = scopes || {};
  const summary = {};

  db.transaction(() => {
    if (s.transactions !== false) {
      summary.order_items = db.prepare("DELETE FROM order_items").run().changes;
      summary.orders = db.prepare("DELETE FROM orders").run().changes;
      summary.cash_drops = db.prepare("DELETE FROM cash_drops").run().changes;
      summary.shifts = db.prepare("DELETE FROM shifts").run().changes;
      summary.stock_movements = db.prepare("DELETE FROM stock_movements").run().changes;
      summary.clock_events = db.prepare("DELETE FROM clock_events").run().changes;
      // Reset all tables' status to 'ว่าง'
      db.prepare("UPDATE tables SET status = 'ว่าง'").run();
    }
    if (s.resetMemberStats) {
      summary.member_stats_reset = db
        .prepare("UPDATE members SET points = 0, spending = 0, visits = 0")
        .run().changes;
    }
    if (s.menu) {
      summary.menu_options = db.prepare("DELETE FROM menu_options").run().changes;
      summary.menu_option_groups = db.prepare("DELETE FROM menu_option_groups").run().changes;
      summary.recipes = db.prepare("DELETE FROM recipes").run().changes;
      summary.menu_items = db.prepare("DELETE FROM menu_items").run().changes;
      summary.categories = db.prepare("DELETE FROM categories").run().changes;
    }
    if (s.tables) {
      summary.tables = db.prepare("DELETE FROM tables").run().changes;
    }
    if (s.members) {
      summary.members = db.prepare("DELETE FROM members").run().changes;
    }
    if (s.employees) {
      summary.employees = db.prepare("DELETE FROM employees").run().changes;
    }
    if (s.ingredients) {
      summary.ingredients = db.prepare("DELETE FROM ingredients").run().changes;
    }
  })();

  // Reclaim space (outside transaction)
  try { db.prepare("VACUUM").run(); } catch {}

  res.json({ ok: true, summary });
});

export default r;
