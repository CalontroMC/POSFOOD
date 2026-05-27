import { useEffect, useState } from "react";
import {
  Play,
  Square,
  Coins,
  TrendingUp,
  TrendingDown,
  ArrowDownToLine,
  RefreshCcw,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import SectionTabs, { SECTIONS } from "../components/SectionTabs.jsx";
import StatCard from "../components/StatCard.jsx";
import { apiGet, apiPost, apiDelete } from "../lib/api.js";

export default function ShiftPage() {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [dropModal, setDropModal] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    const [cur, hist, emps] = await Promise.all([
      apiGet("/shifts/current", { auth: false }),
      apiGet("/shifts?limit=30"),
      apiGet("/employees", { auth: false }),
    ]);
    setCurrent(cur);
    setHistory(hist);
    setEmployees(emps.filter((e) => e.active));
    window.dispatchEvent(new CustomEvent("foodpos:shift-changed"));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const isOpen = current && current.status === "open";

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="ระบบกะ"
        subtitle="จัดการเงินสด เปิด-ปิดกะ และตรวจสอบยอดขายต่อกะ"
        actions={
          <div className="flex gap-2">
            <button onClick={load} className="btn-secondary">
              <RefreshCcw size={14} /> รีเฟรช
            </button>
            {isOpen ? (
              <button onClick={() => setCloseModal(true)} className="btn-primary">
                <Square size={14} /> ปิดกะ
              </button>
            ) : (
              <button onClick={() => setOpenModal(true)} className="btn-primary">
                <Play size={14} /> เปิดกะ
              </button>
            )}
          </div>
        }
      />
      <SectionTabs tabs={SECTIONS.shift} />

      {isOpen ? (
        <ActiveShift
          shift={current}
          onDrop={() => setDropModal(true)}
          onDeleteDrop={async (dropId) => {
            await apiDelete(`/shifts/${current.id}/cash-drops/${dropId}`);
            await load();
          }}
        />
      ) : (
        <NoShiftPlaceholder onOpen={() => setOpenModal(true)} />
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold text-gray-900">ประวัติกะ</h2>
        {history.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-400">
            ยังไม่มีประวัติกะ
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">กะ</th>
                  <th className="px-4 py-3 font-medium">ผู้เปิด</th>
                  <th className="px-4 py-3 font-medium">เปิดเมื่อ</th>
                  <th className="px-4 py-3 font-medium">ปิดเมื่อ</th>
                  <th className="px-4 py-3 font-medium text-right">เงินสดเริ่ม</th>
                  <th className="px-4 py-3 font-medium text-right">นับได้</th>
                  <th className="px-4 py-3 font-medium text-right">ส่วนต่าง</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-orange-50/30"
                    onClick={async () => setDetail(await apiGet(`/shifts/${s.id}`))}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      #{s.id}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.opened_by_name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatTime(s.opened_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.closed_at ? formatTime(s.closed_at) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          เปิดอยู่
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      ฿{(s.opening_cash || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {s.closing_cash_counted != null
                        ? `฿${s.closing_cash_counted.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {s.variance != null ? (
                        <span
                          className={
                            s.variance === 0
                              ? "text-gray-600"
                              : s.variance > 0
                                ? "text-emerald-600"
                                : "text-red-500"
                          }
                        >
                          {s.variance > 0 ? "+" : ""}฿{s.variance.toLocaleString()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openModal && (
        <OpenShiftModal
          employees={employees}
          onClose={() => setOpenModal(false)}
          onOpened={async () => {
            setOpenModal(false);
            await load();
          }}
        />
      )}

      {closeModal && current && (
        <CloseShiftModal
          shift={current}
          onClose={() => setCloseModal(false)}
          onClosed={async () => {
            setCloseModal(false);
            await load();
          }}
        />
      )}

      {dropModal && current && (
        <DropModal
          shift={current}
          onClose={() => setDropModal(false)}
          onDropped={async () => {
            setDropModal(false);
            await load();
          }}
        />
      )}

      {detail && <ShiftDetailModal shift={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsedHM(startIso) {
  if (!startIso) return "";
  const start = new Date(startIso.replace(" ", "T") + "Z").getTime();
  const ms = Math.max(0, Date.now() - start);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}ชม ${m}นาที`;
}

function NoShiftPlaceholder({ onOpen }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-brand-orange">
        <Coins size={26} />
      </div>
      <p className="text-base font-semibold text-gray-700">ยังไม่มีกะที่เปิดอยู่</p>
      <p className="max-w-md text-sm text-gray-500">
        กดเปิดกะเพื่อเริ่มบันทึกยอดขายและเงินสด ออเดอร์ที่สร้างหลังจากเปิดกะจะถูก tag กับกะนี้อัตโนมัติ
      </p>
      <button onClick={onOpen} className="btn-primary mt-2">
        <Play size={14} /> เปิดกะ
      </button>
    </div>
  );
}

function ActiveShift({ shift, onDrop, onDeleteDrop }) {
  const cashOnHand = shift.opening_cash + shift.totals.cash_sales - shift.drops_total;
  return (
    <div>
      <div className="card mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">กะเปิดอยู่ #{shift.id}</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{shift.opened_by_name}</p>
          {shift.employee?.role && (
            <p className="text-xs text-gray-400">{shift.employee.role}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">เปิดเมื่อ {formatTime(shift.opened_at)}</p>
          <p className="text-sm font-medium text-gray-700">ใช้เวลา {elapsedHM(shift.opened_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="เงินสดเริ่มต้น"
          value={`฿${shift.opening_cash.toLocaleString()}`}
          Icon={Coins}
          iconBg="bg-orange-100"
          iconColor="text-brand-orange"
        />
        <StatCard
          label="ขายเงินสด"
          value={`฿${shift.totals.cash_sales.toLocaleString()}`}
          Icon={TrendingUp}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="ดรอป (รวม)"
          value={`฿${shift.drops_total.toLocaleString()}`}
          Icon={ArrowDownToLine}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          label="ที่ควรมี (ในลิ้นชัก)"
          value={`฿${cashOnHand.toLocaleString()}`}
          Icon={CheckCircle2}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">รายการดรอปเงิน</h3>
            <button onClick={onDrop} className="btn-secondary px-3 py-1.5 text-xs">
              <ArrowDownToLine size={14} /> ดรอปเงิน
            </button>
          </div>
          {shift.drops.length === 0 ? (
            <p className="rounded-xl bg-gray-50 py-6 text-center text-sm text-gray-400">
              ยังไม่มีรายการดรอป
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {shift.drops.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-semibold text-gray-900">
                      ฿{d.amount.toLocaleString()}
                    </p>
                    {d.reason && (
                      <p className="text-xs text-gray-500">{d.reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{formatTime(d.created_at)}</span>
                    <button
                      onClick={() => onDeleteDrop(d.id)}
                      className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h3 className="mb-3 text-base font-bold text-gray-900">ยอดขายตอนนี้</h3>
          <KV label="ออเดอร์" value={shift.totals.orders} />
          <KV label="ยอดรวม" value={`฿${shift.totals.revenue.toLocaleString()}`} />
          <KV label="ส่วนลด" value={`฿${shift.totals.discount.toLocaleString()}`} />
          <KV label="เงินสด" value={`฿${shift.totals.cash_sales.toLocaleString()}`} highlight />
          <KV label="QR/บัตร/อื่นๆ" value={`฿${shift.totals.non_cash_sales.toLocaleString()}`} />
        </div>
      </div>
    </div>
  );
}

function KV({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between border-t border-gray-100 py-2 text-sm first:border-t-0">
      <span className="text-gray-500">{label}</span>
      <span className={highlight ? "font-bold text-brand-orange" : "font-semibold text-gray-900"}>
        {value}
      </span>
    </div>
  );
}

function OpenShiftModal({ employees, onClose, onOpened }) {
  const [name, setName] = useState("");
  const [empId, setEmpId] = useState("");
  const [openingCash, setOpeningCash] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await apiPost("/shifts/open", {
        employee_id: empId ? Number(empId) : null,
        opened_by_name: name || employees.find((e) => String(e.id) === String(empId))?.name,
        opening_cash: Number(openingCash) || 0,
      });
      onOpened();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="เปิดกะ" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="พนักงาน">
          <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="input">
            <option value="">— ระบุชื่อเอง —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.role}
              </option>
            ))}
          </select>
        </Field>
        {!empId && (
          <Field label="ชื่อผู้เปิดกะ *">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="ชื่อพนักงาน"
            />
          </Field>
        )}
        <Field label="เงินสดเริ่มต้น (บาท)">
          <input
            type="number"
            min={0}
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            className="input"
          />
        </Field>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? "กำลังเปิด..." : "เปิดกะ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CloseShiftModal({ shift, onClose, onClosed }) {
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null);

  const expected = shift.expected_cash;
  const variance = counted !== "" ? Number(counted) - expected : null;

  const submit = async (e) => {
    e.preventDefault();
    if (counted === "") return setErr("กรุณานับเงินก่อนปิดกะ");
    setErr("");
    setBusy(true);
    try {
      const result = await apiPost(`/shifts/${shift.id}/close`, {
        closing_cash_counted: Number(counted),
        note: note || undefined,
      });
      setPreview(result);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (preview) {
    return (
      <Modal title="สรุปกะ" onClose={onClosed}>
        <ShiftSummary shift={preview} />
        <div className="flex justify-end pt-3">
          <button onClick={onClosed} className="btn-primary">
            เสร็จสิ้น
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`ปิดกะ #${shift.id}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-xl bg-orange-50/60 p-3 text-sm">
          <KV label="เงินสดเริ่มต้น" value={`฿${shift.opening_cash.toLocaleString()}`} />
          <KV label="+ เงินสดจากการขาย" value={`฿${shift.totals.cash_sales.toLocaleString()}`} />
          <KV label="− ดรอป" value={`฿${shift.drops_total.toLocaleString()}`} />
          <KV label="= ที่ควรมี" value={`฿${expected.toLocaleString()}`} highlight />
        </div>
        <Field label="ยอดเงินสดที่นับได้จริง (บาท) *">
          <input
            type="number"
            min={0}
            required
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className="input"
            autoFocus
          />
        </Field>
        {variance != null && (
          <div
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              variance === 0
                ? "bg-gray-100 text-gray-700"
                : variance > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-600"
            }`}
          >
            ส่วนต่าง: {variance > 0 ? "+" : ""}฿{variance.toLocaleString()}{" "}
            {variance < 0 ? "(เงินขาด)" : variance > 0 ? "(เงินเกิน)" : "(พอดี)"}
          </div>
        )}
        <Field label="หมายเหตุ">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input min-h-[60px] resize-y"
          />
        </Field>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? "กำลังปิด..." : "ปิดกะ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DropModal({ shift, onClose, onDropped }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await apiPost(`/shifts/${shift.id}/cash-drops`, {
        amount: Number(amount),
        reason: reason || undefined,
      });
      onDropped();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="ดรอปเงิน" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="จำนวนเงิน (บาท) *">
          <input
            type="number"
            min={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            autoFocus
          />
        </Field>
        <Field label="เหตุผล">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
            placeholder="เช่น ฝากธนาคาร, ส่งเซฟ..."
          />
        </Field>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ShiftDetailModal({ shift, onClose }) {
  return (
    <Modal title={`รายงานกะ #${shift.id}`} onClose={onClose}>
      <ShiftSummary shift={shift} />
    </Modal>
  );
}

function ShiftSummary({ shift }) {
  const v = shift.variance;
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gray-50 p-3 text-sm">
        <KV label="ผู้เปิดกะ" value={shift.opened_by_name} />
        <KV label="เปิด" value={formatTime(shift.opened_at)} />
        {shift.closed_at && <KV label="ปิด" value={formatTime(shift.closed_at)} />}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold text-gray-900">ยอดขาย</h4>
        <div className="rounded-xl bg-white p-3 ring-1 ring-gray-100 text-sm">
          <KV label="ออเดอร์" value={shift.totals.orders} />
          <KV label="ยอดรวม" value={`฿${shift.totals.revenue.toLocaleString()}`} />
          <KV label="เงินสด" value={`฿${shift.totals.cash_sales.toLocaleString()}`} />
          <KV label="QR/บัตร/อื่นๆ" value={`฿${shift.totals.non_cash_sales.toLocaleString()}`} />
          <KV label="ส่วนลด" value={`฿${shift.totals.discount.toLocaleString()}`} />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold text-gray-900">สรุปเงินสด</h4>
        <div className="rounded-xl bg-white p-3 ring-1 ring-gray-100 text-sm">
          <KV label="เงินสดเริ่มต้น" value={`฿${shift.opening_cash.toLocaleString()}`} />
          <KV label="+ ขายเงินสด" value={`฿${shift.totals.cash_sales.toLocaleString()}`} />
          <KV label="− ดรอป" value={`฿${shift.drops_total.toLocaleString()}`} />
          <KV label="= ที่ควรมี" value={`฿${shift.expected_cash.toLocaleString()}`} highlight />
          {shift.closing_cash_counted != null && (
            <>
              <KV label="ที่นับจริง" value={`฿${shift.closing_cash_counted.toLocaleString()}`} />
              <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold"
                style={{
                  backgroundColor: v === 0 ? "#f3f4f6" : v > 0 ? "#d1fae5" : "#fee2e2",
                  color: v === 0 ? "#374151" : v > 0 ? "#047857" : "#dc2626",
                }}>
                <span className="flex items-center gap-1.5">
                  {v === 0 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  ส่วนต่าง
                </span>
                <span>
                  {v > 0 ? "+" : ""}฿{(v ?? 0).toLocaleString()}
                  {v < 0 ? " (ขาด)" : v > 0 ? " (เกิน)" : " (พอดี)"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {shift.drops && shift.drops.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-gray-900">ดรอป ({shift.drops.length} ครั้ง)</h4>
          <ul className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-100">
            {shift.drops.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-900">฿{d.amount.toLocaleString()}</p>
                  {d.reason && <p className="text-xs text-gray-500">{d.reason}</p>}
                </div>
                <span className="text-xs text-gray-400">{formatTime(d.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shift.note && (
        <div>
          <h4 className="mb-1 text-sm font-bold text-gray-900">หมายเหตุ</h4>
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">{shift.note}</p>
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
