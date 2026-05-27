import { Plus, QrCode } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function PaymentQR() {
  return (
    <div className="px-6 py-6">
      <PageHeader
        title="QR Code ชำระเงิน"
        subtitle="จัดการ QR Code สำหรับรับชำระเงิน"
        actions={
          <button className="btn-primary">
            <Plus size={16} />
            เพิ่ม QR Code
          </button>
        }
      />

      <div className="card">
        <EmptyState
          Icon={QrCode}
          title="ยังไม่มี QR Code"
          subtitle="กดปุ่ม 'เพิ่ม QR Code' เพื่อเริ่มต้น"
          className="py-20"
        />
      </div>
    </div>
  );
}
