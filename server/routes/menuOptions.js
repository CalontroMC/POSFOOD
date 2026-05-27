import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router({ mergeParams: true });

export function loadOptionsForItem(itemId) {
  const groups = db
    .prepare(
      `SELECT id, name, required, max_select, sort_order
       FROM menu_option_groups
       WHERE menu_item_id = ?
       ORDER BY sort_order, id`
    )
    .all(itemId);
  const getOpts = db.prepare(
    `SELECT id, group_id, name, price_delta, sort_order
     FROM menu_options
     WHERE group_id = ?
     ORDER BY sort_order, id`
  );
  return groups.map((g) => ({
    ...g,
    required: !!g.required,
    options: getOpts.all(g.id),
  }));
}

r.get("/", (req, res) => {
  const id = Number(req.params.itemId);
  res.json(loadOptionsForItem(id));
});

// PUT: replace all option groups + options for an item (transactional)
r.put("/", adminRequired, (req, res) => {
  const itemId = Number(req.params.itemId);
  const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];

  db.transaction(() => {
    db.prepare("DELETE FROM menu_option_groups WHERE menu_item_id = ?").run(itemId);
    const insGroup = db.prepare(
      "INSERT INTO menu_option_groups (menu_item_id, name, required, max_select, sort_order) VALUES (?, ?, ?, ?, ?)"
    );
    const insOpt = db.prepare(
      "INSERT INTO menu_options (group_id, name, price_delta, sort_order) VALUES (?, ?, ?, ?)"
    );
    groups.forEach((g, gi) => {
      if (!g?.name) return;
      const gInfo = insGroup.run(
        itemId,
        g.name,
        g.required ? 1 : 0,
        Math.max(1, Number(g.max_select) || 1),
        gi
      );
      const opts = Array.isArray(g.options) ? g.options : [];
      opts.forEach((o, oi) => {
        if (!o?.name) return;
        insOpt.run(gInfo.lastInsertRowid, o.name, Number(o.price_delta) || 0, oi);
      });
    });
  })();

  res.json({ ok: true, groups: loadOptionsForItem(itemId) });
});

export default r;
