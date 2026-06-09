# Loyverse Sync Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เมื่อปิดบิลใน FoodPOS (`status → 'เสร็จสิ้น'`) ระบบยิง receipt ระดับ item เข้า Loyverse อัตโนมัติ แบบไม่บล็อกการปิดบิล และ retry ได้

**Architecture:** เพิ่มชั้น sync แยกออกจาก flow ปิดบิลเดิม — pure payload builder + HTTP client (`server/lib/loyverse.js`), orchestrator ที่คุย DB + log (`server/lib/loyverseSync.js`), admin routes (`server/routes/loyverse.js`), และ hook แบบ fire-and-forget หลัง transaction ปิดบิล commit ใน `orders.js` ทุกผลลัพธ์ลงตาราง `loyverse_sync_log` (idempotent ด้วย `order_id UNIQUE`)

**Tech Stack:** Node ESM, Express 5, better-sqlite3, `node --test` (built-in) + `node:assert`, global `fetch` (Node 18+), React 19/Vite (frontend)

**Spec:** `docs/superpowers/specs/2026-06-09-loyverse-sync-design.md`

---

## File Structure

| ไฟล์ | สถานะ | หน้าที่ |
|---|---|---|
| `server/init-db.js` | modify | เพิ่มคอลัมน์ `menu_items.loyverse_variant_id` + ตาราง `loyverse_sync_log` |
| `server/lib/loyverse.js` | create | pure `buildReceiptPayload` + HTTP client (`testConnection`/`listItems`/`listPaymentTypes`/`createReceipt`) + `loadConfig` + error classes |
| `server/lib/loyverse.test.js` | create | unit tests (pure builder + fetch-mocked client) |
| `server/lib/loyverseSync.js` | create | `syncOrderToLoyverse(orderId,{db,fetchImpl})` — โหลด order, log, เรียก client |
| `server/lib/loyverseSync.test.js` | create | integration tests กับ temp `:memory:` db + fetch mock |
| `server/routes/loyverse.js` | create | admin routes mount `/api/loyverse` |
| `server/routes/settings.js` | modify | กัน `loyverse_token` หลุดออก `GET /api/settings` |
| `server/routes/orders.js` | modify | hook fire-and-forget หลังปิดบิล commit |
| `server/index.js` | modify | mount `loyverseRouter` |
| `src/lib/api.js` | modify | helper เรียก endpoint ใหม่ |
| `src/pages/Settings.jsx` | modify | ส่วน "เชื่อมต่อ Loyverse" |
| `src/pages/MenuItemEditor.jsx` | modify | ช่องเลือก Loyverse variant |

**Conventions ที่ต้องตาม (จากโค้ดเดิม):** ESM `import`; route ใช้ `Router()` + `adminRequired` จาก `../middleware/auth.js`; prepared statements `db.prepare(...).run/get/all`; settings เป็น key/value (`INSERT ... ON CONFLICT(key) DO UPDATE`); frontend เรียกผ่าน `api(path, opts)` จาก `src/lib/api.js`

**v1 rules (สำคัญ):**
- เมนูไม่มี `loyverse_variant_id` → throw `UnmappedItemError` → log `failed` → ปิดบิลผ่านปกติ
- `sum(line price×qty) !== orders.total` (มีส่วนลด/ใช้แต้ม) → throw `ReceiptTotalMismatchError` → log `failed` (จัดการมือ; ส่วนลดละเอียดไว้เฟสหลัง)
- payment เดียวต่อ receipt = `orders.payment_method` map → `payment_type_id`

---

## Task 1: DB migrations (column + sync_log table)

**Files:**
- Modify: `server/init-db.js`

- [ ] **Step 1: เปิดดูจุดที่มี `ensureColumn` และ `CREATE TABLE IF NOT EXISTS` กลุ่มท้ายๆ**

Run: `grep -n "ensureColumn\|CREATE TABLE IF NOT EXISTS bill_requests" server/init-db.js`
ใช้บล็อกใกล้ `bill_requests` / กลุ่ม `ensureColumn(...)` เป็นที่แทรก

- [ ] **Step 2: เพิ่มคอลัมน์และตาราง** (วางต่อจากกลุ่ม `ensureColumn(...)` เดิม / หลัง `CREATE TABLE bill_requests`)

