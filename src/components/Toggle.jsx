export default function Toggle({ checked, onChange, label, size = "md" }) {
  const dim =
    size === "sm"
      ? { w: "w-9", h: "h-5", knob: "h-4 w-4", tx: "translate-x-4" }
      : { w: "w-11", h: "h-6", knob: "h-5 w-5", tx: "translate-x-5" };
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex shrink-0 ${dim.w} ${dim.h} rounded-full transition ${
          checked ? "bg-brand-orange" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 inline-block ${dim.knob} rounded-full bg-white shadow transition ${
            checked ? dim.tx : ""
          }`}
        />
      </button>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}
