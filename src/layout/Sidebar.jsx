import { NavLink } from "react-router-dom";
import {
  ShoppingCart,
  LayoutDashboard,
  Scissors,
  Grid3x3,
  User,
  CreditCard,
  Package,
  QrCode,
  Settings as SettingsIcon,
  ChevronLeft,
  ChefHat,
  UtensilsCrossed,
  Coins,
  LogOut,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import useShiftStatus from "../lib/useShiftStatus.js";

// Grouped nav — sub-features now live inside their parent page via SectionTabs:
//   /tables       includes  /bill-history (เรียกเช็คบิล)
//   /shift        includes  /employees + /timeclock
//   /members      includes  /points-manage
//   /settings     includes  /payment-qr  (QR ชำระเงิน)
// Removed: /reservations (feature dropped per owner request).
const NAV = [
  { to: "/", label: "สั่งอาหาร", Icon: ShoppingCart },
  { to: "/menu", label: "จัดการเมนู", Icon: Scissors },
  { to: "/reports", label: "รายงานยอดขาย", Icon: LayoutDashboard },
  { to: "/shift", label: "กะ / เงินสด", Icon: Coins },
  { to: "/tables", label: "จัดการโต๊ะ", Icon: Grid3x3 },
  { to: "/kds", label: "จอครัว (KDS)", Icon: ChefHat },
  { to: "/orders", label: "รายการออเดอร์", Icon: CreditCard },
  { to: "/stock", label: "สต็อกวัตถุดิบ", Icon: Package },
  { to: "/barcodes", label: "พิมพ์บาร์โค้ด", Icon: QrCode },
  { to: "/members", label: "สมาชิก", Icon: User },
  { to: "/settings", label: "ตั้งค่าร้าน", Icon: SettingsIcon, adminOnly: true },
];


export default function Sidebar({ collapsed, onToggle }) {
  const { shift } = useShiftStatus();
  const { role, logout } = useAuth();
  
  const visibleNav = NAV.filter(n => !n.adminOnly || role === "admin");

  return (
    <aside
      className={`relative flex h-screen shrink-0 flex-col bg-brand-dark text-gray-300 transition-all duration-200 ${
        collapsed ? "w-[72px]" : "w-[240px]"
      }`}
    >
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white shadow-soft">
          <UtensilsCrossed size={20} strokeWidth={2.4} />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-base font-bold tracking-wide text-white">
              FoodPOS
            </div>
            <div className="text-[11px] text-gray-400">
              ระบบจัดการร้านอาหาร
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="mx-3 mb-3">
          {shift && shift.status === "open" ? (
            <NavLink
              to="/shift"
              className="block rounded-xl bg-emerald-500/10 px-3 py-2 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/20"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                  กะเปิดอยู่
                </span>
              </div>
              <div className="mt-0.5 truncate text-xs text-white">
                {shift.opened_by_name}
              </div>
              <div className="mt-0.5 text-[11px] text-emerald-200/80">
                ขาย ฿{(shift.totals?.revenue || 0).toLocaleString()}
              </div>
            </NavLink>
          ) : (
            <NavLink
              to="/shift"
              className="block rounded-xl bg-white/5 px-3 py-2 transition hover:bg-white/10"
            >
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                ยังไม่ได้เปิดกะ
              </div>
              <div className="mt-0.5 text-xs text-gray-300">กดเพื่อเปิดกะ →</div>
            </NavLink>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {visibleNav.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? "bg-brand-orange text-white shadow-soft"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`
                }
                title={collapsed ? label : undefined}
              >
                <Icon size={18} strokeWidth={2} />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-white/5 p-3 space-y-2">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300"
          title="ออกจากระบบ"
        >
          <LogOut size={16} />
          {!collapsed && <span>ออกจากระบบ</span>}
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-gray-400 hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft
            size={16}
            className={`transition ${collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && <span>ย่อเมนู</span>}
        </button>
      </div>
    </aside>
  );
}
