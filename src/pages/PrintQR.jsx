import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { apiGet } from "../lib/api.js";

export default function PrintQR() {
  const nav = useNavigate();
  const [tables, setTables] = useState([]);
  const [storeName, setStoreName] = useState("FoodPOS");

  useEffect(() => {
    (async () => {
      const [t, s] = await Promise.all([
        apiGet("/tables", { auth: false }),
        apiGet("/settings", { auth: false }),
      ]);
      setTables(t);
      if (s?.store_name) setStoreName(s.store_name);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-3">
        <button onClick={() => nav("/tables")} className="btn-ghost">
          <ArrowLeft size={16} /> กลับ
        </button>
        <h1 className="text-base font-bold">พิมพ์ QR Code ทุกโต๊ะ</h1>
        <button onClick={() => window.print()} className="btn-primary">
          <Printer size={16} /> พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="mx-auto max-w-[210mm] p-6 print:p-0">
        <p className="print:hidden mb-3 text-sm text-gray-500">
          แสดง QR ของทั้งหมด {tables.length} โต๊ะ — กดพิมพ์ แล้วเลือก
          “Save as PDF” ที่ Destination เพื่อบันทึกเป็นไฟล์ PDF
        </p>

        <div className="grid grid-cols-2 gap-4 print:gap-2 sm:grid-cols-3">
          {tables.map((t) => (
            <div
              key={t.id}
              className="break-inside-avoid rounded-2xl border-2 border-gray-300 p-4 text-center print:border print:border-gray-400 print:p-3"
            >
              <p className="text-xs text-gray-500">{storeName}</p>
              <p className="my-1 text-3xl font-bold text-gray-900">{t.table_number}</p>
              <img
                src={`/api/tables/${t.id}/qr.png`}
                alt={`QR ${t.table_number}`}
                className="mx-auto h-40 w-40 object-contain"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                สแกนเพื่อสั่งอาหาร
              </p>
              <p className="text-[10px] text-gray-300">{t.zone}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
