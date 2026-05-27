import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { apiGet, getToken } from "../lib/api.js";

export default function ImageUpload({ value, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pasted, setPasted] = useState("");

  const upload = async (file) => {
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getToken();
      const res = await fetch("/api/uploads/image", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "อัปโหลดไม่สำเร็จ");
      onChange(data.url);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) upload(f);
  };

  return (
    <div>
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 text-gray-400 transition hover:border-brand-orange hover:bg-orange-50/30 hover:text-brand-orange"
      >
        {value ? (
          <>
            <img
              src={value}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow hover:text-red-500"
            >
              <X size={14} />
            </button>
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                <Loader2 size={20} className="animate-spin" />
              </div>
            )}
          </>
        ) : busy ? (
          <Loader2 size={24} className="animate-spin" />
        ) : (
          <>
            <Upload size={24} />
            <span className="text-xs">
              คลิกเพื่ออัปโหลด หรือ ลากรูปมาวาง (jpg/png/webp ≤ 5 MB)
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </div>
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
      <div className="mt-2 flex gap-2">
        <input
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="หรือวาง URL รูปภาพที่นี่..."
          className="input flex-1 text-xs"
        />
        <button
          type="button"
          onClick={() => {
            if (pasted) {
              onChange(pasted);
              setPasted("");
            }
          }}
          className="btn-secondary text-xs"
        >
          ใช้ URL
        </button>
      </div>
    </div>
  );
}
