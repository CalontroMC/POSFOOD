import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import SectionTabs, { SECTIONS } from "../components/SectionTabs.jsx";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api.js";

export default function MemberTiers() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => setList(await apiGet("/members/tiers/list"));
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing.id) {
        await apiPut(`/members/tiers/${editing.id}`, editing);
      } else {
        await apiPost("/members/tiers", editing);
      }
      setEditing(null);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const del = async (id) => {
    if (!confirm("ลบระดับสมาชิกนี้? สมาชิกที่อยู่ในระดับนี้จะถูกเปลี่ยนให้ไม่มีระดับ")) return;
    await apiDelete(`/members/tiers/${id}`);
    await load();
  };

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="ระดับสมาชิก"
        subtitle="จัดการระดับสมาชิก (Tiers) ยอดที่ต้องใช้ และส่วนลด/แต้มคูณ"
        actions={
          <button
            onClick={() => setEditing({ id: null, name: "", min_spending: 0, discount_percent: 0, points_multiplier: 1.0 })}
            className="btn-primary"
          >
            <Plus size={16} /> เพิ่มระดับ
          </button>
        }
      />
      <SectionTabs tabs={SECTIONS.members} />

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-400">
          ยังไม่มีระดับสมาชิก กดปุ่ม “เพิ่มระดับ” เพื่อเริ่มต้น
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">ชื่อระดับ</th>
                <th className="px-4 py-3 font-medium">ยอดสะสมขั้นต่ำ</th>
                <th className="px-4 py-3 font-medium">ส่วนลด (%)</th>
                <th className="px-4 py-3 font-medium">คูณแต้ม</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3">฿{t.min_spending.toLocaleString()}</td>
                  <td className="px-4 py-3 text-emerald-600">{t.discount_percent}%</td>
                  <td className="px-4 py-3 text-brand-orange">x{t.points_multiplier}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(t)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => del(t.id)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-4 text-base font-bold text-gray-900">
              {editing.id ? "แก้ไขระดับสมาชิก" : "เพิ่มระดับสมาชิก"}
            </h3>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">ชื่อระดับ (Tier Name)</label>
                <input
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="input"
                  placeholder="เช่น VIP, Gold, Diamond"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">ยอดสะสมขั้นต่ำ (บาท)</label>
                <input
                  required
                  type="number"
                  value={editing.min_spending}
                  onChange={(e) => setEditing({ ...editing, min_spending: e.target.value })}
                  className="input"
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">ส่วนลดอัตโนมัติ (%)</label>
                  <input
                    required
                    type="number"
                    value={editing.discount_percent}
                    onChange={(e) => setEditing({ ...editing, discount_percent: e.target.value })}
                    className="input"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">อัตราคูณแต้ม</label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    value={editing.points_multiplier}
                    onChange={(e) => setEditing({ ...editing, points_multiplier: e.target.value })}
                    className="input"
                    placeholder="1.0"
                  />
                </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
