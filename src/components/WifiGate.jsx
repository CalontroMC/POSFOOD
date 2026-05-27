import { useState } from "react";
import { Wifi, Copy, Check, Smartphone, ChevronRight } from "lucide-react";

/**
 * Full-screen "gate" overlay shown on top of the customer order page
 * until the customer acknowledges they've joined the shop Wi-Fi.
 *
 * The gate is a soft enforcement — the browser cannot actually detect
 * which Wi-Fi the device is on, so we trust the customer's tap. The
 * acknowledgement is persisted in localStorage so each device only sees
 * the gate once.
 */
export default function WifiGate({ wifi, onContinue }) {
  const [copied, setCopied] = useState(false);
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/.test(navigator.userAgent);

  const copyPwd = async () => {
    if (!wifi.password) return;
    try {
      await navigator.clipboard.writeText(wifi.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked in some embeds — silently ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
            <Wifi size={26} strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight text-gray-900">
              ต่อ Wi-Fi ฟรีของร้าน
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              ก่อนสั่งอาหาร กรุณาเชื่อมต่อ Wi-Fi
            </p>
          </div>
        </div>

        <div className="mb-3 flex justify-center">
          <img
            src="/api/wifi/qr.png"
            alt="Wi-Fi QR"
            className="h-56 w-56 rounded-lg border border-gray-200 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        <div className="mb-4 text-center text-xs text-gray-500">
          เปิดกล้องมือถือสแกน QR เพื่อต่อ Wi-Fi อัตโนมัติ
        </div>

        <div className="space-y-2">
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              ชื่อ Wi-Fi
            </div>
            <div className="mt-0.5 break-all font-mono text-base font-bold text-gray-900">
              {wifi.ssid}
            </div>
          </div>
          {wifi.password && (
            <button
              type="button"
              onClick={copyPwd}
              className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-3 text-left transition hover:bg-gray-100"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  รหัสผ่าน — กดเพื่อคัดลอก
                </div>
                <div className="mt-0.5 break-all font-mono text-base font-bold text-gray-900">
                  {wifi.password}
                </div>
              </div>
              <div className="ml-3 shrink-0">
                {copied ? (
                  <Check size={20} className="text-emerald-500" />
                ) : (
                  <Copy size={20} className="text-gray-400" />
                )}
              </div>
            </button>
          )}
        </div>

        {isIOS && (
          <a
            href="/api/wifi/profile.mobileconfig"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 transition active:bg-blue-100"
          >
            <Smartphone size={18} />
            <span>iPhone: ติดตั้งโปรไฟล์ Wi-Fi อัตโนมัติ</span>
          </a>
        )}

        <button
          type="button"
          onClick={onContinue}
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-brand-orange px-4 py-3 text-base font-bold text-white transition active:bg-brand-orange/90"
        >
          เชื่อมต่อเรียบร้อย — ดูเมนู
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
