import { useEffect, useState } from "react";
import { X, Plus, Trash2, Beaker } from "lucide-react";
import Toggle from "../components/Toggle.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import { apiGet, apiPost, apiPatch, apiPut, loyverseItems } from "../lib/api.js";

const emptyForm = {
  name: "",
  description: "",
  category_id: "",
  price: 0,
  cost: 0,
  points: 1,
  image_url: "",
  available: 1,
  kitchen: 1,
  loyverse_variant_id: "",
};

export default function MenuItemEditor({ itemId, cats, onClose, onSaved }) {
  const isEdit = !!itemId;
  const [form, setForm] = useState(emptyForm);
  const [groups, setGroups] = useState([]);
  const [recipe, setRecipe] = useState([]); // [{ ingredient_id, qty }]
  const [ingredients, setIngredients] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loyVariants, setLoyVariants] = useState([]); // [{ variant_id, item_name, sku, price }]
  const [loyNotConfigured, setLoyNotConfigured] = useState(false);
  const [loySearch, setLoySearch] = useState("");

  useEffect(() => {
    apiGet("/ingredients", { auth: false }).then(setIngredients);
  }, []);

  // Load all Loyverse variants (paginated) on mount; fail silently if not configured
  useEffect(() => {
    (async () => {
      try {
        const all = [];
        let cursor = null;
        do {
          const page = await loyverseItems(cursor);
          all.push(...(page.variants || []));
          cursor = page.cursor || null;
        } while (cursor);
        setLoyVariants(all);
      } catch {
        setLoyNotConfigured(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!itemId) {
      setForm(emptyForm);
      setGroups([]);
      setRecipe([]);
      return;
    }
    (async () => {
      const item = await apiGet(`/menu/items/${itemId}`, { auth: false });
      setForm({
        name: item.name || "",
        description: item.description || "",
        category_id: item.category_id || "",
        price: item.price ?? 0,
        cost: item.cost ?? 0,
        points: item.points ?? 0,
        image_url: item.image_url || "",
        available: item.available ? 1 : 0,
        kitchen: item.kitchen ? 1 : 0,
        loyverse_variant_id: item.loyverse_variant_id || "",
      });
      setGroups(
        (item.options || []).map((g) => ({
          name: g.name,
          required: !!g.required,
          max_select: g.max_select || 1,
          options: (g.options || []).map((o) => ({
            name: o.name,
            price_delta: o.price_delta || 0,
          })),
        }))
      );
      const rec = await apiGet(`/menu/items/${itemId}/recipe`, { auth: false });
      setRecipe(rec.map((r) => ({ ingredient_id: r.ingredient_id, qty: r.qty })));
    })();
  }, [itemId]);

  const set = (k) => (v) =>
    setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));

  const addGroup = () =>
    setGroups((g) => [
      ...g,
      { name: "", required: false, max_select: 1, options: [{ name: "", price_delta: 0 }] },
    ]);

  const removeGroup = (gi) =>
    setGroups((g) => g.filter((_, i) => i !== gi));

  const setGroup = (gi, patch) =>
    setGroups((g) =>
      g.map((x, i) => (i === gi ? { ...x, ...patch } : x))
    );

  const addOption = (gi) =>
    setGroups((g) =>
      g.map((x, i) =>
        i === gi
          ? { ...x, options: [...x.options, { name: "", price_delta: 0 }] }
          : x
      )
    );

  const setOption = (gi, oi, patch) =>
    setGroups((g) =>
      g.map((x, i) =>
        i === gi
          ? {
              ...x,
              options: x.options.map((o, j) =>
                j === oi ? { ...o, ...patch } : o
              ),
            }
          : x
      )
    );

  const removeOption = (gi, oi) =>
    setGroups((g) =>
      g.map((x, i) =>
        i === gi
          ? { ...x, options: x.options.filter((_, j) => j !== oi) }
          : x
      )
    );

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) return setErr("กรุณากรอกชื่อเมนู");
    if (form.price === "" || Number.isNaN(Number(form.price)))
      return setErr("ราคาไม่ถูกต้อง");
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category_id: form.category_id ? Number(form.category_id) : null,
        price: Number(form.price),
        cost: Number(form.cost) || 0,
        points: Number(form.points) || 0,
        image_url: form.image_url || null,
        available: form.available ? 1 : 0,
        kitchen: form.kitchen ? 1 : 0,
        loyverse_variant_id: form.loyverse_variant_id || null,
      };
      let id = itemId;
      if (isEdit) {
        await apiPatch(`/menu/items/${id}`, payload);
      } else {
        const out = await apiPost("/menu/items", payload);
        id = out.id;
      }
      const cleanGroups = groups
        .filter((g) => g.name.trim())
        .map((g) => ({
          name: g.name.trim(),
          required: !!g.required,
          max_select: Math.max(1, Number(g.max_select) || 1),
          options: g.options
            .filter((o) => o.name.trim())
            .map((o) => ({
              name: o.name.trim(),
              price_delta: Number(o.price_delta) || 0,
            })),
        }));
      await apiPut(`/menu/items/${id}/options`, { groups: cleanGroups });
      const cleanRecipe = recipe
        .filter((r) => r.ingredient_id && Number(r.qty) > 0)
        .map((r) => ({ ingredient_id: Number(r.ingredient_id), qty: Number(r.qty) }));
      await apiPut(`/menu/items/${id}/recipe`, { items: cleanRecipe });
      onSaved();
    } catch (e) {
      setErr(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">
            {isEdit ? "แก้ไขเมนู" : "เพิ่มเมนู"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-4">
            <Field label="ชื่อเมนู *">
              <input
                required
                value={form.name}
                onChange={set("name")}
                className="input"
                placeholder="เช่น ข้าวกะเพราหมูสับ"
              />
            </Field>

            <Field label="รูปเมนู">
              <ImageUpload
                value={form.image_url}
                onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              />
            </Field>

            <Field label="รายละเอียด">
              <textarea
                value={form.description}
                onChange={set("description")}
                className="input min-h-[70px] resize-y"
                placeholder="คำอธิบายสั้น ๆ"
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="ราคาขาย (บาท)">
                <input
                  type="number"
                  min={0}
                  required
                  value={form.price}
                  onChange={set("price")}
                  className="input"
                />
              </Field>
              <Field label="ต้นทุน (บาท)">
                <input
                  type="number"
                  min={0}
                  value={form.cost}
                  onChange={set("cost")}
                  className="input"
                />
              </Field>
              <Field label="แต้มต่อชิ้น (0=อัตรา tier)">
                <input
                  type="number"
                  min={0}
                  value={form.points}
                  onChange={set("points")}
                  className="input"
                />
              </Field>
            </div>

            <Field label="หมวดหมู่">
              <select
                value={form.category_id}
                onChange={set("category_id")}
                className="input"
              >
                <option value="">— ไม่ระบุ —</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex flex-wrap items-center gap-5">
              <Toggle
                checked={!!form.available}
                onChange={(v) => setForm((f) => ({ ...f, available: v ? 1 : 0 }))}
                label="พร้อมจำหน่าย"
              />
              <Toggle
                checked={!!form.kitchen}
                onChange={(v) => setForm((f) => ({ ...f, kitchen: v ? 1 : 0 }))}
                label="ขึ้นจอครัว (KDS)"
              />
            </div>

            <Field label="Loyverse variant (สินค้าใน Loyverse)">
              {loyNotConfigured ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  เชื่อมต่อ Loyverse ก่อนเพื่อแมปสินค้า
                </p>
              ) : (
                <div className="space-y-1.5">
                  {loyVariants.length > 0 && (
                    <input
                      type="text"
                      value={loySearch}
                      onChange={(e) => setLoySearch(e.target.value)}
                      placeholder="ค้นหาชื่อสินค้า / SKU…"
                      className="input text-sm"
                    />
                  )}
                  <select
                    value={form.loyverse_variant_id}
                    onChange={set("loyverse_variant_id")}
                    className="input"
                  >
                    <option value="">— ไม่แมป —</option>
                    {loyVariants
                      .filter((v) => {
                        if (!loySearch.trim()) return true;
                        const q = loySearch.toLowerCase();
                        return (
                          (v.item_name || "").toLowerCase().includes(q) ||
                          (v.sku || "").toLowerCase().includes(q)
                        );
                      })
                      .map((v) => (
                        <option key={v.variant_id} value={v.variant_id}>
                          {v.item_name}
                          {v.sku ? ` (${v.sku})` : ""} — ฿{v.price}
                        </option>
                      ))}
                  </select>
                  {!form.loyverse_variant_id && (
                    <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      ยังไม่แมป
                    </span>
                  )}
                </div>
              )}
            </Field>

            <div className="pt-2">
              <div className="mb-2 flex items-center gap-2">
                <Beaker size={14} className="text-brand-orange" />
                <h4 className="text-sm font-bold text-gray-900">
                  สูตร (ตัดสต็อกอัตโนมัติเมื่อปิดออเดอร์)
                </h4>
              </div>
              <p className="mb-2 text-xs text-gray-500">
                เลือกวัตถุดิบที่ใช้ + ปริมาณต่อ 1 หน่วยขาย — เมื่อเมนูนี้ขาย ระบบจะหักสต็อกอัตโนมัติ
              </p>
              {ingredients.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-3 text-center text-xs text-gray-400">
                  ยังไม่มีวัตถุดิบในระบบ — เพิ่มที่หน้า “สต็อกวัตถุดิบ” ก่อน
                </p>
              ) : (
                <div className="space-y-2">
                  {recipe.map((row, idx) => {
                    const ing = ingredients.find((i) => i.id === Number(row.ingredient_id));
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={row.ingredient_id || ""}
                          onChange={(e) =>
                            setRecipe((r) =>
                              r.map((x, i) =>
                                i === idx ? { ...x, ingredient_id: Number(e.target.value) || "" } : x
                              )
                            )
                          }
                          className="input flex-1"
                        >
                          <option value="">— เลือกวัตถุดิบ —</option>
                          {ingredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.unit})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={row.qty}
                          onChange={(e) =>
                            setRecipe((r) =>
                              r.map((x, i) =>
                                i === idx ? { ...x, qty: e.target.value } : x
                              )
                            )
                          }
                          placeholder="0"
                          className="input w-24 text-right"
                        />
                        <span className="w-12 shrink-0 text-xs text-gray-400">
                          {ing?.unit || ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRecipe((r) => r.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setRecipe((r) => [...r, { ingredient_id: "", qty: 0 }])}
                    className="btn-ghost text-xs"
                  >
                    <Plus size={14} /> เพิ่มวัตถุดิบในสูตร
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900">
                  ตัวเลือกเพิ่มเติม
                </h4>
                <button
                  type="button"
                  onClick={addGroup}
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  <Plus size={14} /> เพิ่มกลุ่มตัวเลือก
                </button>
              </div>

              {groups.length === 0 && (
                <p className="rounded-xl bg-gray-50 p-4 text-center text-xs text-gray-400">
                  ยังไม่มีกลุ่มตัวเลือก (เช่น ระดับความเผ็ด, ท็อปปิ้ง)
                </p>
              )}

              <div className="space-y-3">
                {groups.map((g, gi) => (
                  <div
                    key={gi}
                    className="rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        value={g.name}
                        onChange={(e) => setGroup(gi, { name: e.target.value })}
                        placeholder="ชื่อกลุ่ม เช่น ระดับความเผ็ด"
                        className="input flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeGroup(gi)}
                        className="text-red-400 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                      <Toggle
                        size="sm"
                        checked={g.required}
                        onChange={(v) => setGroup(gi, { required: v })}
                        label="จำเป็น"
                      />
                      <label className="flex items-center gap-2">
                        <span className="text-gray-500">เลือกได้สูงสุด</span>
                        <input
                          type="number"
                          min={1}
                          value={g.max_select}
                          onChange={(e) =>
                            setGroup(gi, {
                              max_select: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="input w-16 px-2 py-1 text-center"
                        />
                      </label>
                    </div>

                    <div className="space-y-2">
                      {g.options.map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            value={o.name}
                            onChange={(e) => setOption(gi, oi, { name: e.target.value })}
                            placeholder="ชื่อตัวเลือก"
                            className="input flex-1"
                          />
                          <div className="relative w-24">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                              ฿
                            </span>
                            <input
                              type="number"
                              value={o.price_delta}
                              onChange={(e) =>
                                setOption(gi, oi, { price_delta: e.target.value })
                              }
                              placeholder="0"
                              className="input pl-5 text-right"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeOption(gi, oi)}
                            className="text-red-400 hover:text-red-500"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(gi)}
                        className="btn-ghost text-xs"
                      >
                        <Plus size={14} /> เพิ่มตัวเลือก
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {err && <p className="mt-3 text-sm text-red-500">{err}</p>}

          <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              ยกเลิก
            </button>
            <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
              {busy ? "กำลังบันทึก..." : isEdit ? "อัปเดต" : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}
