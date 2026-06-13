import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";
import { rotateTableToken } from "../lib/tableToken.js";
import { printCheckBillForTable } from "../lib/checkBill.js";
import { sendSSE } from "../lib/sse.js";

const r = Router();

const VALID_STATUS = ["รอ", "รับเรื่อง", "เสร็จสิ้น", "ยกเลิก"];
const OPEN_STATUS = ["รอ", "รับเรื่อง"];

// Public — customer calls for bill from /order page
r.post("/", (req, res) => {
  const { table_token, note } = req.body || {};
  if (!table_token) return res.status(400).json({ error: "table_token required" });

  const table = db
    .prepare(
      "SELECT id, table_number FROM tables WHERE qr_token = ?"
    )
    .get(table_token);
  if (!table) return res.status(400).json({ error: "invalid table token" });

  // Anti-spam: if this table has a recent open bill request, return it instead of creating new
  const existing = db
    .prepare(
      `SELECT id, status, created_at FROM bill_requests
       WHERE table_id = ? AND status IN ('รอ','รับเรื่อง')
       ORDER BY id DESC LIMIT 1`
    )
    .get(table.id);
  if (existing) {
    return res.json({ ok: true, id: existing.id, status: existing.status, existing: true });
  }

  const info = db
    .prepare(
      "INSERT INTO bill_requests (table_id, table_number, table_token, note) VALUES (?, ?, ?, ?)"
    )
    .run(table.id, table.table_number, table_token, note || null);

  const newId = info.lastInsertRowid;
  res.json({ ok: true, id: newId, status: "รอ" });

  // Broadcast event instantly via SSE
  sendSSE("bill", { id: newId, table_number: table.table_number, status: "รอ" });

  // Auto-print the check bill to the configured printer (fire-and-forget so a
  // printer outage never blocks the customer's request). Only on a NEW request
  // — the anti-spam branch above returns before reaching here on repeat taps.
  printCheckBillForTable(table.id)
    .then((r) => {
      if (r?.error) console.warn("[checkBill]", r.error);
      else if (r?.skipped) console.log("[checkBill] skipped:", r.skipped);
    })
    .catch((e) => console.warn("[checkBill] crash:", e.message));
});

r.get("/", adminRequired, (req, res) => {
  const status = req.query.status;
  let where = "";
  const params = [];
  if (status === "open") {
    where = "WHERE br.status IN ('รอ','รับเรื่อง')";
  } else if (status && status !== "all") {
    where = "WHERE br.status = ?";
    params.push(status);
  }
  const rows = db
    .prepare(
      `SELECT br.id, br.table_id, br.table_number, br.status, br.note,
              br.created_at, br.closed_at, t.zone
       FROM bill_requests br
       LEFT JOIN tables t ON t.id = br.table_id
       ${where}
       ORDER BY br.id DESC LIMIT 200`
    )
    .all(...params);
  res.json(rows);
});

r.get("/open-count", (req, res) => {
  const n = db
    .prepare(
      "SELECT COUNT(*) AS n FROM bill_requests WHERE status IN ('รอ','รับเรื่อง')"
    )
    .get().n;
  res.json({ count: n });
});

r.patch("/:id/status", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!VALID_STATUS.includes(status))
    return res.status(400).json({ error: "invalid status" });

  const close = status === "เสร็จสิ้น" || status === "ยกเลิก";
  if (close) {
    db.prepare(
      "UPDATE bill_requests SET status = ?, closed_at = datetime('now') WHERE id = ?"
    ).run(status, id);
  } else {
    db.prepare("UPDATE bill_requests SET status = ?, closed_at = NULL WHERE id = ?").run(
      status,
      id
    );
  }

  // When bill is finalized, also set table back to ว่าง
  if (status === "เสร็จสิ้น") {
    const br = db
      .prepare("SELECT table_id FROM bill_requests WHERE id = ?")
      .get(id);
    if (br?.table_id) {
      db.prepare("UPDATE tables SET status = 'ว่าง' WHERE id = ?").run(br.table_id);
      // Bill settled → issue a fresh QR so the old one can no longer be used.
      rotateTableToken(db, br.table_id);
    }
  }

  res.json({ ok: true });
});

r.delete("/:id", adminRequired, (req, res) => {
  db.prepare("DELETE FROM bill_requests WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

export default r;
