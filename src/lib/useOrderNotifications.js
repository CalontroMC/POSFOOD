import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "./api.js";

const KEY_ENABLED = "foodpos_notif_enabled";
const KEY_LAST_ID = "foodpos_notif_last_id";
const KEY_LAST_BILL_ID = "foodpos_notif_last_bill_id";
const KEY_VOLUME = "foodpos_notif_volume"; // 0..1

export function getNotifVolume() {
  const v = parseFloat(localStorage.getItem(KEY_VOLUME));
  if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  return 0.7; // default = the "2x louder" value
}

export function setNotifVolume(v) {
  const clamped = Math.max(0, Math.min(1, Number(v) || 0));
  localStorage.setItem(KEY_VOLUME, String(clamped));
  window.dispatchEvent(new CustomEvent("foodpos:notif-volume-changed"));
}

export function previewBeep() {
  playBeep();
}

function readEnabled() {
  const v = localStorage.getItem(KEY_ENABLED);
  return v == null ? true : v === "1";
}

export default function useOrderNotifications({ pollMs = 5000 } = {}) {
  const [enabled, setEnabledState] = useState(readEnabled);
  const [toasts, setToasts] = useState([]); // [{id, type, ...}]
  const lastIdRef = useRef(Number(localStorage.getItem(KEY_LAST_ID)) || 0);
  const lastBillIdRef = useRef(Number(localStorage.getItem(KEY_LAST_BILL_ID)) || 0);
  const initialisedRef = useRef(false);
  const initialisedBillRef = useRef(false);

  const setEnabled = useCallback((v) => {
    setEnabledState(v);
    localStorage.setItem(KEY_ENABLED, v ? "1" : "0");
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((arr) => arr.filter((o) => o.id !== id));
  }, []);

  const dismissKey = useCallback((key) => {
    setToasts((arr) => arr.filter((o) => o.key !== key));
  }, []);

  // Listen for cross-tab toggle changes
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY_ENABLED) setEnabledState(readEnabled());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Poll for new orders
  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const tick = async () => {
      try {
        const orders = await apiGet("/orders", { silent401: true });
        if (!alive || !Array.isArray(orders)) return;

        // Find max id
        const ids = orders.map((o) => Number(o.id) || 0);
        const newest = ids.length > 0 ? Math.max(...ids) : 0;
        const lastSeen = lastIdRef.current;

        // First poll after mount → just record, don't notify (avoid spamming on load)
        if (!initialisedRef.current) {
          initialisedRef.current = true;
          if (lastSeen === 0 || newest > lastSeen) {
            lastIdRef.current = newest;
            localStorage.setItem(KEY_LAST_ID, String(newest));
          }
          return;
        }

        // Anything newer than what we've seen?
        const fresh = orders.filter((o) => Number(o.id) > lastSeen);
        if (fresh.length > 0) {
          lastIdRef.current = newest;
          localStorage.setItem(KEY_LAST_ID, String(newest));
          const now = Date.now();
          setToasts((arr) => [
            ...arr,
            ...fresh
              .sort((a, b) => a.id - b.id)
              .map((o) => ({
                key: `order-${o.id}`,
                id: o.id,
                type: "order",
                order_number: o.order_number,
                table_number: o.table_number,
                label: o.label,
                total: o.total,
                ts: now,
              })),
          ]);
          playBeep();
          tryBrowserNotification("order", fresh.length, fresh[0]);
        }

        // Poll bill-requests too
        const bills = await apiGet("/bill-requests?status=open", { silent401: true });
        if (!alive || !Array.isArray(bills)) return;
        const billIds = bills.map((b) => Number(b.id) || 0);
        const newestBill = billIds.length > 0 ? Math.max(...billIds) : 0;
        const lastBillSeen = lastBillIdRef.current;

        if (!initialisedBillRef.current) {
          initialisedBillRef.current = true;
          if (lastBillSeen === 0 || newestBill > lastBillSeen) {
            lastBillIdRef.current = newestBill;
            localStorage.setItem(KEY_LAST_BILL_ID, String(newestBill));
          }
        } else {
          const freshBills = bills.filter((b) => Number(b.id) > lastBillSeen);
          if (freshBills.length > 0) {
            lastBillIdRef.current = newestBill;
            localStorage.setItem(KEY_LAST_BILL_ID, String(newestBill));
            const now = Date.now();
            setToasts((arr) => [
              ...arr,
              ...freshBills
                .sort((a, b) => a.id - b.id)
                .map((b) => ({
                  key: `bill-${b.id}`,
                  id: b.id,
                  type: "bill",
                  table_number: b.table_number,
                  status: b.status,
                  ts: now,
                })),
            ]);
            playBeep();
            playBeep(); // double beep for bill — more urgent
            tryBrowserNotification("bill", freshBills.length, freshBills[0]);
          }
        }
      } catch {
        // silent
      }
    };

    tick();
    const t = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [enabled, pollMs]);

  // Server-Sent Events for instant push
  useEffect(() => {
    if (!enabled) return;
    const sse = new EventSource("/api/events");

    sse.addEventListener("order", (e) => {
      try {
        const o = JSON.parse(e.data);
        if (!o.id) return;
        const lastSeen = lastIdRef.current;
        if (o.id > lastSeen) {
          lastIdRef.current = o.id;
          localStorage.setItem(KEY_LAST_ID, String(o.id));
          const now = Date.now();
          setToasts((arr) => [
            ...arr,
            {
              key: `order-${o.id}`,
              id: o.id,
              type: "order",
              order_number: o.order_number,
              table_number: o.table_number,
              label: o.label,
              total: o.total,
              ts: now,
            },
          ]);
          playBeep();
          tryBrowserNotification("order", 1, o);
        }
      } catch (err) {}
    });

    sse.addEventListener("bill", (e) => {
      try {
        const b = JSON.parse(e.data);
        if (!b.id) return;
        const lastSeen = lastBillIdRef.current;
        if (b.id > lastSeen) {
          lastBillIdRef.current = b.id;
          localStorage.setItem(KEY_LAST_BILL_ID, String(b.id));
          const now = Date.now();
          setToasts((arr) => [
            ...arr,
            {
              key: `bill-${b.id}`,
              id: b.id,
              type: "bill",
              table_number: b.table_number,
              status: b.status,
              ts: now,
            },
          ]);
          playBeep();
          playBeep(); // double beep for bill
          tryBrowserNotification("bill", 1, b);
        }
      } catch (err) {}
    });

    return () => {
      sse.close();
    };
  }, [enabled]);

  // Auto-dismiss toasts after 10s (bills) / 8s (orders)
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => {
      const lifeMs = t.type === "bill" ? 12000 : 8000;
      return setTimeout(() => dismissKey(t.key), lifeMs - (Date.now() - t.ts));
    });
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissKey]);

  return { enabled, setEnabled, toasts, dismiss, dismissKey };
}

// Generate a friendly ding-dong via Web Audio (no audio file needed)
function playBeep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const playTone = (freq, startAt, duration = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const vol = Math.max(0.0001, getNotifVolume());
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration + 0.05);
    };
    playTone(880, 0);
    playTone(1320, 0.18);
    // close AudioContext after sound finishes (avoid leaking)
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {}
}

function tryBrowserNotification(type, count, sample) {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      let title, body;
      if (type === "bill") {
        title = count === 1
          ? `เรียกเช็คบิล · โต๊ะ ${sample.table_number || "?"}`
          : `เรียกเช็คบิล ${count} โต๊ะ`;
        body = "ลูกค้ากำลังรอเช็คบิล";
      } else {
        title = count === 1 ? `ออเดอร์ใหม่ ${sample.order_number}` : `ออเดอร์ใหม่ ${count} รายการ`;
        body = sample.table_number
          ? `โต๊ะ ${sample.table_number} · ฿${sample.total}`
          : `ซื้อกลับบ้าน · ฿${sample.total}`;
      }
      const n = new Notification(title, {
        body,
        tag: `foodpos-${type}`,
        renotify: true,
      });
      setTimeout(() => n.close(), 6000);
    } else if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  } catch {}
}
