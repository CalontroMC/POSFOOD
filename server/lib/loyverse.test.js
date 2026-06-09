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
