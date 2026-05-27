import { Router } from "express";
import db from "../db.js";
import { adminRequired, isValidToken } from "../middleware/auth.js";
import { printOrderTickets } from "../lib/printerJob.js";

function isAdminRequest(req) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return !!token && isValidToken(token);
}

const r = Router();

function nextOrderNumber() {
  const today = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM orders WHERE date(created_at) = date(?)"
    )
    .get(today);
  const n = (row?.n || 0) + 1;
  return `ORD${String(n).padStart(2, "0")}`;
}

function loadOrder(id) {
  const order = db
    .prepare(
      `SELECT o.*, t.table_number, m.name AS member_name, m.phone AS member_phone
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN members m ON m.id = o.member_id
       WHERE o.id = ?`
    )
    .get(id);
  // order.label included via SELECT o.*
  if (!order) return null;
  const items = db
    .prepare(
      "SELECT id, menu_item_id, name, price, qty, note, options_json FROM order_items WHERE order_id = ?"
    )
    .all(id);
  return {
    ...order,
    items: items.map((it) => ({
      ...it,
      options: it.options_json ? JSON.parse(it.options_json) : [],
    })),
  };
}

r.get("/", adminRequired, (req, res) => {
  const status = req.query.status;
  let rows;
  if (status && status !== "all") {
    rows = db
      .prepare(
        `SELECT o.*, t.table_number FROM orders o
         LEFT JOIN tables t ON t.id = o.table_id
         WHERE o.status = ? ORDER BY o.created_at DESC LIMIT 200`
      )
      .all(status);
  } else {
    rows = db
      .prepare(
        `SELECT o.*, t.table_number FROM orders o
         LEFT JOIN tables t ON t.id = o.table_id
         ORDER BY o.created_at DESC LIMIT 200`
      )
      .all();
  }
  res.json(rows);
});

r.get("/:id", (req, res) => {
  const order = loadOrder(Number(req.params.id));
  if (!order) return res.status(404).json({ error: "not found" });
  res.json(order);
});

function computeDiscount(subtotal, type, value) {
  if (!type || !value || value <= 0) return 0;
  if (type === "percent") return Math.min(subtotal, Math.round((subtotal * value) / 100));
  return Math.min(subtotal, Math.round(value));
}