```js
// --- Loyverse sync ---
ensureColumn("menu_items", "loyverse_variant_id", "TEXT");

db.exec(`
  CREATE TABLE IF NOT EXISTS loyverse_sync_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id       INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    status         TEXT NOT NULL DEFAULT 'pending',
    receipt_number TEXT,
    error          TEXT,
    payload_json   TEXT,
    attempts       INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_loyverse_sync_status ON loyverse_sync_log(status);
`);
```

> ใช้ `db.exec` กับหลายคำสั่งได้; `ensureColumn` คือ helper เดิมในไฟล์ (เช็ค PRAGMA table_info ก่อน ALTER)

- [ ] **Step 3: รัน server ให้ migration ทำงาน แล้วตรวจ schema**

Run: `node -e "import('./server/init-db.js').then(m=>{m.ensureDb&&m.ensureDb();}); " 2>/dev/null; node -e "const D=require('better-sqlite3');const db=new D('data/foodpos.db');console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE name='loyverse_sync_log'\").get());console.log(db.prepare('PRAGMA table_info(menu_items)').all().map(c=>c.name).filter(n=>n.includes('loyverse')))"`

หมายเหตุ: ถ้า `ensureDb` ไม่ถูก export แบบเรียกตรงได้ ให้รีสตาร์ท server ปกติ (`npm run server`) ครั้งเดียวแทน — migration อยู่ใน `ensureDb()` ที่ index.js เรียกตอน boot
Expected: เห็น `{ name: 'loyverse_sync_log' }` และ `[ 'loyverse_variant_id' ]`

- [ ] **Step 4: Commit**

```bash
git add server/init-db.js
git commit -m "feat(loyverse): add sync_log table and menu variant mapping column"
```

---

## Task 2: Loyverse error classes + pure `buildReceiptPayload`

**Files:**
- Create: `server/lib/loyverse.js`
- Test: `server/lib/loyverse.test.js`

- [ ] **Step 1: เขียน test ที่ fail ก่อน** — `server/lib/loyverse.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReceiptPayload,
  UnmappedItemError,
  ReceiptTotalMismatchError,
} from "./loyverse.js";

const config = {
  storeId: "STORE1",
  paymentTypeMap: { cash: "PT_CASH", qr: "PT_QR", card: "PT_CARD", other: "PT_OTHER" },
};

test("buildReceiptPayload: maps line items + single payment", () => {
  const order = { order_number: "A001", payment_method: "cash", total: 238, discount: 0, points_redeemed: 0 };
  const items = [{ name: "ปาตี้เซ็ท", price: 119, qty: 2, note: null, loyverse_variant_id: "V1" }];
  const p = buildReceiptPayload(order, items, config);
  assert.equal(p.store_id, "STORE1");
  assert.equal(p.line_items.length, 1);
  assert.deepEqual(p.line_items[0], { variant_id: "V1", quantity: 2, price: 119, line_note: null });
  assert.deepEqual(p.payments, [{ payment_type_id: "PT_CASH", money_amount: 238 }]);
  assert.ok(p.note.includes("A001"));
  assert.ok(typeof p.receipt_date === "string");
});

test("buildReceiptPayload: maps payment_method qr/card/other", () => {
  const base = { order_number: "A", total: 10, discount: 0, points_redeemed: 0 };
  const items = [{ name: "x", price: 10, qty: 1, loyverse_variant_id: "V" }];
  assert.equal(buildReceiptPayload({ ...base, payment_method: "qr" }, items, config).payments[0].payment_type_id, "PT_QR");
  assert.equal(buildReceiptPayload({ ...base, payment_method: "card" }, items, config).payments[0].payment_type_id, "PT_CARD");
  assert.equal(buildReceiptPayload({ ...base, payment_method: "other" }, items, config).payments[0].payment_type_id, "PT_OTHER");
});

test("buildReceiptPayload: null payment_method defaults to cash mapping", () => {
  const order = { order_number: "A", payment_method: null, total: 10, discount: 0, points_redeemed: 0 };
  const items = [{ name: "x", price: 10, qty: 1, loyverse_variant_id: "V" }];
  assert.equal(buildReceiptPayload(order, items, config).payments[0].payment_type_id, "PT_CASH");
});

test("buildReceiptPayload: throws UnmappedItemError with item names", () => {
  const order = { order_number: "A", payment_method: "cash", total: 50, discount: 0, points_redeemed: 0 };
  const items = [
    { name: "มีแมป", price: 30, qty: 1, loyverse_variant_id: "V1" },
    { name: "ไม่แมป", price: 20, qty: 1, loyverse_variant_id: null },
  ];
  assert.throws(() => buildReceiptPayload(order, items, config), (e) => {
    assert.ok(e instanceof UnmappedItemError);
    assert.ok(e.message.includes("ไม่แมป"));
    return true;
  });
});

test("buildReceiptPayload: throws ReceiptTotalMismatchError when total != sum (discount/points)", () => {
  const order = { order_number: "A", payment_method: "cash", total: 200, discount: 38, points_redeemed: 0 };
  const items = [{ name: "x", price: 119, qty: 2, loyverse_variant_id: "V" }]; // sum=238 != total 200
  assert.throws(() => buildReceiptPayload(order, items, config), ReceiptTotalMismatchError);
});
```

