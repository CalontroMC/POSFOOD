import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Play, Menu, UtensilsCrossed, Bell, BellOff } from "lucide-react";
import Sidebar from "./Sidebar.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";
import OrderNotificationToast from "../components/OrderNotificationToast.jsx";
import useShiftStatus from "../lib/useShiftStatus.js";
import useOrderNotifications from "../lib/useOrderNotifications.js";

const SHIFT_EXEMPT_PATHS = new Set([
  "/shift",
  "/settings",
  "/employees",
]);

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { shift, loading, isOpen } = useShiftStatus();
  const { enabled: notifEnabled, setEnabled: setNotifEnabled, toasts, dismissKey } =
    useOrderNotifications({ pollMs: 5000 });
  const dismissToast = (o) => dismissKey(o.key || `${o.type || "order"}-${o.id}`);
  const location = useLocation();
  const nav = useNavigate();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const onExemptPage = SHIFT_EXEMPT_PATHS.has(location.pathname);
  const showBanner = !loading && !isOpen && !onExemptPage;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-brand-cream">
      {/* Sidebar — drawer on mobile, fixed on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar with hamburger */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 text-gray-700 hover:bg-gray-100"
            aria-label="เปิดเมนู"
          >
            <Menu size={20} />
          </button>
          <div className="flex flex-1 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange text-white">
              <UtensilsCrossed size={16} />
            </div>
            <span className="text-sm font-bold text-gray-900">FoodPOS</span>
          </div>
          <NotifToggle enabled={notifEnabled} onToggle={() => setNotifEnabled(!notifEnabled)} />
        </div>

        {/* Desktop topbar (just for the notif toggle on the right) */}
        <div className="hidden items-center justify-end border-b border-gray-100 bg-white px-6 py-1.5 lg:flex">
          <NotifToggle enabled={notifEnabled} onToggle={() => setNotifEnabled(!notifEnabled)} />
        </div>

        <OfflineBanner />
        {showBanner && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm lg:px-6">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                <span className="font-semibold">ยังไม่ได้เปิดกะ</span> — รับออเดอร์ยังทำไม่ได้
              </span>
            </div>
            <button
              onClick={() => nav("/shift")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
            >
              <Play size={12} /> ไปเปิดกะ
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <Outlet context={{ shift, shiftLoading: loading, shiftIsOpen: isOpen }} />
        </div>
      </main>

      <OrderNotificationToast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function NotifToggle({ enabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={enabled ? "ปิดแจ้งเตือนออเดอร์" : "เปิดแจ้งเตือนออเดอร์"}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
        enabled
          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {enabled ? <Bell size={14} /> : <BellOff size={14} />}
      <span className="hidden sm:inline">
        {enabled ? "แจ้งเตือนเปิดอยู่" : "แจ้งเตือนปิด"}
      </span>
    </button>
  );
}
