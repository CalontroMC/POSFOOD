# Loyverse Sync Layer — Design Spec

**วันที่:** 2026-06-09
**โปรเจค:** foodpos-ui (FoodPOS — ระบบจัดการร้านอาหาร)
**ร้าน:** TheS1ngleOne (store_id `3f17b6ed-bbff-4317-a719-24a98f9be582`)
**ขอบเขต:** v1 — ยิงยอดขายระดับ item เข้า Loyverse เมื่อปิดบิล (one-way, outbound)

---

## 1. เป้าหมายและที่มา

FoodPOS ทำงานครบแล้ว (สแกน QR ที่โต๊ะ → สั่ง → จอครัว KDS → ปิดบิล) แต่ยอดขายไม่ได้
เข้าระบบ Loyverse POS ของร้าน เจ้าของจึงต้องคีย์ซ้ำ และสต็อกใน Loyverse ไม่ตรง

**สิ่งที่ต้องการ:** เมื่อพนักงานปิดบิลใน FoodPOS (`status → 'เสร็จสิ้น'`) ระบบสร้าง
**receipt ระดับ item** เข้า Loyverse ให้อัตโนมัติ → ยอดขายและสต็อกใน Loyverse อัปเดตเอง

### กฎเหล็ก (non-negotiable)
> **การปิดบิลใน FoodPOS ต้องสำเร็จเสมอ แม้ Loyverse ล่ม/ช้า/token หมดอายุ**

การ sync เป็นงานแยก เกิดหลัง transaction ปิดบิล commit แล้ว ทำแบบ async ไม่บล็อก response
ทุกผลลัพธ์บันทึกลง `loyverse_sync_log` และ retry ได้จากหน้า Settings

---

## 2. การตัดสินใจที่ยืนยันแล้ว

| เรื่อง | ผล |
|---|---|
| ออเดอร์ไปไหน | เข้าระบบ FoodPOS เอง + จอครัว (มีอยู่แล้ว) |
| เมนู | จัดการใน FoodPOS เอง (มีอยู่แล้ว) — ผูก `loyverse_variant_id` ต่อเมนู |
| บทบาท Loyverse | รับยอดขายระดับ item (ตัด stock ได้) |
| จ่ายเงิน | สั่งก่อน จ่ายทีหลังที่เคาน์เตอร์ → ยิง receipt ตอนปิดบิล |
| Deploy | เครื่องร้าน + Cloudflare Tunnel (ไม่กระทบงานนี้) |
| เมนูที่ยังไม่แมป | sync log = `failed: unmapped` → ปิดบิลผ่านปกติ → แมปแล้ว retry มือ |

---

## 3. ข้อมูล Loyverse API จริง (ยืนยันด้วย token แล้ว)

- **Base URL:** `https://api.loyverse.com/v1.0`
- **Auth:** `Authorization: Bearer <token>` (token เดียว ไม่ต้อง OAuth flow)
- **store_id:** `3f17b6ed-bbff-4317-a719-24a98f9be582`
- **Payment types ของร้าน:**
  | ชื่อ | type | id |
  |---|---|---|
  | Cash | CASH | `c04445e8-2608-43d8-b02f-b9b1c1438c4e` |
  | QRCode | OTHER | `61ebbf19-5f7d-46cc-a6fc-57b7015e3cd4` |
  | Cash rounding | CASHROUNDING | `77d2bf40-7b12-11ea-bc55-0242ac130003` |
- **Item shape:** `items[].variants[].variant_id` คือเป้าหมายแมป; มี `default_price`, `track_stock`
- **Pagination:** ใช้ `cursor` (categories/items)
- **ข้อจำกัดสำคัญ:** ทุก `line_item` ใน `POST /receipts` **ต้องมี `variant_id`** — ใส่ข้อความลอยไม่ได้

### โครง payload `POST /receipts` (ที่จะสร้าง)
```jsonc
{
  "store_id": "3f17b6ed-...",
  "receipt_date": "2026-06-09T10:30:00.000Z",   // เวลาปิดบิล
  "note": "FoodPOS #<order_number> โต๊ะ <table>",
  "line_items": [
    {
      "variant_id": "b15e3e9b-...",   // จาก menu_items.loyverse_variant_id
      "quantity": 2,
      "price": 119,                    // ราคาที่ขายจริงใน FoodPOS (รวม option delta)
      "line_note": "<note ของ order_item>"
      // ส่วนลดต่อ item → line_discounts (ถ้ามี)
    }
  ],
  "payments": [
    { "payment_type_id": "c04445e8-...", "money_amount": 238 }
  ]
}
```

