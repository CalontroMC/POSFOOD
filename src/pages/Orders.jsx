import { useEffect, useMemo, useState } from "react";
import { Clock, ChefHat, Scissors, CheckCheck, X, RefreshCcw, PauseCircle, PlayCircle, Tag, Split, Combine, Minus, Plus, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { apiGet, apiPatch, apiPost, apiDelete } from "../lib/api.js";
import DiscountControl from "../components/DiscountControl.jsx";
import MenuOptionPicker from "../components/MenuOptionPicker.jsx";
import { printFinalReceipt, printOrderTickets, autoPrintEnabled } from "../lib/printJob.js";

const STATUSES = [
  { id: "all", label: "ทั้งหมด" },
  { id: "พักบิล", label: "พักบิล", Icon: PauseCircle },
  { id: "รอรับ", label: "รอรับ", Icon: Clock },
  { id: "กำลังทำ", label: "กำลังทำ", Icon: ChefHat },
  { id: "เสิร์ฟแล้ว", label: "เสิร์ฟแล้ว", Icon: Scissors },
  { id: "เสร็จสิ้น", label: "เสร็จสิ้น", Icon: CheckCheck },
  { id: "ยกเลิก", label: "ยกเลิก", Icon: X },
];

const NEXT_STATE = {
  รอรับ: "กำลังทำ",
  กำลังทำ: "เสิร์ฟแล้ว",
  เสิร์ฟแล้ว: "เสร็จสิ้น",
};

function MergePicker({ currentId, tableId, onCancel, onMerged }) {
  const [candidates, setCandidates] = useState([]);
  const [picked, setPicked] = useState({});

  useEffect(() => {
    apiGet("/orders").then((rows) => {
      setCandidates(
        rows.filter(
          (o) =>
            o.id !== currentId &&
            !["เสร็จสิ้น", "ยกเลิก"].includes(o.status) &&
            (!tableId || o.table_id === tableId)
        )
      );
    });
  }, [currentId, tableId]);

  const submit = async () => {
    const ids = Object.entries(picked)
      .filter(([, v]) => v)
      .map(([id]) => Number(id));
    if (ids.length === 0) return alert("เลือกอย่างน้อย 1 บิล");
    await apiPost("/orders/merge", { target_id: currentId, source_ids: ids });
    onMerged();
  };

  return (
    <div className="mt-3 rounded-xl bg-gray-50 p-3">
      <p className="mb-2 text-xs font-semibold text-gray-700">เลือกบิลที่ต้องการรวมเข้าบิลนี้</p>
      {candidates.length === 0 ? (
        <p className="text-xs text-gray-400">ไม่มีบิลอื่น{tableId ? "จากโต๊ะเดียวกัน" : ""}ที่รวมได้</p>
      ) : (
        <ul className="space-y-1">
          {candidates.map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!picked[c.id]}
                  onChange={(e) => setPicked((p) => ({ ...p, [c.id]: e.target.checked }))}
                />
                <span className="font-medium">{c.order_number}</span>
                <span className="text-xs text-gray-500">
                  {c.table_number ? `โต๊ะ ${c.table_number}` : "ทั่วไป"} · ฿{c.total}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary text-xs">
          ยกเลิก
        </button>
        <button onClick={submit} className="btn-primary text-xs">
          รวมบิล
        </button>
      </div>
    </div>
  );
}

function OrderDetailModal({ detail, settings, onClose, onChanged }) {
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [splitItems, setSplitItems] = useState({}); // {order_item_id: qty}
  const [renaming, setRenaming] = useState(false);
  const [labelDraft, setLabelDraft] = useState(detail.label || "");
  const [addingItem, setAddingItem] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [pickerItem, setPickerItem] = useState(null);
  const [disc, setDisc] = useState({
    type: detail.discount_type || "percent",
    value: detail.discount_value || "",
  });
  const [checkingOut, setCheckingOut] = useState(false);
  const [payMethod, setPayMethod] = useState(detail.payment_method || "cash");
  const [cashReceived, setCashReceived] = useState("");
  const [splitAmts, setSplitAmts] = useState({ cash: "", qr: "", card: "" });
  const [closingBill, setClosingBill] = useState(false);

  const isHeld = detail.status === "พักบิล";
  const canEdit = !["เสร็จสิ้น", "ยกเลิก"].includes(detail.status);

  useEffect(() => {
    if (addingItem && menuItems.length === 0) {
      apiGet("/menu/items?with=options", { auth: false }).then((rows) =>
        setMenuItems(rows.filter((m) => m.available))
      );
    }
  }, [addingItem, menuItems.length]);

  const saveLabel = async () => {
    await apiPatch(`/orders/${detail.id}`, { label: labelDraft.trim() || null });
    setRenaming(false);
    await onChanged();
  };

  const onPickAdd = (item) => {
    if (item.options && item.options.length > 0) {
      setPickerItem(item);
    } else {
      addItemDirect({
        item,
        qty: 1,
        selected: [],
        note: "",
      });
    }
  };

  const addItemDirect = async (entry) => {
    const updatedOrder = await apiPost(`/orders/${detail.id}/items`, {
      items: [
        {
          menu_item_id: entry.item.id,
          qty: entry.qty,
          option_ids: (entry.selected || []).map((s) => s.id),
          note: entry.note || undefined,
        },
      ],
    });

    const oldIds = detail.items.map(i => i.id);
    const newItems = updatedOrder.items.filter(i => !oldIds.includes(i.id));

    try {
      const settings = await apiGet("/settings", { auth: false });
      if (autoPrintEnabled(settings) && newItems.length > 0) {
        printOrderTickets(updatedOrder, newItems, { menuItems, settings }).catch(console.warn);
      }
    } catch {}

    setPickerItem(null);
    setAddingItem(false);
    await onChanged();
  };

  const removeItem = async (itemId) => {
    if (!confirm("ลบรายการนี้?")) return;
    await apiDelete(`/orders/${detail.id}/items/${itemId}`);
    await onChanged();
  };

  const saveDiscount = async () => {
    await apiPatch(`/orders/${detail.id}/discount`, {
      discount_type: disc.type,
      discount_value: Number(disc.value) || 0,
    });
    setEditingDiscount(false);
    await onChanged();
  };

  const doSplit = async () => {
    const items = Object.entries(splitItems)
      .filter(([, q]) => Number(q) > 0)
      .map(([id, q]) => ({ order_item_id: Number(id), qty: Number(q) }));
    if (items.length === 0) {
      alert("เลือกอย่างน้อย 1 รายการ");
      return;
    }
    const newOrder = await apiPost(`/orders/${detail.id}/split`, { items });
    setSplitMode(false);
    setSplitItems({});
    await onChanged();
    alert(`แยกบิลสำเร็จ — ออเดอร์ใหม่ ${newOrder.order_number}`);
  };

  const closeBill = async () => {
    setClosingBill(true);
    let payload = { status: "เสร็จสิ้น", payment_method: payMethod };
    if (payMethod === "split") {
      const sp = {};
      if (Number(splitAmts.cash) > 0) sp.cash = Number(splitAmts.cash);
      if (Number(splitAmts.qr) > 0) sp.qr = Number(splitAmts.qr);
      if (Number(splitAmts.card) > 0) sp.card = Number(splitAmts.card);
      payload.split_payments = sp;
    }
    try {
      await apiPatch(`/orders/${detail.id}/status`, payload);
      await onChanged();
      onClose();
    } catch (e) {
      alert(e.message || "เช็คบิลไม่สำเร็จ");
      setClosingBill(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">{detail.order_number}</h3>
              {canEdit && !renaming && (
                <button
                  onClick={() => { setLabelDraft(detail.label || ""); setRenaming(true); }}
                  className="text-gray-400 hover:text-brand-orange"
                  title="เปลี่ยนชื่อบิล"
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
            {renaming ? (
              <div className="mt-1 flex gap-1">
                <input
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  placeholder="ชื่อบิล เช่น พี่หมู"
                  autoFocus
                  className="input text-xs"
                />
                <button onClick={saveLabel} className="btn-primary px-2 py-1 text-xs">บันทึก</button>
                <button onClick={() => setRenaming(false)} className="btn-secondary px-2 py-1 text-xs">ยกเลิก</button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                {detail.label && <span className="font-medium text-brand-orange">{detail.label} · </span>}
                {detail.table_number ? `โต๊ะ ${detail.table_number}` : "ซื้อกลับบ้าน"}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={detail.status} />
          {!["เสร็จสิ้น", "ยกเลิก"].includes(detail.status) && (
            <>
              <button
                onClick={() => {
                  setSplitMode((v) => !v);
                  setMergeMode(false);
                  setSplitItems({});
                }}
                className={`pill text-xs ${splitMode ? "pill-active" : "pill-inactive"}`}
              >
                <Split size={12} /> แยกบิล
              </button>
              <button
                onClick={() => {
                  setMergeMode((v) => !v);
                  setSplitMode(false);
                }}
                className={`pill text-xs ${mergeMode ? "pill-active" : "pill-inactive"}`}
              >
                <Combine size={12} /> รวมบิล
              </button>
            </>
          )}
        </div>

        <ul className="mt-4 space-y-2">
          {detail.items.map((it) => (
            <li key={it.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex-1 text-gray-700">
                  {it.name} × {it.qty}
                </span>
                {canEdit && !splitMode && (
                  <button
                    onClick={() => removeItem(it.id)}
                    className="mr-2 text-gray-300 hover:text-red-500"
                    title="ลบรายการนี้"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                {splitMode && (
                  <div className="mr-2 flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">แยก:</span>
                    <button
                      onClick={() =>
                        setSplitItems((s) => ({
                          ...s,
                          [it.id]: Math.max(0, (Number(s[it.id]) || 0) - 1),
                        }))
                      }
                      className="flex h-6 w-6 items-center justify-center rounded border border-gray-200"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-xs font-bold">
                      {splitItems[it.id] || 0}
                    </span>
                    <button
                      onClick={() =>
                        setSplitItems((s) => ({
                          ...s,
                          [it.id]: Math.min(it.qty, (Number(s[it.id]) || 0) + 1),
                        }))
                      }
                      className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-brand-orange text-white"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}
                <span className="font-semibold text-gray-900">฿{it.qty * it.price}</span>
              </div>
              {it.options?.length > 0 && (
                <p className="text-xs text-gray-400">
                  {it.options.map((o) => `${o.group}: ${o.name}`).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>

        {splitMode && (
          <button onClick={doSplit} className="btn-primary mt-3 w-full text-sm">
            <Split size={14} /> สร้างบิลใหม่จากรายการที่เลือก
          </button>
        )}

        {mergeMode && (
          <MergePicker
            currentId={detail.id}
            tableId={detail.table_id}
            onCancel={() => setMergeMode(false)}
            onMerged={async () => {
              setMergeMode(false);
              await onChanged();
              alert("รวมบิลสำเร็จ");
            }}
          />
        )}
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">ยอดรวม</span>
            <span>฿{detail.subtotal}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-gray-500">
              <Tag size={12} /> ส่วนลด
              {detail.status !== "เสร็จสิ้น" && detail.status !== "ยกเลิก" && (
                <button
                  onClick={() => setEditingDiscount((v) => !v)}
                  className="ml-1 text-xs text-brand-orange underline"
                >
                  แก้ไข
                </button>
              )}
            </span>
            <span className="text-red-500">−฿{detail.discount || 0}</span>
          </div>
          {editingDiscount && (
            <div className="rounded-xl bg-orange-50/60 p-3">
              <DiscountControl
                subtotal={detail.subtotal}
                type={disc.type}
                value={disc.value}
                onChange={setDisc}
                compact
              />
              <button onClick={saveDiscount} className="btn-primary mt-2 w-full text-xs">
                บันทึกส่วนลด
              </button>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 font-bold">
            <span>สุทธิ</span>
            <span className="text-brand-orange">฿{detail.total}</span>
          </div>
        </div>
        </div>

        {/* Footer actions */}
        {canEdit && (
          <div className="border-t border-gray-100 px-5 py-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAddingItem((v) => !v)}
                className="btn-secondary flex-1 text-xs"
              >
                <Plus size={14} /> เพิ่มเมนู
              </button>
              {isHeld && (
                <button
                  onClick={async () => {
                    await apiPost(`/orders/${detail.id}/resume`);
                    try {
                      const settings = await apiGet("/settings", { auth: false });
                      if (autoPrintEnabled(settings)) {
                        printOrderTickets({ ...detail, status: "รอรับ" }, detail.items, { settings }).catch(console.warn);
                      }
                    } catch {}
                    await onChanged();
                  }}
                  className="btn-primary flex-1 text-xs"
                >
                  <PlayCircle size={14} /> เริ่มทำต่อ
                </button>
              )}
            </div>
            {addingItem && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-gray-200">
                {menuItems.length === 0 ? (
                  <p className="p-4 text-center text-xs text-gray-400">กำลังโหลด...</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {menuItems.map((m) => (
                      <li key={m.id}>
                        <button
                          onClick={() => onPickAdd(m)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-orange-50"
                        >
                          <span>{m.name}</span>
                          <span className="font-semibold text-brand-orange">฿{m.price}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* เช็คบิล → ปิดบิล (status เสร็จสิ้น) → ยิงใบเสร็จเข้า Loyverse */}
            {!checkingOut ? (
              <button
                onClick={() => setCheckingOut(true)}
                className="mt-2 w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700"
              >
                <CheckCheck size={16} className="-mt-0.5 mr-1 inline" /> เช็คบิล · ฿{detail.total}
              </button>
            ) : (
              <div className="mt-2 rounded-xl border border-green-200 bg-green-50/70 p-3">
                <p className="mb-2 text-xs font-medium text-gray-600">เลือกวิธีรับเงิน</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "cash", label: "เงินสด" },
                    { id: "qr", label: "QR" },
                    { id: "card", label: "บัตร" },
                    { id: "split", label: "แบ่งจ่าย" },
                    ...(settings?.payment_grab === "1" ? [{ id: "grab", label: "Grab" }] : []),
                    ...(settings?.payment_lineman === "1" ? [{ id: "lineman", label: "LINE MAN" }] : []),
                    ...(settings?.payment_foodpanda === "1" ? [{ id: "foodpanda", label: "Foodpanda" }] : []),
                    ...(settings?.payment_shopee === "1" ? [{ id: "shopee", label: "ShopeeFood" }] : []),
                    ...(settings?.payment_transfer === "1" ? [{ id: "transfer", label: "โอนเงิน" }] : []),
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPayMethod(p.id); setCashReceived(""); setSplitAmts({ cash: "", qr: "", card: "" }); }}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                        payMethod === p.id
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-gray-200 bg-white text-gray-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {payMethod === "cash" && (
                  <div className="mt-3 rounded-lg bg-white p-3 shadow-sm border border-gray-100">
                    <label className="mb-1 block text-[11px] font-semibold text-gray-500">รับเงินสด (บาท)</label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="input text-sm font-bold"
                      placeholder="จำนวนเงิน"
                      autoFocus
                    />
                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
                      <span className="font-semibold text-gray-600">เงินทอน</span>
                      <span className={`font-bold ${Number(cashReceived) >= detail.total ? "text-green-600" : "text-red-500"}`}>
                        {Number(cashReceived) > 0 ? (Number(cashReceived) - detail.total >= 0 ? `฿${Number(cashReceived) - detail.total}` : "รับเงินไม่ครบ") : "฿0"}
                      </span>
                    </div>
                  </div>
                )}
                {payMethod === "split" && (
                  <div className="mt-3 space-y-2 rounded-lg bg-white p-3 shadow-sm border border-gray-100">
                    {Object.keys(splitAmts).map(k => (
                       <div key={k} className="flex items-center gap-2">
                         <span className="w-16 text-xs font-bold text-gray-600 uppercase">{k}</span>
                         <input
                           type="number"
                           className="input text-sm"
                           placeholder="0"
                           value={splitAmts[k]}
                           onChange={e => setSplitAmts(s => ({ ...s, [k]: e.target.value }))}
                         />
                       </div>
                    ))}
                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                      <span className="font-semibold text-gray-600">ยอดรวมแบ่งจ่าย</span>
                      <span className={`font-bold ${((Number(splitAmts.cash)||0) + (Number(splitAmts.qr)||0) + (Number(splitAmts.card)||0)) === detail.total ? "text-green-600" : "text-red-500"}`}>
                        ฿{((Number(splitAmts.cash)||0) + (Number(splitAmts.qr)||0) + (Number(splitAmts.card)||0))} / ฿{detail.total}
                      </span>
                    </div>
                  </div>
                )}
                <button
                  onClick={closeBill}
                  disabled={closingBill || (payMethod === "cash" && (Number(cashReceived) < detail.total && Number(cashReceived) > 0)) || (payMethod === "split" && (((Number(splitAmts.cash)||0) + (Number(splitAmts.qr)||0) + (Number(splitAmts.card)||0)) !== detail.total))}
                  className="mt-3 w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {closingBill ? "กำลังเช็คบิล..." : `ยืนยันเช็คบิล ฿${detail.total}`}
                </button>
                <button
                  onClick={() => setCheckingOut(false)}
                  className="mt-1.5 w-full text-xs text-gray-400 hover:text-gray-600"
                >
                  ยกเลิก
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {pickerItem && (
        <MenuOptionPicker
          item={pickerItem}
          ctaLabel="เพิ่ม"
          onClose={() => setPickerItem(null)}
          onAdd={(entry) => addItemDirect(entry)}
        />
      )}
    </div>
  );
}

export default function Orders() {
  const [active, setActive] = useState("all");
  const [orders, setOrders] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);

  const [settings, setSettings] = useState({});

  const load = async () => {
    const [o, s] = await Promise.all([
      apiGet("/orders"),
      apiGet("/settings", { auth: false })
    ]);
    setOrders(o);
    setSettings(s || {});
  };
  useEffect(() => {
    load();
    const ev = new EventSource("/api/events");
    ev.addEventListener("order", () => load());
    return () => ev.close();
  }, []);

  const filtered = useMemo(
    () => orders.filter((o) => active === "all" || o.status === active),
    [orders, active]
  );

  const counts = useMemo(() => {
    const c = {};
    for (const s of STATUSES) c[s.id] = s.id === "all" ? orders.length : 0;
    for (const o of orders) c[o.status] = (c[o.status] || 0) + 1;
    return c;
  }, [orders]);

  const openDetail = async (id) => {
    setOpenId(id);
    const d = await apiGet(`/orders/${id}`, { auth: false });
    setDetail(d);
  };

  const setStatus = async (id, status, extra = {}) => {
    await apiPatch(`/orders/${id}/status`, { status, ...extra });
    // When order is finalized → print receipt
    if (status === "เสร็จสิ้น") {
      try {
        const [order, settings] = await Promise.all([
          apiGet(`/orders/${id}`, { auth: false }),
          apiGet("/settings", { auth: false }),
        ]);
        if (autoPrintEnabled(settings)) {
          printFinalReceipt(order, order.items || [], { settings }).catch(() => {});
        }
      } catch {}
    }
    await load();
    if (openId === id) {
      const d = await apiGet(`/orders/${id}`, { auth: false });
      setDetail(d);
    }
  };

  // Manual reprint from order modal
  const reprintTickets = async (id) => {
    const [order, settings, menuItems] = await Promise.all([
      apiGet(`/orders/${id}`, { auth: false }),
      apiGet("/settings", { auth: false }),
      apiGet("/menu/items", { auth: false }),
    ]);
    return printOrderTickets(order, order.items || [], { menuItems, settings });
  };
  const reprintReceipt = async (id) => {
    const [order, settings] = await Promise.all([
      apiGet(`/orders/${id}`, { auth: false }),
      apiGet("/settings", { auth: false }),
    ]);
    return printFinalReceipt(order, order.items || [], { settings });
  };

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="รายการออเดอร์"
        subtitle="ติดตามและจัดการออเดอร์ทั้งหมด"
        actions={
          <button onClick={load} className="btn-secondary">
            <RefreshCcw size={14} /> รีเฟรช
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const isA = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`pill ${isA ? "pill-active" : "pill-inactive"}`}
            >
              {s.Icon && <s.Icon size={14} />}
              <span>{s.label}</span>
              <span
                className={`rounded-full px-1.5 text-[11px] ${
                  isA ? "bg-white/20" : "bg-gray-100"
                }`}
              >
                {counts[s.id] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            Icon={Clock}
            title="ยังไม่มีออเดอร์"
            subtitle="ออเดอร์ใหม่จะปรากฏที่นี่"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o) => (
            <button
              key={o.id}
              onClick={() => openDetail(o.id)}
              className="card p-4 text-left transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">
                    {o.order_number}
                    {o.label && (
                      <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-brand-orange">
                        {o.label}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {o.table_number ? `โต๊ะ ${o.table_number}` : "ซื้อกลับบ้าน"} ·{" "}
                    {new Date(o.created_at).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">รวม</span>
                <span className="font-bold text-brand-orange">฿{o.total}</span>
              </div>
              {o.status === "พักบิล" && (
                <div className="mt-3">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await apiPost(`/orders/${o.id}/resume`);
                      await load();
                    }}
                    className="btn-primary w-full py-2 text-xs"
                  >
                    <PlayCircle size={12} /> ดึงบิลกลับมาทำ
                  </button>
                </div>
              )}
              {NEXT_STATE[o.status] && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatus(o.id, NEXT_STATE[o.status]);
                    }}
                    className="btn-primary flex-1 py-2 text-xs"
                  >
                    {NEXT_STATE[o.status]}
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("พักบิลนี้?")) return;
                      await apiPost(`/orders/${o.id}/hold`);
                      await load();
                    }}
                    className="btn-secondary py-2 text-xs"
                    title="พักบิล"
                  >
                    <PauseCircle size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const reason = window.prompt("ระบุเหตุผลการยกเลิกบิล (เช่น ของหมด, ลูกค้ายกเลิก):");
                      if (reason !== null) {
                        setStatus(o.id, "ยกเลิก", { cancel_reason: reason });
                      }
                    }}
                    className="btn-secondary py-2 text-xs text-red-500"
                  >
                    ยกเลิก
                  </button>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {openId && detail && (
        <OrderDetailModal
          detail={detail}
          settings={settings}
          onClose={() => {
            setOpenId(null);
            setDetail(null);
          }}
          onChanged={async () => {
            await load();
            const d = await apiGet(`/orders/${openId}`, { auth: false });
            setDetail(d);
          }}
        />
      )}
    </div>
  );
}
