import Database from "better-sqlite3";
const db = new Database("../data/foodpos.db");
db.pragma("journal_mode=WAL");
db.prepare("INSERT INTO settings (key, value) VALUES ('manager_pin', '5678') ON CONFLICT(key) DO UPDATE SET value='5678'").run();
console.log("Manager PIN set to 5678");
