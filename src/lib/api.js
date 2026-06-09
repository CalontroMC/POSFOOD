const TOKEN_KEY = "foodpos_admin_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token && options.auth !== false) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setToken("");
    if (!options.silent401) {
      window.dispatchEvent(new CustomEvent("foodpos:auth-expired"));
    }
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const apiGet = (p, opts) => api(p, { ...opts, method: "GET" });
export const apiPost = (p, body, opts) =>
  api(p, { ...opts, method: "POST", body: body ? JSON.stringify(body) : undefined });
export const apiPatch = (p, body, opts) =>
  api(p, { ...opts, method: "PATCH", body: body ? JSON.stringify(body) : undefined });
export const apiPut = (p, body, opts) =>
  api(p, { ...opts, method: "PUT", body: body ? JSON.stringify(body) : undefined });
export const apiDelete = (p, opts) => api(p, { ...opts, method: "DELETE" });

// ---------- Offline support ----------
const OUTBOX_KEY = "foodpos_outbox_v1";
const CACHE_PREFIX = "foodpos_cache_v1:";

function readOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeOutbox(list) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("foodpos:outbox-changed"));
}

export function outboxSize() {
  return readOutbox().length;
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

/**
 * Submit an order. If offline OR the request fails due to network error,
 * queue it in localStorage; otherwise send normally.
 */
export async function submitOrder(body) {
  if (!isOnline()) {
    const list = readOutbox();
    const id = `local-${Date.now()}`;
    list.push({ id, body, queuedAt: Date.now() });
    writeOutbox(list);
    return { offline: true, id, order_number: id.slice(-4), ...body };
  }
  try {
    return await apiPost("/orders", body, { auth: false });
  } catch (e) {
    // If it's a network error (not a 4xx/5xx with a response), queue it
    if (!e.status) {
      const list = readOutbox();
      const id = `local-${Date.now()}`;
      list.push({ id, body, queuedAt: Date.now() });
      writeOutbox(list);
      return { offline: true, id, order_number: id.slice(-4), ...body };
    }
    throw e;
  }
}

async function flushOutbox() {
  if (!isOnline()) return;
  let list = readOutbox();
  if (list.length === 0) return;
  const remaining = [];
  for (const item of list) {
    try {
      await apiPost("/orders", item.body, { auth: false });
    } catch (e) {
      // Keep in queue for retry only on network errors;
      // on 4xx (e.g. shift required) drop it
      if (!e.status) {
        remaining.push(item);
      } else {
        console.warn("[outbox] dropping bad item:", e.message);
      }
    }
  }
  writeOutbox(remaining);
  window.dispatchEvent(new CustomEvent("foodpos:outbox-synced", { detail: { sent: list.length - remaining.length } }));
}

if (typeof window !== "undefined") {
  window.addEventListener("online", flushOutbox);
  // Also try on load if we have queued items
  setTimeout(flushOutbox, 1500);
}

// Cached GET — falls back to localStorage when offline
export async function cachedGet(path, opts) {
  const key = CACHE_PREFIX + path;
  if (isOnline()) {
    try {
      const data = await api(path, { ...opts, method: "GET" });
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {}
      return data;
    } catch (e) {
      if (!e.status) {
        const cached = localStorage.getItem(key);
        if (cached) return JSON.parse(cached);
      }
      throw e;
    }
  } else {
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);
    throw new Error("ออฟไลน์ + ยังไม่มีข้อมูลแคช");
  }
}

export const Auth = {
  async login(pin) {
    const { token } = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ pin }),
      auth: false,
      silent401: true,
    });
    setToken(token);
    return token;
  },
  async logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    setToken("");
  },
  async me() {
    try {
      const { authenticated } = await api("/auth/me", { silent401: true });
      return authenticated;
    } catch {
      return false;
    }
  },
  hasToken() {
    return !!getToken();
  },
};

// --- Loyverse ---
export const loyverseStatus = () => api("/loyverse/status");
export const loyversePaymentTypes = () => api("/loyverse/payment-types");
export const loyverseItems = (cursor) => api(`/loyverse/items${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
export const loyverseSyncLog = (status) => api(`/loyverse/sync-log${status ? `?status=${status}` : ""}`);
export const loyverseRetry = (orderId) => api(`/loyverse/sync/${orderId}`, { method: "POST" });
