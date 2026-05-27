import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router({ mergeParams: true });

export function loadRecipeForItem(itemId) {
  return db
    .prepare(
      `SELECT r.id, r.ingredient_id, r.qty, i.name AS ingredient_name, i.unit
       FROM recipes r
       JOIN ingredients i ON i.id = r.ingredient_id
       WHERE r.menu_item_id = ?
       ORDER BY i.name`
    )
    .all(itemId);
}

r.get("/", (req, res) => {
  res.json(loadRecipeForItem(Number(req.params.itemId)));
});

r.put("/", adminRequired, (req, res) => {
  const itemId = Number(req.params.itemId);
  const list = Array.isArray(req.body?.items) ? req.body.items : [];
  db.transaction(() => {
    db.prepare("DELETE FROM recipes WHERE menu_item_id = ?").run(itemId);
    const ins = db.prepare(
      "INSERT INTO recipes (menu_item_id, ingredient_id, qty) VALUES (?, ?, ?)"
    );
    for (const it of list) {
      const ingId = Number(it.ingredient_id);
      const qty = Number(it.qty);
      if (!ingId || !Number.isFinite(qty) || qty <= 0) continue;
      ins.run(itemId, ingId, qty);
    }
  })();
  res.json({ ok: true, items: loadRecipeForItem(itemId) });
});

export default r;
