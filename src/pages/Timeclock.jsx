import { useEffect, useState } from "react";
import { Clock, LogIn, LogOut, RefreshCcw } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import SectionTabs, { SECTIONS } from "../components/SectionTabs.jsx";
import { apiGet, apiPost } from "../lib/api.js";

export default function Timeclock() {
  const [status, setStatus] = useState([]);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState([]);

  const load = async () => {
    const [s, h, sm] = await Promise.all([
      apiGet("/timeclock/status"),
      apiGet("/timeclock?limit=50"),
      apiGet("/timeclock/summary"),
    ]);
    setStatus(s);
    setHistory(h);
    setSummary(sm);
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const punch = async (empId, type) => {
    await apiPost("/timeclock", { employee_id: empId, type });
    await load();
  };

  return (
    <div className="px-4 py-6 md:px-6">
      <PageHeader
        title="ตอกบัตรเข้า-ออกงาน"
        subtitle="บันทึกเวลาทำงานของพนักงาน"
        actions={
          <button onClick={load} className="btn-secondary">
            <RefreshCcw size={14} /> รีเฟรช
          </button>
        }
      />
      <SectionTabs tabs={SECTIONS.shift} />

      <h2 className="mb-2 text-sm font-bold text-gray-700">พนักงานที่ใช้งานอยู่</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {status.length === 0 && (
          <div className="card p-6 text-center text-sm text-gray-400 sm:col-span-2 lg:col-span-3">
            ยังไม่มีพนักงาน — เพิ่มที่หน้า “พนักงาน” ก่อน
          </div>
        )}
        {status.map((e) => {
          const todayMin =
            summary.find((s) => s.employee?.id === e.id)?.today_min || 0;
          const weekMin =
            summary.find((s) => s.employee?.id === e.id)?.week_min || 0;
          return (
            <div key={e.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">{e.name}</p>
                  <p className="text-xs text-gray-400">{e.role}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    e.clocked_in
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {e.clocked_in ? "● กำลังทำงาน" : "ออกงานแล้ว"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg bg-orange-50 p-2">
                  <p className="text-gray-500">วันนี้</p>
                  <p className="font-bold text-brand-orange">
                    {Math.floor(todayMin / 60)}ชม {todayMin % 60}น
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 p-2">
                  <p className="text-gray-500">7 วัน</p>
                  <p className="font-bold text-blue-600">
                    {Math.floor(weekMin / 60)}ชม {weekMin % 60}น
                  </p>
                </div>
              </div>
              <div className="mt-3">
                {e.clocked_in ? (
                  <button
                    onClick={() => punch(e.id, "out")}
                    className="btn-secondary w-full text-red-500"
                  >
                    <LogOut size={14} /> ตอกบัตรออก
                  </button>
                ) : (
                  <button
                    onClick={() => punch(e.id, "in")}
                    className="btn-primary w-full"
                  >
                    <LogIn size={14} /> ตอกบัตรเข้า
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-bold text-gray-700">ประวัติ (50 รายการล่าสุด)</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-gray-50/80 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">พนักงาน</th>
              <th className="px-4 py-3 font-medium">ประเภท</th>
              <th className="px-4 py-3 font-medium">เวลา</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {history.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-xs text-gray-400">
                  ยังไม่มีประวัติ
                </td>
              </tr>
            )}
            {history.map((h) => (
              <tr key={h.id} className="hover:bg-orange-50/30">
                <td className="px-4 py-3 font-medium text-gray-900">{h.employee_name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                      h.type === "in"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {h.type === "in" ? <LogIn size={10} /> : <LogOut size={10} />}
                    {h.type === "in" ? "เข้างาน" : "ออกงาน"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(h.created_at.replace(" ", "T") + "Z").toLocaleString("th-TH", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
