# FoodPOS — Virtual Team Notes

Persona-based collaboration (no actual subagent spawns → token cost = 0).
All voices live inside L's head. Inline dialogue shows only when work is non-trivial.

---

## Team Roster

### Core (existing)
| Code | Role | Skill |
|---|---|---|
| **L**   | Lead Developer | Coordinate, execute, ตอบผู้ใช้ |
| **BOB** | Code Reviewer  | ตรวจ correctness, side effects, edge cases |
| **JAN** | Token Manager  | ดู cost ก่อนลงมือ — กฎประหยัด token (ใน head) |

### Project Management
| **PO**  | Product Owner  | จับ "ผู้ใช้อยากได้อะไร / why" → feature priority |
| **PM**  | Project Manager| scope, time-box, sprint cut, สั่งหยุดเมื่อ over-scope |

### Analysis
| **BA**  | Business Analyst | แปลง user need → tech requirement, แตก story |
| **SA**  | System Analyst   | DB schema, API shape, data flow, architecture |

### Design
| **UX**  | UX/UI Designer  | wireframe layout, mobile-first, ขั้นตอนกดน้อยที่สุด |

### Development
| **FE**  | Frontend Dev    | React, Tailwind, mobile responsive, UI state |
| **BE**  | Backend Dev     | Express, SQLite, route design, transactions |

### QA
| **QA**  | Tester          | edge cases, regression, ทดสอบ flow จริง |

### Ops
| **DEV** | DevOps          | deploy, Task Scheduler, server restart, log |

---

## Workflow Stages — ใครพูดเมื่อไหร่

```
[Stage 1] Requirement
  → PO + BA (+PM ถ้า scope ใหญ่)
  → จับว่า "user อยากได้อะไร / แก้ปัญหาอะไร"

[Stage 2] Analysis & Planning
  → SA + PM + L
  → SA: schema/API → PM: ตัด scope → L: feasibility

[Stage 3] Design (ถ้ามี UI)
  → UX
  → wireframe ในใจ + ระบุ layout, mobile breakpoint

[Stage 4] Development
  → FE + BE (+ L coordinate)
  → ลงมือ — แก้ไฟล์เฉพาะที่ต้อง

[Stage 5] Testing
  → QA
  → ระบุ test case + edge cases ก่อน claim "เสร็จ"

[Stage 6] Deployment
  → DEV
  → restart task / rebuild dist / verify endpoint

[Stage 7] Maintenance
  → ทีม Dev + Support
  → bug fix, patch, ดู log
```

---

## Communication Rules

1. **ห้าม spawn Agent tool จริง** — ทุก persona พูดอยู่ในหัว L
2. **Inline dialogue สั้น** — แสดงเฉพาะเมื่องาน non-trivial:
   ```
   📝 PO: user อยากได้ X เพราะ Y
   🔍 BA: แตกเป็น 2 task → A, B
   🏗 SA: schema เปลี่ยนคอลัมน์ Z
   🎨 UX: layout 1 หน้า ปุ่มเดียว
   ⌨️ FE/BE: ลงมือ
   🧪 QA: test case = ...
   🚀 DEV: restart task, no rebuild
   🔍 BOB: ผ่าน
   💰 JAN: ~N edits, OK
   ```
3. **งานเล็ก/ชัด** — ข้าม dialog ทำตรง ๆ
4. **ขัดแย้งกัน** → L ตัดสิน → ถ้าตัดสินไม่ได้ → ถาม user
5. **Inline dialogue = English สั้น ๆ** (ประหยัด context) — แต่ **รายงาน/summary = ไทย**
   - ตัวอย่าง: `BOB: SQL ok` / `JAN: 2 edits, skip rebuild` / `QA: test concurrent write`

---

## JAN's Token Economy Rules (full list)

1. Edit > Write (patch only)
2. Read แบบ offset+limit
3. ไม่ Read หลัง Write/Edit
4. Batch independent calls in 1 message
5. ไม่ rebuild/restart ถ้าไม่ใช่ requirement
6. ไม่ verify เกินจำเป็น
7. ไม่ใช้ Agent (subagent) — เปลือง cold context
8. ตอบสั้น ตรงจุด
9. ขอบเขตแคบ — ทำเฉพาะที่ขอ
10. คิดในใจก่อนพิมพ์

---

## Self-improvement Notes (per persona)

> สังเกต pattern ที่ทำผิด/ทำดี — บันทึกไว้ ใช้ครั้งถัดไป
> เพิ่ม note แค่ตอนเจอบทเรียนจริง ไม่เพิ่มฟรี ๆ

### L — Lead
- *(empty)*

### BOB — Reviewer
- ตรวจ SQL ambiguous column ถ้า JOIN ตารางที่มีชื่อ column ตรงกัน (เคยพลาด: `status` ใน bill_requests vs tables)
- ตรวจ Vite proxy ครอบ path ที่ frontend ใช้ (เคยพลาด: `/uploads` ไม่อยู่ใน proxy)

### JAN — Token
- รวม PowerShell + Bash calls ใน 1 message → ประหยัด round-trip
- Read offset+limit เฉพาะ section ที่แก้ ไม่ดูดทั้งไฟล์

### PO
- *(empty)*

### PM
- ถ้า user ขอ 12 ฟีเจอร์ — อย่าทำครบในรอบเดียว แบ่ง phase + ถาม priority
- "scope creep" จะกินเวลา + token เพิ่มเป็นทวีคูณ

### BA
- *(empty)*

### SA
- ใช้ `ensureColumn()` แทน ALTER ตรง ๆ — idempotent migration
- Timezone Thailand = `+7 hours` ในทุก date query

### UX
- Mobile-first: cart panel ต้องเป็น drawer ไม่ใช่ side-by-side
- Floating button ต้องไม่ทับ content (padding-bottom ที่ scroll area)

### FE
- React state ที่ persist → localStorage with key prefixed by domain
- `printer_type` ใหม่ ต้องอัปเดต schema-less form state default
- Vite stale cache → rm node_modules/.vite + restart preview

### BE
- Multer cleanup ของ file uploads ยังไม่มี (TODO)
- Express ที่ bind `::` ใช้ได้ทั้ง IPv4/IPv6 (good)
- Task Scheduler `Hidden=$true` ซ่อน task ไม่ใช่ window → ใช้ VBS wrapper

### QA
- ก่อน claim "เสร็จ" ต้อง trigger flow จริง 1 รอบ — endpoint OK ≠ UI OK

### DEV
- PUBLIC_BASE_URL ต้องอัปเดตเมื่อ DHCP เปลี่ยน IP
- หรือ DHCP reservation ใน router (วิธีถาวรกว่า)
- Restart server ผ่าน `Start-ScheduledTask -TaskName 'FoodPOS Server (autostart)'`

---

## How to update notes

ก่อนปิด session ที่ทำงานยาว — L ถาม personas:
- "พลาดอะไรในรอบนี้?" → BOB เพิ่ม note
- "ที่ใช้ token เปลือง?" → JAN เพิ่ม note
- "scope บานไหม?" → PM เพิ่ม note

เพิ่มเฉพาะ note ที่ **actionable** (= ครั้งหน้าทำต่างออกไป)

---

## 🌐 Web-research Skill Pack v1 (May 2026)

ค้นจาก sources จริง + ทีมคุยกัน → กลั่นเป็น actionable skill ต่อบทบาท
(เฉพาะอันที่ใช้ได้กับ FoodPOS, ตัดทฤษฎีที่ไม่เกี่ยว)

### SA — Database / SQLite production

- ใช้ **WAL mode** (มีอยู่แล้วใน `db.js` ✓)
- เพิ่ม **3 PRAGMA** ที่ขาด:
  - `PRAGMA synchronous = NORMAL` — sweet spot (เร็วกว่า FULL ~3×, ทน crash)
  - `PRAGMA busy_timeout = 5000` — ❗ critical: ลด crash rate ตอน concurrent write ลง ~40%
  - `PRAGMA cache_size = -64000` (64MB) — read fast
- WAL **ไม่ได้** ทำให้เขียนพร้อมกันได้ — มีแค่ 1 writer เสมอ
- เขียนเยอะ ๆ → ใช้ in-memory write queue (เรา transaction อยู่แล้ว = ok)
- `foreign_keys = ON` (มีแล้ว ✓)

### BE — Node/Express patterns

- **API-first**: ตั้ง endpoint shape ก่อนเขียน UI (ทำมาแล้ว ✓)
- **Validate input ก่อนทุกครั้ง** — middleware schema validate (เช่น zod) ถ้า scope ใหญ่ขึ้น
- **Cluster mode** สำหรับ multi-core: `cluster.fork()` ตามจำนวน CPU (ตอนนี้ single — ok เพราะ traffic ต่ำ)
- **Health endpoint** (`/api/health` มีแล้ว ✓) — เผื่อ monitor

