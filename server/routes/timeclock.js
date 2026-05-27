import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

r.use(adminRequired);

r.get("/", (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const rows = db
    .prepare(
      `SELECT ce.id, ce.employee_id, ce.type, ce.created_at, ce.note,
              e.name AS employee_name, e.role AS employee_role
       FROM clock_events ce
       JOIN employees e ON e.id = ce.employee_id
       ORDER BY ce.id DESC LIMIT ?`
    )
    .all(limit);
  res.json(rows);
});

r.get("/status", (req, res) => {
  // Per employee: last event + clocked-in status
  const rows = db
    .prepare(
      `SELECT e.id, e.name, e.role,
              (SELECT type FROM clock_events WHERE employee_id = e.id ORDER BY id DESC LIMIT 1) AS last_type,
              (SELECT created_at FROM clock_events WHERE employee_id = e.id ORDER BY id DESC LIMIT 1) AS last_at
       FROM employees e
       WHERE e.active = 1
       ORDER BY e.name`
    )
    .all();
  res.json(rows.map((r) => ({ ...r, clocked_in: r.last_type === "in" })));
});

r.post("/", (req, res) => {
  const { employee_id, type, note } = req.body || {};
  const empId = Number(employee_id);
  if (!empId) return res.status(400).json({ error: "employee_id required" });
  if (!["in", "out"].includes(type))
    return res.status(400).json({ error: "type must be in/out" });
  const info = db
    .prepare(
      "INSERT INTO clock_events (employee_id, type, note) VALUES (?, ?, ?)"
    )
    .run(empId, type, note || null);
  res.json({ id: info.lastInsertRowid, type });
});

r.get("/summary", (req, res) => {
  // Compute work duration today + this week per employee
  const rows = db
    .prepare(
      `SELECT employee_id, type, created_at
       FROM clock_events
       WHERE date(created_at) >= date('now', '-6 days')
       ORDER BY employee_id, id`
    )
    .all();

  const empMap = new Map(
    db
      .prepare("SELECT id, name, role FROM employees")
      .all()
      .map((e) => [e.id, e])
  );

  const byEmp = {};
  let openIn = {};
  for (const ev of rows) {
    if (!byEmp[ev.employee_id]) byEmp[ev.employee_id] = { today_min: 0, week_min: 0 };
    if (ev.type === "in") {
      openIn[ev.employee_id] = ev.created_at;
    } else if (ev.type === "out" && openIn[ev.employee_id]) {
      const start = new Date(openIn[ev.employee_id].replace(" ", "T") + "Z").getTime();
      const end = new Date(ev.created_at.replace(" ", "T") + "Z").getTime();
      const min = Math.max(0, Math.round((end - start) / 60000));
      byEmp[ev.employee_id].week_min += min;
      if (ev.created_at.startsWith(new Date().toISOString().slice(0, 10))) {
        byEmp[ev.employee_id].today_min += min;
      }
      delete openIn[ev.employee_id];
    }
  }

  res.json(
    Object.entries(byEmp).map(([empId, m]) => ({
      employee: empMap.get(Number(empId)),
      today_min: m.today_min,
      week_min: m.week_min,
    }))
  );
});

export default r;
