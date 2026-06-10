import { useEffect, useState } from "react";
import { RefreshCw, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import SectionTabs, { SECTIONS } from "../components/SectionTabs.jsx";
import { apiGet, apiPatch, loyverseItems } from "../lib/api.js";

// ชื่อเทียบแบบหลวม: ตัดช่องว่างซ้ำ/หัวท้าย + lower case
function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export default function LoyverseMenuSync() {
  const [items, setItems] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [matching, setMatching] = useState(false);
  const [msg, setMsg] = useState("");

  // ไม่ setState แบบ sync ก่อน await ตัวแรก — เรียกได้ทั้งจาก effect และปุ่มโหลดใหม่
  async function loadAll() {
    try {
      const menuRows = await apiGet("/menu/items");
      setItems(Array.isArray(menuRows) ? menuRows : []);
    } catch {
      setItems([]);
    }
    try {
      const all = [];
      let cursor = null;
      do {
        const page = await loyverseItems(cursor);
        all.push(...(page.variants || []));
        cursor = page.cursor || null;
      } while (cursor);
      setVariants(all);
      setNotConfigured(false);
    } catch {
      setNotConfigured(true);
      setVariants([]);
    }
    setLoading(false);
  }

  function reload() {
    setLoading(true);
    loadAll();
  }

  useEffect(() => {
    // โหลดข้อมูลครั้งแรกตอนเปิดหน้า (fetch-on-mount; setState เกิดหลัง await)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  function flash(text) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3500);
  }

  async function saveMapping(menuItem, variantId) {
    setSavingId(menuItem.id);
    try {
      await apiPatch(`/menu/items/${menuItem.id}`, {
        loyverse_variant_id: variantId || null,
      });
      setItems((rows) =>
        rows.map((r) =>
          r.id === menuItem.id ? { ...r, loyverse_variant_id: variantId || null } : r
        )
      );
    } catch (e) {
      flash(`บันทึกไม่สำเร็จ: ${e.message || "ผิดพลาด"}`);
    } finally {
      setSavingId(null);
    }
  }

  // จับคู่อัตโนมัติด้วยชื่อ: เมนูที่ยังไม่แมป + ชื่อตรงกับ variant เพียงตัวเดียว
  async function autoMatch() {
    setMatching(true);
    const byName = new Map();
    for (const v of variants) {
      const key = norm(v.item_name);
      if (!key) continue;
      byName.set(key, byName.has(key) ? null : v); // ชื่อซ้ำหลายตัว → null = ข้าม
    }
    const applied = new Map(); // menu id -> variant_id ที่จับคู่สำเร็จ
    for (const it of items) {
      if (it.loyverse_variant_id) continue;
      const v = byName.get(norm(it.name));
      if (!v) continue;
      try {
        await apiPatch(`/menu/items/${it.id}`, { loyverse_variant_id: v.variant_id });
        applied.set(it.id, v.variant_id);
      } catch {
        /* ข้ามรายการที่บันทึกไม่ผ่าน */
      }
    }
    if (applied.size > 0) {
      setItems((rows) =>
        rows.map((r) =>
          applied.has(r.id) ? { ...r, loyverse_variant_id: applied.get(r.id) } : r
        )
      );
    }
    setMatching(false);
    flash(
      applied.size > 0
        ? `จับคู่อัตโนมัติสำเร็จ ${applied.size} รายการ`
        : "ไม่พบเมนูที่ชื่อตรงกับสินค้าใน Loyverse เพิ่มเติม"
    );
  }

  const mappedCount = items.filter((i) => i.loyverse_variant_id).length;
  const q = norm(search);
  const visible = items.filter((i) => {
    if (onlyUnmapped && i.loyverse_variant_id) return false;
    if (q && !norm(i.name).includes(q)) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Sync เมนูกับ Loyverse"
        subtitle="จับคู่เมนูในร้านกับสินค้า (variant) ใน Loyverse เพื่อให้ยอดขายและสต็อก sync ได้"
        actions={
          <>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="btn-secondary disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              โหลดใหม่
            </button>
            <button
              type="button"
              onClick={autoMatch}
              disabled={matching || loading || notConfigured || variants.length === 0}
              className="btn-primary disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              {matching ? "กำลังจับคู่..." : "จับคู่อัตโนมัติ (ชื่อตรงกัน)"}
            </button>
          </>
        }
      />
      <SectionTabs tabs={SECTIONS.settings} />

      {notConfigured && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={16} />
          ยังเชื่อมต่อ Loyverse ไม่ได้ — ไปที่แท็บ "ตั้งค่าร้าน" เพื่อใส่ token และกดทดสอบการเชื่อมต่อก่อน
        </div>
      )}

      {msg && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-sm">
          {msg}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเมนู..."
            className="input pl-8"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={onlyUnmapped}
            onChange={(e) => setOnlyUnmapped(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          แสดงเฉพาะที่ยังไม่แมป
        </label>
        <span className="ml-auto text-sm text-gray-500">
          แมปแล้ว <b className="text-gray-900">{mappedCount}</b> / {items.length} เมนู
        </span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">กำลังโหลด...</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {onlyUnmapped ? "ทุกเมนูแมปครบแล้ว 🎉" : "ไม่พบเมนู"}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((it) => (
              <li key={it.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-gray-900">{it.name}</span>
                    {!it.loyverse_variant_id && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        ยังไม่แมป
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {it.category_name || "ไม่มีหมวด"} · ฿{it.price}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:w-80">
                  <select
                    value={it.loyverse_variant_id || ""}
                    onChange={(e) => saveMapping(it, e.target.value)}
                    disabled={notConfigured || savingId === it.id}
                    className="input w-full disabled:opacity-50"
                  >
                    <option value="">— ไม่แมป —</option>
                    {variants.map((v) => (
                      <option key={v.variant_id} value={v.variant_id}>
                        {v.item_name}
                        {v.sku ? ` (${v.sku})` : ""} — ฿{v.price}
                      </option>
                    ))}
                  </select>
                  {savingId === it.id && (
                    <RefreshCw size={14} className="shrink-0 animate-spin text-gray-400" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
