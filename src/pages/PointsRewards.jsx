import { useState, useEffect } from "react";
import { Plus, Gift, Clock, CheckCircle2, Pencil, Trash2, X } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import SectionTabs, { SECTIONS } from "../components/SectionTabs.jsx";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api.js";

const TABS = [
  { id: "rewards", label: "รายการรางวัล" },
  { id: "history", label: "ประวัติการแลก" },
  { id: "member-points", label: "แต้มสมาชิก" },
];

export default function PointsRewards() {
  const [tab, setTab] = useState("rewards");
  const [rewardsList, setRewardsList] = useState([]);
  const [membersList, setMembersList] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [editing, setEditing] = useState(null);

  const loadRewards = async () => setRewardsList(await apiGet("/rewards"));
  const loadMembers = async () => setMembersList(await apiGet("/members"));
  const loadMenu = async () => setMenuItems(await apiGet("/menu"));

  useEffect(() => {
    if (tab === "rewards") {
      loadRewards();
      loadMenu();
    } else if (tab === "member-points") {
      loadMembers();
    }
  }, [tab]);

  const totalPoints = membersList.reduce((s, m) => s + (m.points || 0), 0);
  const activeRewards = rewardsList.filter((r) => r.active).length;

  const saveReward = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...editing };
      if (!payload.discount_value && !payload.menu_item_id) {
        throw new Error("กรุณาระบุส่วนลด หรือ เลือกเมนูฟรี อย่างใดอย่างหนึ่ง");
      }
      if (editing.id) {
        await apiPut(`/rewards/${editing.id}`, payload);
      } else {
        await apiPost("/rewards", payload);
      }
      setEditing(null);
      await loadRewards();
    } catch (e) {
      alert(e.message);
    }
  };

  const delReward = async (id) => {
    if (!confirm("ลบรางวัลนี้?")) return;
    await apiDelete(`/rewards/${id}`);
    await loadRewards();
  };

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="จัดการแต้มและรางวัล"
        subtitle="ตั้งค่าระบบแต้มสะสมและรางวัลแลกแต้ม"
      />
      <SectionTabs tabs={SECTIONS.members} />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card border-l-4 border-l-brand-orange p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">แต้มทั้งหมดในระบบ</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {totalPoints.toLocaleString()}
              </p>
            </div>
            <Gift size={28} className="text-brand-orange" />
          </div>
        </div>
        <div className="card border-l-4 border-l-amber-400 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">รอตรวจสอบการแลก</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">0</p>
            </div>
            <Clock size={28} className="text-amber-500" />
          </div>
        </div>
        <div className="card border-l-4 border-l-emerald-400 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">รางวัลที่เปิดใช้งาน</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {activeRewards}
              </p>
            </div>
            <CheckCircle2 size={28} className="text-emerald-500" />
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pill ${
                tab === t.id ? "pill-active" : "pill-inactive"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "rewards" && (
          <button
            onClick={() => setEditing({ id: null, name: "", points_cost: 0, discount_value: "", menu_item_id: "", active: true })}
            className="btn-primary"
          >
            <Plus size={16} />
            เพิ่มรางวัล
          </button>
        )}
      </div>

      {tab === "rewards" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rewardsList.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-brand-orange">
                  <Gift size={20} />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(r)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => delReward(r.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-4 text-base font-semibold text-gray-900">
                {r.name}
              </p>
              <p className="text-xs text-gray-500">
                {r.discount_value ? `ส่วนลด ฿${r.discount_value}` : r.menu_item_name ? `ฟรี ${r.menu_item_name}` : ""}
              </p>
              <p className="mt-1 text-sm font-bold text-brand-orange">
                ใช้ {r.points_cost} แต้ม
              </p>
              <div className="mt-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    r.active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      r.active ? "bg-emerald-500" : "bg-gray-400"
                    }`}
                  />
                  {r.active ? "เปิดใช้งาน" : "ปิดอยู่"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div className="card p-10 text-center text-gray-400">
          ยังไม่มีประวัติการแลกแต้ม
        </div>
      )}

      {tab === "member-points" && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-left text-xs text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">สมาชิก</th>
                <th className="px-5 py-3 font-medium">เบอร์โทร</th>
                <th className="px-5 py-3 font-medium text-right">แต้มสะสม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {membersList.map((m) => (
                <tr key={m.id} className="hover:bg-orange-50/30">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {m.name}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{m.phone}</td>
                  <td className="px-5 py-3 text-right font-bold text-brand-orange">
                    {(m.points || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-bold text-gray-900">
                {editing.id ? "แก้ไขของรางวัล" : "เพิ่มของรางวัล"}
              </h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <form onSubmit={saveReward} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">ชื่อรางวัล</label>
                  <input
                    required
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="input"
                    placeholder="เช่น ส่วนลด 50 บาท"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">แต้มที่ใช้</label>
                  <input
                    required
                    type="number"
                    value={editing.points_cost}
                    onChange={(e) => setEditing({ ...editing, points_cost: e.target.value })}
                    className="input"
                    placeholder="0"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">ส่วนลด (บาท)</label>
                    <input
                      type="number"
                      value={editing.discount_value}
                      onChange={(e) => setEditing({ ...editing, discount_value: e.target.value, menu_item_id: "" })}
                      className="input"
                      placeholder="0"
                      disabled={!!editing.menu_item_id}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">เมนูฟรี</label>
                    <select
                      value={editing.menu_item_id || ""}
                      onChange={(e) => setEditing({ ...editing, menu_item_id: e.target.value, discount_value: "" })}
                      className="input"
                      disabled={!!editing.discount_value}
                    >
                      <option value="">- เลือกเมนูฟรี -</option>
                      {menuItems.map(mi => (
                        <option key={mi.id} value={mi.id}>{mi.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-brand-orange focus:ring-brand-orange"
                  />
                  เปิดใช้งานรางวัลนี้
                </label>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
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
        </div>
      )}
    </div>
  );
}
