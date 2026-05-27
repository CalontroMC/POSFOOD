// One-shot: configure printer settings in foodpos.db
// Usage:  node scripts/configure-printer.mjs [--name=POS-80] [--type=local] [--enable] [--auto-print]
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.resolve(__dirname, "..", "data", "foodpos.db");

const args = Object.fromEntries(
  process.argv.slice(2).map((s) => {
    const m = s.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "1"] : [s, "1"];
  })
);

const want = {
  printer_type: args.type || "local",
  printer_name: args.name || "POS-80",
  printer_ip: args.ip || "",
  printer_port: args.port || "9100",
  printer_enabled: args.enable || args["printer-enabled"] || "1",
  auto_print: args["auto-print"] || args.autoPrint || "1",
};

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

const before = Object.fromEntries(
  db.prepare("SELECT key, value FROM settings WHERE key LIKE 'printer_%' OR key='auto_print'").all().map((r) => [r.key, r.value])
);

const ins = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);
const tx = db.transaction((entries) => {
  for (const [k, v] of entries) ins.run(k, String(v));
});
tx(Object.entries(want));

const after = Object.fromEntries(
  db.prepare("SELECT key, value FROM settings WHERE key LIKE 'printer_%' OR key='auto_print'").all().map((r) => [r.key, r.value])
);

console.log("DB:", dbPath);
console.log("Before:", before);
console.log("After :", after);
db.close();