- [ ] **Step 2: รัน test ให้แน่ใจว่า fail**

Run: `node --test server/lib/loyverse.test.js`
Expected: FAIL (`Cannot find module './loyverse.js'` หรือ export ไม่มี)

- [ ] **Step 3: เขียน implementation ขั้นต่ำ** — `server/lib/loyverse.js`

```js
export class UnmappedItemError extends Error {
  constructor(names) {
    super(`เมนูยังไม่ได้แมป Loyverse variant: ${names.join(", ")}`);
    this.name = "UnmappedItemError";
    this.names = names;
  }
}

export class ReceiptTotalMismatchError extends Error {
  constructor(sum, total) {
    super(`ยอดรวมรายการ (${sum}) ไม่ตรงกับยอดบิล (${total}) — มีส่วนลด/ใช้แต้ม ยังไม่รองรับใน v1`);
    this.name = "ReceiptTotalMismatchError";
  }
}

// pure: order + lineItems + config -> Loyverse POST /receipts payload
export function buildReceiptPayload(order, lineItems, config) {
  const unmapped = lineItems.filter((it) => !it.loyverse_variant_id).map((it) => it.name);
  if (unmapped.length) throw new UnmappedItemError(unmapped);

  const sum = lineItems.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  if (sum !== Number(order.total)) throw new ReceiptTotalMismatchError(sum, order.total);

  const method = order.payment_method || "cash";
  const ptId = config.paymentTypeMap[method];
  if (!ptId) throw new Error(`ยังไม่ได้ตั้งค่า payment type สำหรับ '${method}'`);

  return {
    store_id: config.storeId,
    receipt_date: new Date().toISOString(),
    note: `FoodPOS #${order.order_number}`,
    line_items: lineItems.map((it) => ({
      variant_id: it.loyverse_variant_id,
      quantity: Number(it.qty),
      price: Number(it.price),
      line_note: it.note ?? null,
    })),
    payments: [{ payment_type_id: ptId, money_amount: Number(order.total) }],
  };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `node --test server/lib/loyverse.test.js`
Expected: PASS ทั้ง 5 เคส

- [ ] **Step 5: Commit**

```bash
git add server/lib/loyverse.js server/lib/loyverse.test.js
git commit -m "feat(loyverse): pure buildReceiptPayload + error classes with tests"
```

---

## Task 3: HTTP client (`testConnection`, `listItems`, `listPaymentTypes`, `createReceipt`)

**Files:**
- Modify: `server/lib/loyverse.js`
- Modify: `server/lib/loyverse.test.js`

- [ ] **Step 1: เพิ่ม test (fetch แบบ inject)** — ต่อท้าย `server/lib/loyverse.test.js`

