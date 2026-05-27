import { useState } from "react";
import { Plus, Gift, Clock, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import SectionTabs, { SECTIONS } from "../components/SectionTabs.jsx";
import { rewards, members } from "../lib/mockData.js";

const TABS = [
  { id: "rewards", label: "รายการรางวัล" },
  { id: "history", label: "ประวัติการแลก" },
  { id: "member-points", label: "แต้มสมาชิก" },
];

export default function PointsRewards() {
  const [tab, setTab] = useState("rewards");
  const totalPoints = members.reduce((s, m) => s + m.points, 0);
  const activeRewards = rewards.filter((r) => r.active).length;

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
          <button className="btn-primary">
            <Plus size={16} />
            เพิ่มรางวัล
          </button>
        )}
      </div>

      {tab === "rewards" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-brand-orange">
                  <Gift size={20} />
                </div>
                <div className="flex gap-1">
                  <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                    <Pencil size={14} />
                  </button>
                  <button className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-4 text-base font-semibold text-gray-900">
                {r.name}
              </p>
              <p className="mt-1 text-sm font-bold text-brand-orange">
                ใช้ {r.points} แต้ม
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
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-orange-50/30">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {m.name}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{m.phone}</td>
                  <td className="px-5 py-3 text-right font-bold text-brand-orange">
                    {m.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
