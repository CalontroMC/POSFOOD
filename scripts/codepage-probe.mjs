// Brute-force discover which ESC t codepage value selects Thai on this printer.
// Prints one ticket containing the same Thai phrase under each candidate codepage.
import net from "node:net";

const IP = process.env.PRINTER_IP || "192.168.68.208";
const PORT = Number(process.env.PRINTER_PORT) || 9100;
const ESC = 0x1b, GS = 0x1d;

function tis(s) {
  const out = [];
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x0e00 && cp <= 0x0e7f) out.push(cp - 0x0e00 + 0xa0);
    else if (cp < 0x80) out.push(cp);
    else out.push(0x3f);
  }
  return Buffer.from(out);
}
function utf8(s) { return Buffer.from(String(s), "utf-8"); }

const THAI = "ผัดกะเพรา ขอบคุณ";

const candidates = [
  // label,                          prefix bytes (init + optional ESC t),                     encoder
  ["no-ESC-t  (use default 255)",    Buffer.from([ESC, 0x40]),                                 "tis"],
  ["ESC t 0xFF (255 explicit)",      Buffer.from([ESC, 0x40, ESC, 0x74, 0xff]),                "tis"],
  ["ESC t 0x14 (20 KU42)",           Buffer.from([ESC, 0x40, ESC, 0x74, 0x14]),                "tis"],
  ["ESC t 0x1A (26 TIS18)",          Buffer.from([ESC, 0x40, ESC, 0x74, 0x1a]),                "tis"],
  ["ESC t 0x1B (27)",                Buffer.from([ESC, 0x40, ESC, 0x74, 0x1b]),                "tis"],
  ["ESC t 0x1F (31)",                Buffer.from([ESC, 0x40, ESC, 0x74, 0x1f]),                "tis"],
  ["ESC t 0x21 (33)",                Buffer.from([ESC, 0x40, ESC, 0x74, 0x21]),                "tis"],
  ["ESC t 0x29 (41)",                Buffer.from([ESC, 0x40, ESC, 0x74, 0x29]),                "tis"],
  ["ESC t 0x46 (70)",                Buffer.from([ESC, 0x40, ESC, 0x74, 0x46]),                "tis"],
  ["ESC t 0x4B (75)",                Buffer.from([ESC, 0x40, ESC, 0x74, 0x4b]),                "tis"],
  ["ESC t 0x16 (22)",                Buffer.from([ESC, 0x40, ESC, 0x74, 0x16]),                "tis"],
  ["UTF-8 raw  (no ESC t)",          Buffer.from([ESC, 0x40]),                                 "utf8"],
];

const parts = [];
parts.push(Buffer.from([ESC, 0x40]));
parts.push(Buffer.from([ESC, 0x61, 0x01]));    // center
parts.push(Buffer.from([ESC, 0x21, 0x10]));    // double height
parts.push(Buffer.from("CODEPAGE TEST\n"));
parts.push(Buffer.from([ESC, 0x21, 0x00]));
parts.push(Buffer.from("================================================\n"));
parts.push(Buffer.from([ESC, 0x61, 0x00]));    // left

for (let i = 0; i < candidates.length; i++) {
  const [label, prefix, method] = candidates[i];
  parts.push(prefix);
  parts.push(Buffer.from(`[${String(i + 1).padStart(2, "0")}] ${label}\n`));
  parts.push(Buffer.from("    "));
  parts.push(method === "utf8" ? utf8(THAI) : tis(THAI));
  parts.push(Buffer.from("\n"));
}

parts.push(Buffer.from([ESC, 0x40]));
parts.push(Buffer.from("================================================\n"));
parts.push(Buffer.from([ESC, 0x61, 0x01]));
parts.push(Buffer.from("Goal phrase = pad-ka-prao kob-kun\n"));
parts.push(Buffer.from("Tell me which [NN] row shows readable Thai\n\n\n\n"));
parts.push(Buffer.from([GS, 0x56, 0x00]));

const payload = Buffer.concat(parts);

const sock = new net.Socket();
sock.setTimeout(8000);
sock.once("timeout", () => { console.log("TIMEOUT"); process.exit(1); });
sock.once("error", (e) => { console.log("ERR:", e.message); process.exit(1); });
sock.once("connect", () => {
  console.log(`Connected to ${IP}:${PORT}`);
  sock.write(payload, () => {
    setTimeout(() => {
      sock.destroy();
      console.log(`Sent ${payload.length} bytes — 12 codepage candidates`);
    }, 800);
  });
});
sock.connect(PORT, IP);
