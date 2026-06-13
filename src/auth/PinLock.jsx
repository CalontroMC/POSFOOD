import { useEffect, useRef, useState } from "react";
import { Lock, UtensilsCrossed, Shield, User } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import { apiGet } from "../lib/api.js";

export default function PinLock() {
  const { login } = useAuth();
  const [roleMode, setRoleMode] = useState(null); // 'admin' | 'manager_select' | { type: 'manager', id: 1, name: '...' } | null
  const [employees, setEmployees] = useState([]);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refs = useRef([]);

  useEffect(() => {
    if (roleMode && typeof roleMode !== "string") {
      refs.current[0]?.focus();
    } else if (roleMode === "admin") {
      refs.current[0]?.focus();
    }
    
    if (roleMode === "manager_select" && employees.length === 0) {
      apiGet("/employees", { auth: false, silent401: true })
        .then((data) => setEmployees(data.filter((e) => e.active)))
        .catch(console.error);
    }
  }, [roleMode]);

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
      const actualRole = typeof roleMode === "string" ? roleMode : roleMode.type;
      const empId = typeof roleMode === "object" && roleMode ? roleMode.id : null;
      await login(code, actualRole, empId);
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

  if (!roleMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-soft">
          <div className="mb-6 flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange text-white shadow-soft">
              <UtensilsCrossed size={26} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">เข้าสู่ระบบ FoodPOS</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
              กรุณาเลือกผู้ใช้งาน
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setRoleMode("admin")}
              className="flex w-full items-center gap-4 rounded-2xl border-2 border-transparent bg-gray-50 p-4 transition-all hover:border-brand-orange hover:bg-orange-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-brand-orange">
                <Shield size={20} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">ผู้จัดการร้าน (Admin)</div>
                <div className="text-xs text-gray-500">จัดการเมนู ดูรายงาน ตั้งค่าร้าน</div>
              </div>
            </button>

            <button
              onClick={() => setRoleMode("manager_select")}
              className="flex w-full items-center gap-4 rounded-2xl border-2 border-transparent bg-gray-50 p-4 transition-all hover:border-blue-500 hover:bg-blue-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-500">
                <User size={20} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">พนักงาน (Employee)</div>
                <div className="text-xs text-gray-500">สั่งอาหาร รับชำระเงิน</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (roleMode === "manager_select") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-soft">
          <div className="mb-6 flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-soft">
              <User size={26} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">เลือกชื่อของคุณ</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
              แตะที่ชื่อเพื่อเข้าสู่ระบบ
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
            {employees.length === 0 ? (
              <div className="col-span-2 text-center text-sm text-gray-400 py-4">ไม่มีพนักงานในระบบ (ใช้รหัสส่วนกลางได้)</div>
            ) : (
              employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setRoleMode({ type: "manager", id: emp.id, name: emp.name })}
                  className="rounded-xl border-2 border-transparent bg-gray-50 py-3 transition-all hover:border-blue-500 hover:bg-blue-50 active:bg-blue-100"
                >
                  <div className="font-semibold text-gray-900">{emp.name}</div>
                </button>
              ))
            )}
            
            <button
              onClick={() => setRoleMode({ type: "manager", id: null, name: "พนักงานส่วนกลาง" })}
              className="col-span-2 mt-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50"
            >
              ใช้รหัสพนักงานส่วนกลาง
            </button>
          </div>
          
          <div className="mt-6 flex flex-col items-center gap-3 text-xs text-gray-400">
            <button 
              onClick={() => setRoleMode(null)}
              className="text-gray-500 underline hover:text-gray-700"
            >
              ย้อนกลับ
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isManager = typeof roleMode === "object" && roleMode?.type === "manager";
  const displayName = isManager ? roleMode.name : "แอดมิน (Admin)";

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-soft">
        <div className="mb-6 flex flex-col items-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-soft ${!isManager ? 'bg-brand-orange' : 'bg-blue-500'}`}>
            {!isManager ? <Shield size={26} /> : <User size={26} />}
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            {displayName}
          </h1>
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
              className={`h-14 w-14 rounded-2xl border-2 border-gray-200 text-center text-2xl font-bold text-gray-900 focus:outline-none focus:ring-4 ${
                !isManager 
                  ? 'focus:border-brand-orange focus:ring-orange-100' 
                  : 'focus:border-blue-500 focus:ring-blue-100'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="mb-2 text-center text-sm text-red-500">{error}</p>
        )}

        <div className="mt-6 flex flex-col items-center gap-3 text-xs text-gray-400">
          <button 
            onClick={() => setRoleMode(null)}
            className="text-gray-500 underline hover:text-gray-700"
          >
            ย้อนกลับไปเลือกผู้ใช้งานใหม่
          </button>
        </div>
      </div>
    </div>
  );
}
