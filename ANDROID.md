# FoodPOS — Android App (Capacitor)

ห่อเว็บแอป FoodPOS ด้วย Capacitor ออกมาเป็น Android APK ติดตั้งบนแท็บเล็ต/มือถือได้
ใช้ได้ทั้งฝั่ง **Admin POS** (login PIN เข้าระบบ) และ **Customer Ordering** (สแกน QR หรือเข้า /order)

---

## โครงสร้าง

- React/Vite build → bundled เป็น `android/app/src/main/assets/public/`
- เปิดแอปครั้งแรก → หน้า **Setup** ให้กรอก URL ของ Server (เช่น `http://192.168.1.100:3000`)
- หลังบันทึก → WebView redirect ไป server โดยตรง = แอปเหมือนเปิด browser ค้าง URL นั้นเลย
- URL จำใน localStorage ของแอป — เปิดครั้งหลังเด้งเข้าทันที

---

## เครื่องที่ต้องมี (ติดตั้งครั้งเดียว)

1. **Android Studio** (Hedgehog ขึ้นไป) — https://developer.android.com/studio
   - ตอนติดตั้งให้ติด ✅ Android SDK + Android SDK Platform + Android Virtual Device
2. **JDK 17+** (Android Studio มักลงให้แล้ว)
3. **Node.js + npm** (มีอยู่แล้ว — server ใช้)

ตรวจ:
```bash
java -version    # ต้อง 17+
adb --version    # ต้องมี (อยู่ใน Android SDK platform-tools)
```

---

## วิธี build APK (สำหรับ dev / install เอง)

```bash
cd C:\Users\KIMPCs\Documents\foodpos-ui

# 1. Build web + sync ไปยัง Android project
npm run android:sync

# 2. เปิด Android Studio
npm run android:open
```

ใน Android Studio:
1. รอ Gradle sync เสร็จ (มุมล่างขวาขึ้น "Gradle sync finished")
2. เมนู **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. รอจนเสร็จ → กดลิงก์ **locate** เพื่อหาไฟล์
4. ไฟล์อยู่ที่: `android\app\build\outputs\apk\debug\app-debug.apk`

---

## ติดตั้ง APK บนมือถือ/แท็บเล็ต

วิธีง่ายที่สุด:
1. ส่งไฟล์ `app-debug.apk` ไปที่มือถือ (ผ่าน Google Drive / LINE / USB)
2. ในมือถือ: เปิดไฟล์ → กด **Install** → อนุญาต "ติดตั้งจากแหล่งไม่รู้จัก"
3. เปิดแอป **FoodPOS** → หน้าตั้งค่าครั้งแรก
4. กรอก URL ของ Server เช่น `http://192.168.1.100:3000`
5. กด **"ทดสอบเชื่อมต่อ"** → ✓ สำเร็จ
6. กด **"บันทึก + เข้าใช้งาน"** → เข้าใช้งานปกติ

> ⚠️ มือถือต้องอยู่ใน **WiFi เดียวกัน** กับ PC ที่รัน server (เช่น Sukit_5G)

---

## วิธี run ผ่าน Android Studio Emulator

1. เปิด Android Studio
2. **Device Manager** → สร้าง Virtual Device (Pixel 6 + API 34)
3. กดปุ่ม ▶ **Run 'app'** บนแถบเครื่องมือ
4. แอปจะติดตั้งใน emulator → เปิดเอง
5. ตอนตั้งค่า server URL ใส่ `http://10.0.2.2:3000` (= localhost ของ host PC จาก emulator)

---

## ใช้บนเครื่องจริงผ่าน USB

1. เสียบมือถือเข้า PC ด้วย USB
2. มือถือ: เปิด **Developer Options** + **USB Debugging**
3. ใน Android Studio: เลือกอุปกรณ์ที่เจอ → กด ▶
4. แอปติดตั้งและเปิดอัตโนมัติ

---

## Build Release APK (พร้อมเซ็น signing key — สำหรับแจกจริง)

1. ใน Android Studio: **Build → Generate Signed Bundle / APK**
2. เลือก **APK** → Next
3. **Create new keystore...** (เก็บไฟล์ + password ดีดี ใช้ทุกครั้งที่อัปเดตแอป)
4. กรอกข้อมูล signing → Next
5. เลือก **release** build variant
6. ✅ ทั้ง V1 และ V2 signature
7. กด **Finish** → APK release อยู่ที่ `android\app\build\outputs\apk\release\app-release.apk`

---

## อัปเดตแอปหลังแก้โค้ด

หลังแก้ React code ใน `src/`:
```bash
npm run android:sync    # build + copy ไป android project
```
แล้วใน Android Studio กดปุ่ม ▶ run ใหม่ หรือ build APK ใหม่ → ส่งไปติดตั้งทับ

---

## Troubleshooting

**Q: เปิดแอปแล้วเข้า server ไม่ได้**
A:
- มือถืออยู่ WiFi เดียวกับ PC?
- PC firewall เปิดให้ port 3000? (รัน `scripts\open-firewall.bat` แบบ admin)
- IP เปลี่ยนแล้ว? ใน app ไปที่ http://<ip>:3000/setup ใหม่ หรือลบ localStorage → ตั้งใหม่
- ลองเปิด Chrome บนมือถือ → `http://192.168.1.100:3000/api/health` → ต้องได้ `{ok:true}`

**Q: APK ติดตั้งไม่ได้ "App not installed"**
A: ลบเวอร์ชันเก่าก่อน (Settings → Apps → FoodPOS → Uninstall) แล้วลงใหม่

**Q: ต้องการล้าง server URL ที่จำไว้**
A: Settings → Apps → FoodPOS → **Clear storage** → เปิดแอปใหม่ → เด้งเข้าหน้า Setup

**Q: HTTP ใช้ไม่ได้ บอกว่า cleartext blocked**
A: ผมตั้ง `usesCleartextTraffic="true"` ใน AndroidManifest แล้ว ถ้ายังเจอ ลอง rebuild (`npm run android:sync`)

**Q: เปลี่ยน app icon**
A: แทนที่ไฟล์ใน `android\app\src\main\res\mipmap-*` ทุก density แล้ว rebuild

**Q: เปลี่ยนชื่อแอป**
A: แก้ `<string name="app_name">FoodPOS</string>` ที่ `android\app\src\main\res\values\strings.xml`

---

## ข้อจำกัด

- App เป็น **WebView wrapper** — ทุกฟีเจอร์ทำงานเหมือนเปิดในเบราว์เซอร์
- **ต้องเชื่อม server เสมอ** — ไม่มี offline mode เต็มรูปแบบ (มี outbox สำหรับ POST orders ที่ทำไว้แล้ว)
- เสียงแจ้งเตือน + Notification ใช้ Web API ปกติ — บน Android อาจเล่นเสียงไม่ได้ถ้าแท็บอยู่ background นาน ๆ (Doze mode)
- ถ้าต้องการ native notification + offline เต็มรูปแบบ → ต้องเพิ่ม Capacitor plugins (LocalNotifications, Storage) — scope แยก