### FE — React 2026

- **Feature-based folders** (เรามี pages/components/lib แบบ type-based) — ถ้าโตกว่านี้ให้ split per feature
- **Lazy-load routes**: `const KDS = lazy(() => import('./pages/KDS.jsx'))` → ลด bundle (dist 700KB ตอนนี้ใหญ่ไป)
- **Context** สำหรับ cross-cutting (auth ✓ มี, shift status ✓ มี) — ไม่ใช้ Redux
- **Custom hooks** สำหรับ logic reuse (มี useShiftStatus, useOrderNotifications ✓)

### UX — POS specific

- **One-thumb design** บนมือถือ — ปุ่มหลักอยู่ขอบล่าง 1/3 ของจอ (mobile drawer ✓)
- **Color-coded status** = อ่านเร็วกว่า text (ทำแล้ว: รอ=แดง, กำลังทำ=เหลือง, เสร็จ=เขียว ✓)
- **เสียง + visual** = สำคัญ POS (มี notif beep + toast ✓)

### Printer (BE + DEV) — RAWBT / SUNMI

- **RAWBT รองรับ 4 channel**: Bluetooth, USB, Ethernet, **Wi-Fi (port 9100 AppSocket)** — เรา dispatcher cover แล้ว ✓
- **SUNMI** มี JS bridge ผ่าน "Sunmi Print Plugin" จาก Sunmi App Market → `window.SunmiPrinter.print(text)` ใน browser
- **SUNMI ESC/POS แตกต่างจาก standard** เล็กน้อย:
  - cut อาจไม่ทำงานบน inner printer → ใช้ `feed(n)` แทน
  - codepage อาจไม่ใช่ TIS-620 — บางรุ่นใช้ UTF-8 ตรง ๆ
- ถ้าใช้ SUNMI Inner: **Option A** = RAWBT (ผ่านที่ทำมา) / **Option B** = Sunmi Print Plugin (ไม่ต้องลง RAWBT)

### DEV — Production hardening

- **HTTPS เสมอ** — ใช้ Cloudflare Tunnel (มี script แล้ว ✓) หรือ Caddy reverse proxy
- **PM2 / Task Scheduler** restart on crash (เรามี Task Scheduler ✓)
- **Log rotation** — ตอนนี้ `logs/server.out.log` ไม่หมุน → ใช้ `winston-daily-rotate-file` ถ้า log ใหญ่กว่า 100MB
- **DHCP reservation** ใน router — แก้ปัญหา IP เปลี่ยน

### PM/PO — Workflow

- **API-first** + **feature flag** สำหรับ staged rollout (ตอนนี้ใช้ `auto_print`, `printer_enabled` แล้ว = feature flag implicit ✓)
- **เก็บ velocity** — แต่ละ session ทำได้กี่ feature → ใช้ประมาณงานครั้งถัดไป
- ห้าม commit "12 features in 1 sprint" — แตก 3-4 / phase

### QA — Test ที่ขาด

- **Concurrent write test** ใน SQLite WAL — multiple POST /api/orders พร้อมกัน
- **Print failure path** — printer offline ตอนสั่งอาหาร — ระบบยังต้องบันทึก order
- **Payment edge** — ส่วนลด > subtotal ต้อง clamp (✓ มี `Math.max(0, ...)`)
- **Network drop mid-order** — outbox queue ทำงาน (✓ มี)

---

### Action items จาก research รอบนี้ (ถ้าจะทำต่อ)

| Priority | งาน | บทบาท | Effort |
|---|---|---|---|
| 🔥 High | เพิ่ม `synchronous=NORMAL` + `busy_timeout=5000` ใน `db.js` | SA | 1 edit, no rebuild |
| Med | Lazy-load KDS + Reports + Barcodes (ลด bundle) | FE | 3 edits + build |
| Med | Log rotation | DEV | 1 dep + config |
| Low | Sunmi Print Plugin path เป็น 5th printer type | BE+FE | 1 endpoint + 1 dispatch case |

> รอ user สั่ง — JAN: ห้ามทำเอง

---

## 🌐 Web-research Skill Pack v2 (May 2026)

รอบนี้เจาะ 3 หัวข้อ: **Security / Real-time / Restaurant Ops**
ตัดที่เกินตัว — เก็บเฉพาะที่ลงมือกับ FoodPOS ได้

### BE/SA — Security ที่ขาด

- **SQL injection ปลอดภัยอยู่แล้ว ✓** — `better-sqlite3` ใช้ prepared statement (`db.prepare(...).run(?, ?)`) ทุก route → ไม่มีช่องโหว่
- **XSS**: React escape อัตโนมัติ ✓ — ระวังเฉพาะถ้าใช้ `dangerouslySetInnerHTML` (ตอนนี้ไม่มี)
- **PIN admin เก็บ plaintext** ❗ — `settings.admin_pin` ใน DB เป็น string
  - ✅ Action: เปลี่ยนเป็น **argon2id** หรือ **bcrypt** (12 rounds)
  - ระดับ urgency = LAN-only ก็พอใช้, แต่ถ้าเปิด Cloudflare Tunnel = ต้องทำ
- **Token เก็บ localStorage** ❗ — XSS จะขโมยได้
  - ✅ Action: ย้ายเป็น **httpOnly cookie** ถ้าผ่าน HTTPS public
  - LAN HTTP ภายในร้าน = ยอมรับได้
- **Rate limiting** — `/api/auth/login` ไม่มี limit → brute-force PIN ได้
  - ✅ Action: `express-rate-limit` 5 req / 15min / IP บน login endpoint
- **MFA** — overkill สำหรับ POS ร้านอาหาร LAN — ข้าม

### FE/BE — Real-time (แทน polling)

ตอนนี้ **`useOrderNotifications.js` poll ทุก 5 วิ** = 720 req/ชม. / terminal

- **SSE (Server-Sent Events)** = best fit สำหรับ FoodPOS
  - one-way (server → client) ตรงกับ use case (notify orders + bills)
  - HTTP-based → ผ่าน proxy/firewall ได้ง่าย
  - auto-reconnect ใน browser native
  - ✅ Action: สร้าง `GET /api/events` (SSE stream) — push event เฉพาะตอนมี order/bill ใหม่ → ลด req ~95%
- **WebSocket** = overkill (เราไม่ต้องการ bidirectional)
- **Polling 5s** = ยอมรับได้ตอนนี้ (terminal น้อย, traffic ต่ำ) — แต่ migrate ตอนเปิด multi-branch
- เก็บ polling เป็น fallback ถ้า SSE drop

### PO/PM/UX — Restaurant Ops best practice

- **Pre-shift checklist** = เปิดร้าน 15 นาทีก่อน check:
  - printer online (ทุกตัว)
  - KDS terminal connected
  - มี receipt paper เหลือพอ
  - ✅ Action: หน้า `/pre-shift` แสดง status เป็นไฟ ✓/× ต่อ component
- **Peak-hour handheld** — มือถือ + QR ลดเวลา take order ลง ~30%
  - ✓ มี customer QR ordering แล้ว
  - คงเหลือ: ให้ staff ใช้ POSPage บน mobile (mobile cart drawer ✓)
- **Table turn time** = KPI สำคัญ
  - ✅ Action: เก็บ `table_started_at` → `table_closed_at` → Report avg turn time
- **Cross-training** — UI ต้องให้ role ใด ๆ ใช้ทุกฟีเจอร์ได้ (อย่า lock เกินจำเป็น)
  - ตอนนี้ role 'employee' กดได้แทบทุกอย่าง = ok
- **KDS sync** = order หายระหว่าง POS → kitchen = revenue lost
  - ✓ มี outbox queue + retry แล้ว

### QA — Test ที่ขาด (v2)

- **Login brute-force** — POST /api/auth/login 100 ครั้ง/นาที → ต้องโดน rate limit
- **SSE reconnect** — kill server 5 วิ + เปิดกลับ → client ต้องรับ event ใหม่ได้
- **PIN hash migration** — pin เก่า plaintext + pin ใหม่ hashed → login ต้อง check ทั้ง 2 path ระหว่างช่วง migrate
- **Peak load** — simulate 50 concurrent orders ใน 1 นาที → ต้องไม่ drop

### Action items v2

