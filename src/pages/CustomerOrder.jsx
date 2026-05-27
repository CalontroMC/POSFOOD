import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  UtensilsCrossed,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  Gift,
  UserPlus,
  X,
  LogOut,
  Receipt,
  Bell,
} from "lucide-react";
import { apiGet, apiPost, cachedGet } from "../lib/api.js";
import MenuOptionPicker from "../components/MenuOptionPicker.jsx";

const MEMBER_KEY = "foodpos_customer_phone";
const ORDERED_KEY = (tok) => `foodpos_has_ordered_${tok}`;
const BILL_CALLED_KEY = (tok) => `foodpos_bill_called_${tok}`;
// Bill call cooldown (ms) — after calling, button stays in "called" state for this long
const BILL_COOLDOWN_MS = 5 * 60 * 1000;

export default function CustomerOrder() {
  const [params] = useSearchParams();
  const token = params.get("table");
  const [table, setTable] = useState(null);
  const [tableError, setTableError] = useState("");
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [picker, setPicker] = useState(null);
  const [member, setMember] = useState(null); // {id, name, phone, points}
  const [showSignup, setShowSignup] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState("");
  const [hasOrdered, setHasOrdered] = useState(false);
  const [billStatus, setBillStatus] = useState("idle"); // idle | calling | called
  const [billErr, setBillErr] = useState("");
  const [pointsToRedeem, setPointsToRedeem] = useState(""); // 1 pt = 1 baht

  // Load table by QR token
  useEffect(() => {
    if (!token) {
      setTableError("ไม่พบรหัสโต๊ะใน URL — กรุณาสแกน QR จากโต๊ะอีกครั้ง");
      return;
    }
    (async () => {
      try {
        const t = await cachedGet(`/tables/by-token/${token}`, { auth: false });
        setTable(t);
      } catch {
        setTableError("โต๊ะนี้ไม่ถูกต้องหรือถูกยกเลิกแล้ว");
      }
    })();
  }, [token]);

  // Load menu
  useEffect(() => {
    (async () => {
      // v5 offline-first: cached menu survives WiFi drop
      const [c, mi] = await Promise.all([
        cachedGet("/menu/categories", { auth: false }),
        cachedGet("/menu/items?with=options", { auth: false }),
      ]);
      setCats(c);
      setItems(mi.filter((m) => m.available));
    })();
  }, []);

  // Auto-load member from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(MEMBER_KEY);
    if (saved) loadMember(saved);
  }, []);

  // Restore "has ordered" + "bill called" state for this table
  useEffect(() => {
    if (!token) return;
    if (localStorage.getItem(ORDERED_KEY(token))) setHasOrdered(true);
    const calledAt = Number(localStorage.getItem(BILL_CALLED_KEY(token)));
    if (calledAt && Date.now() - calledAt < BILL_COOLDOWN_MS) {
      setBillStatus("called");
    }
  }, [token]);

  const callBill = async () => {
    if (!token || billStatus === "calling") return;
    setBillStatus("calling");
    setBillErr("");
    try {
      await apiPost("/bill-requests", { table_token: token }, { auth: false });
      localStorage.setItem(BILL_CALLED_KEY(token), String(Date.now()));
      setBillStatus("called");
    } catch (e) {
      setBillErr(e.message || "เรียกเช็คบิลไม่สำเร็จ");
      setBillStatus("idle");
      setTimeout(() => setBillErr(""), 4000);
    }
  };

  const loadMember = async (phone) => {
    try {
      const m = await apiGet(`/members/lookup?phone=${encodeURIComponent(phone)}`, {
        auth: false,
        silent401: true,
      });
      setMember(m);
      localStorage.setItem(MEMBER_KEY, phone);
    } catch {
      localStorage.removeItem(MEMBER_KEY);
      setMember(null);
    }
  };

  const logoutMember = () => {
    localStorage.removeItem(MEMBER_KEY);
    setMember(null);
    setPointsToRedeem("");
  };

  const filtered = useMemo(
    () =>
      items.filter((m) => {
        const okC = !cat || m.category_id === cat;
        const okQ = !q || m.name.includes(q);
        return okC && okQ;
      }),
    [items, cat, q]
  );

  const cartTotal = cart.reduce((s, l) => s + l.qty * (l.price + l.optionDelta), 0);
  const maxRedeem = Math.min(member?.points || 0, cartTotal);
  const redeemValue = Math.max(0, Math.min(maxRedeem, Math.floor(Number(pointsToRedeem) || 0)));
  const total = Math.max(0, cartTotal - redeemValue);
  const pointsPreview = cart.reduce(
    (s, l) => s + l.qty * (l.item.points || 0),
    0
  );

  const addToCart = (entry) => setCart((p) => [...p, entry]);
  const incLine = (idx) =>
    setCart((p) => p.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l)));
  const decLine = (idx) =>
    setCart((p) =>
      p.map((l, i) => (i === idx ? { ...l, qty: l.qty - 1 } : l)).filter((l) => l.qty > 0)
    );
  const removeLine = (idx) => setCart((p) => p.filter((_, i) => i !== idx));

  const onMenuClick = (item) => setPicker(item);

  const submit = async () => {
    setErr("");
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const order = await apiPost(
        "/orders",
        {
          table_token: token,
          member_phone: member?.phone || undefined,
          note: note || undefined,
          points_redeemed: member && redeemValue > 0 ? redeemValue : undefined,
          items: cart.map((l) => ({
            menu_item_id: l.item.id,
            qty: l.qty,
            option_ids: (l.selected || []).map((s) => s.id),
            note: l.note || undefined,
          })),
        },
        { auth: false }
      );
      setDone(order);
      setCart([]);
      setPointsToRedeem("");
      setHasOrdered(true);
      if (token) localStorage.setItem(ORDERED_KEY(token), "1");
      // Refresh member balance so next order shows the new points
      if (member?.phone) loadMember(member.phone);
    } catch (e) {
      setErr(e.message || "ส่งออเดอร์ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  if (tableError) {
    return (
      <Center>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-500">
          <AlertTriangle size={26} />
        </div>
        <h1 className="text-base font-bold text-gray-900">ลิงก์ไม่ถูกต้อง</h1>
        <p className="mt-2 text-sm text-gray-500">{tableError}</p>
      </Center>
    );
  }

  if (done) {
    return (
      <Center>
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">สั่งอาหารสำเร็จ!</h1>
        <p className="mt-1 text-sm text-gray-500">
          เลขที่ออเดอร์{" "}
          <span className="font-bold text-brand-orange">{done.order_number}</span>
          {" · "}โต๊ะ {done.table_number}
        </p>

        {member && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
            <Gift size={14} />
            +{done.items.reduce((s, it) => s + (it.qty * (items.find(m=>m.id===it.menu_item_id)?.points || 0)), 0)} แต้มเมื่อชำระเงินแล้ว
          </div>
        )}

        <ul className="mt-5 space-y-2 text-left">
          {done.items.map((it) => (
            <li key={it.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{it.name} × {it.qty}</span>
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
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-base font-bold">
          <span>รวม</span>
          <span className="text-brand-orange">฿{done.total}</span>
        </div>
        <div className="mt-6 space-y-2">
          <CallBillButton status={billStatus} onCall={callBill} err={billErr} />
          <button onClick={() => setDone(null)} className="btn-secondary w-full">
            สั่งเพิ่ม
          </button>
        </div>
      </Center>
    );
  }

  if (!table) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <div className="text-sm text-gray-400">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream pb-32">
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-gray-400">สั่งอาหาร · โต๊ะ</p>
            <p className="text-lg font-bold text-gray-900">{table.table_number}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-orange text-white">
            <UtensilsCrossed size={18} />
          </div>
        </div>
        <MemberBar
          member={member}
          onSignup={() => setShowSignup(true)}
          onLogout={logoutMember}
        />
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="relative mb-3">
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

        <div className="mb-4 -mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2">
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

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => onMenuClick(m)}
              className="card group overflow-hidden text-left transition active:scale-[0.98]"
            >
              {m.image_url && (
                <div className="aspect-square w-full overflow-hidden bg-gray-100">
                  <img
                    src={m.image_url}
                    alt={m.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-semibold text-gray-900">
                  {m.name}
                </p>
                <p className="text-xs text-gray-400">{m.category_name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-base font-bold text-brand-orange">฿{m.price}</p>
                  {m.points > 0 && (
                    <span className="text-[10px] text-amber-600">
                      +{m.points} แต้ม
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <details className="card mt-6 p-4 text-sm">
          <summary className="cursor-pointer font-medium text-gray-700">
            หมายเหตุ (ไม่บังคับ)
          </summary>
          <div className="mt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ไม่ใส่ผัก, เผ็ดน้อย ..."
              className="input min-h-[60px] resize-y"
            />
          </div>
        </details>
      </main>

      {picker && (
        <MenuOptionPicker
          item={picker}
          ctaLabel="เพิ่มในตะกร้า"
          onClose={() => setPicker(null)}
          onAdd={(entry) => {
            addToCart(entry);
            setPicker(null);
          }}
        />
      )}

      {showSignup && (
        <SignupModal
          onClose={() => setShowSignup(false)}
          onDone={async (phone) => {
            await loadMember(phone);
            setShowSignup(false);
          }}
        />
      )}

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white shadow-[0_-6px_30px_-12px_rgba(0,0,0,0.15)]">
          <div className="mx-auto max-w-2xl px-4 py-3">
            <details className="mb-2">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-gray-700">
                <span className="flex items-center gap-2">
                  <ShoppingCart size={16} className="text-brand-orange" />
                  ตะกร้า ({cart.reduce((s, x) => s + x.qty, 0)} รายการ)
                </span>
                <span className="font-bold text-brand-orange">฿{total}</span>
              </summary>
              <ul className="mt-3 space-y-2">
                {cart.map((l, i) => (
                  <li key={i} className="rounded-xl bg-gray-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.item.name}</p>
                        {l.selected?.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {l.selected.map((s) => s.name).join(", ")}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">฿{l.price + l.optionDelta}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => decLine(i)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold">
                          {l.qty}
                        </span>
                        <button
                          onClick={() => incLine(i)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange text-white"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => removeLine(i)}
                          className="ml-1 text-gray-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </details>

            {member && member.points > 0 && maxRedeem > 0 && (
              <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <Gift size={12} />
                  ใช้แต้มเป็นส่วนลด ({member.points.toLocaleString()} แต้มคงเหลือ)
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={maxRedeem}
                    value={pointsToRedeem}
                    onChange={(e) => setPointsToRedeem(e.target.value)}
                    placeholder={`สูงสุด ${maxRedeem}`}
                    className="input h-8 flex-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setPointsToRedeem(String(maxRedeem))}
                    className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    Max
                  </button>
                  {redeemValue > 0 && (
                    <button
                      type="button"
                      onClick={() => setPointsToRedeem("")}
                      className="rounded-lg px-2 py-1 text-xs text-gray-500"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
                {redeemValue > 0 && (
                  <p className="mt-1.5 text-[11px] text-amber-700">
                    ใช้แต้ม <b>{redeemValue}</b> แต้ม = ลด <b>฿{redeemValue}</b>
                  </p>
                )}
              </div>
            )}
            {member && pointsPreview > 0 && (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-700">
                <Gift size={12} />
                คุณจะได้รับ <b>+{pointsPreview} แต้ม</b> หลังชำระเงิน
              </p>
            )}
            {err && <p className="mb-2 text-sm text-red-500">{err}</p>}
            <button
              onClick={submit}
              disabled={submitting}
              className="btn-primary w-full disabled:opacity-60"
            >
              {submitting ? "กำลังส่ง..." : `ยืนยันสั่งอาหาร · ฿${total}`}
            </button>
            {redeemValue > 0 && (
              <p className="mt-1 text-center text-[11px] text-gray-400">
                ราคาเดิม ฿{cartTotal} − ใช้แต้ม ฿{redeemValue}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Floating "Call bill" button — shown after first order, only when cart empty */}
      {hasOrdered && cart.length === 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-amber-200 bg-amber-50/95 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl px-4 py-3">
            <CallBillButton status={billStatus} onCall={callBill} err={billErr} />
          </div>
        </div>
      )}
    </div>
  );
}

function CallBillButton({ status, onCall, err }) {
  if (status === "called") {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} />
          เรียกเช็คบิลแล้ว — พนักงานกำลังนำบิลมา
        </div>
        <p className="text-center text-[10px] text-gray-400">
          กดเรียกซ้ำได้อีกครั้งใน 5 นาที
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <button
        onClick={onCall}
        disabled={status === "calling"}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-300/50 transition active:scale-[0.98] disabled:opacity-60"
      >
        {status === "calling" ? (
          <>
            <Bell size={18} className="animate-pulse" />
            กำลังเรียก...
          </>
        ) : (
          <>
            <Receipt size={18} />
            เรียกเช็คบิล
          </>
        )}
      </button>
      {err && <p className="text-center text-xs text-red-500">{err}</p>}
    </div>
  );
}

function Center({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-soft">
        {children}
      </div>
    </div>
  );
}

function MemberBar({ member, onSignup, onLogout }) {
  if (member) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 border-t border-gray-100 bg-amber-50/60 px-4 py-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-700">
            {member.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-gray-800">
              {member.name}
            </p>
            <p className="text-[11px] text-amber-700">
              <Gift size={10} className="mr-1 inline-block" />
              {member.points.toLocaleString()} แต้ม
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700"
          aria-label="ออกจากบัญชี"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 border-t border-gray-100 bg-amber-50/50 px-4 py-2 text-sm">
      <p className="text-xs text-gray-600">
        <Gift size={12} className="mr-1 inline-block text-amber-500" />
        สมัครสมาชิกเพื่อสะสมแต้มทุกครั้งที่สั่ง
      </p>
      <button
        onClick={onSignup}
        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
      >
        <UserPlus size={12} /> สมัคร
      </button>
    </div>
  );
}

function SignupModal({ onClose, onDone }) {
  const [mode, setMode] = useState("signup"); // signup | login
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const cleanPhone = phone.trim();
    if (!/^[0-9]{9,10}$/.test(cleanPhone.replace(/[-\s]/g, ""))) {
      return setErr("เบอร์โทรไม่ถูกต้อง");
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) {
          setErr("กรุณากรอกชื่อ");
          setBusy(false);
          return;
        }
        try {
          await apiPost(
            "/members",
            { name: name.trim(), phone: cleanPhone },
            { auth: false }
          );
        } catch (e) {
          // If duplicate phone — treat as login
          if (!String(e.message).toLowerCase().includes("unique")) throw e;
        }
      }
      onDone(cleanPhone);
    } catch (e) {
      setErr(e.message || "ไม่สามารถดำเนินการได้");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">
            {mode === "signup" ? "สมัครสมาชิก" : "เข้าสู่ระบบสมาชิก"}
          </h3>
          <button onClick={onClose} className="text-gray-400">
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
          <Gift size={12} className="mr-1 inline-block" />
          สะสมแต้มทุกครั้งที่สั่งอาหาร นำไปแลกของรางวัลในร้านได้
        </p>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ชื่อ *
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="ชื่อ-สกุล หรือชื่อเล่น"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              เบอร์โทร *
            </label>
            <input
              required
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="08XXXXXXXX"
              autoFocus
            />
          </div>

          {err && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {err}
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
            {busy ? "กำลังบันทึก..." : mode === "signup" ? "สมัครและสะสมแต้ม" : "เข้าสู่ระบบ"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "signup" ? "login" : "signup"));
              setErr("");
            }}
            className="w-full py-2 text-center text-xs text-gray-500 hover:text-gray-700"
          >
            {mode === "signup"
              ? "เป็นสมาชิกอยู่แล้ว? เข้าสู่ระบบด้วยเบอร์โทร"
              : "ยังไม่เป็นสมาชิก? สมัครใหม่"}
          </button>
        </form>
      </div>
    </div>
  );
}
