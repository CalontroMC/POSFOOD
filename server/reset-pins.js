import Database from "better-sqlite3";
const db = new Database("../data/foodpos.db");
const hash = "0b0f4413b762e833ca9e6ebb8cb771c7:c5a22efb736ebbade8d5d199bc4a89ac0c6c3929cb24d84a93754e3031808748c368993b77ee97b7314accefaff56a53e4947a7c0ee6f35d2f5d3b053f04524e";
db.prepare("UPDATE settings SET value=? WHERE key='admin_pin'").run(hash);
db.prepare("UPDATE settings SET value=? WHERE key='manager_pin'").run(hash);
console.log("PINs updated to 1234");
