import { useEffect, useState } from "react";
import { WifiOff, CloudUpload, CheckCircle2 } from "lucide-react";
import { isOnline, outboxSize } from "../lib/api.js";

export default function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());
  const [queued, setQueued] = useState(outboxSize());
  const [justSynced, setJustSynced] = useState(0);

  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    const onQ = () => setQueued(outboxSize());
    const onSynced = (e) => {
      setJustSynced(e.detail?.sent || 0);
      setQueued(outboxSize());
      setTimeout(() => setJustSynced(0), 4000);
    };
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    window.addEventListener("foodpos:outbox-changed", onQ);
    window.addEventListener("foodpos:outbox-synced", onSynced);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("foodpos:outbox-changed", onQ);
      window.removeEventListener("foodpos:outbox-synced", onSynced);
    };
  }, []);

  if (online && queued === 0 && !justSynced) return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs lg:px-6 ${
        !online
          ? "border-red-200 bg-red-50 text-red-800"
          : queued > 0
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {!online ? (
        <span className="flex items-center gap-1.5">
          <WifiOff size={14} /> ออฟไลน์ — ออเดอร์จะถูกบันทึกในเครื่องและซิงก์อัตโนมัติเมื่อกลับมาออนไลน์
        </span>
      ) : queued > 0 ? (
        <span className="flex items-center gap-1.5">
          <CloudUpload size={14} /> กำลังซิงก์ออเดอร์ที่ค้างอยู่ ({queued} รายการ)...
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={14} /> ซิงก์ออเดอร์ {justSynced} รายการสำเร็จ
        </span>
      )}
    </div>
  );
}