// Public — customer submits from QR table
r.post("/", (req, res) => {
  const { table_token, member_phone, items, note, payment_method, discount_type, discount_value, hold, label, points_redeemed } = req.body || {};
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "items required" });

  let tableId = null;
  if (table_token) {
    const t = db.prepare("SELECT id FROM tables WHERE qr_token = ?").get(table_token);
    if (!t) return res.status(400).json({ error: "invalid table token" });
    tableId = t.id;
  }

  let memberId = null;
  if (member_phone) {
    const m = db.prepare("SELECT id FROM members WHERE phone = ?").get(member_phone);
    if (m) memberId = m.id;
  }

  // Loyalty: validate & clamp redeem (1 pt = 1 baht). Real deduct happens atomically inside transaction.
  const requestedRedeem = Math.max(0, Math.floor(Number(points_redeemed) || 0));
  if (requestedRedeem > 0 && !memberId) {
    return res.status(400).json({ error: "ต้องเลือกสมาชิกก่อนใช้แต้ม" });
  }

  const itemRows = [];
  let subtotal = 0;
  for (const it of items) {
    const mi = db
      .prepare(
        "SELECT id, name, price, points FROM menu_items WHERE id = ? AND available = 1"
      )
      .get(Number(it.menu_item_id));
    if (!mi) return res.status(400).json({ error: `menu item ${it.menu_item_id} unavailable` });
    const qty = Math.max(1, Number(it.qty) || 1);

    // Resolve selected options (option_ids array) → snapshot with names + price_delta
    const optionIds = Array.isArray(it.option_ids) ? it.option_ids.map(Number) : [];
    let optionsSnapshot = [];
    let optionDelta = 0;
    if (optionIds.length) {
      const placeholders = optionIds.map(() => "?").join(",");
      const opts = db
        .prepare(
          `SELECT mo.id, mo.name, mo.price_delta, mog.name AS group_name, mog.menu_item_id
           FROM menu_options mo
           JOIN menu_option_groups mog ON mog.id = mo.group_id
           WHERE mo.id IN (${placeholders})`
        )
        .all(...optionIds);
      for (const o of opts) {
        if (o.menu_item_id !== mi.id) {
          return res.status(400).json({
            error: `option ${o.id} does not belong to menu item ${mi.id}`,
          });
        }
        optionsSnapshot.push({
          id: o.id,
          group: o.group_name,
          name: o.name,
          price_delta: o.price_delta,
        });
        optionDelta += o.price_delta;
      }
    }

    const unitPrice = mi.price + optionDelta;
    subtotal += unitPrice * qty;
    itemRows.push({
      ...mi,
      qty,
      price: unitPrice,
      note: it.note || null,
      options_json: optionsSnapshot.length ? JSON.stringify(optionsSnapshot) : null,
    });
  }

  // Admin POS still requires an open shift; customer QR orders are accepted any time
  const currentShift = db
    .prepare("SELECT id FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1")
    .get();
  if (!currentShift && isAdminRequest(req)) {
    return res.status(409).json({
      error: "ยังไม่ได้เปิดกะ — กรุณาเปิดกะก่อนรับออเดอร์",
      code: "shift_required",
    });
  }
  const shiftId = currentShift?.id || null;

  const discount = computeDiscount(subtotal, discount_type, Number(discount_value) || 0);
  // Clamp redeem to amount remaining after discount (don't waste points beyond what they offset)
  const afterDiscount = Math.max(0, subtotal - discount);
  const pointsRedeemed = Math.min(requestedRedeem, afterDiscount);
  const total = Math.max(0, afterDiscount - pointsRedeemed);
  const orderNo = nextOrderNumber();
  const payment = payment_method && ["cash", "qr", "card", "other"].includes(payment_method)
    ? payment_method
    : "cash";
  const initialStatus = hold ? "พักบิล" : "รอรับ";

  try {
    const result = db.transaction(() => {
      // Atomic redeem: prevents double-spend if same member submits two orders concurrently
      if (pointsRedeemed > 0) {
        const upd = db
          .prepare("UPDATE members SET points = points - ? WHERE id = ? AND points >= ?")
          .run(pointsRedeemed, memberId, pointsRedeemed);
        if (upd.changes !== 1) {
          const err = new Error("แต้มของสมาชิกไม่พอ");
          err.statusCode = 400;
          throw err;
        }
      }

      const info = db
        .prepare(
          "INSERT INTO orders (order_number, table_id, member_id, status, subtotal, discount, total, note, shift_id, payment_method, discount_type, discount_value, label, points_redeemed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(orderNo, tableId, memberId, initialStatus, subtotal, discount, total, note || null, shiftId, payment, discount_type || null, discount_value || null, label || null, pointsRedeemed);
      const orderId = info.lastInsertRowid;
      const ins = db.prepare(
        "INSERT INTO order_items (order_id, menu_item_id, name, price, qty, note, options_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const it of itemRows) {
        ins.run(orderId, it.id, it.name, it.price, it.qty, it.note, it.options_json);
      }

      // Audit log for redeem (paired with the deduct above)
      if (pointsRedeemed > 0) {
        const bal = db.prepare("SELECT points FROM members WHERE id = ?").get(memberId).points;
        db.prepare(
          "INSERT INTO loyalty_transactions (member_id, order_id, points_delta, balance_after, reason) VALUES (?, ?, ?, ?, ?)"
        ).run(memberId, orderId, -pointsRedeemed, bal, "redeem:order");
      }

      if (tableId && !hold) {
        db.prepare("UPDATE tables SET status = 'มีลูกค้า' WHERE id = ?").run(tableId);
      }
      return orderId;
    })();

    const created = loadOrder(result);
    res.json(created);

    // Auto-print kitchen + bar tickets — fire-and-forget so a printer
    // outage never blocks order creation. Skipped for:
    //  - held bills (_client_print isn't applicable; nothing to send yet)
    //  - admin POS submits (POSPage.jsx prints client-side via printJob.js
    //    so it can use rawbt/browser modes — server skip avoids duplicates)
    if (!hold && req.body?._client_print !== 1) {
      printOrderTickets(created)
        .then((r) => {
          if (r?.error) console.warn("[printOrderTickets]", r.error);
          else if (r?.results) {
            const errs = r.results.filter((x) => x.error);
            if (errs.length) console.warn("[printOrderTickets] partial:", errs);
          }
        })
        .catch((e) => console.warn("[printOrderTickets] crash:", e.message));
    }
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || "ไม่สามารถสร้างออเดอร์ได้" });
  }
});

// Hold / Resume / Discount adjustment
r.post("/:id/hold", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare("SELECT status FROM orders WHERE id = ?").get(id);
  if (!exists) return res.status(404).json({ error: "not found" });
  if (["เสร็จสิ้น", "ยกเลิก"].includes(exists.status))
    return res.status(400).json({ error: "ออเดอร์ปิดแล้ว ไม่สามารถพักได้" });
  db.prepare("UPDATE orders SET status = 'พักบิล' WHERE id = ?").run(id);
  res.json({ ok: true });
});

