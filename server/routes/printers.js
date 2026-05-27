import { Router } from "express";
import net from "node:net";
import os from "node:os";
import { execFile } from "node:child_process";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

r.use(adminRequired);

// ---------- Local (OS-installed) printers ----------
const PRINTER_STATUS_MAP = {
  // From WMI Win32_Printer PrinterStatus
  1: "Other",
  2: "Unknown",
  3: "Normal",        // Idle / Ready
  4: "Warming Up",
  5: "Stopped Printing",
  6: "Offline",
  7: "Paused",
};

function execAsync(cmd, args, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

async function listLocalPrintersWindows() {
  if (os.platform() !== "win32") return [];
  // Use PowerShell to enumerate installed printers and return JSON
  // -OutputFormat Text keeps stdout simple ASCII when ConvertTo-Json works fine
  const cmd = `Get-CimInstance -ClassName Win32_Printer | Select-Object Name, PortName, DriverName, PrinterStatus, Default, Shared, Network | ConvertTo-Json -Compress -Depth 2`;
  try {
    const { stdout } = await execAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", cmd],
      6000
    );
    if (!stdout.trim()) return [];
    let data;
    try {
      data = JSON.parse(stdout);
    } catch {
      return [];
    }
    // Single result → object, multiple → array
    const list = Array.isArray(data) ? data : [data];
    return list.map((p) => ({
      type: "local",
      name: p.Name,
      label: p.Name,
      port_name: p.PortName || "",
      driver: p.DriverName || "",
      status: PRINTER_STATUS_MAP[p.PrinterStatus] || `code ${p.PrinterStatus}`,
      is_default: !!p.Default,
      is_shared: !!p.Shared,
      is_network: !!p.Network,
    }));
  } catch (e) {
    return [];
  }
}

// Detect this machine's /24 LAN subnet — e.g. "192.168.1"
function detectLocalSubnet() {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const iface of list) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      const parts = iface.address.split(".");
      if (parts.length !== 4) continue;
      // Skip APIPA
      if (parts[0] === "169" && parts[1] === "254") continue;
      return { base: `${parts[0]}.${parts[1]}.${parts[2]}`, local: iface.address };
    }
  }
  return null;
}

// TCP probe a single host:port
function probe(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch {}
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
    try {
      sock.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

async function scanSubnet(base, port, timeoutMs) {
  const found = [];
  let next = 1;
  const CONCURRENCY = 64;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i > 254) break;
      const ip = `${base}.${i}`;
      const ok = await probe(ip, port, timeoutMs);
      if (ok) found.push({ ip, port });
    }
  };
  const tasks = [];
  for (let k = 0; k < CONCURRENCY; k++) tasks.push(worker());
  await Promise.all(tasks);
  return found.sort(
    (a, b) =>
      parseInt(a.ip.split(".").pop(), 10) -
      parseInt(b.ip.split(".").pop(), 10)
  );
}

r.get("/network-info", (req, res) => {
  const info = detectLocalSubnet();
  res.json(info || { error: "no LAN interface" });
});

