import { useMemo, useState } from "react";
import { X, Minus, Plus, UtensilsCrossed } from "lucide-react";

export default function MenuOptionPicker({ item, onClose, onAdd, ctaLabel = "เพิ่ม" }) {
  const [selectedByGroup, setSelectedByGroup] = useState({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const toggle = (g, opt) => {
    setErr("");
    setSelectedByGroup((prev) => {
      const cur = prev[g.id] || [];
      const exists = cur.find((x) => x.id === opt.id);
      let next;
      if (exists) {
        next = cur.filter((x) => x.id !== opt.id);
      } else if (g.max_select === 1) {
        next = [opt];
      } else if (cur.length >= g.max_select) {
        return prev;
      } else {
        next = [...cur, opt];
      }
      return { ...prev, [g.id]: next };
    });
  };

  const flatSelected = useMemo(
    () => Object.values(selectedByGroup).flat(),
    [selectedByGroup]
  );
  const optionDelta = flatSelected.reduce((s, o) => s + (o.price_delta || 0), 0);
  const lineTotal = (item.price + optionDelta) * qty;

  const submit = () => {
    for (const g of item.options || []) {
      if (g.required && (selectedByGroup[g.id]?.length || 0) === 0) {
        setErr(`กรุณาเลือก "${g.name}"`);
        return;
      }
    }
    onAdd({
      item,
      qty,
      price: item.price,
      optionDelta,
      note: note.trim() || "",
      selected: flatSelected.map((o) => ({
        id: o.id,
        name: o.name,
        group: (item.options || []).find((g) =>
          g.options.some((x) => x.id === o.id)
        )?.name,
        price_delta: o.price_delta,
      })),
    });
  };

  const groups = item.options || [];

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                <UtensilsCrossed size={20} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900">{item.name}</h3>
            {item.description && (
              <p className="line-clamp-2 text-sm text-gray-500">
                {item.description}
              </p>
            )}
            <p className="mt-1 text-base font-bold text-brand-orange">
              ฿{item.price}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {groups.map((g) => {
            const sel = selectedByGroup[g.id] || [];
            return (
              <section key={g.id} className="mb-5">
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-sm font-bold text-gray-900">{g.name}</h4>
                  {g.required && (
                    <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      จำเป็น
                    </span>
                  )}
                  {g.max_select > 1 && (
                    <span className="ml-auto text-xs text-gray-400">
                      เลือกได้สูงสุด {g.max_select}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {g.options.map((o) => {
                    const selected = !!sel.find((x) => x.id === o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggle(g, o)}
                        className={`flex items-center justify-between rounded-2xl border-2 px-3 py-2.5 text-left text-sm transition ${
                          selected
                            ? "border-brand-orange bg-orange-50 text-gray-900"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <span className="truncate">{o.name}</span>
                        {o.price_delta !== 0 && (
                          <span className="ml-2 shrink-0 text-xs text-gray-500">
                            {o.price_delta > 0 ? "+" : ""}฿{o.price_delta}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="หมายเหตุ เช่น ไม่ใส่ผัก, เพิ่มเผ็ด..."
              className="input min-h-[64px] resize-y"
            />
          </div>

          {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 bg-white px-5 py-3">
          <div className="flex items-center gap-2 rounded-full border border-gray-200 px-2 py-1">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
            >
              <Minus size={14} />
            </button>
            <span className="w-5 text-center text-sm font-semibold">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
            >
              <Plus size={14} />
            </button>
          </div>
          <button onClick={submit} className="btn-primary flex-1 text-base">
            {ctaLabel} ฿{lineTotal}
          </button>
        </div>
      </div>
    </div>
  );
}
