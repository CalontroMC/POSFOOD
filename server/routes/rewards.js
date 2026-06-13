import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

// Get active rewards for POS
r.get("/active", (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, m.name as menu_item_name 
    FROM rewards r 
    LEFT JOIN menu_items m ON m.id = r.menu_item_id
    WHERE r.active = 1 
    ORDER BY r.points_cost ASC
  `).all();
  res.json(rows);
});

// Admin CRUD
r.get("/", adminRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, m.name as menu_item_name 
    FROM rewards r 
    LEFT JOIN menu_items m ON m.id = r.menu_item_id
    ORDER BY r.id DESC
  `).all();
  res.json(rows);
});

r.post("/", adminRequired, (req, res) => {
  const { name, points_cost, discount_value, menu_item_id, active } = req.body;
  if (!name || !points_cost) return res.status(400).json({ error: "name and points_cost required" });
  try {
    const info = db.prepare(
      "INSERT INTO rewards (name, points_cost, discount_value, menu_item_id, active) VALUES (?, ?, ?, ?, ?)"
    ).run(name, Number(points_cost), discount_value || null, menu_item_id || null, active ? 1 : 0);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.put("/:id", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { name, points_cost, discount_value, menu_item_id, active } = req.body;
  if (!name || !points_cost) return res.status(400).json({ error: "name and points_cost required" });
  try {
    db.prepare(
      "UPDATE rewards SET name = ?, points_cost = ?, discount_value = ?, menu_item_id = ?, active = ? WHERE id = ?"
    ).run(name, Number(points_cost), discount_value || null, menu_item_id || null, active ? 1 : 0, id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.delete("/:id", adminRequired, (req, res) => {
  db.prepare("DELETE FROM rewards WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

export default r;
