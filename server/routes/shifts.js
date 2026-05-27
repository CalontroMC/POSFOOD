import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

function getCurrentShift() {
  return db
    .prepare("SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1")
    .get();
}

function loadShiftSummary(shiftId) {
  const shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(shiftId);
  if (!shift) return null;

  const emp = shift.employee_id
    ? db.prepare("SELECT id, name, role FROM employees WHERE id = ?").get(shift.employee_id)
    : null;

  const totals = db
    .prepare(
      `SELECT
        COUNT(*) AS orders,
        COALESCE(SUM(total), 0) AS revenue,
        COALESCE(SUM(discount), 0) AS discount,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN payment_method IN ('qr','card','other') THEN total ELSE 0 END), 0) AS non_cash_sales,
        SUM(CASE WHEN status = 'ยกเลิก' THEN 1 ELSE 0 END) AS cancelled
       FROM orders
       WHERE shift_id = ? AND status != 'ยกเลิก'`
    )
    .get(shift.id);

  const drops = db
    .prepare(
      "SELECT id, amount, reason, created_at FROM cash_drops WHERE shift_id = ? ORDER BY id"
    )
    .all(shift.id);
  const dropsTotal = drops.reduce((s, d) => s + d.amount, 0);

  const expected = shift.opening_cash + totals.cash_sales - dropsTotal;
  const variance =
    shift.closing_cash_counted != null
      ? shift.closing_cash_counted - expected
      : null;

  return {
    ...shift,
    employee: emp,
    totals,
    drops,
    drops_total: dropsTotal,
    expected_cash: expected,
    variance,
  };
}

r.get("/current", (req, res) => {
  const cur = getCurrentShift();
  if (!cur) return res.json(null);
  res.json(loadShiftSummary(cur.id));
});

r.get("/", adminRequired, (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const rows = db
    .prepare(
      `SELECT s.*, e.name AS employee_name
       FROM shifts s
       LEFT JOIN employees e ON e.id = s.employee_id
       ORDER BY s.id DESC LIMIT ?`
    )
    .all(limit);
  res.json(rows);
});

r.get("/:id", adminRequired, (req, res) => {
  const summary = loadShiftSummary(Number(req.params.id));
  if (!summary) return res.status(404).json({ error: "not found" });
  res.json(summary);
});

r.post("/open", adminRequired, (req, res) => {
  const existing = getCurrentShift();
  if (existing) {
    return res.status(400).json({ error: "มีกะที่เปิดอยู่แล้ว ปิดก่อนเปิดใหม่" });
  }
  const {
    employee_id = null,
    opened_by_name,
    opening_cash = 0,
    note = null,
  } = req.body || {};

  let resolvedName = opened_by_name;
  if (!resolvedName && employee_id) {
    const e = db
      .prepare("SELECT name FROM employees WHERE id = ?")
      .get(Number(employee_id));
    resolvedName = e?.name;
  }
  if (!resolvedName)
    return res.status(400).json({ error: "ต้องระบุชื่อผู้เปิดกะ" });

  const info = db
    .prepare(
      "INSERT INTO shifts (employee_id, opened_by_name, opening_cash, note, status) VALUES (?, ?, ?, ?, 'open')"
    )
    .run(
      employee_id ? Number(employee_id) : null,
      resolvedName,
      Math.max(0, Number(opening_cash) || 0),
      note
    );
  res.json(loadShiftSummary(info.lastInsertRowid));
});

r.post("/:id/close", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(id);
  if (!shift) return res.status(404).json({ error: "not found" });
  if (shift.status !== "open")
    return res.status(400).json({ error: "กะนี้ถูกปิดไปแล้ว" });

  const { closing_cash_counted, note } = req.body || {};
  if (closing_cash_counted == null || Number.isNaN(Number(closing_cash_counted)))
    return res.status(400).json({ error: "ต้องระบุยอดเงินที่นับได้" });

  const summary = loadShiftSummary(id);
  const counted = Math.max(0, Number(closing_cash_counted));
  const variance = counted - summary.expected_cash;

  db.prepare(
    `UPDATE shifts SET
       status = 'closed',
       closed_at = datetime('now'),
       closing_cash_counted = ?,
       expected_cash = ?,
       variance = ?,
       note = COALESCE(?, note)
     WHERE id = ?`
  ).run(counted, summary.expected_cash, variance, note ?? null, id);

  res.json(loadShiftSummary(id));
});

r.post("/:id/cash-drops", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const shift = db.prepare("SELECT status FROM shifts WHERE id = ?").get(id);
  if (!shift) return res.status(404).json({ error: "not found" });
  if (shift.status !== "open")
    return res.status(400).json({ error: "กะนี้ปิดไปแล้ว เพิ่ม drop ไม่ได้" });

  const { amount, reason = null } = req.body || {};
  const amt = Math.max(0, Number(amount) || 0);
  if (amt <= 0)
    return res.status(400).json({ error: "จำนวนเงินต้องมากกว่า 0" });

  db.prepare(
    "INSERT INTO cash_drops (shift_id, amount, reason) VALUES (?, ?, ?)"
  ).run(id, amt, reason);
  res.json(loadShiftSummary(id));
});

r.delete("/:id/cash-drops/:dropId", adminRequired, (req, res) => {
  const dropId = Number(req.params.dropId);
  db.prepare("DELETE FROM cash_drops WHERE id = ?").run(dropId);
  res.json(loadShiftSummary(Number(req.params.id)));
});

export default r;
