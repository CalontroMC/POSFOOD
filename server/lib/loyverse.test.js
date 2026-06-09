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
