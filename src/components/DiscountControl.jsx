import { Percent, BadgeDollarSign } from "lucide-react";

export default function DiscountControl({ subtotal, type, value, onChange, compact }) {
  const safeType = type || "percent";
  const safeValue = value === "" || value == null ? "" : Number(value);
  const discount = (() => {
    if (!safeValue || safeValue <= 0) return 0;
    if (safeType === "percent") return Math.round((subtotal * safeValue) / 100);
    return Math.min(subtotal, Math.round(safeValue));
  })();

  return (
    <div className={compact ? "space-y-2" : "space-y-2"}>
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-gray-200 text-xs">
          <button
            type="button"
            onClick={() => onChange({ type: "percent", value })}
            className={`flex items-center gap-1 px-2.5 py-1.5 ${
              safeType === "percent" ? "bg-brand-orange text-white" : "bg-white text-gray-600"
            }`}
          >
            <Percent size={12} /> %
          </button>
          <button
            type="button"
            onClick={() => onChange({ type: "fixed", value })}
            className={`flex items-center gap-1 px-2.5 py-1.5 ${
              safeType === "fixed" ? "bg-brand-orange text-white" : "bg-white text-gray-600"
            }`}
          >
            <BadgeDollarSign size={12} /> บาท
          </button>
        </div>
        <input
          type="number"
          min={0}
          step={safeType === "percent" ? "1" : "0.01"}
          max={safeType === "percent" ? 100 : subtotal}
          value={safeValue}
          onChange={(e) =>
            onChange({ type: safeType, value: e.target.value === "" ? "" : Number(e.target.value) })
          }
          placeholder="0"
          className="input w-24 text-right"
        />
        {discount > 0 && (
          <span className="text-xs text-red-500">= −฿{discount.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
