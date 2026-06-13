import Database from "better-sqlite3";
const db = new Database("../data/foodpos.db");
console.log(db.prepare("SELECT * FROM settings").all());
