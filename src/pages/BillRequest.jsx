import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Receipt,
  CheckCheck,
  X,
  RefreshCcw,
  PlayCircle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { apiGet, apiPatch, apiDelete } from "../lib/api.js";
import { printFinalReceipt, autoPrintEnabled } from "../lib/printJob.js";

const TABS = [
  { id: "open", label: "ที่ยังทำอยู่" },
  { id: "all", label: "ทั้งหมด" },
  { id: "รอ", label: "รอ" },
  { id: "รับเรื่อง", label: "กำลังทำ" },
  { id: "เสร็จสิ้น", label: "เสร็จสิ้น" },
  { id: "ยกเลิก", label: "ยกเลิก" },
];

const STATUS_STYLE = {
  รอ: { bg: "bg-red-100", text: "text-red-700", label: "● รอ" },
  รับเรื่อง: { bg: "bg-amber-100", text: "text-amber-700", label: "● กำลังทำ" },
  เสร็จสิ้น: { bg: "bg-emerald-100", text: "text-emerald-700", label: "✓ เสร็จสิ้น" },
  ยกเลิก: { bg: "bg-gray-100", text: "text-gray-500", label: "× ยกเลิก" },
};

function elapsed(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  return `${Math.floor(mins / 60)}ชม ${mins % 60}น ที่แล้ว`;
}

export default function BillRequest() {
  const [tab, setTab] = useState("open");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await apiGet(`/bill-requests?status=${tab}`);
      setItems(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [tab]);

  const counts = useMemo(() => {
    const c = { open: 0, รอ: 0, รับเรื่อง: 0 };
    for (const i of items) {
      if (i.status === "รอ" || i.status === "รับเรื่อง") c.open++;
      c[i.status] = (c[i.status] || 0) + 1;
    }
    return c;
  }, [items]);

  const setStatus = async (id, status) => {
    // When the bill is closed, also close the table's most-recent open order
    // and print the final receipt
    if (status === "เสร็จสิ้น") {
      try {
        const br = items.find((x) => x.id === id);
        if (br?.table_id) {
          const orders = await apiGet("/orders");
          const tableOrders = orders.filter(
            (o) => o.table_id === br.table_id &&
              !["เสร็จสิ้น", "ยกเลิก", "พักบิล"].includes(o.status)
          );
          for (const o of tableOrders) {
            await apiPatch(`/orders/${o.id}/status`, { status: "เสร็จสิ้น" });
          }
          // Print final receipt for the latest order
          if (tableOrders.length > 0) {
            try {
              const [order, settings] = await Promise.all([
                apiGet(`/orders/${tableOrders[0].id}`, { auth: false }),
                apiGet("/settings", { auth: false }),
              ]);
              if (autoPrintEnabled(settings)) {
                printFinalReceipt(order, order.items || [], { settings }).catch(() => {});
              }
            } catch {}
          }
        }
      } catch {}
    }
    await apiPatch(`/bill-requests/${id}/status`, { status });
    await load();
  };

  const del = async (id) => {
    if (!confirm("ลบรายการนี้?")) return;
    await apiDelete(`/bill-requests/${id}`);
    await load();
  };

  return (
    <div className="px-4 py-6 md:px-6">
      <PageHeader
        title="การเรียกเก็บเงิน"
        subtitle="รายการที่ลูกค้ากดเรียกเช็คบิลจากโต๊ะ"
        actions={
          <button onClick={load} className="btn-secondary">
            <RefreshCcw size={14} /> รีเฟรช
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          let count = null;
          if (t.id === "open") count = counts.open;
          else if (t.id !== "all") count = items.filter((i) => i.status === t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pill ${isActive ? "pill-active" : "pill-inactive"}`}
            >
              {t.id === "open" && <Bell size={12} />}
              {t.label}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[11px] ${
                    isActive ? "bg-white/20" : "bg-red-100 text-red-600"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState
            Icon={Bell}
            title="ยังไม่มีรายการ"
            subtitle="เมื่อลูกค้ากดเรียกเช็คบิลจากหน้าโต๊ะ จะปรากฏที่นี่"
            className="py-20"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => {
            const st = STATUS_STYLE[r.status] || STATUS_STYLE["รอ"];
            const isOpen = r.status === "รอ" || r.status === "รับเรื่อง";
            return (
              <div
                key={r.id}
                className={`card p-4 ${
                  r.status === "รอ" ? "border-l-4 border-l-red-500 ring-1 ring-red-100" : ""
                }`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-base font-bold text-gray-900">
                      <Receipt
                        size={16}
                        className={r.status === "รอ" ? "text-red-500" : "text-gray-400"}
                      />
                      โต๊ะ {r.table_number || "?"}
                    </p>
                    <p className="text-xs text-gray-400">
                      #{r.id} · {elapsed(r.created_at)}
                    </p>
                    {r.zone && <p className="text-xs text-gray-400">โซน: {r.zone}</p>}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.bg} ${st.text}`}
                  >
                    {st.label}
                  </span>
                </div>

                {r.note && (
                  <p className="mb-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600">
                    "{r.note}"
                  </p>
                )}

                {isOpen ? (
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {r.status === "รอ" && (
                      <button
                        onClick={() => setStatus(r.id, "รับเรื่อง")}
                        className="col-span-2 inline-flex items-center justify-center gap-1 rounded-lg bg-amber-500 px-2 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                      >
                        <PlayCircle size={12} /> รับเรื่อง
                      </button>
                    )}
                    <button
                      onClick={() => setStatus(r.id, "เสร็จสิ้น")}
                      className={`${
                        r.status === "รอ" ? "" : "col-span-2"
                      } inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600`}
                    >
                      <CheckCheck size={12} /> เสร็จ
                    </button>
                    <button
                      onClick={() => setStatus(r.id, "ยกเลิก")}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>{r.closed_at ? `ปิด ${elapsed(r.closed_at)}` : "ปิดแล้ว"}</span>
                    <button
                      onClick={() => del(r.id)}
                      className="rounded p-1 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
