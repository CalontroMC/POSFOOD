import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";
import menuOptionsRouter, { loadOptionsForItem } from "./menuOptions.js";
import recipesRouter, { loadRecipeForItem } from "./recipes.js";
import { UPLOAD_DIR } from "./uploads.js";

const r = Router();

function deleteLocalImage(imageUrl) {
  if (imageUrl && imageUrl.startsWith("/uploads/")) {
    const filename = imageUrl.substring(9); // remove "/uploads/"
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.unlink(filePath, (err) => {
      if (err) {
        if (err.code !== "ENOENT") {
          console.warn(`[uploads] Failed to delete file ${filePath}:`, err.message);
        }
      } else {
        console.log(`[uploads] Cleaned up orphaned file: ${filename}`);
      }
    });
  }
}

r.get("/categories", (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, name, sort_order, kitchen FROM categories ORDER BY sort_order, id"
    )
    .all();
  res.json(rows.map((r) => ({ ...r, kitchen: !!r.kitchen })));
});

r.post("/categories", adminRequired, (req, res) => {
  const { name, sort_order = 0, kitchen = 1 } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const info = db
    .prepare("INSERT INTO categories (name, sort_order, kitchen) VALUES (?, ?, ?)")
    .run(name, Number(sort_order) || 0, kitchen ? 1 : 0);
  res.json({ id: info.lastInsertRowid });
});

r.patch("/categories/:id", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const fields = ["name", "sort_order", "kitchen"];
  const sets = [];
  const vals = [];
  for (const f of fields) {
    if (req.body && f in req.body) {
      sets.push(`${f} = ?`);
      vals.push(f === "kitchen" ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  }
  if (sets.length === 0) return res.json({ ok: true });
  vals.push(id);
  db.prepare(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// Bulk toggle: set kitchen flag on all menu items in this category
r.patch("/categories/:id/kitchen", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const kitchen = req.body?.kitchen ? 1 : 0;
  db.transaction(() => {
    db.prepare("UPDATE categories SET kitchen = ? WHERE id = ?").run(kitchen, id);
    db.prepare("UPDATE menu_items SET kitchen = ? WHERE category_id = ?").run(kitchen, id);
  })();
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM menu_items WHERE category_id = ?")
    .get(id).n;
  res.json({ ok: true, kitchen: !!kitchen, items_updated: count });
});

r.delete("/categories/:id", adminRequired, (req, res) => {
  db.prepare("DELETE FROM categories WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

r.get("/items", (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.id, m.name, m.description, m.price, m.cost, m.points, m.image_url,
              m.available, m.kitchen, m.category_id, m.loyverse_variant_id,
              c.name AS category_name
       FROM menu_items m
       LEFT JOIN categories c ON c.id = m.category_id
       ORDER BY c.sort_order, m.id`
    )
    .all();

  const recipes = db.prepare(
    `SELECT r.menu_item_id, r.qty, i.quantity 
     FROM recipes r 
     JOIN ingredients i ON i.id = r.ingredient_id`
  ).all();

  // Group recipes by menu_item_id
  const recipeMap = {};
  for (const r of recipes) {
    if (!recipeMap[r.menu_item_id]) recipeMap[r.menu_item_id] = [];
    recipeMap[r.menu_item_id].push(r);
  }

  const items = rows.map((r) => {
    let isOut = false;
    if (recipeMap[r.id]) {
      isOut = recipeMap[r.id].some((rec) => rec.quantity < rec.qty);
    }
    return { ...r, is_out_of_stock: isOut };
  });

  const withOpts = req.query.with === "options";
  if (withOpts) {
    return res.json(
      items.map((r) => ({ ...r, options: loadOptionsForItem(r.id) }))
    );
  }
  res.json(items);
});

r.get("/items/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare(
      `SELECT m.id, m.name, m.description, m.price, m.cost, m.points, m.image_url,
              m.available, m.kitchen, m.category_id, m.loyverse_variant_id,
              c.name AS category_name
       FROM menu_items m
       LEFT JOIN categories c ON c.id = m.category_id
       WHERE m.id = ?`
    )
    .get(id);
  if (!row) return res.status(404).json({ error: "not found" });

  const recipes = db.prepare(
    `SELECT r.qty, i.quantity 
     FROM recipes r 
     JOIN ingredients i ON i.id = r.ingredient_id 
     WHERE r.menu_item_id = ?`
  ).all(id);
  const isOut = recipes.some((rec) => rec.quantity < rec.qty);

  res.json({ ...row, is_out_of_stock: isOut, options: loadOptionsForItem(id) });
});

r.post("/items", adminRequired, (req, res) => {
  const { name, category_id, price, cost = 0, points = 0, image_url, description, available = 1, kitchen = 1, loyverse_variant_id } =
    req.body || {};
  if (!name || price == null)
    return res.status(400).json({ error: "name and price required" });
  const info = db
    .prepare(
      "INSERT INTO menu_items (name, category_id, price, cost, points, image_url, description, available, kitchen, loyverse_variant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      name,
      category_id || null,
      Number(price),
      Number(cost) || 0,
      Number(points) || 0,
      image_url || null,
      description || null,
      available ? 1 : 0,
      kitchen ? 1 : 0,
      loyverse_variant_id || null
    );
  res.json({ id: info.lastInsertRowid });
});

r.patch("/items/:id", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const fields = [
    "name",
    "description",
    "category_id",
    "price",
    "cost",
    "points",
    "image_url",
    "available",
    "kitchen",
    "loyverse_variant_id",
  ];

  let oldImageUrl = null;
  if (req.body && "image_url" in req.body) {
    const item = db.prepare("SELECT image_url FROM menu_items WHERE id = ?").get(id);
    oldImageUrl = item?.image_url;
  }

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
  
  db.prepare(`UPDATE menu_items SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

  if (oldImageUrl && req.body.image_url !== oldImageUrl) {
    deleteLocalImage(oldImageUrl);
  }

  res.json({ ok: true });
});

r.delete("/items/:id", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const item = db.prepare("SELECT image_url FROM menu_items WHERE id = ?").get(id);
  db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
  if (item?.image_url) {
    deleteLocalImage(item.image_url);
  }
  res.json({ ok: true });
});

r.use("/items/:itemId/options", menuOptionsRouter);
r.use("/items/:itemId/recipe", recipesRouter);

export default r;