r.post("/:id/resume", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare("SELECT status, table_id FROM orders WHERE id = ?").get(id);
  if (!exists) return res.status(404).json({ error: "not found" });
  if (exists.status !== "พักบิล")
    return res.status(400).json({ error: "ไม่ใช่บิลพัก" });
  db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'รอรับ' WHERE id = ?").run(id);
    if (exists.table_id) {
      db.prepare("UPDATE tables SET status = 'มีลูกค้า' WHERE id = ?").run(exists.table_id);
    }
  })();
  res.json({ ok: true });
});

function recalcTotals(orderId) {
  const items = db
    .prepare("SELECT price, qty FROM order_items WHERE order_id = ?")
    .all(orderId);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const o = db
    .prepare("SELECT discount_type, discount_value FROM orders WHERE id = ?")
    .get(orderId);
  const discount = computeDiscount(subtotal, o?.discount_type, Number(o?.discount_value) || 0);
  const total = Math.max(0, subtotal - discount);
  db.prepare(
    "UPDATE orders SET subtotal = ?, discount = ?, total = ? WHERE id = ?"
  ).run(subtotal, discount, total, orderId);
  return { subtotal, discount, total };
}

// Split: pull some items into a brand new order
r.post("/:id/split", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const source = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!source) return res.status(404).json({ error: "not found" });
  if (["เสร็จสิ้น", "ยกเลิก"].includes(source.status))
    return res.status(400).json({ error: "ออเดอร์ปิดแล้ว ไม่สามารถแยกบิลได้" });

  const moves = Array.isArray(req.body?.items) ? req.body.items : [];
  if (moves.length === 0)
    return res.status(400).json({ error: "เลือกอย่างน้อย 1 รายการ" });

  const result = db.transaction(() => {
    const orderNo = nextOrderNumber();
    const info = db
      .prepare(
        "INSERT INTO orders (order_number, table_id, member_id, status, subtotal, discount, total, note, shift_id, payment_method) VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, ?)"
      )
      .run(
        orderNo,
        source.table_id,
        source.member_id,
        source.status,
        source.note,
        source.shift_id,
        source.payment_method || "cash"
      );
    const newId = info.lastInsertRowid;

    for (const m of moves) {
      const itemId = Number(m.order_item_id);
      const moveQty = Math.max(1, Number(m.qty) || 1);
      const item = db
        .prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?")
        .get(itemId, id);
      if (!item) continue;
      const useQty = Math.min(moveQty, item.qty);
      if (useQty <= 0) continue;

      // Insert into new order
      db.prepare(
        "INSERT INTO order_items (order_id, menu_item_id, name, price, qty, note, options_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(newId, item.menu_item_id, item.name, item.price, useQty, item.note, item.options_json);

      if (useQty >= item.qty) {
        db.prepare("DELETE FROM order_items WHERE id = ?").run(itemId);
      } else {
        db.prepare("UPDATE order_items SET qty = qty - ? WHERE id = ?").run(useQty, itemId);
      }
    }

    recalcTotals(id);
    recalcTotals(newId);
    return newId;
  })();

  res.json(loadOrder(result));
});

// Merge: combine source orders into target
r.post("/merge", adminRequired, (req, res) => {
  const targetId = Number(req.body?.target_id);
  const sourceIds = (req.body?.source_ids || []).map(Number).filter((x) => x && x !== targetId);
  if (!targetId || sourceIds.length === 0)
    return res.status(400).json({ error: "ต้องระบุ target_id และ source_ids" });

  const target = db.prepare("SELECT * FROM orders WHERE id = ?").get(targetId);
  if (!target) return res.status(404).json({ error: "ไม่พบบิลเป้าหมาย" });
  if (["เสร็จสิ้น", "ยกเลิก"].includes(target.status))
    return res.status(400).json({ error: "บิลเป้าหมายปิดแล้ว" });

  db.transaction(() => {
    for (const sid of sourceIds) {
      const s = db.prepare("SELECT * FROM orders WHERE id = ?").get(sid);
      if (!s) continue;
      // Move items
      db.prepare("UPDATE order_items SET order_id = ? WHERE order_id = ?").run(targetId, sid);
      // Mark source as cancelled (merged)
      db.prepare("UPDATE orders SET status = 'ยกเลิก', note = COALESCE(note, '') || ?  WHERE id = ?").run(
        ` [รวมเข้าบิล #${targetId}]`,
        sid
      );
    }
    recalcTotals(targetId);
  })();

  res.json(loadOrder(targetId));
});