| Priority | งาน | บทบาท | Effort |
|---|---|---|---|
| 🔥 High | Rate limit `/api/auth/login` (5 req / 15min / IP) | BE | 1 dep + 1 middleware |
| 🔥 High | Hash `admin_pin` (argon2id) + migration script | BE+SA | 2 files + 1 migration |
| Med | SSE endpoint `/api/events` แทน polling | BE+FE | 1 endpoint + refactor hook |
| Med | Pre-shift checklist page | FE+UX | 1 page + 1 endpoint |
| Med | Table turn time ใน Reports | BE+FE | 1 query + 1 chart |
| Low | httpOnly cookie แทน localStorage token | BE+FE | ทำเมื่อ deploy HTTPS public |

> รอ user สั่ง — JAN: ห้ามทำเอง

---

### Bookmark: Skill Pack v3 candidates (ยังไม่ค้น)

- ~~Inventory / stock deduction~~ → v3 ✓
- ~~Promotion engine~~ → v3 ✓
- ~~Multi-branch sync~~ → v3 ✓
- ~~Audit log~~ → v3 ✓
- ~~Backup strategy~~ → v3 ✓

---

## 🌐 Web-research Skill Pack v3 (May 2026)

รอบนี้กลั่นจาก domain knowledge ที่ established + ดู codebase จริง
(JAN: skip web search — เนื้อหา training-grade, ประหยัด token)

### SA/BE — Inventory & Stock Deduction

ตอนนี้ `menu_items` ไม่มี `stock_qty` → ขายไม่จำกัด

- **เพิ่ม column**: `menu_items.stock_qty INTEGER DEFAULT NULL` (NULL = unlimited)
- **เพิ่ม column**: `menu_items.low_stock_alert INTEGER DEFAULT NULL`
- **Deduction strategy**: deduct ตอน `orders.status = 'รับเรื่อง'` (ไม่ใช่ตอน create — กันยกเลิก)
- **Race condition** ❗ — 2 orders กดพร้อมกัน item สุดท้าย:
  - ใช้ `UPDATE menu_items SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?` ใน transaction
  - check `changes = 1` → ถ้า 0 = stock หมด → reject order item นั้น
- **Recipe BOM** (advanced) — 1 จานหมูกระเทียม = ใช้ หมู 100g + กระเทียม 5g
  - ต้อง table `recipes(menu_item_id, ingredient_id, qty)` + `ingredients(id, name, stock_qty, unit)`
  - overkill ตอนนี้ — เริ่มแค่ stock_qty per menu_item ก่อน
- **Stock movement log** = `stock_movements(menu_item_id, delta, reason, ref_order_id, created_at)`
  - reason: `sale|restock|waste|adjustment`
  - ใช้ trace กลับว่าหายไปไหน

### BE — Promotion Engine

ตอนนี้มีแค่ `discount_type` (percent/amount) ระดับ order

- **Rule engine** = JSON DSL ใน `promotions` table:
  ```json
  {
    "id": 1,
    "name": "ลูกค้าใหม่ลด 10%",
    "trigger": {"type": "first_order"},
    "effect": {"type": "percent", "value": 10},
    "active": true,
    "valid_from": "...",
    "valid_to": "..."
  }
  ```
- **Trigger types**: `first_order` / `min_subtotal` / `combo` (ซื้อ A+B) / `time_window` (Happy Hour) / `category_count`
- **Effect types**: `percent` / `amount` / `free_item` / `discounted_item`
- **Stacking rule**: 1 promo / order (max) — หรือ tag `stackable: true` ถ้าผสมได้
- **เริ่มเล็ก**: ทำแค่ `time_window` + `min_subtotal` ก่อน → 80% ของ use case

### SA/DEV — Multi-branch Sync

ตอนนี้ single-DB, single-store

- **Pattern A — Centralized** (cloud DB เป็นหลัก, สาขา = client)
  - ❌ ไม่เหมาะ — เน็ตหลุด = ขายไม่ได้
- **Pattern B — Edge replication** (สาขามี local DB + sync ขึ้น cloud)
  - ✅ เหมาะร้านอาหาร — เน็ตหลุดยังขายได้
  - sync method:
    - **CRDT** = best correctness, complex
    - **Last-write-wins (LWW)** = simple, ใช้ได้กับ POS ส่วนใหญ่
    - **Event sourcing** = ทุก action เป็น event → replay ใน cloud
- **เครื่องมือที่ทำได้จริงตอนนี้**:
  - **PowerSync** หรือ **ElectricSQL** = SQLite ↔ Postgres sync
  - หรือเขียนเอง: `sync_log` table ทุก write → upload เป็น batch ทุก 30s
- **Conflict**: order ใน 2 สาขา ID ชน → ใช้ UUID แทน INTEGER PK (เปลี่ยน schema ใหญ่)
- **Realistic**: ตอนนี้ 1 ร้าน = ข้าม, ถ้าเปิดสาขา 2 ค่อย refactor

### BE — Audit Log / Change History

- **Generic pattern**: trigger บน `UPDATE` / `DELETE` → insert ลง `audit_log`:
  ```sql
  audit_log(id, table_name, row_id, action, old_data JSON,
            new_data JSON, actor_user_id, created_at)
  ```
- **SQLite ไม่มี native JSON diff** → store ทั้ง row เป็น JSON ก็พอ
- **ที่ควร audit**: `orders` (เปลี่ยน status, ยกเลิก) / `menu_items` (เปลี่ยนราคา) / `users` (เปลี่ยน role)
- **ไม่ต้อง audit**: `bill_requests` (state machine สั้น) / `settings` (เปลี่ยนน้อย)
- **Retention** = 90 วัน → cron purge เก่ากว่านี้
- **Use case จริง**:
  - "ใครยกเลิก order #1234?" → query audit_log
  - "ราคาเมนูหมูกระเทียมเปลี่ยนเมื่อไหร่?" → query
- **Effort**: 1 migration + 1 helper `logChange(table, id, old, new, user)` + เรียกใน route ที่สำคัญ

### DEV — Backup Strategy

ตอนนี้ **ไม่มี backup** ❗❗

- **SQLite hot backup** = `VACUUM INTO 'backup.db'` (safe ระหว่าง WAL = ✓ ใช้ได้)
- **Backup script**:
  ```powershell
  $date = Get-Date -Format 'yyyy-MM-dd'
  & sqlite3 .\data\app.db "VACUUM INTO 'backups/app-$date.db'"
  ```
- **Schedule**: Task Scheduler รัน 03:00 ทุกวัน (เลยช่วงปิดร้าน)
- **Retention**:
  - Daily 7 ครั้ง (1 สัปดาห์ล่าสุด)
  - Weekly 4 ครั้ง (1 เดือนล่าสุด)
  - Monthly 12 ครั้ง (1 ปีล่าสุด)
- **Off-site copy** (สำคัญ): rclone → Google Drive / Dropbox / S3
  - ของหายไฟไหม้ในร้าน = ยังเหลือใน cloud
- **Restore drill**: ทดสอบ restore ลง test DB ทุกเดือน — backup ที่ restore ไม่ได้ = ไม่มี backup
- **Effort**: 1 PowerShell script + 1 Task Scheduler entry (~30 นาที)

### QA — Test v3

- **Stock race condition**: 2 POST /api/orders พร้อมกัน item เหลือ 1 → ต้องสำเร็จแค่ 1
- **Promo expired**: order ตอน 23:59 ก่อน promo หมดอายุ → ใช้ได้, ตอน 00:00:01 → ไม่ได้
- **Audit log truthfulness**: เปลี่ยนราคาเมนู → log บันทึก actor + old/new ตรง
- **Backup restore**: restore backup เก่า → app ใช้งานได้, schema match
- **Multi-branch (ถ้าทำ)**: สาขา A offline 1 ชม, online กลับ → orders sync ขึ้น cloud ครบ

### Action items v3

| Priority | งาน | บทบาท | Effort |
|---|---|---|---|
| 🔥 High | **Backup script + Task Scheduler 03:00 daily** | DEV | 1 script + 1 task (~30 นาที) |
| 🔥 High | **Off-site backup (rclone → cloud)** | DEV | 1 config + cron append |
| Med | Inventory: `stock_qty` + deduction logic | SA+BE | 1 migration + 2 route changes |
| Med | Audit log สำหรับ orders (cancel + status) | BE | 1 table + 1 helper |
| Low | Promotion engine v0 (time_window + min_subtotal) | BE+FE | 1 table + 1 calc + admin UI |
| Future | Multi-branch sync | SA+DEV | major refactor — รอเปิดสาขา 2 |

> รอ user สั่ง — JAN: ห้ามทำเอง

---

### Bookmark: Skill Pack v4 candidates

