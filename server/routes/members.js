import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

r.get("/", adminRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.id, m.name, m.phone, m.points, m.spending, m.visits, m.tier_id, m.dob, m.tags, t.name as tier_name, t.discount_percent
       FROM members m
       LEFT JOIN member_tiers t ON t.id = m.tier_id
       ORDER BY m.id DESC`
    )
    .all();
  res.json(rows);
});
r.get("/stats", adminRequired, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as c FROM members").get().c;
  
  // Members by tier
  const byTier = db.prepare(`
    SELECT t.name as tier_name, COUNT(m.id) as count
    FROM members m
    LEFT JOIN member_tiers t ON t.id = m.tier_id
    GROUP BY m.tier_id
  `).all();

  // Active this month (based on visits, assume simple heuristic or just recent order_status_log but here we just check if they have orders this month)
  const activeThisMonth = db.prepare(`
    SELECT COUNT(DISTINCT member_id) as c
    FROM orders
    WHERE member_id IS NOT NULL 
      AND created_at >= date('now', 'start of month')
  `).get().c;

  res.json({ total, byTier, activeThisMonth });
});

r.get("/lookup", (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: "phone required" });
  const row = db.prepare(`
    SELECT m.id, m.name, m.phone, m.points, t.discount_percent, t.name as tier_name
    FROM members m
    LEFT JOIN member_tiers t ON t.id = m.tier_id
    WHERE m.phone = ?
  `).get(phone);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

r.get("/me/history", (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: "phone required" });
  
  const member = db.prepare("SELECT id FROM members WHERE phone = ?").get(phone);
  if (!member) return res.status(404).json({ error: "not found" });
  
  const orders = db.prepare(`
    SELECT o.id, o.order_number, o.created_at, o.status, o.total, t.table_number
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    WHERE o.member_id = ? AND o.status != 'พักบิล'
    ORDER BY o.id DESC LIMIT 10
  `).all(member.id);
  
  const orderIds = orders.map((o) => o.id);
  let items = [];
  if (orderIds.length > 0) {
    items = db.prepare(`
      SELECT order_id, name, qty, price 
      FROM order_items 
      WHERE order_id IN (${orderIds.map(() => "?").join(",")})
    `).all(...orderIds);
  }
  
  orders.forEach((o) => {
    o.items = items.filter((it) => it.order_id === o.id);
  });

  const pastItemIds = db.prepare(`
    SELECT DISTINCT oi.menu_item_id
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.member_id = ? AND oi.menu_item_id IS NOT NULL
  `).all(member.id).map((r) => r.menu_item_id);

  res.json({ orders, pastItemIds });
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
  const fields = ["name", "phone", "points", "spending", "visits", "tier_id", "dob", "tags"];
  const sets = [];
  const vals = [];
  for (const f of fields) {
    if (req.body && f in req.body) {
      sets.push(`${f} = ?`);
      vals.push(req.body[f] || null); // allows unsetting tier_id etc
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
      `SELECT m.id, m.name, m.phone, m.points, m.spending, m.visits, m.tier_id, m.dob, m.tags, m.created_at, t.name as tier_name
       FROM members m
       LEFT JOIN member_tiers t ON t.id = m.tier_id
       WHERE m.id = ?`
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

// --- Member Tiers CRUD ---

r.get("/tiers/list", (req, res) => {
  const rows = db.prepare("SELECT * FROM member_tiers ORDER BY min_spending ASC").all();
  res.json(rows);
});

r.post("/tiers", adminRequired, (req, res) => {
  const { name, min_spending, discount_percent, points_multiplier } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const info = db
      .prepare(
        "INSERT INTO member_tiers (name, min_spending, discount_percent, points_multiplier) VALUES (?, ?, ?, ?)"
      )
      .run(name, Number(min_spending) || 0, Number(discount_percent) || 0, Number(points_multiplier) || 1.0);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.put("/tiers/:id", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { name, min_spending, discount_percent, points_multiplier } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    db.prepare(
      "UPDATE member_tiers SET name = ?, min_spending = ?, discount_percent = ?, points_multiplier = ? WHERE id = ?"
    ).run(name, Number(min_spending) || 0, Number(discount_percent) || 0, Number(points_multiplier) || 1.0, id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.delete("/tiers/:id", adminRequired, (req, res) => {
  db.prepare("DELETE FROM member_tiers WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

export default r;