r.get("/local", async (req, res) => {
  try {
    const list = await listLocalPrintersWindows();
    res.json({ count: list.length, found: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

r.get("/discover", async (req, res) => {
  const port = Number(req.query.port) || 9100;
  const timeout = Math.min(2000, Math.max(200, Number(req.query.timeout) || 700));
  const includeLocal = req.query.local !== "0";
  let base = req.query.subnet;
  if (!base) {
    const info = detectLocalSubnet();
    if (!info)
      return res.status(400).json({ error: "ไม่พบ LAN interface — ต่อสาย/Wi-Fi ก่อน" });
    base = info.base;
  }
  if (!/^\d+\.\d+\.\d+$/.test(base)) {
    return res.status(400).json({ error: "subnet ต้องเป็นรูป x.x.x" });
  }
  try {
    const t0 = Date.now();
    // Run network scan and local enumeration in parallel
    const [networkRaw, localList] = await Promise.all([
      scanSubnet(base, port, timeout),
      includeLocal ? listLocalPrintersWindows() : Promise.resolve([]),
    ]);
    const network = networkRaw.map((p) => ({
      type: "network",
      ip: p.ip,
      port: p.port,
      label: `${p.ip}:${p.port}`,
    }));
    const found = [...localList, ...network];
    res.json({
      subnet: base,
      port,
      count: found.length,
      network_count: network.length,
      local_count: localList.length,
      found,
      elapsed_ms: Date.now() - t0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Test print — local Windows printer (uses Out-Printer via PowerShell)
async function testLocalPrint(name) {
  if (!name) throw new Error("ชื่อเครื่องพิมพ์ไม่ถูกต้อง");
  if (os.platform() !== "win32") throw new Error("local printer รองรับเฉพาะ Windows");
  // Heredoc-style script
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const escaped = name.replace(/'/g, "''");
  const body =
    `\nFoodPOS - TEST PRINT\n` +
    `====================\n` +
    `Date: ${ts}\n` +
    `Printer: ${name}\n` +
    `Type: Local (Windows)\n\n` +
    `If you can read this,\n` +
    `the printer is connected.\n\n\n`;
  const ps =
    `$msg = @'\n${body}\n'@\n` +
    `$msg | Out-Printer -Name '${escaped}'`;
  await execAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", ps],
    8000
  );
}

// Send raw ESC/POS bytes (base64-encoded) to a network printer (TCP)
async function sendRawToNetwork(ip, port, bytes, timeoutMs = 4000) {
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
      sock.write(bytes, () => {
        setTimeout(() => finish(true), 400);
      });
    });
    try { sock.connect(port, ip); } catch (e) { finish(false, e.message); }
  });
}

// Print arbitrary ESC/POS bytes to a configured printer (network or local).
// Body: { type:'network'|'local', ip, port, name, data_base64 }
r.post("/print", async (req, res) => {
  const { type, ip, port = 9100, name, data_base64 } = req.body || {};
  if (!data_base64) return res.status(400).json({ error: "data_base64 required" });

  let bytes;
  try {
    bytes = Buffer.from(data_base64, "base64");
  } catch (e) {
    return res.status(400).json({ error: "invalid base64" });
  }
  if (!bytes.length) return res.status(400).json({ error: "empty payload" });

  try {
    if (type === "network") {
      if (!ip) return res.status(400).json({ error: "ip required for network" });
      await sendRawToNetwork(ip, Number(port) || 9100, bytes);
      return res.json({ ok: true, type: "network", bytes: bytes.length });
    }
    if (type === "local") {
      if (!name) return res.status(400).json({ error: "name required for local" });
      // Windows: write bytes to a temp file then `print /D:\\<host>\<share>` is unreliable for USB.
      // Use PowerShell RawPrinterHelper via .NET to send raw bytes to a Windows print queue.
      if (os.platform() !== "win32") {
        return res.status(400).json({ error: "local printer รองรับเฉพาะ Windows" });
      }
      const escaped = name.replace(/'/g, "''");
      const b64 = data_base64;
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
      DOCINFOW di = new DOCINFOW { pDocName = "FoodPOS Receipt", pDatatype = "RAW" };
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
      try {
        await execAsync(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-Command", ps],
          12000
        );
        return res.json({ ok: true, type: "local", bytes: bytes.length });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    return res.status(400).json({ error: `unsupported type=${type}` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Send ESC/POS test print to a specific IP:port — or trigger Out-Printer for local
r.post("/test", async (req, res) => {
  const { ip, port = 9100, type, name } = req.body || {};

  // Local printer path
  if (type === "local") {
    try {
      await testLocalPrint(name);
      return res.json({ ok: true, type: "local" });
    } catch (e) {
      return res.status(400).json({ error: e.message || "พิมพ์ผ่าน local printer ล้มเหลว" });
    }
  }

  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    return res.status(400).json({ error: "ip ไม่ถูกต้อง" });
  }
  const p = Number(port) || 9100;

  let responded = false;
  const sock = new net.Socket();
  const finish = (ok, msg) => {
    if (responded) return;
    responded = true;
    try { sock.destroy(); } catch {}
    if (ok) res.json({ ok: true });
    else res.status(400).json({ error: msg });
  };

  sock.setTimeout(4000);
  sock.once("timeout", () => finish(false, "หมดเวลารอเชื่อมต่อเครื่องพิมพ์"));
  sock.once("error", (e) => finish(false, `เชื่อมต่อล้มเหลว: ${e.message}`));
  sock.once("connect", () => {
    const ESC = "\x1b";
    const GS = "\x1d";
    const lines = [
      Buffer.from(`${ESC}@`), // init
      Buffer.from(`${ESC}a\x01`), // center
      Buffer.from(`${ESC}!\x30`), // double size
      Buffer.from("FoodPOS\n"),
      Buffer.from(`${ESC}!\x00`),
      Buffer.from("================\n"),
      Buffer.from("    TEST PRINT\n"),
      Buffer.from("================\n"),
      Buffer.from(`${ESC}a\x00`), // left
      Buffer.from(`Date: ${new Date().toISOString().replace("T", " ").slice(0, 19)}\n`),
      Buffer.from(`Printer: ${ip}:${p}\n`),
      Buffer.from("\nIf you can read this,\nthe printer is connected.\n\n\n"),
      Buffer.from(`${GS}V\x00`), // full cut
    ];
    const payload = Buffer.concat(lines);
    sock.write(payload, () => {
      setTimeout(() => finish(true), 400);
    });
  });

  try { sock.connect(p, ip); } catch (e) { finish(false, e.message); }
});

export default r;
