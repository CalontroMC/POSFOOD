import { Search, Mailbox, ChevronDown } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Reservations() {
  return (
    <div className="px-6 py-6">
      <PageHeader
        title="การจองโต๊ะ"
        subtitle="จัดการการจองล่วงหน้าของลูกค้า"
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-gray-500">รอยืนยัน</p>
          <p className="mt-2 text-2xl font-bold text-brand-orange">0</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">ยืนยันแล้ว</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">0</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">ทั้งหมดวันนี้</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">0</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input type="date" className="input sm:max-w-xs" />
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input className="input pl-10" placeholder="ค้นหาชื่อลูกค้า..." />
        </div>
        <div className="relative">
          <select className="input appearance-none pr-9">
            <option>ทุกสถานะ</option>
            <option>รอยืนยัน</option>
            <option>ยืนยันแล้ว</option>
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>
      </div>

      <div className="card">
        <EmptyState
          Icon={Mailbox}
          title="ไม่มีการจองในวันนี้"
          subtitle="การจองใหม่จะปรากฏที่นี่"
        />
      </div>
    </div>
  );
}
