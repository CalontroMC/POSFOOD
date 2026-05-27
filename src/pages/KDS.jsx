import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChefHat, ArrowLeft, RefreshCcw } from "lucide-react";
import { apiGet, apiPatch } from "../lib/api.js";

const COL_STATUSES = [
  { id: "รอรับ", label: "รอรับ", color: "bg-yellow-50 border-yellow-200" },
  { id: "กำลังทำ", label: "กำลังทำ", color: "bg-orange-50 border-orange-200" },
  { id: "เสิร์ฟแล้ว", label: "พร้อมเสิร์ฟ", color: "bg-emerald-50 border-emerald-200" },
];

export default function KDS() {
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);
  const [foodItemIds, setFoodItemIds] = useState(new Set()); // menu_items in kitchen categories

  const load = async () => {
    const [items, ords] = await Promise.all([
      apiGet("/menu/items", { auth: false }),
      apiGet("/orders"),
    ]);
    // Per-item flag: only items with kitchen=1 show on KDS
    const foodIds = new Set(items.filter((it) => it.kitchen).map((it) => it.id));
    setFoodItemIds(foodIds);
    setOrders(ords.filter((o) => COL_STATUSES.map((s) => s.id).includes(o.status)));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const advance = async (id, next) => {
    await apiPatch(`/orders/${id}/status`, { status: next });
    await load();
  };

  const buckets = useMemo(() => {
    const b = { รอรับ: [], กำลังทำ: [], เสิร์ฟแล้ว: [] };
    for (const o of orders) b[o.status]?.push(o);
    return b;
  }, [orders]);

  return (
    <div className="flex h-screen flex-col bg-brand-dark text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav("/")}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            <ArrowLeft size={14} /> กลับหน้าหลัก
          </button>
          <div className="ml-2 flex items-center gap-2">
            <ChefHat size={20} className="text-brand-orange" />
            <h1 className="text-base font-bold">Kitchen Display · ครัว</h1>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="hidden sm:inline">
            {orders.length} ออเดอร์ในคิว · อัปเดตทุก 5 วินาที
          </span>
          <button
            onClick={load}
            className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 hover:bg-white/20"
          >
            <RefreshCcw size={12} /> รีเฟรช
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-4 md:grid-cols-3">
        {COL_STATUSES.map((col) => (
          <Column
            key={col.id}
            col={col}
            list={buckets[col.id] || []}
            foodItemIds={foodItemIds}
            onAdvance={advance}
          />
        ))}
      </div>
    </div>
  );
}

function Column({ col, list, foodItemIds, onAdvance }) {
  const next = {
    รอรับ: "กำลังทำ",
    กำลังทำ: "เสิร์ฟแล้ว",
    เสิร์ฟแล้ว: "เสร็จสิ้น",
  }[col.id];
  const nextLabel = {
    กำลังทำ: "เริ่มทำ",
    เสิร์ฟแล้ว: "พร้อมเสิร์ฟ",
    เสร็จสิ้น: "เสิร์ฟแล้ว",
  }[next];

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white/5">
      <div className={`flex items-center justify-between px-4 py-3 ${col.color} text-gray-900`}>
        <h2 className="text-base font-bold">{col.label}</h2>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">
          {list.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {list.length === 0 && (
          <p className="py-8 text-center text-xs text-gray-500">ไม่มีออเดอร์</p>
        )}
        {list.map((o) => (
          <Card
            key={o.id}
            order={o}
            foodItemIds={foodItemIds}
            nextLabel={nextLabel}
            onClick={() => onAdvance(o.id, next)}
          />
        ))}
      </div>
    </div>
  );
}

function Card({ order, foodItemIds, nextLabel, onClick }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    apiGet(`/orders/${order.id}`, { auth: false }).then(setDetail);
  }, [order.id]);
  const since = (() => {
    if (!order.created_at) return "";
    const ms = Date.now() - new Date(order.created_at.replace(" ", "T") + "Z").getTime();
    const mins = Math.max(0, Math.floor(ms / 60000));
    return mins < 60 ? `${mins} นาที` : `${Math.floor(mins / 60)}ชม ${mins % 60}น`;
  })();

  const foodItems = (detail?.items || []).filter(
    (it) => it.menu_item_id && foodItemIds.has(it.menu_item_id)
  );

  // Skip cards that have nothing for the kitchen
  if (detail && foodItems.length === 0) return null;

  return (
    <div className="rounded-xl bg-white p-3 text-gray-900 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-base font-bold">
            {order.order_number}
            {order.label && (
              <span className="ml-1.5 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-brand-orange">
                {order.label}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            {order.table_number ? `โต๊ะ ${order.table_number}` : "ซื้อกลับบ้าน"} · {since}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
          {foodItems.length} เมนู
        </span>
      </div>
      {detail ? (
        <ul className="mb-2 space-y-1 text-sm">
          {foodItems.map((it) => (
            <li key={it.id}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{it.name}</span>
                <span className="text-gray-500">×{it.qty}</span>
              </div>
              {it.options?.length > 0 && (
                <p className="text-xs text-gray-500">
                  • {it.options.map((o) => o.name).join(", ")}
                </p>
              )}
              {it.note && <p className="text-xs italic text-amber-700">“{it.note}”</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-gray-400">โหลด...</p>
      )}
      <button
        onClick={onClick}
        className="w-full rounded-lg bg-brand-orange py-1.5 text-xs font-semibold text-white hover:brightness-95"
      >
        {nextLabel} →
      </button>
    </div>
  );
}