// Rename held bill / set label / note
r.patch("/:id", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const fields = ["label", "note"];
  const sets = [];
  const vals = [];
  for (const f of fields) {
    if (req.body && f in req.body) {
      sets.push(`${f} = ?`);
      vals.push(req.body[f]);
    }
  }
  if (sets.length === 0) return res.json({ ok: true });
  vals.push(id);
  db.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// Add items to existing (held) order
r.post("/:id/items", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const o = db.prepare("SELECT status FROM orders WHERE id = ?").get(id);
  if (!o) return res.status(404).json({ error: "not found" });
  if (["เสร็จสิ้น", "ยกเลิก"].includes(o.status))
    return res.status(400).json({ error: "ออเดอร์ปิดแล้ว" });
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) return res.status(400).json({ error: "items required" });

  db.transaction(() => {
    const insItem = db.prepare(
      "INSERT INTO order_items (order_id, menu_item_id, name, price, qty, note, options_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const it of items) {
      const mi = db
        .prepare("SELECT id, name, price FROM menu_items WHERE id = ? AND available = 1")
        .get(Number(it.menu_item_id));
      if (!mi) continue;
      const qty = Math.max(1, Number(it.qty) || 1);

      const optionIds = Array.isArray(it.option_ids) ? it.option_ids.map(Number) : [];
      let optionsSnapshot = [];
      let optionDelta = 0;
      if (optionIds.length) {
        const placeholders = optionIds.map(() => "?").join(",");
        const opts = db
          .prepare(
            `SELECT mo.id, mo.name, mo.price_delta, mog.name AS group_name, mog.menu_item_id
             FROM menu_options mo
             JOIN menu_option_groups mog ON mog.id = mo.group_id
             WHERE mo.id IN (${placeholders})`
          )
          .all(...optionIds);
        for (const o2 of opts) {
          if (o2.menu_item_id !== mi.id) continue;
          optionsSnapshot.push({
            id: o2.id,
            group: o2.group_name,
            name: o2.name,
            price_delta: o2.price_delta,
          });
          optionDelta += o2.price_delta;
        }
      }

      const unitPrice = mi.price + optionDelta;
      insItem.run(
        id,
        mi.id,
        mi.name,
        unitPrice,
        qty,
        it.note || null,
        optionsSnapshot.length ? JSON.stringify(optionsSnapshot) : null
      );
    }
    recalcTotals(id);
  })();

  res.json(loadOrder(id));
});

r.delete("/:id/items/:itemId", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const o = db.prepare("SELECT status FROM orders WHERE id = ?").get(id);
  if (!o) return res.status(404).json({ error: "not found" });
  if (["เสร็จสิ้น", "ยกเลิก"].includes(o.status))
    return res.status(400).json({ error: "ออเดอร์ปิดแล้ว" });
  db.transaction(() => {
    db.prepare("DELETE FROM order_items WHERE id = ? AND order_id = ?").run(itemId, id);
    recalcTotals(id);
  })();
  res.json(loadOrder(id));
});

r.patch("/:id/discount", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { discount_type, discount_value } = req.body || {};
  const o = db.prepare("SELECT subtotal FROM orders WHERE id = ?").get(id);
  if (!o) return res.status(404).json({ error: "not found" });
  const discount = computeDiscount(o.subtotal, discount_type, Number(discount_value) || 0);
  const total = Math.max(0, o.subtotal - discount);
  db.prepare(
    "UPDATE orders SET discount = ?, total = ?, discount_type = ?, discount_value = ? WHERE id = ?"
  ).run(discount, total, discount_type || null, discount_value || null, id);
  res.json({ ok: true, discount, total });
});

function deductIngredients(orderId) {
  // For each order item × recipe → reduce ingredient.quantity, log stock_movements
  const items = db
    .prepare(
      "SELECT menu_item_id, qty FROM order_items WHERE order_id = ? AND menu_item_id IS NOT NULL"
    )
    .all(orderId);
  const recipeStmt = db.prepare(
    "SELECT ingredient_id, qty FROM recipes WHERE menu_item_id = ?"
  );
  const updIng = db.prepare("UPDATE ingredients SET quantity = quantity - ? WHERE id = ?");
  const logMove = db.prepare(
    "INSERT INTO stock_movements (ingredient_id, delta, reason, ref_order_id) VALUES (?, ?, ?, ?)"
  );
  for (const it of items) {
    const recipe = recipeStmt.all(it.menu_item_id);
    for (const r of recipe) {
      const used = r.qty * it.qty;
      updIng.run(used, r.ingredient_id);
      logMove.run(r.ingredient_id, -used, "ตัดสต็อกจากออเดอร์", orderId);
    }
  }
}

