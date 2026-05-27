import { useState } from "react";
import { UtensilsCrossed, Store, User, Lock, Eye, EyeOff } from "lucide-react";
import { apiPost, setToken } from "../lib/api.js";

export default function AdminSetup({ onDone }) {
  const [storeName, setStoreName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!storeName.trim()) return setErr("กรุณากรอกชื่อร้าน");
    if (!adminName.trim()) return setErr("กรุณากรอกชื่อผู้ดูแล");
    if (!/^\d{4}$/.test(pin)) return setErr("PIN ต้องเป็นตัวเลข 4 หลัก");
    if (pin !== pin2) return setErr("PIN ทั้งสองช่องไม่ตรงกัน");
    setBusy(true);
    try {
      const { token } = await apiPost(
        "/auth/setup",
        {
          store_name: storeName.trim(),
          admin_name: adminName.trim(),
          pin,
        },
        { auth: false }
      );
      if (token) setToken(token);
      onDone();
    } catch (e) {
      setErr(e.message || "ตั้งค่าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange text-white shadow-soft">
            <UtensilsCrossed size={26} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">ยินดีต้อนรับสู่ FoodPOS</h1>
          <p className="mt-1 text-sm text-gray-500">ตั้งค่าครั้งแรกก่อนเริ่มใช้งาน</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="ชื่อร้าน *" Icon={Store}>
            <input
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="input"
              placeholder="เช่น ร้านอาหารป้าน้อย"
              autoFocus
            />
          </Field>

          <Field label="ชื่อผู้ดูแล *" Icon={User}>
            <input
              required
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="input"
              placeholder="ชื่อจริง / ชื่อเล่น"
            />
          </Field>

          <Field label="PIN เข้าระบบ (4 หลัก) *" Icon={Lock}>
            <div className="relative">
              <input
                required
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="input pr-10 text-center text-lg tracking-[0.5em]"
                placeholder="••••"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <Field label="ยืนยัน PIN *">
            <input
              required
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              maxLength={4}
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
              className="input text-center text-lg tracking-[0.5em]"
              placeholder="••••"
            />
          </Field>

          {err && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full disabled:opacity-50"
          >
            {busy ? "กำลังตั้งค่า..." : "เริ่มใช้งาน"}
          </button>

          <p className="text-center text-xs text-gray-400">
            PIN นี้จะใช้สำหรับเข้าระบบทุกครั้ง — เปลี่ยนได้ในหน้าตั้งค่าร้าน
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, Icon, children }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
        {Icon && <Icon size={14} className="text-gray-400" />}
        {label}
      </label>
      {children}
    </div>
  );
}
