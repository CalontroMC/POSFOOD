import { useEffect, useState } from "react";
import { Store, Key, Save, LogOut, Volume2, VolumeX, AlertTriangle, Trash2, Play, Printer, Search, CheckCircle2, Wifi, Smartphone } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import SectionTabs, { SECTIONS } from "../components/SectionTabs.jsx";
import Toggle from "../components/Toggle.jsx";
import { apiGet, apiPut, apiPost } from "../lib/api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { getNotifVolume, setNotifVolume, previewBeep } from "../lib/useOrderNotifications.js";
import {
  browserPrintHtml,
  testReceiptHtml,
  detectDeviceClass,
  buildEscPosTestReceipt,
  printViaRawBT,
} from "../lib/browserPrint.js";

export default function Settings() {
  const { logout } = useAuth();
  const [form, setForm] = useState({
    store_name: "",
    store_phone: "",
    store_tax_id: "",
    store_address: "",
    receipt_footer: "",
    printer_ip: "",
    printer_port: "9100",
    printer_name: "",
    printer_enabled: "0",
    printer_type: "network", // 'rawbt' | 'browser' | 'network' | 'local'
    auto_print: "1", // auto-print kitchen+bar tickets on submit, receipt on close
  });
  const [pin, setPin] = useState({ a: "", b: "" });
  const [volume, setVolume] = useState(getNotifVolume());
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    apiGet("/settings", { auth: false }).then((s) => {
      setForm((f) => ({ ...f, ...s }));
    });
  }, []);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onVolumeChange = (v) => {
    setVolume(v);
    setNotifVolume(v);
  };

  const save = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      await apiPut("/settings", form);
      if (pin.a || pin.b) {
        if (pin.a !== pin.b) {
          setErr("PIN ใหม่กับยืนยัน PIN ไม่ตรงกัน");
          return;
        }
        if (!/^\d{4}$/.test(pin.a)) {
          setErr("PIN ต้องเป็นตัวเลข 4 หลัก");
          return;
        }
        await apiPut("/settings/pin", { pin: pin.a });
        setPin({ a: "", b: "" });
      }
      setMsg("บันทึกแล้ว");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="px-4 py-6 md:px-6">
      <PageHeader
        title="ตั้งค่าร้าน"
        subtitle="ข้อมูลร้านและรหัส PIN เข้าระบบ"
        actions={
          <button onClick={logout} className="btn-secondary">
            <LogOut size={14} /> ออกจากระบบ
          </button>
        }
      />
      <SectionTabs tabs={SECTIONS.settings} />

      <form onSubmit={save} className="space-y-5">
        <section className="card p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-brand-orange">
              <Store size={18} />
            </div>
            <h2 className="text-base font-bold text-gray-900">ข้อมูลร้านค้า</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="ชื่อร้าน *">
              <input required className="input" value={form.store_name || ""} onChange={update("store_name")} />
            </Field>
            <Field label="เบอร์โทร">
              <input className="input" value={form.store_phone || ""} onChange={update("store_phone")} />
            </Field>
            <Field label="เลขประจำตัวผู้เสียภาษี">
              <input className="input" value={form.store_tax_id || ""} onChange={update("store_tax_id")} />
            </Field>
            <Field label="ที่อยู่">
              <input className="input" value={form.store_address || ""} onChange={update("store_address")} />
            </Field>
            <div className="md:col-span-2">
              <Field label="ข้อความท้ายบิล">
                <textarea
                  className="input min-h-[80px] resize-y"
                  value={form.receipt_footer || ""}
                  onChange={update("receipt_footer")}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-brand-orange">
              <Key size={18} />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              เปลี่ยนรหัส PIN (4 หลัก)
            </h2>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            เว้นว่างได้หากไม่ต้องการเปลี่ยน
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="PIN ใหม่">
              <input
                inputMode="numeric"
                maxLength={4}
                className="input"
                value={pin.a}
                onChange={(e) => setPin({ ...pin, a: e.target.value.replace(/\D/g, "") })}
              />
            </Field>
            <Field label="ยืนยัน PIN">
              <input
                inputMode="numeric"
                maxLength={4}
                className="input"
                value={pin.b}
                onChange={(e) => setPin({ ...pin, b: e.target.value.replace(/\D/g, "") })}
              />
            </Field>
          </div>
        </section>

        <section className="card p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-brand-orange">
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </div>
            <h2 className="text-base font-bold text-gray-900">
              เสียงแจ้งเตือนออเดอร์
            </h2>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            ปรับระดับความดังของเสียงเตือนเมื่อมีออเดอร์ใหม่เข้า (เก็บในเครื่องนี้)
          </p>
          <div className="flex items-center gap-4">
            <VolumeX size={16} className="text-gray-400" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="flex-1 accent-orange-500"
            />
            <Volume2 size={16} className="text-gray-400" />
            <span className="w-14 text-right text-sm font-semibold text-brand-orange">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "ปิดเสียง", v: 0 },
              { label: "เบา", v: 0.25 },
              { label: "กลาง", v: 0.5 },
              { label: "ดัง", v: 0.75 },
              { label: "ดังสุด", v: 1 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onVolumeChange(p.v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  Math.abs(volume - p.v) < 0.025
                    ? "bg-brand-orange text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={previewBeep}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <Play size={12} /> ลองฟัง
            </button>
          </div>
        </section>

        <PrinterSection
          form={form}
          setForm={setForm}
          onSavedToast={(t) => { setMsg(t); setTimeout(() => setMsg(""), 2500); }}
        />

        <div className="flex items-center justify-end gap-3">
          {err && <p className="text-sm text-red-500">{err}</p>}
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          <button type="submit" className="btn-primary">
            <Save size={16} /> บันทึกการตั้งค่า
          </button>
        </div>
      </form>

      {/* Danger Zone — outside the main form so submit doesn't trigger it */}
      <section className="card mt-8 border-2 border-red-200 p-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <AlertTriangle size={18} />
          </div>
          <h2 className="text-base font-bold text-red-700">โซนอันตราย</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          ล้างข้อมูลในระบบ — เลือกได้ว่าจะลบเฉพาะออเดอร์/ยอดขาย หรือลบข้อมูลหลัก (เมนู, โต๊ะ, สมาชิก ฯลฯ) ด้วย
          <br />
          <span className="text-red-600 font-semibold">การลบไม่สามารถกู้คืนได้</span>
        </p>
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600"
        >
          <Trash2 size={16} /> ล้างข้อมูลทั้งหมด
        </button>
      </section>

      {resetOpen && <FactoryResetModal onClose={() => setResetOpen(false)} />}
    </div>
  );
}

