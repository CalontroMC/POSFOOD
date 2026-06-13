import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, ShoppingCart, Plus, Minus, Trash2, UtensilsCrossed, Lock, PauseCircle, Tag, Armchair, ShoppingBag, X, Gift, CheckCheck } from "lucide-react";
import { apiGet, apiPost, apiPatch, cachedGet } from "../lib/api.js";
import MenuOptionPicker from "../components/MenuOptionPicker.jsx";
import PromptPayQR from "../components/PromptPayQR.jsx";
import DiscountControl from "../components/DiscountControl.jsx";
import OnboardingWizard from "../components/OnboardingWizard.jsx";
import { printOrderTickets, autoPrintEnabled } from "../lib/printJob.js";

export default function POSPage() {
  const { shiftIsOpen } = useOutletContext() || {};
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [members, setMembers] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [tableId, setTableId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [picker, setPicker] = useState(null);
  const [discount, setDiscount] = useState({ type: "percent", value: "" });
  const [payment, setPayment] = useState("cash");
  const [mode, setMode] = useState("dine_in"); // 'dine_in' | 'takeaway'
  const [holdLabel, setHoldLabel] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(""); // 1 pt = 1 baht discount
  const [selectedRewardId, setSelectedRewardId] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [cashReceived, setCashReceived] = useState("");

  const [settings, setSettings] = useState({});

  const reload = async () => {
    // v5 offline-first: cachedGet falls back to localStorage when offline
    const [c, mi, t, m, r, s] = await Promise.all([
      cachedGet("/menu/categories", { auth: false }),
      cachedGet("/menu/items?with=options", { auth: false }),
      cachedGet("/tables", { auth: false }),
      apiGet("/members"),   // auth-required, dynamic → don't cache
      apiGet("/rewards/active").catch(() => []), // auth-required, active rewards
      cachedGet("/settings", { auth: false })
    ]);
    setCats(c);
    setItems(mi.filter((x) => x.available));
    setTables(t);
    setMembers(m);
    setRewards(r);
    setSettings(s || {});
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((m) => {
      const okCat = !activeCat || m.category_id === activeCat;
      const okQ = !query || m.name.toLowerCase().includes(query.toLowerCase());
      return okCat && okQ;
    });
  }, [items, activeCat, query]);

  const openPicker = (item) => {
    if (!shiftIsOpen) {
      setToast("ต้องเปิดกะก่อนจึงจะรับออเดอร์ได้");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    setPicker(item);
  };

  const addEntry = (entry) => {
    setCart((prev) => [...prev, entry]);
    setPicker(null);
  };

  const inc = (idx) =>
    setCart((p) => p.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l)));
  const dec = (idx) =>
    setCart((p) =>
      p
        .map((l, i) => (i === idx ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0)
    );
  const remove = (idx) => setCart((p) => p.filter((_, i) => i !== idx));

  const selectedMember = members.find((m) => String(m.id) === String(memberId));
  const subtotal = cart.reduce(
    (s, l) => s + l.qty * (l.price + (l.optionDelta || 0)),
    0
  );
  const discountAmount = (() => {
    const v = Number(discount.value) || 0;
    if (v <= 0) return 0;
    if (discount.type === "percent") return Math.min(subtotal, Math.round((subtotal * v) / 100));
    return Math.min(subtotal, Math.round(v));
  })();
  // Redeem points: 1 pt = 1 baht. Cap = min(member balance, subtotal - discount).
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const maxRedeem = Math.min(selectedMember?.points || 0, afterDiscount);
  const redeemValue = Math.max(0, Math.min(maxRedeem, Math.floor(Number(pointsToRedeem) || 0)));
  const net = Math.max(0, afterDiscount - redeemValue);
  
  const scRate = Number(settings?.service_charge_rate) || 0;
  const vRate = Number(settings?.vat_rate) || 0;
  const vatInclusive = settings?.vat_inclusive === "1";
  const roundingRule = settings?.rounding_rule || "none";

  let scAmt = 0;
  if (scRate > 0) {
    scAmt = Math.round((net * scRate) / 100);
  }
  const baseForVat = net + scAmt;
  let total = baseForVat;

  if (vRate > 0) {
    if (!vatInclusive) {
      const vatAmt = Math.round((baseForVat * vRate) / 100);
      total = baseForVat + vatAmt;
    }
  }

  if (roundingRule === "floor") {
    total = Math.floor(total);
  } else if (roundingRule === "ceil") {
    total = Math.ceil(total);
  } else if (roundingRule === "nearest_25") {
    total = Math.round(total * 4) / 4;
  } else {
    total = Math.round(total);
  }

  const buildBody = (hold = false) => {
    const table = mode === "dine_in" ? tables.find((t) => String(t.id) === String(tableId)) : null;
    const member = members.find((m) => String(m.id) === String(memberId));
    const body = {
      items: cart.map((l) => ({
        menu_item_id: l.item.id,
        qty: l.qty,
        option_ids: (l.selected || []).map((s) => s.id),
        note: l.note || undefined,
      })),
      payment_method: payment,
      hold,
    };
    if (Number(discount.value) > 0) {
      body.discount_type = discount.type === "percent" ? "percent" : "fixed";
      body.discount_value = Number(discount.value);
    }
    if (table) body.table_token = table.qr_token;
    if (member) body.member_phone = member.phone;
    if (hold && holdLabel.trim()) body.label = holdLabel.trim();
    if (mode === "takeaway" && !body.label) body.label = "ซื้อกลับบ้าน";
    // Don't redeem on hold — points only deduct at the real "ยืนยันออเดอร์"
    if (!hold && redeemValue > 0 && member) body.points_redeemed = redeemValue;
    if (!hold && selectedRewardId && member) body.reward_id = selectedRewardId;
    // Admin POS handles auto-print on the client (via printJob.js dispatcher,
    // which respects rawbt/browser/network/local modes). Tell server to skip
    // its own server-side TCP print so we don't get duplicate tickets.
    body._client_print = 1;
    return body;
  };

  const reset = () => {
    setCart([]);
    setTableId("");
    setMemberId("");
    setDiscount({ type: "percent", value: "" });
    setPayment("cash");
    setHoldLabel("");
    setMode("dine_in");
    setPointsToRedeem("");
    setSelectedRewardId("");
    setCashReceived("");
  };

  useEffect(() => {
    if (memberId) {
      const member = members.find((m) => String(m.id) === String(memberId));
      if (member && member.discount_percent > 0) {
        setDiscount({ type: "percent", value: String(member.discount_percent) });
      } else {
        setDiscount({ type: "percent", value: "" });
      }
    } else {
      setDiscount({ type: "percent", value: "" });
    }
  }, [memberId, members]);

  const submit = async (hold = false, checkoutNow = false) => {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      const order = await apiPost("/orders", buildBody(hold), { auth: false });
      // Auto-print kitchen + bar tickets (only for confirmed orders, not held bills)
      if (!hold) {
        try {
          const settings = await apiGet("/settings", { auth: false });
          if (autoPrintEnabled(settings)) {
            printOrderTickets(order, order.items || [], { menuItems: items, settings })
              .then((r) => {
                const printed = (r.results || []).filter((x) => x.ok).length;
                if (printed > 0) setToast(`พิมพ์ใบสั่ง ${printed} ใบแล้ว`);
              })
              .catch(() => {});
          }
        } catch {}
      }
      // เช็คบิลเลย → ปิดบิลทันที (status เสร็จสิ้น) → ยิงใบเสร็จเข้า Loyverse
      if (!hold && checkoutNow) {
        await apiPatch(`/orders/${order.id}/status`, {
          status: "เสร็จสิ้น",
          payment_method: payment,
        });
        setToast(`เช็คบิล ${order.order_number} แล้ว · ฿${total}`);
      } else {
        setToast(hold
          ? `พักบิล ${order.order_number} แล้ว`
          : `เปิดตั๋ว ${order.order_number} แล้ว`);
      }
      reset();
      setTimeout(() => setToast(""), 3000);
      await reload();
    } catch (e) {
      setToast(`เกิดข้อผิดพลาด: ${e.message}`);
      setTimeout(() => setToast(""), 4000);
    } finally {
      setBusy(false);
    }
  };

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="relative flex h-full">
      <OnboardingWizard />
      <section className="flex-1 overflow-y-auto px-4 pb-24 pt-4 lg:px-6 lg:pb-6 lg:pt-6">
        <div className="relative mb-4 max-w-2xl">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาเมนู..."
            className="input pl-10"
          />
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCat(null)}
            className={`pill ${!activeCat ? "pill-active" : "pill-inactive"}`}
          >
            ทั้งหมด
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`pill ${
                activeCat === c.id ? "pill-active" : "pill-inactive"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4 xl:grid-cols-4">
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => openPicker(item)}
              className="card group overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {item.image_url && (
                <div className="aspect-square w-full overflow-hidden bg-gray-100">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-3">
                <div className="mb-1 flex items-start justify-between">
                  <p className="line-clamp-2 text-sm font-semibold text-gray-900 leading-tight">
                    {item.name}
                  </p>
                  {item.is_out_of_stock && (
                    <span className="ml-2 shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                      ของหมด
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{item.category_name}</p>
                <p className="mt-1.5 text-base font-bold text-brand-orange">
                  ฿{item.price}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Mobile backdrop */}
      {mobileCartOpen && (
        <div
          onClick={() => setMobileCartOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-[88%] max-w-[360px] shrink-0 flex-col border-l border-gray-100 bg-white shadow-xl transition-transform duration-200 lg:static lg:w-[320px] lg:translate-x-0 lg:shadow-none ${
          mobileCartOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-brand-orange" />
            <h2 className="text-base font-bold text-gray-900">ออเดอร์</h2>
            {cartCount > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-brand-orange">
                {cartCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setMobileCartOpen(false)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 lg:hidden"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 border-b border-gray-100 px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setMode("dine_in"); }}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-semibold transition ${
                mode === "dine_in"
                  ? "border-brand-orange bg-orange-50 text-brand-orange"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              <Armchair size={14} /> ทานที่ร้าน
            </button>
            <button
              type="button"
              onClick={() => { setMode("takeaway"); setTableId(""); }}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-semibold transition ${
                mode === "takeaway"
                  ? "border-brand-orange bg-orange-50 text-brand-orange"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              <ShoppingBag size={14} /> ซื้อกลับบ้าน
            </button>
          </div>
          {mode === "dine_in" && (
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="input"
            >
              <option value="">เลือกโต๊ะ...</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  โต๊ะ {t.table_number} · {t.zone}
                </option>
              ))}
            </select>
          )}
          <select
            value={memberId}
            onChange={(e) => { setMemberId(e.target.value); setPointsToRedeem(""); }}
            className="input"
          >
            <option value="">เลือกสมาชิก (ไม่บังคับ)...</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.phone} · {m.points} แต้ม
              </option>
            ))}
          </select>
          {selectedMember && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="mb-2 flex items-center gap-1 font-semibold">
                <Gift size={12} /> {selectedMember.name} 
                {selectedMember.dob && new Date(selectedMember.dob).getMonth() === new Date().getMonth() && (
                  <span title="เดือนเกิด" className="ml-1 text-base leading-none">🎂</span>
                )}
                มี {selectedMember.points.toLocaleString()} แต้ม
              </div>
              <div className="flex flex-col gap-2">
                {rewards.length > 0 && (
                  <select
                    value={selectedRewardId}
                    onChange={(e) => {
                      setSelectedRewardId(e.target.value);
                      if (e.target.value) setPointsToRedeem(""); // Clear manual points if reward selected
                    }}
                    className="input h-8 text-xs bg-white"
                  >
                    <option value="">-- ไม่แลกรางวัลพิเศษ --</option>
                    {rewards.map(r => (
                      <option key={r.id} value={r.id} disabled={selectedMember.points < r.points_cost}>
                        ใช้ {r.points_cost} แต้ม: {r.name} {selectedMember.points < r.points_cost && "(แต้มไม่พอ)"}
                      </option>
                    ))}
                  </select>
                )}
                
                {!selectedRewardId && maxRedeem > 0 ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={maxRedeem}
                      value={pointsToRedeem}
                      onChange={(e) => setPointsToRedeem(e.target.value)}
                      placeholder={`ใช้เป็นส่วนลด (สูงสุด ${maxRedeem}฿)`}
                      className="input h-8 flex-1 text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setPointsToRedeem(String(maxRedeem))}
                      className="rounded-lg bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                      Max
                    </button>
                  </div>
                ) : !selectedRewardId && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    {cart.length === 0 ? "เพิ่มเมนูก่อนเพื่อใช้แต้ม" : "ไม่สามารถใช้แต้มกับยอดนี้ได้"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <UtensilsCrossed size={28} />
              </div>
              <p className="font-semibold text-gray-700">ยังไม่มีรายการ</p>
              <p className="mt-1 text-xs text-gray-400">
                กดเมนูเพื่อเพิ่มรายการ
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {cart.map((l, idx) => (
                <li
                  key={idx}
                  className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {l.item.name}
                      </p>
                      {l.selected?.length > 0 && (
                        <p className="line-clamp-1 text-xs text-gray-500">
                          {l.selected.map((s) => s.name).join(", ")}
                        </p>
                      )}
                      {l.note && (
                        <p className="line-clamp-1 text-xs italic text-gray-400">
                          “{l.note}”
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        ฿{l.price + (l.optionDelta || 0)}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(idx)}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => dec(idx)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">
                        {l.qty}
                      </span>
                      <button
                        onClick={() => inc(idx)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange text-white hover:brightness-95"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-brand-orange">
                      ฿{l.qty * (l.price + (l.optionDelta || 0))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
          {toast && (
            <div className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {toast}
            </div>
          )}
          {cart.length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Tag size={12} /> ส่วนลด
              </div>
              <DiscountControl
                subtotal={subtotal}
                type={discount.type}
                value={discount.value}
                onChange={setDiscount}
                compact
              />
              <div className="flex gap-1">
                {[
                  { id: "cash", label: "เงินสด" },
                  { id: "qr", label: "QR" },
                  { id: "card", label: "บัตร" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPayment(p.id)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${
                      payment === p.id
                        ? "border-brand-orange bg-orange-50 text-brand-orange"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mb-3 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">ยอดรวม</span>
              <span className="text-gray-900">฿{subtotal}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-500">ส่วนลด</span>
                <span className="text-red-500">−฿{discountAmount}</span>
              </div>
            )}
            {redeemValue > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-600">ใช้แต้ม ({redeemValue} แต้ม)</span>
                <span className="text-amber-600">−฿{redeemValue}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-gray-200 pt-1.5">
              <span className="font-semibold text-gray-700">สุทธิ</span>
              <span className="text-lg font-bold text-brand-orange">฿{total}</span>
            </div>
          </div>
          {cart.length > 0 && (
            <input
              value={holdLabel}
              onChange={(e) => setHoldLabel(e.target.value)}
              placeholder="ชื่อบิล (สำหรับพักบิล) เช่น พี่หมู, ลูกค้าใส่หมวก..."
              className="input mb-2 text-xs"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => submit(true)}
              disabled={cart.length === 0 || busy || !shiftIsOpen}
              className="btn-secondary disabled:opacity-50"
              title="พักบิล (Save Ticket)"
            >
              <PauseCircle size={14} /> พัก
            </button>
            <button
              onClick={() => submit(false, false)}
              disabled={cart.length === 0 || busy || !shiftIsOpen}
              className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              title="เปิดตั๋วไว้ก่อน เช็คบิลทีหลัง (นั่งกินที่ร้าน)"
            >
              {!shiftIsOpen ? (
                <><Lock size={14} /> เปิดกะก่อน</>
              ) : busy ? "กำลังบันทึก..." : "เปิดตั๋ว"}
            </button>
            <button
              onClick={() => setShowCheckout(true)}
              disabled={cart.length === 0 || busy || !shiftIsOpen}
              className="flex-1 rounded-xl bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="เช็คบิลเลย — ปิดบิล + ยิงใบเสร็จเข้า Loyverse ทันที"
            >
              <CheckCheck size={14} className="-mt-0.5 mr-1 inline" />เช็คบิล
            </button>
          </div>
        </div>
      </aside>

      {/* Floating cart button (mobile only) */}
      <button
        onClick={() => setMobileCartOpen(true)}
        className="fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-brand-orange px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-300/50 transition active:scale-95 lg:hidden"
      >
        <ShoppingCart size={18} />
        <span>ตะกร้า</span>
        {cartCount > 0 && (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-brand-orange">
            {cartCount}
          </span>
        )}
        {subtotal > 0 && <span className="text-xs opacity-90">฿{total}</span>}
      </button>

      {picker && (
        <MenuOptionPicker
          item={picker}
          ctaLabel="เพิ่ม"
          onClose={() => setPicker(null)}
          onAdd={addEntry}
        />
      )}

      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="mb-4 text-center text-xl font-bold text-gray-900">รับชำระเงิน</h3>
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-500">ยอดสุทธิ</p>
              <p className="text-3xl font-bold text-brand-orange">฿{total}</p>
            </div>
            
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { id: "cash", label: "เงินสด" },
                { id: "qr", label: "QR" },
                { id: "card", label: "บัตร" },
                ...(settings.payment_grab === "1" ? [{ id: "grab", label: "Grab" }] : []),
                ...(settings.payment_lineman === "1" ? [{ id: "lineman", label: "LINE MAN" }] : []),
                ...(settings.payment_foodpanda === "1" ? [{ id: "foodpanda", label: "Foodpanda" }] : []),
                ...(settings.payment_shopee === "1" ? [{ id: "shopee", label: "ShopeeFood" }] : []),
                ...(settings.payment_transfer === "1" ? [{ id: "transfer", label: "โอนเงิน" }] : []),
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPayment(p.id); setCashReceived(""); }}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium ${
                    payment === p.id
                      ? "border-green-600 bg-green-600 text-white shadow-sm"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {payment === "cash" && (
              <div className="mb-5 space-y-3 rounded-xl bg-gray-50 p-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">รับเงินสด (บาท)</label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="input text-lg font-bold"
                    placeholder="จำนวนเงินที่รับมา"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                  <span className="text-sm font-semibold text-gray-600">เงินทอน</span>
                  <span className={`text-xl font-bold ${Number(cashReceived) >= total ? "text-green-600" : "text-red-500"}`}>
                    {Number(cashReceived) > 0 ? (Number(cashReceived) - total >= 0 ? `฿${Number(cashReceived) - total}` : "รับเงินไม่ครบ") : "฿0"}
                  </span>
                </div>
              </div>
            )}

            {payment === "qr" && (
              <div className="mb-5 flex justify-center">
                <PromptPayQR promptpayId={settings.promptpay_id} amount={total} size={150} />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowCheckout(false)} className="btn-secondary flex-1">
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  setShowCheckout(false);
                  submit(false, true);
                }}
                disabled={payment === "cash" && (Number(cashReceived) < total && Number(cashReceived) > 0)}
                className="flex-[2] rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                ยืนยันรับเงิน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