- ~~Performance / SQLite tuning~~ → v4 ✓
- ~~Kitchen analytics~~ → v4 ✓
- ~~Tax / e-Tax invoice (Thailand RD)~~ → v4 ✓
- Observability: structured logging (pino), error tracking
- Accessibility: WCAG 2.2 / keyboard nav
- i18n: Thai/English/Myanmar toggle
- Loyalty: customer points + redeem

---

## 🌐 Web-research Skill Pack v4 (May 2026)

ค้นจริงจาก trusted sources (RD Thailand, SQLite official, restaurant industry reports)
EN talk inside, TH report outside.

### BE/SA — Thailand e-Tax Invoice & e-Receipt (RD compliance)

ตามกฎหมายไทย Ministerial Regulation No. 384 + Electronic Transactions Act + ICT Standard 3-2560

- **Voluntary** ตั้งแต่ปี 2012 — **ไม่บังคับ** แต่ลูกค้าองค์กรเริ่มขอ
- **2 routes ที่ RD รับ**:
  1. **XML 3-2560 + digital signature** (CA certificate) — สำหรับธุรกิจใหญ่
  2. **PDF/A-3 + e-Tax by Email + time stamp** — **สำหรับ SME รายได้ < 30M บาท/ปี** ← FoodPOS เลือกอันนี้
- **Reporting**: ส่งสรุปทุกเดือน, ภายในวันที่ 15 ของเดือนถัดไป
- **PDF/A-3 คือ PDF ที่ฝัง XML ข้างใน** — เปิดดูเป็น PDF ปกติได้ แต่ระบบ RD ดึง XML ออกมา validate
- **Field ที่ต้องมีใน XML/PDF**:
  - เลขประจำตัวผู้เสียภาษี (TIN) ทั้งผู้ขาย + ผู้ซื้อ (ถ้ามี)
  - เลขที่ใบกำกับภาษี (running number)
  - วันที่ออก
  - รายการสินค้า + ราคาก่อน VAT + VAT 7% + รวม
  - ลายเซ็นดิจิทัล หรือ time stamp

**FoodPOS implication:**
- ใบเสร็จปัจจุบัน (ESC/POS thermal) ใช้กับลูกค้า walk-in ได้
- **ถ้าลูกค้าขอใบกำกับภาษีเต็มรูป** → ออก PDF/A-3 + email
- ✅ Action: เพิ่ม endpoint `/api/orders/:id/tax-invoice.pdf` → generate PDF/A-3 + ส่ง email ผ่าน nodemailer
- ต้องสมัคร CA หรือใช้ e-Tax by Email service (RD มี portal) ก่อนเริ่มออกจริง

### SA — SQLite Production Tuning (deep dive)

**PRAGMAs ครบชุด** (เพิ่มเติมจาก v1):

| PRAGMA | ค่า | เหตุผล | Status |
|---|---|---|---|
| `journal_mode` | `WAL` | concurrent read | ✓ มีแล้ว |
| `synchronous` | `NORMAL` | เร็วกว่า FULL 3×, ทน crash ใน WAL | ❌ ขาด |
| `busy_timeout` | `5000` | ลด crash 40% ตอน concurrent write | ❌ ขาด |
| `cache_size` | `-64000` (64MB) | read cache | ❌ ขาด |
| `mmap_size` | `268435456` (256MB) | memory-mapped I/O = อ่านเร็วเหมือน RAM | ❌ ขาด (NEW v4) |
| `temp_store` | `MEMORY` | temp table ใน RAM ไม่ลงดิสก์ | ❌ ขาด (NEW v4) |
| `foreign_keys` | `ON` | integrity | ✓ มีแล้ว |

**EXPLAIN QUERY PLAN** — ใช้ตรวจว่า query ใช้ index หรือ scan ทั้งตาราง:
```sql
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE status = 'รอ' AND table_id = 5;
-- "SCAN orders" = ไม่ดี (full scan)
-- "SEARCH orders USING INDEX idx_status_table" = ดี
```

**กฎ index ที่สำคัญ**:
- index ช่วยเฉพาะ **left-most column** ใน WHERE
  - `INDEX (a, b, c)` → ช่วย `WHERE a=?`, `WHERE a=? AND b=?` แต่**ไม่**ช่วย `WHERE b=?` เดี่ยว
- **ANALYZE** — รัน periodic (หลัง bulk insert) → SQLite เก็บสถิติช่วย query planner เลือก index ที่ดีที่สุด
  - cron weekly: `sqlite3 app.db "ANALYZE;"`
- **sqlite3_analyzer** = utility แยก → ดู space ที่ index กิน

**Index audit สำหรับ FoodPOS** (TODO):
```sql
-- orders ที่ filter บ่อย:
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table_status
  ON orders(table_id, status);

-- order_items lookup จาก order:
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items(order_id);

-- bill_requests ที่ filter status:
CREATE INDEX IF NOT EXISTS idx_bill_requests_status
  ON bill_requests(status, created_at);
```

### PM/UX — Kitchen KDS Analytics

ตัวเลขจาก industry report 2026:
- **79%** ของ operators บอก real-time data = essential
- **27%** ยัง track basic KPI ไม่ได้ (avg order time, prep duration)
- **78%** อยากได้ alerts เมื่อ metric drift ออกนอกเกณฑ์ปกติ

**KPI ที่ KDS ควรเก็บ** (เรียงตาม priority):

| KPI | นิยาม | Schema ที่ต้อง |
|---|---|---|
| **Ticket time** | order placed → delivered | `created_at` → `served_at` |
| **Prep time / dish** | sent to kitchen → ready | `kitchen_received_at` → `ready_at` ต่อ item |
| **Order accuracy** | order ที่ไม่ถูกแก้/ส่งคืน | flag `was_modified` ใน order |
| **Kitchen throughput** | orders/ชม. | aggregate query |
| **Bottleneck detection** | station ไหน prep นานสุด | group by `kitchen` (food/drink) |

**FoodPOS gap**:
- ตอนนี้ `orders` มี `created_at` + `status` แต่**ไม่มี timestamp ต่อ status transition**
- ต้องเพิ่ม:
  - `orders.kitchen_received_at` (เมื่อ status เป็น "รับเรื่อง")
  - `orders.served_at` (เมื่อ status เป็น "เสร็จสิ้น")
  - `order_items.ready_at` (เมื่อ KDS กด "เสร็จ" รายการ)
- หรือทำ generic `order_status_log(order_id, status, changed_at, actor)` table → flexible กว่า

**Alert ที่ควรมี**:
- prep time > threshold (เช่น > 20 นาที) → toast แดง
- queue length > 10 orders waiting → notif
- avg ticket time spike เทียบ baseline → admin alert

### QA — Test v4

- **e-Tax PDF/A-3**: validate XML schema ตาม ICT 3-2560 → ทดสอบกับ RD portal staging
- **SQLite EXPLAIN**: ทุก hot query → ตรวจว่าใช้ index ไม่ใช่ scan
- **ANALYZE**: หลังรัน, query planner ควรเลือก index ดีขึ้น (compare ก่อน/หลัง)
- **Ticket time KPI**: order ที่ created 12:00 → served 12:15 → report ต้องแสดง 15 นาที
- **Alert threshold**: mock order ค้าง 25 นาที → ระบบต้อง notify

### Action items v4

| Priority | งาน | บทบาท | Effort |
|---|---|---|---|
| 🔥 High | **เพิ่ม PRAGMA: synchronous, busy_timeout, cache_size, mmap_size, temp_store** | SA | 1 edit ใน db.js |
| 🔥 High | **เพิ่ม index ที่ขาด** (orders, order_items, bill_requests) | SA | 1 migration |
| Med | `order_status_log` table + log ทุก status change | SA+BE | 1 table + 1 helper |
| Med | KPI dashboard: ticket time + prep time | BE+FE | 1 endpoint + 1 chart |
| Med | Alert: prep time > 20 นาที | FE | useEffect + toast |
| Low | e-Tax Invoice PDF/A-3 generation | BE | nodemailer + pdfkit (1-2 วัน) |
| Low | sqlite3_analyzer cron weekly | DEV | 1 script |

> รอ user สั่ง — JAN: ห้ามทำเอง

---

### Bookmark: Skill Pack v5 candidates

- Observability: pino structured log + error tracking
- Accessibility: WCAG 2.2 keyboard nav
- i18n: TH / EN / MM (Myanmar workers)
- Loyalty: customer points + redeem
- Customer experience: feedback / rating per order
- Marketing: cohort analysis, retention by segment

---

# 🎛 TEAM v2 — Persona ↔ Real Claude Skill Mapping (May 2026)

