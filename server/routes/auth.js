import { Router } from "express";
import db from "../db.js";
import { issueToken, revokeToken, isValidToken, revokeAllSessions } from "../middleware/auth.js";

const r = Router();

function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row?.value ?? null;
}

function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, String(value ?? ""));
}

r.get("/setup-status", (req, res) => {
  const done = getSetting("first_run_done") === "1";
  res.json({ first_run: !done });
});

r.post("/setup", (req, res) => {
  if (getSetting("first_run_done") === "1") {
    return res.status(403).json({ error: "ตั้งค่าเริ่มต้นไปแล้ว" });
  }
  const { store_name, admin_name, pin } = req.body || {};
  if (!store_name?.trim()) return res.status(400).json({ error: "ต้องระบุชื่อร้าน" });
  if (!admin_name?.trim()) return res.status(400).json({ error: "ต้องระบุชื่อผู้ดูแล" });
  if (!/^\d{4}$/.test(String(pin || "")))
    return res.status(400).json({ error: "PIN ต้องเป็นตัวเลข 4 หลัก" });

  setSetting("store_name", store_name.trim());
  setSetting("admin_name", admin_name.trim());
  setSetting("admin_pin", String(pin));
  setSetting("first_run_done", "1");

  // Issue an immediate login token so the user goes straight in
  const token = issueToken();
  res.json({ ok: true, token });
});

r.post("/login", (req, res) => {
  const { pin } = req.body || {};
  if (!pin) return res.status(400).json({ error: "pin required" });
  if (getSetting("first_run_done") !== "1") {
    return res.status(409).json({ error: "ยังไม่ตั้งค่าเริ่มต้น", code: "setup_required" });
  }
  const stored = getSetting("admin_pin");
  if (!stored || String(pin) !== String(stored)) {
    return res.status(401).json({ error: "PIN ไม่ถูกต้อง" });
  }
  const token = issueToken();
  res.json({ token });
});

r.post("/logout", (req, res) => {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) revokeToken(token);
  res.json({ ok: true });
});

r.get("/me", (req, res) => {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  res.json({ authenticated: !!token && isValidToken(token) });
});

export default r;