> **หมายเหตุราคา:** FoodPOS เก็บราคาเป็นจำนวนเต็ม (บาท ไม่มีสตางค์) — ส่งตรงเป็น `price`/`money_amount` ได้
> **ส่วนลด (v1 — แบบง่าย, รายละเอียดค่อยทำเฟสหลัง):**
> - ส่ง `line_items` ที่ราคา order_item ตรง ๆ (รวม option delta แล้ว)
> - ถ้า `orders.discount > 0` → ใส่เป็น `total_discounts` ระดับ receipt ก้อนเดียว
> - เป้าหมายเดียวที่ต้องการ: **`sum(payments) === orders.total` เป๊ะ** (กัน 422 จาก Loyverse) และยอดขายรวมตรง
> - ❌ ยังไม่แตกส่วนลดลงระดับ item (`line_discounts`) — เลื่อนไปเฟสหลัง

---

## 4. การเปลี่ยนแปลง Database (ผ่าน `ensureColumn`/`CREATE TABLE IF NOT EXISTS` ใน `server/init-db.js`)

### 4.1 เพิ่มคอลัมน์
```sql
-- ผูกเมนู FoodPOS ↔ Loyverse variant
ALTER TABLE menu_items ADD COLUMN loyverse_variant_id TEXT;   -- ensureColumn
```

### 4.2 ตารางใหม่ `loyverse_sync_log`
```sql
CREATE TABLE IF NOT EXISTS loyverse_sync_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | ok | failed
  receipt_number TEXT,                              -- เลข receipt ที่ Loyverse คืนมา
  error         TEXT,                               -- ข้อความ error ล่าสุด (รวม 'unmapped: <ชื่อเมนู>')
  payload_json  TEXT,                               -- payload ที่ส่ง (audit/debug)
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loyverse_sync_status ON loyverse_sync_log(status);
```
- `order_id UNIQUE` = กลไก idempotency หลัก (1 ออเดอร์ sync สำเร็จได้ครั้งเดียว)

### 4.3 settings keys ใหม่ (ตาราง `settings` key/value เดิม)
| key | ความหมาย |
|---|---|
| `loyverse_enabled` | `"1"`/`"0"` เปิด-ปิดการ sync |
| `loyverse_token` | access token (เก็บฝั่ง server เท่านั้น — ดู §7 ความปลอดภัย) |
| `loyverse_store_id` | store ที่จะยิงเข้า |
| `loyverse_pt_cash` | payment_type_id สำหรับ FoodPOS `cash` |
| `loyverse_pt_qr` | payment_type_id สำหรับ `qr` |
| `loyverse_pt_card` | payment_type_id สำหรับ `card` |
| `loyverse_pt_other` | payment_type_id สำหรับ `other` |

> **สำคัญ:** route `GET /api/settings` เดิม return ทุก key (ลบแค่ `admin_pin`) — ต้องเพิ่ม
> `loyverse_token` เข้า blacklist ไม่ให้หลุดออก client ด้วย

---

## 5. โมดูลใหม่ฝั่ง Server

### 5.1 `server/lib/loyverse.js` — API client (หน่วยเดียว จุดประสงค์เดียว: คุยกับ Loyverse)
```
loadConfig()                  → อ่าน token/store_id/payment map จาก settings
testConnection()              → GET /stores ; คืน { ok, stores } หรือ error
listItems({ cursor })         → GET /items (paginate) ; คืน variant แบนสำหรับ UI แมป
listPaymentTypes()            → GET /payment_types
buildReceiptPayload(order)    → pure function: order+order_items → payload §3
                                throw UnmappedItemError ถ้ามีเมนูไม่มี variant_id
createReceipt(order)          → POST /receipts ; คืน { receipt_number } หรือ throw
```
- `buildReceiptPayload` เป็น **pure function** แยกออกมา → ทดสอบง่าย ไม่ต้องต่อเน็ต
- timeout 15s, จับ error เป็น message อ่านรู้เรื่อง (เก็บลง sync_log.error)

### 5.2 `server/lib/loyverseSync.js` — orchestrator
```
syncOrderToLoyverse(orderId)  → ถูกเรียกหลังปิดบิล (async, ไม่ throw ออกไปข้างนอก)
  1. ถ้า loyverse_enabled != 1 → return เงียบ
  2. โหลด order + order_items
  3. upsert sync_log (order_id) status=pending, attempts++
  4. buildReceiptPayload → ถ้า unmapped → sync_log failed + error='unmapped: ...' → return
  5. createReceipt → ok: status=ok, receipt_number ; fail: status=failed, error
```

### 5.3 `server/routes/loyverse.js` — admin routes (mount ที่ `/api/loyverse`)
| method | path | ใช้ทำ |
|---|---|---|
| GET | `/status` | ทดสอบการเชื่อม (testConnection) |
| GET | `/items` | ดึง variants มาให้ UI แมป |
| GET | `/payment-types` | ดึง payment types |
| GET | `/sync-log?status=failed` | ดูออเดอร์ที่ sync ไม่ผ่าน |
| POST | `/sync/:orderId` | retry มือ |

ทุก route ใช้ `adminRequired` middleware เดิม

---

## 6. จุด Hook (แก้ `server/routes/orders.js`)