ก่อนหน้านี้ persona คุยกันใน L's head อย่างเดียว = ฟรี
ตอนนี้ Claude มี skill library จริง → upgrade ตามนี้:
**Default = persona คุยกันใน head (ฟรี). Upgrade = invoke skill จริงตอนงานใหญ่/เสี่ยง.**

## Persona Skill Map

| Persona | Primary Skill | When to Invoke (paid) | Inline talk (free) |
|---|---|---|---|
| **L** (Senior dev) | `anthropic-skills:recursive-senior-dev` | Feature ใหญ่ + ต้อง 5-loop จริง | บั๊กเล็ก, edit เล็ก |
| **BOB** (Reviewer) | `code-review` / `security-review` / `verify` | ก่อน merge สำคัญ, ก่อน prod | review สั้นๆ inline |
| **JAN** (Token mgr) | `fewer-permission-prompts` | เมื่ออยากลด prompt | กฎ 10 ข้อ inline |
| **PO** | `product-management:brainstorm` | feature ใหม่ที่ยังไม่ชัด | tweak feature เดิม |
| **PM** | `product-management:sprint-planning` / `roadmap-update` / `metrics-review` | วางแผน sprint จริง | priority list สั้นๆ |
| **BA** | `product-management:write-spec` / `superpowers:writing-plans` | feature ที่ logic ซับซ้อน | spec สั้น |
| **SA** | `engineering:architecture` / `engineering:system-design` / `engineering:tech-debt` | refactor ใหญ่ / table ใหม่ | suggest pattern inline |
| **UX** | `design:design-critique` / `ux-copy` / `accessibility-review` / `design-system` | screen ใหม่ / WCAG audit | tweak copy/color |
| **FE** | (ใช้ L's skill) | (ตามทีหลัง: figma:figma-generate-design ถ้ามี mock) | edit component |
| **BE** | (ใช้ L's skill) | — | endpoint เล็ก |
| **QA** | `engineering:testing-strategy` / `superpowers:test-driven-development` / `superpowers:verification-before-completion` / `superpowers:systematic-debugging` | งานสำคัญ ต้องทำ TDD | test case แนะนำ inline |
| **DEV** | `engineering:deploy-checklist` / `engineering:incident-response` / `run` | deploy / outage จริง | restart server |

## Trigger Phrases (ผู้ใช้พิมพ์สั้นได้)

| พิมพ์ | = ทำอะไร |
|---|---|
| `ใช้ L` | invoke recursive-senior-dev (เริ่ม 5-loop) |
| `ขอ BOB review` | invoke code-review skill |
| `ขอ BOB ตรวจ security` | invoke security-review |
| `ขอ BOB verify` | invoke verify skill |
| `JAN เช็ค` | tally token cost ของ session/plan |
| `PO ระดมสมอง <topic>` | invoke product-management:brainstorm |
| `BA spec <feature>` | invoke write-spec |
| `SA design <thing>` | invoke architecture |
| `UX critique` | invoke design-critique |
| `QA plan test` | invoke testing-strategy |
| `DEV deploy check` | invoke deploy-checklist |
| (ไม่พิมพ์อะไรพิเศษ) | persona คุยกัน inline (free) |

---

# 🔄 WORKFLOW v2 — Lean Pipeline

ก่อนหน้านี้มี 9 stages — ตอนนี้รวบเหลือ **5 phases** ใช้ของจริง:

```
[1] DISCOVER     →  [2] PLAN  →  [3] BUILD (L's 5-loop) → [4] REVIEW → [5] SHIP
   (PO/PM/UX)        (BA/SA)       (L = recursive-senior-dev)  (BOB+QA)    (DEV)
```

## Phase 1 — DISCOVER (ฟรี ถ้าง่าย / paid ถ้าซับซ้อน)
- User บอก problem/feature
- PO/PM ตั้งคำถาม → ทำให้ชัด
- ถ้ายังคลุมเครือ → invoke `product-management:brainstorm`
- Output: 1-line problem statement

## Phase 2 — PLAN (paid เมื่องานใหญ่)
- BA แตก requirements
- SA design data/API
- UX วาด flow ในใจ (หรือ invoke `design:design-critique`)
- ถ้างานใหญ่ → invoke `superpowers:writing-plans` ทำแผนเป็นไฟล์
- Output: TODO list + acceptance criteria

## Phase 3 — BUILD (L's 5-Loop — ของจริงเลย)
จาก `anthropic-skills:recursive-senior-dev`:
1. **Analyze** เดิม (anti-patterns, debt, complexity)
2. **Propose** architecture/pattern + trade-offs
3. **Implement** + self-review (3 หมวก: QA/Perf/Architect)
4. **Reflect** — เก็บ Lessons Learned
5. **Compare** v(N) vs v(N-1) — ต้องดีขึ้น 1 มิติ

## Phase 4 — REVIEW (paid ทุก feature สำคัญ)
- BOB invoke `code-review` (correctness) + `security-review` (ถ้ามี auth/secrets)
- QA invoke `verify` (run app, check จริง) + `testing-strategy` (ถ้าต้อง TDD)
- ถ้าเจอบั๊ก → `superpowers:systematic-debugging`

## Phase 5 — SHIP (paid เมื่อ deploy จริง)
- DEV invoke `engineering:deploy-checklist`
- Update `team-notes.md` Lessons Learned section
- Optional: `engineering:documentation` ถ้ามี user-facing docs

---

# 📋 Log of Lessons Learned — รอบ v2 model upgrade

### ✅ บทเรียนที่ได้รับ
- skill library ใหญ่มาก → **อย่าโหลดทั้งหมด** = token bomb. invoke on demand เท่านั้น
- `recursive-senior-dev` skill = แม่แบบ workflow ที่ดีกว่าที่เราเคยทำ → adopt 5-loop เป็นมาตรฐาน
- 9 personas × 9 stages = overhead เกิน → รวบเป็น **5 phases** ทำงานเร็วขึ้น

### 🆕 เทคนิคใหม่
- **Trigger phrases** = ผู้ใช้พิมพ์สั้น, ระบบเข้าใจ → ลด typing overhead
- **Default-free, upgrade-paid** = persona คุยใน head ฟรี, invoke skill จริงเมื่อ ROI สูง
- **3 หมวก self-review** (QA/Perf/Architect) ก่อนส่งโค้ด — adopt เข้า BOB workflow

### 📏 กฎใหม่
- **RULE-T1**: ก่อน invoke skill ใหม่ → JAN เช็คก่อนว่า value > token cost
- **RULE-T2**: feature ใหญ่ → ใช้ 5-loop ของ L. feature เล็ก → talk inline
- **RULE-T3**: ทุก feature ที่ merge → BOB invoke `code-review` อย่างน้อย 1 ครั้ง
- **RULE-T4**: เก็บ Lessons Learned ที่ team-notes.md ทุก iteration

### 🎯 เป้าหมายรอบถัดไป
- หัดใช้ trigger phrases จริง 1 รอบเต็ม (เช่น `ใช้ L` build PRAGMA action items v4)
- ลด typing ของผู้ใช้ลง 50% ผ่าน trigger phrase

---

## 🌐 Web-research Skill Pack v5 (May 2026) — Next-Gen POS

ค้นจริง 3 หัวข้อ: AI features / cloud-native + offline-first / omnichannel integration
จุดประสงค์ = หา gap ระหว่าง FoodPOS ปัจจุบัน vs industry 2026

### 📊 Gap Analysis Matrix

| Feature | FoodPOS ตอนนี้ | Industry 2026 standard | Gap |
|---|---|---|---|
| QR ordering | ✅ CustomerOrder.jsx | ✅ standard | none |
| Kitchen display | ✅ KDS | ✅ standard + analytics | partial |
| Multi-printer | ✅ 4 channels | ✅ | none |
| **AI voice ordering** | ❌ | drive-thru, phone | big |
| **Demand forecasting** | ❌ | weather + events + day | medium |
| **Auto inventory orders** | ❌ | dynamic thresholds | medium |
| **Menu profitability rank** | ❌ | margin not popularity | small |
| **Offline-first** | ❌ (LAN-online) | mandatory (Chick-fil-A) | **big** |
| **Multi-device sync** | ❌ single SQLite | CRDT / HLC / version | big |
| **Delivery aggregator** | ❌ | LineMan/Grab/Panda (TH) | medium |
| **Self-service kiosk** | partial (mobile) | dedicated kiosk mode | small |
| **Built-in CRM** | ❌ | profile + history + marketing | medium |
| **Multi-payment** | partial (cash + slip) | card/wallet/crypto/QR | medium |
| **BYOD** | ✅ (Capacitor APK) | ✅ | none |

### 🎯 What to Adopt (เรียงตาม ROI สูงสุด)

**Tier 1 — High value, low effort (1-3 วัน)**
1. **Menu profitability ranking** (margin-based)
   - มีข้อมูล cost ของ menu items อยู่แล้ว
   - เพิ่ม column `cost` ใน menu_items + report endpoint
   - chart: top 10 by margin (revenue × margin)
   - SA: 1 migration + 1 SQL aggregate

2. **Self-service kiosk mode** (สำหรับ tablet ที่ตั้งหน้าร้าน)
   - reuse CustomerOrder.jsx → `?kiosk=1` query param
   - lock screen mode (กลับหน้าหลักอัตโนมัติหลัง 30s)
   - bigger touch targets
   - FE: 1 component variant + lock timer

3. **Customer ID + simple CRM** (ไม่ต้องเต็ม)
   - เก็บเบอร์โทร / line user id ตอนสั่ง
   - ดูประวัติการสั่งย้อนหลัง
   - แสดง "เคยสั่งเมนูนี้" badge
   - SA: customers table + FK ใน orders

**Tier 2 — Medium value, medium effort (1 สัปดาห์)**
4. **Demand forecasting (simple version)**
   - moving avg 4 สัปดาห์ ของ orders/ชม. แยกตามวันในสัปดาห์
   - แสดง predict orders tonight ในหน้า Dashboard
   - ไม่ต้องใช้ ML — แค่ aggregate query + Recharts
   - BE: 1 endpoint + FE chart

5. **Delivery aggregator integration (TH market)**
   - LineMan, GrabFood, FoodPanda มี API
   - Phase 1: import orders manually → enter ใน POS
   - Phase 2: webhook receiver → auto-create order
   - BE: 1 endpoint + secret keys + status sync

6. **Auto inventory threshold**
   - ทำต่อจาก inventory module (ถ้ามี)
   - threshold dynamic = avg consumption × safety factor
   - alert เมื่อต่ำกว่า → LINE notify

**Tier 3 — High value, high effort (1-2 เดือน) — ทำเมื่อสเกล**
7. **Offline-first + multi-device sync**
   - ปัจจุบัน FoodPOS = LAN-only, server เดียว
   - ถ้าจะขยายเป็น chain → ต้อง CRDT หรือ HLC
   - ทาง option:
     - **PouchDB + CouchDB** (proven sync, JSON-based)
     - **RxDB** (TypeScript, CRDT support)
     - **ElectricSQL** (Postgres + offline-first, แต่ต้องเปลี่ยนจาก SQLite)
     - **Custom HLC** + better-sqlite3 (เก็บ SQLite, เพิ่ม sync layer)
   - SA: ใหญ่ ต้อง spec ก่อนสร้าง

8. **AI voice ordering**
   - ใช้ third-party (SoundHound / Incept AI) เกินทุน SME
   - หรือ self-host (Whisper STT + LLM intent parser + TTS) — เป็นไปได้แต่ค่าใช้จ่ายสูง
   - postpone จนกว่า restaurant chain ใหญ่จะ adopt

9. **Multi-payment gateway**
   - PromptPay QR ✓ (ทำได้ง่าย — แค่ generate QR ตาม EMV spec)
   - True Money / ShopeePay / GrabPay — มี API
   - Card (Stripe Thailand / Omise) — ต้องสมัคร PCI

### 🔧 Architecture Decision Points

**Offline-first ต้องตัดสินใจก่อน:**
- FoodPOS ปัจจุบัน = single SQLite + LAN. ทำงานได้ดีถ้า WiFi ดี
- ถ้า WiFi ดับ → cashier ใช้ POS ไม่ได้เลย ← problem
- Quick win: ทำให้ frontend **cache last menu + cart** ใน localStorage → ยังกดสั่งได้, sync ตอน online
- Real fix: เปลี่ยนเป็น offline-first DB (PouchDB / RxDB) → ใหญ่กว่า

**Multi-tenant / chain support:**
- ถ้า FoodPOS จะขายให้หลายร้าน → ต้อง tenant_id ทุก table
- หรือ deploy 1 instance ต่อร้าน (ที่ทำตอนนี้) — simpler แต่ scale ลำบาก

### 📋 Action items v5

| Priority | งาน | Tier | Effort |
|---|---|---|---|
| 🔥 | Menu profitability ranking | T1 | 3-4 ชม. |
| 🔥 | Self-service kiosk mode | T1 | 4-6 ชม. |
| 🔥 | localStorage offline cache (quick win) | T1 | 2-3 ชม. |
| Med | Customer phone + CRM lite | T1 | 1 วัน |
| Med | Demand forecasting (simple) | T2 | 1-2 วัน |
| Med | Delivery aggregator manual import | T2 | 1 วัน |
| Low | PromptPay QR gateway | T2 | 1 วัน |
| Spec | Offline-first DB migration plan | T3 | 1 วัน spec only |

> รอ user สั่ง — JAN: ห้ามทำเอง

### 📋 Log of Lessons Learned — รอบ v5

#### ✅ บทเรียน
- "Next-gen POS" 2026 = **AI + offline-first + omnichannel + CRM** ทั้ง 4 ขา
- **Offline-first ไม่ใช่ option อีกแล้ว** — Chick-fil-A และ chain ใหญ่ทุกเจ้าทำเป็น mandatory
- Self-service kiosk → ticket size **+15-30%** = quick win สำหรับ FoodPOS
- AI voice ordering = ของจริงแล้ว แต่ต้นทุนยังเกินทุน SME — ไม่ต้องรีบ
- BYOD เติบโต **300% since 2020** — FoodPOS มี Capacitor APK อยู่แล้ว ✓

#### 🆕 เทคนิคใหม่
- **CRDT** (Conflict-Free Replicated Data Types) — sync แบบไม่ lock
- **Hybrid Logical Clocks (HLC)** — ordering แม้ clock skew
- **Delta sync** — ส่งเฉพาะ diff ลด bandwidth
- **Priority sync** — completed bills > background data

#### 📏 กฎใหม่
- **RULE-P1**: feature ใหม่ที่กระทบ data layer → ถาม "ทำงาน offline ได้ไหม"
- **RULE-P2**: ทุก critical write (order, payment) → ต้อง queue + retry policy
- **RULE-P3**: ROI = ticket size impact × ease of adoption — ทำ T1 ก่อน T3 เสมอ
- **RULE-P4**: ก่อน build offline-first DB → spec architecture เป็นไฟล์ก่อน, ห้าม improvise

#### 🎯 เป้าหมายรอบถัดไป
- เลือก 1 item จาก T1 (menu profitability / kiosk mode / localStorage cache) มาทำจริง
- ใช้ trigger phrase ทดสอบ workflow v2 (`ใช้ L ทำ <งาน>`)

---

## Sources (v5 research)

- [POS Trends 2026 — Lithos POS](https://lithospos.com/blog/pos-system-trends-2026-ai-voice-ordering-cloud-technology-reshaping-retail-and-restaurants/)
- [2026 Restaurant Dining Trends — HungerRush](https://www.hungerrush.com/restaurant-operations/2026-restaurant-dining-trends/)
- [10 Restaurant Tech Trends 2026 — Rezku](https://rezku.com/blog/10-restaurant-technology-trends-to-for-2026-and-beyond/)
- [Restaurant POS 2026 White Paper — IFBTA](https://www.ifbta.org/restaurant-pos-2026/)
- [Next-Gen POS 2026 — PromoteProject](https://www.promoteproject.com/article/212799/next-gen-pos-systems-for-restaurants-in-2026-you-should-know)
- [Offline-First POS — Aaron LaBeau](https://medium.com/@alabeau/why-offline-first-architecture-is-no-longer-optional-for-pos-systems-15fd6edc133b)
- [Offline Sync & Conflict Resolution Patterns — Sachith](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/)
- [CRDTs & Local-First Architecture — smallstack](https://earezki.com/ai-news/2026-04-08-crdts-and-local-first-architecture-how-smallstack-handles-offline-conflict-resolution/)
- [ObjectBox Sync Conflict Resolution](https://objectbox.io/customizable-conflict-resolution-for-offline-first-apps/)
- [QSR Self-Service Kiosks 2026 — GRUBBRR](https://grubbrr.com/qsr-self-service-kiosks-2026/)
- [Restaurant POS Integrations 2026 — POSBytz](https://posbytz.com/restaurant/restaurant-pos-integrations/)
- [Toast Drive-Thru Launch 2026](https://pos.toasttab.com/news/toast-drive-thru-launch-2026)

---

## 🌐 Web-research Skill Pack v6 (May 2026) — TH Market & Business Layer

ค้นจริง 3 หัวข้อ: **LINE OA / Loyalty Program / Inventory + Recipe BOM**
จุดประสงค์ = เพิ่ม **business layer** บน FoodPOS ที่ตอนนี้มีแค่ operations layer

---

### 📱 LINE OA + LIFF — TH market essential

**ตัวเลขสำคัญ:**
- ร้านที่ active LINE OA → **repeat visit rate +15-25%**
- ไทย = mobile-first market, LINE = main channel
- 2026 trend: chat commerce + instant rewards

**ฟีเจอร์ที่ควรมี:**
| ฟีเจอร์ | ทำได้ทาง |
|---|---|
| Customer ID stable | LINE Login → userId (sub) |
| ดูประวัติสั่ง | LIFF page เปิดใน chat (ไม่ออกจาก LINE) |
| ดู points / member card | LIFF page |
| รับ promotion broadcast | LINE Messaging API |
| Auto-reply เมนู/ที่อยู่/เวลา | LINE webhook + reply API |
| จองโต๊ะ | LIFF form |
| QR scan ใบเสร็จ → add point | LINE Beacon หรือ QR ปรกติ |

**Best practice (จาก research):**
- **อย่าแยก LINE จาก commerce** — ถ้าให้ลูกค้า exit LINE ไปจ่ายที่อื่น → drop-off สูง
- LINE → LIFF (ใน LINE) → confirm order → ยังอยู่ใน LINE ทั้ง flow
- ทุก member ต้อง map ไปยัง **stable customer_id** (LINE userId) ใน DB
- Segment: RFM (Recency, Frequency, Monetary) → broadcast ตาม segment

**FoodPOS implication:**
- ปัจจุบัน CustomerOrder.jsx = QR เปิด web → ไม่ผ่าน LINE
- Upgrade path: เพิ่ม `LINE Login` ที่หน้านี้ → ได้ userId → link กับ orders
- LIFF endpoint: `/api/liff/orders/:userId` → return history
- Webhook: `/api/line/webhook` → handle text messages

---

### 🎁 Loyalty Program — ROI ของจริง

**ตัวเลขสำคัญจาก research:**
- Members visit **22% บ่อยกว่า** non-members
- Members spend **38% มากกว่า** ต่อครั้ง
- **5% retention เพิ่ม = profit เพิ่ม 25-95%**
- Redemption rate **<10% = reward ยากเกิน** → ลูกค้าไม่อยากแลก

**โครงสร้างที่เลือกใช้:**

| ประเภท | เหมาะกับ | FoodPOS |
|---|---|---|
| **Stamp card** | QSR, coffee (visit รายวัน) | สำหรับร้านที่ visit ถี่ |
| **Points** | casual dining (monthly) | ✅ default ของเรา |
| **Tier** (Silver/Gold/Plat) | combine กับ points | T2 — เพิ่มภายหลัง |

**Design rule จาก research:**
- **1:1 ratio** ง่ายสุดสำหรับลูกค้าเข้าใจ (1 บาท = 1 point)
- **Visible progress bar** = psychology trick → กระตุ้น repeat
- **Easy redemption**: scan QR → reward ทันที (ห้ามต้อง register / verify ยุ่งยาก)
- **Reward tier**:
  - 100 pt = ฟรีน้ำเปล่า / ขนมเล็ก
  - 500 pt = ส่วนลด 10%
  - 1000 pt = เมนูฟรี 1 รายการ
  - Tier upgrade: Gold (3000 pt), Platinum (10000 pt) — เปลี่ยน badge + เพิ่ม reward

**Schema สำหรับ FoodPOS:**
```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  line_user_id TEXT UNIQUE,
  phone TEXT,
  name TEXT,
  points INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'silver',
  total_spent_thb REAL DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  last_visit_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loyalty_transactions (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  order_id INTEGER REFERENCES orders(id),
  points_delta INTEGER NOT NULL,  -- + earn / - redeem
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- เพิ่ม FK ใน orders
ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id);
```

**Metric ต้อง track:**
- Member vs non-member: avg ticket / visit freq / total spend
- Redemption rate (ถ้า <10% → reward ยากเกิน)
- Tier distribution (ส่วนใหญ่อยู่ tier ไหน)
- CLV (Customer Lifetime Value)

---

### 📦 Inventory + Recipe BOM — Cost Control

**ตัวเลขสำคัญ:**
- **AvT variance** (Actual vs Theoretical) = KPI หลักของ chef
- Best-in-class: **< 1%**
- Normal: **5-10%**
- Bad: **> 15%** → profit leakage รุนแรง

**สูตร:**
```
Theoretical usage = Σ (orders × recipe BOM per item)
Actual usage      = opening stock + purchases - closing stock
Variance %        = (actual - theoretical) / theoretical × 100
```

**Cause of variance (research):**
- inconsistent portioning (chef ตักเยอะ/น้อย)
- waste / spoilage
- inaccurate counts
- vendor price change
- invoicing error
- employee theft / shrinkage

**Schema สำหรับ FoodPOS:**
```sql
CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,           -- กรัม, มิลลิลิตร, ชิ้น
  cost_per_unit REAL NOT NULL,  -- บาท/หน่วย ปัจจุบัน
  stock_qty REAL DEFAULT 0,
  reorder_level REAL,
  supplier TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- BOM: เมนูแต่ละจาน ใช้ ingredient อะไรบ้าง
CREATE TABLE recipe_items (
  id INTEGER PRIMARY KEY,
  menu_item_id INTEGER REFERENCES menu_items(id),
  ingredient_id INTEGER REFERENCES ingredients(id),
  qty REAL NOT NULL,            -- ใช้กี่หน่วย/จาน
  UNIQUE(menu_item_id, ingredient_id)
);

-- รับของเข้า
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY,
  ingredient_id INTEGER REFERENCES ingredients(id),
  qty REAL NOT NULL,
  cost REAL NOT NULL,
  vendor TEXT,
  invoice_no TEXT,
  purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ตรวจสอบ stock จริง (รายวัน/สัปดาห์)
CREATE TABLE inventory_counts (
  id INTEGER PRIMARY KEY,
  ingredient_id INTEGER REFERENCES ingredients(id),
  counted_qty REAL NOT NULL,
  expected_qty REAL,            -- จาก purchase - theoretical usage
  variance_qty REAL,
  counted_by INTEGER REFERENCES users(id),
  counted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Workflow:**
1. Set up: ตั้ง ingredients + recipes ครั้งเดียว
2. รับของ: บันทึก `purchases` → stock_qty += qty
3. ขายอาหาร: trigger ลด stock ตาม recipe BOM (theoretical)
4. รายสัปดาห์: cashier นับ `inventory_counts`
5. Report: `actual - theoretical` ต่อ ingredient → highlight variance > 10%

---

### 📊 Gap Analysis FoodPOS

| Feature | มีไหม | Priority |
|---|---|---|
| LINE Login | ❌ | 🔥 T1 |
| LIFF order history page | ❌ | 🔥 T1 |
| Customer table + phone/LINE ID | ❌ | 🔥 T1 |
| Points 1:1 | ❌ | 🔥 T1 |
| Redemption flow (QR scan) | ❌ | Med T2 |
| Tier system + progress bar | ❌ | Med T2 |
| LINE webhook auto-reply | ❌ | Med T2 |
| LINE broadcast promo | ❌ | Med T2 |
| Ingredients table | ❌ | Med T2 |
| Recipe BOM | ❌ | Med T2 |
| Purchase tracking | ❌ | Med T2 |
| Inventory count workflow | ❌ | Med T2 |
| AvT variance report | ❌ | Low T3 |
| RFM segmentation | ❌ | Low T3 |

---

### 📋 Action items v6

| Priority | งาน | Tier | Effort |
|---|---|---|---|
| 🔥 | customers table + LINE userId + phone | T1 | 4-6 ชม. |
| 🔥 | LINE Login ใน CustomerOrder.jsx | T1 | 1 วัน |
| 🔥 | Points 1:1 earn on order paid | T1 | 4 ชม. |
| 🔥 | LIFF: ดูประวัติ + point balance | T1 | 1 วัน |
| Med | Redemption flow (QR scan → admin approve) | T2 | 1 วัน |
| Med | Tier system + progress bar (visible psychology) | T2 | 1 วัน |
| Med | LINE webhook auto-reply (menu, hours) | T2 | 1 วัน |
| Med | LINE broadcast promo (push API) | T2 | 1-2 วัน |
| Med | ingredients + recipe_items tables | T2 | 4-6 ชม. |
| Med | Purchase tracking UI | T2 | 1 วัน |
| Med | Inventory count workflow (mobile-friendly) | T2 | 1-2 วัน |
| Low | AvT variance report (weekly) | T3 | 2-3 วัน |
| Low | RFM segmentation + targeted broadcast | T3 | 3-4 วัน |

> รอ user สั่ง — JAN: ห้ามทำเอง

### 📋 Log of Lessons Learned — รอบ v6

#### ✅ บทเรียน
- **LINE OA = backbone marketing สำหรับร้านไทย** ไม่ใช่ option
  - 15-25% repeat visit rate boost = ROI ชัด
- **Loyalty points 1:1 ratio** ง่ายและคุ้ม — สลับซับซ้อนกว่านี้ลูกค้าไม่เข้าใจ
- **Visible progress bar** = psychology hack ที่ research backup
- **AvT variance** = KPI ที่ chef ทุกร้านควรรู้, FoodPOS ตอนนี้ track ไม่ได้เลย
- Tier 1 ทำลำดับ: customers → LINE Login → points → LIFF history. ปูฐาน 1 อย่าง = unlock อีก 5-6 features

#### 🆕 เทคนิคใหม่
- **RFM segmentation** (Recency, Frequency, Monetary) — แยกลูกค้าก่อนยิง broadcast
- **Theoretical vs Actual variance** — สูตร AvT
- **LINE userId เป็น stable customer_id** — ไม่ต้องสร้าง auth ของตัวเอง
- **Easy redemption rule**: ถ้า <10% redeem → reward ยากเกิน → ลด

#### 📏 กฎใหม่
- **RULE-M1**: ทุก loyalty feature → ต้องวัด redemption rate; ถ้า <10% → revisit reward
- **RULE-M2**: LINE flow ห้ามให้ user exit LINE → keep all in LIFF
- **RULE-M3**: ทุก order paid → trigger points earn (atomic, ต่อใน transaction)
- **RULE-M4**: ก่อน Inventory feature → ต้องตั้ง recipe BOM ทั้งหมดก่อน (foundation)
- **RULE-M5**: Variance > 15% บน ingredient ใด ๆ → alert chef + investigate ภายใน 24 ชม.

#### 🎯 เป้าหมายรอบถัดไป
- ทำ Tier 1 ครบ (customers + LINE Login + points + LIFF) เป็น **mini-sprint** 1
- หลังเสร็จ → mini-sprint 2 ทำ Inventory (T2)

---

## ✅ Iteration log — Redeem Points at Checkout (2026-05-26)

### Done
- Migration: `orders.points_redeemed INTEGER NOT NULL DEFAULT 0` (ensureColumn)
- Backend POST /api/orders: รับ `points_redeemed` → clamp ≤ min(member.points, subtotal-discount) → atomic deduct ผ่าน `UPDATE members SET points = points - ? WHERE id = ? AND points >= ?` + check changes=1 → INSERT loyalty_transactions (reason='redeem:order')
- Frontend POSPage: dropdown member แสดง "X แต้ม", input + Max button (เฉพาะเมื่อ subtotal>0), breakdown แสดงบรรทัด "ใช้แต้ม -฿X", reset เคลียร์ pointsToRedeem, hold bill ไม่ deduct
- QA: 4 cases pass (valid / over-redeem reject / no-member reject / normal no-redeem)
- Audit verified: loyalty_transactions row paired กับ order ทุก redeem

### Limitations (future work)
- ~~Cancel order ไม่คืนแต้มอัตโนมัติ~~ ✅ **fixed 2026-05-26** — refund-on-cancel implemented (idempotent)
- ~~ยังไม่ปริ้นแต้มในใบเสร็จ~~ ✅ **fixed 2026-05-26** — buildFinalReceipt แสดงบรรทัด "ใช้แต้ม (N) -฿N"
- ~~CustomerOrder ลูกค้า QR ใช้แต้มไม่ได้~~ ✅ **fixed 2026-05-26** — port UI จาก POSPage + auto-refresh member.points หลัง submit
- **Members list refresh** — single-terminal ใช้ได้ (await reload() ใน POSPage.submit + loadMember() ใน CustomerOrder.submit). Multi-terminal ต้อง SSE (อยู่ใน v2 backlog `/api/events`)
- Earn points ไม่ rollback เมื่อ complete→cancel (sunk cost design — ของถูกกินไปแล้ว)

### Lessons (BOB+JAN)
- 🔍 BOB: ใช้ `UPDATE...WHERE points>=?` + check `changes=1` กัน race ได้ ไม่ต้อง SELECT ก่อน
- 💰 JAN: hot-restart Task Scheduler (kill PID + Start-ScheduledTask) เร็วกว่า reboot
- 🚀 DEV: ensureDb() ใน server/index.js รัน migration ตอน start ทุกครั้ง → safe to ship column additions
- 🧪 QA: PowerShell console encoding ทำให้ Thai garbled — body จริงส่ง UTF-8 ปกติ ไม่ใช่ bug

---

## Sources (v6 research)

### LINE OA / Thailand
- [LINE Loyalty Program Thailand — MCIX](https://www.mcixagency.com/post/how-to-build-a-line-loyalty-program-that-works-in-thailand)
- [Restaurant Marketing Thailand 2026 — Sphere](https://sphereagency.com/articles/restaurant-marketing-thailand)
- [LINE CRM Integration Thailand — Communicat-O](https://www.communicat-o.com/line-oa-integration-with-crm/)
- [LINE Marketing 2026 — Everyday Marketing](https://everydaymarketing.co/marketing-platform/line-marketing-strategy-2026/)
- [LINE OA #1 for Restaurant Bookings — Markedine](https://www.markedine.com/line-oa-restaurant-bookings-thailand/)
- [LINE OA Setup Guide Thailand 2026 — Sphere](https://sphereagency.com/articles/line-oa-setup-guide-thailand)

### Loyalty Programs
- [Restaurant Loyalty 2026 Complete Guide — BonusQR](https://bonusqr.com/article/restaurant-loyalty-programs-the-complete-guide-for-2026)
- [Maximize Loyalty ROI 2026 — BonusQR](https://bonusqr.com/article/maximize-loyalty-program-roi-in-hospitality-in-2026)
- [Loyalty Program Structures 2026 — FaveCard](https://www.favecard.co/en/blog/restaurant-loyalty-program/)
- [10 Successful Loyalty Examples — OpenLoyalty](https://www.openloyalty.io/insider/restaurant-loyalty-programs-10-successful-examples)
- [Punch Cards vs Points vs Tiers — DoorDash](https://merchants.doordash.com/en-us/blog/restaurant-loyalty-roi)

### Inventory & Recipe BOM
- [Actual vs Theoretical Food Cost — Crunchtime](https://www.crunchtime.com/blog/blog/explaining-actual-vs-theoretical-food-cost-variance)
- [Closing the Gap AvT — Restaurant365](https://www.restaurant365.com/blog/closing-the-gap-between-actual-and-theoretical-food-costs/)
- [Inventory Management Best Practices — Altametrics](https://altametrics.com/control-restaurant-food-cost/inventory-management-and-best-practices.html)
- [Waste & Variance Reporting — Restaurant365](https://www.restaurant365.com/blog/restaurant-waste-and-variance-reporting/)
- [Food Cost Variance Control — Supy](https://supy.io/blog/food-cost-variance-control)

---

## Sources (v4 research)

- [Thailand e-Tax Invoice — EDICOM](https://edicomgroup.com/blog/thailand-electronic-invoicing-model)
- [Thailand e-Tax compliance — Pagero](https://www.pagero.com/compliance/regulatory-updates/thailand)
- [e-Tax Invoice SME checklist](https://www.gentlelawibl.com/post/thailand-e-tax-invoice-and-e-receipt-2025-a-compliance-checklist-for-smes)
- [Revenue Department official](https://www.rd.go.th/english/30115.html)
- [SQLite Query Optimizer (official)](https://sqlite.org/optoverview.html)
- [SQLite Production Setup 2026](https://oneuptime.com/blog/post/2026-02-02-sqlite-production-setup/view)
- [Android SQLite best practices](https://developer.android.com/topic/performance/sqlite-performance-best-practices)
- [phiresky — SQLite performance tuning](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/)
- [Restaurant KPIs 2026 — OrderIt](https://orderitnow.in/blog/13-restaurant-analytics-kpis-every-owner-must-track-daily-2026-guide/)
- [Real-time data in restaurants 2026](https://restauranttechnologynews.com/2026/01/research-79-of-restaurants-say-real-time-data-is-essential-yet-27-cant-reliably-track-basic-kpis/)
- [KDS efficiency — Lavu](https://lavu.com/5-ways-kitchen-display-systems-improve-restaurant-efficiency/)
