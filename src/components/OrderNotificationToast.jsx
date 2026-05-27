import { useNavigate } from "react-router-dom";
import { Bell, X, Receipt } from "lucide-react";

export default function OrderNotificationToast({ toasts, onDismiss }) {
  const nav = useNavigate();
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-50 flex w-[300px] max-w-[calc(100vw-1.5rem)] flex-col gap-2 lg:right-4 lg:top-4 lg:w-80">
      {toasts.slice(-4).map((o) => {
        const isBill = o.type === "bill";
        const key = o.key || `${o.type || "order"}-${o.id}`;
        return (
          <div
            key={key}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl bg-white p-3 shadow-lg transition ${
              isBill ? "ring-2 ring-red-300" : "ring-1 ring-emerald-200"
            }`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isBill ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
              }`}
            >
              {isBill ? (
                <Receipt size={18} className="animate-pulse" />
              ) : (
                <Bell size={18} className="animate-bounce" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {isBill ? (
                <>
                  <p className="text-sm font-semibold text-red-700">
                    🔔 เรียกเช็คบิล
                  </p>
                  <p className="text-xs text-gray-700">
                    โต๊ะ <b>{o.table_number || "?"}</b> · ลูกค้ารอเช็คบิล
                  </p>
                  <button
                    onClick={() => {
                      onDismiss(o);
                      nav("/bill-history");
                    }}
                    className="mt-1 text-xs font-medium text-red-600 hover:underline"
                  >
                    ไปจัดการ →
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-900">
                    ออเดอร์ใหม่ · {o.order_number}
                    {o.label && (
                      <span className="ml-1.5 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] text-brand-orange">
                        {o.label}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {o.table_number ? `โต๊ะ ${o.table_number}` : "ซื้อกลับบ้าน"} · ฿
                    {(o.total || 0).toLocaleString()}
                  </p>
                  <button
                    onClick={() => {
                      onDismiss(o);
                      nav("/orders");
                    }}
                    className="mt-1 text-xs font-medium text-brand-orange hover:underline"
                  >
                    ดูรายละเอียด →
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => onDismiss(o)}
              className="text-gray-400 hover:text-gray-700"
              aria-label="dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