function FactoryResetModal({ onClose }) {
  const [scopes, setScopes] = useState({
    transactions: true,
    resetMemberStats: false,
    menu: false,
    tables: false,
    members: false,
    employees: false,
    ingredients: false,
  });
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState(null);

  const toggle = (k) => setScopes((s) => ({ ...s, [k]: !s[k] }));

  const submit = async () => {
    setErr("");
    if (confirm !== "ลบทั้งหมด") {
      setErr("กรุณาพิมพ์ 'ลบทั้งหมด' ในช่องยืนยัน");
      return;
    }
    if (!Object.values(scopes).some(Boolean)) {
      setErr("เลือกอย่างน้อย 1 ประเภทข้อมูลที่จะลบ");
      return;
    }
    if (!window.confirm("ยืนยันลบข้อมูล? การลบนี้กู้คืนไม่ได้")) return;
    setBusy(true);
    try {
      const r = await apiPost("/settings/factory-reset", {
        confirm: "ลบทั้งหมด",
        scopes,
      });
      setSummary(r.summary || {});
    } catch (e) {
      setErr(e.message || "ล้างข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (summary) {
    const total = Object.values(summary).reduce((a, b) => a + (Number(b) || 0), 0);
    return (
      <Modal onClose={onClose} title="ล้างข้อมูลสำเร็จ" wide>
        <p className="mb-3 text-sm text-emerald-700">
          ✓ ลบ/รีเซ็ตข้อมูลรวม <b>{total}</b> รายการ
        </p>
        <ul className="space-y-1 rounded-xl bg-gray-50 p-3 text-xs">
          {Object.entries(summary).map(([k, v]) => (
            <li key={k} className="flex items-center justify-between">
              <span className="text-gray-600">{labelOf(k)}</span>
              <span className="font-mono font-bold text-gray-900">{v}</span>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="btn-primary mt-4 w-full">
          เสร็จ
        </button>
      </Modal>
    );
  }

  const dangerous =
    scopes.menu || scopes.tables || scopes.members || scopes.employees || scopes.ingredients;

  return (
    <Modal onClose={onClose} title="ล้างข้อมูลทั้งหมด" wide>
      <p className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
        ⚠ การลบไม่สามารถกู้คืนได้ — กรุณาเลือกประเภทข้อมูลที่ต้องการลบให้ระมัดระวัง
      </p>

      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
        ข้อมูลรายการขาย / ออเดอร์
      </h4>
      <ScopeRow
        active={scopes.transactions}
        onToggle={() => toggle("transactions")}
        label="ออเดอร์ + ยอดขาย + กะ + ดรอป + เวลาเข้างาน + ประวัติสต็อก"
        desc="ลบประวัติทุกอย่าง รีเซ็ตสถานะโต๊ะเป็น 'ว่าง'"
      />
      <ScopeRow
        active={scopes.resetMemberStats}
        onToggle={() => toggle("resetMemberStats")}
        label="รีเซ็ตแต้ม + ยอดใช้จ่ายของสมาชิกเป็น 0"
        desc="สมาชิกยังอยู่ในระบบ แค่เคลียร์สถิติเริ่มต้นใหม่"
      />

      <h4 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-red-600">
        ข้อมูลหลัก (อันตรายมาก)
      </h4>
      <ScopeRow active={scopes.menu} onToggle={() => toggle("menu")} label="ลบเมนูและหมวดหมู่ทั้งหมด" danger />
      <ScopeRow active={scopes.tables} onToggle={() => toggle("tables")} label="ลบโต๊ะทั้งหมด" danger />
      <ScopeRow active={scopes.members} onToggle={() => toggle("members")} label="ลบสมาชิกทั้งหมด" danger />
      <ScopeRow active={scopes.employees} onToggle={() => toggle("employees")} label="ลบพนักงานทั้งหมด" danger />
      <ScopeRow active={scopes.ingredients} onToggle={() => toggle("ingredients")} label="ลบวัตถุดิบทั้งหมด" danger />

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          พิมพ์คำว่า <code className="rounded bg-gray-100 px-1 font-bold text-red-600">ลบทั้งหมด</code> เพื่อยืนยัน
        </label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="ลบทั้งหมด"
          className="input"
          autoFocus
        />
      </div>

      {err && <p className="mt-2 text-sm text-red-500">{err}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">
          ยกเลิก
        </button>
        <button
          onClick={submit}
          disabled={busy || confirm !== "ลบทั้งหมด"}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition disabled:cursor-not-allowed disabled:opacity-50 ${
            dangerous ? "bg-red-600 hover:bg-red-700" : "bg-red-500 hover:bg-red-600"
          }`}
        >
          <Trash2 size={14} />
          {busy ? "กำลังลบ..." : dangerous ? "ลบทั้งหมด (รวมข้อมูลหลัก)" : "ล้างข้อมูล"}
        </button>
      </div>
    </Modal>
  );
}

function ScopeRow({ active, onToggle, label, desc, danger }) {
  return (
    <label
      className={`mb-2 flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${
        active
          ? danger
            ? "border-red-400 bg-red-50"
            : "border-amber-400 bg-amber-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <input
        type="checkbox"
        checked={active}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 accent-red-500"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${danger ? "text-red-700" : "text-gray-900"}`}>
          {label}
        </p>
        {desc && <p className="text-xs text-gray-500">{desc}</p>}
      </div>
    </label>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`flex max-h-[90vh] w-full ${
          wide ? "max-w-lg" : "max-w-sm"
        } flex-col overflow-hidden rounded-2xl bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function labelOf(key) {
  const map = {
    order_items: "รายการในออเดอร์",
    orders: "ออเดอร์",
    cash_drops: "ดรอปเงิน",
    shifts: "กะ",
    stock_movements: "การเคลื่อนไหวสต็อก",
    clock_events: "การตอกบัตร",
    member_stats_reset: "สมาชิก (รีเซ็ตสถิติ)",
    menu_options: "ตัวเลือกเมนู",
    menu_option_groups: "กลุ่มตัวเลือก",
    recipes: "สูตร",
    menu_items: "เมนู",
    categories: "หมวดหมู่",
    tables: "โต๊ะ",
    members: "สมาชิก",
    employees: "พนักงาน",
    ingredients: "วัตถุดิบ",
  };
  return map[key] || key;
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function PrinterSection({ form, setForm, onSavedToast }) {
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [found, setFound] = useState(null); // null | array
  const [scanInfo, setScanInfo] = useState(null);
  const [scanErr, setScanErr] = useState("");
  const [testMsg, setTestMsg] = useState("");

  const enabled = form.printer_enabled === "1";
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setEvt = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const discover = async () => {
    setScanning(true);
    setScanErr("");
    setFound(null);
    try {
      const r = await apiGet("/printers/discover");
      setFound(r.found || []);
      setScanInfo(r);
    } catch (e) {
      setScanErr(e.message || "สแกนไม่สำเร็จ");
    } finally {
      setScanning(false);
    }
  };

  const isLocal = form.printer_type === "local";
  const isBrowser = form.printer_type === "browser";
  const isRawbt = form.printer_type === "rawbt";
  const isNetwork = !isLocal && !isBrowser && !isRawbt;
  const canTest = isBrowser || isRawbt ? true : isLocal ? !!form.printer_name : !!form.printer_ip;
  const device = detectDeviceClass();

  const testPrint = async () => {
    setTesting(true);
    setTestMsg("");
    try {
      if (isRawbt) {
        const bytes = buildEscPosTestReceipt({
          storeName: form.store_name || "FoodPOS",
          printerLabel: "RAWBT → " + (device === "sunmi" ? "SUNMI Inner" : "Thermal"),
        });
        printViaRawBT(bytes);
        setTestMsg("✓ ส่งไป RAWBT แล้ว — ถ้าไม่มีอะไรเกิดขึ้น แปลว่ายังไม่ได้ตั้งค่า RAWBT");
      } else if (isBrowser) {
        await browserPrintHtml(
          testReceiptHtml({
            storeName: form.store_name || "FoodPOS",
            printerLabel: device === "sunmi" ? "SUNMI Built-in" : "Browser/Device",
          })
        );
        setTestMsg("✓ ส่งงานพิมพ์ผ่าน Browser แล้ว — เลือกเครื่องพิมพ์ใน dialog");
      } else if (isLocal) {
        await apiPost("/printers/test", { type: "local", name: form.printer_name });
        setTestMsg("✓ ส่งงานพิมพ์สำเร็จ — ดูที่หัวพิมพ์");
      } else {
        await apiPost("/printers/test", {
          ip: form.printer_ip,
          port: Number(form.printer_port) || 9100,
        });
        setTestMsg("✓ ส่งงานพิมพ์สำเร็จ — ดูที่หัวพิมพ์");
      }
      setTimeout(() => setTestMsg(""), 6000);
    } catch (e) {
      setTestMsg(`✗ ${e.message || "ทดสอบพิมพ์ไม่สำเร็จ"}`);
      setTimeout(() => setTestMsg(""), 6000);
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="card p-6">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-brand-orange">
          <Printer size={18} />
        </div>
        <h2 className="text-base font-bold text-gray-900">
          เครื่องพิมพ์ในวง Wi-Fi
        </h2>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        เชื่อมต่อเครื่องพิมพ์ใบเสร็จ/ครัว — รองรับทั้งเครื่องที่ติดตั้งใน Windows (USB)
        และเครื่องในวง Wi-Fi (ESC/POS port 9100)
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-5">
        <Toggle
          checked={enabled}
          onChange={(v) => set("printer_enabled")(v ? "1" : "0")}
          label="เปิดใช้งานเครื่องพิมพ์"
        />
        <Toggle
          checked={form.auto_print !== "0"}
          onChange={(v) => set("auto_print")(v ? "1" : "0")}
          label="พิมพ์อัตโนมัติเมื่อรับ/ปิดออเดอร์"
        />
      </div>

      {/* Printer type tabs */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => set("printer_type")("rawbt")}
          className={`rounded-xl border-2 py-2 text-xs font-semibold transition sm:text-sm ${
            isRawbt
              ? "border-brand-orange bg-orange-50 text-brand-orange"
              : "border-gray-200 bg-white text-gray-600"
          }`}
          disabled={!enabled}
        >
          🖨 RAWBT / SUNMI
        </button>
        <button
          type="button"
          onClick={() => set("printer_type")("browser")}
          className={`rounded-xl border-2 py-2 text-xs font-semibold transition sm:text-sm ${
            isBrowser
              ? "border-brand-orange bg-orange-50 text-brand-orange"
              : "border-gray-200 bg-white text-gray-600"
          }`}
          disabled={!enabled}
        >
          📱 Browser
        </button>
        <button
          type="button"
          onClick={() => set("printer_type")("network")}
          className={`rounded-xl border-2 py-2 text-xs font-semibold transition sm:text-sm ${
            isNetwork
              ? "border-brand-orange bg-orange-50 text-brand-orange"
              : "border-gray-200 bg-white text-gray-600"
          }`}
          disabled={!enabled}
        >
          🌐 Network
        </button>
        <button
          type="button"
          onClick={() => set("printer_type")("local")}
          className={`rounded-xl border-2 py-2 text-xs font-semibold transition sm:text-sm ${
            isLocal
              ? "border-brand-orange bg-orange-50 text-brand-orange"
              : "border-gray-200 bg-white text-gray-600"
          }`}
          disabled={!enabled}
        >
          💻 Local USB
        </button>
      </div>

      {isRawbt ? (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">🖨 พิมพ์ผ่าน RAWBT (เหมาะกับ SUNMI T2 / Android thermal POS)</p>
          <p>
            RAWBT เป็นแอป Android กลางที่ส่งงานพิมพ์ไปยังเครื่องพิมพ์ thermal — รวมถึง
            <b> เครื่องพิมพ์ภายในของ SUNMI T2/V2/M2</b>, USB, Bluetooth
          </p>
          <div className="mt-2 rounded-lg bg-white p-2 text-amber-900">
            <p className="mb-1 font-bold">ขั้นตอนตั้งค่าครั้งแรก (บน SUNMI T2)</p>
            <ol className="ml-4 list-decimal space-y-0.5">
              <li>ติดตั้งแอป <b>"RAWBT print service"</b> จาก Play Store (ถ้ายังไม่มี)</li>
              <li>เปิดแอป RAWBT → กดเข้า "Device" → เลือก <b>"Sunmi Internal Printer"</b> หรือ "USB"</li>
              <li>กดทดสอบในแอป RAWBT ครั้งหนึ่งก่อนเพื่อยืนยันว่าหัวพิมพ์ทำงาน</li>
              <li>กลับมาที่หน้านี้ กด <b>"ทดสอบพิมพ์"</b> → RAWBT จะรับ → ออกหัวพิมพ์</li>
            </ol>
          </div>
          <p className="text-amber-700">
            ⚠️ ปัจจุบันใน Android print dialog คุณเห็น "RAWBT Printer not configured" — แปลว่าต้องเปิดแอป RAWBT แล้วเลือก printer ก่อน
          </p>
          <p className="text-amber-700">
            อุปกรณ์ที่ตรวจพบ: <b>
              {device === "sunmi"
                ? "SUNMI device ✓"
                : device === "android"
                  ? "Android"
                  : "Desktop (ใช้บน SUNMI/Android ถึงจะใช้งานได้)"}
            </b>
          </p>
        </div>
      ) : isBrowser ? (
        <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
          <p className="mb-1 font-semibold">📱 พิมพ์ผ่านอุปกรณ์ที่เปิดเว็บนี้</p>
          <p>
            ส่งงานพิมพ์ผ่าน <code className="rounded bg-white px-1">window.print()</code> ของ browser →
            เลือกเครื่องพิมพ์จาก dialog (ระบบ Android Print Services)
          </p>
          <p className="mt-2 text-blue-800">
            <b>⚠ หมายเหตุ SUNMI T2:</b> เครื่องพิมพ์ภายในของ SUNMI จะ
            <b>ไม่ปรากฏ</b>ใน Android Print Services โดยตรง — ให้ใช้ tab
            <b> "🖨 RAWBT / SUNMI"</b> แทน
          </p>
          <p className="mt-2 text-blue-600">
            อุปกรณ์ที่ตรวจพบ: <b>
              {device === "sunmi"
                ? "SUNMI device"
                : device === "android"
                  ? "Android"
                  : "Desktop / Tablet browser"}
            </b>
          </p>
        </div>
      ) : isLocal ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-12">
            <Field label="ชื่อเครื่องพิมพ์ใน Windows">
              <input
                value={form.printer_name || ""}
                onChange={setEvt("printer_name")}
                placeholder="เช่น XP-58 / Microsoft Print to PDF"
                className="input"
                disabled={!enabled}
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <Field label="IP เครื่องพิมพ์">
              <input
                value={form.printer_ip || ""}
                onChange={setEvt("printer_ip")}
                placeholder="192.168.1.50"
                className="input font-mono"
                disabled={!enabled}
              />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Port">
              <input
                value={form.printer_port || "9100"}
                onChange={setEvt("printer_port")}
                placeholder="9100"
                className="input font-mono"
                disabled={!enabled}
              />
            </Field>
          </div>
          <div className="sm:col-span-4">
            <Field label="ชื่อเรียก (ไม่บังคับ)">
              <input
                value={form.printer_name || ""}
                onChange={setEvt("printer_name")}
                placeholder="ครัว, หน้าร้าน..."
                className="input"
                disabled={!enabled}
              />
            </Field>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={discover}
          disabled={scanning}
          className="btn-secondary disabled:opacity-50"
        >
          {scanning ? (
            <>
              <Search size={14} className="animate-pulse" />
              กำลังสแกน...
            </>
          ) : (
            <>
              <Wifi size={14} />
              ค้นหาอัตโนมัติ
            </>
          )}
        </button>
        <button
          type="button"
          onClick={testPrint}
          disabled={testing || !canTest || !enabled}
          className="btn-secondary disabled:opacity-50"
        >
          {testing ? (
            <>
              <Printer size={14} className="animate-pulse" />
              กำลังพิมพ์...
            </>
          ) : (
            <>
              <Printer size={14} />
              ทดสอบพิมพ์
            </>
          )}
        </button>
        {testMsg && (
          <span
            className={`text-xs font-medium ${
              testMsg.startsWith("✓") ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {testMsg}
          </span>
        )}
      </div>

      {scanErr && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {scanErr}
        </p>
      )}

      {found !== null && !scanErr && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3">
          <p className="mb-2 text-xs text-gray-600">
            📱 อุปกรณ์นี้ · <Wifi size={11} className="mr-0.5 inline-block" />Network <b>{scanInfo?.network_count ?? 0}</b> · 💻 Local <b>{scanInfo?.local_count ?? 0}</b>
            · ใช้เวลา {Math.round((scanInfo?.elapsed_ms || 0) / 1000)}s
          </p>

          {/* Always offer "this device" options as the first rows */}
          {(device === "sunmi" || device === "android") && (
            <RawBTPrinterRow
              isSelected={isRawbt}
              device={device}
              onPick={() => {
                set("printer_type")("rawbt");
                set("printer_enabled")("1");
              }}
            />
          )}
          <BrowserPrinterRow
            isSelected={isBrowser}
            device={device}
            onPick={() => {
              set("printer_type")("browser");
              set("printer_enabled")("1");
            }}
          />

          {found.length === 0 ? (
            <p className="mt-2 rounded-lg bg-white p-3 text-center text-xs text-gray-400">
              ไม่พบเครื่องพิมพ์ Network/Local — ตรวจสอบ:
              <br />
              ① เครื่องพิมพ์เปิดอยู่ + ต่อ Wi-Fi/USB กับ PC นี้
              <br />
              ② Port อาจไม่ใช่ 9100 (ลองเปลี่ยน Port แล้วสแกนใหม่)
              <br />
              ③ Driver ติดตั้งใน Windows แล้วหรือยัง
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {found.map((p, idx) => {
                const isLocalP = p.type === "local";
                const isSelected = isLocalP
                  ? isLocal && form.printer_name === p.name
                  : !isLocal && form.printer_ip === p.ip && String(form.printer_port) === String(p.port);
                const key = isLocalP ? `local-${p.name}-${idx}` : `${p.ip}:${p.port}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isLocalP) {
                          set("printer_type")("local");
                          set("printer_name")(p.name);
                        } else {
                          set("printer_type")("network");
                          set("printer_ip")(p.ip);
                          set("printer_port")(String(p.port));
                        }
                        set("printer_enabled")("1");
                      }}
                      className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? "border-brand-orange bg-orange-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Printer size={14} className={isSelected ? "text-brand-orange shrink-0" : "text-gray-400 shrink-0"} />
                        <span className="min-w-0 flex-1">
                          {isLocalP ? (
                            <>
                              <span className="block truncate font-medium text-gray-900">{p.name}</span>
                              <span className="block truncate text-[10px] text-gray-400">
                                {p.port_name} · {p.driver}{p.is_default ? " · ★ Default" : ""}
                              </span>
                            </>
                          ) : (
                            <span className="font-mono">{p.ip}:{p.port}</span>
                          )}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isLocalP ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {isLocalP ? "Local" : "Network"}
                        </span>
                      </span>
                      {isSelected && (
                        <span className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-orange">
                          <CheckCircle2 size={12} /> เลือกแล้ว
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        เครื่องพิมพ์ที่รองรับ: ESC/POS thermal (Epson TM-, Star TSP-, SUNMI NT, Xprinter, ทั่วไป)
      </p>
    </section>
  );
}

function RawBTPrinterRow({ isSelected, device, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`mb-1 flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-left text-sm transition ${
        isSelected
          ? "border-brand-orange bg-orange-50"
          : "border-amber-300 bg-amber-50/40 hover:border-amber-400"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Printer size={14} className={isSelected ? "text-brand-orange shrink-0" : "text-amber-600 shrink-0"} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-gray-900">
            🖨 RAWBT (SUNMI Inner / Thermal)
          </span>
          <span className="block truncate text-[10px] text-gray-500">
            ส่งผ่าน RAWBT app — รองรับเครื่องพิมพ์ภายใน SUNMI T2/V2 และ USB/Bluetooth thermal
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
          RAWBT
        </span>
      </span>
      {isSelected && (
        <span className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-orange">
          <CheckCircle2 size={12} /> เลือกแล้ว
        </span>
      )}
    </button>
  );
}

function BrowserPrinterRow({ isSelected, device, onPick }) {
  const deviceLabel =
    device === "sunmi"
      ? "SUNMI POS (เครื่องพิมพ์ภายใน)"
      : device === "android"
        ? "Android (Android Print Services)"
        : "Browser ของเครื่องนี้";
  return (
    <button
      type="button"
      onClick={onPick}
      className={`mt-1 flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-left text-sm transition ${
        isSelected
          ? "border-brand-orange bg-orange-50"
          : "border-blue-200 bg-blue-50/40 hover:border-blue-300"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Smartphone size={14} className={isSelected ? "text-brand-orange shrink-0" : "text-blue-500 shrink-0"} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-gray-900">
            อุปกรณ์นี้ (พิมพ์ผ่าน Browser)
          </span>
          <span className="block truncate text-[10px] text-gray-500">
            {deviceLabel} · เหมาะกับ SUNMI / Tablet ติดเครื่องพิมพ์
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
          Device
        </span>
      </span>
      {isSelected && (
        <span className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-orange">
          <CheckCircle2 size={12} /> เลือกแล้ว
        </span>
      )}
    </button>
  );
}
