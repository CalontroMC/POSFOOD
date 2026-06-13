import crypto from "node:crypto";
import db from "../db.js";

export function issueToken(role = 'admin', employeeId = null, employeeName = null) {
  const t = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO admin_sessions (token, role, employee_id, employee_name) VALUES (?, ?, ?, ?)").run(t, role, employeeId, employeeName);
  return t;
}

export function revokeToken(t) {
  if (!t) return;
  db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(t);
}

export function isValidToken(t) {
  if (!t) return null;
  const row = db
    .prepare("SELECT role, employee_id, employee_name FROM admin_sessions WHERE token = ?")
    .get(t);
  if (!row) return null;
  db.prepare(
    "UPDATE admin_sessions SET last_used_at = datetime('now') WHERE token = ?"
  ).run(t);
  return row;
}

export function revokeAllSessions() {
  db.prepare("DELETE FROM admin_sessions").run();
}

export function adminRequired(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const session = isValidToken(token);
  console.log("[adminRequired] path:", req.path, "header:", header, "token:", token, "session:", session);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.user = session; // { role: 'admin' | 'manager' }
  next();
}

export function adminOnly(req, res, next) {
  adminRequired(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "สำหรับเจ้าของร้านเท่านั้น (Admin Only)" });
    }
    next();
  });
}
