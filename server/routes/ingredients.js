import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

r.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT i.id, i.name, i.unit, i.quantity, i.threshold, i.cost_per_unit,
              CASE WHEN i.quantity <= i.threshold THEN 1 ELSE 0 END AS low
       FROM ingredients i
       ORDER BY low DESC, i.name`
    )
    .all();
  res.json(rows.map((r) => ({ ...r, low: !!r.low })));
});

r.get("/low", (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, unit, quantity, threshold FROM ingredients
       WHERE quantity <= threshold ORDER BY (quantity - threshold), name`
    )
    .all();
  res.json(rows);
});

r.post("/", adminRequired, (req, res) => {
  const { name, unit = "หน่วย", quantity = 0, threshold = 0, cost_per_unit = null } =
    req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const info = db
    .prepare(
      "INSERT INTO ingredients (name, unit, quantity, threshold, cost_per_unit) VALUES (?, ?, ?, ?, ?)"
    )
    .run(name, unit, Number(quantity) || 0, Number(threshold) || 0, cost_per_unit);
  res.json({ id: info.lastInsertRowid });
});

r.patch("/:id", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const fields = ["name", "unit", "quantity", "threshold", "cost_per_unit"];
  const sets = [];
  const vals = [];
  for (const f of fields) {
    if (req.body && f in req.body) {
      sets.push(`${f} = ?`);
      vals.push(req.body[f]);
    }
  }
  if (sets.length === 0) return res.json({ ok: true });
  vals.push(id);
  db.prepare(`UPDATE ingredients SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

r.delete("/:id", adminRequired, (req, res) => {
  db.prepare("DELETE FROM ingredients WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

r.post("/:id/adjust", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { delta, reason } = req.body || {};
  const d = Number(delta);
  if (!Number.isFinite(d) || d === 0)
    return res.status(400).json({ error: "delta required" });
  db.transaction(() => {
    db.prepare("UPDATE ingredients SET quantity = quantity + ? WHERE id = ?").run(d, id);
    db.prepare(
      "INSERT INTO stock_movements (ingredient_id, delta, reason) VALUES (?, ?, ?)"
    ).run(id, d, reason || (d > 0 ? "เพิ่มสต็อก" : "ลดสต็อก"));
  })();
  res.json({ ok: true });
});

r.get("/:id/movements", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const rows = db
    .prepare(
      "SELECT id, delta, reason, ref_order_id, created_at FROM stock_movements WHERE ingredient_id = ? ORDER BY id DESC LIMIT 100"
    )
    .all(id);
  res.json(rows);
});

export default r;
