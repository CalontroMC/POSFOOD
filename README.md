# FoodPOS — ระบบจัดการร้านอาหาร (Self-host)

POS + QR Code โต๊ะ พร้อม deploy บน PC ตัวเอง (Windows) ผ่าน Cloudflare Tunnel — ใช้ฟรี ไม่ต้อง Port Forward

---

## เทคโนโลยีที่ใช้

| Layer | Stack |
|---|---|
| Frontend | React 19 + Vite + Tailwind 3 + React Router 7 + Recharts |
| Backend | Node.js + Express 5 + better-sqlite3 + qrcode |
| Database | SQLite (`data/foodpos.db`) — ไฟล์เดียว ไม่ต้องตั้ง DB server |
| Process Mgr | PM2 (+ pm2-windows-startup) |
| Tunnel | Cloudflare Tunnel (quick หรือ named) |

โครงสร้างโฟลเดอร์:
```
foodpos-ui/
├── server/              Express + SQLite backend
│   ├── index.js          entry point
│   ├── db.js / init-db.js
│   ├── middleware/auth.js
│   └── routes/           menu, tables, orders, members, settings, auth
├── src/                 React frontend
│   ├── pages/            12 admin pages + CustomerOrder + PrintQR
│   ├── auth/             PIN gate + AuthContext
│   ├── layout/           Sidebar, AppLayout
│   ├── components/       PageHeader, StatCard, StatusBadge, EmptyState
│   └── lib/api.js        fetch wrapper + token mgmt
├── data/foodpos.db      SQLite (สร้างอัตโนมัติครั้งแรก)
├── dist/                Vite production build (npm run build)
├── scripts/             *.bat ช่วย deploy
├── ecosystem.config.cjs PM2 config
├── .env / .env.example  ENV variables
└── package.json
```

---

## ⚡ Quick Start (Dev Mode)

```bash
cd C:\Users\KIMPCs\Documents\foodpos-ui
npm install
npm run init-db           # สร้างฐานข้อมูล + seed ข้อมูลตัวอย่าง
npm run dev               # รันทั้ง backend (3000) + frontend (5173) พร้อมกัน
```
เปิด http://localhost:5173 — PIN เริ่มต้น **`1234`** (เปลี่ยนได้ในหน้าตั้งค่า)

---

## 🚀 Production Deploy

### Step A — Build + รัน server บน PC

ตัวเลือกที่ 1 — เทสเร็ว (รันด้วย node ตรง ๆ):
```bash
npm install
npm run build              # บิลด์ frontend ไป dist/
npm run start              # node server/index.js  → http://localhost:3000
```

ตัวเลือกที่ 2 — รันค้างไว้ตลอด ด้วย PM2 (แนะนำ):
```bash
# ติดตั้ง PM2 ครั้งเดียว
scripts\pm2-install.bat

# Build + start
scripts\deploy.bat

# คำสั่งที่ใช้บ่อย
pm2 status                 # ดูสถานะทุก process
pm2 logs foodpos           # ดู log backend
pm2 logs foodpos-tunnel    # ดู log Cloudflare Tunnel
pm2 reload foodpos         # restart โดยไม่มี downtime
pm2 stop foodpos
```
PM2 จะ:
- รัน `foodpos` (server) + `foodpos-tunnel` (Cloudflare)
- restart อัตโนมัติเมื่อ process ตาย
- auto-start ตอนเปิดเครื่องผ่าน `pm2-windows-startup`

---

### Step B — เปิดให้ Online ด้วย Cloudflare Tunnel

**ทำไม Cloudflare Tunnel:** ไม่ต้อง Port Forward, ไม่ต้องมี Public IP, ฟรี, ได้ HTTPS อัตโนมัติ

#### B1) ติดตั้ง cloudflared
```powershell
winget install --id Cloudflare.cloudflared
# หรือดาวน์โหลด .exe จาก https://github.com/cloudflare/cloudflared/releases/latest
```
ตรวจสอบ: `cloudflared --version`

#### B2) ทางเลือก 1 — Quick Tunnel (ไม่ต้องสมัคร account, URL สุ่ม)

```bash
scripts\tunnel-quick.bat
# หรือ
cloudflared tunnel --url http://localhost:3000
```
จะได้ URL ทำนอง `https://random-words-abc.trycloudflare.com` — copy ใส่ใน `.env`:
```
PUBLIC_BASE_URL=https://random-words-abc.trycloudflare.com
```
แล้วรีสตาร์ท server (`pm2 reload foodpos`) เพื่อให้ QR Code embed URL ใหม่

