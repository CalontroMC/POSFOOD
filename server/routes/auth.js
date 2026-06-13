import { Router } from "express";
import db from "../db.js";
import { issueToken, revokeToken, isValidToken, revokeAllSessions } from "../middleware/auth.js";
import { hashPin, verifyPin } from "../lib/hash.js";

const loginAttempts = new Map();
function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();
  const limitWindow = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, []);
  }

  const attempts = loginAttempts.get(ip).filter((timestamp) => now - timestamp < limitWindow);
  attempts.push(now);
  loginAttempts.set(ip, attempts);

  if (attempts.length > maxAttempts) {
    return res.status(429).json({
      error: "คุณล็อกอินผิดพลาดบ่อยเกินไป กรุณาลองใหม่ในอีก 15 นาที",
      code: "too_many_attempts"
    });
  }
  next();
}

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
  setSetting("admin_pin", hashPin(pin));
  setSetting("first_run_done", "1");

  // Issue an immediate login token so the user goes straight in
  const token = issueToken();
  res.json({ ok: true, token });
});

r.post("/login", loginRateLimiter, (req, res) => {
  console.log("LOGIN ATTEMPT:", req.body);
  const { pin, role: requestedRole, employee_id: empId } = req.body || {};
  if (!pin) return res.status(400).json({ error: "pin required" });
  if (getSetting("first_run_done") !== "1") {
    return res.status(409).json({ error: "ยังไม่ตั้งค่าเริ่มต้น", code: "setup_required" });
  }
  const adminPin = getSetting("admin_pin");
  const managerPin = getSetting("manager_pin");
  
  let role = null;
  let employeeId = null;
  let employeeName = null;

  if (requestedRole === "admin") {
    if (adminPin && verifyPin(pin, adminPin)) {
      role = "admin";
    }
  } else if (requestedRole === "manager") {
    if (empId) {
      const emp = db.prepare("SELECT id, name, pin FROM employees WHERE id = ?").get(empId);
      if (emp) {
        if (emp.pin && verifyPin(pin, emp.pin)) {
          role = "manager";
          employeeId = emp.id;
          employeeName = emp.name;
        } else if (!emp.pin && managerPin && verifyPin(pin, managerPin)) {
          role = "manager";
          employeeId = emp.id;
          employeeName = emp.name;
        }
      }
    } else {
      if (managerPin && verifyPin(pin, managerPin)) {
        role = "manager";
      }
    }
  } else {
    // Fallback if no role is requested (legacy support)
    if (adminPin && verifyPin(pin, adminPin)) {
      role = "admin";
    } else if (managerPin && verifyPin(pin, managerPin)) {
      role = "manager";
    }
  }

  if (!role) {
    return res.status(401).json({ error: "PIN ไม่ถูกต้อง" });
  }

  // Clear attempts on success
  const ip = req.ip || req.socket.remoteAddress;
  loginAttempts.delete(ip);
  const token = issueToken(role, employeeId, employeeName);
  res.json({ token, role, employeeId, employeeName });
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
  const session = isValidToken(token);
  res.json({ 
    authenticated: !!session, 
    role: session?.role || null,
    employeeId: session?.employee_id || null,
    employeeName: session?.employee_name || null
  });
});

export default r;
