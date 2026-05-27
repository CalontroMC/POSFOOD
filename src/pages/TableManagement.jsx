import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, QrCode, Pencil, Users, Trash2, Printer, X, RefreshCcw } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api.js";

const BORDERS = {
  ว่าง: "border-emerald-300",
  มีลูกค้า: "border-orange-300",
  จองแล้ว: "border-purple-300",
};

const DOTS = {
  ว่าง: "bg-emerald-500",
  มีลูกค้า: "bg-orange-500",
  จองแล้ว: "bg-purple-500",
};

const SUMMARY = [
  { key: "ว่าง", cardBorder: "border-2 border-emerald-200", dot: "bg-emerald-500" },
  { key: "มีลูกค้า", cardBorder: "border-2 border-orange-200", dot: "bg-orange-500" },
  { key: "จองแล้ว", cardBorder: "border-2 border-purple-200", dot: "bg-purple-500" },
];

export default function TableManagement() {
  const nav = useNavigate();
  const [tables, setTables] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [qrFor, setQrFor] = useState(null);
  const [form, setForm] = useState({ table_number: "", seats: 4, zone: "ในร้าน" });

  const load = async () => setTables(await apiGet("/tables", { auth: false }));
  useEffect(() => {
    load();
  }, []);

  const counts = tables.reduce(
    (acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }),
    {}
  );

  const submit = async (e) => {
    e.preventDefault();
    try {
      await apiPost("/tables", form);
      setShowAdd(false);
      setForm({ table_number: "", seats: 4, zone: "ในร้าน" });
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const del = async (id) => {
    if (!confirm("ลบโต๊ะนี้?")) return;
    await apiDelete(`/tables/${id}`);
    await load();
  };

  const cycleStatus = async (t) => {
    const order = ["ว่าง", "มีลูกค้า", "จองแล้ว"];
    const next = order[(order.indexOf(t.status) + 1) % order.length];
    await apiPatch(`/tables/${t.id}`, { status: next });
    await load();
  };

  const rotateToken = async (id) => {
    if (!confirm("สร้าง QR ใหม่? (อันเก่าจะใช้ไม่ได้)")) return;
    await apiPost(`/tables/${id}/rotate-token`);
    await load();
  };

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="จัดการโต๊ะ"
        subtitle="จัดการโต๊ะและสร้าง QR Code สำหรับลูกค้า"
        actions={
          <div className="flex gap-2">
            <button onClick={() => nav("/print-qr")} className="btn-secondary">
              <Printer size={16} /> พิมพ์ QR ทุกโต๊ะ
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus size={16} /> เพิ่มโต๊ะ
            </button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SUMMARY.map((s) => (
          <div key={s.key} className={`card ${s.cardBorder} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.key}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {counts[s.key] || 0}
                </p>
              </div>
              <span className={`h-3 w-3 rounded-full ${s.dot}`} aria-hidden />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => (
          <div
            key={t.id}
            className={`card border-2 ${BORDERS[t.status] || "border-gray-200"} p-4`}
          >
            <div className="flex items-start justify-between">
              <span
                className={`h-2.5 w-2.5 rounded-full ${DOTS[t.status] || "bg-gray-400"}`}
                aria-hidden
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setQrFor(t)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  title="ดู QR"
                >
                  <QrCode size={15} />
                </button>
                <button
                  onClick={() => cycleStatus(t)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  title="เปลี่ยนสถานะ"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => del(t.id)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  title="ลบ"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-3xl font-bold text-gray-900">{t.table_number}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              <Users size={13} />
              {t.seats} ที่นั่ง
            </p>
            <p className="mt-0.5 text-xs text-gray-400">โซน: {t.zone}</p>
            <div className="mt-3">
              <StatusBadge status={t.status} />
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title="เพิ่มโต๊ะ">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">ชื่อโต๊ะ</label>
              <input
                required
                value={form.table_number}
                onChange={(e) => setForm({ ...form, table_number: e.target.value })}
                className="input"
                placeholder="เช่น A5"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">จำนวนที่นั่ง</label>
              <input
                type="number"
                min={1}
                value={form.seats}
                onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">โซน</label>
              <select
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                className="input"
              >
                <option>ในร้าน</option>
                <option>นอกร้าน</option>
                <option>มุมนอกร้าน</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">
                ยกเลิก
              </button>
              <button type="submit" className="btn-primary">
                บันทึก
              </button>
            </div>
          </form>
        </Modal>
      )}

      {qrFor && <QRModal table={qrFor} onClose={() => setQrFor(null)} onRotate={() => { rotateToken(qrFor.id); setQrFor(null); }} />}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function QRModal({ table, onClose, onRotate }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    apiGet(`/tables/${table.id}/qr-info`, { auth: false }).then((d) => setUrl(d.url));
  }, [table.id]);
  return (
    <Modal title={`QR · โต๊ะ ${table.table_number}`} onClose={onClose}>
      <div className="space-y-3 text-center">
        <img
          src={`/api/tables/${table.id}/qr.png?t=${Date.now()}`}
          alt="QR"
          className="mx-auto h-64 w-64 rounded-xl border border-gray-100 bg-white p-2"
        />
        {url && (
          <p className="break-all rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            {url}
          </p>
        )}
        <div className="flex gap-2">
          <a
            href={`/api/tables/${table.id}/qr.png`}
            download={`qr-${table.table_number}.png`}
            className="btn-secondary flex-1"
          >
            ดาวน์โหลด PNG
          </a>
          <button onClick={onRotate} className="btn-secondary">
            <RefreshCcw size={14} />
            สร้างใหม่
          </button>
        </div>
      </div>
    </Modal>
  );
}
