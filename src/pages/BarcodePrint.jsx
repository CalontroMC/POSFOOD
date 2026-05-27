import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer, Plus, X } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { apiGet } from "../lib/api.js";

const FORMATS = ["CODE128", "CODE39", "EAN13"];

export default function BarcodePrint() {
  const [labels, setLabels] = useState([]); // { code, name, count }
  const [bulkSource, setBulkSource] = useState("items"); // items | ingredients | members
  const [format, setFormat] = useState("CODE128");
  const [showAddBulk, setShowAddBulk] = useState(false);

  const addOne = (code = "", name = "", count = 1) =>
    setLabels((l) => [...l, { code, name, count }]);

  const loadBulk = async () => {
    const url =
      bulkSource === "items"
        ? "/menu/items"
        : bulkSource === "ingredients"
          ? "/ingredients"
          : "/members";
    const items = await apiGet(url, { auth: false });
    const next = items.map((it) => {
      const prefix =
        bulkSource === "items" ? "M" : bulkSource === "ingredients" ? "I" : "C";
      return {
        code: `${prefix}${String(it.id).padStart(5, "0")}`,
        name: it.name,
        count: 1,
      };
    });
    setLabels(next);
    setShowAddBulk(false);
  };

  return (
    <div className="px-4 py-6 md:px-6">
      <PageHeader
        title="พิมพ์ฉลากบาร์โค้ด"
        subtitle="สร้างและพิมพ์ฉลากสำหรับติดสินค้า / วัตถุดิบ / บัตรสมาชิก"
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="input"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button onClick={() => setShowAddBulk(true)} className="btn-secondary">
              <Plus size={16} /> โหลดจากระบบ
            </button>
            <button onClick={() => addOne("SKU-0001", "ตัวอย่าง")} className="btn-secondary">
              <Plus size={16} /> เพิ่มฉลาก
            </button>
            <button
              onClick={() => window.print()}
              disabled={labels.length === 0}
              className="btn-primary disabled:opacity-50"
            >
              <Printer size={16} /> พิมพ์
            </button>
          </div>
        }
      />

      {labels.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-400 print:hidden">
          กดปุ่ม "เพิ่มฉลาก" หรือ "โหลดจากระบบ" เพื่อเริ่มต้น
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 print:hidden md:grid-cols-3 lg:grid-cols-4">
          {labels.map((l, idx) => (
            <div key={idx} className="card p-3">
              <div className="mb-2 flex items-start justify-between">
                <label className="text-xs text-gray-500">ฉลาก #{idx + 1}</label>
                <button
                  onClick={() => setLabels((ls) => ls.filter((_, i) => i !== idx))}
                  className="text-red-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
              <input
                value={l.name}
                onChange={(e) =>
                  setLabels((ls) =>
                    ls.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                  )
                }
                placeholder="ชื่อสินค้า"
                className="input mb-1 text-xs"
              />
              <input
                value={l.code}
                onChange={(e) =>
                  setLabels((ls) =>
                    ls.map((x, i) => (i === idx ? { ...x, code: e.target.value } : x))
                  )
                }
                placeholder="รหัส / SKU"
                className="input mb-1 text-xs font-mono"
              />
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500">จำนวน:</span>
                <input
                  type="number"
                  min={1}
                  value={l.count}
                  onChange={(e) =>
                    setLabels((ls) =>
                      ls.map((x, i) =>
                        i === idx ? { ...x, count: Math.max(1, Number(e.target.value) || 1) } : x
                      )
                    )
                  }
                  className="input w-16 text-center text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Printable area */}
      <div className="grid grid-cols-3 gap-2 print:grid-cols-3 print:gap-1 md:grid-cols-4 lg:grid-cols-5">
        {labels.flatMap((l, idx) =>
          Array.from({ length: l.count || 1 }, (_, k) => (
            <Label
              key={`${idx}-${k}`}
              code={l.code}
              name={l.name}
              format={format}
            />
          ))
        )}
      </div>

      {showAddBulk && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-base font-bold text-gray-900">โหลดข้อมูล</h3>
            <select
              value={bulkSource}
              onChange={(e) => setBulkSource(e.target.value)}
              className="input mb-3"
            >
              <option value="items">เมนู (M-รหัส)</option>
              <option value="ingredients">วัตถุดิบ (I-รหัส)</option>
              <option value="members">สมาชิก (C-รหัส)</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddBulk(false)} className="btn-secondary">
                ยกเลิก
              </button>
              <button onClick={loadBulk} className="btn-primary">
                โหลด
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function Label({ code, name, format }) {
  const ref = useRef(null);
  const safe = useMemo(() => (code || "").toString(), [code]);
  useEffect(() => {
    if (!ref.current || !safe) return;
    try {
      JsBarcode(ref.current, safe, {
        format,
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 12,
        margin: 2,
      });
    } catch (e) {
      ref.current.innerHTML = "";
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", "0");
      t.setAttribute("y", "20");
      t.setAttribute("fill", "red");
      t.setAttribute("font-size", "10");
      t.textContent = "Invalid code";
      ref.current.appendChild(t);
    }
  }, [safe, format]);
  return (
    <div className="break-inside-avoid rounded-xl border border-gray-200 p-2 text-center print:border-gray-400">
      {name && <p className="mb-1 line-clamp-1 text-xs font-medium text-gray-900">{name}</p>}
      <svg ref={ref} className="mx-auto h-12 w-full" />
    </div>
  );
}
