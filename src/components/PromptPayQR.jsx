import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import generatePayload from "promptpay-qr";

export default function PromptPayQR({ promptpayId, amount, size = 200 }) {
  const qrCodeStr = useMemo(() => {
    if (!promptpayId) return "";
    return generatePayload(promptpayId, { amount });
  }, [promptpayId, amount]);

  if (!qrCodeStr) {
    return <div className="text-sm text-gray-500">ยังไม่ได้ตั้งค่าเบอร์พร้อมเพย์ในหน้าตั้งค่า</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
      <QRCodeSVG value={qrCodeStr} size={size} level="M" includeMargin={true} />
      <div className="mt-4 text-center">
        <p className="font-bold text-gray-800 text-lg">สแกนเพื่อจ่าย</p>
        <p className="text-gray-500 text-sm">พร้อมเพย์: {promptpayId}</p>
        {amount > 0 && (
          <p className="text-brand-orange font-bold text-xl mt-1">฿{amount.toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}
