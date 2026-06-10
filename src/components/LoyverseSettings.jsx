import { useEffect, useState } from "react";
import { RefreshCw, PlugZap, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import Toggle from "./Toggle.jsx";
import { apiPut, loyverseStatus, loyversePaymentTypes, loyverseSyncLog, loyverseRetry } from "../lib/api.js";

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

export default function LoyverseSettings({ form, setForm, onSavedToast }) {
  // Token input — empty means "no change"; only sent when non-empty
  const [tokenInput, setTokenInput] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenMsg, setTokenMsg] = useState("");
  const [tokenErr, setTokenErr] = useState("");

  // Test connection
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState(null); // null | { ok, message }

  // Payment types list fetched from Loyverse
  const [ptList, setPtList] = useState([]); // [{ id, name, type }]
  const [ptErr, setPtErr] = useState("");
  const [ptLoading, setPtLoading] = useState(false);

  // Failed sync panel
  const [syncLog, setSyncLog] = useState([]); // rows
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncErr, setSyncErr] = useState("");
  const [retryingId, setRetryingId] = useState(null);

  // ── fetch payment types & sync log when Loyverse is enabled ─────────────
  useEffect(() => {
    if (form.loyverse_enabled !== "1") return;
    fetchPaymentTypes();
    fetchSyncLog();
  }, [form.loyverse_enabled]);

  async function fetchPaymentTypes() {
    setPtLoading(true);
    setPtErr("");
    try {
      const data = await loyversePaymentTypes();
      if (Array.isArray(data)) {
        setPtList(data);
      } else {
        setPtErr(data?.error || "โหลดประเภทการชำระเงินไม่สำเร็จ");
      }
    } catch {
      setPtErr("ยังไม่ได้ตั้งค่า token หรือเชื่อมต่อ Loyverse ไม่ได้");
    } finally {
      setPtLoading(false);
    }
  }

  async function fetchSyncLog() {
    setSyncLoading(true);
    setSyncErr("");
    try {
      const rows = await loyverseSyncLog("failed");
      setSyncLog(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setSyncErr(e.message || "โหลด sync log ไม่สำเร็จ");
    } finally {
      setSyncLoading(false);
    }
  }

  // ── enable toggle ─────────────────────────────────────────────────────────
  async function handleToggleEnabled(v) {
    const val = v ? "1" : "0";
    setForm((f) => ({ ...f, loyverse_enabled: val }));
    try {
      await apiPut("/settings", { loyverse_enabled: val });
      onSavedToast(v ? "เปิดใช้ Loyverse แล้ว" : "ปิด Loyverse แล้ว");
    } catch (e) {
      // revert
      setForm((f) => ({ ...f, loyverse_enabled: v ? "0" : "1" }));
      onSavedToast("บันทึกไม่สำเร็จ: " + (e.message || ""));
    }
  }

  // ── save token ────────────────────────────────────────────────────────────
  async function handleSaveToken() {
    if (!tokenInput.trim()) return;
    setTokenBusy(true);
    setTokenErr("");
    setTokenMsg("");
    try {
      await apiPut("/settings", { loyverse_token: tokenInput.trim() });
      setForm((f) => ({ ...f, loyverse_token_set: "1" }));
      setTokenInput("");
      setTokenMsg("บันทึก token แล้ว");
      setTimeout(() => setTokenMsg(""), 3000);
    } catch (e) {
      setTokenErr(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setTokenBusy(false);
    }
  }

  // ── test connection ───────────────────────────────────────────────────────
  async function handleTestConnection() {
    setTestBusy(true);
    setTestResult(null);
    try {
      const r = await loyverseStatus();
      if (r.ok) {
        const firstStore = r.stores?.[0];
        const name = firstStore?.name || r.storeId || "ร้านค้า";
        let msg = `เชื่อมต่อสำเร็จ — ${name}`;

        if (firstStore && (!form.loyverse_store_id || !r.stores.some((s) => s.id === form.loyverse_store_id))) {
          await apiPut("/settings", { loyverse_store_id: firstStore.id });
          setForm((f) => ({ ...f, loyverse_store_id: firstStore.id }));
          msg = r.stores.length > 1
            ? `เชื่อมต่อสำเร็จ — ${name} (บันทึก store แรกแล้ว)`
            : `เชื่อมต่อสำเร็จ — ${name} (บันทึก store แล้ว)`;
        }

        setTestResult({ ok: true, message: msg });
      } else {
        setTestResult({ ok: false, message: r.error || "เชื่อมต่อไม่สำเร็จ" });
      }
    } catch (e) {
      setTestResult({ ok: false, message: e.message || "เชื่อมต่อไม่สำเร็จ" });
    } finally {
      setTestBusy(false);
    }
  }

  // ── save payment type mapping ─────────────────────────────────────────────
  async function handlePtChange(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    try {
      await apiPut("/settings", { [key]: value });
      onSavedToast("บันทึกแล้ว");
    } catch (e) {
      onSavedToast("บันทึกไม่สำเร็จ: " + (e.message || ""));
    }
  }

  // ── retry failed sync ─────────────────────────────────────────────────────
  async function handleRetry(orderId) {
    setRetryingId(orderId);
    try {
      await loyverseRetry(orderId);
      await fetchSyncLog();
    } catch {
      // refresh anyway — row may have updated status
      await fetchSyncLog();
    } finally {
      setRetryingId(null);
    }
  }

  const PT_LABELS = [
    { key: "loyverse_pt_cash", label: "เงินสด" },
    { key: "loyverse_pt_qr", label: "QR" },
    { key: "loyverse_pt_card", label: "บัตร" },
    { key: "loyverse_pt_other", label: "อื่นๆ" },
  ];

  return (
    <section className="card p-6">
      {/* ── Section header ───────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <PlugZap size={18} />
          </div>
          <h2 className="text-base font-bold text-gray-900">เชื่อมต่อ Loyverse</h2>
        </div>
        <Toggle
          checked={form.loyverse_enabled === "1"}
          onChange={handleToggleEnabled}
          label={form.loyverse_enabled === "1" ? "เปิดใช้" : "ปิด"}
        />
      </div>

      <p className="mb-5 text-sm text-gray-500">
        ซิงค์ข้อมูลการขายไปยัง Loyverse POS — ต้องตั้งค่า Access Token ก่อน
      </p>

      {/* ── API Token ────────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Access Token</h3>
        <Field label="Loyverse API Token">
          <div className="flex gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={
                form.loyverse_token_set === "1"
                  ? "ตั้งค่าไว้แล้ว •••• (ว่างไว้เพื่อไม่เปลี่ยน)"
                  : "วาง token จาก Loyverse Back Office"
              }
              autoComplete="new-password"
              className="input flex-1 font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleSaveToken}
              disabled={tokenBusy || !tokenInput.trim()}
              className="btn-secondary shrink-0 disabled:opacity-50"
            >
              {tokenBusy ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </Field>
        {tokenMsg && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 size={12} />
            {tokenMsg}
          </p>
        )}
        {tokenErr && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-500">
            <XCircle size={12} />
            {tokenErr}
          </p>
        )}
      </div>

      {/* ── Test connection ───────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testBusy}
            className="btn-secondary disabled:opacity-50"
          >
            {testBusy ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                กำลังทดสอบ...
              </>
            ) : (
              <>
                <PlugZap size={14} />
                ทดสอบการเชื่อมต่อ
              </>
            )}
          </button>
          {testResult && (
            <span
              className={`inline-flex items-center gap-1 text-sm font-medium ${
                testResult.ok ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 size={14} />
              ) : (
                <XCircle size={14} />
              )}
              {testResult.message}
            </span>
          )}
        </div>
      </div>

      {/* ── Payment method mapping ───────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">จับคู่ประเภทการชำระเงิน</h3>
          <button
            type="button"
            onClick={fetchPaymentTypes}
            disabled={ptLoading}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40"
          >
            <RefreshCw size={12} className={ptLoading ? "animate-spin" : ""} />
            โหลดใหม่
          </button>
        </div>

        {ptErr ? (
          <p className="mb-3 flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle size={12} className="shrink-0" />
            {ptErr}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PT_LABELS.map(({ key, label }) => (
            <Field key={key} label={label}>
              <select
                value={form[key] || ""}
                onChange={(e) => handlePtChange(key, e.target.value)}
                className="input"
                disabled={ptLoading || ptList.length === 0}
              >
                <option value="">— ไม่เลือก —</option>
                {ptList.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                    {pt.type ? ` (${pt.type})` : ""}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>

        {ptLoading && (
          <p className="mt-2 text-xs text-gray-400">กำลังโหลดประเภทการชำระเงิน...</p>
        )}
      </div>

      {/* ── Failed sync panel ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">ออเดอร์ที่ sync ไม่ผ่าน</h3>
          <button
            type="button"
            onClick={fetchSyncLog}
            disabled={syncLoading}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40"
          >
            <RefreshCw size={12} className={syncLoading ? "animate-spin" : ""} />
            รีเฟรช
          </button>
        </div>

        {syncErr && (
          <p className="mb-2 text-xs text-red-500">{syncErr}</p>
        )}

        {syncLoading ? (
          <p className="text-xs text-gray-400">กำลังโหลด...</p>
        ) : syncLog.length === 0 ? (
          <p className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 size={12} />
            ไม่มีออเดอร์ที่ค้างการ sync
          </p>
        ) : (
          <ul className="space-y-2">
            {syncLog.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">
                    ออเดอร์ #{row.order_id}
                    {row.receipt_number ? (
                      <span className="ml-1 font-normal text-gray-500">
                        · ใบเสร็จ {row.receipt_number}
                      </span>
                    ) : null}
                  </p>
                  {row.error && (
                    <p className="mt-0.5 truncate text-red-500">{row.error}</p>
                  )}
                  <p className="mt-0.5 text-gray-400">
                    พยายาม {row.attempts ?? 0} ครั้ง
                    {row.updated_at ? ` · ${new Date(row.updated_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRetry(row.order_id)}
                  disabled={retryingId === row.order_id}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-medium text-brand-orange hover:bg-orange-100 disabled:opacity-50"
                >
                  <RefreshCw
                    size={11}
                    className={retryingId === row.order_id ? "animate-spin" : ""}
                  />
                  {retryingId === row.order_id ? "กำลังลอง..." : "ลองใหม่"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
