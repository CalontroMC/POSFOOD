import crypto from "node:crypto";
import db from "../db.js";

export function issueToken() {
  const t = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO admin_sessions (token) VALUES (?)").run(t);
  return t;
}

export function revokeToken(t) {
  if (!t) return;
  db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(t);
}

export function isValidToken(t) {
  if (!t) return false;
  const row = db
    .prepare("SELECT 1 FROM admin_sessions WHERE token = ?")
    .get(t);
  if (!row) return false;
  db.prepare(
    "UPDATE admin_sessions SET last_used_at = datetime('now') WHERE token = ?"
  ).run(t);
  return true;
}

export function revokeAllSessions() {
  db.prepare("DELETE FROM admin_sessions").run();
}

export function adminRequired(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || !isValidToken(token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}
