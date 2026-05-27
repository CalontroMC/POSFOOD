import { Router } from "express";
import crypto from "node:crypto";
import QRCode from "qrcode";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

function newToken() {
  return crypto.randomBytes(12).toString("hex");
}

function publicUrl(req, token) {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "") || `${req.protocol}://${req.get("host")}`;
  return `${base}/order?table=${token}`;
}

r.get("/", (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, table_number, seats, zone, status, qr_token FROM tables ORDER BY table_number"
    )
    .all();
  res.json(rows);
});

r.post("/", adminRequired, (req, res) => {
  const { table_number, seats = 2, zone = "ในร้าน" } = req.body || {};
  if (!table_number)
    return res.status(400).json({ error: "table_number required" });
  try {
    const info = db
      .prepare(
        "INSERT INTO tables (table_number, seats, zone, qr_token) VALUES (?, ?, ?, ?)"
      )
      .run(table_number, Number(seats) || 2, zone || "ในร้าน", newToken());
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.patch("/:id", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const fields = ["table_number", "seats", "zone", "status"];
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
  db.prepare(`UPDATE tables SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

r.delete("/:id", adminRequired, (req, res) => {
  db.prepare("DELETE FROM tables WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

r.post("/:id/rotate-token", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const token = newToken();
  db.prepare("UPDATE tables SET qr_token = ? WHERE id = ?").run(token, id);
  res.json({ qr_token: token });
});

r.get("/by-token/:token", (req, res) => {
  const row = db
    .prepare(
      "SELECT id, table_number, seats, zone, status, qr_token FROM tables WHERE qr_token = ?"
    )
    .get(req.params.token);
  if (!row) return res.status(404).json({ error: "table not found" });
  res.json(row);
});

r.get("/:id/qr.png", async (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT qr_token FROM tables WHERE id = ?").get(id);
  if (!row) return res.status(404).end();
  const url = publicUrl(req, row.qr_token);
  const buf = await QRCode.toBuffer(url, { width: 512, margin: 1 });
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "no-store");
  res.send(buf);
});

r.get("/:id/qr.svg", async (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT qr_token FROM tables WHERE id = ?").get(id);
  if (!row) return res.status(404).end();
  const url = publicUrl(req, row.qr_token);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1 });
  res.set("Content-Type", "image/svg+xml");
  res.set("Cache-Control", "no-store");
  res.send(svg);
});

r.get("/:id/qr-info", (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT id, table_number, qr_token FROM tables WHERE id = ?")
    .get(id);
  if (!row) return res.status(404).end();
  res.json({ ...row, url: publicUrl(req, row.qr_token) });
});

export default r;