```js
import { createReceipt, testConnection, listPaymentTypes } from "./loyverse.js";

function mockFetch(responses) {
  // responses: array of { status, body }
  let i = 0;
  return async () => {
    const r = responses[i++] || responses[responses.length - 1];
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      async text() { return JSON.stringify(r.body); },
      async json() { return r.body; },
    };
  };
}

test("testConnection: returns stores on 200", async () => {
  const f = mockFetch([{ status: 200, body: { stores: [{ id: "S1", name: "ร้าน" }] } }]);
  const res = await testConnection({ token: "T", fetchImpl: f });
  assert.equal(res.ok, true);
  assert.equal(res.stores[0].name, "ร้าน");
});

test("testConnection: ok=false on 401", async () => {
  const f = mockFetch([{ status: 401, body: { error: "unauthorized" } }]);
  const res = await testConnection({ token: "bad", fetchImpl: f });
  assert.equal(res.ok, false);
});

test("createReceipt: returns receipt_number on success", async () => {
  const f = mockFetch([{ status: 200, body: { receipt_number: "1-1234" } }]);
  const out = await createReceipt({ store_id: "S1", line_items: [], payments: [] }, { token: "T", fetchImpl: f });
  assert.equal(out.receipt_number, "1-1234");
});

test("createReceipt: throws on non-2xx with body message", async () => {
  const f = mockFetch([{ status: 422, body: { errors: [{ details: "bad" }] } }]);
  await assert.rejects(() => createReceipt({}, { token: "T", fetchImpl: f }), /422/);
});

test("listPaymentTypes: returns array", async () => {
  const f = mockFetch([{ status: 200, body: { payment_types: [{ id: "PT", name: "Cash" }] } }]);
  const out = await listPaymentTypes({ token: "T", fetchImpl: f });
  assert.equal(out[0].id, "PT");
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `node --test server/lib/loyverse.test.js`
Expected: FAIL (`createReceipt`/`testConnection`/`listPaymentTypes` ไม่มี export)

- [ ] **Step 3: เพิ่ม client ลง `server/lib/loyverse.js`**

```js
const BASE = "https://api.loyverse.com/v1.0";

