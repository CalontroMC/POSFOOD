import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { syncOrderToLoyverse } from "./loyverseSync.js";

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE menu_items (id INTEGER PRIMARY KEY, name TEXT, loyverse_variant_id TEXT);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT, payment_method TEXT,
                         total INTEGER, discount INTEGER DEFAULT 0, points_redeemed INTEGER DEFAULT 0);
    CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER, menu_item_id INTEGER,
                              name TEXT, price INTEGER, qty INTEGER, note TEXT);
    CREATE TABLE loyverse_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER UNIQUE, status TEXT DEFAULT 'pending',
      receipt_number TEXT, error TEXT, payload_json TEXT, attempts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  `);
  const sset = db.prepare("INSERT INTO settings (key,value) VALUES (?,?)");
  for (const [k, v] of Object.entries({
    loyverse_enabled: "1", loyverse_token: "T", loyverse_store_id: "S1",
    loyverse_pt_cash: "PT_CASH", loyverse_pt_qr: "PT_QR",
  })) sset.run(k, v);
  db.prepare("INSERT INTO menu_items (id,name,loyverse_variant_id) VALUES (1,'กาแฟ','V1'),(2,'ไม่แมป',NULL)").run();
  return db;
}

function okFetch() {
  return async () => ({ ok: true, status: 200, async text() { return JSON.stringify({ receipt_number: "1-1" }); } });
}

function seedOrder(db, { id = 1, total = 100, items }) {
  db.prepare("INSERT INTO orders (id,order_number,payment_method,total) VALUES (?,?,?,?)").run(id, "A" + id, "cash", total);
  const ins = db.prepare("INSERT INTO order_items (order_id,menu_item_id,name,price,qty,note) VALUES (?,?,?,?,?,?)");
  for (const it of items) ins.run(id, it.menu_item_id, it.name, it.price, it.qty, it.note ?? null);
}

test("sync: success → status ok + receipt_number", async () => {
  const db = makeDb();
  seedOrder(db, { id: 1, total: 100, items: [{ menu_item_id: 1, name: "กาแฟ", price: 50, qty: 2 }] });
  await syncOrderToLoyverse(1, { db, fetchImpl: okFetch() });
  const log = db.prepare("SELECT * FROM loyverse_sync_log WHERE order_id=1").get();
  assert.equal(log.status, "ok");
  assert.equal(log.receipt_number, "1-1");
});

test("sync: unmapped item → status failed, error mentions item", async () => {
  const db = makeDb();
  seedOrder(db, { id: 2, total: 80, items: [{ menu_item_id: 2, name: "ไม่แมป", price: 80, qty: 1 }] });
  await syncOrderToLoyverse(2, { db, fetchImpl: okFetch() });
  const log = db.prepare("SELECT * FROM loyverse_sync_log WHERE order_id=2").get();
  assert.equal(log.status, "failed");
  assert.ok(log.error.includes("ไม่แมป"));
});

test("sync: disabled → no log row", async () => {
  const db = makeDb();
  db.prepare("UPDATE settings SET value='0' WHERE key='loyverse_enabled'").run();
  seedOrder(db, { id: 3, total: 50, items: [{ menu_item_id: 1, name: "กาแฟ", price: 50, qty: 1 }] });
  await syncOrderToLoyverse(3, { db, fetchImpl: okFetch() });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM loyverse_sync_log").get().n, 0);
});

test("sync: idempotent → already ok is not re-posted", async () => {
  const db = makeDb();
  seedOrder(db, { id: 4, total: 50, items: [{ menu_item_id: 1, name: "กาแฟ", price: 50, qty: 1 }] });
  await syncOrderToLoyverse(4, { db, fetchImpl: okFetch() });
  let calls = 0;
  const countingFetch = async () => { calls++; return { ok: true, status: 200, async text() { return "{}"; } }; };
  await syncOrderToLoyverse(4, { db, fetchImpl: countingFetch });
  assert.equal(calls, 0);
  assert.equal(db.prepare("SELECT status FROM loyverse_sync_log WHERE order_id=4").get().status, "ok");
});

test("sync: API failure → status failed, retriable", async () => {
  const db = makeDb();
  seedOrder(db, { id: 5, total: 50, items: [{ menu_item_id: 1, name: "กาแฟ", price: 50, qty: 1 }] });
  const failFetch = async () => ({ ok: false, status: 500, async text() { return JSON.stringify({ error: "boom" }); } });
  await syncOrderToLoyverse(5, { db, fetchImpl: failFetch });
  const log = db.prepare("SELECT * FROM loyverse_sync_log WHERE order_id=5").get();
  assert.equal(log.status, "failed");
  assert.equal(log.attempts, 1);
});
