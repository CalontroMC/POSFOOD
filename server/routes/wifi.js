// Customer Wi-Fi share — public endpoints (no auth) used by the QR-scan
// customer order page. Renders a WIFI: URI as scannable QR + an iOS
// .mobileconfig for one-tap install on iPhone Safari.
//
// All settings live in the existing key/value `settings` table:
//   wifi_enabled    "1" | "0"
//   wifi_ssid       SSID string
//   wifi_password   password string (empty when wifi_encryption=nopass)
//   wifi_encryption "WPA" | "WEP" | "nopass"
//   wifi_hidden     "1" | "0"

import { Router } from "express";
import crypto from "node:crypto";
import QRCode from "qrcode";
import db from "../db.js";

const r = Router();

function loadWifiSettings() {
  const keys = ["wifi_enabled", "wifi_ssid", "wifi_password", "wifi_encryption", "wifi_hidden"];
  const rows = db
    .prepare(
      `SELECT key, value FROM settings WHERE key IN (${keys.map(() => "?").join(",")})`
    )
    .all(...keys);
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: s.wifi_enabled === "1",
    ssid: s.wifi_ssid || "",
    password: s.wifi_password || "",
    encryption: s.wifi_encryption || "WPA",
    hidden: s.wifi_hidden === "1",
  };
}

// WIFI: URI escape per spec — backslash + ;,:" need a leading backslash
function escWifi(s) {
  return String(s).replace(/([\\;,:"])/g, "\\$1");
}

function buildWifiUri(cfg) {
  const type = cfg.encryption === "nopass" || !cfg.password ? "nopass" : cfg.encryption;
  const parts = [`T:${type}`, `S:${escWifi(cfg.ssid)}`];
  if (type !== "nopass") parts.push(`P:${escWifi(cfg.password)}`);
  parts.push(`H:${cfg.hidden ? "true" : "false"}`);
  return `WIFI:${parts.join(";")};;`;
}

// What the customer page needs to render the gate + copy buttons
r.get("/info", (req, res) => {
  const cfg = loadWifiSettings();
  if (!cfg.enabled) return res.json({ enabled: false });
  res.json({
    enabled: true,
    ssid: cfg.ssid,
    password: cfg.password,
    encryption: cfg.encryption,
    hidden: cfg.hidden,
  });
});

r.get("/qr.png", async (req, res) => {
  const cfg = loadWifiSettings();
  if (!cfg.enabled || !cfg.ssid) return res.status(404).end();
  const uri = buildWifiUri(cfg);
  const buf = await QRCode.toBuffer(uri, { width: 512, margin: 1 });
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "no-store");
  res.send(buf);
});

r.get("/qr.svg", async (req, res) => {
  const cfg = loadWifiSettings();
  if (!cfg.enabled || !cfg.ssid) return res.status(404).end();
  const uri = buildWifiUri(cfg);
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1 });
  res.set("Content-Type", "image/svg+xml");
  res.set("Cache-Control", "no-store");
  res.send(svg);
});

// iOS .mobileconfig — Safari/iCloud prompts to install profile → one-tap
// auto-join. Skipped on Android (Android ignores .mobileconfig).
r.get("/profile.mobileconfig", (req, res) => {
  const cfg = loadWifiSettings();
  if (!cfg.enabled || !cfg.ssid) return res.status(404).end();
  const wifiUUID = crypto.randomUUID().toUpperCase();
  const profileUUID = crypto.randomUUID().toUpperCase();
  // Profile's EncryptionType: WPA covers WPA/WPA2/WPA3; WEP is legacy; None = open
  const encType = cfg.encryption === "WEP" ? "WEP" : cfg.encryption === "nopass" ? "None" : "WPA";
  const xe = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const passwordBlock =
    encType === "None"
      ? ""
      : `      <key>Password</key>\n      <string>${xe(cfg.password)}</string>\n`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>AutoJoin</key>
      <true/>
      <key>EncryptionType</key>
      <string>${encType}</string>
      <key>HIDDEN_NETWORK</key>
      <${cfg.hidden ? "true" : "false"}/>
${passwordBlock}      <key>PayloadDescription</key>
      <string>Configures Wi-Fi for FoodPOS customers</string>
      <key>PayloadDisplayName</key>
      <string>Wi-Fi (${xe(cfg.ssid)})</string>
      <key>PayloadIdentifier</key>
      <string>com.foodpos.wifi.payload</string>
      <key>PayloadType</key>
      <string>com.apple.wifi.managed</string>
      <key>PayloadUUID</key>
      <string>${wifiUUID}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>SSID_STR</key>
      <string>${xe(cfg.ssid)}</string>
    </dict>
  </array>
  <key>PayloadDisplayName</key>
  <string>FoodPOS Customer Wi-Fi</string>
  <key>PayloadIdentifier</key>
  <string>com.foodpos.wifi.profile</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${profileUUID}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;
  res.set("Content-Type", "application/x-apple-aspen-config");
  res.set("Content-Disposition", `attachment; filename="foodpos-wifi.mobileconfig"`);
  res.set("Cache-Control", "no-store");
  res.send(xml);
});

export default r;
