import { NavLink } from "react-router-dom";

/**
 * Horizontal tab nav that lives at the top of a page below PageHeader.
 * Used to group related pages (e.g. /tables + /bill-history) under one
 * "section" in the user's mental model, while keeping the routes
 * independent so deep-links keep working.
 *
 * Usage:
 *   <SectionTabs tabs={[
 *     { to: "/tables", label: "โต๊ะ" },
 *     { to: "/bill-history", label: "เรียกเช็คบิล" },
 *   ]} />
 */
export default function SectionTabs({ tabs }) {
  if (!tabs || tabs.length === 0) return null;
  return (
    <div className="-mt-2 mb-6 flex flex-wrap items-center gap-1 border-b border-gray-200">
      {tabs.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end ?? true}
          className={({ isActive }) =>
            `relative px-4 py-2.5 text-sm font-medium transition ${
              isActive
                ? "text-brand-orange"
                : "text-gray-500 hover:text-gray-800"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {label}
              {isActive && (
                <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded bg-brand-orange" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

// Pre-baked tab groups — single source of truth so every page in a group
// shows the same tabs.
export const SECTIONS = {
  tables: [
    { to: "/tables", label: "โต๊ะ" },
    { to: "/bill-history", label: "เรียกเช็คบิล" },
  ],
  shift: [
    { to: "/shift", label: "กะ / เงินสด" },
    { to: "/employees", label: "พนักงาน" },
    { to: "/timeclock", label: "ตอกบัตร" },
  ],
  members: [
    { to: "/members", label: "สมาชิก" },
    { to: "/points-manage", label: "จัดการแต้ม" },
  ],
  settings: [
    { to: "/settings", label: "ตั้งค่าร้าน" },
    { to: "/payment-qr", label: "QR ชำระเงิน" },
  ],
};
