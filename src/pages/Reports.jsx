import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  Receipt,
  TrendingUp,
  PiggyBank,
  Calendar,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { apiGet } from "../lib/api.js";

const PERIODS = [
  { id: "today", label: "วันนี้" },
  { id: "week", label: "7 วัน" },
  { id: "month", label: "เดือนนี้" },
  { id: "year", label: "ปีนี้" },
];

export default function Reports() {
  const [period, setPeriod] = useState("today");
  const [summary, setSummary] = useState(null);
  const [byItem, setByItem] = useState([]);
  const [byCat, setByCat] = useState([]);

  useEffect(() => {
    (async () => {
      const [s, i, c] = await Promise.all([
        apiGet(`/reports/summary?period=${period}`),
        apiGet(`/reports/by-item?period=${period}`),
        apiGet(`/reports/by-category?period=${period}`),
      ]);
      setSummary(s);
      setByItem(i);
      setByCat(c);
    })();
  }, [period]);

  const top5 = useMemo(() => byItem.slice(0, 5), [byItem]);
  const bottom5 = useMemo(() => [...byItem].reverse().slice(0, 5), [byItem]);

  return (
    <div className="px-4 py-6 md:px-6">
      <PageHeader
        title="รายงานยอดขาย"
        subtitle="สรุปรายได้ ต้นทุน กำไร และยอดขายตามเมนู / หมวดหมู่"
        actions={
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`pill ${period === p.id ? "pill-active" : "pill-inactive"}`}
              >
                <Calendar size={12} /> {p.label}
              </button>
            ))}
          </div>
        }
      />

      {!summary ? (
        <div className="card p-10 text-center text-sm text-gray-400">กำลังโหลด...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="รายได้"
              value={`฿${(summary.summary.revenue || 0).toLocaleString()}`}
              Icon={DollarSign}
              iconBg="bg-orange-100"
              iconColor="text-brand-orange"
            />
            <StatCard
              label="จำนวนบิล"
              value={summary.summary.bills || 0}
              Icon={Receipt}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
            />
            <StatCard
              label="เฉลี่ย/บิล"
              value={`฿${summary.summary.avgPerBill || 0}`}
              Icon={TrendingUp}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
            />
            <StatCard
              label="กำไรเบื้องต้น"
              value={`฿${(summary.summary.profit || 0).toLocaleString()}`}
              Icon={PiggyBank}
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
            />
          </div>

          <div className="mt-5 card p-5">
            <h3 className="mb-4 text-base font-bold text-gray-900">
              ยอดขาย{period === "today" ? "รายชั่วโมง" : "รายวัน"}
            </h3>
            {summary.series.length === 0 ? (
              <EmptyState title="ยังไม่มีข้อมูลในช่วงนี้" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      tickFormatter={(v) =>
                        period === "today" ? `${String(v).padStart(2, "0")}:00` : v.slice(5)
                      }
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #f1f1f1",
                        fontSize: 12,
                      }}
                      formatter={(v) => [`฿${v}`, "รายได้"]}
                    />
                    <Bar dataKey="revenue" fill="#F97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="mb-3 text-base font-bold text-gray-900">
                🏆 เมนูขายดี (Top 5)
              </h3>
              {top5.length === 0 ? (
                <EmptyState title="ยังไม่มีข้อมูล" />
              ) : (
                <ul className="space-y-2.5">
                  {top5.map((m, i) => (
                    <li key={m.name} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-brand-orange">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{m.name}</p>
                        <p className="text-xs text-gray-500">
                          ขาย {m.qty} จาน · ฿{m.revenue.toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5">
              <h3 className="mb-3 text-base font-bold text-gray-900">
                📉 เมนูขายน้อย (ล่าสุด)
              </h3>
              {bottom5.length === 0 ? (
                <EmptyState title="ยังไม่มีข้อมูล" />
              ) : (
                <ul className="space-y-2.5">
                  {bottom5.map((m) => (
                    <li key={m.name} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-400">
                        —
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{m.name}</p>
                        <p className="text-xs text-gray-500">
                          ขาย {m.qty} จาน · ฿{m.revenue.toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-5 card p-5">
            <h3 className="mb-4 text-base font-bold text-gray-900">ยอดขายตามหมวดหมู่</h3>
            {byCat.length === 0 ? (
              <EmptyState title="ยังไม่มีข้อมูล" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCat} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={120}
                      tick={{ fontSize: 12, fill: "#4b5563" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #f1f1f1",
                        fontSize: 12,
                      }}
                      formatter={(v) => [`฿${v.toLocaleString()}`, "ยอดขาย"]}
                    />
                    <Bar dataKey="revenue" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SmallStat label="ต้นทุนวัตถุดิบ" value={`฿${(summary.summary.cost || 0).toLocaleString()}`} />
            <SmallStat label="เงินสด" value={`฿${(summary.summary.cash || 0).toLocaleString()}`} />
            <SmallStat label="QR PromptPay" value={`฿${(summary.summary.qr || 0).toLocaleString()}`} />
            <SmallStat label="บัตรเครดิต" value={`฿${(summary.summary.card || 0).toLocaleString()}`} />
          </div>
        </>
      )}
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-base font-bold text-gray-900">{value}</p>
    </div>
  );
}