async function call(pathAndQuery, { token, method = "GET", body, fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(`${BASE}${pathAndQuery}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    const err = new Error(`Loyverse ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function testConnection({ token, fetchImpl } = {}) {
  try {
    const data = await call("/stores", { token, fetchImpl });
    return { ok: true, stores: data.stores || [] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function listPaymentTypes({ token, fetchImpl } = {}) {
  const data = await call("/payment_types", { token, fetchImpl });
  return data.payment_types || [];
}

export async function listItems({ token, cursor, fetchImpl } = {}) {
  const q = cursor ? `?limit=250&cursor=${encodeURIComponent(cursor)}` : "?limit=250";
  const data = await call(`/items${q}`, { token, fetchImpl });
  return { items: data.items || [], cursor: data.cursor || null };
}

export async function createReceipt(payload, { token, fetchImpl } = {}) {
  return call("/receipts", { token, method: "POST", body: payload, fetchImpl });
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `node --test server/lib/loyverse.test.js`
Expected: PASS ทุกเคส (ของเดิม + ใหม่)

- [ ] **Step 5: Commit**

```bash
git add server/lib/loyverse.js server/lib/loyverse.test.js
git commit -m "feat(loyverse): HTTP client (stores/items/payment_types/receipts) with fetch-mock tests"
```

---

## Task 4: `loadConfig(db)` — อ่าน settings → config

**Files:**
- Modify: `server/lib/loyverse.js`
- Modify: `server/lib/loyverse.test.js`

- [ ] **Step 1: เพิ่ม test (temp :memory: db)** — ต่อท้าย test file

```js
import Database from "better-sqlite3";
import { loadConfig } from "./loyverse.js";

function seedSettings(pairs) {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)");
  const ins = db.prepare("INSERT INTO settings (key,value) VALUES (?,?)");
  for (const [k, v] of Object.entries(pairs)) ins.run(k, v);
  return db;
}

test("loadConfig: reads token/store/payment map + enabled flag", () => {
  const db = seedSettings({
    loyverse_enabled: "1",
    loyverse_token: "TOK",
    loyverse_store_id: "S1",
    loyverse_pt_cash: "PT_CASH",
    loyverse_pt_qr: "PT_QR",
  });
  const cfg = loadConfig(db);
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.token, "TOK");
  assert.equal(cfg.storeId, "S1");
  assert.equal(cfg.paymentTypeMap.cash, "PT_CASH");
  assert.equal(cfg.paymentTypeMap.qr, "PT_QR");
});

test("loadConfig: enabled=false when flag missing/0", () => {
  const db = seedSettings({ loyverse_token: "T" });
  assert.equal(loadConfig(db).enabled, false);
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `node --test server/lib/loyverse.test.js`
Expected: FAIL (`loadConfig` ไม่มี export)

- [ ] **Step 3: เพิ่ม `loadConfig` ลง `server/lib/loyverse.js`**

```js
export function loadConfig(db) {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'loyverse_%'").all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: s.loyverse_enabled === "1",
    token: s.loyverse_token || "",
    storeId: s.loyverse_store_id || "",
    paymentTypeMap: {
      cash: s.loyverse_pt_cash || "",
      qr: s.loyverse_pt_qr || "",
      card: s.loyverse_pt_card || "",
      other: s.loyverse_pt_other || "",
    },
  };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `node --test server/lib/loyverse.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/lib/loyverse.js server/lib/loyverse.test.js
git commit -m "feat(loyverse): loadConfig reads settings into runtime config"
```

---

## Task 5: `syncOrderToLoyverse` orchestrator

**Files:**
- Create: `server/lib/loyverseSync.js`
- Test: `server/lib/loyverseSync.test.js`

- [ ] **Step 1: เขียน integration test** — `server/lib/loyverseSync.test.js`

```js
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
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `node --test server/lib/loyverseSync.test.js`
Expected: FAIL (`./loyverseSync.js` ไม่มี)

- [ ] **Step 3: เขียน orchestrator** — `server/lib/loyverseSync.js`

```js
import realDb from "../db.js";
import { loadConfig, buildReceiptPayload, createReceipt } from "./loyverse.js";

const upsertLog = (db) => db.prepare(`
  INSERT INTO loyverse_sync_log (order_id, status, attempts, updated_at)
  VALUES (?, 'pending', 1, datetime('now'))
  ON CONFLICT(order_id) DO UPDATE SET attempts = attempts + 1, status='pending', updated_at=datetime('now')
`);

const finishLog = (db) => db.prepare(`
  UPDATE loyverse_sync_log
  SET status=?, receipt_number=?, error=?, payload_json=?, updated_at=datetime('now')
  WHERE order_id=?
`);

export async function syncOrderToLoyverse(orderId, { db = realDb, fetchImpl } = {}) {
  const cfg = loadConfig(db);
  if (!cfg.enabled) return;

  // idempotency: ถ้า ok แล้วไม่ทำซ้ำ
  const prev = db.prepare("SELECT status FROM loyverse_sync_log WHERE order_id=?").get(orderId);
  if (prev && prev.status === "ok") return;

  const order = db.prepare(
    "SELECT id, order_number, payment_method, total, discount, points_redeemed FROM orders WHERE id=?"
  ).get(orderId);
  if (!order) return;

  const items = db.prepare(`
    SELECT oi.name, oi.price, oi.qty, oi.note, mi.loyverse_variant_id
    FROM order_items oi
    LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
    WHERE oi.order_id = ?
  `).all(orderId);

  upsertLog(db).run(orderId);

  let payload = null;
  try {
    payload = buildReceiptPayload(order, items, { storeId: cfg.storeId, paymentTypeMap: cfg.paymentTypeMap });
    const out = await createReceipt(payload, { token: cfg.token, fetchImpl });
    finishLog(db).run("ok", out.receipt_number || null, null, JSON.stringify(payload), orderId);
  } catch (e) {
    finishLog(db).run("failed", null, e.message, payload ? JSON.stringify(payload) : null, orderId);
  }
}
```

> หมายเหตุ: ฟังก์ชันนี้ **ไม่ throw ออกข้างนอก** (จับ error ทั้งหมดลง log) — ปลอดภัยสำหรับเรียกแบบ fire-and-forget

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `node --test server/lib/loyverseSync.test.js`
Expected: PASS ทั้ง 5 เคส

- [ ] **Step 5: Commit**

```bash
git add server/lib/loyverseSync.js server/lib/loyverseSync.test.js
git commit -m "feat(loyverse): syncOrderToLoyverse orchestrator with idempotency + failure logging"
```

---

## Task 6: Admin routes + mount

**Files:**
- Create: `server/routes/loyverse.js`
- Modify: `server/index.js`

- [ ] **Step 1: เขียน routes** — `server/routes/loyverse.js`

```js
import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";
import { loadConfig, testConnection, listItems, listPaymentTypes } from "../lib/loyverse.js";
import { syncOrderToLoyverse } from "../lib/loyverseSync.js";

const r = Router();

r.get("/status", adminRequired, async (req, res) => {
  const cfg = loadConfig(db);
  if (!cfg.token) return res.json({ ok: false, error: "ยังไม่ได้ตั้งค่า token" });
  const out = await testConnection({ token: cfg.token });
  res.json({ ...out, enabled: cfg.enabled, storeId: cfg.storeId });
});

r.get("/payment-types", adminRequired, async (req, res) => {
  const cfg = loadConfig(db);
  try {
    res.json(await listPaymentTypes({ token: cfg.token }));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

r.get("/items", adminRequired, async (req, res) => {
  const cfg = loadConfig(db);
  try {
    // flatten variants for UI mapping
    const { items, cursor } = await listItems({ token: cfg.token, cursor: req.query.cursor });
    const variants = items.flatMap((it) =>
      (it.variants || []).map((v) => ({
        variant_id: v.variant_id,
        item_name: it.item_name,
        sku: v.sku,
        price: v.default_price,
      }))
    );
    res.json({ variants, cursor });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

r.get("/sync-log", adminRequired, (req, res) => {
  const status = req.query.status;
  const rows = status
    ? db.prepare("SELECT * FROM loyverse_sync_log WHERE status=? ORDER BY updated_at DESC LIMIT 100").all(status)
    : db.prepare("SELECT * FROM loyverse_sync_log ORDER BY updated_at DESC LIMIT 100").all();
  res.json(rows);
});

r.post("/sync/:orderId", adminRequired, async (req, res) => {
  await syncOrderToLoyverse(Number(req.params.orderId));
  const log = db.prepare("SELECT * FROM loyverse_sync_log WHERE order_id=?").get(Number(req.params.orderId));
  res.json(log || { ok: false });
});

export default r;
```

- [ ] **Step 2: mount ใน `server/index.js`**

เพิ่ม import (กลุ่ม import routers, ใกล้บรรทัด 24):
```js
import loyverseRouter from "./routes/loyverse.js";
```
เพิ่ม mount (กลุ่ม `app.use("/api/...")`, ใกล้บรรทัด 48):
```js
app.use("/api/loyverse", loyverseRouter);
```

- [ ] **Step 3: รีสตาร์ท server + smoke test route**

Run: `npm run server` (พื้นหลัง) แล้ว `curl -s -m 5 http://localhost:3000/api/loyverse/sync-log -H "Authorization: Bearer <admin_token>"`
Expected: คืน `[]` (ยังไม่มี log) ไม่ใช่ 404 — ยืนยัน route ถูก mount
(ถ้าไม่มี admin token สะดวก: ตรวจแค่ว่าไม่ใช่ 404 — 401 ก็แปลว่า route ติดแล้ว)

- [ ] **Step 4: Commit**

```bash
git add server/routes/loyverse.js server/index.js
git commit -m "feat(loyverse): admin routes (status/items/payment-types/sync-log/retry) + mount"
```

---

## Task 7: กัน `loyverse_token` หลุดออก `GET /api/settings`

**Files:**
- Modify: `server/routes/settings.js`

- [ ] **Step 1: แก้ handler `GET /`** ใน `server/routes/settings.js`

จากเดิม:
```js
  const obj = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  delete obj.admin_pin;
  res.json(obj);
```
เป็น:
```js
  const obj = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  delete obj.admin_pin;
  // อย่าส่ง token ออก client — แทนด้วย flag ว่ามีค่าตั้งไว้แล้วหรือยัง
  obj.loyverse_token_set = obj.loyverse_token ? "1" : "0";
  delete obj.loyverse_token;
  res.json(obj);
```

- [ ] **Step 2: ตรวจด้วย curl**

Run: ตั้ง token ผ่าน `PUT /api/settings` body `{"loyverse_token":"SECRET"}` แล้ว `GET /api/settings`
Expected: response ไม่มี key `loyverse_token` แต่มี `loyverse_token_set: "1"`

- [ ] **Step 3: Commit**

```bash
git add server/routes/settings.js
git commit -m "fix(loyverse): never expose loyverse_token via GET /api/settings"
```

---

## Task 8: Hook ตอนปิดบิล (orders.js)

**Files:**
- Modify: `server/routes/orders.js` (รอบ ๆ บรรทัด 514–577, endpoint `PATCH /:id/status`)

- [ ] **Step 1: เพิ่ม import บนหัวไฟล์** (กลุ่ม import เดิมของ orders.js)

```js
import { syncOrderToLoyverse } from "../lib/loyverseSync.js";
```

- [ ] **Step 2: เพิ่ม trigger หลัง transaction commit** — ใน `PATCH /:id/status` ปัจจุบันจบด้วย:

```js
  })();
  res.json({ ok: true });
});
```
แก้เป็น:
```js
  })();

  // Loyverse: ยิง receipt เมื่อปิดบิล (fire-and-forget, ไม่บล็อก response, ไม่ทำให้ปิดบิลพัง)
  if (status === "เสร็จสิ้น" && existing.status !== "เสร็จสิ้น") {
    Promise.resolve()
      .then(() => syncOrderToLoyverse(id))
      .catch((e) => console.error("[loyverse] sync trigger failed:", e));
  }

  res.json({ ok: true });
});
```

> เงื่อนไข `status === "เสร็จสิ้น" && existing.status !== "เสร็จสิ้น"` ใช้ตัวแปรเดิมที่มีอยู่แล้วใน scope ของ handler (เหมือนบล็อกตัด ingredient) — ไม่ต้องอ่าน DB ซ้ำ

- [ ] **Step 3: Integration test ด้วย flow จริง (manual, mock token)**

Run:
1. ตั้ง `loyverse_enabled=1` + token จริง + map `loyverse_pt_cash`,`loyverse_pt_qr` + แมป variant เมนู 1 ตัว (ทำผ่าน UI หลัง Task 10–11 หรือยิง settings/PUT menu ตรง ๆ)
2. สร้างออเดอร์ทดสอบ 1 รายการ (เมนูที่แมปแล้ว) → ปิดบิล (`PATCH /api/orders/<id>/status` body `{"status":"เสร็จสิ้น","payment_method":"cash"}`)
3. `GET /api/loyverse/sync-log`
Expected: log แถวนั้น `status: "ok"` มี `receipt_number`; เปิด Loyverse Back Office เห็น receipt + (ถ้า variant track stock) สต็อกลด

> ⚠️ ขั้นนี้สร้าง receipt จริงใน Loyverse — ใช้เมนู/ราคาทดสอบ และลบ receipt ทิ้งทีหลังได้ที่ Back Office

- [ ] **Step 4: ตรวจว่าปิดบิลไม่พังแม้ Loyverse ใช้ไม่ได้**

Run: ตั้ง token ผิด → ปิดบิลออเดอร์ใหม่
Expected: ปิดบิลได้ปกติ (200) + ออเดอร์เป็น "เสร็จสิ้น"; `sync-log` แถวนั้น `status: "failed"` retry ได้

- [ ] **Step 5: Commit**

```bash
git add server/routes/orders.js
git commit -m "feat(loyverse): trigger receipt sync on bill close (fire-and-forget)"
```

---

## Task 9: Frontend API helpers

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: เพิ่ม helper ท้ายไฟล์** (ตามแพตเทิร์น `api(path, opts)` เดิม)

```js
// --- Loyverse ---
export const loyverseStatus = () => api("/loyverse/status");
export const loyversePaymentTypes = () => api("/loyverse/payment-types");
export const loyverseItems = (cursor) => api(`/loyverse/items${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
export const loyverseSyncLog = (status) => api(`/loyverse/sync-log${status ? `?status=${status}` : ""}`);
export const loyverseRetry = (orderId) => api(`/loyverse/sync/${orderId}`, { method: "POST" });
```

> ตรวจก่อน: ถ้า `api()` คืน `data` ตรง ๆ (ดู return ของ `api` ใน `src/lib/api.js`) ใช้รูปแบบนี้ได้เลย; ถ้าคืน `{data,res}` ปรับให้ตรง

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.js
git commit -m "feat(loyverse): frontend api helpers"
```

---

## Task 10: Settings UI — ส่วนเชื่อมต่อ Loyverse

**Files:**
- Modify: `src/pages/Settings.jsx`

- [ ] **Step 1: เพิ่ม section "เชื่อมต่อ Loyverse"** (ตามโครง section/`PageHeader`/`Toggle` ที่หน้าใช้อยู่). ฟีเจอร์ที่ต้องมี:
  - Toggle `loyverse_enabled` (เซฟผ่าน `PUT /api/settings`)
  - input token (type=password). แสดง "ตั้งค่าแล้ว ●●●●" ถ้า `loyverse_token_set === "1"`; ส่งค่าใหม่เฉพาะเมื่อผู้ใช้พิมพ์
  - ปุ่ม "ทดสอบการเชื่อมต่อ" → `loyverseStatus()` → แสดงชื่อร้านหรือ error
  - dropdown 4 ช่อง (cash/qr/card/other) เลือกจาก `loyversePaymentTypes()` → เซฟ `loyverse_pt_*`
  - แผง "ออเดอร์ที่ sync ไม่ผ่าน": `loyverseSyncLog("failed")` แสดง order_id + error + ปุ่ม retry (`loyverseRetry`)

- [ ] **Step 2: Manual verify**

Run: เปิด `http://localhost:3000` → Settings → เปิด Loyverse, วาง token, กดทดสอบ
Expected: เห็น "TheS1ngleOne"; เลือก payment type ได้; toggle/แมปเซฟแล้ว reload ค่าอยู่

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings.jsx
git commit -m "feat(loyverse): Settings UI — connect, payment mapping, failed-sync retry"
```

---

## Task 11: Menu editor — เลือก Loyverse variant

**Files:**
- Modify: `src/pages/MenuItemEditor.jsx`

- [ ] **Step 1: เพิ่มช่อง "Loyverse variant"** ในฟอร์มแก้เมนู
  - โหลดรายการจาก `loyverseItems()` (cache ใน state; ถ้ามี cursor วนโหลดต่อ)
  - dropdown/search ค้นด้วย `item_name`/`sku` → set ค่า `loyverse_variant_id` ของเมนู
  - บันทึกผ่าน endpoint แก้เมนูเดิม (ตรวจ `server/routes/menu.js` ว่า PUT รับ field `loyverse_variant_id` ไหม — ถ้าไม่ ให้เพิ่ม field นี้เข้า whitelist ของ update handler)
  - แสดง badge "ยังไม่แมป" ถ้าว่าง

- [ ] **Step 2: ตรวจ `server/routes/menu.js` รองรับ field ใหม่**

Run: `grep -n "loyverse_variant_id\|UPDATE menu_items\|available\|description" server/routes/menu.js`
ถ้า update ใช้ field whitelist → เพิ่ม `loyverse_variant_id`; ถ้าใช้ dynamic body → ผ่านอยู่แล้ว
(ถ้าต้องแก้ menu.js → commit รวมใน task นี้)

- [ ] **Step 3: Manual verify**

Run: Settings เปิด Loyverse ไว้แล้ว → แก้เมนู 1 ตัว เลือก variant → เซฟ → reload
Expected: ค่า variant ติด; ปิดบิลออเดอร์ที่มีเมนูนี้ → `sync-log` ขึ้น ok

- [ ] **Step 4: Commit**

```bash
git add src/pages/MenuItemEditor.jsx server/routes/menu.js
git commit -m "feat(loyverse): map menu item to Loyverse variant in editor"
```

---

## Task 12: รวมเทสต์ + เพิ่ม npm script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: เพิ่ม test script**

ใน `"scripts"` เพิ่ม:
```json
"test": "node --test server/**/*.test.js",
```
> ถ้า glob `server/**/*.test.js` ไม่ทำงานบน Windows shell ให้ใช้: `"test": "node --test server/lib/loyverse.test.js server/lib/loyverseSync.test.js"`

- [ ] **Step 2: รันชุดเทสต์ทั้งหมด**

Run: `npm test`
Expected: PASS ทุกไฟล์ (loyverse.test.js + loyverseSync.test.js)

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(loyverse): add npm test script for node:test suite"
```

---

## Self-Review Notes (ผู้เขียนแผนตรวจแล้ว)

- **Spec coverage:** §4 DB → Task 1; §5 client/builder → Task 2–4; orchestrator/§6 hook → Task 5,8; §5.3 routes → Task 6; §7 security → Task 7; §8 frontend → Task 9–11. ครบ
- **v1 discount rule:** spec §3 (แบบง่าย) → realize เป็น `ReceiptTotalMismatchError` (Task 2) flag ออเดอร์ที่ยอดไม่ตรง — สอดคล้องปรัชญา flag+retry
- **Type consistency:** `buildReceiptPayload(order, lineItems, config)`, `config.paymentTypeMap`, `loadConfig(db)→{enabled,token,storeId,paymentTypeMap}`, `syncOrderToLoyverse(orderId,{db,fetchImpl})`, `createReceipt(payload,{token,fetchImpl})` — ใช้ตรงกันทุก task
- **ความเสี่ยงที่ต้องยืนยันตอน execute:** (1) รูป return ของ `api()` ใน api.js (Task 9 Step 1); (2) menu update รองรับ field ใหม่ไหม (Task 11 Step 2); (3) `createReceipt` ฟิลด์ payload ถูกใจ Loyverse ไหม — ยืนยันด้วย manual test จริง (Task 8 Step 3)
