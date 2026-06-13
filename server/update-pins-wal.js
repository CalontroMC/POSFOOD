import Database from "better-sqlite3";
const db = new Database("../data/foodpos.db");
db.pragma("journal_mode = WAL");
db.prepare("UPDATE settings SET value='1234' WHERE key='admin_pin'").run();
db.prepare("UPDATE settings SET value='1234' WHERE key='manager_pin'").run();
console.log("PINs updated to 1234 plaintext via WAL");