⚠️ Quick Tunnel URL เปลี่ยนทุกครั้งที่รีสตาร์ท tunnel — เหมาะกับเทส ไม่เหมาะกับใช้จริงระยะยาว

#### B3) ทางเลือก 2 — Named Tunnel (URL คงที่, ต้องมี domain ใน Cloudflare)

```bash
# ครั้งแรก
cloudflared tunnel login              # เปิด browser ให้ login Cloudflare
cloudflared tunnel create foodpos     # สร้าง tunnel + credentials file

# Map subdomain  (เช่น pos.mydomain.com)
cloudflared tunnel route dns foodpos pos.mydomain.com
```
ตัวอย่าง `~/.cloudflared/config.yml` (Windows: `C:\Users\<you>\.cloudflared\config.yml`):
```yaml
tunnel: foodpos
credentials-file: C:\Users\KIMPCs\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: pos.mydomain.com
    service: http://localhost:3000
  - service: http_status:404
```
รัน:
```bash
cloudflared tunnel run foodpos
# หรือทำเป็น Windows service:
cloudflared service install
```
จากนั้นใส่ใน `.env`:
```
PUBLIC_BASE_URL=https://pos.mydomain.com
```

---

### Step C — ทางเลือกสำรอง

| วิธี | ข้อดี | ข้อเสีย |
|---|---|---|
| **ngrok** (`ngrok http 3000`) | เร็วที่สุด setup | free plan URL เปลี่ยนทุกครั้ง, มี limit/นาที |
| **Tailscale Funnel** | ปลอดภัย, ใช้ฟรี | ผู้รับต้องไม่อยู่ใน private network |
| **Port Forward + DuckDNS** | ไม่มี middleman | ต้องมี Public IP จาก ISP, ตั้ง router, ต้องทำ HTTPS เอง (Caddy/Nginx + Let's Encrypt) |

---

### Step D — ใส่ Domain ของคุณเองทีหลัง

ใช้ขั้นตอน **B3 — Named Tunnel** เมื่อพร้อม
1. ย้าย NS ของ domain ไปที่ Cloudflare (Cloudflare → Add Site)
2. `cloudflared tunnel route dns <tunnel> <subdomain>`
3. แก้ `PUBLIC_BASE_URL` เป็น HTTPS ของ domain
4. รัน `pm2 reload foodpos`
5. พิมพ์ QR Code ใหม่ทั้งหมด (หน้า /print-qr) เพราะ URL ในนั้นจะเปลี่ยน

---

## 🔑 ENV Variables (.env)

| ตัวแปร | Default | คำอธิบาย |
|---|---|---|
| `PORT` | `3000` | port ของ Express |
| `DB_PATH` | `./data/foodpos.db` | path ของไฟล์ SQLite |
| `PUBLIC_BASE_URL` | (ว่าง) | URL public ที่ QR Code จะฝัง เช่น `https://xxx.trycloudflare.com` — ถ้าว่างจะใช้ host จาก request (ใช้ได้ตอน localhost) |
| `VITE_API_TARGET` | `http://localhost:3000` | Vite dev proxy target |

ดู `.env.example` ประกอบ

---

## ✅ Checklist — ฟังก์ชันที่ทดสอบแล้วผ่าน

| Feature | Endpoint / Page | สถานะ |
|---|---|---|
| Health check | `GET /api/health` | ✅ |
| PIN login | `POST /api/auth/login` | ✅ |
| PIN gate (frontend) | `/` redirect → `<PinLock>` | ✅ |
| ดึงหมวดหมู่ | `GET /api/menu/categories` | ✅ |
| ดึงรายการเมนู | `GET /api/menu/items` | ✅ |
| เพิ่ม/แก้/ลบเมนู | `POST/PATCH/DELETE /api/menu/items/:id` | ✅ |
| ดึงโต๊ะ | `GET /api/tables` | ✅ |
| สร้าง/แก้/ลบโต๊ะ | `POST/PATCH/DELETE /api/tables` | ✅ |
| **QR PNG ของโต๊ะ** | `GET /api/tables/:id/qr.png` | ✅ |
| **QR SVG ของโต๊ะ** | `GET /api/tables/:id/qr.svg` | ✅ |
| **Rotate QR token** | `POST /api/tables/:id/rotate-token` | ✅ |
| **ลูกค้าหาโต๊ะจาก token** | `GET /api/tables/by-token/:token` | ✅ |
| **ลูกค้าส่งออเดอร์** | `POST /api/orders` (public) | ✅ |
| Auto set "มีลูกค้า" | server-side ใน POST orders | ✅ |
| Order numbering ORD01.. | reset รายวัน | ✅ |
| Admin ดู orders | `GET /api/orders` | ✅ |
| Admin เปลี่ยนสถานะ | `PATCH /api/orders/:id/status` | ✅ |
| Auto เก็บแต้ม + ลด status โต๊ะ | เมื่อ status=เสร็จสิ้น | ✅ |
| Dashboard stats | `GET /api/orders/stats/dashboard` | ✅ |
| Member CRUD | `/api/members` | ✅ |
| Settings + เปลี่ยน PIN | `/api/settings` + `/api/settings/pin` | ✅ |
| **พิมพ์ QR ทุกโต๊ะ → PDF** | `/print-qr` (ใช้ browser print) | ✅ |
| Customer mobile UI | `/order?table=<token>` | ✅ |
| Production build | `npm run build` | ✅ |
| Express ส่งไฟล์ dist | `/(*)` non-api → index.html | ✅ |

---

## 🧪 วิธีทดสอบ QR Code จากภายนอกบ้าน

1. รัน server: `pm2 start ecosystem.config.cjs`  (หรือ `npm run start`)
2. รัน Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:3000`
3. คัดลอก `https://xxx.trycloudflare.com` ที่ขึ้นในเทอร์มินัล
4. ใส่ค่านี้ใน `.env`:
   ```
   PUBLIC_BASE_URL=https://xxx.trycloudflare.com
   ```
5. รีสตาร์ท server: `pm2 reload foodpos`
6. เปิดบน PC: `https://xxx.trycloudflare.com/tables` → กดปุ่ม **"พิมพ์ QR ทุกโต๊ะ"** → จะเห็นหน้าพิมพ์ที่มี QR ทุกโต๊ะ
7. **เปิด 4G บนมือถือ** (ปิด WiFi เพื่อให้แน่ใจว่ามาจากเน็ตข้างนอก)
8. เปิดกล้องมือถือ → สแกน QR ของโต๊ะ A1
9. ควรเด้งเข้า `https://xxx.trycloudflare.com/order?table=<token>` พร้อมแสดงหัวข้อ "สั่งอาหาร · โต๊ะ A1"
10. กดเมนู → ยืนยันสั่งอาหาร → กลับมาที่ PC ดูที่ `/orders` ต้องเห็น order ใหม่
11. โต๊ะ A1 ใน `/tables` จะกลายเป็น "มีลูกค้า" อัตโนมัติ

---

## 🛠 Troubleshooting

**Q: QR สแกนแล้วเด้งไป `localhost`**
A: ลืมตั้ง `PUBLIC_BASE_URL` ใน `.env` หรือลืมรีสตาร์ท server

**Q: ลูกค้าสแกนได้แต่หน้าเมนูโหลดไม่ขึ้น**
A: ตรวจ `cloudflared` ยังรันอยู่ + ดู `pm2 logs foodpos-tunnel`

**Q: PIN ลืม**
A: เปิดไฟล์ `data/foodpos.db` ด้วย SQLite browser แล้วแก้คีย์ `admin_pin` ในตาราง `settings` กลับเป็น `1234`

**Q: รีเซ็ตฐานข้อมูล**
A: ปิด server → ลบ `data/foodpos.db*` → `npm run init-db`

**Q: พอร์ต 3000 ชนของอื่น**
A: แก้ `PORT=3001` ใน `.env` + ใน `ecosystem.config.cjs` + restart

---

## 📋 NPM Scripts

| Script | คำอธิบาย |
|---|---|
| `npm run dev` | รัน backend + frontend dev (Vite hot reload) |
| `npm run server:dev` | รันแค่ backend (nodemon) |
| `npm run server` / `npm run start` | รัน production backend |
| `npm run build` | build frontend → `dist/` |
| `npm run init-db` | สร้าง schema + seed |
| `npm run preview` | preview build (ไม่ต้องใช้แล้วเพราะ server serve dist อยู่แล้ว) |