r.patch("/:id/status", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { status, payment_method } = req.body || {};
  if (!status) return res.status(400).json({ error: "status required" });
  const valid = ["รอรับ", "กำลังทำ", "เสิร์ฟแล้ว", "เสร็จสิ้น", "ยกเลิก", "พักบิล"];
  if (!valid.includes(status))
    return res.status(400).json({ error: "invalid status" });

  const existing = db.prepare("SELECT status FROM orders WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "not found" });

  db.transaction(() => {
    const sets = ["status = ?"];
    const vals = [status];
    if (payment_method && ["cash", "qr", "card", "other"].includes(payment_method)) {
      sets.push("payment_method = ?");
      vals.push(payment_method);
    }
    vals.push(id);
    db.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

    if (status === "เสร็จสิ้น" && existing.status !== "เสร็จสิ้น") {
      const o = db.prepare("SELECT table_id, member_id, total FROM orders WHERE id = ?").get(id);
      if (o?.table_id) {
        db.prepare("UPDATE tables SET status = 'ว่าง' WHERE id = ?").run(o.table_id);
      }
      if (o?.member_id) {
        const pts = db
          .prepare(
            `SELECT COALESCE(SUM(mi.points * oi.qty), 0) AS pts
             FROM order_items oi
             LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
             WHERE oi.order_id = ?`
          )
          .get(id).pts;
        db.prepare(
          "UPDATE members SET points = points + ?, spending = spending + ?, visits = visits + 1 WHERE id = ?"
        ).run(pts, o.total, o.member_id);
      }
      deductIngredients(id);
    }

    // Refund redeemed points when order is cancelled.
    // Idempotent via `existing.status !== 'ยกเลิก'` (already-cancelled won't refund twice)
    // and by zeroing orders.points_redeemed after refund.
    // Note: earned points (from completed-then-cancelled flow) are not rolled back —
    // those represent goods that were consumed (sunk cost). Documented limitation.
    if (status === "ยกเลิก" && existing.status !== "ยกเลิก") {
      const o = db
        .prepare("SELECT member_id, points_redeemed FROM orders WHERE id = ?")
        .get(id);
      if (o?.member_id && o?.points_redeemed > 0) {
        db.prepare("UPDATE members SET points = points + ? WHERE id = ?")
          .run(o.points_redeemed, o.member_id);
        const bal = db.prepare("SELECT points FROM members WHERE id = ?").get(o.member_id).points;
        db.prepare(
          "INSERT INTO loyalty_transactions (member_id, order_id, points_delta, balance_after, reason) VALUES (?, ?, ?, ?, ?)"
        ).run(o.member_id, id, o.points_redeemed, bal, "refund:cancel");
        db.prepare("UPDATE orders SET points_redeemed = 0 WHERE id = ?").run(id);
      }
    }
  })();
  res.json({ ok: true });
});

r.get("/stats/dashboard", adminRequired, (req, res) => {
  const today = db
    .prepare(
      `SELECT
        COUNT(*) AS orders,
        COALESCE(SUM(total), 0) AS revenue,
        COALESCE(SUM(discount), 0) AS discount,
        SUM(CASE WHEN status = 'เสร็จสิ้น' THEN 1 ELSE 0 END) AS completed
       FROM orders WHERE date(created_at) = date('now')`
    )
    .get();
  const avg = today.orders > 0 ? Math.round(today.revenue / today.orders) : 0;

  const hourly = db
    .prepare(
      `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS h, SUM(total) AS revenue
       FROM orders WHERE date(created_at) = date('now')
       GROUP BY h`
    )
    .all();
  const hourlyMap = Object.fromEntries(hourly.map((r) => [r.h, r.revenue]));
  const hourlyRevenue = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    revenue: hourlyMap[h] || 0,
  }));

  const popular = db
    .prepare(
      `SELECT name, SUM(qty) AS count FROM order_items
       WHERE order_id IN (SELECT id FROM orders WHERE date(created_at) = date('now'))
       GROUP BY name ORDER BY count DESC LIMIT 5`
    )
    .all();

  const byCategory = db
    .prepare(
      `SELECT c.name AS category, COALESCE(SUM(oi.price * oi.qty), 0) AS sales
       FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN categories c ON c.id = mi.category_id
       WHERE oi.order_id IN (SELECT id FROM orders WHERE date(created_at) = date('now'))
       GROUP BY c.name ORDER BY sales DESC`
    )
    .all();

  res.json({
    stats: { ...today, avgPerOrder: avg },
    hourlyRevenue,
    popular,
    byCategory,
  });
});

export default r;
