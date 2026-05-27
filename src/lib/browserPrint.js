// Trigger the browser/device's own print dialog.
// On SUNMI/Android POS devices this opens Android Print Services → built-in printer.
// On desktop it opens regular Print dialog where user picks a printer.

export function browserPrintHtml(html, { title = "FoodPOS", widthMm = 80 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      document.body.appendChild(iframe);

      const cleanup = () => {
        try { iframe.remove(); } catch {}
      };

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        cleanup();
        return reject(new Error("ไม่สามารถเปิด print frame ได้"));
      }

      const fullHtml = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { size: ${widthMm}mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: "Sarabun", "Tahoma", Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.3;
    color: #000;
  }
  .receipt { width: 100%; padding: 0; }
  .center { text-align: center; }
  .right { text-align: right; }
  .lg { font-size: 18pt; font-weight: bold; }
  .b { font-weight: bold; }
  .muted { color: #555; font-size: 10pt; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 2px 0; }
</style>
</head>
<body>${html}</body>
</html>`;

      doc.open();
      doc.write(fullHtml);
      doc.close();

      const win = iframe.contentWindow;
      const doPrint = () => {
        try {
          win.focus();
          win.print();
          // some browsers run print() synchronously; cleanup shortly after
          setTimeout(() => {
            cleanup();
            resolve();
          }, 800);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };

      // Wait for assets/fonts to load
      if (doc.readyState === "complete") {
        setTimeout(doPrint, 100);
      } else {
        iframe.addEventListener("load", () => setTimeout(doPrint, 100), { once: true });
        // Fallback if load doesn't fire
        setTimeout(doPrint, 500);
      }
    } catch (e) {
      reject(e);
    }
  });
}

export function testReceiptHtml({ storeName = "FoodPOS", printerLabel = "Device" } = {}) {
  const ts = new Date().toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `
<div class="receipt">
  <div class="center lg">${storeName}</div>
  <div class="center muted">TEST PRINT</div>
  <hr>
  <table>
    <tr><td>เวลา</td><td class="right">${ts}</td></tr>
    <tr><td>เครื่องพิมพ์</td><td class="right">${printerLabel}</td></tr>
  </table>
  <hr>
  <div class="center">ถ้าคุณเห็นข้อความนี้</div>
  <div class="center b">เครื่องพิมพ์ทำงานปกติ ✓</div>
  <hr>
  <div class="center muted">Powered by FoodPOS</div>
  <br><br>
</div>`;
}

// Detect we're likely on a SUNMI / Android POS device.
// Returns 'sunmi' | 'android' | 'desktop'
export function detectDeviceClass() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = (navigator.userAgent || "").toLowerCase();
  // SUNMI devices often advertise model in UA
  if (/sunmi/i.test(ua)) return "sunmi";
  // Hint via Capacitor-injected globals (when in APK)
  if (typeof window !== "undefined" && (window.Capacitor?.isNativePlatform?.())) return "android";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

// ============================================================
// RAWBT integration — for SUNMI / Android thermal printers
// RAWBT app (https://rawbt.ru) bridges web → thermal printer
// (USB / Bluetooth / SUNMI inner printer / etc.)
// ============================================================

// Encode Thai (Unicode U+0E00..U+0E7F) → TIS-620 single bytes
function encodeTIS620(text) {
  const out = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x0e00 && cp <= 0x0e7f) {
      out.push(cp - 0x0e00 + 0xa0);
    } else if (cp < 0x80) {
      out.push(cp);
    } else {
      out.push(0x3f); // ?
    }
  }
  return out;
}

// Build ESC/POS byte stream for a test receipt
export function buildEscPosTestReceipt({ storeName = "FoodPOS", printerLabel = "RAWBT/SUNMI" } = {}) {
  const ESC = 0x1b;
  const GS = 0x1d;
  const out = [];

  // Initialize printer
  out.push(ESC, 0x40);
  // Code page 21 = TIS-620 (Thai)
  out.push(ESC, 0x74, 0x15);
  // Charset Thai-bound (depends on printer model; harmless if unsupported)
  out.push(ESC, 0x52, 0x14);

  const pushLine = (text, opts = {}) => {
    // Alignment: 0=left,1=center,2=right
    out.push(ESC, 0x61, opts.center ? 1 : opts.right ? 2 : 0);
    // Size: 0x00=normal, 0x10=double-h, 0x20=double-w, 0x30=both
    let mode = 0;
    if (opts.big) mode |= 0x30;
    if (opts.bold) mode |= 0x08;
    out.push(ESC, 0x21, mode);
    for (const b of encodeTIS620(text || "")) out.push(b);
    out.push(0x0a);
  };

  const ts = new Date().toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  pushLine(storeName, { center: true, big: true });
  pushLine("TEST PRINT", { center: true });
  pushLine("================================", { center: true });
  pushLine(`เวลา: ${ts}`);
  pushLine(`เครื่องพิมพ์: ${printerLabel}`);
  pushLine("================================", { center: true });
  pushLine("ถ้าคุณเห็นข้อความนี้", { center: true });
  pushLine("เครื่องพิมพ์ทำงานปกติ", { center: true, bold: true });
  pushLine("================================", { center: true });
  pushLine("");
  pushLine("Powered by FoodPOS", { center: true });

  // Feed + cut
  out.push(0x0a, 0x0a, 0x0a, 0x0a);
  out.push(GS, 0x56, 0x00);

  return new Uint8Array(out);
}

// Send a Uint8Array of ESC/POS bytes to RAWBT via its URL scheme
export function printViaRawBT(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("bytes ต้องเป็น Uint8Array");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  // RAWBT spec: rawbt:base64<...> = print raw ESC/POS bytes
  // Use an anchor click so user gesture is preserved
  const a = document.createElement("a");
  a.href = `rawbt:base64${b64}`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}
