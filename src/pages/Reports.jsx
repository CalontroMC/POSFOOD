import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  Receipt,
  TrendingUp,
  PiggyBank,
  Calendar,
  Clock,
  ChefHat,
  Star,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import DataChatPanel from "../components/DataChatPanel.jsx";
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
  const [dashboardStats, setDashboardStats] = useState(null);
  const [forecastData, setForecastData] = useState([]);

  useEffect(() => {
    (async () => {
      const [s, i, c, d, f] = await Promise.all([
        apiGet(`/reports/summary?period=${period}`),
        apiGet(`/reports/by-item?period=${period}`),
        apiGet(`/reports/by-category?period=${period}`),
        apiGet(`/orders/stats/dashboard`),
        apiGet(`/reports/forecast`),
      ]);
      setSummary(s);
      setByItem(i);
      setByCat(c);
      setDashboardStats(d);

      const mergedForecast = [
        ...f.historical.map((h) => ({ date: h.date, historical: h.revenue })),
        ...f.forecast.map((fc) => ({ date: fc.date, predicted: fc.revenue }))
      ];
      setForecastData(mergedForecast);
    })();
  }, [period]);

  const top5 = useMemo(() => byItem.slice(0, 5), [byItem]);
  const bottom5 = useMemo(() => [...byItem].reverse().slice(0, 5), [byItem]);
  const topProfit = useMemo(() => [...byItem].sort((a, b) => (b.margin || 0) - (a.margin || 0)).slice(0, 5), [byItem]);

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

          {dashboardStats && dashboardStats.stats && period === "today" && (
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="เวลาทำอาหารเฉลี่ย"
                value={`${dashboardStats.stats.avg_prep_time_mins || 0} นาที`}
                Icon={ChefHat}
                iconBg="bg-amber-100"
                iconColor="text-amber-600"
              />
              <StatCard
                label="เวลาเสิร์ฟเฉลี่ย (Ticket)"
                value={`${dashboardStats.stats.avg_ticket_time_mins || 0} นาที`}
                Icon={Clock}
                iconBg="bg-indigo-100"
                iconColor="text-indigo-600"
              />
            </div>
          )}

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
            <div className="card p-5 border-t-4 border-t-indigo-500">
              <h3 className="mb-4 text-base font-bold text-gray-900">
                📈 คาดการณ์ยอดขาย (7 วันล่วงหน้า)
              </h3>
              {forecastData.length === 0 ? (
                <EmptyState title="ข้อมูลไม่เพียงพอในการคาดการณ์" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        tickFormatter={(v) => String(v).slice(5)}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #f1f1f1", fontSize: 12 }}
                        formatter={(v, name) => [`฿${v}`, name === "historical" ? "ยอดขายจริง" : "คาดการณ์"]}
                      />
                      <Line type="monotone" dataKey="historical" stroke="#F97316" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="predicted" stroke="#6366f1" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div>
              <DataChatPanel />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card p-5 border-t-4 border-t-brand-orange">
              <h3 className="mb-3 text-base font-bold text-gray-900">
                🏆 เมนูยอดฮิต (Top 5)
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
                          ขาย {m.qty} จาน · ฿{m.revenue?.toLocaleString() || 0}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5 border-t-4 border-t-emerald-500">
              <h3 className="mb-3 text-base font-bold text-gray-900 flex items-center gap-1.5">
                <PiggyBank size={18} className="text-emerald-500" /> ทำกำไรสูงสุด
              </h3>
              {topProfit.length === 0 ? (
                <EmptyState title="ยังไม่มีข้อมูล" />
              ) : (
                <ul className="space-y-2.5">
                  {topProfit.map((m, i) => (
                    <li key={m.name} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{m.name}</p>
                        <p className="text-xs text-gray-500">
                          กำไร: <span className="font-bold text-emerald-600">฿{(m.margin || 0).toLocaleString()}</span>
                          {" "}<span className="text-[10px] text-gray-400">(ต้นทุน ฿{(m.cost || 0).toLocaleString()})</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5 border-t-4 border-t-gray-300">
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

          {dashboardStats && dashboardStats.byMargin && period === "today" && (
            <div className="mt-5 card p-5">
              <h3 className="mb-3 text-base font-bold text-gray-900">
                💎 เมนูกำไรสูงสุด (Margin - วันนี้)
              </h3>
              {dashboardStats.byMargin.length === 0 ? (
                <EmptyState title="ยังไม่มีข้อมูล" />
              ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {dashboardStats.byMargin.map((m, i) => (
                    <li key={m.name} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 shadow-sm">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-600">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{m.name}</p>
                        <p className="text-xs font-medium text-emerald-600">
                          กำไรสุทธิ ฿{m.margin.toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
