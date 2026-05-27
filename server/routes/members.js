import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

r.get("/", adminRequired, (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, name, phone, points, spending, visits FROM members ORDER BY id DESC"
    )
    .all();
  res.json(rows);
});

r.get("/lookup", (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: "phone required" });
  const row = db.prepare("SELECT id, name, phone, points FROM members WHERE phone = ?").get(phone);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

r.post("/", (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !phone)
    return res.status(400).json({ error: "name and phone required" });
  try {
    const info = db
      .prepare("INSERT INTO members (name, phone) VALUES (?, ?)")
      .run(name, phone);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.patch("/:id", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const fields = ["name", "phone", "points", "spending", "visits"];
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
  db.prepare(`UPDATE members SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

r.delete("/:id", adminRequired, (req, res) => {
  db.prepare("DELETE FROM members WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

r.get("/:id/history", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const member = db
    .prepare(
      "SELECT id, name, phone, email, points, spending, visits, created_at FROM members WHERE id = ?"
    )
    .get(id);
  if (!member) return res.status(404).json({ error: "not found" });
  const orders = db
    .prepare(
      `SELECT o.id, o.order_number, o.created_at, o.status, o.total, o.discount,
              o.payment_method, t.table_number
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.member_id = ? AND o.status != 'พักบิล'
       ORDER BY o.id DESC LIMIT 100`
    )
    .all(id);
  // Top items for this member
  const top_items = db
    .prepare(
      `SELECT oi.name, SUM(oi.qty) AS qty
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.member_id = ? AND o.status = 'เสร็จสิ้น'
       GROUP BY oi.name ORDER BY qty DESC LIMIT 5`
    )
    .all(id);
  res.json({ member, orders, top_items });
});

export default r;
