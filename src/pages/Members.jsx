import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Users, Activity, Gift, X, History } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import SectionTabs, { SECTIONS } from "../components/SectionTabs.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api.js";

const COLORS = [
  "bg-orange-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-pink-500",
  "bg-blue-500",
  "bg-amber-500",
];

export default function Members() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);

  const [tiers, setTiers] = useState([]);
  const [stats, setStats] = useState(null);

  const load = async () => {
    setList(await apiGet("/members"));
    setTiers(await apiGet("/members/tiers/list").catch(() => []));
    setStats(await apiGet("/members/stats").catch(() => null));
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      list.filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q.toLowerCase()) ||
          (m.phone || "").includes(q)
      ),
    [list, q]
  );

  const totalPoints = list.reduce((s, m) => s + (m.points || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: editing.name,
        phone: editing.phone,
        tier_id: editing.tier_id || null,
        dob: editing.dob || null,
        tags: editing.tags || null,
      };
      if (editing.id) {
        await apiPatch(`/members/${editing.id}`, payload);
      } else {
        await apiPost("/members", payload);
      }
      setEditing(null);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const del = async (id) => {
    if (!confirm("ลบสมาชิกนี้?")) return;
    await apiDelete(`/members/${id}`);
    await load();
  };

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="สมาชิก"
        subtitle="จัดการข้อมูลและแต้มสะสมของสมาชิก"
        actions={
          <button
            onClick={() => setEditing({ id: null, name: "", phone: "", tier_id: "", dob: "", tags: "" })}
            className="btn-primary"
          >
            <Plus size={16} /> เพิ่มสมาชิก
          </button>
        }
      />
      <SectionTabs tabs={SECTIONS.members} />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="สมาชิกทั้งหมด"
          value={stats?.total ?? list.length}
          Icon={Users}
          iconBg="bg-orange-100"
          iconColor="text-brand-orange"
        />
        <StatCard
          label="ซื้อล่าสุดเดือนนี้"
          value={stats?.activeThisMonth ?? "-"}
          Icon={Activity}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="แต้มทั้งหมด"
          value={totalPoints.toLocaleString()}
          Icon={Gift}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
      </div>

      <div className="mb-4 relative">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อหรือเบอร์โทร..."
          className="input pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-400">
          ยังไม่มีสมาชิก กดปุ่ม “เพิ่มสมาชิก” เพื่อเริ่มต้น
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m, i) => (
            <div key={m.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white ${COLORS[i % COLORS.length]}`}
                  >
                    {m.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {m.name}
                      </p>
                      {m.tier_name && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800">
                          {m.tier_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{m.phone}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setHistoryFor(m)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                    title="ประวัติการซื้อ"
                  >
                    <History size={14} />
                  </button>
                  <button
                    onClick={() => setEditing(m)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => del(m.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-orange-50/50 p-3 text-center">
                <Stat label="แต้ม" value={m.points} />
                <Stat label="฿ ใช้จ่าย" value={(m.spending || 0).toLocaleString()} />
                <Stat label="ครั้ง" value={m.visits} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? "แก้ไขสมาชิก" : "เพิ่มสมาชิก"} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">ชื่อ</label>
              <input
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">เบอร์โทร</label>
              <input
                required
                value={editing.phone}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                className="input"
                placeholder="0XX-XXX-XXXX"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">ระดับสมาชิก</label>
              <select
                value={editing.tier_id || ""}
                onChange={(e) => setEditing({ ...editing, tier_id: e.target.value })}
                className="input"
              >
                <option value="">ไม่มีระดับ</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">วันเกิด</label>
              <input
                type="date"
                value={editing.dob || ""}
                onChange={(e) => setEditing({ ...editing, dob: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">ป้ายกำกับ (Tags)</label>
              <input
                value={editing.tags || ""}
                onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                className="input"
                placeholder="เช่น VIP, แพ้กุ้ง"
              />
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

      {historyFor && (
        <MemberHistoryModal
          memberId={historyFor.id}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-bold text-brand-orange">{value}</p>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className={`flex max-h-[90vh] w-full ${wide ? "max-w-lg" : "max-w-sm"} flex-col overflow-hidden rounded-2xl bg-white shadow-lg`}>
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

function MemberHistoryModal({ memberId, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    apiGet(`/members/${memberId}/history`).then(setData);
  }, [memberId]);
  if (!data)
    return (
      <Modal title="ประวัติการซื้อ" onClose={onClose} wide>
        <p className="py-8 text-center text-sm text-gray-400">กำลังโหลด...</p>
      </Modal>
    );
  const { member, orders, top_items } = data;
  return (
    <Modal title={`ประวัติ · ${member.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-orange-50/60 p-3 text-center">
          <Stat label="แต้ม" value={member.points} />
          <Stat label="ใช้จ่ายรวม" value={`฿${(member.spending || 0).toLocaleString()}`} />
          <Stat label="จำนวนครั้ง" value={member.visits} />
        </div>

        {top_items?.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-bold text-gray-900">เมนูที่ชอบสั่ง</h4>
            <ul className="space-y-1.5">
              {top_items.map((t, i) => (
                <li key={t.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-brand-orange">
                      {i + 1}
                    </span>
                    {t.name}
                  </span>
                  <span className="font-semibold text-gray-700">{t.qty} ครั้ง</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-sm font-bold text-gray-900">ออเดอร์ล่าสุด</h4>
          {orders.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-400">
              ยังไม่มีประวัติ
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-100">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-semibold text-gray-900">{o.order_number}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(o.created_at.replace(" ", "T") + "Z").toLocaleString("th-TH", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {o.table_number ? ` · โต๊ะ ${o.table_number}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-orange">฿{o.total}</p>
                    <StatusBadge status={o.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
