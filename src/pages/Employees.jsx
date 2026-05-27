import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, UserCheck, UserX } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Toggle from "../components/Toggle.jsx";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api.js";

const COLORS = [
  "bg-orange-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-pink-500",
  "bg-blue-500",
  "bg-amber-500",
];

export default function Employees() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => setList(await apiGet("/employees", { auth: false }));
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: editing.name.trim(),
        role: editing.role.trim() || "พนักงาน",
        phone: editing.phone?.trim() || null,
        active: editing.active ? 1 : 0,
      };
      if (editing.id) await apiPatch(`/employees/${editing.id}`, payload);
      else await apiPost("/employees", payload);
      setEditing(null);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const del = async (id) => {
    if (!confirm("ลบพนักงานคนนี้?")) return;
    await apiDelete(`/employees/${id}`);
    await load();
  };

  const active = list.filter((e) => e.active);
  const inactive = list.filter((e) => !e.active);

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="พนักงาน"
        subtitle="จัดการข้อมูลพนักงานที่ใช้สำหรับเปิดกะ"
        actions={
          <button
            onClick={() =>
              setEditing({ id: null, name: "", role: "พนักงาน", phone: "", active: 1 })
            }
            className="btn-primary"
          >
            <Plus size={16} /> เพิ่มพนักงาน
          </button>
        }
      />

      <Section title="ใช้งานอยู่" Icon={UserCheck} count={active.length}>
        <Grid list={active} onEdit={setEditing} onDelete={del} colorOffset={0} />
      </Section>

      {inactive.length > 0 && (
        <Section title="ปิดใช้งาน" Icon={UserX} count={inactive.length}>
          <Grid list={inactive} onEdit={setEditing} onDelete={del} colorOffset={3} muted />
        </Section>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                {editing.id ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}
              </h3>
              <button onClick={() => setEditing(null)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <Field label="ชื่อ *">
                <input
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="ตำแหน่ง">
                <input
                  value={editing.role || ""}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  className="input"
                  placeholder="แคชเชียร์, พนักงานเสิร์ฟ ..."
                />
              </Field>
              <Field label="เบอร์โทร">
                <input
                  value={editing.phone || ""}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  className="input"
                />
              </Field>
              <Toggle
                checked={!!editing.active}
                onChange={(v) => setEditing({ ...editing, active: v ? 1 : 0 })}
                label="ใช้งานอยู่"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, Icon, count, children }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={16} className="text-gray-400" />
        <h2 className="text-sm font-bold text-gray-700">
          {title} <span className="text-gray-400">({count})</span>
        </h2>
      </div>
      {children}
    </section>
  );
}

function Grid({ list, onEdit, onDelete, colorOffset = 0, muted }) {
  if (list.length === 0)
    return (
      <div className="card p-8 text-center text-sm text-gray-400">— ไม่มี —</div>
    );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((e, i) => (
        <div key={e.id} className={`card p-4 ${muted ? "opacity-60" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white ${
                  COLORS[(i + colorOffset) % COLORS.length]
                }`}
              >
                {e.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {e.name}
                </p>
                <p className="text-xs text-gray-400">{e.role}</p>
                {e.phone && <p className="text-xs text-gray-400">{e.phone}</p>}
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onEdit(e)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(e.id)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
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