Endpoint: `PATCH /:id/status` (บรรทัด ~514). บล็อก `status === 'เสร็จสิ้น' && existing.status !== 'เสร็จสิ้น'`
(ปัจจุบันทำ: free โต๊ะ, ให้แต้มสมาชิก, `deductIngredients`)

**เพิ่ม:** หลัง `db.transaction(...)()` commit เสร็จ (บรรทัด ~575) — *นอก* transaction:
```js
if (status === "เสร็จสิ้น" && existing.status !== "เสร็จสิ้น") {
  // fire-and-forget; ไม่ await, ไม่ทำให้ response ปิดบิลช้า/พัง
  import("../lib/loyverseSync.js")
    .then((m) => m.syncOrderToLoyverse(id))
    .catch((e) => console.error("[loyverse] sync trigger failed:", e));
}
res.json({ ok: true });
```
- ต้องอยู่นอก transaction (ห้ามให้ network ค้าง lock DB)
- ทำงานแม้ payment_method ใด ๆ; การ map → payment_type_id อยู่ใน buildReceiptPayload

---

## 7. ความปลอดภัย

- `loyverse_token` เก็บใน `settings` ฝั่ง server เท่านั้น — **เพิ่มเข้า blacklist ใน `GET /api/settings`** (เหมือน `admin_pin`)
- หน้า Settings UI: ช่อง token เป็น password field; แสดงแค่ "ตั้งค่าแล้ว ●●●●" ถ้ามีค่าอยู่; ส่งค่าใหม่เฉพาะเมื่อแก้
- ไม่ commit token ลง git (อยู่ใน `data/foodpos.db` ซึ่ง .gitignore ควรครอบอยู่แล้ว — ตรวจยืนยัน)

---

## 8. Frontend

### 8.1 `src/pages/Settings.jsx` — เพิ่มส่วน "เชื่อมต่อ Loyverse"
- Toggle เปิด/ปิด (`loyverse_enabled`)
- ช่องวาง token (password) + ปุ่ม **ทดสอบการเชื่อมต่อ** → เรียก `GET /api/loyverse/status` แสดงชื่อร้าน
- เลือก store (ถ้ามีหลายร้าน) — ร้านนี้มี 1
- แมปวิธีจ่าย 4 แบบ (cash/qr/card/other) → dropdown payment types จาก `/payment-types`
- แผง **"ออเดอร์ที่ sync ไม่ผ่าน"** จาก `/sync-log?status=failed` + ปุ่ม retry ต่อแถว

### 8.2 `src/pages/MenuItemEditor.jsx` — เพิ่มช่อง "Loyverse variant"
- dropdown/search จาก `GET /api/loyverse/items` → set `menu_items.loyverse_variant_id`
- แสดง badge เตือนถ้าเมนูยังไม่ได้แมป

### 8.3 `src/lib/api.js` — เพิ่มฟังก์ชันเรียก endpoint ใหม่ (ตามแพตเทิร์นเดิม)

---

## 9. กลยุทธ์การทดสอบ

**Unit (ไม่ต้องต่อเน็ต):**
- `buildReceiptPayload`: order ปกติ / มี option delta / มีส่วนลดบิล / มีส่วนลด item / หลาย payment
- กรณี unmapped → throw `UnmappedItemError` พร้อมชื่อเมนู
- ยอด `payments` รวม === `orders.total`

**Integration (mock loyverse client):**
- hook ยิงเฉพาะตอน `รอรับ/อื่น → เสร็จสิ้น` เท่านั้น (ไม่ยิงซ้ำเมื่อปิดบิลที่ปิดแล้ว)
- idempotency: เรียก sync ซ้ำ order เดิมที่ ok แล้ว → ไม่ POST ซ้ำ
- Loyverse fail → sync_log = failed + error, การปิดบิลยัง 200 ปกติ
- `loyverse_enabled=0` → ไม่ยิง

**Manual (token จริง, ระวังสร้าง receipt จริง):**
- ทดสอบเชื่อม → เห็นชื่อร้าน
- แมปเมนู 1–2 ตัว → เปิดบิลทดสอบ → ปิดบิล → เช็ค receipt โผล่ใน Loyverse Back Office + stock ลด
- เมนูไม่แมป → ปิดบิลผ่าน + sync_log ขึ้น failed:unmapped → แมป → retry → ok

---

## 10. นอกขอบเขต v1 (YAGNI)

❌ ดึงเมนู/ราคาจาก Loyverse มา FoodPOS
❌ Sync สมาชิก/แต้ม ↔ Loyverse customers
❌ Webhook ขาเข้าจาก Loyverse
❌ Sync ย้อนหลังออเดอร์เก่าก่อนเปิดใช้ฟีเจอร์
❌ Auto-create variant ใน Loyverse จากเมนู FoodPOS

(เก็บไว้พิจารณาเฟสถัดไปถ้าจำเป็น)
