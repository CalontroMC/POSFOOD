import { useState } from "react";
import { UtensilsCrossed, Server, CheckCircle2, AlertTriangle } from "lucide-react";

const KEY_SERVER = "foodpos_server_url";

export function getServerUrl() {
  try {
    return localStorage.getItem(KEY_SERVER) || "";
  } catch {
    return "";
  }
}

export function setServerUrl(url) {
  if (url) localStorage.setItem(KEY_SERVER, url);
  else localStorage.removeItem(KEY_SERVER);
}

export default function SetupServer({ onDone }) {
  const [url, setUrl] = useState(() => getServerUrl() || "http://192.168.1.100:3000");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const normaliseUrl = (v) => {
    let s = (v || "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "http://" + s;
    return s.replace(/\/+$/, "");
  };

  const test = async () => {
    setErr("");
    setOk(false);
    setBusy(true);
    try {
      const base = normaliseUrl(url);
      if (!base) throw new Error("กรุณากรอก URL");
      const res = await fetch(`${base}/api/health`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      if (!data?.ok) throw new Error("server ตอบกลับผิดรูปแบบ");
      setOk(true);
      setUrl(base);
    } catch (e) {
      setErr(
        `ติดต่อ server ไม่ได้: ${e.message}\nตรวจสอบว่า PC เปิด server อยู่ + อยู่ใน WiFi เดียวกัน`
      );
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const base = normaliseUrl(url);
    if (!base) return;
    setServerUrl(base);
    if (onDone) onDone(base);
    // Redirect WebView/browser to the actual server
    window.location.replace(base + "/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-soft">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange text-white shadow-soft">
            <UtensilsCrossed size={26} />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">FoodPOS</h1>
          <p className="mt-1 text-sm text-gray-500">ตั้งค่าครั้งแรก — กรอกที่อยู่ของ Server</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Server size={14} className="text-gray-400" />
              ที่อยู่ Server (URL)
            </label>
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setOk(false);
                setErr("");
              }}
              placeholder="http://192.168.1.100:3000"
              className="input font-mono text-sm"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              inputMode="url"
            />
            <p className="mt-1 text-xs text-gray-400">
              ดู IP ของ PC ที่ใช้ Run server (เช่น <span className="font-mono">192.168.1.100</span>)
            </p>
          </div>

          <button
            onClick={test}
            disabled={busy}
            className="btn-secondary w-full disabled:opacity-50"
          >
            {busy ? "กำลังทดสอบ..." : "ทดสอบเชื่อมต่อ"}
          </button>

          {ok && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
              <CheckCircle2 size={16} />
              เชื่อมต่อสำเร็จ — กด "บันทึก" เพื่อเริ่มใช้งาน
            </div>
          )}

          {err && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 whitespace-pre-line">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {err}
            </div>
          )}

          <button
            onClick={save}
            disabled={!ok || busy}
            className="btn-primary w-full disabled:opacity-50"
          >
            บันทึก + เข้าใช้งาน
          </button>

          <details className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <summary className="cursor-pointer font-medium">ดูวิธีหา IP ของ PC</summary>
            <div className="mt-2 space-y-1">
              <p><b>Windows:</b> เปิด Command Prompt พิมพ์ <span className="font-mono">ipconfig</span> ดู <i>IPv4 Address</i> ของ WiFi/Ethernet</p>
              <p><b>หรือ:</b> หน้า admin POS ตอนผมตั้งค่าให้ มี IP บอกใน README — เช่น <span className="font-mono">192.168.1.100</span></p>
              <p><b>Port:</b> default คือ <span className="font-mono">3000</span></p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
