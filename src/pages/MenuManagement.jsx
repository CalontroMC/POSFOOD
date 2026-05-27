import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, X, Tag, ChefHat } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Toggle from "../components/Toggle.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import MenuItemEditor from "./MenuItemEditor.jsx";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api.js";

export default function MenuManagement() {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [cat, setCat] = useState(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // {id?, ...} | null
  const [showCats, setShowCats] = useState(false);

  const load = async () => {
    const [c, it] = await Promise.all([
      apiGet("/menu/categories", { auth: false }),
      apiGet("/menu/items", { auth: false }),
    ]);
    setCats(c);
    setItems(it);
  };
  useEffect(() => {
    load();
  }, []);

  const list = useMemo(
    () =>
      items.filter(
        (m) =>
          (!cat || m.category_id === cat) &&
          (!q || m.name.toLowerCase().includes(q.toLowerCase()))
      ),
    [items, cat, q]
  );

  const del = async (id) => {
    if (!confirm("ลบเมนูนี้?")) return;
    await apiDelete(`/menu/items/${id}`);
    await load();
  };

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="จัดการเมนู"
        subtitle="จัดการรายการอาหารและเครื่องดื่มในร้าน"
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowCats(true)} className="btn-secondary">
              <Tag size={16} /> หมวดหมู่
            </button>
            <button onClick={() => setEditing({ id: null })} className="btn-primary">
              <Plus size={16} /> เพิ่มเมนู
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเมนู..."
            className="input pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCat(null)}
            className={`pill ${!cat ? "pill-active" : "pill-inactive"}`}
          >
            ทั้งหมด
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`pill ${cat === c.id ? "pill-active" : "pill-inactive"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {list.map((item) => (
          <div key={item.id} className="card overflow-hidden">
            <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
            <div className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400">{item.category_name || "-"}</p>
                </div>
                <p className="text-sm font-bold text-brand-orange">
                  ฿{item.price}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-400">+{item.points} แต้ม</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditing({ id: item.id })}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => del(item.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <MenuItemEditor
          itemId={editing.id}
          cats={cats}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {showCats && (
        <CategoryManager
          cats={cats}
          onClose={() => setShowCats(false)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function CategoryManager({ cats, onClose, onChanged }) {
  const [items, setItems] = useState(cats);
  const [newName, setNewName] = useState("");

  const refresh = async () => {
    const c = await apiGet("/menu/categories", { auth: false });
    setItems(c);
    await onChanged();
  };

  const add = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await apiPost("/menu/categories", { name: newName.trim(), sort_order: items.length, kitchen: 1 });
    setNewName("");
    await refresh();
  };

  const rename = async (id, name) => {
    await apiPatch(`/menu/categories/${id}`, { name });
    await refresh();
  };

  const toggleKitchen = async (id, kitchen) => {
    // Bulk-set: also flips kitchen flag on every menu item in this category
    await apiPatch(`/menu/categories/${id}/kitchen`, { kitchen });
    await refresh();
  };

  const del = async (id) => {
    if (!confirm("ลบหมวดหมู่นี้? (เมนูที่ผูกอยู่จะกลายเป็น 'ไม่ระบุ')")) return;
    await apiDelete(`/menu/categories/${id}`);
    await refresh();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">จัดการหมวดหมู่เมนู</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <ChefHat size={12} className="mr-1 inline-block" />
            กดไอคอนหมวกเชฟเพื่อตั้งทั้งหมวด (จะ apply กับทุกเมนูในหมวดนี้)
            <br />
            หรือกดเข้าไปแก้ไขแต่ละเมนูเพื่อปรับเฉพาะรายการได้
          </p>
          <ul className="mb-4 space-y-2">
            {items.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2"
              >
                <Tag size={14} className="text-brand-orange" />
                <input
                  defaultValue={c.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== c.name)
                      rename(c.id, e.target.value.trim());
                  }}
                  className="flex-1 bg-transparent text-sm font-medium outline-none focus:bg-orange-50 focus:px-1 focus:rounded"
                />
                <button
                  onClick={() => toggleKitchen(c.id, !c.kitchen)}
                  className={`rounded-lg p-1.5 ${
                    c.kitchen
                      ? "bg-orange-50 text-brand-orange"
                      : "text-gray-300 hover:text-gray-500"
                  }`}
                  title={c.kitchen ? "ขึ้นจอครัว — กดเพื่อปิด" : "ไม่ขึ้นจอครัว — กดเพื่อเปิด"}
                >
                  <ChefHat size={14} />
                </button>
                <button
                  onClick={() => del(c.id)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="rounded-xl bg-gray-50 p-3 text-center text-xs text-gray-400">
                ยังไม่มีหมวดหมู่
              </li>
            )}
          </ul>
          <form onSubmit={add} className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อหมวดหมู่ใหม่"
              className="input flex-1"
            />
            <button type="submit" className="btn-primary">
              <Plus size={14} /> เพิ่ม
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
