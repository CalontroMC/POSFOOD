import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

r.get("/", (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, name, role, phone, active FROM employees ORDER BY active DESC, name"
    )
    .all();
  res.json(rows);
});

r.post("/", adminRequired, (req, res) => {
  const { name, role = "พนักงาน", phone = null, active = 1 } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const info = db
    .prepare(
      "INSERT INTO employees (name, role, phone, active) VALUES (?, ?, ?, ?)"
    )
    .run(name, role, phone, active ? 1 : 0);
  res.json({ id: info.lastInsertRowid });
});

r.patch("/:id", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const fields = ["name", "role", "phone", "active"];
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
  db.prepare(`UPDATE employees SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

r.delete("/:id", adminRequired, (req, res) => {
  db.prepare("DELETE FROM employees WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

export default r;
