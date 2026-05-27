// Server-side auto-print for kitchen + bar tickets.
// Triggered when a customer (no admin token) submits an order via QR
// — the in-browser printJob.js cannot reach the printer in that case
// because /api/printers/print requires adminRequired middleware.
//
// Re-uses the same ESC/POS builders as the frontend (src/lib/escpos.js)
// so kitchen tickets look identical regardless of who triggered the print.

import net from "node:net";
import os from "node:os";
import { execFile } from "node:child_process";
import db from "../db.js";
import { buildOrderTicket } from "../../src/lib/escpos.js";

function loadSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function loadKitchenMap() {
  const rows = db.prepare("SELECT id, kitchen FROM menu_items").all();
  const m = new Map();
  for (const r of rows) m.set(r.id, !!r.kitchen);
  return m;
}

function splitItems(items, kitchenMap) {
  const food = [];
  const drinks = [];
  for (const it of items) {
    // Default to kitchen if menu_item_id missing or unknown (safer than dropping)
    const isFood = !it.menu_item_id || kitchenMap.get(it.menu_item_id) !== false;
    if (isFood) food.push(it);
    else drinks.push(it);
  }
  return { food, drinks };
}

function sendNetworkRaw(ip, port, bytes, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok, err) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch {}
      ok ? resolve() : reject(new Error(err));
    };
    sock.setTimeout(timeoutMs);
    sock.once("timeout", () => finish(false, "timeout"));
    sock.once("error", (e) => finish(false, e.message));
    sock.once("connect", () => {
      sock.write(bytes, () => setTimeout(() => finish(true), 400));
    });
    try { sock.connect(port, ip); } catch (e) { finish(false, e.message); }
  });
}

function execAsync(cmd, args, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

// Send raw ESC/POS bytes to a Windows-installed printer queue via winspool.
// Mirrors the .NET RawPrinter helper used in routes/printers.js POST /print.
async function sendLocalRaw(name, bytes) {
  if (os.platform() !== "win32") throw new Error("local printer requires Windows");
  const b64 = Buffer.from(bytes).toString("base64");
  const escaped = String(name).replace(/'/g, "''");
  const ps = `
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPWStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
  public static bool SendBytes(string printerName, byte[] data) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
    try {
      DOCINFOW di = new DOCINFOW { pDocName = "FoodPOS Ticket", pDatatype = "RAW" };
      if (!StartDocPrinter(hPrinter, 1, di)) return false;
      if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); return false; }
      IntPtr pUnmanaged = Marshal.AllocCoTaskMem(data.Length);
      try {
        Marshal.Copy(data, 0, pUnmanaged, data.Length);
        int written;
        if (!WritePrinter(hPrinter, pUnmanaged, data.Length, out written)) return false;
      } finally {
        Marshal.FreeCoTaskMem(pUnmanaged);
      }
      EndPagePrinter(hPrinter);
      EndDocPrinter(hPrinter);
      return true;
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
'@
$bytes = [Convert]::FromBase64String('${b64}')
[RawPrinter]::SendBytes('${escaped}', $bytes) | Out-Null
`;
  await execAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps]);
}

/**
 * Print kitchen + bar tickets for an order that already exists in DB.
 * Fire-and-forget from the caller — never throws (logs warning on failure).
 *
 * @param {object} order  Full order with .items (see loadOrder() in routes/orders.js)
 */
export async function printOrderTickets(order) {
  try {
    if (!order || !Array.isArray(order.items)) return { skipped: "no items" };
    const settings = loadSettings();
    if (settings.printer_enabled !== "1") return { skipped: "printer disabled" };
    if (settings.auto_print === "0") return { skipped: "auto_print off" };

    const type = settings.printer_type || "network";
    const width = Number(settings.printer_width) || 48;
    const kitchenMap = loadKitchenMap();
    const { food, drinks } = splitItems(order.items, kitchenMap);

    const stations = [];
    if (food.length > 0) stations.push({ name: "kitchen", title: "ใบสั่งครัว", items: food });
    if (drinks.length > 0) stations.push({ name: "bar", title: "ใบสั่งบาร์", items: drinks });
    if (stations.length === 0) return { skipped: "no printable items" };

    const results = [];
    for (const s of stations) {
      const bytes = buildOrderTicket({ title: s.title, order, items: s.items, width });
      const buf = Buffer.from(bytes);
      try {
        if (type === "network") {
          if (!settings.printer_ip) {
            results.push({ station: s.name, skipped: "no printer_ip" });
            continue;
          }
          const port = Number(settings.printer_port) || 9100;
          await sendNetworkRaw(settings.printer_ip, port, buf);
          results.push({ station: s.name, ok: true, transport: "network" });
        } else if (type === "local") {
          if (!settings.printer_name) {
            results.push({ station: s.name, skipped: "no printer_name" });
            continue;
          }
          await sendLocalRaw(settings.printer_name, buf);
          results.push({ station: s.name, ok: true, transport: "local" });
        } else {
          // rawbt / browser modes only work client-side — server can't dispatch
          results.push({ station: s.name, skipped: `transport ${type} is client-only` });
        }
      } catch (e) {
        results.push({ station: s.name, error: e.message });
      }
    }
    return { ok: true, results };
  } catch (e) {
    return { error: e.message };
  }
}
