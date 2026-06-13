import Database from "better-sqlite3";
import { verifyPin } from "./lib/hash.js";

const db = new Database("../data/foodpos.db");
const storedAdmin = db.prepare("SELECT value FROM settings WHERE key='admin_pin'").get()?.value;
const storedManager = db.prepare("SELECT value FROM settings WHERE key='manager_pin'").get()?.value;

let admin = "unknown";
let manager = "unknown";

console.log("Brute-forcing PINs...");
for (let i = 0; i <= 9999; i++) {
  const pin = String(i).padStart(4, "0");
  if (storedAdmin && verifyPin(pin, storedAdmin)) {
    admin = pin;
    console.log("Admin PIN found!");
  }
  if (storedManager && verifyPin(pin, storedManager)) {
    manager = pin;
    console.log("Manager PIN found!");
  }
}

console.log("Admin:", admin);
console.log("Manager:", manager);
