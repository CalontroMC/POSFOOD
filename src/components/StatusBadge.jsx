const STYLES = {
  ว่าง: "bg-emerald-100 text-emerald-700",
  มีลูกค้า: "bg-orange-100 text-orange-700",
  จองแล้ว: "bg-purple-100 text-purple-700",
  รอรับ: "bg-yellow-100 text-yellow-700",
  กำลังทำ: "bg-blue-100 text-blue-700",
  เสิร์ฟแล้ว: "bg-indigo-100 text-indigo-700",
  เสร็จสิ้น: "bg-emerald-100 text-emerald-700",
  ยกเลิก: "bg-red-100 text-red-700",
  ใกล้หมด: "bg-red-100 text-red-700",
  พอเพียง: "bg-emerald-100 text-emerald-700",
};

export default function StatusBadge({ status }) {
  const cls = STYLES[status] || "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}
