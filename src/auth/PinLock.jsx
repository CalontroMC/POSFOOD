import { useEffect, useRef, useState } from "react";
import { Lock, UtensilsCrossed } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";

export default function PinLock() {
  const { login } = useAuth();
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refs = useRef([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setDigit = (idx, val) => {
    const v = val.replace(/[^0-9]/g, "").slice(-1);
    setError("");
    setPin((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    if (v && idx < 3) refs.current[idx + 1]?.focus();
  };

  const onKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !pin[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
    if (e.key === "Enter") submit();
  };

  const onPaste = (e) => {
    const text = (e.clipboardData?.getData("text") || "").replace(/[^0-9]/g, "");
    if (text.length >= 4) {
      e.preventDefault();
      const next = text.slice(0, 4).split("");
      setPin(next);
      refs.current[3]?.focus();
    }
  };

  const submit = async () => {
    const code = pin.join("");
    if (!/^\d{4}$/.test(code)) return;
    setBusy(true);
    setError("");
    try {
      await login(code);
    } catch (e) {
      setError(e.message || "PIN ไม่ถูกต้อง");
      setPin(["", "", "", ""]);
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (pin.every((d) => d !== "")) submit();
  }, [pin.join("")]); // eslint-disable-line

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-soft">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange text-white shadow-soft">
            <UtensilsCrossed size={26} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">FoodPOS Admin</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
            <Lock size={12} /> ใส่ PIN 4 หลักเพื่อเข้าใช้งาน
          </p>
        </div>

        <div className="mb-4 flex justify-center gap-3" onPaste={onPaste}>
          {pin.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              value={d}
              inputMode="numeric"
              maxLength={1}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              disabled={busy}
              type="password"
              className="h-14 w-14 rounded-2xl border-2 border-gray-200 text-center text-2xl font-bold text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-orange-100"
            />
          ))}
        </div>

        {error && (
          <p className="mb-2 text-center text-sm text-red-500">{error}</p>
        )}

        <p className="mt-3 text-center text-xs text-gray-400">
          ค่าเริ่มต้น: <span className="font-mono font-semibold">1234</span> · เปลี่ยนได้ในหน้าตั้งค่าร้าน
        </p>
      </div>
    </div>
  );
}
