import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  TrendingUp,
  Pencil,
  Trash2,
  X,
  PlusCircle,
  MinusCircle,
  History,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api.js";

const emptyForm = { id: null, name: "", unit: "หน่วย", quantity: 0, threshold: 0, cost_per_unit: "" };

export default function Stock() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [adjustFor, setAdjustFor] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);

  const load = async () => setList(await apiGet("/ingredients", { auth: false }));
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => list.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase())),
    [list, q]
  );

  const low = list.filter((s) => s.low).length;
  const ok = list.length - low;

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      name: editing.name.trim(),
      unit: editing.unit.trim() || "หน่วย",
      quantity: Number(editing.quantity) || 0,
      threshold: Number(editing.threshold) || 0,
      cost_per_unit: editing.cost_per_unit === "" ? null : Number(editing.cost_per_unit),
    };
    if (editing.id) await apiPatch(`/ingredients/${editing.id}`, payload);
    else await apiPost("/ingredients", payload);
    setEditing(null);
    await load();
  };

  const del = async (id) => {
    if (!confirm("ลบวัตถุดิบนี้?")) return;
    await apiDelete(`/ingredients/${id}`);
    await load();
  };

  return (
    <div className="px-4 py-6 md:px-6">
      <PageHeader
        title="สต็อกวัตถุดิบ"
        subtitle="ติดตามวัตถุดิบและตั้งการแจ้งเตือนเมื่อใกล้หมด"
        actions={
          <button onClick={() => setEditing({ ...emptyForm })} className="btn-primary">
            <Plus size={16} /> เพิ่มวัตถุดิบ
          </button>
        }
      />

      {low > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              ⚠ มี {low} รายการใกล้หมดหรือหมดแล้ว
            </p>
            <p className="text-xs text-red-600">เติมสต็อกก่อนกระทบการขาย</p>
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="รายการทั้งหมด"
          value={list.length}
          Icon={Package}
          iconBg="bg-orange-100"
          iconColor="text-brand-orange"
        />
        <StatCard
          label="ใกล้หมด / หมด"
          value={low}
          Icon={AlertTriangle}
          iconBg="bg-red-100"
          iconColor="text-red-500"
        />
        <StatCard
          label="พอเพียง"
          value={ok}
          Icon={TrendingUp}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
      </div>

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาวัตถุดิบ..."
          className="input pl-10"
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50/80 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">ชื่อวัตถุดิบ</th>
              <th className="px-4 py-3 font-medium text-right">คงเหลือ</th>
              <th className="px-4 py-3 font-medium">หน่วย</th>
              <th className="px-4 py-3 font-medium text-right">ขั้นต่ำ</th>
              <th className="px-4 py-3 font-medium text-right">ต้นทุน/หน่วย</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((s) => (
              <tr key={s.id} className={s.low ? "bg-red-50/30" : "hover:bg-orange-50/30"}>
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {Number(s.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-gray-500">{s.unit}</td>
                <td className="px-4 py-3 text-right text-gray-500">{s.threshold}</td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {s.cost_per_unit != null ? `฿${s.cost_per_unit}` : "—"}
                </td>
                <td className="px-4 py-3">
                  {s.low ? (
                    <StatusBadge status="ใกล้หมด" />
                  ) : (
                    <StatusBadge status="พอเพียง" />
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setAdjustFor(s)}
                      className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                      title="เพิ่ม/ลด สต็อก"
                    >
                      <PlusCircle size={16} />
                    </button>
                    <button
                      onClick={() => setHistoryFor(s)}
                      className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
                      title="ประวัติ"
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={() => setEditing(s)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => del(s.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  ยังไม่มีวัตถุดิบ — กดปุ่ม “เพิ่มวัตถุดิบ” เพื่อเริ่มต้น
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? "แก้ไขวัตถุดิบ" : "เพิ่มวัตถุดิบ"} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <Field label="ชื่อ *">
              <input
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="input"
                placeholder="เช่น เมล็ดกาแฟ, นมสด"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="หน่วย">
                <input
                  value={editing.unit}
                  onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                  className="input"
                  placeholder="กรัม, ml, ฟอง, ชิ้น..."
                />
              </Field>
              <Field label="ต้นทุน/หน่วย (บาท)">
                <input
                  type="number"
                  step="0.01"
                  value={editing.cost_per_unit}
                  onChange={(e) => setEditing({ ...editing, cost_per_unit: e.target.value })}
                  className="input"
                  placeholder="0"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ปริมาณคงเหลือ">
                <input
                  type="number"
                  step="0.01"
                  value={editing.quantity}
                  onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="ขั้นต่ำ (เตือนเมื่อต่ำกว่า)">
                <input
                  type="number"
                  step="0.01"
                  value={editing.threshold}
                  onChange={(e) => setEditing({ ...editing, threshold: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                ยกเลิก
              </button>
              <button type="submit" className="btn-primary">
                บันทึก
              </button>
            </div>
          </form>
        </Modal>
      )}

      {adjustFor && (
        <AdjustModal
          item={adjustFor}
          onClose={() => setAdjustFor(null)}
          onDone={async () => {
            setAdjustFor(null);
            await load();
          }}
        />
      )}

      {historyFor && (
        <HistoryModal item={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}

function AdjustModal({ item, onClose, onDone }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState("add"); // add | subtract
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(delta);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    try {
      await apiPost(`/ingredients/${item.id}/adjust`, {
        delta: mode === "add" ? n : -n,
        reason: reason || (mode === "add" ? "รับเข้า" : "ตัดจ่าย"),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`ปรับสต็อก · ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-xl bg-gray-50 p-3 text-sm">
          <p className="text-gray-500">ปัจจุบัน</p>
          <p className="text-lg font-bold text-gray-900">
            {item.quantity} {item.unit}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("add")}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition ${
              mode === "add"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <PlusCircle size={16} /> รับเข้า
          </button>
          <button
            type="button"
            onClick={() => setMode("subtract")}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition ${
              mode === "subtract"
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-gray-200 text-gray-600"
            }`}
          >
            <MinusCircle size={16} /> ตัดจ่าย
          </button>
        </div>
        <Field label={`จำนวน (${item.unit})`}>
          <input
            type="number"
            step="0.01"
            required
            min={0}
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            className="input"
            autoFocus
          />
        </Field>
        <Field label="เหตุผล">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
            placeholder={mode === "add" ? "เช่น รับซื้อจากซัพพลายเออร์" : "เช่น เสียหาย, หล่น"}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
            บันทึก
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ item, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    apiGet(`/ingredients/${item.id}/movements`).then(setRows);
  }, [item.id]);
  return (
    <Modal title={`ประวัติ · ${item.name}`} onClose={onClose}>
      {!rows ? (
        <p className="py-6 text-center text-sm text-gray-400">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">ยังไม่มีรายการ</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2.5">
              <div>
                <p
                  className={`text-sm font-bold ${
                    r.delta > 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {r.delta > 0 ? "+" : ""}
                  {r.delta} {item.unit}
                </p>
                <p className="text-xs text-gray-500">
                  {r.reason || "—"}
                  {r.ref_order_id ? ` · ออเดอร์ #${r.ref_order_id}` : ""}
                </p>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(r.created_at.replace(" ", "T") + "Z").toLocaleString("th-TH", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
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
